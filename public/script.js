// Biến global
let currentSongs = [];
let currentSongId = null;
let syncedLyricsPlayer = null;
let currentLyricsMode = "normal"; // 'normal' or 'synced'

// DOM Elements
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const uploadForm = document.getElementById("upload-form");
const songsListContainer = document.getElementById("songs-list");
const audioPlayer = document.getElementById("audio-player");
const audioSource = document.getElementById("audio-source");
const currentTitle = document.getElementById("current-title");
const currentArtist = document.getElementById("current-artist");
const lyricsDisplay = document.getElementById("lyrics-display");
const loadingOverlay = document.getElementById("loading-overlay");
const toast = document.getElementById("toast");

// Lyrics mode buttons
const modeNormalBtn = document.getElementById("mode-normal");
const modeSyncedBtn = document.getElementById("mode-synced");

// New elements for lyrics extraction
const analyzeBtn = document.getElementById("analyzeBtn");
const findLyricsBtn = document.getElementById("findLyricsBtn");
const lyricsStatus = document.getElementById("lyricsStatus");
const autoExtractCheckbox = document.getElementById("autoExtract");
const titleInput = document.getElementById("title");
const artistInput = document.getElementById("artist");
const lyricsTextarea = document.getElementById("lyrics");
const audioFileInput = document.getElementById("audio");

// Khởi tạo synced lyrics player
if (typeof SyncedLyricsPlayer !== "undefined") {
	syncedLyricsPlayer = new SyncedLyricsPlayer(audioPlayer, lyricsDisplay);
}

// Khởi tạo ứng dụng
document.addEventListener("DOMContentLoaded", function () {
	console.log("Script loaded - checking functions:", {
		formatTime: typeof formatTime,
		formatTimeToLRC: typeof formatTimeToLRC,
		safeSetCurrentTime: typeof safeSetCurrentTime,
	});
	initializeTabs();
	loadSongs();
	setupUploadForm();
	setupAudioPlayer();
	setupLyricsFeatures();
	setupUploadMethods();
	setupLyricsModeToggle();

	// Khôi phục trạng thái sau khi reload
	restorePlayerState();
});

// Lưu trạng thái player
function savePlayerState() {
	const state = {
		songId: currentSongId,
		currentTime: audioPlayer.currentTime,
		volume: audioPlayer.volume,
		lyricsMode: currentLyricsMode,
		activeTab: document.querySelector(".tab-btn.active")?.getAttribute("data-tab") || "player",
	};
	localStorage.setItem("playerState", JSON.stringify(state));
}

// Khôi phục trạng thái player
async function restorePlayerState() {
	const savedState = localStorage.getItem("playerState");
	if (!savedState) return;

	try {
		const state = JSON.parse(savedState);

		// Khôi phục tab
		if (state.activeTab) {
			switchTab(state.activeTab);
		}

		// Khôi phục volume
		if (state.volume !== undefined) {
			audioPlayer.volume = state.volume;
		}

		// Khôi phục lyrics mode
		if (state.lyricsMode) {
			currentLyricsMode = state.lyricsMode;
			modeNormalBtn?.classList.toggle("active", state.lyricsMode === "normal");
			modeSyncedBtn?.classList.toggle("active", state.lyricsMode === "synced");
		}

		// Khôi phục bài hát đang phát
		if (state.songId) {
			const response = await fetch(`/api/songs/${state.songId}`);
			if (response.ok) {
				const song = await response.json();

				currentSongId = state.songId;
				currentTitle.textContent = song.title;
				currentArtist.textContent = song.artist;
				audioSource.src = `/${song.file_path}`;
				audioPlayer.load();

				// Khôi phục thời gian phát
				if (state.currentTime) {
					audioPlayer.currentTime = state.currentTime;
				}

				// Hiển thị lời bài hát
				if (currentLyricsMode === "synced" && song.synced_lyrics) {
					displaySyncedLyrics(song.synced_lyrics);
				} else {
					displayNormalLyrics(song.lyrics);
				}

				console.log("✅ Đã khôi phục trạng thái player");
			}
		}
	} catch (error) {
		console.error("Lỗi khôi phục trạng thái:", error);
	}
}

// Quản lý tabs
function initializeTabs() {
	tabBtns.forEach((btn) => {
		btn.addEventListener("click", function () {
			const targetTab = this.getAttribute("data-tab");
			switchTab(targetTab);
		});
	});
}

function switchTab(tabName) {
	// Xóa active class khỏi tất cả tabs
	tabBtns.forEach((btn) => btn.classList.remove("active"));
	tabContents.forEach((content) => content.classList.remove("active"));

	// Thêm active class cho tab được chọn
	const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
	const selectedContent = document.getElementById(`${tabName}-tab`);

	if (selectedBtn && selectedContent) {
		selectedBtn.classList.add("active");
		selectedContent.classList.add("active");
	}

	// Load dữ liệu nếu cần
	if (tabName === "songs") {
		loadSongs();
	} else if (tabName === "playlists") {
		loadPlaylists();
	}

	// Lưu trạng thái tab hiện tại
	savePlayerState();
}

// Tải danh sách bài hát
async function loadSongs() {
	try {
		showLoading(true);
		const response = await fetch("/api/songs");
		const songs = await response.json();

		if (response.ok) {
			currentSongs = songs;
			displaySongs(songs);
		} else {
			console.error("Lỗi khi tải danh sách bài hát:", songs.error);
		}
	} catch (error) {
		console.error("Lỗi kết nối:", error.message);
	} finally {
		showLoading(false);
	}
}

// Hiển thị danh sách bài hát
function displaySongs(songs) {
	if (songs.length === 0) {
		songsListContainer.innerHTML = `
            <div class="loading">
                <i class="fas fa-music"></i>
                <p>Chưa có bài hát nào. Hãy upload bài hát đầu tiên!</p>
            </div>
        `;
		return;
	}

	const songsHTML = songs
		.map(
			(song) => `
        <div class="song-item" data-id="${song.id}">
            <div class="song-info">
                <div class="song-details">
                    <h4>${escapeHtml(song.title)}</h4>
                    <p><i class="fas fa-user"></i> ${escapeHtml(song.artist)}</p>
                    <small><i class="fas fa-calendar"></i> ${formatDate(song.created_at)}</small>
                </div>
                <div class="song-actions">
                    <button class="btn btn-play" onclick="playSong(${song.id})">
                        <i class="fas fa-play"></i> Phát
                    </button>
                    ${
					!song.lyrics || song.lyrics.trim().length < 10
						? `
                    <button class="btn btn-find-song-lyrics" onclick="findLyricsForSong(${song.id})">
                        <i class="fas fa-search"></i> Tìm lời
                    </button>
                    `
						: `
                    <span class="lyrics-indicator">
                        <i class="fas fa-check-circle"></i> Có lời
                    </span>
                    `
				}
                    ${
					song.synced_lyrics
						? `
                    <span class="karaoke-indicator">
                        <i class="fas fa-microphone-alt"></i> Karaoke
                    </span>
                    `
						: ""
				}
                    <button class="btn btn-edit-synced" onclick="openSyncedLyricsEditor(${song.id})">
                        <i class="fas fa-music"></i> ${song.synced_lyrics ? "Sửa" : "Thêm"} Karaoke
                    </button>
                    <button class="btn btn-secondary add-to-playlist-btn" onclick="showAddToPlaylistModal(${song.id})">
                        <i class="fas fa-plus"></i> Thêm vào Playlist
                    </button>
                    <button class="btn btn-delete" onclick="deleteSong(${song.id})">
                        <i class="fas fa-trash"></i> Xóa
                    </button>
                </div>
            </div>
        </div>
    `,
		)
		.join("");

	songsListContainer.innerHTML = songsHTML;
}

// Phát bài hát
async function playSong(songId) {
	try {
		showLoading(true);
		const response = await fetch(`/api/songs/${songId}`);
		const song = await response.json();

		if (response.ok) {
			currentSongId = songId;

			// Cập nhật thông tin bài hát
			currentTitle.textContent = song.title;
			currentArtist.textContent = song.artist;

			// Cập nhật audio player
			audioSource.src = `/${song.file_path}`;
			audioPlayer.load();
			audioPlayer.play();

			// TỰ ĐỘNG BẬT KARAOKE nếu có synced lyrics
			if (song.synced_lyrics && song.synced_lyrics.trim() !== "") {
				// Chuyển sang chế độ Karaoke tự động
				currentLyricsMode = "synced";
				modeNormalBtn.classList.remove("active");
				modeSyncedBtn.classList.add("active");
				displaySyncedLyrics(song.synced_lyrics);
				showToast(`🎤 Đang phát: ${song.title} (Chế độ Karaoke)`, "success");
			} else if (currentLyricsMode === "synced" && song.synced_lyrics) {
				// Nếu đang ở chế độ synced
				displaySyncedLyrics(song.synced_lyrics);
				showToast(`Đang phát: ${song.title}`, "success");
			} else {
				// Không có synced lyrics, hiển thị lời thường
				displayNormalLyrics(song.lyrics);
				showToast(`Đang phát: ${song.title}`, "success");
			}

			// Chuyển về tab player
			switchTab("player");
		} else {
			showToast("Lỗi khi phát bài hát: " + song.error, "error");
		}
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Hiển thị lời bài hát (deprecated - use displayNormalLyrics or displaySyncedLyrics)
function displayLyrics(lyrics) {
	displayNormalLyrics(lyrics);
}

// Xóa bài hát
async function deleteSong(songId) {
	// BỎ CONFIRM - Xóa luôn không hỏi

	try {
		showLoading(true);
		const response = await fetch(`/api/songs/${songId}`, {
			method: "DELETE",
		});

		const result = await response.json();

		if (response.ok) {
			showToast(result.message, "success");

			// Nếu đang phát bài hát bị xóa, dừng phát
			if (currentSongId === songId) {
				audioPlayer.pause();
				currentTitle.textContent = "Chọn bài hát để phát";
				currentArtist.textContent = "---";
				displayLyrics("");
				currentSongId = null;
			}

			// Reload danh sách
			await loadSongs();
		} else {
			showToast("Lỗi khi xóa bài hát: " + result.error, "error");
		}
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Xử lý form upload
function setupUploadForm() {
	uploadForm.addEventListener("submit", async function (e) {
		e.preventDefault();

		const formData = new FormData(this);

		// Thêm thông tin auto extract
		const autoExtract = document.getElementById("autoExtract").checked;
		formData.append("autoExtract", autoExtract);

		// Kiểm tra dữ liệu
		const title = formData.get("title");
		const artist = formData.get("artist");
		const audioFile = formData.get("audio");

		if (!audioFile) {
			showToast("Vui lòng chọn file nhạc", "error");
			return;
		}

		// Nếu bật auto extract, không bắt buộc title/artist
		if (!autoExtract && (!title || !artist)) {
			showToast("Vui lòng nhập đầy đủ thông tin hoặc bật tự động trích xuất", "error");
			return;
		}

		try {
			showLoading(true);
			const response = await fetch("/api/upload", {
				method: "POST",
				body: formData,
			});

			const result = await response.json();

			if (response.ok) {
				showToast(result.message, "success");

				// Reset form
				uploadForm.reset();

				// Reload danh sách bài hát
				await loadSongs();

				// Chuyển về tab danh sách
				switchTab("playlist");
			} else {
				showToast("Lỗi upload: " + result.error, "error");
			}
		} catch (error) {
			showToast("Lỗi kết nối: " + error.message, "error");
		} finally {
			showLoading(false);
		}
	});

	// Tính năng tự động trích xuất lời bài hát
	analyzeBtn.addEventListener("click", async () => {
		const audioFile = audioFileInput.files[0];
		if (!audioFile) {
			showToast("Vui lòng chọn file nhạc để phân tích", "error");
			return;
		}

		try {
			showLoading(true);
			const response = await fetch("/api/analyze", {
				method: "POST",
				body: JSON.stringify({ fileName: audioFile.name }),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const result = await response.json();

			if (response.ok) {
				showToast("Đã trích xuất lời bài hát thành công", "success");
				lyricsTextarea.value = result.lyrics;
				lyricsStatus.textContent = "Trích xuất thành công!";
			} else {
				showToast("Lỗi khi trích xuất lời bài hát: " + result.error, "error");
				lyricsStatus.textContent = "Lỗi trích xuất: " + result.error;
			}
		} catch (error) {
			showToast("Lỗi kết nối: " + error.message, "error");
			lyricsStatus.textContent = "Lỗi kết nối: " + error.message;
		} finally {
			showLoading(false);
		}
	});

	// Tìm kiếm lời bài hát trên internet
	findLyricsBtn.addEventListener("click", async () => {
		const title = titleInput.value.trim();
		const artist = artistInput.value.trim();

		if (!title || !artist) {
			showToast("Vui lòng nhập đầy đủ thông tin bài hát và nghệ sĩ", "error");
			return;
		}

		try {
			showLoading(true);
			const response = await fetch("/api/find-lyrics", {
				method: "POST",
				body: JSON.stringify({ title, artist }),
				headers: {
					"Content-Type": "application/json",
				},
			});

			const result = await response.json();

			if (response.ok) {
				showToast("Đã tìm thấy lời bài hát", "success");
				lyricsTextarea.value = result.lyrics;
				lyricsStatus.textContent = "Tìm thấy lời bài hát!";
			} else {
				showToast("Lỗi khi tìm kiếm lời bài hát: " + result.error, "error");
				lyricsStatus.textContent = "Lỗi tìm kiếm: " + result.error;
			}
		} catch (error) {
			showToast("Lỗi kết nối: " + error.message, "error");
			lyricsStatus.textContent = "Lỗi kết nối: " + error.message;
		} finally {
			showLoading(false);
		}
	});

	// Tùy chọn tự động trích xuất lời bài hát
	autoExtractCheckbox.addEventListener("change", function () {
		if (this.checked) {
			showToast("Tính năng tự động trích xuất lời bài hát đã được bật", "success");
		} else {
			showToast("Tính năng tự động trích xuất lời bài hát đã được tắt", "info");
		}
	});
}

// Setup tính năng lời bài hát
function setupLyricsFeatures() {
	// Nút phân tích file
	if (analyzeBtn) {
		analyzeBtn.addEventListener("click", analyzeAudioFile);
	}

	// Nút tìm lời
	if (findLyricsBtn) {
		findLyricsBtn.addEventListener("click", findLyricsForCurrentSong);
	}

	// Auto-fill khi chọn file
	if (audioFileInput) {
		audioFileInput.addEventListener("change", handleFileSelection);
	}

	// Auto extract checkbox
	if (autoExtractCheckbox) {
		autoExtractCheckbox.addEventListener("change", toggleAutoExtract);
	}
}

// Xử lý khi chọn file âm thanh
async function handleFileSelection(event) {
	const file = event.target.files[0];
	if (!file || !autoExtractCheckbox.checked) return;

	showToast("Đang phân tích file...", "loading");

	try {
		const metadata = await analyzeFileMetadata(file);

		if (metadata.success) {
			// Auto-fill thông tin nếu trống
			if (!titleInput.value && metadata.metadata.title) {
				titleInput.value = metadata.metadata.title;
			}

			if (!artistInput.value && metadata.metadata.artist) {
				artistInput.value = metadata.metadata.artist;
			}

			if (!lyricsTextarea.value && metadata.metadata.lyrics) {
				lyricsTextarea.value = metadata.metadata.lyrics;
				showLyricsStatus(`Lời từ ${metadata.metadata.lyricsSource}`, "success");
			}

			showToast("Đã phân tích file thành công!", "success");
		}
	} catch (error) {
		console.error("Lỗi phân tích file:", error);
		showToast("Lỗi phân tích file: " + error.message, "error");
	}
}

// Phân tích file âm thanh
async function analyzeAudioFile() {
	const fileInput = document.getElementById("audio");
	const file = fileInput.files[0];

	if (!file) {
		showToast("Vui lòng chọn file nhạc trước", "error");
		return;
	}

	const formData = new FormData();
	formData.append("audio", file);

	try {
		analyzeBtn.classList.add("analyzing");
		analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang phân tích...';

		const response = await fetch("/api/analyze-audio", {
			method: "POST",
			body: formData,
		});

		const result = await response.json();

		if (response.ok && result.success) {
			const metadata = result.metadata;

			// Hiển thị kết quả phân tích
			displayAnalysisResults(metadata);

			// Auto-fill form
			if (metadata.title) titleInput.value = metadata.title;
			if (metadata.artist) artistInput.value = metadata.artist;
			if (metadata.lyrics) {
				lyricsTextarea.value = metadata.lyrics;
				showLyricsStatus(`Lời từ ${metadata.lyricsSource}`, "success");
			}

			showToast("Phân tích hoàn tất!", "success");
		} else {
			showToast("Lỗi phân tích: " + result.error, "error");
		}
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		analyzeBtn.classList.remove("analyzing");
		analyzeBtn.innerHTML = '<i class="fas fa-search"></i> Phân tích file trước';
	}
}

// Hiển thị kết quả phân tích
function displayAnalysisResults(metadata) {
	// Tạo div hiển thị kết quả
	let resultDiv = document.getElementById("analysis-results");
	if (!resultDiv) {
		resultDiv = document.createElement("div");
		resultDiv.id = "analysis-results";
		resultDiv.className = "extraction-info";
		analyzeBtn.parentNode.insertBefore(resultDiv, analyzeBtn.nextSibling);
	}

	const duration = metadata.duration
		? `${Math.floor(metadata.duration / 60)}:${Math.floor(metadata.duration % 60)
				.toString()
				.padStart(2, "0")}`
		: "Không xác định";

	resultDiv.innerHTML = `
        <h5><i class="fas fa-info-circle"></i> Thông tin file:</h5>
        <ul>
            <li><strong>Tên bài:</strong> ${escapeHtml(metadata.title || "Không có")}</li>
            <li><strong>Nghệ sĩ:</strong> ${escapeHtml(metadata.artist || "Không có")}</li>
            <li><strong>Album:</strong> ${escapeHtml(metadata.album || "Không có")}</li>
            <li><strong>Thời lượng:</strong> ${duration}</li>
            <li><strong>Thể loại:</strong> ${escapeHtml(metadata.genre || "Không có")}</li>
            <li><strong>Năm:</strong> ${metadata.year || "Không có"}</li>
            <li><strong>Lời bài hát:</strong> ${
				metadata.lyrics ? `✅ Có (từ ${metadata.lyricsSource})` : "❌ Không có"
			}</li>
        </ul>
    `;
}

// Tìm lời cho bài hát hiện tại (trong form)
async function findLyricsForCurrentSong() {
	const title = titleInput.value.trim();
	const artist = artistInput.value.trim();

	if (!title || !artist) {
		showToast("Vui lòng nhập tên bài hát và nghệ sĩ trước", "error");
		return;
	}

	try {
		findLyricsBtn.classList.add("finding-lyrics");
		findLyricsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tìm...';
		showLyricsStatus("Đang tìm lời online...", "loading");

		const response = await fetch("/api/search-lyrics", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ artist, title }),
		});

		const result = await response.json();

		if (response.ok) {
			if (result.success && result.lyrics) {
				lyricsTextarea.value = result.lyrics;
				showLyricsStatus("✅ Đã tìm thấy lời!", "success");
				showToast(result.message, "success");
			} else {
				showLyricsStatus("❌ Không tìm thấy lời", "error");
				showToast(result.message, "error");
			}
		} else {
			showToast("Lỗi: " + result.error, "error");
			showLyricsStatus("Lỗi tìm lời", "error");
		}
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
		showLyricsStatus("Lỗi kết nối", "error");
	} finally {
		findLyricsBtn.classList.remove("finding-lyrics");
		findLyricsBtn.innerHTML = '<i class="fas fa-search"></i> Tìm lời online';
	}
}

// Tìm lời cho bài hát đã có trong danh sách
async function findLyricsForSong(songId, titleElement) {
	try {
		showLoading(true);

		const response = await fetch(`/api/songs/${songId}/find-lyrics`, {
			method: "POST",
		});

		const result = await response.json();

		if (response.ok) {
			if (result.success) {
				showToast(result.message, "success");
				// Reload danh sách để cập nhật
				await loadSongs();
			} else {
				showToast(result.message, "error");
			}
		} else {
			showToast("Lỗi: " + result.error, "error");
		}
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Hiển thị trạng thái lời bài hát
function showLyricsStatus(message, type) {
	if (lyricsStatus) {
		lyricsStatus.textContent = message;
		lyricsStatus.className = `lyrics-status ${type}`;

		// Tự động ẩn sau 5 giây
		setTimeout(() => {
			lyricsStatus.textContent = "";
			lyricsStatus.className = "lyrics-status";
		}, 5000);
	}
}

// Toggle auto extract
function toggleAutoExtract() {
	const isEnabled = autoExtractCheckbox.checked;

	if (isEnabled) {
		showToast("Tự động trích xuất: BẬT", "success");
		// Auto analyze nếu đã chọn file
		if (audioFileInput.files[0]) {
			handleFileSelection({ target: audioFileInput });
		}
	} else {
		showToast("Tự động trích xuất: TẮT", "error");
	}
}

// Phân tích metadata file (không upload)
async function analyzeFileMetadata(file) {
	const formData = new FormData();
	formData.append("audio", file);

	const response = await fetch("/api/analyze-audio", {
		method: "POST",
		body: formData,
	});

	return await response.json();
}

// Xử lý audio player
function setupAudioPlayer() {
	audioPlayer.addEventListener("ended", function () {
		// Tự động phát bài tiếp theo
		playNextSong();
	});

	audioPlayer.addEventListener("error", function (e) {
		showToast("Lỗi khi phát nhạc. Vui lòng thử lại.", "error");
		console.error("Audio error:", e);
	});

	audioPlayer.addEventListener("loadstart", function () {
		console.log("Đang tải nhạc...");
	});

	audioPlayer.addEventListener("canplay", function () {
		console.log("Sẵn sàng phát nhạc");
	});

	// Lưu trạng thái khi thay đổi thời gian, âm lượng, play/pause
	audioPlayer.addEventListener("timeupdate", savePlayerState);
	audioPlayer.addEventListener("volumechange", savePlayerState);
	audioPlayer.addEventListener("play", savePlayerState);
	audioPlayer.addEventListener("pause", savePlayerState);
}

// Phát bài tiếp theo
function playNextSong() {
	// Ưu tiên phát từ playlist nếu đang trong chế độ playlist
	if (typeof window.playNextInPlaylist === "function" && window.isPlayingPlaylist === true) {
		window.playNextInPlaylist();
		return;
	}

	// Phát bài tiếp theo trong danh sách "Tất cả bài hát"
	if (!currentSongId || currentSongs.length === 0) {
		showToast("Đã phát hết danh sách", "info");
		return;
	}

	// Tìm index của bài hiện tại
	const currentIndex = currentSongs.findIndex((song) => song.id === currentSongId);

	if (currentIndex === -1) {
		showToast("Không tìm thấy bài hát hiện tại", "error");
		return;
	}

	// Lấy bài tiếp theo (hoặc quay lại bài đầu nếu hết danh sách)
	const nextIndex = (currentIndex + 1) % currentSongs.length;
	const nextSong = currentSongs[nextIndex];

	if (nextSong) {
		showToast(`⏭️ Phát tiếp: ${nextSong.title}`, "info");
		playSong(nextSong.id);
	} else {
		showToast("Đã phát hết danh sách", "info");
	}
}

// Setup upload methods (file vs URL)
function setupUploadMethods() {
	const methodTabs = document.querySelectorAll(".method-tab");
	const uploadMethods = document.querySelectorAll(".upload-method");
	const uploadUrlForm = document.getElementById("upload-url-form");

	// Handle method tab switching
	methodTabs.forEach((tab) => {
		tab.addEventListener("click", function () {
			const method = this.getAttribute("data-method");
			switchUploadMethod(method);
		});
	});

	// Setup URL form
	setupUploadUrlForm();

	function switchUploadMethod(method) {
		// Update tabs
		methodTabs.forEach((tab) => tab.classList.remove("active"));
		document.querySelector(`[data-method="${method}"]`).classList.add("active");

		// Update forms
		uploadMethods.forEach((form) => form.classList.remove("active"));
		document.querySelector(`.upload-method[data-method="${method}"]`).classList.add("active");

		console.log(`Switched to ${method} upload method`);
	}
}

// Setup URL upload form
function setupUploadUrlForm() {
	const uploadUrlForm = document.getElementById("upload-url-form");

	uploadUrlForm.addEventListener("submit", async function (e) {
		e.preventDefault();

		const formData = new FormData(this);
		const url = formData.get("url");
		const title = formData.get("title");
		const artist = formData.get("artist");
		const lyrics = formData.get("lyrics");
		const autoExtract = document.getElementById("autoExtractUrl").checked;

		if (!url) {
			showToast("Vui lòng nhập URL", "error");
			return;
		}

		try {
			showLoading(true);
			showToast("🌐 Đang download từ URL...", "success");

			const response = await fetch("/api/upload-url", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					url: url,
					title: title,
					artist: artist,
					lyrics: lyrics,
					autoExtract: autoExtract,
				}),
			});

			const result = await response.json();

			if (response.ok) {
				showToast(result.message, "success");

				// Reset form
				uploadUrlForm.reset();

				// Show extraction info if available
				if (result.extraction) {
					showExtractionInfo(result.extraction, "url");
				}

				// Reload songs list
				await loadSongs();

				// Switch to playlist tab
				switchTab("playlist");
			} else {
				showToast("Lỗi: " + result.error, "error");
			}
		} catch (error) {
			showToast("Lỗi kết nối: " + error.message, "error");
		} finally {
			showLoading(false);
		}
	});
}

// Show extraction info
function showExtractionInfo(extraction, method) {
	const message = [];

	if (extraction.lyricsFound) {
		message.push(`✅ Tìm thấy lời bài hát từ ${extraction.lyricsSource}`);
	} else {
		message.push(`⚠️ Không tìm thấy lời bài hát`);
	}

	if (extraction.duration) {
		const duration =
			Math.floor(extraction.duration / 60) +
			":" +
			Math.floor(extraction.duration % 60)
				.toString()
				.padStart(2, "0");
		message.push(`⏱️ Thời lượng: ${duration}`);
	}

	if (extraction.fileSize) {
		const size = (extraction.fileSize / (1024 * 1024)).toFixed(2);
		message.push(`📁 Kích thước: ${size}MB`);
	}

	if (extraction.album) {
		message.push(`💿 Album: ${extraction.album}`);
	}

	if (message.length > 0) {
		showToast(message.join(" | "), "success");
	}
}

// Timestamp Editor Functions
async function openTimestampEditor(songId) {
	try {
		const response = await fetch(`/api/songs/${songId}`);
		const song = await response.json();

		if (!response.ok) {
			showToast("Lỗi khi tải bài hát: " + song.error, "error");
			return;
		}

		// Create edit modal if not exists
		let modal = document.getElementById("edit-modal");
		if (!modal) {
			modal = createEditModal();
			document.body.appendChild(modal);
		}

		// Populate modal with song data
		document.getElementById("edit-song-id").value = songId;
		document.getElementById("edit-title").value = song.title;
		document.getElementById("edit-artist").value = song.artist;
		document.getElementById("edit-lyrics").value = song.lyrics || "";

		// Setup audio player
		const editAudioPlayer = document.getElementById("edit-audio-player");
		const editAudioSource = document.getElementById("edit-audio-source");
		editAudioSource.src = `/${song.file_path}`;
		editAudioPlayer.load();

		// Show modal
		modal.style.display = "flex";

		showToast("📝 Mở trình chỉnh sửa timestamp", "success");
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
	}
}

function createEditModal() {
	const modal = document.createElement("div");
	modal.id = "edit-modal";
	modal.className = "edit-modal";
	modal.innerHTML = `
		<div class="edit-modal-content">
			<div class="edit-modal-header">
				<h3>🎵 Chỉnh sửa Timestamp</h3>
				<button class="close-btn" onclick="closeEditModal()">&times;</button>
			</div>
			
			<div class="edit-modal-body">
				<input type="hidden" id="edit-song-id">
				
				<div class="edit-form-group">
					<label>Tên bài hát:</label>
					<input type="text" id="edit-title" readonly>
				</div>
				
				<div class="edit-form-group">
					<label>Ca sĩ:</label>
					<input type="text" id="edit-artist" readonly>
				</div>
				
				<div class="mini-player">
					<audio id="edit-audio-player" controls>
						<source id="edit-audio-source" src="">
					</audio>
					
					<div class="player-controls">
						<button class="btn btn-primary" onclick="insertCurrentTimestamp()">
							<i class="fas fa-clock"></i> Chèn timestamp hiện tại
						</button>
						<button class="btn btn-secondary" onclick="playFromCursor()">
							<i class="fas fa-play"></i> Phát từ cursor
						</button>
						<button class="btn btn-secondary" onclick="jumpBackward()">
							<i class="fas fa-backward"></i> -5s
						</button>
						<button class="btn btn-secondary" onclick="jumpForward()">
							<i class="fas fa-forward"></i> +5s
						</button>
					</div>
				</div>
				
				<div class="edit-form-group">
					<label>Lời bài hát (LRC Format):</label>
					<textarea id="edit-lyrics" rows="15" placeholder="[00:12.34] Lời bài hát...&#10;[00:18.56] Dòng tiếp theo..."></textarea>
				</div>
			</div>
			
			<div class="edit-modal-footer">
				<button class="btn btn-success" onclick="saveLyrics()">
					<i class="fas fa-save"></i> Lưu
				</button>
				<button class="btn btn-secondary" onclick="closeEditModal()">
					<i class="fas fa-times"></i> Hủy
				</button>
			</div>
		</div>
	`;
	return modal;
}

function closeEditModal() {
	const modal = document.getElementById("edit-modal");
	if (modal) {
		modal.style.display = "none";
	}
}

async function saveLyrics() {
	const songId = document.getElementById("edit-song-id").value;
	const lyrics = document.getElementById("edit-lyrics").value;

	try {
		showLoading(true);
		const response = await fetch(`/api/songs/${songId}/lyrics`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ lyrics }),
		});

		const result = await response.json();

		if (response.ok) {
			showToast("✅ Đã lưu lời bài hát", "success");
			closeEditModal();
			loadSongs(); // Refresh song list
		} else {
			showToast("Lỗi khi lưu: " + result.error, "error");
		}
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

function playFromCursor() {
	const audioPlayer = document.getElementById("edit-audio-player");
	const lyricsTextarea = document.getElementById("edit-lyrics");

	if (!audioPlayer || !lyricsTextarea) return;

	const cursorPosition = lyricsTextarea.selectionStart;
	const textBefore = lyricsTextarea.value.substring(0, cursorPosition);

	// Find the last timestamp before cursor
	const timestampRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/g;
	let lastTimestamp = null;
	let match;

	while ((match = timestampRegex.exec(textBefore)) !== null) {
		const minutes = parseInt(match[1]);
		const seconds = parseInt(match[2]);
		const centiseconds = parseInt(match[3]);
		lastTimestamp = minutes * 60 + seconds + centiseconds / 100;
	}

	if (lastTimestamp !== null) {
		if (safeSetCurrentTime(audioPlayer, lastTimestamp)) {
			audioPlayer.play();
			showToast(`⏯️ Phát từ ${formatTimeToLRC(lastTimestamp)}`, "success");
		}
	} else {
		// No timestamp found, play from beginning
		if (safeSetCurrentTime(audioPlayer, 0)) {
			audioPlayer.play();
			showToast("⏯️ Phát từ đầu", "success");
		}
	}
}

function jumpBackward() {
	const audioPlayer = document.getElementById("edit-audio-player");
	if (!audioPlayer) return;

	const newTime = Math.max(0, audioPlayer.currentTime - 5);
	if (safeSetCurrentTime(audioPlayer, newTime)) {
		showToast(`⏪ Lùi 5 giây`, "success");
	}
}

function jumpForward() {
	const audioPlayer = document.getElementById("edit-audio-player");
	if (!audioPlayer) return;

	const newTime = audioPlayer.currentTime + 5;
	if (safeSetCurrentTime(audioPlayer, newTime)) {
		showToast(`⏩ Tiến 5 giây`, "success");
	}
}

// Setup keyboard shortcuts for timestamp editing
function setupAdvancedShortcuts() {
	document.addEventListener("keydown", function (e) {
		const modal = document.getElementById("edit-modal");
		if (!modal || modal.style.display !== "flex") return;

		const lyricsTextarea = document.getElementById("edit-lyrics");
		if (document.activeElement !== lyricsTextarea) return;

		// Ctrl+T: Insert timestamp
		if (e.ctrlKey && e.key === "t") {
			e.preventDefault();
			insertCurrentTimestamp();
		}

		// Ctrl+Space: Play from cursor
		if (e.ctrlKey && e.code === "Space") {
			e.preventDefault();
			playFromCursor();
		}

		// Ctrl+Left: Jump backward
		if (e.ctrlKey && e.key === "ArrowLeft") {
			e.preventDefault();
			jumpBackward();
		}

		// Ctrl+Right: Jump forward
		if (e.ctrlKey && e.key === "ArrowRight") {
			e.preventDefault();
			jumpForward();
		}
	});
}

// Initialize advanced shortcuts when DOM loads
document.addEventListener("DOMContentLoaded", function () {
	setupAdvancedShortcuts();
});

// Debug: Check if functions are available in global scope
console.log("Script end - function check:", {
	formatTime: typeof window.formatTime,
	formatTimeToLRC: typeof window.formatTimeToLRC,
	safeSetCurrentTime: typeof window.safeSetCurrentTime,
});

// ========== HELPER FUNCTIONS ==========

// Show loading overlay
function showLoading(show) {
	const overlay = document.getElementById("loading-overlay");
	if (overlay) {
		overlay.style.display = show ? "flex" : "none";
	}
}

// Show toast notification (DISABLED - No more popups!)
function showToast(message, type = "info") {
	// BỎ HẾT THÔNG BÁO - Chỉ log ra console
	console.log(`[${type.toUpperCase()}]`, message);
	return; // Không hiển thị gì cả
}

// Format date helper
function formatDate(dateString) {
	if (!dateString) return "";
	const date = new Date(dateString);
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();
	return `${day}/${month}/${year}`;
}

// Escape HTML helper
function escapeHtml(text) {
	if (!text) return "";
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

// Make it globally available
window.escapeHtml = escapeHtml;

// ========== LYRICS MODE TOGGLE ==========

// Setup lyrics mode toggle buttons
function setupLyricsModeToggle() {
	if (!modeNormalBtn || !modeSyncedBtn) return;

	modeNormalBtn.addEventListener("click", function () {
		if (currentLyricsMode === "normal") return;

		currentLyricsMode = "normal";
		modeNormalBtn.classList.add("active");
		modeSyncedBtn.classList.remove("active");

		// Load current song's normal lyrics
		if (currentSongId) {
			loadCurrentSongLyrics("normal");
		}

		savePlayerState();
	});

	modeSyncedBtn.addEventListener("click", function () {
		if (currentLyricsMode === "synced") return;

		currentLyricsMode = "synced";
		modeSyncedBtn.classList.add("active");
		modeNormalBtn.classList.remove("active");

		// Load current song's synced lyrics
		if (currentSongId) {
			loadCurrentSongLyrics("synced");
		}

		savePlayerState();
	});
}

// Load lyrics for current song
async function loadCurrentSongLyrics(mode) {
	if (!currentSongId) return;

	try {
		const response = await fetch(`/api/songs/${currentSongId}`);
		const song = await response.json();

		if (response.ok) {
			if (mode === "synced") {
				if (song.synced_lyrics) {
					displaySyncedLyrics(song.synced_lyrics);
					showToast("Chế độ Karaoke", "success");
				} else {
					showToast("Bài hát chưa có synced lyrics", "error");
					displayNormalLyrics(song.lyrics);
				}
			} else {
				displayNormalLyrics(song.lyrics);
				showToast("Chế độ lời thường", "success");
			}
		}
	} catch (error) {
		console.error("Lỗi load lyrics:", error);
	}
}

// Display normal lyrics
function displayNormalLyrics(lyrics) {
	if (!lyricsDisplay) return;

	// Stop synced lyrics player if active
	if (syncedLyricsPlayer) {
		syncedLyricsPlayer.stop();
	}

	if (!lyrics || lyrics.trim().length === 0) {
		lyricsDisplay.innerHTML = '<p class="no-lyrics">Chưa có lời bài hát</p>';
		return;
	}

	// Format normal lyrics with line breaks
	const formattedLyrics = lyrics
		.split("\n")
		.map((line) => `<p>${escapeHtml(line)}</p>`)
		.join("");

	lyricsDisplay.innerHTML = formattedLyrics || '<p class="no-lyrics">Chưa có lời bài hát</p>';
}

// Display synced lyrics (karaoke mode)
function displaySyncedLyrics(syncedLyrics) {
	if (!lyricsDisplay || !syncedLyricsPlayer) return;

	if (!syncedLyrics || syncedLyrics.trim().length === 0) {
		lyricsDisplay.innerHTML =
			'<p class="no-lyrics">Chưa có synced lyrics. Thêm synced lyrics để sử dụng chế độ Karaoke!</p>';
		return;
	}

	try {
		syncedLyricsPlayer.loadLyrics(syncedLyrics);
		syncedLyricsPlayer.start();
	} catch (error) {
		console.error("Lỗi hiển thị synced lyrics:", error);
		lyricsDisplay.innerHTML = '<p class="no-lyrics">Lỗi hiển thị synced lyrics</p>';
	}
}

// Open Synced Lyrics Editor (Karaoke Editor)
async function openSyncedLyricsEditor(songId) {
	try {
		showLoading(true);
		const response = await fetch(`/api/songs/${songId}`);
		const song = await response.json();

		if (!response.ok) {
			showToast("Lỗi khi tải thông tin bài hát: " + song.error, "error");
			return;
		}

		// Tạo modal editor
		const modal = document.createElement("div");
		modal.className = "modal-overlay active";
		modal.innerHTML = `
			<div class="modal-content modal-large">
				<div class="modal-header">
					<h2><i class="fas fa-music"></i> ${song.synced_lyrics ? "Sửa" : "Thêm"} Karaoke: ${escapeHtml(song.title)}</h2>
					<button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
						<i class="fas fa-times"></i>
					</button>
				</div>
				<div class="modal-body">
					<div class="synced-editor-container">
						<div class="synced-editor-left">
							<h3>Lời bài hát thường</h3>
							<textarea id="normal-lyrics-input" class="lyrics-textarea" placeholder="Nhập hoặc paste lời bài hát...">${escapeHtml(
								song.lyrics || "",
							)}</textarea>
							
							<h3 style="margin-top: 20px;">Preview Karaoke</h3>
							<div class="karaoke-preview" id="karaoke-preview">
								<p class="no-lyrics">Nhập synced lyrics bên phải để xem preview</p>
							</div>
						</div>
						
						<div class="synced-editor-right">
							<h3>Synced Lyrics (LRC Format)</h3>
							<div class="editor-hint">
								<i class="fas fa-info-circle"></i>
								Format: [mm:ss.xx]Lời bài hát<br>
								Ví dụ: [00:12.50]Anh yêu em từ cái nhìn đầu tiên
							</div>
							
							<textarea id="synced-lyrics-input" class="lyrics-textarea synced-textarea" placeholder="[00:12.50]Lời bài hát dòng 1&#10;[00:15.20]Lời bài hát dòng 2&#10;...">${escapeHtml(
								song.synced_lyrics || "",
							)}</textarea>
							
							<div class="editor-tools">
								<button class="btn btn-secondary" onclick="autoGenerateTimestamps()">
									<i class="fas fa-magic"></i> Tự động tạo timestamp
								</button>
								<button class="btn btn-secondary" onclick="validateLRCFormat()">
									<i class="fas fa-check-circle"></i> Kiểm tra format
								</button>
							</div>
						</div>
					</div>
					
					<div class="audio-control-section">
						<audio id="editor-audio" controls style="width: 100%; margin-top: 20px;">
							<source src="/${song.file_path}" type="audio/mpeg">
						</audio>
						<p style="text-align: center; margin-top: 10px; color: #888;">
							<i class="fas fa-lightbulb"></i> Tip: Nghe nhạc, pause tại mỗi câu, ghi lại thời gian [mm:ss.xx]
						</p>
					</div>
				</div>
				<div class="modal-footer">
					<button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
						<i class="fas fa-times"></i> Hủy
					</button>
					<button class="btn btn-primary" onclick="saveSyncedLyrics(${songId})">
						<i class="fas fa-save"></i> Lưu Karaoke
					</button>
				</div>
			</div>
		`;

		document.body.appendChild(modal);

		// Setup real-time preview
		const syncedInput = document.getElementById("synced-lyrics-input");
		const preview = document.getElementById("karaoke-preview");

		syncedInput.addEventListener("input", function () {
			if (this.value.trim()) {
				const lines = this.value
					.split("\n")
					.map((line) => {
						const match = line.match(/\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
						if (match) {
							return `<div class="preview-line"><span class="timestamp">[${match[1]}:${
								match[2]
							}]</span> ${escapeHtml(match[3])}</div>`;
						}
						return `<div class="preview-line error">${escapeHtml(line)}</div>`;
					})
					.join("");
				preview.innerHTML = lines;
			} else {
				preview.innerHTML = '<p class="no-lyrics">Nhập synced lyrics để xem preview</p>';
			}
		});

		// Trigger initial preview
		if (song.synced_lyrics) {
			syncedInput.dispatchEvent(new Event("input"));
		}
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Auto generate timestamps from normal lyrics
window.autoGenerateTimestamps = function () {
	const normalLyrics = document.getElementById("normal-lyrics-input").value;
	const syncedInput = document.getElementById("synced-lyrics-input");

	if (!normalLyrics.trim()) {
		showToast("Vui lòng nhập lời bài hát thường trước", "error");
		return;
	}

	const lines = normalLyrics.split("\n").filter((line) => line.trim());
	let currentTime = 0;
	const avgLineTime = 3; // 3 seconds per line average

	const syncedLines = lines.map((line, index) => {
		const minutes = Math.floor(currentTime / 60);
		const seconds = (currentTime % 60).toFixed(2);
		const timestamp = `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(5, "0")}]`;
		currentTime += avgLineTime;
		return timestamp + line;
	});

	syncedInput.value = syncedLines.join("\n");
	syncedInput.dispatchEvent(new Event("input"));
	showToast("Đã tạo timestamps tự động. Hãy điều chỉnh theo nhạc!", "info");
};

// Validate LRC format
window.validateLRCFormat = function () {
	const syncedInput = document.getElementById("synced-lyrics-input");
	const lines = syncedInput.value.split("\n");
	let errors = [];

	lines.forEach((line, index) => {
		if (!line.trim()) return;

		const match = line.match(/\[(\d{2}):(\d{2}\.\d{2})\](.*)/);
		if (!match) {
			errors.push(`Dòng ${index + 1}: Sai format - "${line}"`);
		}
	});

	if (errors.length === 0) {
		showToast("✅ Format hợp lệ! Tất cả timestamps đúng chuẩn LRC", "success");
	} else {
		showToast(`❌ Có ${errors.length} lỗi format:\n${errors.slice(0, 3).join("\n")}`, "error");
	}
};

// Save synced lyrics
window.saveSyncedLyrics = async function (songId) {
	const syncedInput = document.getElementById("synced-lyrics-input");
	const normalInput = document.getElementById("normal-lyrics-input");

	const syncedLyrics = syncedInput.value.trim();
	const normalLyrics = normalInput.value.trim();

	if (!syncedLyrics) {
		showToast("Vui lòng nhập synced lyrics", "error");
		return;
	}

	try {
		showLoading(true);

		const response = await fetch(`/api/songs/${songId}`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				synced_lyrics: syncedLyrics,
				lyrics: normalLyrics || null,
			}),
		});

		const result = await response.json();

		if (response.ok) {
			showToast("🎤 Đã lưu Karaoke thành công!", "success");
			document.querySelector(".modal-overlay").remove();
			await loadSongs(); // Reload to show karaoke indicator
		} else {
			showToast("Lỗi khi lưu: " + result.error, "error");
		}
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
};
