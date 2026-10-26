import { useEffect, useMemo, useRef, useState } from "react";
import { CameraIcon, TrashIcon } from "../../components/common/Icons";
import ImageCropper from "../../components/common/ImageCropper";

const MAX_SIZE = 20 * 1024 * 1024; // ảnh gốc tối đa 20 MB; ảnh sau khi căn chỉnh chỉ còn vài trăm KB (backend nhận tối đa 5 MB)
const TYPES = ["image/jpeg", "image/png", "image/webp"];

// Ô "Ảnh thiết bị" trong form thêm / sửa.
// value: "" (không có ảnh) | chuỗi URL ảnh đang có | File ảnh mới chọn (chưa tải lên).
// Ảnh được tải lên sau khi lưu thông tin máy và dùng làm ảnh đại diện trong danh sách.
function ImageField({ id, value, setValue, disabled }) {
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [cropping, setCropping] = useState(null); // ảnh gốc đang căn chỉnh
  const [original, setOriginal] = useState(null); // ảnh gốc vừa chọn (để căn chỉnh lại)
  const isFile = value instanceof File;
  const src = useMemo(() => (isFile ? URL.createObjectURL(value) : value || ""), [isFile, value]);

  // Giải phóng ảnh tạm khi đổi ảnh khác hoặc đóng form
  useEffect(() => {
    if (!isFile) return undefined;
    return () => URL.revokeObjectURL(src);
  }, [isFile, src]);

  const onPick = (e) => {
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
    setOriginal(file);
    setCropping(file); // mở hộp thoại căn chỉnh, ảnh lưu là ảnh đã cắt tỉ lệ 4:3
  };

  return (
    <div className="image-field">
      <button
        type="button"
        className={`image-field-box ${src ? "has-image" : ""}`}
        onClick={() => fileRef.current?.click()}
        disabled={disabled}
        title={src ? "Bấm để đổi ảnh" : "Bấm để chọn ảnh"}
      >
        {src ? (
          <img src={src} alt="Ảnh thiết bị" />
        ) : (
          <span className="image-field-empty">
            <CameraIcon />
            Chọn ảnh thiết bị
          </span>
        )}
      </button>
      <div className="image-field-side">
        <div className="image-field-actions">
          <button type="button" className="btn btn-secondary btn-icon" onClick={() => fileRef.current?.click()} disabled={disabled}>
            <CameraIcon /> {src ? "Đổi ảnh" : "Chọn ảnh"}
          </button>
          {isFile && original && (
            <button type="button" className="btn btn-secondary" onClick={() => setCropping(original)} disabled={disabled}>
              Căn chỉnh
            </button>
          )}
          {src && (
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => setValue("")} disabled={disabled}>
              <TrashIcon /> Bỏ ảnh
            </button>
          )}
        </div>
        {isFile && <small className="text-muted">Ảnh mới đã căn chỉnh – sẽ được lưu khi bấm Lưu.</small>}
        {error && <small className="text-danger">{error}</small>}
      </div>
      <input id={id} ref={fileRef} type="file" accept={TYPES.join(",")} hidden onChange={onPick} />
      {cropping && (
        <ImageCropper
          file={cropping}
          aspect={4 / 3}
          outputWidth={1200}
          title="Căn chỉnh ảnh thiết bị"
          onCancel={() => setCropping(null)}
          onDone={(f) => {
            setValue(f);
            setCropping(null);
          }}
        />
      )}
    </div>
  );
}

export default ImageField;
