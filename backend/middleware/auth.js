// Kiểm tra đăng nhập và phân quyền cho các API.
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");

// Cookie chỉ dùng để xem file trong /uploads (thẻ <img>, link mở file không gửi được header Authorization)
const FILE_COOKIE = "kltn_file_token";
const FILE_COOKIE_OPTIONS = { httpOnly: true, sameSite: "strict", path: "/uploads" };
const setFileCookie = (res, token) => res.cookie(FILE_COOKIE, token, FILE_COOKIE_OPTIONS);
const clearFileCookie = (res) => res.clearCookie(FILE_COOKIE, FILE_COOKIE_OPTIONS);

// Kiểm tra token và lấy tài khoản tương ứng trong CSDL. Mỗi lần gọi đều kiểm tra lại,
// để tài khoản vừa bị khoá hoặc vừa đổi mật khẩu thì token cũ không dùng tiếp được nữa dù chưa hết hạn.
async function userFromToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }

  const [rows] = await pool.query(
    `SELECT u.id, u.employee_id, e.email, u.status, u.must_change_password,
            UNIX_TIMESTAMP(u.password_changed_at) AS password_changed_ts,
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
  // Token cấp trước lần đổi / cấp lại mật khẩu gần nhất thì không còn hiệu lực
  if (user.password_changed_ts && payload.iat < Math.floor(user.password_changed_ts)) {
    throw new HttpError(401, "Mật khẩu đã thay đổi, vui lòng đăng nhập lại.");
  }
  return user;
}

// Bắt buộc đã đăng nhập: đọc token trong header "Authorization: Bearer <token>".
async function requireLogin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Bạn chưa đăng nhập.");

  req.user = await userFromToken(token); // các route phía sau dùng req.user.id, req.user.role
  req.token = token;
  next();
}

// Tài khoản dùng mật khẩu tạm phải đổi mật khẩu rồi mới được gọi các API nghiệp vụ
function requirePasswordChanged(req, res, next) {
  if (req.user.must_change_password) throw new HttpError(403, "Vui lòng đổi mật khẩu trước khi tiếp tục.");
  next();
}

// Xem file đã tải lên: bắt buộc đăng nhập, xác thực bằng cookie
async function requireFileLogin(req, res, next) {
  const token = new RegExp(`(?:^|;\\s*)${FILE_COOKIE}=([^;]+)`).exec(req.headers.cookie || "")?.[1];
  if (!token) throw new HttpError(401, "Bạn chưa đăng nhập.");
  req.user = await userFromToken(token);
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

module.exports = { requireLogin, requirePasswordChanged, requireFileLogin, requireRole, setFileCookie, clearFileCookie };
