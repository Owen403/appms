const mysql = require("mysql2/promise");

async function checkMySQLStatus() {
	console.log("🔍 Đang kiểm tra trạng thái MySQL...");

	// Kiểm tra các cổng MySQL phổ biến
	const ports = [3306, 3307, 3308];

	for (const port of ports) {
		try {
			console.log(`\n📡 Thử kết nối MySQL tại localhost:${port}...`);

			const connection = await mysql.createConnection({
				host: "localhost",
				port: port,
				user: "root",
				password: "1234",
				connectTimeout: 5000,
			});

			console.log(`✅ Kết nối thành công tại port ${port}!`);

			// Lấy phiên bản MySQL
			const [rows] = await connection.execute("SELECT VERSION() as version");
			console.log(`📋 MySQL Version: ${rows[0].version}`);

			// Liệt kê databases
			const [dbs] = await connection.execute("SHOW DATABASES");
			console.log("📊 Databases có sẵn:");
			dbs.forEach((db) => console.log(`   - ${db.Database}`));

			await connection.end();

			// Cập nhật cấu hình nếu port khác 3306
			if (port !== 3306) {
				console.log(`\n💡 MySQL đang chạy trên port ${port}, không phải 3306 mặc định.`);
				console.log(`Cần cập nhật config/database.js để sử dụng port ${port}`);
			}

			return port;
		} catch (error) {
			console.log(`❌ Không thể kết nối tại port ${port}: ${error.code}`);
		}
	}

	console.log("\n❌ Không tìm thấy MySQL server đang chạy!");
	console.log("\n📝 Hướng dẫn khắc phục:");
	console.log("");
	console.log("🪟 WINDOWS:");
	console.log("1. Khởi động MySQL từ Services:");
	console.log('   - Nhấn Win + R, gõ "services.msc"');
	console.log('   - Tìm "MySQL80" hoặc "MySQL" và Start');
	console.log("");
	console.log("2. Hoặc từ Command Prompt (chạy với quyền Admin):");
	console.log("   net start mysql80");
	console.log("   # hoặc net start mysql");
	console.log("");
	console.log("3. Nếu dùng XAMPP:");
	console.log("   - Mở XAMPP Control Panel");
	console.log('   - Nhấn "Start" bên cạnh MySQL');
	console.log("");
	console.log("4. Nếu dùng WAMP:");
	console.log("   - Khởi động WAMP Server");
	console.log("   - Đảm bảo MySQL service running");
	console.log("");
	console.log("🐧 LINUX/WSL:");
	console.log("sudo service mysql start");
	console.log("# hoặc");
	console.log("sudo systemctl start mysql");
	console.log("");
	console.log("🍎 MACOS:");
	console.log("sudo /usr/local/mysql/support-files/mysql.server start");
	console.log("# hoặc nếu dùng Homebrew:");
	console.log("brew services start mysql");
	console.log("");
	console.log("📦 Nếu chưa cài MySQL:");
	console.log("- Windows: Tải từ https://dev.mysql.com/downloads/mysql/");
	console.log("- XAMPP/WAMP: Đã bao gồm MySQL");
	console.log("- Linux: sudo apt install mysql-server");
	console.log("- macOS: brew install mysql");

	return null;
}

// Chạy kiểm tra
checkMySQLStatus()
	.then((port) => {
		if (port) {
			console.log(`\n🎉 MySQL đã sẵn sàng tại port ${port}! Bạn có thể chạy server bây giờ.`);
			process.exit(0);
		} else {
			process.exit(1);
		}
	})
	.catch((error) => {
		console.error("❌ Lỗi kiểm tra MySQL:", error.message);
		process.exit(1);
	});
