// API Báo cáo – thống kê. Phần lớn đọc từ các view v_report_... đã tạo sẵn trong CSDL.
const express = require("express");
const pool = require("../config/db");
const HttpError = require("../utils/httpError");

const { requireRole } = require("../middleware/auth");

const router = express.Router();
// Báo cáo kiểm kê thiết bị: ai cũng xem được; các báo cáo còn lại (doanh thu, hiệu suất, hợp đồng, công nợ) chỉ Quản lý
const adminOnly = requireRole("ADMIN");

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "");

function dateRange(query) {
  const { from, to } = query;
  if (!isDate(from) || !isDate(to)) throw new HttpError(400, "Vui lòng chọn khoảng thời gian.");
  if (to < from) throw new HttpError(400, "Ngày kết thúc phải sau ngày bắt đầu.");
  return { from, to };
}

// GET /api/reports/equipment-status – số máy theo trạng thái, theo loại và theo bãi
router.get("/equipment-status", async (req, res) => {
  const [byCategory] = await pool.query("SELECT * FROM v_report_equipment_status ORDER BY group_id, category_name");
  const [byWarehouse] = await pool.query(
    `SELECT w.id, w.code, w.name, w.capacity, COUNT(e.id) AS total,
            SUM(e.status = 'AVAILABLE') AS available, SUM(e.status = 'RESERVED') AS reserved,
            SUM(e.status = 'INACTIVE') AS inactive
       FROM warehouses w LEFT JOIN equipments e ON e.warehouse_id = w.id AND e.status <> 'LIQUIDATED'
      WHERE w.status = 'ACTIVE' -- bãi đã ngừng hoạt động thì không đưa vào báo cáo
      GROUP BY w.id ORDER BY w.code`
  );
  const [[{ on_site }]] = await pool.query("SELECT COUNT(*) AS on_site FROM equipments WHERE status = 'RENTED'");
  const [[{ liquidated }]] = await pool.query("SELECT COUNT(*) AS liquidated FROM equipments WHERE status = 'LIQUIDATED'");
  res.json({ byCategory, byWarehouse, onSite: on_site, liquidated });
});

// GET /api/reports/revenue?year=2026 – doanh thu theo tháng (theo ngày xác nhận quyết toán)
router.get("/revenue", adminOnly, async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const [rows] = await pool.query("SELECT * FROM v_report_revenue_monthly WHERE period LIKE ? ORDER BY period", [`${year}-%`]);
  const [years] = await pool.query(
    "SELECT DISTINCT YEAR(confirmed_at) AS y FROM settlements WHERE confirmed_at IS NOT NULL ORDER BY y DESC"
  );
  // Đủ 12 tháng, tháng không có doanh thu thì bằng 0
  const months = Array.from({ length: 12 }, (_, i) => {
    const period = `${year}-${String(i + 1).padStart(2, "0")}`;
    return rows.find((r) => r.period === period) || { period, contracts: 0, rental_revenue: 0, extra_fees: 0, compensation: 0, revenue: 0, vat: 0 };
  });
  res.json({ year, months, years: years.map((y) => y.y) });
});

// GET /api/reports/utilization?from=&to= – hiệu suất sử dụng = số ngày máy được thuê / số ngày trong kỳ
router.get("/utilization", adminOnly, async (req, res) => {
  const { from, to } = dateRange(req.query);
  const [rows] = await pool.query(
    `SELECT e.id, e.code, e.name, c.name AS category_name, e.status,
            COUNT(p.contract_id) AS rentals,
            COALESCE(SUM(GREATEST(0, DATEDIFF(LEAST(DATE(p.end_at), ?), GREATEST(DATE(p.start_at), ?)) + 1)), 0) AS rented_days,
            DATEDIFF(?, ?) + 1 AS period_days
       FROM equipments e
       JOIN equipment_categories c ON c.id = e.category_id
       LEFT JOIN v_rental_periods p ON p.equipment_id = e.id AND DATE(p.start_at) <= ? AND DATE(p.end_at) >= ?
      WHERE e.status <> 'LIQUIDATED'
      GROUP BY e.id ORDER BY rented_days DESC, e.code`,
    [to, from, to, from, to, from]
  );
  res.json(rows.map((r) => ({ ...r, rate: r.period_days ? Math.min(100, Math.round((r.rented_days / r.period_days) * 1000) / 10) : 0 })));
});

// GET /api/reports/contracts?from=&to=&status= – hợp đồng có ngày bắt đầu trong kỳ
router.get("/contracts", adminOnly, async (req, res) => {
  const { from, to } = dateRange(req.query);
  const params = [from, to];
  let sql = "SELECT * FROM v_report_contracts WHERE start_date BETWEEN ? AND ?";
  if (req.query.status) {
    sql += " AND status = ?";
    params.push(req.query.status);
  }
  const [rows] = await pool.query(sql + " ORDER BY contract_no", params);
  res.json(rows);
});

// GET /api/reports/customer-debt – công nợ: số tiền còn phải thu / còn phải hoàn theo khách
router.get("/customer-debt", adminOnly, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT v.*, c.phone FROM v_report_customer_debt v JOIN customers c ON c.id = v.customer_id
      ORDER BY v.receivable DESC, v.refund_pending DESC, v.code`
  );
  const [details] = await pool.query(
    `SELECT s.id, rc.customer_id, rc.contract_no, s.amount_due, s.paid_amount, s.payment_status, s.confirmed_at, s.note
       FROM settlements s JOIN rental_contracts rc ON rc.id = s.contract_id
      WHERE s.payment_status IN ('UNPAID','PARTIAL') AND s.amount_due > 0 ORDER BY s.confirmed_at`
  );
  res.json({ customers: rows, openSettlements: details });
});

module.exports = router;
