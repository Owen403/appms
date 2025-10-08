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
	if (tabName === "playlist") {
		loadSongs();
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
			showToast("Lỗi khi tải danh sách bài hát: " + songs.error, "error");
		}
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
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
	if (!confirm("Bạn có chắc chắn muốn xóa bài hát này?")) {
		return;
	}

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

// Utility functions
function showLoading(show) {
	loadingOverlay.style.display = show ? "flex" : "none";
}

function showToast(message, type = "success") {
	toast.textContent = message;
	toast.className = `toast ${type}`;
	toast.classList.add("show");

	setTimeout(() => {
		toast.classList.remove("show");
	}, 3000);
}

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function formatDate(dateString) {
	const date = new Date(dateString);
	return date.toLocaleDateString("vi-VN", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// Utility function for formatting time
function formatTime(seconds) {
	if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "00:00";

	const minutes = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);

	return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// Safe time setter with validation
function safeSetCurrentTime(audioElement, timeInSeconds) {
	if (!audioElement || !isFinite(timeInSeconds) || timeInSeconds < 0) {
		console.warn("Invalid time value:", timeInSeconds);
		return false;
	}

	try {
		// Ensure time is within valid range
		const maxTime = audioElement.duration || 0;
		const safeTime = Math.max(0, Math.min(timeInSeconds, maxTime));
		audioElement.currentTime = safeTime;
		return true;
	} catch (error) {
		console.error("Error setting currentTime:", error);
		return false;
	}
}

// Fixed playFromCursor function (if it exists somewhere in the code)
function playFromCursor() {
	const audioPlayer = document.getElementById("edit-audio-player") || document.getElementById("audio-player");
	const lyricsTextarea = document.getElementById("edit-lyrics") || document.getElementById("lyrics");

	if (!audioPlayer || !lyricsTextarea) {
		console.warn("Audio player or textarea not found");
		return;
	}

	// Get text at cursor position
	const cursorPosition = lyricsTextarea.selectionStart || 0;
	const textBefore = lyricsTextarea.value.substring(0, cursorPosition);

	// Find the last timestamp before cursor
	const timestampRegex = /\[(\d{2}):(\d{2})\.(\d{2})\]/g;
	let lastMatch = null;
	let match;

	while ((match = timestampRegex.exec(textBefore)) !== null) {
		lastMatch = match;
	}

	if (lastMatch) {
		const minutes = parseInt(lastMatch[1]) || 0;
		const seconds = parseInt(lastMatch[2]) || 0;
		const centiseconds = parseInt(lastMatch[3]) || 0;
		const timeInSeconds = minutes * 60 + seconds + centiseconds / 100;

		// Use safe time setter
		if (safeSetCurrentTime(audioPlayer, timeInSeconds)) {
			audioPlayer.play();
			showToast(`▶️ Phát từ ${lastMatch[0]}`, "success");
		} else {
			showToast("❌ Không thể đặt thời gian phát", "error");
		}
	} else {
		// No timestamp found, play from beginning
		if (safeSetCurrentTime(audioPlayer, 0)) {
			audioPlayer.play();
			showToast("▶️ Phát từ đầu bài", "info");
		}
	}
}

// Enhanced audio player event handlers with error handling
function setupSafeAudioHandlers(audioElement) {
	if (!audioElement) return;

	audioElement.addEventListener("timeupdate", function () {
		const currentTimeDisplay = document.getElementById("current-time-display");
		const totalTimeDisplay = document.getElementById("total-time-display");

		if (currentTimeDisplay && totalTimeDisplay) {
			const current = this.currentTime || 0;
			const duration = this.duration || 0;

			currentTimeDisplay.textContent = formatTime(current);
			totalTimeDisplay.textContent = formatTime(duration);
		}
	});

	audioElement.addEventListener("loadedmetadata", function () {
		const totalTimeDisplay = document.getElementById("total-time-display");
		if (totalTimeDisplay) {
			totalTimeDisplay.textContent = formatTime(this.duration || 0);
		}
	});

	audioElement.addEventListener("error", function (e) {
		console.error("Audio error:", e);
		showToast("❌ Lỗi phát nhạc", "error");
	});
}

// Auto-setup for any audio players
document.addEventListener("DOMContentLoaded", function () {
	// Setup for main audio player
	const mainPlayer = document.getElementById("audio-player");
	if (mainPlayer) {
		setupSafeAudioHandlers(mainPlayer);
	}

	// Setup for edit modal audio player (when it appears)
	const observer = new MutationObserver(function (mutations) {
		mutations.forEach(function (mutation) {
			mutation.addedNodes.forEach(function (node) {
				if (node.nodeType === 1) {
					// Element node
					const editPlayer = node.querySelector("#edit-audio-player");
					if (editPlayer) {
						setupSafeAudioHandlers(editPlayer);
					}
				}
			});
		});
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});

	// Keyboard shortcuts for timestamp editor
	document.addEventListener("keydown", function (e) {
		const modal = document.getElementById("synced-lyrics-modal");
		const textarea = document.getElementById("synced-lyrics-input");

		// Only work when modal is open and textarea is focused
		if (!modal || !modal.classList.contains("active")) return;

		// Ctrl+T: Insert timestamp
		if (e.ctrlKey && e.key === "t") {
			e.preventDefault();
			insertTimestamp();
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

		// Ctrl+Space: Play/Pause
		if (e.ctrlKey && e.key === " ") {
			e.preventDefault();
			const editAudio = document.getElementById("edit-audio-player");
			if (editAudio.paused) {
				editAudio.play();
			} else {
				editAudio.pause();
			}
		}
	});
});

// Service Worker registration (nếu có)
if ("serviceWorker" in navigator) {
	window.addEventListener("load", function () {
		// Có thể đăng ký service worker để cache offline
		console.log("Service Worker ready for implementation");
	});
}

// LRC Format helper functions
function formatTimeToLRC(timeInSeconds) {
	if (!isFinite(timeInSeconds) || timeInSeconds < 0) {
		timeInSeconds = 0;
	}

	const minutes = Math.floor(timeInSeconds / 60);
	const seconds = Math.floor(timeInSeconds % 60);
	const centiseconds = Math.floor((timeInSeconds % 1) * 100);

	return `[${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centiseconds
		.toString()
		.padStart(2, "0")}]`;
}

function insertCurrentTimestamp() {
	const audioPlayer = document.getElementById("edit-audio-player") || document.getElementById("audio-player");
	const lyricsTextarea = document.getElementById("edit-lyrics") || document.getElementById("lyrics");

	if (!audioPlayer || !lyricsTextarea) {
		showToast("❌ Không tìm thấy player hoặc textarea", "error");
		return;
	}

	const currentTime = audioPlayer.currentTime || 0;
	if (!isFinite(currentTime)) {
		showToast("❌ Thời gian không hợp lệ", "error");
		return;
	}

	const timestamp = formatTimeToLRC(currentTime);

	// Get cursor position
	const cursorPosition = lyricsTextarea.selectionStart || 0;
	const textBefore = lyricsTextarea.value.substring(0, cursorPosition);
	const textAfter = lyricsTextarea.value.substring(lyricsTextarea.selectionEnd || cursorPosition);

	// Smart insertion with newlines
	let insertText = timestamp;

	// If cursor is not at beginning of line and there's text before
	if (cursorPosition > 0 && !textBefore.endsWith("\n")) {
		insertText = "\n" + timestamp;
	}

	// Always add newline after timestamp for next lyrics line
	insertText += "\n";

	// Insert timestamp with newlines
	lyricsTextarea.value = textBefore + insertText + textAfter;

	// Move cursor to after timestamp and newline (ready for lyrics)
	const newCursorPosition = cursorPosition + insertText.length;
	lyricsTextarea.setSelectionRange(newCursorPosition, newCursorPosition);
	lyricsTextarea.focus();

	showToast(`⏰ Timestamp: ${timestamp} → Sẵn sàng nhập lời`, "success");
}

function insertTimestampOnly() {
	const audioPlayer = document.getElementById("edit-audio-player") || document.getElementById("audio-player");
	const lyricsTextarea = document.getElementById("edit-lyrics") || document.getElementById("lyrics");

	if (!audioPlayer || !lyricsTextarea) {
		showToast("❌ Không tìm thấy player hoặc textarea", "error");
		return;
	}

	const currentTime = audioPlayer.currentTime || 0;
	if (!isFinite(currentTime)) {
		showToast("❌ Thời gian không hợp lệ", "error");
		return;
	}

	const timestamp = formatTimeToLRC(currentTime);

	// Get cursor position
	const cursorPosition = lyricsTextarea.selectionStart || 0;
	const textBefore = lyricsTextarea.value.substring(0, cursorPosition);
	const textAfter = lyricsTextarea.value.substring(lyricsTextarea.selectionEnd || cursorPosition);

	// Insert only timestamp at cursor
	lyricsTextarea.value = textBefore + timestamp + textAfter;

	// Move cursor to after timestamp
	const newCursorPosition = cursorPosition + timestamp.length;
	lyricsTextarea.setSelectionRange(newCursorPosition, newCursorPosition);
	lyricsTextarea.focus();

	showToast(`⏰ Chỉ timestamp: ${timestamp}`, "info");
}

function jumpBackward() {
	const audioPlayer = document.getElementById("edit-audio-player") || document.getElementById("audio-player");
	if (!audioPlayer) {
		showToast("❌ Không tìm thấy audio player", "error");
		return;
	}

	const newTime = Math.max(0, (audioPlayer.currentTime || 0) - 3);
	if (safeSetCurrentTime(audioPlayer, newTime)) {
		showToast("⏪ Lùi 3 giây", "info");
	}
}

function jumpForward() {
	const audioPlayer = document.getElementById("edit-audio-player") || document.getElementById("audio-player");
	if (!audioPlayer) {
		showToast("❌ Không tìm thấy audio player", "error");
		return;
	}

	const maxTime = audioPlayer.duration || audioPlayer.currentTime + 3;
	const newTime = Math.min(maxTime, (audioPlayer.currentTime || 0) + 3);
	if (safeSetCurrentTime(audioPlayer, newTime)) {
		showToast("⏩ Tiến 3 giây", "info");
	}
}

// Safe showToast function (if not already defined)
if (typeof showToast === "undefined") {
	function showToast(message, type = "success") {
		console.log(`[${type.toUpperCase()}] ${message}`);

		// Try to find toast element
		let toast = document.getElementById("toast");
		if (toast) {
			toast.textContent = message;
			toast.className = `toast ${type} show`;

			setTimeout(() => {
				toast.classList.remove("show");
			}, 3000);
		}
	}
}

// Debug: Check if functions are available in global scope
console.log("Script end - function check:", {
	formatTime: typeof window.formatTime,
	formatTimeToLRC: typeof window.formatTimeToLRC,
	safeSetCurrentTime: typeof window.safeSetCurrentTime,
});

// Setup Lyrics Mode Toggle
function setupLyricsModeToggle() {
	if (!modeNormalBtn || !modeSyncedBtn) {
		console.warn("Lyrics mode buttons not found");
		return;
	}

	modeNormalBtn.addEventListener("click", () => {
		switchLyricsMode("normal");
	});

	modeSyncedBtn.addEventListener("click", () => {
		switchLyricsMode("synced");
	});
}

// Switch between normal and synced lyrics mode
function switchLyricsMode(mode) {
	currentLyricsMode = mode;

	// Update button states
	modeNormalBtn.classList.toggle("active", mode === "normal");
	modeSyncedBtn.classList.toggle("active", mode === "synced");

	// Re-display current song lyrics
	if (currentSongId) {
		loadAndDisplayCurrentSong();
	}
}

// Load and display current song (helper function)
async function loadAndDisplayCurrentSong() {
	try {
		const response = await fetch(`/api/songs/${currentSongId}`);
		const song = await response.json();

		if (response.ok) {
			if (currentLyricsMode === "synced" && song.synced_lyrics) {
				displaySyncedLyrics(song.synced_lyrics);
			} else {
				displayNormalLyrics(song.lyrics);
			}
		}
	} catch (error) {
		console.error("Error loading song:", error);
	}
}

// Display normal lyrics
function displayNormalLyrics(lyrics) {
	if (syncedLyricsPlayer) {
		syncedLyricsPlayer.clear();
	}

	if (!lyrics || lyrics.trim() === "") {
		lyricsDisplay.innerHTML = '<p class="no-lyrics">Bài hát này chưa có lời.</p>';
	} else {
		lyricsDisplay.innerHTML = `<div class="lyrics-text">${escapeHtml(lyrics).replace(/\n/g, "<br>")}</div>`;
	}
}

// Display synced lyrics (karaoke mode)
function displaySyncedLyrics(syncedLyrics) {
	if (!syncedLyricsPlayer) {
		showToast("Synced lyrics player not available", "error");
		displayNormalLyrics("");
		return;
	}

	if (!syncedLyrics || syncedLyrics.trim() === "") {
		lyricsDisplay.innerHTML =
			'<p class="no-lyrics">Bài hát này chưa có lời đồng bộ.<br>Bạn có thể thêm bằng cách chỉnh sửa bài hát.</p>';
		return;
	}

	syncedLyricsPlayer.load(syncedLyrics);
}

// ========== SYNCED LYRICS EDITOR ==========

let currentEditingSongId = null;

// Open synced lyrics editor
async function openSyncedLyricsEditor(songId) {
	try {
		showLoading(true);
		const response = await fetch(`/api/songs/${songId}`);
		const song = await response.json();

		if (!response.ok) {
			showToast("Lỗi khi tải thông tin bài hát: " + song.error, "error");
			return;
		}

		currentEditingSongId = songId;

		// Update modal content
		document.getElementById("synced-song-title").textContent = song.title;
		document.getElementById("synced-song-artist").textContent = song.artist;
		document.getElementById("synced-lyrics-input").value = song.synced_lyrics || "";

		// Setup mini audio player for timestamp
		const editAudio = document.getElementById("edit-audio-player");

		// Fix path - normalize backslashes and handle 'uploads/' prefix
		let audioPath = song.file_path.replace(/\\/g, "/"); // Replace backslash with forward slash

		// Remove leading 'uploads/' if exists, then add it back consistently
		if (audioPath.startsWith("uploads/")) {
			audioPath = "/" + audioPath;
		} else {
			audioPath = "/uploads/" + audioPath;
		}

		// Encode URI to handle special characters in filename
		const pathParts = audioPath.split("/");
		audioPath = pathParts
			.map((part, index) => {
				// Don't encode the first parts (/, uploads)
				if (index <= 1) return part;
				// Encode the filename
				return encodeURIComponent(part);
			})
			.join("/");

		console.log("Loading audio from:", audioPath); // Debug log
		console.log("Song data:", song); // Debug full song data

		// Update time display when audio plays
		editAudio.removeEventListener("timeupdate", updateTimestampDisplay); // Remove old listener
		editAudio.addEventListener("timeupdate", updateTimestampDisplay);

		// Show modal first
		const modal = document.getElementById("synced-lyrics-modal");
		modal.classList.add("active");

		// Hide preview
		document.getElementById("synced-preview").style.display = "none";

		// Add error handler BEFORE loading
		editAudio.addEventListener(
			"error",
			function (e) {
				// Only show error if audio hasn't loaded successfully yet
				if (!editAudio.duration || editAudio.duration === 0) {
					console.error("❌ Audio load error:", e, editAudio.error);
					showToast("❌ Lỗi tải file nhạc. Kiểm tra Console (F12)", "error");
				} else {
					console.log("⚠️ Audio error after load (ignore):", e);
				}
			},
			{ once: true },
		);

		// Wait for audio to load before playing
		editAudio.addEventListener(
			"loadedmetadata",
			function () {
				console.log("✅ Audio loaded successfully, duration:", editAudio.duration);
				// Try to play after metadata is loaded
				setTimeout(() => {
					const playPromise = editAudio.play();
					if (playPromise !== undefined) {
						playPromise
							.then(() => {
								showToast("🎵 Đang phát nhạc - Sẵn sàng tích timestamp!", "success");
							})
							.catch((err) => {
								console.log("Auto-play prevented:", err);
								showToast("⚠️ Nhấn Play ▶️ để bắt đầu phát nhạc", "info");
							});
					}
				}, 200);
			},
			{ once: true },
		);

		// Set source and load
		editAudio.src = audioPath;
		editAudio.load();
	} catch (error) {
		showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Update timestamp display
function updateTimestampDisplay() {
	const editAudio = document.getElementById("edit-audio-player");
	const currentTime = editAudio.currentTime;
	const formatted = formatTimeToLRC(currentTime);
	document.getElementById("current-timestamp").textContent = formatted;
}

// Format time to LRC format [mm:ss.xx]
function formatTimeToLRC(timeInSeconds) {
	const minutes = Math.floor(timeInSeconds / 60);
	const seconds = Math.floor(timeInSeconds % 60);
	const centiseconds = Math.floor((timeInSeconds % 1) * 100);

	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(
		2,
		"0",
	)}`;
}

// Insert timestamp at cursor position
function insertTimestamp() {
	const editAudio = document.getElementById("edit-audio-player");
	const textarea = document.getElementById("synced-lyrics-input");
	const currentTime = editAudio.currentTime;
	const timestamp = `[${formatTimeToLRC(currentTime)}] `;

	// Get cursor position
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const text = textarea.value;

	// Insert timestamp
	textarea.value = text.substring(0, start) + timestamp + text.substring(end);

	// Move cursor after timestamp
	const newPos = start + timestamp.length;
	textarea.selectionStart = newPos;
	textarea.selectionEnd = newPos;
	textarea.focus();

	showToast(`Đã tích timestamp: ${timestamp}`, "success");
}

// Jump backward 3 seconds
function jumpBackward() {
	const editAudio = document.getElementById("edit-audio-player");
	editAudio.currentTime = Math.max(0, editAudio.currentTime - 3);
}

// Jump forward 3 seconds
function jumpForward() {
	const editAudio = document.getElementById("edit-audio-player");
	editAudio.currentTime = Math.min(editAudio.duration, editAudio.currentTime + 3);
}

// Close synced lyrics editor
function closeSyncedLyricsEditor() {
	const modal = document.getElementById("synced-lyrics-modal");
	modal.classList.remove("active");
	currentEditingSongId = null;
	document.getElementById("synced-lyrics-input").value = "";
	document.getElementById("synced-preview").style.display = "none";

	// Stop and clear audio player
	const editAudio = document.getElementById("edit-audio-player");
	editAudio.pause();
	editAudio.src = "";
}

// Save synced lyrics
async function saveSyncedLyrics() {
	if (!currentEditingSongId) {
		showToast("Không có bài hát nào đang được chỉnh sửa", "error");
		return;
	}

	const syncedLyrics = document.getElementById("synced-lyrics-input").value.trim();

	// Validate format nếu có nội dung
	if (syncedLyrics && !validateLRCFormat(syncedLyrics)) {
		showToast("Format không hợp lệ! Phải có dạng [mm:ss.xx] text. Ví dụ: [00:11.48] Lời bài hát", "error");
		return;
	}

	try {
		showLoading(true);

		const response = await fetch(`/api/songs/${currentEditingSongId}/update-synced-lyrics`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ synced_lyrics: syncedLyrics }),
		});

		const result = await response.json();

		if (response.ok) {
			showToast(result.message || "Đã lưu synced lyrics thành công!", "success");
			closeSyncedLyricsEditor();
			loadSongs(); // Reload danh sách để cập nhật badge

			// Nếu đang phát bài này, reload lyrics
			if (currentSongId === currentEditingSongId) {
				loadAndDisplayCurrentSong();
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

// Validate LRC format
function validateLRCFormat(text) {
	// Check if contains at least one valid timestamp
	const lrcPattern = /\[\d{2}:\d{2}\.\d{2}\]/;
	return lrcPattern.test(text);
}

// Preview synced lyrics
function previewSyncedLyrics() {
	const syncedLyrics = document.getElementById("synced-lyrics-input").value.trim();
	const previewDiv = document.getElementById("synced-preview");
	const previewContent = document.getElementById("synced-preview-content");

	if (!syncedLyrics) {
		showToast("Chưa có nội dung để xem trước", "warning");
		return;
	}

	if (!validateLRCFormat(syncedLyrics)) {
		showToast("Format không hợp lệ! Không thể xem trước.", "error");
		return;
	}

	// Parse and display
	const lines = syncedLyrics.split("\n");
	let html = "";

	lines.forEach((line) => {
		const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.+)/);
		if (match) {
			const minutes = match[1];
			const seconds = match[2];
			const centiseconds = match[3];
			const text = escapeHtml(match[4]);

			html += `
				<div style="padding: 8px; margin: 4px 0; background: rgba(255,255,255,0.1); border-radius: 5px;">
					<strong style="color: #4CAF50;">[${minutes}:${seconds}.${centiseconds}]</strong>
					<span style="margin-left: 10px;">${text}</span>
				</div>
			`;
		}
	});

	if (html) {
		previewContent.innerHTML = html;
		previewDiv.style.display = "block";
		showToast("Xem trước synced lyrics", "success");
	} else {
		showToast("Không tìm thấy dòng nào hợp lệ", "warning");
	}
}

// Clear synced lyrics
function clearSyncedLyrics() {
	if (confirm("Bạn có chắc muốn xóa tất cả synced lyrics?")) {
		document.getElementById("synced-lyrics-input").value = "";
		document.getElementById("synced-preview").style.display = "none";
		showToast("Đã xóa nội dung", "info");
	}
}

// Close modal when clicking outside
window.addEventListener("click", function (event) {
	const modal = document.getElementById("synced-lyrics-modal");
	if (event.target === modal) {
		closeSyncedLyricsEditor();
	}
});

// Debug: Check if functions are available in global scope
console.log("Script end - function check:", {
	formatTime: typeof window.formatTime,
	formatTimeToLRC: typeof window.formatTimeToLRC,
	safeSetCurrentTime: typeof window.safeSetCurrentTime,
});
