// DỮ LIỆU GIẢ dùng tạm khi chưa có database.
// Khi backend xong, thay các hằng này bằng dữ liệu lấy từ API.

export const dashboardStats = [
  { key: "equipment", label: "Tổng số thiết bị", value: 12, note: "Trong 3 bãi máy" },
  { key: "renting", label: "Đang cho thuê", value: 4, note: "Chiếm 33% đội máy" },
  { key: "pending", label: "Hợp đồng chờ duyệt", value: 1, note: "Cần Quản lý xử lý" },
  { key: "revenue", label: "Doanh thu tháng này", value: "60.330.000 ₫", note: "Tháng trước: 67.000.000 ₫" },
];

export const equipmentStatus = [
  { key: "available", label: "Sẵn sàng", count: 5, color: "#16a34a" },
  { key: "reserved", label: "Đã đặt trước", count: 2, color: "#f59e0b" },
  { key: "rented", label: "Đang cho thuê", count: 4, color: "#1e4b8f" },
  { key: "inactive", label: "Ngừng hoạt động", count: 1, color: "#dc2626" },
];

export const dueSoonContracts = [
  { code: "HD-2026-0004", customer: "Công ty CP Xây dựng Hoà Bình Xanh", equipment: "Máy xúc Komatsu PC200-8", endDate: "09/10/2026", daysLeft: 2 },
  { code: "HD-2026-0005", customer: "Công ty TNHH Hạ tầng Đông Đô", equipment: "Xe lu Sakai SV512D", endDate: "12/10/2026", daysLeft: 5 },
  { code: "HD-2026-0003", customer: "Công ty CP Cầu đường Thăng Long", equipment: "Cần cẩu Kato NK-250E", endDate: "05/10/2026", daysLeft: -2 },
];

export const pendingContracts = [
  { code: "HD-2026-0006", customer: "Công ty TNHH Xây lắp Phú Thành", createdBy: "Nguyễn Văn An", total: "148.500.000 ₫", createdAt: "06/10/2026" },
];
