// Desktop Music Player App Logic

// Get DOM elements
const audioPlayer = document.getElementById("audio-player");
const playBtn = document.getElementById("play-btn");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");
const volumeSlider = document.getElementById("volume-slider");
const volumeValue = document.getElementById("volume-value");
const progressBar = document.querySelector(".progress-bar");
const progressFilled = document.getElementById("progress-filled");
const timeCurrent = document.getElementById("time-current");
const timeTotal = document.getElementById("time-total");
const songTitle = document.getElementById("song-title");
const songArtist = document.getElementById("song-artist");
const currentSongTitle = document.getElementById("current-song-title");
const playlistList = document.getElementById("playlist-list");
const queueList = document.getElementById("queue-list");

// Window controls
const minimizeBtn = document.getElementById("minimize-btn");
const maximizeBtn = document.getElementById("maximize-btn");
const closeBtn = document.getElementById("close-btn");
const pinBtn = document.getElementById("pin-btn");

// Tab switching
const tabs = document.querySelectorAll(".tab");
const tabContents = document.querySelectorAll(".tab-content");

// State
let currentPlaylists = [];
let currentQueue = [];
let currentSongIndex = 0;
let isPlaying = false;
let isPinned = false;
let currentPlaylistId = null; // Track current playlist being viewed
let autoRefreshInterval = null; // Auto-refresh timer

// API Base URL - Change this to your server URL
const API_BASE = "http://localhost:3000";

// Auto-refresh settings
const REFRESH_INTERVAL = 5000; // Refresh every 5 seconds

// Initialize app
async function init() {
	setupEventListeners();
	await loadPlaylists();
	setVolume(80);
	startAutoRefresh(); // Start auto-refresh
}

// Setup event listeners
function setupEventListeners() {
	// Window controls
	if (window.electron) {
		minimizeBtn.addEventListener("click", () => window.electron.minimize());
		maximizeBtn.addEventListener("click", () => window.electron.maximize());
		closeBtn.addEventListener("click", () => window.electron.close());
		pinBtn.addEventListener("click", togglePin);
	}

	// Playback controls
	playBtn.addEventListener("click", togglePlay);
	prevBtn.addEventListener("click", playPrevious);
	nextBtn.addEventListener("click", playNext);

	// Volume
	volumeSlider.addEventListener("input", (e) => setVolume(e.target.value));

	// Progress bar
	progressBar.addEventListener("click", seek);

	// Audio events
	audioPlayer.addEventListener("timeupdate", updateProgress);
	audioPlayer.addEventListener("loadedmetadata", updateDuration);
	audioPlayer.addEventListener("ended", playNext);
	audioPlayer.addEventListener("play", () => updatePlayButton(true));
	audioPlayer.addEventListener("pause", () => updatePlayButton(false));

	// Tab switching
	tabs.forEach((tab) => {
		tab.addEventListener("click", () => switchTab(tab.dataset.tab));
	});
}

// Window controls
function togglePin() {
	isPinned = !isPinned;
	pinBtn.classList.toggle("active", isPinned);
	if (window.electron) {
		window.electron.setAlwaysOnTop(isPinned);
	}
}

// Tab switching
function switchTab(tabName) {
	tabs.forEach((tab) => {
		tab.classList.toggle("active", tab.dataset.tab === tabName);
	});

	tabContents.forEach((content) => {
		content.classList.toggle("active", content.id === `${tabName}-content`);
	});
}

// Load playlists from server
async function loadPlaylists() {
	try {
		const response = await fetch(`${API_BASE}/api/playlists`);
		const playlists = await response.json();

		if (response.ok) {
			currentPlaylists = playlists;
			displayPlaylists(playlists);
		} else {
			console.error("Failed to load playlists");
			showError("Không thể tải playlists");
		}
	} catch (error) {
		console.error("Error loading playlists:", error);
		showError("Lỗi kết nối đến server");
	}
}

// Display playlists
function displayPlaylists(playlists) {
	if (!playlists || playlists.length === 0) {
		playlistList.innerHTML = `
			<p class="empty-state">
				<i class="fas fa-folder-open"></i><br>
				Chưa có playlist nào
			</p>
		`;
		return;
	}

	playlistList.innerHTML = playlists
		.map(
			(playlist) => `
		<div class="playlist-item" data-id="${playlist.id}">
			<div class="playlist-item-header">
				<div class="playlist-icon">
					<i class="fas fa-music"></i>
				</div>
				<div class="playlist-info">
					<div class="playlist-name">${escapeHtml(playlist.name)}</div>
					<div class="playlist-count">${playlist.song_count || 0} bài hát</div>
				</div>
			</div>
		</div>
	`,
		)
		.join("");

	// Add click handlers
	document.querySelectorAll(".playlist-item").forEach((item) => {
		item.addEventListener("click", () => loadPlaylist(item.dataset.id));
	});
}

// Load playlist songs
async function loadPlaylist(playlistId) {
	try {
		currentPlaylistId = playlistId; // Save current playlist ID
		const response = await fetch(`${API_BASE}/api/playlists/${playlistId}`);
		const playlist = await response.json();

		if (response.ok && playlist.songs) {
			currentQueue = playlist.songs;
			displayQueue(playlist.songs);
			switchTab("queue");
		}
	} catch (error) {
		console.error("Error loading playlist:", error);
	}
}

// Display queue
function displayQueue(songs) {
	if (!songs || songs.length === 0) {
		queueList.innerHTML = `
			<p class="empty-state">
				<i class="fas fa-music"></i><br>
				Playlist trống
			</p>
		`;
		return;
	}

	queueList.innerHTML = songs
		.map(
			(song, index) => `
		<div class="song-item ${index === currentSongIndex ? "playing" : ""}" data-index="${index}">
			<div class="song-number">${index + 1}</div>
			<div class="song-name">${escapeHtml(song.title)}</div>
			<div class="song-artist">${escapeHtml(song.artist)}</div>
		</div>
	`,
		)
		.join("");

	// Add click handlers
	document.querySelectorAll(".song-item").forEach((item) => {
		item.addEventListener("click", () => playSongAtIndex(parseInt(item.dataset.index)));
	});
}

// Playback functions
function togglePlay() {
	if (isPlaying) {
		audioPlayer.pause();
	} else {
		if (!audioPlayer.src && currentQueue.length > 0) {
			playSongAtIndex(0);
		} else {
			audioPlayer.play();
		}
	}
}

function playPrevious() {
	if (currentSongIndex > 0) {
		playSongAtIndex(currentSongIndex - 1);
	}
}

function playNext() {
	if (currentSongIndex < currentQueue.length - 1) {
		playSongAtIndex(currentSongIndex + 1);
	}
}

function playSongAtIndex(index) {
	if (index < 0 || index >= currentQueue.length) return;

	currentSongIndex = index;
	const song = currentQueue[index];

	// Update UI
	songTitle.textContent = song.title;
	songArtist.textContent = song.artist;
	currentSongTitle.textContent = song.title;

	// Update audio
	audioPlayer.src = `${API_BASE}/${song.file_path}`;
	audioPlayer.load();
	audioPlayer.play();

	// Update queue display
	document.querySelectorAll(".song-item").forEach((item, i) => {
		item.classList.toggle("playing", i === index);
	});
}

function updatePlayButton(playing) {
	isPlaying = playing;
	const icon = playBtn.querySelector("i");
	icon.className = playing ? "fas fa-pause" : "fas fa-play";
}

// Volume control
function setVolume(value) {
	audioPlayer.volume = value / 100;
	volumeValue.textContent = `${value}%`;
	volumeSlider.value = value;
}

// Progress bar
function updateProgress() {
	if (!audioPlayer.duration) return;

	const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
	progressFilled.style.width = `${percent}%`;

	timeCurrent.textContent = formatTime(audioPlayer.currentTime);
}

function updateDuration() {
	timeTotal.textContent = formatTime(audioPlayer.duration);
}

function seek(e) {
	const rect = progressBar.getBoundingClientRect();
	const percent = (e.clientX - rect.left) / rect.width;
	audioPlayer.currentTime = percent * audioPlayer.duration;
}

// Utility functions
function formatTime(seconds) {
	if (!seconds || isNaN(seconds)) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function escapeHtml(text) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

function showError(message) {
	playlistList.innerHTML = `
		<p class="empty-state">
			<i class="fas fa-exclamation-triangle"></i><br>
			${message}
		</p>
	`;
}

// Auto-refresh functionality
function startAutoRefresh() {
	// Refresh playlists every 5 seconds
	autoRefreshInterval = setInterval(async () => {
		await loadPlaylists();

		// If viewing a playlist, refresh its songs too
		if (currentPlaylistId) {
			const response = await fetch(`${API_BASE}/api/playlists/${currentPlaylistId}`);
			const playlist = await response.json();

			if (response.ok && playlist.songs) {
				// Only update if songs changed
				if (JSON.stringify(currentQueue) !== JSON.stringify(playlist.songs)) {
					console.log("🔄 Playlist updated, refreshing...");
					currentQueue = playlist.songs;
					displayQueue(playlist.songs);
				}
			}
		}
	}, REFRESH_INTERVAL);
}

function stopAutoRefresh() {
	if (autoRefreshInterval) {
		clearInterval(autoRefreshInterval);
		autoRefreshInterval = null;
	}
}

// Add refresh button handler
function addRefreshButton() {
	const refreshBtn = document.createElement("button");
	refreshBtn.className = "titlebar-btn";
	refreshBtn.title = "Refresh";
	refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
	refreshBtn.addEventListener("click", async () => {
		refreshBtn.querySelector("i").classList.add("fa-spin");
		await loadPlaylists();
		if (currentPlaylistId) {
			await loadPlaylist(currentPlaylistId);
		}
		setTimeout(() => {
			refreshBtn.querySelector("i").classList.remove("fa-spin");
		}, 500);
	});

	// Insert before pin button
	const titlebarControls = document.querySelector(".titlebar-controls");
	titlebarControls.insertBefore(refreshBtn, pinBtn);
}

// Initialize on load
window.addEventListener("DOMContentLoaded", () => {
	init();
	addRefreshButton();
});

// Clean up on unload
window.addEventListener("beforeunload", () => {
	stopAutoRefresh();
});
