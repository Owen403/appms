const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { URL } = require("url");
const LyricsExtractor = require("./services/LyricsExtractor");
const { execFile, spawn } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

// MySQL connection
const mysql = require("mysql2/promise");

const dbConfig = {
	host: "localhost",
	user: "root",
	password: "1234",
	database: "appmusic",
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
};

let db;

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Tạo thư mục uploads nếu chưa tồn tại
if (!fs.existsSync("uploads")) {
	fs.mkdirSync("uploads");
}

// Cấu hình multer để upload file
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "uploads/");
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
		cb(null, uniqueSuffix + path.extname(file.originalname));
	},
});

const upload = multer({
	storage: storage,
	fileFilter: function (req, file, cb) {
		if (file.fieldname === "audio") {
			if (file.mimetype.startsWith("audio/")) {
				cb(null, true);
			} else {
				cb(new Error("Chỉ chấp nhận file âm thanh!"), false);
			}
		} else {
			cb(null, true);
		}
	},
});

// Khởi tạo LyricsExtractor
const lyricsExtractor = new LyricsExtractor();

// Helper function: Validate audio file
function validateAudioFile(filePath) {
	try {
		// Kiểm tra file có tồn tại không
		if (!fs.existsSync(filePath)) {
			return {
				isValid: false,
				error: "File không tồn tại",
				suggestion: "Vui lòng kiểm tra lại đường dẫn file",
			};
		}

		// Lấy thông tin file
		const stats = fs.statSync(filePath);
		const fileSize = stats.size;
		const mimeType = require("mime-types").lookup(filePath);

		// Kiểm tra kích thước file (không được quá nhỏ - dưới 1KB có thể là file lỗi)
		if (fileSize < 1024) {
			return {
				isValid: false,
				error: "File quá nhỏ, có thể bị lỗi hoặc không phải file audio",
				suggestion: "Vui lòng kiểm tra lại file hoặc download lại",
			};
		}

		// Kiểm tra MIME type
		if (!mimeType || !mimeType.startsWith("audio/")) {
			// Kiểm tra extension làm backup
			const ext = path.extname(filePath).toLowerCase();
			const validExts = [".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac", ".wma", ".webm"];

			if (!validExts.includes(ext)) {
				return {
					isValid: false,
					error: `File không phải định dạng audio hợp lệ (MIME: ${mimeType || "unknown"}, ext: ${ext})`,
					suggestion: "Chỉ hỗ trợ các định dạng: MP3, WAV, OGG, M4A, FLAC, AAC, WMA, WEBM",
				};
			}
		}

		// File hợp lệ
		return {
			isValid: true,
			mimeType: mimeType,
			size: fileSize,
		};
	} catch (error) {
		return {
			isValid: false,
			error: `Lỗi kiểm tra file: ${error.message}`,
			suggestion: "Vui lòng thử lại hoặc chọn file khác",
		};
	}
}

// Helper function: Check if URL is YouTube
function isYouTubeURL(url) {
	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname.toLowerCase();
		return hostname.includes("youtube.com") || hostname.includes("youtu.be");
	} catch {
		return false;
	}
}

// Helper function: Download from YouTube
async function downloadFromYouTube(url) {
	return new Promise(async (resolve, reject) => {
		try {
			console.log("📺 Đang lấy thông tin video từ YouTube...");

			// Đường dẫn tới yt-dlp
			const ytdlpPath = path.join(__dirname, "bin", "yt-dlp.exe");

			// Kiểm tra yt-dlp có tồn tại không
			if (!fs.existsSync(ytdlpPath)) {
				return reject(
					new Error("Không tìm thấy yt-dlp.exe trong thư mục bin/. Vui lòng cài đặt yt-dlp trước."),
				);
			}

			// Lấy thông tin video trước
			let videoInfo;
			try {
				const { stdout } = await execFileAsync(ytdlpPath, ["--dump-json", "--no-playlist", url]);
				videoInfo = JSON.parse(stdout);
			} catch (infoError) {
				console.error("Lỗi lấy thông tin video:", infoError.message);
				return reject(new Error("Không thể lấy thông tin video từ YouTube"));
			}

			const videoTitle = videoInfo.title || "Unknown";
			const videoAuthor = videoInfo.uploader || videoInfo.channel || "Unknown Artist";
			const duration = videoInfo.duration || 0;

			console.log(`🎵 Video: "${videoTitle}" - ${videoAuthor} (${duration}s)`);

			// Tạo tên file
			const sanitizedTitle = videoTitle.replace(/[^a-z0-9]/gi, "_").substring(0, 50);
			const timestamp = Date.now();
			const filename = `${timestamp}-${sanitizedTitle}.mp3`;
			const filePath = path.join("uploads", filename);
			const tempPath = filePath + ".temp";

			console.log("📥 Bắt đầu download audio từ YouTube...");

			// Download audio với yt-dlp
			const ytdlpProcess = spawn(ytdlpPath, [
				"-f",
				"bestaudio/best",
				"-x", // Extract audio
				"--audio-format",
				"mp3",
				"--audio-quality",
				"0", // Best quality
				"--no-playlist",
				"-o",
				tempPath,
				"--no-part", // Không tạo .part file
				"--progress",
				url,
			]);

			let progressData = "";
			let hasError = false;
			let errorMessage = "";

			ytdlpProcess.stdout.on("data", (data) => {
				const output = data.toString();
				progressData += output;

				// Parse progress nếu có
				const percentMatch = output.match(/(\d+\.?\d*)%/);
				if (percentMatch) {
					console.log(`📥 Downloading: ${percentMatch[1]}%`);
				}
			});

			ytdlpProcess.stderr.on("data", (data) => {
				const error = data.toString();
				console.error("yt-dlp error:", error);
				errorMessage += error;
				hasError = true;
			});

			ytdlpProcess.on("close", (code) => {
				if (code === 0 && !hasError) {
					// yt-dlp tự động thêm extension, nên file thực tế là .mp3
					const actualFile = tempPath.replace(/\.temp$/, "") + ".mp3";

					// Tìm file đã download (yt-dlp có thể thêm extension khác nhau)
					let downloadedFilePath = null;
					const possibleFiles = [tempPath + ".mp3", tempPath, filePath, tempPath.replace(".temp", "")];

					for (const possibleFile of possibleFiles) {
						if (fs.existsSync(possibleFile)) {
							downloadedFilePath = possibleFile;
							break;
						}
					}

					if (!downloadedFilePath) {
						return reject(new Error("Không tìm thấy file đã download"));
					}

					// Đổi tên file về đúng format nếu cần
					if (downloadedFilePath !== filePath) {
						try {
							fs.renameSync(downloadedFilePath, filePath);
							downloadedFilePath = filePath;
						} catch (renameError) {
							console.log("Không thể rename, sử dụng file gốc");
						}
					}

					const stats = fs.statSync(downloadedFilePath);
					console.log(`✅ Download hoàn tất từ YouTube: ${downloadedFilePath} (${stats.size} bytes)`);

					resolve({
						filePath: downloadedFilePath,
						title: videoTitle,
						artist: videoAuthor,
						size: stats.size,
						duration: duration,
					});
				} else {
					reject(new Error(`yt-dlp failed với code ${code}: ${errorMessage || "Unknown error"}`));
				}
			});

			ytdlpProcess.on("error", (error) => {
				reject(new Error(`Lỗi chạy yt-dlp: ${error.message}`));
			});
		} catch (error) {
			reject(new Error(`Lỗi YouTube: ${error.message}`));
		}
	});
}

// Khởi tạo database và server
async function startServer() {
	try {
		console.log("🔄 Đang kết nối MySQL...");

		// Thử kết nối mà không chỉ định database trước
		const tempConnection = await mysql.createConnection({
			host: dbConfig.host,
			user: dbConfig.user,
			password: dbConfig.password,
		});

		// Tạo database nếu chưa tồn tại
		await tempConnection.execute(
			`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
		);
		console.log("✅ Database appmusic đã được tạo/kiểm tra!");

		await tempConnection.end();

		// Kết nối với database
		db = mysql.createPool(dbConfig);

		// Tạo bảng songs
		await db.execute(`
            CREATE TABLE IF NOT EXISTS songs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                lyrics TEXT,
                synced_lyrics TEXT,
                duration INT DEFAULT NULL,
                file_size BIGINT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
		console.log("✅ Bảng songs đã được tạo/kiểm tra!");

		// Thêm cột file_size nếu chưa tồn tại (cho bảng cũ)
		try {
			await db.execute(`
				ALTER TABLE songs 
				ADD COLUMN file_size BIGINT DEFAULT NULL
			`);
			console.log("✅ Đã thêm cột file_size vào bảng songs");
		} catch (alterError) {
			// Bỏ qua lỗi nếu cột đã tồn tại
			if (alterError.code === "ER_DUP_FIELDNAME") {
				console.log("ℹ️ Cột file_size đã tồn tại");
			} else {
				console.log("⚠️ Lỗi khi thêm cột file_size:", alterError.message);
			}
		}

		// Thêm cột synced_lyrics nếu chưa tồn tại
		try {
			await db.execute(`
				ALTER TABLE songs 
				ADD COLUMN synced_lyrics TEXT DEFAULT NULL
			`);
			console.log("✅ Đã thêm cột synced_lyrics vào bảng songs");
		} catch (alterError) {
			if (alterError.code === "ER_DUP_FIELDNAME") {
				console.log("ℹ️ Cột synced_lyrics đã tồn tại");
			} else {
				console.log("⚠️ Lỗi khi thêm cột synced_lyrics:", alterError.message);
			}
		}

		// Khởi động server
		app.listen(PORT, () => {
			console.log(`🎵 Server đang chạy trên port ${PORT}`);
			console.log(`🌐 Truy cập ứng dụng tại: http://localhost:${PORT}`);
			console.log(`📊 Database: MySQL - ${dbConfig.database}`);
		});
	} catch (error) {
		console.error("❌ Lỗi khởi động server:", error.message);
		if (error.code === "ECONNREFUSED") {
			console.log("💡 Hướng dẫn khắc phục:");
			console.log("1. Kiểm tra MySQL service đã chạy chưa");
			console.log("2. Kiểm tra thông tin kết nối trong server.js");
			console.log("3. Chạy lệnh: net start mysql (Windows)");
		}
		process.exit(1);
	}
}

// Routes
app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API để lấy danh sách bài hát
app.get("/api/songs", async (req, res) => {
	try {
		const [rows] = await db.execute("SELECT * FROM songs ORDER BY created_at DESC");
		res.json(rows);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// API để lấy thông tin một bài hát
app.get("/api/songs/:id", async (req, res) => {
	try {
		const id = req.params.id;
		const [rows] = await db.execute("SELECT * FROM songs WHERE id = ?", [id]);

		if (rows.length === 0) {
			res.status(404).json({ error: "Không tìm thấy bài hát" });
			return;
		}

		res.json(rows[0]);
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// API để upload bài hát
app.post("/api/upload", upload.single("audio"), async (req, res) => {
	if (!req.file) {
		return res.status(400).json({ error: "Vui lòng chọn file nhạc" });
	}

	let { title, artist, lyrics, autoExtract } = req.body;
	const filePath = req.file.path;

	// Validate file là audio
	const validation = validateAudioFile(filePath);
	if (!validation.isValid) {
		return res.status(400).json({
			error: validation.error,
			suggestion: validation.suggestion,
		});
	}

	try {
		let finalTitle = title;
		let finalArtist = artist;
		let finalLyrics = lyrics || "";
		let extractionInfo = {};

		// Nếu bật tự động trích xuất hoặc thiếu thông tin
		if (autoExtract === "true" || !title || !artist) {
			console.log(`\n🎵 Tự động trích xuất thông tin từ: ${req.file.originalname}`);

			try {
				const metadata = await lyricsExtractor.processAudioFile(filePath);

				// Sử dụng thông tin từ metadata nếu không có input từ user
				finalTitle = title || metadata.title || req.file.originalname;
				finalArtist = artist || metadata.artist || "Unknown Artist";

				// Sử dụng lời từ metadata/API nếu user không nhập
				if (!lyrics && metadata.lyrics) {
					finalLyrics = metadata.lyrics;
					extractionInfo = {
						lyricsFound: true,
						lyricsSource: metadata.lyricsSource,
						duration: metadata.duration,
						album: metadata.album,
						year: metadata.year,
						genre: metadata.genre,
					};
				} else {
					extractionInfo = {
						lyricsFound: false,
						lyricsSource: metadata.lyricsSource || "none",
						duration: metadata.duration,
						album: metadata.album,
						year: metadata.year,
						genre: metadata.genre,
					};
				}

				console.log(`✅ Trích xuất hoàn tất: "${finalTitle}" - ${finalArtist}`);
			} catch (extractError) {
				console.error(`❌ Lỗi trích xuất: ${extractError.message}`);
				// Vẫn tiếp tục với thông tin có sẵn
				finalTitle = title || req.file.originalname;
				finalArtist = artist || "Unknown Artist";
				extractionInfo = { error: extractError.message };
			}
		}

		// Kiểm tra thông tin bắt buộc
		if (!finalTitle || !finalArtist) {
			return res.status(400).json({
				error: "Vui lòng nhập đầy đủ thông tin bài hát hoặc bật tự động trích xuất",
			});
		}

		// Lưu vào database
		const fileStats = fs.statSync(filePath);
		const [result] = await db.execute(
			`INSERT INTO songs (title, artist, file_path, lyrics, duration, file_size) VALUES (?, ?, ?, ?, ?, ?)`,
			[finalTitle, finalArtist, filePath, finalLyrics, extractionInfo.duration || null, fileStats.size],
		);

		res.json({
			id: result.insertId,
			title: finalTitle,
			artist: finalArtist,
			file_path: filePath,
			lyrics: finalLyrics,
			duration: extractionInfo.duration,
			extraction: extractionInfo,
			message: "Upload thành công!",
		});
	} catch (error) {
		// Xóa file nếu có lỗi
		fs.unlink(filePath, (unlinkErr) => {
			if (unlinkErr) console.log("Không thể xóa file:", unlinkErr);
		});

		res.status(500).json({ error: error.message });
	}
});

// API để xóa bài hát
app.delete("/api/songs/:id", async (req, res) => {
	try {
		const id = req.params.id;

		// Lấy thông tin file trước khi xóa
		const [rows] = await db.execute("SELECT file_path FROM songs WHERE id = ?", [id]);

		if (rows.length > 0) {
			// Xóa file khỏi hệ thống
			fs.unlink(rows[0].file_path, (err) => {
				if (err) console.log("Không thể xóa file:", err);
			});
		}

		// Xóa record khỏi database
		await db.execute("DELETE FROM songs WHERE id = ?", [id]);
		res.json({ message: "Đã xóa bài hát thành công" });
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// API để tìm lời bài hát cho bài hát đã có
app.post("/api/songs/:id/find-lyrics", async (req, res) => {
	try {
		const id = req.params.id;

		// Lấy thông tin bài hát
		const [songs] = await db.execute("SELECT * FROM songs WHERE id = ?", [id]);

		if (songs.length === 0) {
			return res.status(404).json({ error: "Không tìm thấy bài hát" });
		}

		const song = songs[0];
		console.log(`🔍 Tìm lời cho bài hát: "${song.title}" - ${song.artist}`);

		// Tìm lời bài hát
		const lyrics = await lyricsExtractor.searchLyrics(song.artist, song.title);

		if (lyrics) {
			// Cập nhật lời vào database
			await db.execute("UPDATE songs SET lyrics = ? WHERE id = ?", [lyrics, id]);

			res.json({
				success: true,
				lyrics: lyrics,
				message: `Đã tìm thấy và cập nhật lời cho "${song.title}"`,
			});
		} else {
			res.json({
				success: false,
				lyrics: null,
				message: `Không tìm thấy lời cho "${song.title}" - ${song.artist}`,
			});
		}
	} catch (error) {
		console.error("Lỗi tìm lời:", error);
		res.status(500).json({ error: error.message });
	}
});

// API để cập nhật synced lyrics
app.post("/api/songs/:id/update-synced-lyrics", async (req, res) => {
	try {
		const id = req.params.id;
		const { synced_lyrics } = req.body;

		// Validate synced lyrics format (basic check)
		if (synced_lyrics && synced_lyrics.trim() !== "") {
			// Check if it contains LRC format timestamps
			const hasValidFormat = /\[\d{2}:\d{2}\.\d{2}\]/.test(synced_lyrics);
			if (!hasValidFormat) {
				return res.status(400).json({
					error: "Format synced lyrics không hợp lệ. Phải có dạng [mm:ss.xx] text",
				});
			}
		}

		// Update synced lyrics
		await db.execute("UPDATE songs SET synced_lyrics = ? WHERE id = ?", [synced_lyrics || null, id]);

		res.json({
			success: true,
			message: "Đã cập nhật synced lyrics thành công",
		});
	} catch (error) {
		console.error("Lỗi cập nhật synced lyrics:", error);
		res.status(500).json({ error: error.message });
	}
});

// API để phân tích file nhạc và lấy metadata
app.post("/api/analyze-audio", upload.single("audio"), async (req, res) => {
	if (!req.file) {
		return res.status(400).json({ error: "Vui lòng chọn file nhạc" });
	}

	try {
		console.log(`🎵 Phân tích file: ${req.file.originalname}`);
		const metadata = await lyricsExtractor.processAudioFile(req.file.path);

		// Xóa file tạm sau khi phân tích
		fs.unlink(req.file.path, (err) => {
			if (err) console.log("Không thể xóa file tạm:", err);
		});

		res.json({
			success: true,
			metadata: metadata,
			message: "Phân tích hoàn tất",
		});
	} catch (error) {
		// Xóa file tạm nếu có lỗi
		fs.unlink(req.file.path, (err) => {
			if (err) console.log("Không thể xóa file tạm:", err);
		});

		res.status(500).json({ error: error.message });
	}
});

// API để tìm lời bài hát theo tên và nghệ sĩ
app.post("/api/search-lyrics", async (req, res) => {
	const { artist, title } = req.body;

	if (!artist || !title) {
		return res.status(400).json({ error: "Vui lòng nhập tên bài hát và nghệ sĩ" });
	}

	try {
		console.log(`🔍 Tìm lời cho: "${title}" - ${artist}`);
		const lyrics = await lyricsExtractor.searchLyrics(artist, title);

		if (lyrics) {
			res.json({
				success: true,
				lyrics: lyrics,
				message: `Tìm thấy lời cho "${title}" - ${artist}`,
			});
		} else {
			res.json({
				success: false,
				lyrics: null,
				message: `Không tìm thấy lời cho "${title}" - ${artist}`,
			});
		}
	} catch (error) {
		res.status(500).json({ error: error.message });
	}
});

// API để upload nhạc từ URL
app.post("/api/upload-url", async (req, res) => {
	const { url, title, artist, lyrics, autoExtract } = req.body;

	if (!url) {
		return res.status(400).json({ error: "Vui lòng nhập URL" });
	}

	let downloadedFile = null;

	try {
		// Validate URL
		try {
			new URL(url);
		} catch (urlError) {
			return res.status(400).json({ error: "URL không hợp lệ" });
		}

		console.log(`🌐 Bắt đầu download từ URL: ${url}`);

		let downloadResult;
		let finalTitle = title;
		let finalArtist = artist;

		// Kiểm tra nếu là YouTube URL
		if (isYouTubeURL(url)) {
			console.log("📺 Phát hiện URL YouTube, sử dụng ytdl-core...");

			try {
				downloadResult = await downloadFromYouTube(url);
				downloadedFile = downloadResult.filePath;

				// Nếu không có title/artist từ user, dùng từ YouTube
				if (!finalTitle) finalTitle = downloadResult.title;
				if (!finalArtist) finalArtist = downloadResult.artist;

				console.log(`✅ Download từ YouTube thành công: ${downloadedFile}`);
			} catch (ytError) {
				console.error(`❌ Lỗi download YouTube: ${ytError.message}`);
				return res.status(400).json({
					error: `Không thể download từ YouTube: ${ytError.message}`,
					suggestion: "Vui lòng kiểm tra lại URL YouTube hoặc thử URL khác",
				});
			}
		} else {
			// Download từ URL thông thường
			const filename = getFilenameFromURL(url);
			downloadResult = await downloadFileFromURL(url, filename);
			downloadedFile = downloadResult.filePath;

			// Validate file là audio trước khi xử lý
			console.log(`🔍 Đang kiểm tra định dạng file: ${downloadedFile}`);
			const validation = validateAudioFile(downloadedFile);

			if (!validation.isValid) {
				// Xóa file không hợp lệ
				fs.unlink(downloadedFile, (err) => {
					if (err) console.log("Không thể xóa file:", err);
				});

				return res.status(400).json({
					error: `❌ ${validation.error}`,
					suggestion: `💡 ${validation.suggestion}`,
					details: "File được download không phải định dạng audio hợp lệ",
				});
			}

			console.log(`✅ File validation OK: ${validation.format || "Audio"}`);
		}
		const stats = fs.statSync(downloadedFile);
		if (stats.size === 0) {
			throw new Error("File download bị lỗi (0 bytes)");
		}

		// Giới hạn kích thước file: 50MB
		const maxSize = 50 * 1024 * 1024; // 50MB
		if (stats.size > maxSize) {
			throw new Error(`File quá lớn (giới hạn 50MB)`);
		}

		console.log(`📁 File đã download: ${downloadedFile} (${stats.size} bytes)`);

		// Xử lý giống như upload file thông thường
		let finalLyrics = lyrics || "";
		let extractionInfo = {};

		// Auto extract nếu được yêu cầu hoặc thiếu thông tin
		if (autoExtract === true || autoExtract === "true" || !finalTitle || !finalArtist) {
			try {
				console.log(`🎵 Tự động trích xuất metadata từ file audio hợp lệ`);
				const metadata = await lyricsExtractor.processAudioFile(downloadedFile);

				// Ưu tiên thông tin user nhập > metadata file > fallback
				if (!finalTitle)
					finalTitle = metadata.title || path.basename(downloadedFile, path.extname(downloadedFile));
				if (!finalArtist) finalArtist = metadata.artist || "Unknown Artist";

				if (!lyrics && metadata.lyrics) {
					finalLyrics = metadata.lyrics;
				}

				extractionInfo = {
					lyricsFound: !!metadata.lyrics,
					lyricsSource: metadata.lyricsSource,
					duration: metadata.duration,
					album: metadata.album,
					year: metadata.year,
					genre: metadata.genre,
					fileSize: stats.size,
				};

				console.log(`✅ Trích xuất hoàn tất: "${finalTitle}" - ${finalArtist}`);
			} catch (extractError) {
				console.error(`❌ Lỗi trích xuất: ${extractError.message}`);
				if (!finalTitle) finalTitle = path.basename(downloadedFile, path.extname(downloadedFile));
				if (!finalArtist) finalArtist = "Unknown Artist";
				extractionInfo = {
					error: extractError.message,
					fileSize: stats.size,
				};
			}
		}

		// Kiểm tra thông tin bắt buộc
		if (!finalTitle || !finalArtist) {
			throw new Error("Thiếu thông tin bài hát (tên hoặc nghệ sĩ)");
		}

		// Lưu vào database
		const [result] = await db.execute(
			`INSERT INTO songs (title, artist, file_path, lyrics, duration, file_size) VALUES (?, ?, ?, ?, ?, ?)`,
			[finalTitle, finalArtist, downloadedFile, finalLyrics, extractionInfo.duration || null, stats.size],
		);

		res.json({
			id: result.insertId,
			title: finalTitle,
			artist: finalArtist,
			file_path: downloadedFile,
			lyrics: finalLyrics,
			duration: extractionInfo.duration,
			fileSize: stats.size,
			extraction: extractionInfo,
			source: "url",
			originalUrl: url,
			message: "Upload từ URL thành công!",
		});
	} catch (error) {
		console.error("Lỗi upload từ URL:", error);

		// Xóa file đã download nếu có lỗi
		if (downloadedFile && fs.existsSync(downloadedFile)) {
			fs.unlink(downloadedFile, (unlinkErr) => {
				if (unlinkErr) console.log("Không thể xóa file:", unlinkErr);
			});
		}

		res.status(500).json({
			error: error.message,
			details: "Lỗi khi download hoặc xử lý file từ URL",
		});
	}
});

// Hàm download file từ URL
async function downloadFileFromURL(url, filename) {
	return new Promise((resolve, reject) => {
		try {
			const parsedUrl = new URL(url);
			const protocol = parsedUrl.protocol === "https:" ? https : http;

			const request = protocol.get(
				url,
				{
					timeout: 30000,
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
					},
				},
				(response) => {
					// Kiểm tra redirect
					if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
						return downloadFileFromURL(response.headers.location, filename)
							.then(resolve)
							.catch(reject);
					}

					if (response.statusCode !== 200) {
						reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
						return;
					}

					// Kiểm tra content type
					const contentType = response.headers["content-type"] || "";
					if (!contentType.startsWith("audio/") && !contentType.startsWith("video/")) {
						console.log(`⚠️ Warning: Content-Type là ${contentType}, không phải audio`);
					}

					const filePath = path.join("uploads", filename);
					const fileStream = fs.createWriteStream(filePath);

					let downloadedBytes = 0;
					const totalBytes = parseInt(response.headers["content-length"] || "0");

					response.on("data", (chunk) => {
						downloadedBytes += chunk.length;
						if (totalBytes > 0) {
							const progress = Math.round((downloadedBytes / totalBytes) * 100);
							if (progress % 10 === 0) {
								console.log(
									`📥 Download progress: ${progress}% (${downloadedBytes}/${totalBytes} bytes)`,
								);
							}
						}
					});

					response.pipe(fileStream);

					fileStream.on("finish", () => {
						fileStream.close();
						console.log(`✅ Download hoàn tất: ${filePath} (${downloadedBytes} bytes)`);
						resolve({
							filePath: filePath,
							size: downloadedBytes,
							contentType: contentType,
						});
					});

					fileStream.on("error", (error) => {
						fs.unlink(filePath, () => {}); // Xóa file lỗi
						reject(error);
					});
				},
			);

			request.on("timeout", () => {
				request.destroy();
				reject(new Error("Download timeout (30s)"));
			});

			request.on("error", (error) => {
				reject(error);
			});
		} catch (error) {
			reject(error);
		}
	});
}

// Hàm tạo filename từ URL
function getFilenameFromURL(url, contentType = "") {
	try {
		const parsedUrl = new URL(url);
		let filename = path.basename(parsedUrl.pathname);

		// Nếu không có extension, thêm dựa vào content-type
		if (!path.extname(filename) && contentType) {
			if (contentType.includes("mp3")) filename += ".mp3";
			else if (contentType.includes("wav")) filename += ".wav";
			else if (contentType.includes("ogg")) filename += ".ogg";
			else if (contentType.includes("m4a")) filename += ".m4a";
			else filename += ".mp3"; // default
		}

		// Nếu vẫn không có filename hợp lệ
		if (!filename || filename === "/" || filename === ".mp3") {
			const timestamp = Date.now();
			filename = `audio-${timestamp}.mp3`;
		}

		// Làm sạch filename
		filename = filename.replace(/[^a-zA-Z0-9.-]/g, "_");

		// Thêm timestamp để tránh trùng lặp
		const ext = path.extname(filename);
		const basename = path.basename(filename, ext);
		const timestamp = Date.now() + "-" + Math.round(Math.random() * 1000);

		return `${timestamp}-${basename}${ext}`;
	} catch (error) {
		const timestamp = Date.now();
		return `audio-${timestamp}.mp3`;
	}
}

// ========== PLAYLIST ROUTES ==========

// Lấy tất cả playlists
app.get("/api/playlists", async (req, res) => {
	try {
		const [playlists] = await db.query(`
			SELECT p.*, 
				COUNT(ps.id) as song_count
			FROM playlists p
			LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
			GROUP BY p.id
			ORDER BY p.created_at DESC
		`);
		res.json(playlists);
	} catch (error) {
		console.error("Lỗi lấy danh sách playlists:", error);
		res.status(500).json({ error: "Lỗi server" });
	}
});

// Tạo playlist mới
app.post("/api/playlists", async (req, res) => {
	try {
		const { name, description } = req.body;

		if (!name || name.trim() === "") {
			return res.status(400).json({ error: "Tên playlist không được để trống" });
		}

		const [result] = await db.query("INSERT INTO playlists (name, description) VALUES (?, ?)", [
			name.trim(),
			description || "",
		]);

		res.json({
			success: true,
			message: "Tạo playlist thành công!",
			playlistId: result.insertId,
		});
	} catch (error) {
		console.error("Lỗi tạo playlist:", error);
		res.status(500).json({ error: "Lỗi server" });
	}
});

// Lấy chi tiết playlist với danh sách bài hát
app.get("/api/playlists/:id", async (req, res) => {
	try {
		const { id } = req.params;

		// Lấy thông tin playlist
		const [playlists] = await db.query("SELECT * FROM playlists WHERE id = ?", [id]);

		if (playlists.length === 0) {
			return res.status(404).json({ error: "Không tìm thấy playlist" });
		}

		// Lấy danh sách bài hát trong playlist
		const [songs] = await db.query(
			`
			SELECT s.*, ps.position, ps.added_at
			FROM songs s
			INNER JOIN playlist_songs ps ON s.id = ps.song_id
			WHERE ps.playlist_id = ?
			ORDER BY ps.position ASC, ps.added_at ASC
		`,
			[id],
		);

		res.json({
			...playlists[0],
			songs: songs,
		});
	} catch (error) {
		console.error("Lỗi lấy chi tiết playlist:", error);
		res.status(500).json({ error: "Lỗi server" });
	}
});

// Thêm bài hát vào playlist
app.post("/api/playlists/:id/songs", async (req, res) => {
	try {
		const { id } = req.params;
		const { songId } = req.body;

		if (!songId) {
			return res.status(400).json({ error: "Thiếu songId" });
		}

		// Kiểm tra playlist tồn tại
		const [playlists] = await db.query("SELECT id FROM playlists WHERE id = ?", [id]);
		if (playlists.length === 0) {
			return res.status(404).json({ error: "Không tìm thấy playlist" });
		}

		// Kiểm tra bài hát tồn tại
		const [songs] = await db.query("SELECT id, title FROM songs WHERE id = ?", [songId]);
		if (songs.length === 0) {
			return res.status(404).json({ error: "Không tìm thấy bài hát" });
		}

		// Lấy position cao nhất
		const [maxPos] = await db.query(
			"SELECT COALESCE(MAX(position), -1) as max_position FROM playlist_songs WHERE playlist_id = ?",
			[id],
		);
		const newPosition = maxPos[0].max_position + 1;

		// Thêm vào playlist
		await db.query(
			"INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE position = VALUES(position)",
			[id, songId, newPosition],
		);

		res.json({
			success: true,
			message: `Đã thêm "${songs[0].title}" vào playlist`,
		});
	} catch (error) {
		console.error("Lỗi thêm bài hát vào playlist:", error);
		res.status(500).json({ error: "Lỗi server" });
	}
});

// Xóa bài hát khỏi playlist
app.delete("/api/playlists/:playlistId/songs/:songId", async (req, res) => {
	try {
		const { playlistId, songId } = req.params;

		const [result] = await db.query("DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?", [
			playlistId,
			songId,
		]);

		if (result.affectedRows === 0) {
			return res.status(404).json({ error: "Không tìm thấy bài hát trong playlist" });
		}

		res.json({
			success: true,
			message: "Đã xóa bài hát khỏi playlist",
		});
	} catch (error) {
		console.error("Lỗi xóa bài hát khỏi playlist:", error);
		res.status(500).json({ error: "Lỗi server" });
	}
});

// Xóa playlist
app.delete("/api/playlists/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const [result] = await db.query("DELETE FROM playlists WHERE id = ?", [id]);

		if (result.affectedRows === 0) {
			return res.status(404).json({ error: "Không tìm thấy playlist" });
		}

		res.json({
			success: true,
			message: "Đã xóa playlist",
		});
	} catch (error) {
		console.error("Lỗi xóa playlist:", error);
		res.status(500).json({ error: "Lỗi server" });
	}
});

// Cập nhật thông tin playlist
app.put("/api/playlists/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const { name, description } = req.body;

		if (!name || name.trim() === "") {
			return res.status(400).json({ error: "Tên playlist không được để trống" });
		}

		await db.query("UPDATE playlists SET name = ?, description = ? WHERE id = ?", [
			name.trim(),
			description || "",
			id,
		]);

		res.json({
			success: true,
			message: "Cập nhật playlist thành công",
		});
	} catch (error) {
		console.error("Lỗi cập nhật playlist:", error);
		res.status(500).json({ error: "Lỗi server" });
	}
});

// ========== END PLAYLIST ROUTES ==========

// Khởi động server
startServer();

// Graceful shutdown
process.on("SIGINT", async () => {
	console.log("\nĐang đóng server...");
	try {
		if (db) {
			await db.end();
		}
		console.log("Đã đóng kết nối database.");
		process.exit(0);
	} catch (error) {
		console.error("Lỗi khi đóng database:", error);
		process.exit(1);
	}
});
