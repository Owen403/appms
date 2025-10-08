// Livestream Overlay Music Player - Auto-play when clicking playlist

// DOM Elements
const audioPlayer = document.getElementById("audio-player");
const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const progressBarCompact = document.getElementById("progress-bar-compact");
const progressFilledCompact = document.getElementById("progress-filled-compact");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");
const songTitleCompact = document.getElementById("song-title-compact");
const songArtistCompact = document.getElementById("song-artist-compact");
const togglePlaylistBtn = document.getElementById("toggle-playlist-btn");
const playlistDropdown = document.getElementById("playlist-dropdown");
const playlistDropdownContent = document.getElementById("playlist-dropdown-content");

// Window controls
const minimizeBtn = document.getElementById("minimize-btn");
const closeBtn = document.getElementById("close-btn");
const pinBtn = document.getElementById("pin-btn");

// State
let currentPlaylists = [];
let currentQueue = [];
let currentSongIndex = 0;
let isPlaying = false;
let isPinned = true; // Default to pinned for livestream
let currentPlaylistId = null;
let autoRefreshInterval = null;

// API Base URL
const API_BASE = "http://localhost:3000";
const REFRESH_INTERVAL = 5000; // 5 seconds

// Initialize
async function init() {
	setupEventListeners();
	await loadPlaylists();
	startAutoRefresh();
	// Set pin to active by default
	pinBtn.classList.add("active");
}

// Event Listeners
function setupEventListeners() {
	// Window controls
	minimizeBtn?.addEventListener("click", () => window.electron.minimize());
	closeBtn?.addEventListener("click", () => window.electron.close());
	pinBtn?.addEventListener("click", togglePin);

	// Playback controls
	playBtn.addEventListener("click", togglePlay);
	prevBtn.addEventListener("click", playPrevious);
	nextBtn.addEventListener("click", playNext);

	// Audio events
	audioPlayer.addEventListener("timeupdate", updateProgress);
	audioPlayer.addEventListener("loadedmetadata", updateDuration);
	audioPlayer.addEventListener("ended", playNext);

	// Progress bar
	progressBarCompact.addEventListener("click", seekTo);

	// Toggle playlist dropdown
	togglePlaylistBtn.addEventListener("click", (e) => {
		e.stopPropagation();
		togglePlaylistDropdown(e);
	});

	// Close dropdown when clicking outside
	document.addEventListener("click", (e) => {
		if (!togglePlaylistBtn.contains(e.target) && !playlistDropdown.contains(e.target)) {
			playlistDropdown.classList.remove("show");
			togglePlaylistBtn.classList.remove("active");
		}
	});
}

// Window Controls
async function togglePin() {
	isPinned = !isPinned;
	await window.electron.setAlwaysOnTop(isPinned);
	pinBtn.classList.toggle("active", isPinned);
}

// Toggle Playlist Dropdown
function togglePlaylistDropdown(e) {
	e?.stopPropagation();
	const isShowing = playlistDropdown.classList.contains("show");
	console.log("Toggle playlist dropdown:", !isShowing);
	playlistDropdown.classList.toggle("show");
	togglePlaylistBtn.classList.toggle("active");
}

// Load Playlists
async function loadPlaylists() {
	try {
		console.log("Loading playlists from:", `${API_BASE}/api/playlists`);
		playlistDropdownContent.innerHTML = `
			<div class="loading-compact">
				<i class="fas fa-spinner fa-spin"></i>
				<div>Đang tải playlists...</div>
			</div>
		`;

		const response = await fetch(`${API_BASE}/api/playlists`);
		if (!response.ok) throw new Error("Failed to load playlists");

		const playlists = await response.json();
		console.log("Loaded playlists:", playlists.length, playlists);
		currentPlaylists = playlists;
		renderPlaylists();
	} catch (error) {
		console.error("Error loading playlists:", error);
		playlistDropdownContent.innerHTML = `
			<div class="empty-compact">
				<i class="fas fa-exclamation-circle"></i>
				<div>Không thể tải playlists</div>
				<div style="margin-top: 8px; font-size: 11px; color: #ef4444;">
					Lỗi: ${error.message}
				</div>
				<div style="margin-top: 8px; font-size: 11px;">
					Kiểm tra server đã chạy: http://localhost:3000
				</div>
			</div>
		`;
	}
} // Render Playlists
function renderPlaylists() {
	if (!currentPlaylists || currentPlaylists.length === 0) {
		playlistDropdownContent.innerHTML = `
			<div class="empty-compact">
				<i class="fas fa-music"></i>
				<div>Chưa có playlist nào</div>
			</div>
		`;
		return;
	}

	playlistDropdownContent.innerHTML = currentPlaylists
		.map(
			(playlist) => `
			<div class="playlist-item-compact ${playlist.id === currentPlaylistId ? "playing" : ""}" 
				 data-playlist-id="${playlist.id}">
				<div class="queue-number">
					<i class="fas fa-list"></i>
				</div>
				<div class="queue-info">
					<div class="queue-title">${escapeHtml(playlist.name)}</div>
					<div class="queue-artist">${playlist.song_count || 0} bài hát</div>
				</div>
			</div>
		`,
		)
		.join("");

	// Add click handlers
	document.querySelectorAll(".playlist-item-compact").forEach((item) => {
		item.addEventListener("click", (e) => {
			e.stopPropagation();
			const playlistId = item.dataset.playlistId;
			console.log("Clicked playlist:", playlistId);
			loadPlaylistAndAutoPlay(parseInt(playlistId));
			playlistDropdown.classList.remove("show");
			togglePlaylistBtn.classList.remove("active");
		});
	});
}

// Load Playlist and Auto-play
async function loadPlaylistAndAutoPlay(playlistId) {
	console.log("Loading playlist:", playlistId);

	// Show loading state
	songTitleCompact.textContent = "Đang tải...";
	songArtistCompact.textContent = "Vui lòng đợi";

	try {
		const url = `${API_BASE}/api/playlists/${playlistId}`;
		console.log("Fetching from:", url);

		const response = await fetch(url);
		console.log("Response status:", response.status);

		if (!response.ok) {
			const errorText = await response.text();
			console.error("Server error:", errorText);
			throw new Error(`Server trả về lỗi: ${response.status}`);
		}

		const playlist = await response.json();
		console.log("Loaded playlist:", playlist);

		const songs = playlist.songs || [];
		console.log("Songs in playlist:", songs.length, songs);

		if (songs.length === 0) {
			console.warn("Playlist is empty");
			songTitleCompact.textContent = "Playlist rỗng!";
			songArtistCompact.textContent = "Không có bài hát nào";
			return;
		}

		currentQueue = songs;
		currentPlaylistId = playlistId;
		currentSongIndex = 0;

		// Update playlist UI
		renderPlaylists();

		// Auto-play first song
		console.log("Auto-playing first song:", songs[0].title);
		playSongAtIndex(0);
	} catch (error) {
		console.error("Error loading playlist:", error);
		songTitleCompact.textContent = "Lỗi tải playlist!";
		songArtistCompact.textContent = error.message;
	}
} // Play Song at Index
function playSongAtIndex(index) {
	if (!currentQueue || currentQueue.length === 0) {
		console.warn("No songs in queue");
		return;
	}

	if (index < 0 || index >= currentQueue.length) {
		console.warn("Invalid song index:", index);
		return;
	}

	currentSongIndex = index;
	const song = currentQueue[currentSongIndex];

	// Update UI
	songTitleCompact.textContent = song.title || "Unknown Title";
	songArtistCompact.textContent = song.artist || "Unknown Artist";

	// Load and play audio
	audioPlayer.src = `${API_BASE}${song.file_path}`;
	audioPlayer
		.play()
		.then(() => {
			isPlaying = true;
			updatePlayButton();
		})
		.catch((error) => {
			console.error("Error playing song:", error);
			isPlaying = false;
			updatePlayButton();
		});
}

// Toggle Play/Pause
function togglePlay() {
	if (!audioPlayer.src) {
		// No song loaded, try to load first song from queue
		if (currentQueue.length > 0) {
			playSongAtIndex(0);
		} else {
			songTitleCompact.textContent = "Chưa có bài hát!";
			songArtistCompact.textContent = "Hãy chọn playlist";
		}
		return;
	}

	if (isPlaying) {
		audioPlayer.pause();
		isPlaying = false;
	} else {
		audioPlayer.play();
		isPlaying = true;
	}
	updatePlayButton();
}

// Update Play Button
function updatePlayButton() {
	const icon = playBtn.querySelector("i");
	if (isPlaying) {
		icon.className = "fas fa-pause";
		playBtn.title = "Pause";
	} else {
		icon.className = "fas fa-play";
		playBtn.title = "Play";
	}
}

// Play Next
function playNext() {
	if (currentQueue.length === 0) return;

	const nextIndex = currentSongIndex + 1;
	if (nextIndex < currentQueue.length) {
		playSongAtIndex(nextIndex);
	} else {
		// End of queue, loop back to first song
		playSongAtIndex(0);
	}
}

// Play Previous
function playPrevious() {
	if (currentQueue.length === 0) return;

	const prevIndex = currentSongIndex - 1;
	if (prevIndex >= 0) {
		playSongAtIndex(prevIndex);
	} else {
		// Beginning of queue, go to last song
		playSongAtIndex(currentQueue.length - 1);
	}
}

// Update Progress Bar
function updateProgress() {
	if (!audioPlayer.duration) return;

	const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
	progressFilledCompact.style.width = `${percent}%`;
	timeCurrent.textContent = formatTime(audioPlayer.currentTime);
}

// Update Duration
function updateDuration() {
	if (!audioPlayer.duration) return;
	timeTotal.textContent = formatTime(audioPlayer.duration);
}

// Seek To Position
function seekTo(e) {
	if (!audioPlayer.duration) return;

	const rect = progressBarCompact.getBoundingClientRect();
	const percent = (e.clientX - rect.left) / rect.width;
	audioPlayer.currentTime = percent * audioPlayer.duration;
}

// Format Time
function formatTime(seconds) {
	if (!seconds || isNaN(seconds)) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Escape HTML
function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

// Auto-refresh
function startAutoRefresh() {
	if (autoRefreshInterval) {
		clearInterval(autoRefreshInterval);
	}

	autoRefreshInterval = setInterval(async () => {
		try {
			const response = await fetch(`${API_BASE}/api/playlists`);
			if (!response.ok) return;

			const newPlaylists = await response.json();

			// Check if playlists changed
			if (JSON.stringify(newPlaylists) !== JSON.stringify(currentPlaylists)) {
				console.log("Playlists updated, refreshing...");
				currentPlaylists = newPlaylists;
				renderPlaylists();

				// If current playlist is still playing, reload its songs
				if (currentPlaylistId) {
					const playlistStillExists = newPlaylists.some((p) => p.id === currentPlaylistId);
					if (playlistStillExists) {
						// Reload current playlist songs silently
						const songsResponse = await fetch(`${API_BASE}/api/playlists/${currentPlaylistId}/songs`);
						if (songsResponse.ok) {
							const newSongs = await songsResponse.json();
							if (JSON.stringify(newSongs) !== JSON.stringify(currentQueue)) {
								console.log("Current playlist songs updated");
								currentQueue = newSongs;
								// Don't interrupt current playback
							}
						}
					}
				}
			}
		} catch (error) {
			console.error("Auto-refresh error:", error);
		}
	}, REFRESH_INTERVAL);
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", init);
