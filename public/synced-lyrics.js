// Synced Lyrics (Karaoke Mode) Handler
class SyncedLyricsPlayer {
	constructor(audioElement, lyricsContainer) {
		this.audio = audioElement;
		this.container = lyricsContainer;
		this.lyrics = [];
		this.currentIndex = -1;
		this.isEnabled = false;
	}

	// Parse LRC format lyrics
	parseLRC(lrcText) {
		if (!lrcText || typeof lrcText !== "string") {
			return [];
		}

		const lines = lrcText.split("\n");
		const parsedLyrics = [];

		for (const line of lines) {
			// Match pattern: [mm:ss.xx] text or [mm:ss] text
			const match = line.match(/\[(\d{2}):(\d{2})\.?(\d{2})?\]\s*(.+)/);

			if (match) {
				const minutes = parseInt(match[1]);
				const seconds = parseInt(match[2]);
				const centiseconds = match[3] ? parseInt(match[3]) : 0;

				const time = minutes * 60 + seconds + centiseconds / 100;
				const text = match[4].trim();

				if (text) {
					parsedLyrics.push({ time, text });
				}
			}
		}

		// Sort by time
		parsedLyrics.sort((a, b) => a.time - b.time);
		return parsedLyrics;
	}

	// Load synced lyrics
	load(lrcText) {
		this.lyrics = this.parseLRC(lrcText);
		this.currentIndex = -1;
		this.isEnabled = this.lyrics.length > 0;

		if (this.isEnabled) {
			this.render();
			this.setupEventListeners();
			console.log(`✅ Đã load ${this.lyrics.length} dòng synced lyrics`);
		}
	}

	// Render lyrics to container
	render() {
		if (!this.isEnabled) {
			this.container.innerHTML = '<p class="no-lyrics">Không có lời bài hát đồng bộ</p>';
			return;
		}

		this.container.innerHTML = "";
		this.container.classList.add("synced-lyrics-container");

		this.lyrics.forEach((lyric, index) => {
			const lineDiv = document.createElement("div");
			lineDiv.className = "lyric-line";
			lineDiv.dataset.index = index;
			lineDiv.dataset.time = lyric.time;
			lineDiv.textContent = lyric.text;

			// Click to seek
			lineDiv.addEventListener("click", () => {
				this.audio.currentTime = lyric.time;
			});

			this.container.appendChild(lineDiv);
		});
	}

	// Setup event listeners
	setupEventListeners() {
		if (this.timeUpdateListener) {
			this.audio.removeEventListener("timeupdate", this.timeUpdateListener);
		}

		this.timeUpdateListener = () => this.update();
		this.audio.addEventListener("timeupdate", this.timeUpdateListener);
	}

	// Update active lyric line
	update() {
		if (!this.isEnabled || this.lyrics.length === 0) return;

		const currentTime = this.audio.currentTime;
		let newIndex = -1;

		// Find current lyric index
		for (let i = this.lyrics.length - 1; i >= 0; i--) {
			if (currentTime >= this.lyrics[i].time) {
				newIndex = i;
				break;
			}
		}

		// Update if changed
		if (newIndex !== this.currentIndex) {
			// Remove old active
			if (this.currentIndex >= 0) {
				const oldLine = this.container.querySelector(`[data-index="${this.currentIndex}"]`);
				if (oldLine) {
					oldLine.classList.remove("active", "previous");
				}
			}

			// Mark previous lines
			const allLines = this.container.querySelectorAll(".lyric-line");
			allLines.forEach((line, idx) => {
				line.classList.remove("active", "previous", "upcoming");
				if (idx < newIndex) {
					line.classList.add("previous");
				} else if (idx === newIndex) {
					line.classList.add("active");
				} else {
					line.classList.add("upcoming");
				}
			});

			this.currentIndex = newIndex;

			// Auto scroll to active line
			const activeLine = this.container.querySelector(".active");
			if (activeLine) {
				activeLine.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
			}
		}
	}

	// Clear and disable
	clear() {
		this.lyrics = [];
		this.currentIndex = -1;
		this.isEnabled = false;

		if (this.timeUpdateListener) {
			this.audio.removeEventListener("timeupdate", this.timeUpdateListener);
		}

		this.container.innerHTML = '<p class="no-lyrics">Chọn bài hát để xem lời...</p>';
		this.container.classList.remove("synced-lyrics-container");
	}

	// Check if synced lyrics is available
	hasLyrics() {
		return this.isEnabled && this.lyrics.length > 0;
	}
}

// Export for global use
if (typeof window !== "undefined") {
	window.SyncedLyricsPlayer = SyncedLyricsPlayer;
}
