// Kết nối MySQL dùng chung cho toàn bộ backend.
// Dùng "pool" để nhiều yêu cầu cùng lúc không phải mở kết nối mới mỗi lần.
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "heavy_rental",
  charset: "utf8mb4",
  connectionLimit: 10,
  decimalNumbers: true, // cột DECIMAL trả về số, không trả về chuỗi
  dateStrings: true, // ngày giờ trả về nguyên dạng "YYYY-MM-DD HH:mm:ss", tránh lệch múi giờ
});

module.exports = pool;
