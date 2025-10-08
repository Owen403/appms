# 🎵 Music App - Upload từ URL

## Tính năng mới: Upload nhạc từ URL

Bây giờ bạn có thể upload nhạc từ URL trực tiếp mà không cần download về máy trước!

### 🌐 Cách sử dụng

#### 1. Chọn phương thức Upload từ URL

-    Vào tab "Upload nhạc"
-    Chọn tab "Từ URL" (thay vì "Upload file")

#### 2. Nhập thông tin

-    **URL nhạc**: Nhập link trực tiếp đến file nhạc
     -    Ví dụ: `https://example.com/song.mp3`
     -    Hỗ trợ: MP3, WAV, OGG, M4A
-    **Tên bài hát**: Tùy chọn (có thể để trống nếu bật auto-extract)
-    **Nghệ sĩ**: Tùy chọn (có thể để trống nếu bật auto-extract)
-    **Lời bài hát**: Tùy chọn (có thể để trống để tự động tìm)

#### 3. Tự động trích xuất

-    ✅ Bật "Tự động trích xuất thông tin" để app tự động:
     -    Lấy tên bài hát từ metadata
     -    Lấy nghệ sĩ từ metadata
     -    Tìm lời bài hát online
     -    Đọc thông tin album, năm, thể loại

#### 4. Download và Upload

-    Nhấn "Download và upload"
-    App sẽ:
     1.   📥 Download file từ URL
     2.   🔍 Trích xuất metadata
     3.   🎵 Tìm lời bài hát
     4.   💾 Lưu vào database

### 🎯 Các loại URL được hỗ trợ

#### ✅ URL trực tiếp đến file

```
https://example.com/music/song.mp3
http://server.com/audio/track.wav
https://cdn.example.com/files/audio.m4a
```

#### ✅ URL với parameters

```
https://example.com/download?file=song.mp3&token=abc123
https://api.example.com/stream/12345.mp3?auth=token
```

#### ❌ URL không hỗ trợ

-    URL YouTube, Spotify (cần API riêng)
-    URL streaming live
-    URL cần authentication phức tạp
-    URL redirect nhiều lần

### 🔧 Tính năng nâng cao

#### Progress tracking

-    Hiển thị tiến độ download real-time
-    Thông báo kích thước file
-    Ước tính thời gian còn lại

#### Auto validation

-    Kiểm tra URL hợp lệ
-    Validate content-type
-    Giới hạn kích thước file (50MB)
-    Timeout protection (30s)

#### Error handling

-    Retry logic cho connection lỗi
-    Graceful handling cho file lỗi
-    Cleanup automatic cho failed downloads

### 📊 Thông tin được trích xuất

Từ file downloaded:

-    **Metadata**: Tên, nghệ sĩ, album, năm, thể loại
-    **Technical**: Thời lượng, bitrate, kích thước
-    **Lyrics**: Từ ID3 tags hoặc tìm online

### 🛡️ Bảo mật và Giới hạn

#### Giới hạn kỹ thuật:

-    **Kích thước tối đa**: 50MB per file
-    **Timeout**: 30 giây cho download
-    **Content-Type**: Chỉ chấp nhận audio files
-    **Protocol**: HTTP và HTTPS

#### Bảo mật:

-    Không lưu trữ URL gốc vào database
-    Tự động xóa file nếu download fail
-    Validate content before processing
-    No external script execution

### 🚀 Tips sử dụng hiệu quả

#### Để có kết quả tốt nhất:

1. **URL chính xác**: Đảm bảo URL trỏ đúng file nhạc
2. **Kết nối ổn định**: Internet tốt để download không bị lỗi
3. **File chất lượng**: File có metadata càng đầy đủ càng tốt
4. **Bật auto-extract**: Để app tự động lấy thông tin

#### Xử lý lỗi:

-    **Timeout**: Thử lại với URL khác hoặc check internet
-    **File too large**: Tìm version nhẹ hơn
-    **Invalid URL**: Kiểm tra URL có đúng format không
-    **No metadata**: Nhập thông tin thủ công

### 🔮 Tính năng sắp tới

-    [ ] **Batch URL upload**: Upload nhiều URL cùng lúc
-    [ ] **URL playlist**: Import từ M3U, PLS playlists
-    [ ] **Cloud integration**: Google Drive, Dropbox links
-    [ ] **YouTube support**: Với YouTube API
-    [ ] **Resume download**: Tiếp tục download bị gián đoạn
-    [ ] **Quality selection**: Chọn quality khi có nhiều options

### 🆚 So sánh Upload File vs URL

| Tính năng  | Upload File          | Upload URL            |
| ---------- | -------------------- | --------------------- |
| Tốc độ     | ⚡ Nhanh             | 🐌 Phụ thuộc internet |
| Tiện lợi   | 📁 Cần có file sẵn   | 🌐 Chỉ cần URL        |
| Kích thước | 💾 Không giới hạn    | 📊 Giới hạn 50MB      |
| Offline    | ✅ Hoạt động offline | ❌ Cần internet       |
| Metadata   | 🎵 Từ file local     | 🎵 Từ file + online   |

### 🎵 Ví dụ thực tế

#### Upload bài nhạc miễn phí:

```
URL: https://freemusicarchive.org/file/music/song.mp3
Tên: [để trống - auto extract]
Nghệ sĩ: [để trống - auto extract]
Auto-extract: ✅ Bật
```

#### Upload với thông tin sẵn:

```
URL: https://example.com/unknown-file.mp3
Tên: Tên Bài Hát Đẹp
Nghệ sĩ: Nghệ Sĩ Yêu Thích
Auto-extract: ✅ Bật (để tìm lời)
```

Chúc bạn trải nghiệm tuyệt vời với tính năng upload từ URL! 🎉
