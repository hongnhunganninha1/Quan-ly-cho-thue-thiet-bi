import { useLayoutEffect, useRef, useState } from "react";
import { DATE_MAX, DATE_MIN, DATETIME_MAX, DATETIME_MIN } from "../../utils/dateLimits";
import "./DateInput.css";

// Ô nhập ngày luôn theo kiểu Việt Nam: dd/mm/yyyy (hoặc dd/mm/yyyy hh:mm).
// Ô <input type="date"> của trình duyệt hiển thị theo ngôn ngữ của máy (máy tiếng Anh: mm/dd/yyyy),
// dễ làm người dùng gõ nhầm ngày và tháng, nên ở đây gõ chữ theo dd/mm/yyyy; nút lịch bên phải vẫn mở
// bảng chọn ngày của trình duyệt. Ô đã đủ ngày thì sửa từng phần (ngày / tháng / năm) như ô ngày của Windows.
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

// Các phần của ô ngày: [vị trí bắt đầu, kết thúc, chữ số đầu lớn hơn số này thì tự đủ 2 số (VD ngày gõ 5 → 05)]
const SEGMENTS = [
  [0, 2, 3], // ngày
  [3, 5, 1], // tháng
  [6, 10, null], // năm
  [11, 13, 2], // giờ
  [14, 16, 5], // phút
];
const segmentsOf = (withTime) => SEGMENTS.slice(0, withTime ? 5 : 3);
const segmentAt = (pos, withTime) => {
  const segs = segmentsOf(withTime);
  const i = segs.findIndex(([a, b]) => pos >= a && pos <= b);
  return i === -1 ? segs.length - 1 : i;
};
// Giới hạn khi bấm mũi tên lên / xuống: ngày 1–31, tháng 1–12, năm, giờ 0–23, phút 0–59
const RANGES = [
  [1, 31],
  [1, 12],
  [1900, 2100],
  [0, 23],
  [0, 59],
];

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

  // Ô đã đủ ngày (dd/mm/yyyy): sửa theo từng phần như ô ngày của Windows — bấm vào ngày / tháng / năm thì
  // bôi đen đúng phần đó, gõ số thì chỉ thay phần đó (không phải xoá cả ô gõ lại), ← → chuyển phần, ↑ ↓ tăng giảm.
  const inputRef = useRef(null);
  const typed = useRef({ seg: -1, digits: "" }); // các số đã gõ vào phần đang sửa
  const pendingSel = useRef(null); // vùng cần bôi đen sau khi hiển thị lại
  const fullLength = (withTime ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy").length;
  const complete = text.length === fullLength;

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (pendingSel.current && el && document.activeElement === el) {
      el.setSelectionRange(...pendingSel.current);
    }
    pendingSel.current = null;
  });

  const selectSegment = (i) => {
    const [a, b] = segmentsOf(withTime)[i];
    pendingSel.current = [a, b];
    inputRef.current?.setSelectionRange(a, b);
  };

  const setSegment = (i, digits, nextSel) => {
    const [a, b] = segmentsOf(withTime)[i];
    const next = text.slice(0, a) + digits.padStart(b - a, "0").slice(-(b - a)) + text.slice(b);
    setText(next);
    emit(textToIso(next, withTime) || next);
    pendingSel.current = nextSel;
  };

  // Bấm chuột vào ô đã đủ ngày → bôi đen phần ngày / tháng / năm tại chỗ bấm
  const handleClick = (e) => {
    if (!complete) return;
    const pos = e.target.selectionStart ?? 0;
    if (e.target.selectionEnd !== pos) return; // người dùng đang tự bôi đen (VD kéo chọn cả ô)
    typed.current = { seg: -1, digits: "" };
    selectSegment(segmentAt(pos, withTime));
  };

  const handleKeyDown = (e) => {
    if (!complete || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target;
    const segs = segmentsOf(withTime);
    const allSelected = el.selectionStart === 0 && el.selectionEnd === text.length;
    const i = segmentAt(el.selectionStart ?? 0, withTime);
    const [a, b, autoAfter] = segs[i];

    if (/^\d$/.test(e.key) && !allSelected) {
      e.preventDefault();
      const prev = typed.current.seg === i ? typed.current.digits : "";
      const digits = prev + e.key;
      const done = digits.length >= b - a || (autoAfter !== null && digits.length === 1 && Number(e.key) > autoAfter);
      if (done) {
        typed.current = { seg: -1, digits: "" };
        const n = Math.min(i + 1, segs.length - 1);
        setSegment(i, digits, n === i ? [b, b] : [segs[n][0], segs[n][1]]);
      } else {
        typed.current = { seg: i, digits };
        setSegment(i, digits, [a, b]);
      }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      typed.current = { seg: -1, digits: "" };
      selectSegment(Math.max(0, Math.min(segs.length - 1, i + (e.key === "ArrowLeft" ? -1 : 1))));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      typed.current = { seg: -1, digits: "" };
      const [lo, hi] = RANGES[i];
      const cur = Number(text.slice(a, b));
      let n = Number.isNaN(cur) ? (e.key === "ArrowUp" ? lo : hi) : cur + (e.key === "ArrowUp" ? 1 : -1);
      if (n > hi) n = lo;
      if (n < lo) n = hi;
      setSegment(i, String(n), [a, b]);
    } else if ((e.key === "Backspace" || e.key === "Delete") && !allSelected) {
      // Chỉ xoá phần đang chọn (hiện chữ mẫu: dd / mm / yyyy…), các phần khác giữ nguyên, gõ số để điền lại
      e.preventDefault();
      typed.current = { seg: -1, digits: "" };
      const holder = (withTime ? "dd/mm/yyyy hh:mm" : "dd/mm/yyyy").slice(a, b);
      const next = text.slice(0, a) + holder + text.slice(b);
      setText(next);
      emit(next);
      pendingSel.current = [a, b];
    }
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
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={handleType}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
        onBlur={() => (typed.current = { seg: -1, digits: "" })}
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
