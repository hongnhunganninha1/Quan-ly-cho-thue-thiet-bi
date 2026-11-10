// Các hàm kiểm tra dữ liệu gửi lên từ form
const HttpError = require("./httpError");

// Lấy các trường cần dùng từ body: cắt khoảng trắng hai đầu, chuỗi rỗng thì coi là NULL
function pick(body, fields) {
  const data = {};
  for (const f of fields) {
    let v = body?.[f];
    if (typeof v === "string") v = v.trim();
    data[f] = v === "" || v === undefined ? null : v;
  }
  return data;
}

// Gộp nhiều khoảng trắng liên tiếp thành 1 (để "Bãi  Long Biên" và "Bãi Long Biên" được coi là trùng)
function squeeze(data, fields) {
  for (const f of fields) {
    if (typeof data[f] === "string") data[f] = data[f].replace(/\s+/g, " ");
  }
}

// Bắt buộc nhập. labels: { tenTruong: "Tên hiển thị" }
function required(data, labels) {
  for (const [field, label] of Object.entries(labels)) {
    if (data[field] === null || data[field] === undefined) {
      throw new HttpError(400, `Vui lòng nhập ${label}.`);
    }
  }
}

// Không vượt quá số ký tự tối đa (đúng với độ dài cột trong CSDL)
function maxLength(data, limits) {
  for (const [field, [label, max]] of Object.entries(limits)) {
    if (data[field] && String(data[field]).length > max) {
      throw new HttpError(400, `${label} không được quá ${max} ký tự.`);
    }
  }
}

const PATTERNS = {
  phone: /^0\d{9,10}$/, // số điện thoại Việt Nam: 10–11 số, bắt đầu bằng 0
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  taxCode: /^\d{10}(-\d{3})?$/, // mã số thuế: 10 số, hoặc 10 số + "-" + 3 số (chi nhánh)
  idNumber: /^\d{12}$/, // CCCD: 12 số
  url: /^https?:\/\/\S+$/i,
};

function matches(value, patternName, message) {
  if (value !== null && value !== undefined && !PATTERNS[patternName].test(String(value))) {
    throw new HttpError(400, message);
  }
}

// Số không âm (cho diện tích, sức chứa…)
function nonNegativeNumber(data, field, label, { integer = false } = {}) {
  if (data[field] === null) return;
  const n = Number(data[field]);
  if (!Number.isFinite(n) || n < 0 || (integer && !Number.isInteger(n))) {
    throw new HttpError(400, `${label} phải là ${integer ? "số nguyên" : "số"} không âm.`);
  }
  data[field] = n;
}

// Lấy id trên đường dẫn (/api/customers/:id) và kiểm tra là số nguyên dương
function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "Mã bản ghi không hợp lệ.");
  return id;
}

// Hôm nay dạng "YYYY-MM-DD" theo giờ máy chủ (toISOString là giờ UTC, trước 7h sáng ở Việt Nam sẽ ra ngày hôm qua)
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Kiểm tra các ô ngày dạng "YYYY-MM-DD": năm đúng 4 chữ số (1900–2099) và là ngày có thật (không có 31/02).
// labels: { date_of_birth: "Ngày sinh", ... }; ô bỏ trống thì bỏ qua (ô bắt buộc kiểm tra bằng required).
function validDate(data, labels, { notFuture = [] } = {}) {
  const today = todayLocal();
  for (const [field, label] of Object.entries(labels)) {
    const v = data[field];
    if (v === undefined || v === null || v === "") continue;
    const s = String(v).slice(0, 10);
    const d = new Date(`${s}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
      throw new HttpError(400, `${label} không hợp lệ (định dạng ngày/tháng/năm, năm gồm 4 chữ số).`);
    }
    const year = Number(s.slice(0, 4));
    if (year < 1900 || year > 2099) throw new HttpError(400, `${label} phải trong khoảng năm 1900 – 2099.`);
    if (notFuture.includes(field) && s > today) throw new HttpError(400, `${label} không được ở tương lai.`);
    data[field] = s;
  }
}

// Chuẩn hoá "2026-10-20T08:30" (ô chọn ngày giờ trên form) thành "2026-10-20 08:30:00"
function toDateTime(value, label) {
  const s = String(value || "").trim().replace("T", " ");
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)) throw new HttpError(400, `${label} không hợp lệ.`);
  validDate({ d: s.slice(0, 10) }, { d: label });
  const full = s.length === 16 ? `${s}:00` : s;
  // Không cho nhập thời điểm ở tương lai (cho phép lệch 10 phút do đồng hồ máy)
  if (new Date(full.replace(" ", "T")).getTime() > Date.now() + 10 * 60 * 1000) {
    throw new HttpError(400, `${label} không được ở tương lai.`);
  }
  return full;
}

module.exports = { squeeze, pick, required, maxLength, matches, nonNegativeNumber, parseId, toDateTime, validDate, todayLocal };
