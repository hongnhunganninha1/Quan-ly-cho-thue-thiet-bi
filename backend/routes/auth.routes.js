// API đăng nhập, lấy thông tin người đang đăng nhập, đổi mật khẩu.
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const { requireLogin, setFileCookie, clearFileCookie } = require("../middleware/auth");

const router = express.Router();

const MAX_FAILED = 5; // sai mật khẩu 5 lần liên tiếp thì tạm khoá
const LOCK_MINUTES = 15; // thời gian tạm khoá

// Thông tin người dùng gửi về cho frontend (không bao giờ gửi mật khẩu)
function toUserDto(u) {
  return {
    id: u.id,
    email: u.email, // tên đăng nhập = email công ty của nhân viên
    name: u.full_name,
    role: u.role, // ADMIN | STAFF
    roleName: u.role_name, // Quản lý | Nhân viên
    mustChangePassword: Boolean(u.must_change_password),
    avatarUrl: u.avatar_url || null, // ảnh đại diện (null thì hiện chữ cái đầu của tên)
  };
}

// POST /api/auth/login  { email, password, remember } – đăng nhập bằng email công ty cấp cho nhân viên
router.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");
  if (!email || !password) throw new HttpError(400, "Vui lòng nhập email và mật khẩu.");

  const [rows] = await pool.query(
    `SELECT u.*, e.email, e.full_name, e.avatar_url, e.status AS employee_status, r.code AS role, r.name AS role_name,
            GREATEST(0, CEIL(TIMESTAMPDIFF(SECOND, NOW(), u.locked_until) / 60)) AS minutes_left
       FROM users u
       JOIN employees e ON e.id = u.employee_id
       JOIN roles r     ON r.id = u.role_id
      WHERE e.email = ?`,
    [email]
  );
  const user = rows[0];
  const WRONG = "Email hoặc mật khẩu không đúng!";
  if (!user) throw new HttpError(401, WRONG);

  if (user.status === "LOCKED" || user.employee_status !== "WORKING") {
    throw new HttpError(403, "Tài khoản đã bị khoá. Vui lòng liên hệ Quản lý.");
  }
  if (user.minutes_left > 0) {
    throw new HttpError(403, `Tài khoản đang bị tạm khoá do nhập sai mật khẩu nhiều lần. Vui lòng thử lại sau ${user.minutes_left} phút.`);
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    const failed = user.failed_login_count + 1;
    if (failed >= MAX_FAILED) {
      await pool.query(
        "UPDATE users SET failed_login_count = 0, locked_until = NOW() + INTERVAL ? MINUTE WHERE id = ?",
        [LOCK_MINUTES, user.id]
      );
      throw new HttpError(403, `Bạn đã nhập sai ${MAX_FAILED} lần. Tài khoản bị tạm khoá ${LOCK_MINUTES} phút.`);
    }
    await pool.query("UPDATE users SET failed_login_count = ? WHERE id = ?", [failed, user.id]);
    throw new HttpError(401, `${WRONG} (còn ${MAX_FAILED - failed} lần thử)`);
  }

  await pool.query(
    "UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?",
    [user.id]
  );

  // "Ghi nhớ đăng nhập": token sống 7 ngày, không thì 8 tiếng (một ca làm việc)
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: req.body?.remember ? "7d" : "8h",
  });

  setFileCookie(res, token);
  res.json({ token, user: toUserDto(user) });
});

// POST /api/auth/logout – xoá cookie xem file (token đăng nhập do trình duyệt tự xoá)
router.post("/logout", (req, res) => {
  clearFileCookie(res);
  res.json({ message: "Đã đăng xuất." });
});

// GET /api/auth/me – lấy lại thông tin người đang đăng nhập (khi tải lại trang)
router.get("/me", requireLogin, (req, res) => {
  setFileCookie(res, req.token); // phiên "Ghi nhớ đăng nhập" mở lại trình duyệt vẫn xem được file
  res.json({ user: toUserDto(req.user) });
});

// POST /api/auth/change-password  { currentPassword, newPassword }
router.post("/change-password", requireLogin, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) throw new HttpError(400, "Vui lòng nhập đủ thông tin.");
  // Cùng điều kiện với form đổi mật khẩu ở frontend
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw new HttpError(400, "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.");
  }
  if (newPassword === currentPassword) throw new HttpError(400, "Mật khẩu mới phải khác mật khẩu hiện tại.");

  const [rows] = await pool.query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
  const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!ok) throw new HttpError(400, "Mật khẩu hiện tại không đúng.");

  const hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    "UPDATE users SET password_hash = ?, must_change_password = FALSE, password_changed_at = NOW() WHERE id = ?",
    [hash, req.user.id]
  );
  res.json({ message: "Đổi mật khẩu thành công." });
});

module.exports = router;
