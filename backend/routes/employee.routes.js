// API Quản lý nhân viên (bảng employees) – chỉ Quản lý dùng
const express = require("express");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const nextCode = require("../utils/nextCode");
const withTransaction = require("../utils/transaction");
const { pick, required, maxLength, matches, parseId, validDate } = require("../utils/validate");

const router = express.Router();

const FIELDS = ["full_name", "gender", "date_of_birth", "id_number", "phone", "email", "address", "department_id", "position", "hire_date", "status"];

function validateEmployee(body) {
  const data = pick(body, FIELDS);
  required(data, { full_name: "họ tên", department_id: "phòng ban" });
  maxLength(data, { full_name: ["Họ tên", 50], email: ["Email", 100], address: ["Địa chỉ", 255], position: ["Chức vụ", 50] });
  if (data.gender && !["MALE", "FEMALE", "OTHER"].includes(data.gender)) throw new HttpError(400, "Giới tính không hợp lệ.");
  data.status = data.status || "WORKING";
  if (!["WORKING", "RESIGNED"].includes(data.status)) throw new HttpError(400, "Trạng thái không hợp lệ.");
  matches(data.phone, "phone", "Số điện thoại phải gồm 10–11 chữ số và bắt đầu bằng 0.");
  matches(data.email, "email", "Email không đúng định dạng.");
  matches(data.id_number, "idNumber", "Số CCCD phải gồm 12 chữ số.");
  validDate(data, { date_of_birth: "Ngày sinh", hire_date: "Ngày vào làm" }, { notFuture: ["date_of_birth"] });
  if (data.date_of_birth && data.hire_date && data.hire_date < data.date_of_birth) {
    throw new HttpError(400, "Ngày vào làm không được trước ngày sinh.");
  }
  return data;
}

// GET /api/employees – danh sách nhân viên kèm phòng ban và tài khoản (nếu có)
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT e.*, d.name AS department_name, u.id AS user_id, u.status AS account_status
       FROM employees e
       JOIN departments d ON d.id = e.department_id
       LEFT JOIN users u  ON u.employee_id = e.id
      ORDER BY e.code`
  );
  res.json(rows);
});

// POST /api/employees – mã tự sinh NV0001, NV0002…
router.post("/", async (req, res) => {
  const data = validateEmployee(req.body);
  const result = await withTransaction(async (conn) => {
    data.code = await nextCode(conn, "employees", "code", "NV", 4);
    const [r] = await conn.query("INSERT INTO employees SET ?", [data]);
    return { id: r.insertId, code: data.code };
  });
  res.status(201).json({ ...result, message: `Đã thêm nhân viên ${result.code}.` });
});

// PUT /api/employees/:id – nhân viên chuyển sang "Đã nghỉ việc" thì tài khoản bị khoá luôn
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const data = validateEmployee(req.body);
  // Nhân viên đã có tài khoản thì phải giữ email công ty (email là tên đăng nhập)
  const [[acc]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE employee_id = ?", [id]);
  if (acc.total > 0 && !data.email) throw new HttpError(400, "Nhân viên đã có tài khoản, email công ty dùng để đăng nhập nên không được để trống.");
  await withTransaction(async (conn) => {
    const [r] = await conn.query("UPDATE employees SET ? WHERE id = ?", [data, id]);
    if (r.affectedRows === 0) throw new HttpError(404, "Không tìm thấy nhân viên.");
    if (data.status === "RESIGNED") {
      if (id === req.user.employee_id) throw new HttpError(400, "Bạn không thể chuyển chính mình sang nghỉ việc.");
      await conn.query("UPDATE users SET status = 'LOCKED' WHERE employee_id = ?", [id]);
    }
  });
  res.json({ message: data.status === "RESIGNED" ? "Đã cập nhật. Tài khoản của nhân viên này (nếu có) đã bị khoá." : "Đã cập nhật nhân viên." });
});

// DELETE /api/employees/:id – chỉ xoá nhân viên chưa có tài khoản
router.delete("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const [[acc]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE employee_id = ?", [id]);
  if (acc.total > 0) {
    throw new HttpError(409, "Nhân viên đã có tài khoản nên không thể xoá. Hãy chuyển sang trạng thái Đã nghỉ việc.");
  }
  const [r] = await pool.query("DELETE FROM employees WHERE id = ?", [id]);
  if (r.affectedRows === 0) throw new HttpError(404, "Không tìm thấy nhân viên.");
  res.json({ message: "Đã xoá nhân viên." });
});

module.exports = router;
