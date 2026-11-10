// API Hồ sơ người dùng: mỗi người tự xem hồ sơ của mình, tự sửa số điện thoại, email, địa chỉ
// và đổi ảnh đại diện. Các thông tin khác (họ tên, CCCD, phòng ban, chức vụ…) do Quản lý cập nhật.
const express = require("express");
const path = require("path");
const multer = require("multer");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const { uploadDir, publishUpload, removeStored } = require("../utils/storage");
const { pick, maxLength, matches } = require("../utils/validate");

const router = express.Router();

// ----- Ảnh đại diện: thư mục backend/uploads/avatars -----
const AVATAR_DIR = uploadDir("avatars");
const AVATAR_EXT = [".jpg", ".jpeg", ".png", ".webp"];
const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: AVATAR_DIR,
    filename: (req, file, cb) => {
      cb(null, `nv${req.user.employee_id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // tối đa 5 MB
  fileFilter: (req, file, cb) => {
    const ok = AVATAR_EXT.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new HttpError(400, "Ảnh đại diện chỉ nhận file JPG, PNG hoặc WEBP."), ok);
  },
});

function removeAvatar(url) {
  removeStored(url);
}

// GET /api/profile – hồ sơ của người đang đăng nhập
router.get("/", async (req, res) => {
  const [[profile]] = await pool.query(
    `SELECT e.id AS employee_id, e.code, e.full_name, e.gender, e.date_of_birth, e.id_number, e.phone, e.email, e.address,
            e.position, e.hire_date, e.avatar_url, d.name AS department_name,
            u.last_login_at, u.created_at AS account_created_at, r.name AS role_name
       FROM users u
       JOIN employees e   ON e.id = u.employee_id
       JOIN departments d ON d.id = e.department_id
       JOIN roles r       ON r.id = u.role_id
      WHERE u.id = ?`,
    [req.user.id]
  );
  res.json(profile);
});

// PUT /api/profile { phone, email, address } – chỉ sửa thông tin liên hệ
router.put("/", async (req, res) => {
  const data = pick(req.body, ["phone", "address"]); // email do công ty cấp (là tên đăng nhập) nên không tự sửa
  maxLength(data, { email: ["Email", 100], address: ["Địa chỉ", 255] });
  matches(data.phone, "phone", "Số điện thoại phải gồm 10–11 chữ số và bắt đầu bằng 0.");
  matches(data.email, "email", "Email không đúng định dạng.");
  await pool.query("UPDATE employees SET ? WHERE id = ?", [data, req.user.employee_id]);
  res.json({ message: "Đã cập nhật thông tin cá nhân." });
});

// POST /api/profile/avatar (multipart/form-data: avatar) – đổi ảnh đại diện
router.post("/avatar", uploadAvatar.single("avatar"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "Vui lòng chọn ảnh.");
  const [[old]] = await pool.query("SELECT avatar_url FROM employees WHERE id = ?", [req.user.employee_id]);
  const avatarUrl = await publishUpload(req.file, "avatars");
  await pool.query("UPDATE employees SET avatar_url = ? WHERE id = ?", [avatarUrl, req.user.employee_id]);
  removeAvatar(old?.avatar_url); // xoá ảnh cũ
  res.json({ avatar_url: avatarUrl, message: "Đã đổi ảnh đại diện." });
});

// DELETE /api/profile/avatar – bỏ ảnh đại diện (hiện chữ cái đầu của tên)
router.delete("/avatar", async (req, res) => {
  const [[old]] = await pool.query("SELECT avatar_url FROM employees WHERE id = ?", [req.user.employee_id]);
  await pool.query("UPDATE employees SET avatar_url = NULL WHERE id = ?", [req.user.employee_id]);
  removeAvatar(old?.avatar_url);
  res.json({ message: "Đã xoá ảnh đại diện." });
});

module.exports = router;
