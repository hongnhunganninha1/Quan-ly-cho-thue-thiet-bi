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

// Năm cho phép (khớp utils/dateLimits.js)
const YEAR_MIN = 1900;
const YEAR_MAX = 2099;

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
  [YEAR_MIN, YEAR_MAX],
  [0, 23],
  [0, 59],
];

// ----- Chặn ngày / tháng / năm không tồn tại ngay khi gõ -----
// Số ngày của tháng; chưa biết năm thì cho tháng 2 tối đa 29 ngày
const daysIn = (month, year) => (year ? new Date(Date.UTC(year, month, 0)).getUTCDate() : [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]);
// Năm đang gõ dở (VD "20") còn có thể thành năm trong khoảng 1900–2099 không
const yearPrefixOk = (p) => {
  const n = Number(p);
  const k = 10 ** (4 - p.length);
  return n * k <= YEAR_MAX && (n + 1) * k - 1 >= YEAR_MIN;
};

// Lọc các số vừa gõ theo thứ tự ngày → tháng → năm → giờ → phút: số làm ngày / tháng / giờ / phút vượt giới hạn
// thì bỏ qua (gõ ngày 32, tháng 13, 31/04… không được); ngày gõ 4–9 tự thành 04–09, tháng gõ 2–9 thành 02–09.
// Gõ đủ năm mà ngày không có trong tháng đó (29/02 năm không nhuận) thì lùi về ngày cuối tháng.
function cleanDigits(digits, withTime) {
  let out = "";
  for (const ch of digits) {
    const pos = out.length;
    const d = Number(ch);
    if (pos >= (withTime ? 12 : 8)) break;
    if (pos === 0 || pos === 2 || pos === 8 || pos === 10) {
      // chữ số đầu của ngày / tháng / giờ / phút: lớn hơn mức này thì tự thêm số 0 phía trước
      const autoAfter = { 0: 3, 2: 1, 8: 2, 10: 5 }[pos];
      const seg = d > autoAfter ? "0" + ch : null;
      if (seg) {
        if (pos === 2 && Number(out.slice(0, 2)) > daysIn(d)) continue; // VD 31 rồi gõ tháng 4
        out += seg;
      } else out += ch;
      continue;
    }
    if (pos === 1) {
      const day = Number(out[0] + ch);
      if (day < 1 || day > 31) continue;
    } else if (pos === 3) {
      const month = Number(out[2] + ch);
      if (month < 1 || month > 12 || Number(out.slice(0, 2)) > daysIn(month)) continue;
    } else if (pos >= 4 && pos <= 7) {
      if (!yearPrefixOk(out.slice(4) + ch)) continue;
    } else if (pos === 9) {
      if (Number(out[8] + ch) > 23) continue;
    } else if (pos === 11) {
      if (Number(out[10] + ch) > 59) continue;
    }
    out += ch;
    if (pos === 7) {
      const max = daysIn(Number(out.slice(2, 4)), Number(out.slice(4, 8)));
      if (Number(out.slice(0, 2)) > max) out = String(max) + out.slice(2);
    }
  }
  return out;
}

// Ô đã đủ ngày mà sửa riêng tháng / năm làm ngày không còn tồn tại (VD 31/03 sửa tháng thành 04) → lùi về ngày cuối tháng
function clampDay(text) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(text);
  if (!m) return text;
  const max = daysIn(Number(m[2]), Number(m[3]));
  return Number(m[1]) > max ? String(max) + text.slice(2) : text;
}

// Giá trị một phần (ngày / tháng / năm / giờ / phút) có hợp lệ không, khi sửa riêng phần đó
function segmentOk(i, digits, text) {
  const n = Number(digits);
  if (i === 0) {
    const month = Number(text.slice(3, 5));
    const year = Number(text.slice(6, 10));
    const max = month >= 1 && month <= 12 ? daysIn(month, year >= YEAR_MIN ? year : undefined) : 31;
    return digits.length < 2 || (n >= 1 && n <= max);
  }
  if (i === 1) return digits.length < 2 || (n >= 1 && n <= 12);
  if (i === 2) return yearPrefixOk(digits);
  if (i === 3) return n <= 23;
  if (i === 4) return n <= 59;
  return Boolean(text);
}

// Tự chèn "/" và khoảng trắng, ":" khi gõ số: 07102026 → 07/10/2026
function mask(raw, withTime) {
  const digits = cleanDigits(raw.replace(/\D/g, ""), withTime);
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
    let next = text.slice(0, a) + digits.padStart(b - a, "0").slice(-(b - a)) + text.slice(b);
    // Năm gõ dở (VD 0002) thì chưa so ngày; đủ năm / đổi tháng thì lùi ngày không tồn tại về cuối tháng
    if (i === 1 || (i === 2 && digits.length === 4)) next = clampDay(next);
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
      let digits = prev + e.key;
      // Số vừa gõ làm phần này vượt giới hạn (ngày 35, tháng 13, năm 3…) → coi như gõ lại từ đầu phần đó
      if (!segmentOk(i, digits, text)) digits = e.key;
      if (!segmentOk(i, digits, text)) return;
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
      const [lo, rangeHi] = RANGES[i];
      // Ngày: tối đa theo đúng tháng / năm đang nhập (tháng 4 chỉ đến 30, tháng 2 đến 28 hoặc 29)
      const hi = i === 0 ? daysIn(Number(text.slice(3, 5)) || 1, Number(text.slice(6, 10)) || undefined) : rangeHi;
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
