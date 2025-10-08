# 🎵 Hướng Dẫn Sử Dụng Livestream Overlay

## Cách Khởi Động

### 1. Chạy Server (BẮT BUỘC)

```bash
# Mở terminal 1
cd d:\appmusic
node server.js
```

### 2. Chạy Desktop App

```bash
# Mở terminal 2
cd d:\appmusic\desktop
npm start

# HOẶC double-click:
Launch Music Player.vbs
```

## Cách Sử Dụng

### ✅ Chọn Playlist

1. Click vào nút **màu TÍM** (icon list) bên phải
2. Dropdown sẽ hiện danh sách playlists
3. **Click vào playlist** → Nhạc tự động phát!

### 🎮 Điều Khiển

-    **Play/Pause**: Nút giữa (màu cyan)
-    **Previous**: Nút mũi tên trái
-    **Next**: Nút mũi tên phải
-    **Seek**: Click vào thanh progress bar

### 📌 Tính Năng

-    ✅ Auto-play khi chọn playlist
-    ✅ Tự động chuyển bài khi hết
-    ✅ Loop playlist khi phát hết
-    ✅ Auto-refresh mỗi 5 giây
-    ✅ Always on top (luôn ở trên cùng)
-    ✅ Text scroll tự động cho tên bài dài

## Dùng Làm Overlay Cho OBS/Streamlabs

### Cách Thêm Vào OBS:

1. Mở OBS/Streamlabs
2. Thêm Source → **Window Capture**
3. Chọn cửa sổ: "Music Player - Livestream"
4. Kéo thả vào vị trí mong muốn
5. Resize nếu cần

### Vị Trí Đề Xuất:

-    **Góc trên phải**: Hiển thị bài hát đang phát
-    **Dưới webcam**: Thanh nhạc ngang
-    **Bottom third**: Dưới màn hình

## Debug (Nếu Có Lỗi)

### Không Thấy Playlists?

1. Kiểm tra server đã chạy: `http://localhost:3000`
2. Mở DevTools: F12 → Console
3. Xem console.log để debug

### Dropdown Không Hiện?

-    Click vào nút TÍM (icon list)
-    Kiểm tra console: "Toggle playlist dropdown: true"
-    Reload app: Ctrl+R

### Không Tự Động Phát?

-    Kiểm tra console: "Auto-playing first song: ..."
-    Kiểm tra playlist có bài hát không
-    Kiểm tra đường dẫn file nhạc

## Phím Tắt

-    **F12**: Mở DevTools (debug)
-    **Ctrl+R**: Reload app
-    **Ctrl+W**: Đóng app

## Kích Thước

-    Width: 800px
-    Height: 120px
-    Dạng: Horizontal overlay (ngang)

## Lưu Ý

⚠️ **Server PHẢI chạy trước** thì app mới load được playlists!
⚠️ Nếu text bị cắt, chữ sẽ tự động scroll
⚠️ App luôn ở trên cùng (always on top) để hiển thị trên OBS
