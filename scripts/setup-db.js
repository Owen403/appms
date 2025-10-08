const mysql = require("mysql2/promise");

async function setupDatabase() {
	console.log("🔧 Đang kiểm tra và thiết lập MySQL database...");

	try {
		// Kết nối mà không chỉ định database để tạo database
		const connection = await mysql.createConnection({
			host: "localhost",
			user: "root",
			password: "1234",
		});

		console.log("✅ Kết nối MySQL thành công!");

		// Tạo database nếu chưa tồn tại
		await connection.execute(
			`CREATE DATABASE IF NOT EXISTS appmusic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
		);
		console.log('✅ Database "appmusic" đã được tạo/kiểm tra!');

		// Đóng kết nối tạm
		await connection.end();

		// Kết nối lại với database appmusic
		const appConnection = await mysql.createConnection({
			host: "localhost",
			user: "root",
			password: "1234",
			database: "appmusic",
		});

		// Tạo bảng songs
		await appConnection.execute(`
            CREATE TABLE IF NOT EXISTS songs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                lyrics TEXT,
                duration INT DEFAULT NULL,
                file_size BIGINT DEFAULT NULL,
                file_type VARCHAR(50) DEFAULT NULL,
                play_count INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_created_at (created_at),
                INDEX idx_artist (artist),
                INDEX idx_title (title)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

		console.log('✅ Bảng "songs" đã được tạo/kiểm tra!');

		// Kiểm tra cấu trúc bảng
		const [rows] = await appConnection.execute("DESCRIBE songs");
		console.log("📊 Cấu trúc bảng songs:");
		console.table(rows);

		await appConnection.end();
		console.log("🎉 Setup database hoàn tất! Bạn có thể chạy server bây giờ.");
	} catch (error) {
		console.error("❌ Lỗi setup database:", error.message);
		console.log("\n💡 Hướng dẫn khắc phục:");
		console.log("1. Kiểm tra MySQL server đang chạy");
		console.log("2. Kiểm tra username/password MySQL");
		console.log("3. Chạy MySQL với quyền admin nếu cần");
		process.exit(1);
	}
}

setupDatabase();
