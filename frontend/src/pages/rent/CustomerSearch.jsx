import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeText } from "../../utils/format";

const MAX_SHOWN = 8;
// Chữ hiện trong ô sau khi chọn: chỉ tên khách hàng (mã KH vẫn thấy ở danh sách gợi ý)
const label = (c) => c.name;

// Ô tìm khách hàng khi lập hợp đồng: gõ mã / tên / MST / CCCD / SĐT → hiện gợi ý để chọn.
// Không thấy khách cần tìm thì bấm "Thêm khách hàng mới" (điền sẵn chữ vừa gõ vào form thêm).
// value: id khách đang chọn ("" nếu chưa chọn); onChange(id); onAddNew(query)
function CustomerSearch({ id, customers, value, onChange, onAddNew }) {
  const selected = customers.find((c) => String(c.id) === String(value));
  const [query, setQuery] = useState(selected ? label(selected) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0); // dòng gợi ý đang được chọn bằng phím mũi tên
  const boxRef = useRef(null);

  // Chọn từ ngoài (VD: vừa thêm khách mới, hoặc danh sách tải xong) thì hiện lại tên khách
  const [shownId, setShownId] = useState(selected?.id);
  if (selected && selected.id !== shownId) {
    setShownId(selected.id);
    setQuery(label(selected));
  }

  // Bấm ra ngoài thì đóng; nếu chưa chọn khách nào thì giữ nguyên chữ đã gõ
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Khách đã ngừng giao dịch không lập hợp đồng mới (vẫn giữ nếu là khách của hợp đồng đang sửa)
  const matches = useMemo(() => {
    const usable = customers.filter((c) => c.status !== "STOPPED" || String(c.id) === String(value));
    const kw = normalizeText(query.trim());
    if (!kw || (selected && query === label(selected))) return usable.slice(0, MAX_SHOWN);
    return usable
      .filter((c) => normalizeText([c.code, c.name, c.id_number, c.phone, c.representative].join(" ")).includes(kw))
      .slice(0, MAX_SHOWN);
  }, [customers, query, selected, value]);

  const pick = (c) => {
    onChange(String(c.id));
    setQuery(label(c));
    setOpen(false);
  };

  const addNew = () => {
    setOpen(false);
    onAddNew(selected && query === label(selected) ? "" : query.trim());
  };

  const onType = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    setActive(0);
    if (value) onChange(""); // sửa chữ thì bỏ khách đang chọn, phải chọn lại từ gợi ý
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (matches[active]) pick(matches[active]);
      else addNew();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const typed = query.trim() && !(selected && query === label(selected));

  return (
    <div className="customer-search" ref={boxRef}>
      <input
        id={id}
        value={query}
        onChange={onType}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onKeyDown={onKeyDown}
        placeholder="Gõ mã, tên, MST / CCCD hoặc số điện thoại khách hàng…"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && (
        <div className="customer-search-panel" role="listbox">
          {matches.length === 0 ? (
            <div className="customer-search-empty">
              Không tìm thấy khách hàng “{query.trim()}”.
              <button type="button" className="btn btn-primary" onClick={addNew}>
                + Thêm khách hàng mới
              </button>
            </div>
          ) : (
            <>
              {matches.map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  role="option"
                  aria-selected={String(c.id) === String(value)}
                  className={`customer-option ${i === active ? "active" : ""} ${String(c.id) === String(value) ? "selected" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(c)}
                >
                  <span className="customer-option-main">
                    <strong>{c.code}</strong> – {c.name}
                  </span>
                  <span className="customer-option-sub">
                    {c.customer_type === "COMPANY" ? "MST" : "CCCD"} {c.id_number} · ĐT {c.phone}
                  </span>
                </button>
              ))}
              {typed && (
                <button type="button" className="customer-option customer-option-add" onClick={addNew}>
                  Không có khách cần tìm? <strong>+ Thêm khách hàng mới</strong>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default CustomerSearch;
