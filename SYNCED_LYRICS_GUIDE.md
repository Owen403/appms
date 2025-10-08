# Hướng Dẫn Sử Dụng Synced Lyrics (Karaoke Mode)

## 🎤 Tính năng Synced Lyrics đã được thêm vào!

Giờ đây bạn có thể thêm lời bài hát có đồng bộ thời gian (như Zing MP3) để hiển thị dạng karaoke.

## 📝 Format LRC (Lyric File Format)

Synced lyrics sử dụng format LRC với cú pháp:

```
[mm:ss.xx] Lời bài hát dòng 1
[mm:ss.xx] Lời bài hát dòng 2
```

**Ví dụ:**

```
[00:11.48] Trong nhân gian có hai điều không thể giấu
[00:14.38] Một là khi say, hai khi đã yêu ai rồi
[00:17.38] Những lúc ngồi đợi chờ này ở đâu mà ra?
[00:21.20] Khi anh uống say, khi anh nghĩ về cô ấy
```

Trong đó:

-    `[00:11.48]` = 0 phút 11 giây 48 (phần trăm giây)
-    `[00:14.38]` = 0 phút 14 giây 38

## 🎵 Cách sử dụng

### 1. **Thêm Synced Lyrics khi upload bài hát mới**

Hiện tại bạn cần thêm synced lyrics thủ công vào database:

```javascript
// Trong route POST /api/upload hoặc /api/upload-url
// Thêm field synced_lyrics vào INSERT query
```

### 2. **Sử dụng Karaoke Mode**

1. Phát một bài hát bất kỳ
2. Trong tab "Phát nhạc", bạn sẽ thấy 2 nút:

     - **Lời thường**: Hiển thị lời bình thường
     - **Karaoke**: Hiển thị lời đồng bộ theo thời gian

3. Click vào **Karaoke** để chuyển sang mode karaoke
4. Lời bài hát sẽ tự động highlight theo nhạc
5. Click vào bất kỳ dòng lời nào để nhảy đến thời điểm đó

## 🎨 Tính năng Karaoke Mode

-    ✅ **Auto-scroll**: Tự động cuộn đến dòng đang hát
-    ✅ **Highlight dòng active**: Dòng đang hát được làm nổi bật (màu trắng, to hơn)
-    ✅ **Hiệu ứng**: Dòng đã hát mờ đi, dòng sắp hát sáng lên
-    ✅ **Click to seek**: Click vào dòng lời để nhảy đến thời điểm đó
-    ✅ **Smooth animation**: Chuyển động mượt mà

## 🛠️ Cập nhật Database

Database đã được cập nhật với cột mới:

```sql
ALTER TABLE songs
ADD COLUMN synced_lyrics TEXT DEFAULT NULL;
```

## 📌 Cách thêm Synced Lyrics vào bài hát

Bạn có thể thêm synced lyrics bằng cách:

### 1. Thủ công qua MySQL:

```sql
UPDATE songs
SET synced_lyrics = '[00:11.48] Trong nhân gian có hai điều không thể giấu
[00:14.38] Một là khi say, hai khi đã yêu ai rồi'
WHERE id = 1;
```

### 2. Qua API (cần implement):

Thêm endpoint mới:

```javascript
app.post("/api/songs/:id/synced-lyrics", async (req, res) => {
	const { id } = req.params;
	const { synced_lyrics } = req.body;

	await db.execute("UPDATE songs SET synced_lyrics = ? WHERE id = ?", [synced_lyrics, id]);

	res.json({ success: true });
});
```

## 🌐 Nguồn lấy Synced Lyrics

Bạn có thể lấy synced lyrics từ:

1. **LRClib.net** - Free LRC database
2. **Megalobiz.com** - LRC files database
3. **Tự tạo** - Sử dụng các tools như:
     - **LRC Maker** (online)
     - **MiniLyrics** (desktop app)
     - **Lyrics Editor** apps

## 🎯 Roadmap

Các tính năng có thể thêm sau:

-    [ ] UI để thêm/chỉnh sửa synced lyrics
-    [ ] Tự động tạo timestamp từ audio
-    [ ] Import/Export LRC files
-    [ ] Tìm kiếm synced lyrics từ API
-    [ ] Lyrics editor với timeline

## 💡 Tips

1. **Format chính xác**: Đảm bảo format `[mm:ss.xx]` đúng chuẩn
2. **Timing chuẩn**: Test kỹ timing để lyrics hiển thị đúng lúc
3. **Dòng ngắn**: Chia lời thành các dòng ngắn để dễ đọc
4. **Backup**: Lưu lại lyrics cũ trước khi thêm synced lyrics

## 🐛 Troubleshooting

**Không thấy nút Karaoke?**

-    Check xem đã load file `synced-lyrics.js` chưa
-    Xem console có lỗi gì không

**Lyrics không sync?**

-    Kiểm tra format LRC có đúng không
-    Xem timestamp có chính xác không
-    Check audio player có play được không

**Click dòng lời không nhảy?**

-    Đảm bảo audio đã load xong
-    Check permissions của browser

---

Enjoy your Karaoke experience! 🎤🎶
