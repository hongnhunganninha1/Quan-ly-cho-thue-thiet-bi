// Danh sách dùng cho các ô chọn (phòng ban, vai trò)
const express = require("express");
const pool = require("../config/db");

const router = express.Router();

// GET /api/lookups
router.get("/", async (req, res) => {
  const [departments] = await pool.query("SELECT id, code, name FROM departments ORDER BY id");
  const [roles] = await pool.query("SELECT id, code, name FROM roles ORDER BY id");
  res.json({ departments, roles });
});

module.exports = router;
