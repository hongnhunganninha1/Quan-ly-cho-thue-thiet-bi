// API Quản lý khách hàng (bảng customers)
const express = require("express");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const nextCode = require("../utils/nextCode");
const assertNoDuplicate = require("../utils/duplicate");
const { squeeze, pick, required, maxLength, matches, parseId } = require("../utils/validate");

const { requireRole } = require("../middleware/auth");

const router = express.Router();

const FIELDS = [
  "customer_type", "name", "id_number", "representative", "representative_title",
  "phone", "email", "address", "bank_account", "bank_name", "note",
];

// Loại khách hàng tự suy ra từ MST / CCCD (form không còn ô chọn loại):
// 12 chữ số → CCCD → cá nhân; 10 số hoặc 10 số-3 số → mã số thuế → doanh nghiệp.
const TAX_CODE = /^\d{10}(-\d{3})?$/;
const CITIZEN_ID = /^\d{12}$/;

// Kiểm tra dữ liệu form khách hàng, trả về dữ liệu đã làm sạch
function validateCustomer(body) {
  const data = pick(body, FIELDS);
  required(data, { name: "tên khách hàng", id_number: "mã số thuế / số CCCD", phone: "số điện thoại" });
  squeeze(data, ["name", "representative"]);

  const idNumber = String(data.id_number).trim();
  data.id_number = idNumber;
  if (CITIZEN_ID.test(idNumber)) data.customer_type = "INDIVIDUAL";
  else if (TAX_CODE.test(idNumber)) data.customer_type = "COMPANY";
  else {
    throw new HttpError(400, "Mã số thuế gồm 10 chữ số (chi nhánh: 10 số-3 số); số CCCD gồm 12 chữ số.", "id_number");
  }

  // Doanh nghiệp: phải nhập người đại diện. Cá nhân: người đại diện chính là khách hàng.
  if (data.customer_type === "COMPANY") {
    required(data, { representative: "người đại diện" });
  } else {
    data.representative = data.name;
    data.representative_title = null;
  }

  maxLength(data, {
    name: ["Tên khách hàng", 200], representative: ["Người đại diện", 50],
    representative_title: ["Chức vụ", 50], email: ["Email", 100], address: ["Địa chỉ", 255],
    bank_account: ["Số tài khoản", 20], bank_name: ["Ngân hàng", 100],
  });
  matches(data.phone, "phone", "Số điện thoại phải gồm 10–11 chữ số và bắt đầu bằng 0.");
  matches(data.email, "email", "Email không đúng định dạng.");
  return data;
}

// MST / CCCD không được trùng với khách hàng khác
function assertUniqueCustomer(data, id = 0) {
  return assertNoDuplicate("customers", [{
    column: "id_number",
    value: data.id_number,
    label: data.customer_type === "COMPANY" ? "Mã số thuế" : "Số CCCD",
    describe: (c) => `khách hàng ${c.code} – ${c.name}`,
  }], id);
}

// GET /api/customers – danh sách khách hàng kèm số hợp đồng đã ký
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.*, e.full_name AS created_by_name,
            (SELECT COUNT(*) FROM rental_contracts rc WHERE rc.customer_id = c.id) AS contract_count
       FROM customers c
       LEFT JOIN users u     ON u.id = c.created_by
       LEFT JOIN employees e ON e.id = u.employee_id
      ORDER BY c.code ASC`
  );
  res.json(rows);
});

// POST /api/customers – thêm khách hàng, mã tự sinh KH0001, KH0002…
router.post("/", async (req, res) => {
  const data = validateCustomer(req.body);
  await assertUniqueCustomer(data);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    data.code = await nextCode(conn, "customers", "code", "KH", 4);
    data.created_by = req.user.id;
    const [result] = await conn.query("INSERT INTO customers SET ?", [data]);
    await conn.commit();
    res.status(201).json({ id: result.insertId, code: data.code, message: `Đã thêm khách hàng ${data.code}.` });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// PUT /api/customers/:id – sửa thông tin khách hàng (không sửa mã)
router.put("/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const data = validateCustomer(req.body);
  await assertUniqueCustomer(data, id);
  const [result] = await pool.query("UPDATE customers SET ? WHERE id = ?", [data, id]);
  if (result.affectedRows === 0) throw new HttpError(404, "Không tìm thấy khách hàng.");
  res.json({ message: "Đã cập nhật thông tin khách hàng." });
});

// DELETE /api/customers/:id – chỉ xoá được khách hàng chưa có hợp đồng
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const id = parseId(req.params.id);
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM rental_contracts WHERE customer_id = ?",
    [id]
  );
  if (total > 0) {
    throw new HttpError(409, `Khách hàng đã có ${total} hợp đồng nên không thể xoá.`);
  }
  const [result] = await pool.query("DELETE FROM customers WHERE id = ?", [id]);
  if (result.affectedRows === 0) throw new HttpError(404, "Không tìm thấy khách hàng.");
  res.json({ message: "Đã xoá khách hàng." });
});

// PATCH /api/customers/:id/status { status: "ACTIVE" | "STOPPED" } – Quản lý ngừng / mở lại giao dịch với khách hàng.
// Khách ngừng giao dịch vẫn giữ lịch sử thuê, chỉ không lập được hợp đồng mới.
router.patch("/:id/status", requireRole("ADMIN"), async (req, res) => {
  const id = parseId(req.params.id);
  const status = req.body?.status;
  if (!["ACTIVE", "STOPPED"].includes(status)) throw new HttpError(400, "Trạng thái không hợp lệ.");
  if (status === "STOPPED") {
    const [[{ open }]] = await pool.query(
      "SELECT COUNT(*) AS open FROM rental_contracts WHERE customer_id = ? AND status IN ('PENDING_APPROVAL','APPROVED','ACTIVE','COMPLETED')",
      [id]
    );
    if (open > 0) throw new HttpError(409, `Khách hàng còn ${open} hợp đồng đang xử lý, chưa ngừng giao dịch được.`);
  }
  const [r] = await pool.query("UPDATE customers SET status = ? WHERE id = ?", [status, id]);
  if (r.affectedRows === 0) throw new HttpError(404, "Không tìm thấy khách hàng.");
  res.json({ message: status === "STOPPED" ? "Đã ngừng giao dịch với khách hàng." : "Đã mở lại giao dịch với khách hàng." });
});

module.exports = router;
