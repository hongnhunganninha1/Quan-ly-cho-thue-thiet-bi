// Kiểm tra đăng nhập và phân quyền cho các API.
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");

// Bắt buộc đã đăng nhập: đọc token trong header "Authorization: Bearer <token>".
// Mỗi lần gọi đều kiểm tra lại tài khoản trong CSDL, để tài khoản vừa bị khoá
// thì không dùng tiếp được nữa dù token cũ chưa hết hạn.
async function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Bạn chưa đăng nhập.");

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.employee_id, e.email, u.status, u.must_change_password,
            e.full_name, e.avatar_url, e.status AS employee_status, r.code AS role, r.name AS role_name
       FROM users u
       JOIN employees e ON e.id = u.employee_id
       JOIN roles r     ON r.id = u.role_id
      WHERE u.id = ?`,
    [payload.id]
  );
  const user = rows[0];
  if (!user || user.status !== "ACTIVE" || user.employee_status !== "WORKING") {
    throw new HttpError(401, "Tài khoản không còn hoạt động, vui lòng liên hệ Quản lý.");
  }

  req.user = user; // các route phía sau dùng req.user.id, req.user.role
  next();
}

// Chỉ cho phép một số vai trò, ví dụ requireRole("ADMIN")
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, "Bạn không có quyền thực hiện chức năng này.");
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
