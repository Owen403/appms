const mm = require("music-metadata");
const https = require("https");
const fs = require("fs");
const path = require("path");

class LyricsExtractor {
	constructor() {
		this.apis = [
			{
				name: "Lyrics.ovh",
				url: (artist, title) =>
					`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`,
				extract: (data) => data.lyrics,
			},
			{
				name: "Musixmatch",
				url: (artist, title) =>
					`https://www.musixmatch.com/search/${encodeURIComponent(artist + " " + title)}`,
				extract: this.extractFromMusixmatch,
			},
		];
	}

	// Trích xuất metadata từ file MP3
	async extractMetadata(filePath) {
		try {
			console.log(`📖 Đang đọc metadata từ file: ${filePath}`);
			const metadata = await mm.parseFile(filePath);

			const info = {
				title: metadata.common.title || path.basename(filePath, path.extname(filePath)),
				artist: metadata.common.artist || "Unknown Artist",
				album: metadata.common.album || "Unknown Album",
				year: metadata.common.year || null,
				duration: metadata.format.duration || null,
				genre: metadata.common.genre ? metadata.common.genre.join(", ") : null,
				lyrics: metadata.common.lyrics ? metadata.common.lyrics.join("\n") : null,
			};

			console.log(`✅ Metadata extracted:`, {
				title: info.title,
				artist: info.artist,
				duration: info.duration
					? `${Math.floor(info.duration / 60)}:${Math.floor(info.duration % 60)
							.toString()
							.padStart(2, "0")}`
					: null,
				hasLyrics: !!info.lyrics,
			});

			return info;
		} catch (error) {
			console.error(`❌ Lỗi đọc metadata: ${error.message}`);
			throw error;
		}
	}

	// Tìm lời bài hát từ các API
	async searchLyrics(artist, title) {
		console.log(`🔍 Đang tìm lời bài hát cho: "${title}" - ${artist}`);

		for (const api of this.apis) {
			try {
				console.log(`📡 Thử API: ${api.name}`);
				const lyrics = await this.tryGetLyrics(api, artist, title);

				if (lyrics && lyrics.trim().length > 50) {
					console.log(`✅ Tìm thấy lời bài hát từ ${api.name} (${lyrics.length} ký tự)`);
					return this.cleanLyrics(lyrics);
				}
			} catch (error) {
				console.log(`❌ Lỗi từ ${api.name}: ${error.message}`);
				continue;
			}
		}

		console.log(`❌ Không tìm thấy lời bài hát cho "${title}" - ${artist}`);
		return null;
	}

	// Thử lấy lời từ một API cụ thể
	async tryGetLyrics(api, artist, title) {
		const url = api.url(artist, title);

		return new Promise((resolve, reject) => {
			const request = https.get(
				url,
				{
					timeout: 10000,
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
					},
				},
				(response) => {
					let data = "";

					response.on("data", (chunk) => {
						data += chunk;
					});

					response.on("end", () => {
						try {
							if (api.name === "Lyrics.ovh") {
								const jsonData = JSON.parse(data);
								resolve(jsonData.lyrics);
							} else {
								resolve(api.extract(data));
							}
						} catch (error) {
							reject(new Error(`Parse error: ${error.message}`));
						}
					});
				},
			);

			request.on("error", (error) => {
				reject(new Error(`API ${api.name} failed: ${error.message}`));
			});

			request.on("timeout", () => {
				request.destroy();
				reject(new Error(`API ${api.name} timeout`));
			});
		});
	}

	// Trích xuất lời từ Musixmatch (web scraping) - tạm thời tắt
	extractFromMusixmatch(html) {
		// Tạm thời không dùng web scraping để tránh lỗi
		return null;
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

	// API Google Search cho lời bài hát (backup)
	async searchGoogleLyrics(artist, title) {
		try {
			const query = `${artist} ${title} lyrics site:genius.com OR site:azlyrics.com OR site:metrolyrics.com`;
			const searchUrl = `https://www.googleapis.com/customsearch/v1?key=YOUR_API_KEY&cx=YOUR_CX&q=${encodeURIComponent(
				query,
			)}`;

			// Note: Cần API key của Google Custom Search
			// const response = await axios.get(searchUrl);
			// return this.extractLyricsFromSearchResults(response.data);

			return null;
		} catch (error) {
			console.log(`Google Search API error: ${error.message}`);
			return null;
		}
	}

	// Tìm lời bài hát từ file LRC đồng hành
	async findLRCFile(audioFilePath) {
		try {
			const dir = path.dirname(audioFilePath);
			const basename = path.basename(audioFilePath, path.extname(audioFilePath));
			const lrcPath = path.join(dir, basename + ".lrc");

			if (fs.existsSync(lrcPath)) {
				console.log(`📄 Tìm thấy file LRC: ${lrcPath}`);
				const lrcContent = fs.readFileSync(lrcPath, "utf8");
				return this.parseLRC(lrcContent);
			}

			return null;
		} catch (error) {
			console.log(`Lỗi đọc file LRC: ${error.message}`);
			return null;
		}
	}

	// Parse file LRC (lyrics with timestamps)
	parseLRC(lrcContent) {
		try {
			const lines = lrcContent.split("\n");
			const lyrics = [];

			for (const line of lines) {
				const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2})\](.*)$/);
				if (match) {
					const [, minutes, seconds, centiseconds, text] = match;
					const timestamp = parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;

					if (text.trim()) {
						lyrics.push({
							time: timestamp,
							text: text.trim(),
						});
					}
				}
			}

			// Trả về chỉ text, không có timestamps cho database
			return lyrics.map((l) => l.text).join("\n");
		} catch (error) {
			console.log(`Lỗi parse LRC: ${error.message}`);
			return null;
		}
	}

	// Xử lý file MP3 hoàn chỉnh
	async processAudioFile(filePath) {
		try {
			console.log(`\n🎵 Bắt đầu xử lý file: ${path.basename(filePath)}`);

			// 1. Trích xuất metadata
			const metadata = await this.extractMetadata(filePath);

			// 2. Kiểm tra lời có sẵn trong metadata
			if (metadata.lyrics && metadata.lyrics.length > 50) {
				console.log(`✅ Lời bài hát có sẵn trong metadata`);
				return { ...metadata, lyricsSource: "metadata" };
			}

			// 3. Tìm file LRC đồng hành
			const lrcLyrics = await this.findLRCFile(filePath);
			if (lrcLyrics) {
				console.log(`✅ Lời bài hát từ file LRC`);
				return { ...metadata, lyrics: lrcLyrics, lyricsSource: "lrc" };
			}

			// 4. Tìm lời online
			const onlineLyrics = await this.searchLyrics(metadata.artist, metadata.title);
			if (onlineLyrics) {
				console.log(`✅ Lời bài hát từ API online`);
				return { ...metadata, lyrics: onlineLyrics, lyricsSource: "online" };
			}

			// 5. Không tìm thấy lời
			console.log(`⚠️ Không tìm thấy lời bài hát`);
			return { ...metadata, lyricsSource: "none" };
		} catch (error) {
			console.error(`❌ Lỗi xử lý file ${filePath}: ${error.message}`);
			throw error;
		}
	}
}

module.exports = LyricsExtractor;
