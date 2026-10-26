// Các hàm định dạng dữ liệu để hiển thị

// "2026-10-07 07:00:00" → Date (MySQL trả về giờ địa phương, không có múi giờ)
function toDate(value) {
  if (!value) return null;
  const d = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

// 07/10/2026
export function formatDate(value) {
  const d = toDate(value);
  return d ? d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
}

// 4.500 – số có dấu chấm ngăn cách hàng nghìn
export function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  return Number(value).toLocaleString("vi-VN");
}

// "Vừa xong", "10 phút trước", "Hôm nay, 07:00", "Hôm qua", "05/10/2026"
export function timeAgo(value) {
  const d = toDate(value);
  if (!d) return "";
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;

  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return `Hôm nay, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return formatDate(value);
}

// Bỏ dấu tiếng Việt và chữ hoa để tìm kiếm: "Hòa Bình" → "hoa binh"
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// 1.234.000 ₫
export function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "";
  return `${Number(value).toLocaleString("vi-VN")} ₫`;
}

// 07/10/2026 08:30
export function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return "";
  return `${formatDate(value)} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

// Hôm nay dạng "2026-10-20" (cho ô chọn ngày)
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Bây giờ dạng "2026-10-20T08:30" (cho ô chọn ngày giờ)
export function nowLocalISO() {
  const d = new Date();
  return `${todayISO()}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Số ngày tính cả ngày đầu và cuối: 01/07 → 10/07 = 10 ngày
export function daysInclusive(start, end) {
  if (!start || !end) return 0;
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b - a) / 86400000) + 1;
}

// Số trong báo cáo in (theo kiểu báo cáo kế toán): 1.250.000; số 0 hoặc trống in là "-"
export function formatReportNumber(value, digits = 0) {
  const n = Number(value || 0);
  if (!n) return "-";
  return n.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
