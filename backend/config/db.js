// Kết nối MySQL dùng chung cho toàn bộ backend.
// Dùng "pool" để nhiều yêu cầu cùng lúc không phải mở kết nối mới mỗi lần.
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "kltn_1",
  charset: "utf8mb4",
  connectionLimit: 10,
  decimalNumbers: true, // cột DECIMAL trả về số, không trả về chuỗi
  dateStrings: true, // ngày giờ trả về nguyên dạng "YYYY-MM-DD HH:mm:ss", tránh lệch múi giờ
  // Chỉ dùng khi chạy trên máy chủ (deploy): CSDL trên mạng bắt buộc kết nối mã hoá SSL. Chạy ở máy cá nhân thì bỏ qua.
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

// Chỉ dùng khi deploy: máy chủ CSDL trên mạng thường để giờ UTC, đặt lại giờ Việt Nam (DB_TIME_ZONE=+07:00)
// để NOW(), CURDATE() (hạn trả máy, hạn cọc, thông báo…) tính đúng ngày. Ở máy cá nhân không cần khai báo.
if (process.env.DB_TIME_ZONE) {
  pool.pool.on("connection", (conn) => conn.query("SET time_zone = ?", [process.env.DB_TIME_ZONE]));
}

module.exports = pool;
