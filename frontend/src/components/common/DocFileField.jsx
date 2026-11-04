import { useEffect, useMemo, useRef, useState } from "react";
import { EyeIcon, PlusIcon, TrashIcon } from "./Icons";
import { PhotoLightbox } from "./MeterPhoto";
import "./MeterPhoto.css";

// Ô chọn file giấy tờ thiết bị: ảnh thì hiện luôn ảnh xem trước, PDF hiện trang đầu, Word hiện tên file.
const MAX_SIZE = 10 * 1024 * 1024; // tối đa 10 MB (khớp giới hạn của backend)
const sizeText = (b) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function DocFileField({ id, value, setValue, invalid, accept }) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(false);
  const isFile = value instanceof File;
  const kind = !isFile ? "" : value.type.startsWith("image/") ? "image" : value.type === "application/pdf" ? "pdf" : "other";
  const src = useMemo(() => (isFile && kind !== "other" ? URL.createObjectURL(value) : ""), [isFile, kind, value]);

  useEffect(() => {
    if (!src) return undefined;
    return () => URL.revokeObjectURL(src);
  }, [src]);

  const onPick = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_SIZE) {
      setError("File tối đa 10 MB.");
      return;
    }
    setError("");
    setValue(file);
  };

  return (
    <div className="meter-field">
      <button
        type="button"
        className={`doc-field-box ${kind === "image" ? "has-image" : ""} ${invalid ? "invalid" : ""}`}
        onClick={() => (kind === "image" ? setZoom(true) : fileRef.current?.click())}
        title={kind === "image" ? "Bấm để xem ảnh lớn" : "Bấm để chọn file"}
      >
        {kind === "image" && <img src={src} alt={value.name} />}
        {kind === "pdf" && <iframe src={`${src}#toolbar=0&navpanes=0`} title={value.name} tabIndex={-1} />}
        {kind === "other" && (
          <span className="meter-field-empty">
            <span className="doc-field-ext">{value.name.split(".").pop().toUpperCase()}</span>
            Không xem trước được loại file này
          </span>
        )}
        {!kind && (
          <span className="meter-field-empty">
            <PlusIcon />
            Chọn ảnh / file giấy tờ
          </span>
        )}
      </button>
      {isFile && (
        <small className="form-hint">
          {value.name} · {sizeText(value.size)}
        </small>
      )}

      <div className="meter-field-actions">
        <button type="button" className="btn btn-secondary btn-icon" onClick={() => fileRef.current?.click()}>
          <PlusIcon /> {isFile ? "Chọn file khác" : "Chọn file"}
        </button>
        {kind === "image" && (
          <button type="button" className="btn btn-secondary btn-icon" onClick={() => setZoom(true)}>
            <EyeIcon /> Xem lớn
          </button>
        )}
        {isFile && (
          <button type="button" className="btn btn-secondary btn-icon" onClick={() => setValue("")}>
            <TrashIcon /> Bỏ file
          </button>
        )}
      </div>
      {error && <small className="text-danger">{error}</small>}

      <input id={id} ref={fileRef} type="file" accept={accept} hidden onChange={onPick} />
      {zoom && kind === "image" && <PhotoLightbox src={src} title={value.name} onClose={() => setZoom(false)} />}
    </div>
  );
}
