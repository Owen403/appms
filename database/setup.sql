-- Script tạo database và cấu hình cho Music App
-- Chạy script này bằng MySQL command line hoặc phpMyAdmin

-- Tạo database
CREATE DATABASE IF NOT EXISTS appmusic 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

-- Sử dụng database
USE appmusic;

-- Tạo bảng songs
CREATE TABLE IF NOT EXISTS songs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL COMMENT 'Tên bài hát',
    artist VARCHAR(255) NOT NULL COMMENT 'Nghệ sĩ',
    file_path VARCHAR(500) NOT NULL COMMENT 'Đường dẫn file nhạc',
    lyrics TEXT COMMENT 'Lời bài hát',
    duration INT DEFAULT NULL COMMENT 'Thời lượng (giây)',
    file_size BIGINT DEFAULT NULL COMMENT 'Kích thước file (bytes)',
    file_type VARCHAR(50) DEFAULT NULL COMMENT 'Loại file (mp3, wav, etc.)',
    play_count INT DEFAULT 0 COMMENT 'Số lượt phát',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Ngày cập nhật',
    
    -- Indexes để tăng hiệu suất
    INDEX idx_created_at (created_at),
    INDEX idx_artist (artist),
    INDEX idx_title (title),
    INDEX idx_play_count (play_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu trữ thông tin bài hát';

-- Tạo user cho ứng dụng (tùy chọn, để tăng bảo mật)
-- CREATE USER IF NOT EXISTS 'musicapp'@'localhost' IDENTIFIED BY 'musicapp123';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON appmusic.* TO 'musicapp'@'localhost';
-- FLUSH PRIVILEGES;

-- Insert một số dữ liệu mẫu (tùy chọn)
-- INSERT INTO songs (title, artist, file_path, lyrics) VALUES 
-- ('Demo Song 1', 'Demo Artist', 'uploads/demo1.mp3', 'Đây là lời bài hát demo...'),
-- ('Demo Song 2', 'Demo Artist 2', 'uploads/demo2.mp3', 'Lời bài hát thứ hai...');

-- Tạo bảng playlists
CREATE TABLE IF NOT EXISTS playlists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT 'Tên playlist',
    description TEXT COMMENT 'Mô tả playlist',
    cover_image VARCHAR(255) COMMENT 'Ảnh bìa playlist',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Ngày cập nhật',
    
    INDEX idx_created_at (created_at),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng lưu trữ playlists';

-- Bảng trung gian để lưu bài hát trong playlist
CREATE TABLE IF NOT EXISTS playlist_songs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    playlist_id INT NOT NULL COMMENT 'ID playlist',
    song_id INT NOT NULL COMMENT 'ID bài hát',
    position INT DEFAULT 0 COMMENT 'Vị trí trong playlist',
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày thêm vào',
    
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE,
    UNIQUE KEY unique_playlist_song (playlist_id, song_id),
    
    INDEX idx_playlist_id (playlist_id),
    INDEX idx_song_id (song_id),
    INDEX idx_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Bảng trung gian playlist-songs';

-- Hiển thị thông tin database
SELECT 'Database appmusic đã được tạo thành công!' as message;
SHOW TABLES;
DESCRIBE songs;
DESCRIBE playlists;
DESCRIBE playlist_songs;
