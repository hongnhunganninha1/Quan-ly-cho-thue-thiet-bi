import { useLayoutEffect, useRef } from "react";

// Thêm dấu chấm ngăn cách hàng nghìn: "8000000" -> "8.000.000"
const group = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

// Ô nhập tiền: tự chèn dấu chấm ngay khi gõ (8.000.000), giá trị lưu vẫn là số trơn "8000000".
// Bỏ số 0 thừa ở đầu (gõ "05" thành "5"); con trỏ giữ đúng chỗ khi dấu chấm được thêm / bớt.
function MoneyInput({ value, onChange, className, ...rest }) {
  const ref = useRef(null);
  const caretDigits = useRef(null); // số chữ số đứng trước con trỏ sau lần gõ gần nhất

  const raw = String(value ?? "").split(".")[0].replace(/\D/g, ""); // giá trị từ CSDL có thể dạng "8000000.00"
  const shown = group(raw);

  // Sau khi hiển thị lại (đã thêm dấu chấm) thì đặt con trỏ về sau đúng chữ số vừa gõ
  useLayoutEffect(() => {
    const el = ref.current;
    if (caretDigits.current === null || !el || document.activeElement !== el) return;
    let pos = 0;
    for (let seen = 0; pos < shown.length && seen < caretDigits.current; pos++) {
      if (/\d/.test(shown[pos])) seen++;
    }
    el.setSelectionRange(pos, pos);
    caretDigits.current = null;
  }, [shown]);

  const handleChange = (e) => {
    const typed = e.target.value;
    const before = typed.slice(0, e.target.selectionStart ?? typed.length).replace(/\D/g, "").length;
    const digits = typed.replace(/\D/g, "");
    const clean = digits.replace(/^0+(?=\d)/, "");
    caretDigits.current = Math.max(0, before - (digits.length - clean.length));
    onChange(clean);
  };

  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={`money-input ${className || ""}`}
      value={shown}
      onChange={handleChange}
      {...rest}
    />
  );
}

export default MoneyInput;
