import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CameraIcon, EyeIcon, TrashIcon } from "./Icons";
import "./MeterPhoto.css";

// Ảnh chụp đồng hồ giờ máy (phiếu bàn giao / phiếu thu hồi).
// Ảnh giữ nguyên khung hình gốc (không cắt) để làm bằng chứng, chỉ thu nhỏ còn tối đa 1600px cho nhẹ.

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 20 * 1024 * 1024; // ảnh gốc tối đa 20 MB
const MAX_SIDE = 1600;

// Thu nhỏ ảnh về cạnh dài tối đa 1600px, xuất JPEG
function shrinkImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], "dong-ho-gio-may.jpg", { type: "image/jpeg" }) : file),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

// Xem ảnh phóng to
export function PhotoLightbox({ src, title, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation(); // chỉ đóng ảnh, không đóng form phía dưới
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div className="meter-lightbox" onMouseDown={onClose}>
      <figure onMouseDown={(e) => e.stopPropagation()}>
        <figcaption>
          <span>{title}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </figcaption>
        <img src={src} alt={title} />
      </figure>
    </div>,
    document.body,
  );
}

// Ảnh nhỏ trong bảng, bấm để xem lớn. url rỗng thì hiện "—".
// large: ảnh to (dùng trong màn xem chi tiết phiếu)
export function MeterPhotoThumb({ url, title = "Ảnh đồng hồ giờ máy", large = false, emptyText = "—" }) {
  const [open, setOpen] = useState(false);
  if (!url) return <span className={large ? "meter-thumb-empty" : "text-muted"}>{emptyText}</span>;
  return (
    <>
      <button type="button" className={`meter-thumb ${large ? "meter-thumb-lg" : ""}`} onClick={() => setOpen(true)} title="Bấm để xem ảnh lớn">
        <img src={url} alt={title} loading="lazy" />
      </button>
      {open && <PhotoLightbox src={url} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

// Ô chụp / chọn ảnh đồng hồ trong form (dùng với field type "custom" của FormModal).
//   value: File ảnh đã chọn | ""
//   compareUrl: ảnh đồng hồ lúc bàn giao (hiện cạnh bên để đối chiếu khi thu hồi)
export function MeterPhotoField({ id, value, setValue, invalid, compareUrl, compareTitle }) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(null); // { src, title }
  const isFile = value instanceof File;
  const src = useMemo(() => (isFile ? URL.createObjectURL(value) : ""), [isFile, value]);

  useEffect(() => {
    if (!isFile) return undefined;
    return () => URL.revokeObjectURL(src);
  }, [isFile, src]);

  const onPick = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setError("Chỉ nhận ảnh JPG, PNG hoặc WEBP.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("Ảnh gốc tối đa 20 MB.");
      return;
    }
    setError("");
    setBusy(true);
    setValue(await shrinkImage(file));
    setBusy(false);
  };

  return (
    <div className="meter-field">
      <div className="meter-field-row">
        <button
          type="button"
          className={`meter-field-box ${src ? "has-image" : ""} ${invalid ? "invalid" : ""}`}
          onClick={() => (src ? setZoom({ src, title: "Ảnh đồng hồ vừa chụp" }) : fileRef.current?.click())}
          title={src ? "Bấm để xem ảnh lớn" : "Bấm để chụp / chọn ảnh"}
        >
          {src ? (
            <img src={src} alt="Ảnh đồng hồ giờ máy" />
          ) : (
            <span className="meter-field-empty">
              <CameraIcon />
              {busy ? "Đang xử lý ảnh…" : "Chụp / chọn ảnh đồng hồ"}
            </span>
          )}
        </button>

        {compareUrl && (
          <button
            type="button"
            className="meter-field-box has-image meter-field-compare"
            onClick={() => setZoom({ src: compareUrl, title: compareTitle })}
            title="Bấm để xem ảnh lớn"
          >
            <img src={compareUrl} alt={compareTitle} />
            <span className="meter-field-tag">{compareTitle}</span>
          </button>
        )}
      </div>

      <div className="meter-field-actions">
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => fileRef.current?.click()} disabled={busy}>
          <CameraIcon /> {src ? "Chụp lại" : "Chụp / chọn ảnh"}
        </button>
        {src && (
          <>
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setZoom({ src, title: "Ảnh đồng hồ vừa chụp" })}>
              <EyeIcon /> Xem lớn
            </button>
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setValue("")}>
              <TrashIcon /> Bỏ ảnh
            </button>
          </>
        )}
      </div>
      {error && <small className="text-danger">{error}</small>}

      {/* capture: mở thẳng camera sau khi dùng trên điện thoại / máy tính bảng */}
      <input id={id} ref={fileRef} type="file" accept={TYPES.join(",")} capture="environment" hidden onChange={onPick} />
      {zoom && <PhotoLightbox src={zoom.src} title={zoom.title} onClose={() => setZoom(null)} />}
    </div>
  );
}
