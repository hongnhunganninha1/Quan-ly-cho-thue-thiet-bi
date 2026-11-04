// API Quyết toán hợp đồng (bảng settlements) và ghi nhận thanh toán
const express = require("express");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");
const withTransaction = require("../utils/transaction");
const { settlementTotals, paymentStatus } = require("../utils/calc");
const { pick, nonNegativeNumber, maxLength, parseId, toDateTime } = require("../utils/validate");

const router = express.Router();

// Tính số liệu quyết toán của một hợp đồng đã thu hồi đủ máy
async function compute(conn, contractId, lock = false) {
  const [[c]] = await conn.query(
    `SELECT rc.*, cu.code AS customer_code, cu.name AS customer_name
       FROM rental_contracts rc JOIN customers cu ON cu.id = rc.customer_id
      WHERE rc.id = ?${lock ? " FOR UPDATE" : ""}`,
    [contractId]
  );
  if (!c) throw new HttpError(404, "Không tìm thấy hợp đồng.");
  if (c.status !== "COMPLETED") throw new HttpError(409, "Hợp đồng chưa thu hồi đủ máy hoặc đã quyết toán.");
  const [returns] = await conn.query(
    `SELECT r.*, e.code, e.name, cd.amount
       FROM equipment_returns r
       JOIN contract_details cd ON cd.id = r.contract_detail_id
       JOIN equipments e        ON e.id = cd.equipment_id
      WHERE cd.contract_id = ? ORDER BY e.code`,
    [contractId]
  );
  return { contract: c, returns, totals: settlementTotals(c, returns) };
}

// GET /api/settlements/pending – hợp đồng đã thu hồi đủ máy, chờ quyết toán
router.get("/pending", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT rc.id, rc.contract_no, rc.start_date, rc.end_date, rc.total_amount, rc.deposit_amount,
            cu.name AS customer_name,
            (SELECT MAX(r.returned_at) FROM equipment_returns r JOIN contract_details cd ON cd.id = r.contract_detail_id
              WHERE cd.contract_id = rc.id) AS last_returned_at
       FROM rental_contracts rc JOIN customers cu ON cu.id = rc.customer_id
      WHERE rc.status = 'COMPLETED' ORDER BY rc.contract_no`
  );
  res.json(rows);
});

// GET /api/settlements – các quyết toán đã lập
router.get("/", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT s.*, rc.contract_no, cu.name AS customer_name, em.full_name AS confirmed_by_name
       FROM settlements s
       JOIN rental_contracts rc ON rc.id = s.contract_id
       JOIN customers cu        ON cu.id = rc.customer_id
       LEFT JOIN users u        ON u.id = s.confirmed_by
       LEFT JOIN employees em   ON em.id = u.employee_id
      ORDER BY rc.contract_no, s.id`
  );
  res.json(rows);
});

// GET /api/settlements/preview/:contractId – bảng tính quyết toán trước khi xác nhận
router.get("/preview/:contractId", async (req, res) => {
  const { contract, returns, totals } = await compute(pool, parseId(req.params.contractId));
  res.json({ contract, returns, totals });
});

// POST /api/settlements { contract_id, paid_amount, note } – xác nhận quyết toán, hợp đồng chuyển "Đã quyết toán"
router.post("/", async (req, res) => {
  const data = pick(req.body, ["contract_id", "paid_amount", "note", "confirmed_at"]);
  const contractId = parseId(data.contract_id);
  // Ngày quyết toán: mặc định là lúc bấm lưu; được nhập ngày thực tế đã quyết toán (không ở tương lai)
  const confirmedAt = data.confirmed_at ? toDateTime(data.confirmed_at, "Thời điểm quyết toán") : null;
  nonNegativeNumber(data, "paid_amount", "Số tiền đã thu / đã hoàn", { integer: true });
  maxLength(data, { note: ["Ghi chú", 255] });
  const paid = data.paid_amount || 0;

  const result = await withTransaction(async (conn) => {
    const { contract, totals, returns } = await compute(conn, contractId, true);
    if (confirmedAt && returns.some((r) => new Date(r.returned_at) > new Date(confirmedAt.replace(" ", "T")))) {
      throw new HttpError(400, "Thời điểm quyết toán phải sau lần thu hồi máy cuối cùng.");
    }
    const limit = Math.abs(totals.amount_due);
    if (paid > limit) throw new HttpError(400, `Số tiền không được vượt quá ${limit.toLocaleString("vi-VN")} đ.`);
    await conn.query("INSERT INTO settlements SET ?", [{
      contract_id: contractId, ...totals, paid_amount: paid,
      payment_status: paymentStatus(totals.amount_due, paid),
      confirmed_by: req.user.id, confirmed_at: confirmedAt || new Date(), note: data.note,
    }]);
    await conn.query("UPDATE rental_contracts SET status = 'SETTLED' WHERE id = ?", [contractId]);
    // Máy "Mới" đã cho thuê xong (đã thu hồi, đã quyết toán) thì chuyển sang "Đã qua sử dụng".
    // Số giờ máy đã được cập nhật theo số giờ lúc thu hồi ngay khi lập phiếu thu hồi.
    const [used] = await conn.query(
      `UPDATE equipments e JOIN contract_details cd ON cd.equipment_id = e.id
          SET e.item_condition = 'USED'
        WHERE cd.contract_id = ? AND e.item_condition = 'NEW'`,
      [contractId]
    );
    return { contract_no: contract.contract_no, newToUsed: used.affectedRows };
  });
  res.status(201).json({
    message: `Đã quyết toán hợp đồng ${result.contract_no}.` +
      (result.newToUsed ? ` ${result.newToUsed} máy mới đã chuyển sang tình trạng "Đã qua sử dụng".` : ""),
  });
});

// PATCH /api/settlements/:id/payment { amount, note } – ghi nhận khách trả thêm / công ty hoàn cọc thêm
router.patch("/:id/payment", async (req, res) => {
  const id = parseId(req.params.id);
  const data = pick(req.body, ["amount", "note"]);
  nonNegativeNumber(data, "amount", "Số tiền", { integer: true });
  if (!data.amount) throw new HttpError(400, "Vui lòng nhập số tiền lớn hơn 0.");
  maxLength(data, { note: ["Ghi chú", 255] });

  const status = await withTransaction(async (conn) => {
    const [[s]] = await conn.query("SELECT * FROM settlements WHERE id = ? FOR UPDATE", [id]);
    if (!s) throw new HttpError(404, "Không tìm thấy quyết toán.");
    const remaining = Math.abs(s.amount_due) - s.paid_amount;
    if (remaining <= 0) throw new HttpError(409, "Quyết toán này đã thanh toán xong.");
    if (data.amount > remaining) throw new HttpError(400, `Số tiền còn lại chỉ là ${remaining.toLocaleString("vi-VN")} đ.`);
    const paid = s.paid_amount + data.amount;
    const status = paymentStatus(s.amount_due, paid);
    await conn.query("UPDATE settlements SET paid_amount = ?, payment_status = ?, note = COALESCE(?, note) WHERE id = ?", [paid, status, data.note, id]);
    return status;
  });
  res.json({ message: status === "PAID" || status === "REFUNDED" ? "Đã ghi nhận. Quyết toán đã thanh toán xong." : "Đã ghi nhận thanh toán." });
});

module.exports = router;
