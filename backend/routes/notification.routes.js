// API thông báo: danh sách được tính trực tiếp từ hợp đồng (xem jobs/dueAlerts.js), không lưu bảng riêng.
// Đánh dấu đã đọc do trình duyệt tự lưu theo từng tài khoản (frontend/src/App.jsx).
const express = require("express");
const { buildNotifications } = require("../jobs/dueAlerts");

const router = express.Router();

// GET /api/notifications – tối đa 50 thông báo mới nhất của tài khoản đang đăng nhập
router.get("/", async (req, res) => {
  res.json(await buildNotifications(req.user));
});

module.exports = router;
