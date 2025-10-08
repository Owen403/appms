# Music Player App 🎵

Ứng dụng nghe nhạc với Node.js, Express, EJS, TailwindCSS và MySQL.

## Tính năng

-    🎵 Phát nhạc trực tiếp từ server
-    📝 Hiển thị lyrics karaoke theo thời gian thực
-    ✏️ Chỉnh sửa lyrics (thêm/sửa/xóa timestamp)
-    ⏭️ Tự động phát bài tiếp theo
-    📥 Tải nhạc từ YouTube
-    🎨 Giao diện đẹp với TailwindCSS
-    🔄 Auto-reload với nodemon

## Cài đặt

1. Clone repository:

```bash
git clone <repo-url>
cd appmusic
```

2. Cài đặt dependencies:

```bash
npm install
```

3. Cấu hình MySQL:

-    Đảm bảo MySQL đang chạy
-    Cấu hình trong `config/database.js`:

```javascript
const dbConfig = {
	host: "localhost",
	user: "root",
	password: "1234",
	database: "appmusic",
};
```

4. Khởi động server:

```bash
npm run dev
```

Server sẽ chạy tại: http://localhost:3000

## Sử dụng

### Thêm nhạc từ YouTube

1. Truy cập `/add-youtube`
2. Dán URL YouTube
3. Hệ thống sẽ tự động tải và lưu vào database

### Phát nhạc

1. Click vào bài hát trong danh sách
2. Player sẽ tự động phát
3. Lyrics sẽ highlight theo thời gian

### Chỉnh sửa Lyrics

1. Click nút "Sửa" trên bài hát
2. Nhập lyrics theo định dạng LRC hoặc text
3. Lưu lại

## Định dạng Lyrics

**LRC Format (với timestamp):**

```
[00:12.00]Dòng lyrics đầu tiên
[00:18.00]Dòng lyrics thứ hai
```

**Text Format (không timestamp):**

```
Dòng lyrics đầu tiên
Dòng lyrics thứ hai
```

## Cấu trúc thư mục

```
appmusic/
├── config/
│   └── database.js       # Cấu hình MySQL
├── views/
│   ├── index.ejs         # Trang chủ
│   ├── player.ejs        # Trang phát nhạc
│   ├── edit.ejs          # Trang chỉnh sửa lyrics
│   └── add-youtube.ejs   # Trang thêm từ YouTube
├── public/
│   └── styles.css        # CSS tùy chỉnh
├── uploads/              # Thư mục lưu file nhạc
├── app.js                # Server chính
├── package.json
└── README.md
```

## Công nghệ sử dụng

-    **Backend:** Node.js, Express
-    **View Engine:** EJS
-    **Database:** MySQL (mysql2)
-    **UI:** TailwindCSS
-    **YouTube Download:** ytdl-core
-    **Dev Tool:** nodemon

## Scripts

```bash
npm start       # Chạy production
npm run dev     # Chạy development với nodemon
```

## License

MIT
