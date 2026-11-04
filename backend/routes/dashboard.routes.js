// API Trang chủ: các con số tổng quan
const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// GET /api/dashboard
router.get("/", async (req, res) => {
  const [[eq]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(status = 'AVAILABLE') AS available, SUM(status = 'RESERVED') AS reserved,
            SUM(status = 'RENTED') AS rented, SUM(status = 'INACTIVE') AS inactive,
            COUNT(DISTINCT warehouse_id) AS warehouses
       FROM equipments WHERE status <> 'LIQUIDATED'`
  );
  // Doanh thu là số liệu tài chính: chỉ Quản lý xem
  const [[revenueRow]] = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN DATE_FORMAT(confirmed_at, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
                              THEN rental_total + late_fee_total + overtime_fee_total + compensation_total END), 0) AS this_month,
            COALESCE(SUM(CASE WHEN DATE_FORMAT(confirmed_at, '%Y-%m') = DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m')
                              THEN rental_total + late_fee_total + overtime_fee_total + compensation_total END), 0) AS last_month
       FROM settlements`
  );
  const [pending] = await pool.query(
    `SELECT rc.id, rc.contract_no, rc.total_amount, rc.created_at, cu.name AS customer_name, em.full_name AS created_by_name
       FROM rental_contracts rc
       JOIN customers cu ON cu.id = rc.customer_id
       JOIN users u      ON u.id = rc.created_by
       JOIN employees em ON em.id = u.employee_id
      WHERE rc.status = 'PENDING_APPROVAL' ORDER BY rc.created_at`
  );
  // Hợp đồng đang thuê sắp đến hạn (≤ 3 ngày) hoặc đã quá hạn mà còn máy chưa thu hồi
  const [dueSoon] = await pool.query(
    `SELECT rc.id, rc.contract_no, rc.end_date, cu.name AS customer_name,
            DATEDIFF(rc.end_date, CURDATE()) AS days_left,
            GROUP_CONCAT(e.name ORDER BY e.code SEPARATOR ', ') AS equipment_names
       FROM rental_contracts rc
       JOIN customers cu        ON cu.id = rc.customer_id
       JOIN contract_details cd ON cd.contract_id = rc.id AND cd.status = 'HANDED_OVER'
       JOIN equipments e        ON e.id = cd.equipment_id
      WHERE rc.status = 'ACTIVE' AND rc.end_date <= CURDATE() + INTERVAL 3 DAY
      GROUP BY rc.id ORDER BY rc.end_date`
  );
  const [[{ deposit_waiting }]] = await pool.query(
    "SELECT COUNT(*) AS deposit_waiting FROM rental_contracts WHERE status = 'APPROVED' AND deposit_paid_at IS NULL"
  );
  const [expiringDocs] = await pool.query(
    `SELECT d.id, d.doc_type, d.doc_number, d.expiry_date, e.id AS equipment_id, e.code, e.name
       FROM equipment_documents d JOIN equipments e ON e.id = d.equipment_id
      WHERE d.expiry_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 30 DAY AND e.status <> 'LIQUIDATED'
      ORDER BY d.expiry_date`
  );
  res.json({ equipment: eq, revenue: req.user.role === "ADMIN" ? revenueRow : null, pending, dueSoon, depositWaiting: deposit_waiting, expiringDocs });
});

module.exports = router;
