// Cấu hình MySQL Database
const mysql = require("mysql2/promise");

const dbConfig = {
	host: "localhost",
	user: "root",
	password: "1234",
	database: "appmusic",
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
	acquireTimeout: 60000,
	timeout: 60000,
};

// Tạo connection pool
let pool;

async function initDatabase() {
	try {
		// Tạo pool connection
		pool = mysql.createPool(dbConfig);

		// Test connection
		const connection = await pool.getConnection();
		console.log("✓ Kết nối MySQL thành công!");

		// Tạo bảng songs nếu chưa tồn tại
		await connection.execute(`
            CREATE TABLE IF NOT EXISTS songs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                artist VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                lyrics TEXT,
                duration INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_created_at (created_at),
                INDEX idx_artist (artist),
                INDEX idx_title (title)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

		console.log("✓ Bảng songs đã được tạo/kiểm tra thành công!");
		connection.release();

		return pool;
	} catch (error) {
		console.error("✗ Lỗi kết nối MySQL:", error.message);
		console.error("Vui lòng kiểm tra:");
		console.error("- MySQL server đã được khởi động chưa");
		console.error('- Database "appmusic" đã tồn tại chưa');
		console.error("- Username/password có đúng không");
		throw error;
	}
}

// Function để tạo database nếu chưa tồn tại
async function createDatabaseIfNotExists() {
	try {
		const tempConfig = { ...dbConfig };
		delete tempConfig.database; // Kết nối mà không chỉ định database

		const tempPool = mysql.createPool(tempConfig);
		const connection = await tempPool.getConnection();

		// Tạo database nếu chưa tồn tại
		await connection.execute(
			`CREATE DATABASE IF NOT EXISTS ${dbConfig.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
		);
		console.log('✓ Database "appmusic" đã được tạo/kiểm tra thành công!');

		connection.release();
		await tempPool.end();
	} catch (error) {
		console.error("✗ Lỗi tạo database:", error.message);
		throw error;
	}
}

module.exports = {
	initDatabase,
	createDatabaseIfNotExists,
	getPool: () => pool,
};
