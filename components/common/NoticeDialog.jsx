import { useState } from "react";
import { createPortal } from "react-dom";

// Chép chữ vào bộ nhớ tạm (clipboard); trình duyệt cũ không hỗ trợ thì dùng cách dự phòng
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function CopyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

// Hộp thoại thông báo quan trọng cần người dùng ghi lại (VD: mật khẩu tạm vừa cấp).
// notice: { title, lines: ["Tên đăng nhập: an.nv", "Mật khẩu tạm: Ab3..."], note }
// Mỗi dòng dạng "Nhãn: giá trị" có nút sao chép riêng giá trị; nút "Sao chép tất cả" chép cả khối.
function NoticeDialog({ notice, onClose }) {
  const [copied, setCopied] = useState(null); // chỉ số dòng vừa chép, hoặc "all"

  const items = notice.lines.map((line) => {
    const i = line.indexOf(": ");
    return i > 0 ? { label: line.slice(0, i), value: line.slice(i + 2), line } : { label: null, value: line, line };
  });

  const copy = async (text, key) => {
    if (await copyText(text)) {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    }
  };

  return createPortal(
    <div className="modal-backdrop">
      <div className="modal" role="alertdialog" aria-modal="true">
        <header className="modal-header">
          <h2>{notice.title}</h2>
        </header>
        <div className="modal-body">
          <div className="notice-box">
            {items.map((it, i) => (
              <div key={it.line} className="notice-row">
                <span>
                  {it.label && <span className="notice-label">{it.label}: </span>}
                  <strong>{it.value}</strong>
                </span>
                <button
                  type="button"
                  className={`copy-button ${copied === i ? "done" : ""}`}
                  onClick={() => copy(it.value, i)}
                  title={copied === i ? "Đã sao chép" : `Sao chép ${it.label ? it.label.toLowerCase() : ""}`}
                  aria-label={`Sao chép ${it.label || it.value}`}
                >
                  {copied === i ? <CheckIcon /> : <CopyIcon />}
                  <span>{copied === i ? "Đã chép" : "Sao chép"}</span>
                </button>
              </div>
            ))}
          </div>
          {notice.note && <p className="notice-note">{notice.note}</p>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => copy(notice.lines.join("\n"), "all")}>
              {copied === "all" ? <CheckIcon /> : <CopyIcon />}
              {copied === "all" ? "Đã sao chép" : "Sao chép tất cả"}
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
              Đã ghi lại
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default NoticeDialog;
