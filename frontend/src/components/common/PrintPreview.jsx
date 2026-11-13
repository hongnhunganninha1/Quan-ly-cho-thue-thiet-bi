import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./PrintPreview.css";

// In hợp đồng, biên bản bàn giao / thu hồi: bấm In là mở thẳng hộp thoại in của trình duyệt
// (xem trước, chọn máy in hoặc "Lưu dưới dạng PDF" ngay trong hộp thoại đó), không qua khung xem trước.
// load(): hàm async trả về { title, html } (xem utils/printDocs.js). Văn bản được nạp vào một khung ẩn rồi in.
function PrintPreview({ load, onClose }) {
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState("");
  const frameRef = useRef(null);
  const printed = useRef(false);

  useEffect(() => {
    let alive = true;
    printed.current = false; // bấm In văn bản khác thì in lại từ đầu
    setDoc(null);
    setError("");
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

  // Khung ẩn đã tải xong văn bản (kể cả ảnh đồng hồ giờ máy) → mở hộp thoại in; in xong / huỷ thì đóng
  const printWhenReady = () => {
    const w = frameRef.current?.contentWindow;
    if (!w || printed.current) return;
    printed.current = true;
    const title = document.title;
    document.title = doc.title; // tên file PDF gợi ý = tên văn bản
    w.addEventListener("afterprint", () => setTimeout(onClose, 0), { once: true });
    setTimeout(() => {
      w.focus();
      w.print();
      document.title = title;
    }, 50);
  };

  return createPortal(
    <>
      {doc && (
        <iframe
          ref={frameRef}
          className="print-frame"
          title={doc.title}
          srcDoc={doc.html}
          onLoad={printWhenReady}
          aria-hidden="true"
          tabIndex={-1}
        />
      )}
      {(error || !doc) && (
        <div className="modal-backdrop print-preview-backdrop" onMouseDown={onClose}>
          <div className="print-status" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            {error ? (
              <>
                <div className="modal-error">{error}</div>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Đóng
                </button>
              </>
            ) : (
              <p className="print-preview-loading">Đang chuẩn bị bản in…</p>
            )}
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

export default PrintPreview;
