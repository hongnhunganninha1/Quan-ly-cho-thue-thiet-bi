import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./PrintPreview.css";

// Xem trước bản in (hợp đồng, biên bản bàn giao / thu hồi) trước khi in.
// load(): hàm async trả về { title, html } (xem utils/printDocs.js).
// Bấm "In / Lưu PDF" mới mở hộp thoại in của trình duyệt (chọn "Lưu dưới dạng PDF" để lấy file); "Đóng" để thoát.
function PrintPreview({ load, onClose }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const frameRef = useRef(null);

  useEffect(() => {
    let alive = true;
    load()
      .then((d) => alive && setDoc(d))
      .catch((err) => alive && setError(err.message || "Không tải được dữ liệu để in."));
    return () => {
      alive = false;
    };
  }, [load]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const print = () => {
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  return createPortal(
    <div className="modal-backdrop print-preview-backdrop" onMouseDown={onClose}>
      <div className="print-preview" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="print-preview-bar">
          <div>
            <strong>{doc ? doc.title : "Bản xem trước"}</strong>
            <span>Xem lại nội dung, bấm "In / Lưu PDF" để in hoặc lưu thành file PDF.</span>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="print-preview-body">
          {error && <div className="modal-error">{error}</div>}
          {!doc && !error && <p className="print-preview-loading">Đang chuẩn bị bản in…</p>}
          {doc && <iframe ref={frameRef} title={doc.title} srcDoc={doc.html} />}
        </div>
        <footer className="print-preview-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Đóng
          </button>
          <button type="button" className="btn btn-primary" onClick={print} disabled={!doc}>
            In / Lưu PDF
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export default PrintPreview;
