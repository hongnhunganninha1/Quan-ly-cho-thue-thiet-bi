import { useEffect, useRef, useState } from "react";

// Ô chọn dạng cây 2 cấp: hiện danh mục cấp 1, bấm mũi tên để mở ra danh mục cấp 2.
// options: [{ value, label, children: [{ value, label }] }]; chọn được cả cấp 1 lẫn cấp 2
function TreeSelect({ value, onChange, options, placeholder, allLabel, className = "", ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState({}); // { [value cấp 1]: true } nhóm đang mở
  const [panelPos, setPanelPos] = useState(null); // vị trí khung xổ xuống (cố định theo màn hình để không bị khung bảng che)
  const boxRef = useRef(null);

  // Bấm ra ngoài hoặc nhấn Esc thì đóng
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    const onScroll = (e) => !e.target.closest?.(".tree-select-panel") && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScroll);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const parentOf = (v) => options.find((g) => g.children?.some((c) => c.value === v));
  const selected = options.find((g) => g.value === value) || parentOf(value)?.children.find((c) => c.value === value);

  const toggleOpen = () => {
    // Mở lại thì tự bung nhóm chứa mục đang chọn
    const parent = parentOf(value);
    if (!open && parent) setExpanded((prev) => ({ ...prev, [parent.value]: true }));
    if (!open) {
      const r = boxRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left, minWidth: Math.max(r.width, 280) });
    }
    setOpen(!open);
  };

  const pick = (v) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div className={`tree-select ${className}`} ref={boxRef}>
      <button
        type="button"
        className={`tree-select-button ${selected ? "has-value" : ""}`}
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        title={selected?.label || placeholder}
      >
        <span className="tree-select-text">{selected?.label || placeholder}</span>
      </button>

      {open && (
        <div className="tree-select-panel" role="listbox" style={panelPos}>
          <button type="button" className={`tree-option ${!value ? "selected" : ""}`} onClick={() => pick("")}>
            {allLabel}
          </button>
          {options.map((g) => {
            const isOpen = Boolean(expanded[g.value]);
            const hasChildren = g.children?.length > 0;
            return (
              <div key={g.value}>
                <div className={`tree-option tree-group ${value === g.value ? "selected" : ""}`}>
                  <button
                    type="button"
                    className={`tree-caret ${isOpen ? "open" : ""}`}
                    onClick={() => setExpanded((prev) => ({ ...prev, [g.value]: !isOpen }))}
                    disabled={!hasChildren}
                    aria-label={isOpen ? "Thu gọn" : "Mở rộng"}
                  >
                    {hasChildren ? "›" : ""}
                  </button>
                  <button type="button" className="tree-label" onClick={() => pick(g.value)}>
                    {g.label}
                  </button>
                </div>
                {isOpen &&
                  g.children.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      className={`tree-option tree-child ${value === c.value ? "selected" : ""}`}
                      onClick={() => pick(c.value)}
                    >
                      {c.label}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TreeSelect;
