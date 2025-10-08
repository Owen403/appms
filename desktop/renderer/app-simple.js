// Simple Music Player App

// DOM Elements
const audioPlayer = document.getElementById("audio-player");
const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const progressBar = document.getElementById("progress-bar");
const progressFill = document.getElementById("progress-fill");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");
const songTitle = document.getElementById("song-title");
const songArtist = document.getElementById("song-artist");
const volumeSlider = document.getElementById("volume-slider");
const volumeValue = document.getElementById("volume-value");
const playlistsList = document.getElementById("playlists-list");
const queueList = document.getElementById("queue-list");

// Window controls
const minimizeBtn = document.getElementById("minimize-btn");
const closeBtn = document.getElementById("close-btn");
const pinBtn = document.getElementById("pin-btn");
const refreshBtn = document.getElementById("refresh-btn");

// State
let playlists = [];
let currentQueue = [];
let currentSongIndex = 0;
let isPlaying = false;
let isPinned = true;
let currentPlaylistId = null;
let refreshInterval = null;

// API
const API_BASE = "http://localhost:3000";
const AUTO_REFRESH_INTERVAL = 10000; // 10 seconds

// Initialize
async function init() {
	setupEventListeners();
	await loadPlaylists();
	setVolume(80);

	// Default pinned
	pinBtn.classList.add("active");

	// Auto refresh every 10 seconds
	startAutoRefresh();
}

// Auto Refresh
function startAutoRefresh() {
	if (refreshInterval) {
		clearInterval(refreshInterval);
	}

	refreshInterval = setInterval(async () => {
		await loadPlaylists();

		// If a playlist is currently playing, refresh its songs
		if (currentPlaylistId) {
			await refreshCurrentPlaylist();
		}
	}, AUTO_REFRESH_INTERVAL);
}

async function refreshCurrentPlaylist() {
	try {
		const response = await fetch(`${API_BASE}/api/playlists/${currentPlaylistId}`);
		if (!response.ok) return;

		const playlist = await response.json();
		const songs = playlist.songs || [];

		// Only update if song count changed
		if (songs.length !== currentQueue.length) {
			const wasPlaying = isPlaying;
			const currentTime = audioPlayer.currentTime;
			const currentSrc = audioPlayer.src;

			currentQueue = songs;
			renderQueue();

			// Restore playback if same song
			if (wasPlaying && currentSongIndex < songs.length) {
				const song = songs[currentSongIndex];
				const newSrc = song.file_path.startsWith("/")
					? `${API_BASE}${song.file_path}`
					: `${API_BASE}/${song.file_path}`;

				if (newSrc === currentSrc) {
					audioPlayer.currentTime = currentTime;
					if (wasPlaying) audioPlayer.play();
				}
			}
		}
	} catch (error) {
		console.error("Error refreshing playlist:", error);
	}
}

// Event Listeners
function setupEventListeners() {
	// Window controls
	minimizeBtn.addEventListener("click", () => window.electron.minimize());
	closeBtn.addEventListener("click", () => window.electron.close());
	pinBtn.addEventListener("click", togglePin);
	refreshBtn.addEventListener("click", manualRefresh);

	// Player controls
	playBtn.addEventListener("click", togglePlay);
	prevBtn.addEventListener("click", playPrevious);
	nextBtn.addEventListener("click", playNext);

	// Audio events
	audioPlayer.addEventListener("timeupdate", updateProgress);
	audioPlayer.addEventListener("loadedmetadata", updateDuration);
	audioPlayer.addEventListener("ended", playNext);
	audioPlayer.addEventListener("play", () => {
		isPlaying = true;
		updatePlayButton();
	});
	audioPlayer.addEventListener("pause", () => {
		isPlaying = false;
		updatePlayButton();
	});

	// Progress bar
	progressBar.addEventListener("click", seekTo);

	// Volume
	volumeSlider.addEventListener("input", (e) => {
		setVolume(e.target.value);
	});
}

// Window Controls
async function togglePin() {
	isPinned = !isPinned;
	await window.electron.setAlwaysOnTop(isPinned);
	pinBtn.classList.toggle("active", isPinned);
}

async function manualRefresh() {
	// Add spinning animation
	const icon = refreshBtn.querySelector("i");
	icon.classList.add("fa-spin");

	await loadPlaylists();

	if (currentPlaylistId) {
		await refreshCurrentPlaylist();
	}

	// Remove spinning after 500ms
	setTimeout(() => {
		icon.classList.remove("fa-spin");
	}, 500);
}

// Load Playlists
async function loadPlaylists() {
	try {
		const response = await fetch(`${API_BASE}/api/playlists`);
		if (!response.ok) throw new Error("Failed to load playlists");

		playlists = await response.json();
		renderPlaylists();
	} catch (error) {
		console.error("Error loading playlists:", error);
		playlistsList.innerHTML = `
			<div class="empty">
				<i class="fas fa-exclamation-circle"></i>
				<p>Không thể tải playlists</p>
				<p style="font-size: 11px; margin-top: 5px;">Kiểm tra server đã chạy</p>
			</div>
		`;
	}
}

// Render Playlists
function renderPlaylists() {
	if (!playlists || playlists.length === 0) {
		playlistsList.innerHTML = `
			<div class="empty">
				<i class="fas fa-music"></i>
				<p>Chưa có playlist</p>
			</div>
		`;
		return;
	}

	playlistsList.innerHTML = playlists
		.map(
			(playlist) => `
		<div class="playlist-item ${playlist.id === currentPlaylistId ? "active" : ""}" 
			 data-id="${playlist.id}">
			<div class="playlist-name">${escapeHtml(playlist.name)}</div>
			<div class="playlist-count">
				<i class="fas fa-music"></i> ${playlist.song_count || 0} bài
			</div>
		</div>
	`,
		)
		.join("");

	// Add click handlers
	document.querySelectorAll(".playlist-item").forEach((item) => {
		item.addEventListener("click", () => {
			const playlistId = parseInt(item.dataset.id);
			loadAndPlayPlaylist(playlistId);
		});
	});
}

// Load and Play Playlist
async function loadAndPlayPlaylist(playlistId) {
	try {
		songTitle.textContent = "Đang tải...";
		songArtist.textContent = "Vui lòng đợi";

		const response = await fetch(`${API_BASE}/api/playlists/${playlistId}`);
		if (!response.ok) throw new Error("Failed to load playlist");

		const playlist = await response.json();
		const songs = playlist.songs || [];

		if (songs.length === 0) {
			songTitle.textContent = "Playlist rỗng!";
			songArtist.textContent = "Không có bài hát";
			return;
		}

		currentQueue = songs;
		currentPlaylistId = playlistId;
		currentSongIndex = 0;

		renderPlaylists();
		renderQueue();
		playSongAtIndex(0);
	} catch (error) {
		console.error("Error loading playlist:", error);
		songTitle.textContent = "Lỗi tải playlist!";
		songArtist.textContent = error.message;
	}
}

// Render Queue
function renderQueue() {
	if (!currentQueue || currentQueue.length === 0) {
		queueList.innerHTML = `
			<div class="empty">
				<i class="fas fa-music"></i>
				<p>Chọn playlist để xem danh sách</p>
			</div>
		`;
		return;
	}

	queueList.innerHTML = currentQueue
		.map(
			(song, index) => `
		<div class="queue-item ${index === currentSongIndex ? "playing" : ""}" 
			 data-index="${index}">
			<div class="queue-item-header">
				<span class="song-number">${(index + 1).toString().padStart(2, "0")}</span>
				<div class="song-title">${escapeHtml(song.title || "Unknown")}</div>
			</div>
			<div class="song-artist">${escapeHtml(song.artist || "Unknown Artist")}</div>
		</div>
	`,
		)
		.join("");

	// Add click handlers
	document.querySelectorAll(".queue-item").forEach((item) => {
		item.addEventListener("click", () => {
			const index = parseInt(item.dataset.index);
			playSongAtIndex(index);
		});
	});
}

// Play Song at Index
function playSongAtIndex(index) {
	if (!currentQueue || currentQueue.length === 0) {
		console.warn("No songs in queue");
		return;
	}
	if (index < 0 || index >= currentQueue.length) {
		console.warn("Invalid index:", index);
		return;
	}

	currentSongIndex = index;
	const song = currentQueue[currentSongIndex];

	console.log("Playing song:", song);

	songTitle.textContent = song.title || "Unknown";
	songArtist.textContent = song.artist || "Unknown Artist";

	// Construct proper audio URL
	let audioUrl;
	if (song.file_path.startsWith("/")) {
		audioUrl = `${API_BASE}${song.file_path}`;
	} else {
		audioUrl = `${API_BASE}/${song.file_path}`;
	}

	console.log("Audio URL:", audioUrl);

	audioPlayer.src = audioUrl;
	audioPlayer.load();

	// Update queue highlighting
	renderQueue();

	// Add error handler
	audioPlayer.onerror = function (e) {
		console.error("Audio loading error:", e);
		console.error("Failed URL:", audioUrl);
		songTitle.textContent = "Lỗi phát nhạc!";
		songArtist.textContent = "File không tồn tại hoặc lỗi định dạng";
	};

	// Auto play
	audioPlayer.play().catch((error) => {
		console.error("Playback error:", error);
		songTitle.textContent = "Lỗi phát nhạc!";
		songArtist.textContent = error.message;
	});
}

// Toggle Play/Pause
function togglePlay() {
	if (!audioPlayer.src) {
		if (currentQueue.length > 0) {
			playSongAtIndex(0);
		}
		return;
	}

	if (audioPlayer.paused) {
		audioPlayer.play();
	} else {
		audioPlayer.pause();
	}
}

// Update Play Button
function updatePlayButton() {
	const icon = playBtn.querySelector("i");
	icon.className = isPlaying ? "fas fa-pause" : "fas fa-play";
}

// Play Next
function playNext() {
	if (currentQueue.length === 0) return;

	const nextIndex = currentSongIndex + 1;
	if (nextIndex < currentQueue.length) {
		playSongAtIndex(nextIndex);
	} else {
		playSongAtIndex(0); // Loop
	}
}

// Play Previous
function playPrevious() {
	if (currentQueue.length === 0) return;

	const prevIndex = currentSongIndex - 1;
	if (prevIndex >= 0) {
		playSongAtIndex(prevIndex);
	} else {
		playSongAtIndex(currentQueue.length - 1);
	}
}

// Update Progress
function updateProgress() {
	if (!audioPlayer.duration) return;

	const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
	progressFill.style.width = `${percent}%`;
	timeCurrent.textContent = formatTime(audioPlayer.currentTime);
}

// Update Duration
function updateDuration() {
	if (!audioPlayer.duration) return;
	timeTotal.textContent = formatTime(audioPlayer.duration);
}

// Seek To
function seekTo(e) {
	if (!audioPlayer.duration) return;

	const rect = progressBar.getBoundingClientRect();
	const percent = (e.clientX - rect.left) / rect.width;
	audioPlayer.currentTime = percent * audioPlayer.duration;
}

// Set Volume
function setVolume(value) {
	audioPlayer.volume = value / 100;
	volumeValue.textContent = `${value}%`;
	volumeSlider.value = value;
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

// Init on load
document.addEventListener("DOMContentLoaded", init);
