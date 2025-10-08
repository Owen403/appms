const https = require("https");
const http = require("http");
const path = require("path");
const fs = require("fs");

class SimpleLyricsExtractor {
	constructor() {
		// Chỉ sử dụng API đơn giản không cần dependencies phức tạp
		console.log("🎵 SimpleLyricsExtractor khởi tạo - chế độ basic");
	}

	// Trích xuất metadata cơ bản từ tên file
	async extractMetadata(filePath) {
		try {
			console.log(`📖 Đang đọc thông tin cơ bản từ file: ${filePath}`);

			// Lấy thông tin file
			const fileName = path.basename(filePath, path.extname(filePath));
			const stats = fs.statSync(filePath);

			// Thử parse tên file theo format "Artist - Title"
			let artist = "Unknown Artist";
			let title = fileName;

			if (fileName.includes(" - ")) {
				const parts = fileName.split(" - ");
				if (parts.length >= 2) {
					artist = parts[0].trim();
					title = parts.slice(1).join(" - ").trim();
				}
			}

			const info = {
				title: title,
				artist: artist,
				album: "Unknown Album",
				year: null,
				duration: null, // Không thể tính toán mà không có thư viện
				genre: null,
				lyrics: null,
				fileSize: stats.size,
				fileName: fileName,
			};

			console.log(`✅ Thông tin cơ bản:`, {
				title: info.title,
				artist: info.artist,
				fileSize: `${Math.round(info.fileSize / 1024)} KB`,
			});

			return info;
		} catch (error) {
			console.error(`❌ Lỗi đọc file: ${error.message}`);
			throw error;
		}
	}

	// Tìm lời bài hát từ API đơn giản
	async searchLyrics(artist, title) {
		console.log(`🔍 Đang tìm lời bài hát cho: "${title}" - ${artist}`);

		try {
			// Thử API Lyrics.ovh (miễn phí, không cần key)
			const lyrics = await this.getLyricsFromOvh(artist, title);

			if (lyrics && lyrics.trim().length > 50) {
				console.log(`✅ Tìm thấy lời bài hát (${lyrics.length} ký tự)`);
				return this.cleanLyrics(lyrics);
			}

			console.log(`❌ Không tìm thấy lời bài hát cho "${title}" - ${artist}`);
			return null;
		} catch (error) {
			console.error(`❌ Lỗi tìm lời: ${error.message}`);
			return null;
		}
	}

	// Lấy lời từ Lyrics.ovh API
	async getLyricsFromOvh(artist, title) {
		return new Promise((resolve, reject) => {
			const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;

			console.log(`📡 Thử API: Lyrics.ovh`);

			const request = https.get(
				url,
				{
					timeout: 10000,
					headers: {
						"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
					},
				},
				(response) => {
					let data = "";

					response.on("data", (chunk) => {
						data += chunk;
					});

					response.on("end", () => {
						try {
							if (response.statusCode === 200) {
								const result = JSON.parse(data);
								if (result.lyrics) {
									resolve(result.lyrics);
								} else {
									resolve(null);
								}
							} else {
								resolve(null);
							}
						} catch (error) {
							console.log(`Parse error: ${error.message}`);
							resolve(null);
						}
					});
				},
			);

			request.on("error", (error) => {
				console.log(`Request error: ${error.message}`);
				resolve(null);
			});

			request.on("timeout", () => {
				console.log("Request timeout");
				request.destroy();
				resolve(null);
			});
		});
	}

	// Làm sạch lời bài hát
	cleanLyrics(lyrics) {
		if (!lyrics) return null;

		return lyrics
			.replace(/\r\n/g, "\n")
			.replace(/\r/g, "\n")
			.replace(/\n{3,}/g, "\n\n")
			.trim();
	}

	// Xử lý file MP3 hoàn chỉnh
	async processAudioFile(filePath) {
		try {
			console.log(`\n🎵 Bắt đầu xử lý file: ${path.basename(filePath)}`);

			// 1. Trích xuất thông tin cơ bản
			const metadata = await this.extractMetadata(filePath);

			// 2. Tìm lời online
			const onlineLyrics = await this.searchLyrics(metadata.artist, metadata.title);
			if (onlineLyrics) {
				console.log(`✅ Lời bài hát từ API online`);
				return { ...metadata, lyrics: onlineLyrics, lyricsSource: "online" };
			}

			// 3. Không tìm thấy lời
			console.log(`⚠️ Không tìm thấy lời bài hát`);
			return { ...metadata, lyricsSource: "none" };
		} catch (error) {
			console.error(`❌ Lỗi xử lý file ${filePath}: ${error.message}`);
			throw error;
		}
	}
}

module.exports = SimpleLyricsExtractor;
