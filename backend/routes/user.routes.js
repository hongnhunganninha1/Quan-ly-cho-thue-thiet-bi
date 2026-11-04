// API Quản lý tài khoản (bảng users) – chỉ Quản lý dùng
const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const { pick, required, parseId } = require("../utils/validate");

const router = express.Router();

// Mật khẩu tạm 10 ký tự, đủ chữ hoa, chữ thường, chữ số (nhân viên phải đổi ở lần đăng nhập đầu)
function tempPassword() {
  const pickFrom = (chars) => chars[crypto.randomInt(chars.length)];
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  let p = pickFrom(upper) + pickFrom(lower) + pickFrom(digits);
  for (let i = 0; i < 7; i++) p += pickFrom(upper + lower + digits);
  return p;
}

async function checkRole(roleId) {
  const [[role]] = await pool.query("SELECT id FROM roles WHERE id = ?", [roleId]);
  if (!role) throw new HttpError(400, "Vai trò không hợp lệ.");
}

// GET /api/users – danh sách tài khoản
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, e.email, u.status, u.must_change_password, u.last_login_at, u.locked_until, u.created_at,
            u.role_id, r.name AS role_name, r.code AS role_code,
            e.id AS employee_id, e.code AS employee_code, e.full_name, e.status AS employee_status,
            d.name AS department_name
       FROM users u
       JOIN roles r       ON r.id = u.role_id
       JOIN employees e   ON e.id = u.employee_id
       JOIN departments d ON d.id = e.department_id
      ORDER BY u.id`
  );
  res.json(rows.map((u) => ({ ...u, is_me: u.id === req.user.id })));
});

// GET /api/users/available-employees – nhân viên đang làm việc mà chưa có tài khoản
router.get("/available-employees", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT e.id, e.code, e.full_name, e.email, d.name AS department_name
       FROM employees e
       JOIN departments d ON d.id = e.department_id
      WHERE e.status = 'WORKING' AND NOT EXISTS (SELECT 1 FROM users u WHERE u.employee_id = e.id)
      ORDER BY e.code`
  );
  res.json(rows);
});

// POST /api/users – cấp tài khoản cho nhân viên; tên đăng nhập là email công ty của nhân viên.
// Trả về mật khẩu tạm (chỉ hiện một lần).
router.post("/", async (req, res) => {
  const data = pick(req.body, ["employee_id", "role_id"]);
  required(data, { employee_id: "nhân viên", role_id: "vai trò" });
  await checkRole(data.role_id);

  const [[emp]] = await pool.query("SELECT status, email FROM employees WHERE id = ?", [data.employee_id]);
  if (!emp) throw new HttpError(400, "Nhân viên không tồn tại.");
  if (emp.status !== "WORKING") throw new HttpError(400, "Nhân viên đã nghỉ việc, không cấp tài khoản được.");
  if (!emp.email) throw new HttpError(400, "Nhân viên chưa có email công ty. Hãy cập nhật email ở Quản lý nhân viên trước.");
  const [[has]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE employee_id = ?", [data.employee_id]);
  if (has.total > 0) throw new HttpError(409, "Nhân viên này đã có tài khoản.");

  const password = tempPassword();
  data.password_hash = await bcrypt.hash(password, 10);
  data.must_change_password = true;
  const [r] = await pool.query("INSERT INTO users SET ?", [data]);
  res.status(201).json({
    id: r.insertId,
    message: `Đã cấp tài khoản ${emp.email}.`,
    notice: { title: "Đã cấp tài khoản", lines: [`Email đăng nhập: ${emp.email}`, `Mật khẩu tạm: ${password}`], note: "Hãy ghi lại và gửi cho nhân viên. Mật khẩu chỉ hiện một lần; nhân viên phải đổi mật khẩu ở lần đăng nhập đầu." },
  });
});

// PUT /api/users/:id – đổi vai trò
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const data = pick(req.body, ["role_id"]);
  required(data, { role_id: "vai trò" });
  await checkRole(data.role_id);
  if (id === req.user.id) throw new HttpError(400, "Bạn không thể tự đổi vai trò của chính mình.");
  const [r] = await pool.query("UPDATE users SET role_id = ? WHERE id = ?", [data.role_id, id]);
  if (r.affectedRows === 0) throw new HttpError(404, "Không tìm thấy tài khoản.");
  res.json({ message: "Đã cập nhật vai trò." });
});

// PATCH /api/users/:id/lock – khoá tài khoản
router.patch("/:id/lock", async (req, res) => {
  const id = parseId(req.params.id);
  if (id === req.user.id) throw new HttpError(400, "Bạn không thể tự khoá tài khoản của mình.");
  await pool.query("UPDATE users SET status = 'LOCKED' WHERE id = ?", [id]);
  res.json({ message: "Đã khoá tài khoản." });
});

// PATCH /api/users/:id/unlock – mở khoá (kể cả bị tạm khoá do nhập sai mật khẩu)
router.patch("/:id/unlock", async (req, res) => {
  const id = parseId(req.params.id);
  const [[u]] = await pool.query(
    "SELECT e.status FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = ?",
    [id]
  );
  if (!u) throw new HttpError(404, "Không tìm thấy tài khoản.");
  if (u.status !== "WORKING") throw new HttpError(400, "Nhân viên đã nghỉ việc, không mở khoá được.");
  await pool.query("UPDATE users SET status = 'ACTIVE', failed_login_count = 0, locked_until = NULL WHERE id = ?", [id]);
  res.json({ message: "Đã mở khoá tài khoản." });
});

// POST /api/users/:id/reset-password – cấp lại mật khẩu tạm
router.post("/:id/reset-password", async (req, res) => {
  const id = parseId(req.params.id);
  const password = tempPassword();
  const hash = await bcrypt.hash(password, 10);
  const [r] = await pool.query(
    "UPDATE users SET password_hash = ?, must_change_password = TRUE, failed_login_count = 0, locked_until = NULL WHERE id = ?",
    [hash, id]
  );
  if (r.affectedRows === 0) throw new HttpError(404, "Không tìm thấy tài khoản.");
  const [[u]] = await pool.query("SELECT e.email FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = ?", [id]);
  res.json({
    message: "Đã cấp lại mật khẩu.",
    notice: { title: "Đã cấp lại mật khẩu", lines: [`Email đăng nhập: ${u.email}`, `Mật khẩu tạm: ${password}`], note: "Mật khẩu chỉ hiện một lần; nhân viên phải đổi mật khẩu ở lần đăng nhập tiếp theo." },
  });
});

module.exports = router;
