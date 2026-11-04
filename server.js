// Điểm khởi động backend: đọc cấu hình .env, khai báo các API rồi chạy server.
require("dotenv").config({ quiet: true });
const path = require("path");
const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const { requireLogin, requireRole } = require("./middleware/auth");
const errorHandler = require("./middleware/errorHandler");
const ensureSchema = require("./utils/ensureSchema");

if (!process.env.JWT_SECRET) {
  console.error("Thiếu JWT_SECRET trong file .env (xem file .env.example).");
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());

// File giấy tờ thiết bị đã tải lên (backend/uploads/...)
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({ message: "Backend KLTN đang hoạt động!" });
});

// Không cần đăng nhập
app.use("/api/auth", require("./routes/auth.routes"));

// Từ đây trở xuống bắt buộc đăng nhập
app.use("/api", requireLogin);
app.use("/api/profile", require("./routes/profile.routes")); // hồ sơ cá nhân: ai cũng dùng được
app.use("/api/notifications", require("./routes/notification.routes"));
app.use("/api/dashboard", require("./routes/dashboard.routes"));
app.use("/api/lookups", require("./routes/lookup.routes"));

// Người dùng: chỉ Quản lý
app.use("/api/employees", requireRole("ADMIN"), require("./routes/employee.routes"));
app.use("/api/users", requireRole("ADMIN"), require("./routes/user.routes"));

// Danh mục
app.use("/api/customers", require("./routes/customer.routes"));
// Bãi máy, loại, hãng: nhân viên chỉ được xem (để chọn khi nhập thiết bị), thêm / sửa / xoá chỉ Quản lý
const adminWrite = (req, res, next) => (req.method === "GET" ? next() : requireRole("ADMIN")(req, res, next));
app.use("/api/warehouses", adminWrite, require("./routes/warehouse.routes"));
app.use("/api/categories", adminWrite, require("./routes/category.routes"));
app.use("/api/brands", adminWrite, require("./routes/brand.routes"));

// Thiết bị
app.use("/api/equipments", require("./routes/equipment.routes"));

// Cho thuê
app.use("/api/contracts", require("./routes/contract.routes"));
app.use("/api/handovers", require("./routes/handover.routes"));
app.use("/api/returns", require("./routes/return.routes"));
app.use("/api/settlements", require("./routes/settlement.routes"));

// Báo cáo - Thống kê
app.use("/api/reports", require("./routes/report.routes"));

// Gọi sai đường dẫn API
app.use("/api", (req, res) => {
  res.status(404).json({ message: "Không tìm thấy API." });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5000;

// Thử kết nối MySQL trước, báo lỗi rõ ràng nếu sai thông tin trong .env
pool
  .query("SELECT 1")
  .then(() => ensureSchema()) // CSDL tạo từ bản SQL cũ thì tự thêm các cột còn thiếu
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Đã kết nối MySQL (database: ${process.env.DB_NAME || "heavy_rental"})`);
      console.log(`Server đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Không kết nối được MySQL hoặc lỗi CSDL:", err.message);
    console.error("Kiểm tra MySQL đã bật chưa và thông tin DB_... trong file .env.");
    process.exit(1);
  });
