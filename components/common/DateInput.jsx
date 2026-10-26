import { useRef, useState } from "react";
import { DATE_MAX, DATE_MIN, DATETIME_MAX, DATETIME_MIN } from "../../utils/dateLimits";
import "./DateInput.css";

// Ô nhập ngày luôn theo kiểu Việt Nam: dd/mm/yyyy (hoặc dd/mm/yyyy hh:mm).
// Ô <input type="date"> của trình duyệt hiển thị theo ngôn ngữ của máy (máy tiếng Anh: mm/dd/yyyy),
// dễ làm người dùng gõ nhầm ngày và tháng, nên ở đây gõ chữ theo dd/mm/yyyy; nút lịch bên phải vẫn mở
// bảng chọn ngày của trình duyệt.
//   value   : "YYYY-MM-DD" (hoặc "YYYY-MM-DDTHH:mm") — giá trị gửi lên backend
//   onChange(v): v = giá trị chuẩn khi gõ đủ và đúng; "" khi xoá trống; chuỗi đang gõ dở khi chưa hợp lệ
//                (FormModal kiểm tra lại bằng dateError trước khi lưu)
//   withTime: true = có giờ phút (thay cho type="datetime-local")


// "2026-10-07" → "07/10/2026"; "2026-10-07T08:30" → "07/10/2026 08:30"
function isoToText(value, withTime) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(value || ""));
  if (!m) return String(value || "");
  const date = `${m[3]}/${m[2]}/${m[1]}`;
  return withTime ? `${date} ${m[4] || "00"}:${m[5] || "00"}` : date;
}

// "07/10/2026" → "2026-10-07"; null nếu chưa đủ hoặc không phải ngày có thật
function textToIso(text, withTime) {
  const re = withTime ? /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/ : /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const m = re.exec(text.trim());
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "00", mi = "00"] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)));
  if (d.getUTCFullYear() !== Number(yyyy) || d.getUTCMonth() !== Number(mm) - 1 || d.getUTCDate() !== Number(dd)) {
    return null;
  }
  if (withTime && (Number(hh) > 23 || Number(mi) > 59)) return null;
  const iso = `${yyyy}-${mm}-${dd}`;
  return withTime ? `${iso}T${hh}:${mi}` : iso;
}

// Tự chèn "/" và khoảng trắng, ":" khi gõ số: 07102026 → 07/10/2026
function mask(raw, withTime) {
  const digits = raw.replace(/\D/g, "").slice(0, withTime ? 12 : 8);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += "/";
    if (i === 8) out += " ";
    if (i === 10) out += ":";
    out += digits[i];
  }
  return out;
}

function DateInput({ value, onChange, withTime = false, min, max, id, disabled, invalid, autoFocus, className = "" }) {
  const pickerRef = useRef(null);
  const [text, setText] = useState(() => isoToText(value, withTime));
  const [lastValue, setLastValue] = useState(value);

  // Giá trị đổi từ bên ngoài (chọn bằng lịch, đặt lại form…): cập nhật chữ hiển thị
  if (value !== lastValue) {
    setLastValue(value);
    const current = textToIso(text, withTime);
    if (current !== value && !(value === text)) setText(isoToText(value, withTime));
  }

  const emit = (v) => {
    setLastValue(v);
    onChange(v);
  };

  const handleType = (e) => {
    const masked = mask(e.target.value, withTime);
    setText(masked);
    if (!masked) return emit("");
    const iso = textToIso(masked, withTime);
    emit(iso || masked);
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el || disabled) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
    }
  };

  const placeholder = withTime ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy";
  const isoValue = textToIso(text, withTime) || "";

  return (
    <div className={`date-input ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={handleType}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        autoFocus={autoFocus}
        maxLength={placeholder.length}
      />
      <button
        type="button"
        className="date-input-btn"
        onClick={openPicker}
        disabled={disabled}
        title="Chọn trên lịch"
        aria-label="Chọn trên lịch"
      >
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {/* Bảng chọn ngày của trình duyệt (ẩn), mở bằng nút lịch */}
      <input
        ref={pickerRef}
        className="date-input-picker"
        type={withTime ? "datetime-local" : "date"}
        tabIndex={-1}
        aria-hidden="true"
        min={min || (withTime ? DATETIME_MIN : DATE_MIN)}
        max={max || (withTime ? DATETIME_MAX : DATE_MAX)}
        value={isoValue}
        onChange={(e) => {
          setText(isoToText(e.target.value, withTime));
          emit(e.target.value);
        }}
      />
    </div>
  );
}

export default DateInput;
