// ========== PLAYLIST MANAGEMENT ==========

let currentPlaylists = [];
let currentPlaylistId = null;
let currentPlaylistSongs = []; // Lưu danh sách bài hát của playlist đang phát
let currentSongIndex = -1; // Vị trí bài hát hiện tại trong playlist
let isPlayingPlaylist = false; // Đang phát playlist hay không

// Load all playlists
async function loadPlaylists() {
	try {
		showLoading(true);
		const response = await fetch("/api/playlists");
		const playlists = await response.json();

		if (response.ok) {
			currentPlaylists = playlists;
			displayPlaylists(playlists);
		} else {
			// showToast("Lỗi khi tải playlists: " + playlists.error, "error");
		}
	} catch (error) {
		// showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Display playlists grid
function displayPlaylists(playlists) {
	const container = document.getElementById("playlists-list");

	if (!playlists || playlists.length === 0) {
		container.innerHTML = `
			<div class="loading">
				<i class="fas fa-folder-open"></i>
				<p>Chưa có playlist nào. Tạo playlist đầu tiên của bạn!</p>
			</div>
		`;
		return;
	}

	const html = playlists
		.map(
			(playlist) => `
		<div class="playlist-card" data-id="${playlist.id}">
			<div class="playlist-cover">
				<i class="fas fa-music"></i>
				<div class="playlist-overlay">
					<button class="btn-icon" onclick="openPlaylistDetail(${playlist.id})" title="Xem chi tiết">
						<i class="fas fa-play-circle"></i>
					</button>
				</div>
			</div>
			<div class="playlist-info">
				<h4>${escapeHtml(playlist.name)}</h4>
				<p>${playlist.song_count || 0} bài hát</p>
				${playlist.description ? `<small>${escapeHtml(playlist.description)}</small>` : ""}
			</div>
			<div class="playlist-actions">
				<button class="btn btn-small btn-secondary" onclick="editPlaylist(${playlist.id})" title="Sửa">
					<i class="fas fa-edit"></i>
				</button>
				<button class="btn btn-small btn-delete" onclick="deletePlaylist(${playlist.id})" title="Xóa">
					<i class="fas fa-trash"></i>
				</button>
			</div>
		</div>
	`,
		)
		.join("");

	container.innerHTML = html;
}

// Open create playlist modal
function openCreatePlaylistModal() {
	currentPlaylistId = null;
	document.getElementById("playlist-modal-title").textContent = "Tạo Playlist Mới";
	document.getElementById("playlist-name").value = "";
	document.getElementById("playlist-description").value = "";
	document.getElementById("create-playlist-modal").classList.add("active");
}

// Close create playlist modal
function closeCreatePlaylistModal() {
	document.getElementById("create-playlist-modal").classList.remove("active");
	currentPlaylistId = null;
}

// Save playlist (create or update)
async function savePlaylist() {
	const name = document.getElementById("playlist-name").value.trim();
	const description = document.getElementById("playlist-description").value.trim();

	if (!name) {
		// showToast("Vui lòng nhập tên playlist", "error");
		return;
	}

	try {
		showLoading(true);

		let response;
		if (currentPlaylistId) {
			// Update
			response = await fetch(`/api/playlists/${currentPlaylistId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, description }),
			});
		} else {
			// Create
			response = await fetch("/api/playlists", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, description }),
			});
		}

		const result = await response.json();

		if (response.ok) {
			// showToast(result.message, "success"); // Bỏ thông báo
			closeCreatePlaylistModal();
			loadPlaylists();
		} else {
			// showToast("Lỗi: " + result.error, "error");
		}
	} catch (error) {
		// showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Edit playlist
async function editPlaylist(playlistId) {
	try {
		showLoading(true);
		const response = await fetch(`/api/playlists/${playlistId}`);
		const playlist = await response.json();

		if (response.ok) {
			currentPlaylistId = playlistId;
			document.getElementById("playlist-modal-title").textContent = "Chỉnh Sửa Playlist";
			document.getElementById("playlist-name").value = playlist.name;
			document.getElementById("playlist-description").value = playlist.description || "";
			document.getElementById("create-playlist-modal").classList.add("active");
		} else {
			// showToast("Lỗi: " + playlist.error, "error");
		}
	} catch (error) {
		// showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Delete playlist
async function deletePlaylist(playlistId) {
	// Xóa trực tiếp không cần confirm
	try {
		showLoading(true);
		const response = await fetch(`/api/playlists/${playlistId}`, {
			method: "DELETE",
		});

		const result = await response.json();

		if (response.ok) {
			// showToast(result.message, "success"); // Bỏ thông báo
			loadPlaylists();
		} else {
			// showToast("Lỗi: " + result.error, "error");
		}
	} catch (error) {
		// showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Open playlist detail
async function openPlaylistDetail(playlistId) {
	try {
		showLoading(true);
		const response = await fetch(`/api/playlists/${playlistId}`);
		const playlist = await response.json();

		if (response.ok) {
			document.getElementById("playlist-detail-name").textContent = playlist.name;
			document.getElementById("playlist-detail-description").textContent = playlist.description || "";

			// Lưu playlist songs cho auto-play
			currentPlaylistSongs = playlist.songs || [];
			currentPlaylistId = playlistId;

			displayPlaylistSongs(playlist.songs, playlistId);

			document.getElementById("playlist-detail-modal").classList.add("active");
		} else {
			// showToast("Lỗi: " + playlist.error, "error");
		}
	} catch (error) {
		// showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Close playlist detail modal
function closePlaylistDetailModal() {
	document.getElementById("playlist-detail-modal").classList.remove("active");
}

// Display songs in playlist
function displayPlaylistSongs(songs, playlistId) {
	const container = document.getElementById("playlist-songs-list");

	if (!songs || songs.length === 0) {
		container.innerHTML = '<p class="no-lyrics">Playlist này chưa có bài hát nào.</p>';
		return;
	}

	// Thêm nút Play All
	let playAllButton = `
		<div style="margin-bottom: 20px; text-align: center;">
			<button class="btn btn-play" onclick="playPlaylistFromStart()" style="padding: 12px 30px; font-size: 15px;">
				<i class="fas fa-play-circle"></i> Phát tất cả (${songs.length} bài)
			</button>
		</div>
	`;

	const html = songs
		.map(
			(song, index) => `
		<div class="song-item" data-id="${song.id}" data-index="${index}">
			<div class="song-info">
				<div class="song-details">
					<span style="color: #00d9ff; font-weight: bold; margin-right: 10px;">${index + 1}</span>
					<h4>${escapeHtml(song.title)}</h4>
					<p><i class="fas fa-user"></i> ${escapeHtml(song.artist)}</p>
					<small><i class="fas fa-calendar"></i> Thêm vào: ${formatDate(song.added_at)}</small>
				</div>
				<div class="song-actions">
					<button class="btn btn-play" onclick="playFromPlaylist(${index})">
						<i class="fas fa-play"></i> Phát
					</button>
					<button class="btn btn-delete" onclick="removeSongFromPlaylist(${playlistId}, ${song.id})">
						<i class="fas fa-times"></i> Xóa khỏi playlist
					</button>
				</div>
			</div>
		</div>
	`,
		)
		.join("");

	container.innerHTML = playAllButton + html;
}

// Play playlist from start
window.playPlaylistFromStart = function () {
	if (currentPlaylistSongs.length === 0) return;

	window.isPlayingPlaylist = true;
	currentSongIndex = 0;
	playFromPlaylist(0);
};

// Play song from playlist at specific index
window.playFromPlaylist = function (index) {
	if (!currentPlaylistSongs || index < 0 || index >= currentPlaylistSongs.length) return;

	window.isPlayingPlaylist = true;
	currentSongIndex = index;
	const song = currentPlaylistSongs[index];

	// Highlight current playing song
	highlightCurrentSong(index);

	// Play the song
	playSong(song.id);
};

// Highlight current playing song in playlist
function highlightCurrentSong(index) {
	// Remove previous highlight
	document.querySelectorAll(".song-item").forEach((item) => {
		item.style.background = "";
		item.style.borderColor = "";
	});

	// Highlight current
	const songItems = document.querySelectorAll(".song-item[data-index]");
	if (songItems[index]) {
		songItems[index].style.background =
			"linear-gradient(145deg, rgba(0, 217, 255, 0.15) 0%, rgba(0, 153, 204, 0.1) 100%)";
		songItems[index].style.borderColor = "#00d9ff";
	}
}

// Play next song in playlist
window.playNextInPlaylist = function () {
	if (!window.isPlayingPlaylist || currentPlaylistSongs.length === 0) return;

	currentSongIndex++;

	if (currentSongIndex >= currentPlaylistSongs.length) {
		// Đã hết playlist, quay lại đầu
		currentSongIndex = 0;
	}

	playFromPlaylist(currentSongIndex);
};

// Add song to playlist (show selection modal)
async function showAddToPlaylistModal(songId) {
	// Load playlists first if not loaded
	if (currentPlaylists.length === 0) {
		await loadPlaylists();
	}

	if (currentPlaylists.length === 0) {
		// Tự động mở modal tạo playlist mới
		openCreatePlaylistModal();
		return;
	}

	// Create and show modal with playlist selection
	const modal = document.createElement("div");
	modal.id = "add-to-playlist-modal";
	modal.className = "modal active";
	modal.innerHTML = `
		<div class="modal-content">
			<div class="modal-header">
				<h2><i class="fas fa-plus-circle"></i> Thêm vào Playlist</h2>
				<button class="close-modal" onclick="closeAddToPlaylistModal()">
					<i class="fas fa-times"></i>
				</button>
			</div>
			<div class="playlist-selection">
				<p style="color: var(--text-light); margin-bottom: 16px;">Chọn playlist để thêm bài hát:</p>
				<div class="playlist-list">
					${currentPlaylists
						.map(
							(playlist) => `
						<div class="playlist-option" onclick="addSongToPlaylist(${playlist.id}, ${songId})">
							<div class="playlist-option-icon">
								<i class="fas fa-list"></i>
							</div>
							<div class="playlist-option-info">
								<h4>${escapeHtml(playlist.name)}</h4>
								<p>${playlist.song_count || 0} bài hát</p>
							</div>
							<i class="fas fa-chevron-right"></i>
						</div>
					`,
						)
						.join("")}
				</div>
				<button class="btn btn-secondary" onclick="openCreatePlaylistModal(); closeAddToPlaylistModal();" style="width: 100%; margin-top: 16px;">
					<i class="fas fa-plus"></i> Tạo playlist mới
				</button>
			</div>
		</div>
	`;

	// Remove old modal if exists
	const oldModal = document.getElementById("add-to-playlist-modal");
	if (oldModal) {
		oldModal.remove();
	}

	document.body.appendChild(modal);

	// Close on background click
	modal.addEventListener("click", function (e) {
		if (e.target === modal) {
			closeAddToPlaylistModal();
		}
	});
}

// Close add to playlist modal
function closeAddToPlaylistModal() {
	const modal = document.getElementById("add-to-playlist-modal");
	if (modal) {
		modal.remove();
	}
}

// Add song to playlist
async function addSongToPlaylist(playlistId, songId) {
	try {
		showLoading(true);

		// Close the modal immediately for better UX
		closeAddToPlaylistModal();

		const response = await fetch(`/api/playlists/${playlistId}/songs`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ songId }),
		});

		const result = await response.json();

		if (response.ok) {
			// showToast(result.message, "success"); // Bỏ thông báo
			loadPlaylists(); // Refresh to update song count
		} else {
			// showToast("Lỗi: " + result.error, "error");
		}
	} catch (error) {
		// showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Remove song from playlist
async function removeSongFromPlaylist(playlistId, songId) {
	// Xóa trực tiếp không cần confirm
	try {
		showLoading(true);
		const response = await fetch(`/api/playlists/${playlistId}/songs/${songId}`, {
			method: "DELETE",
		});

		const result = await response.json();

		if (response.ok) {
			// showToast(result.message, "success"); // Bỏ thông báo
			openPlaylistDetail(playlistId); // Refresh playlist detail
			loadPlaylists(); // Refresh to update song count
		} else {
			// showToast("Lỗi: " + result.error, "error");
		}
	} catch (error) {
		// showToast("Lỗi kết nối: " + error.message, "error");
	} finally {
		showLoading(false);
	}
}

// Close modals when clicking outside
window.addEventListener("click", function (event) {
	if (event.target.id === "create-playlist-modal") {
		closeCreatePlaylistModal();
	}
	if (event.target.id === "playlist-detail-modal") {
		closePlaylistDetailModal();
	}
});
