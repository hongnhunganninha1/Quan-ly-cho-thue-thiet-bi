// Tên hiển thị và màu nhãn của các trạng thái lưu trong CSDL

export const EQUIPMENT_STATUS = {
  AVAILABLE: { label: "Sẵn sàng", badge: "badge-success", color: "#16a34a" },
  RESERVED: { label: "Đã giữ chỗ", badge: "badge-warning", color: "#f59e0b" },
  RENTED: { label: "Đang cho thuê", badge: "badge-info", color: "#1e4b8f" },
  INACTIVE: { label: "Ngừng hoạt động", badge: "badge-danger", color: "#dc2626" },
  LIQUIDATED: { label: "Đã thanh lý", badge: "badge-neutral", color: "#94a3b8" },
};

// Trạng thái giao dịch của khách hàng
// Trạng thái giao dịch hiển thị của khách hàng. CSDL chỉ lưu ACTIVE / STOPPED;
// NEW = ACTIVE nhưng chưa có hợp đồng nào (khách mới, chưa phát sinh giao dịch)
export const CUSTOMER_STATUS = {
  NEW: { label: "Chưa giao dịch", badge: "badge-neutral" },
  ACTIVE: { label: "Đang giao dịch", badge: "badge-success" },
  STOPPED: { label: "Ngừng giao dịch", badge: "badge-danger" },
};
export const customerTradeStatus = (c) => (c.status === "STOPPED" ? "STOPPED" : c.contract_count > 0 ? "ACTIVE" : "NEW");

// Tình trạng máy lúc nhập về
export const ITEM_CONDITION = {
  USED: { label: "Đã qua sử dụng", badge: "badge-neutral" },
  NEW: { label: "Mới", badge: "badge-success" },
};

export const CONTRACT_STATUS = {
  DRAFT: { label: "Nháp", badge: "badge-neutral" },
  PENDING_APPROVAL: { label: "Chờ duyệt", badge: "badge-warning" },
  APPROVED: { label: "Đã duyệt", badge: "badge-info" },
  REJECTED: { label: "Bị từ chối", badge: "badge-danger" },
  ACTIVE: { label: "Đang thuê", badge: "badge-primary" },
  COMPLETED: { label: "Chờ quyết toán", badge: "badge-purple" },
  SETTLED: { label: "Đã quyết toán", badge: "badge-success" },
  CANCELLED: { label: "Đã huỷ", badge: "badge-neutral" },
};

export const DETAIL_STATUS = {
  PENDING: { label: "Chờ bàn giao", badge: "badge-neutral" },
  HANDED_OVER: { label: "Đang thuê", badge: "badge-primary" },
  RETURNED: { label: "Đã thu hồi", badge: "badge-success" },
};

export const PAYMENT_STATUS = {
  UNPAID: { label: "Chưa thanh toán", badge: "badge-danger" },
  PARTIAL: { label: "Thanh toán một phần", badge: "badge-warning" },
  PAID: { label: "Đã thanh toán", badge: "badge-success" },
  REFUNDED: { label: "Đã hoàn cọc", badge: "badge-success" },
};

export const PRICING_TYPE = {
  DAY: "Theo ngày",
  HOUR: "Theo giờ",
};

export const DOC_TYPES = {
  PHOTO: "Ảnh thiết bị",
  NAMEPLATE: "Ảnh tem máy",
  CUSTOMS: "Tờ khai hải quan",
  CO: "Chứng nhận xuất xứ (CO)",
  CQ: "Chứng nhận chất lượng (CQ)",
  REGISTRATION: "Giấy đăng ký",
  INSPECTION: "Giấy đăng kiểm",
  MANUAL: "Hướng dẫn sử dụng",
  OTHER: "Khác",
};

export const GENDER = { MALE: "Nam", FEMALE: "Nữ", OTHER: "Khác" };

// Đổi { KEY: {label} } thành danh sách [{ value, label }] cho ô chọn
export function toOptions(map) {
  return Object.entries(map).map(([value, v]) => ({ value, label: typeof v === "string" ? v : v.label }));
}
