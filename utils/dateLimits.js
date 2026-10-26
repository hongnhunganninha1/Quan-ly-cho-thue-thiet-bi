// Giới hạn chung cho mọi ô chọn ngày: năm đúng 4 chữ số, từ 1900 đến 2099.
// Đặt min / max cho ô <input type="date"> thì trình duyệt không cho gõ năm 5–6 chữ số.
export const DATE_MIN = "1900-01-01";
export const DATE_MAX = "2099-12-31";
export const DATETIME_MIN = "1900-01-01T00:00";
export const DATETIME_MAX = "2099-12-31T23:59";

// Hôm nay dạng "YYYY-MM-DD" theo giờ máy
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Kiểm tra một giá trị ngày ("YYYY-MM-DD" hoặc "YYYY-MM-DDTHH:mm"): đúng định dạng, có thật, năm 1900–2099.
// Trả về chuỗi lỗi, hoặc "" nếu hợp lệ / bỏ trống.
export function dateError(value, label = "Ngày") {
  if (!value) return "";
  const s = String(value).slice(0, 10);
  const d = new Date(`${s}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    return `${label} không hợp lệ (nhập theo dd/mm/yyyy, là ngày có thật, năm gồm 4 chữ số).`;
  }
  if (s < DATE_MIN || s > DATE_MAX) return `${label} phải trong khoảng năm 1900 – 2099.`;
  return "";
}
