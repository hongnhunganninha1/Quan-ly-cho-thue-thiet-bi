import { useRef, useState } from "react";
import { CameraIcon } from "../../components/common/Icons";
import { findCandidates, readTextFromImage } from "../../utils/modelOcr";

// Ô nhập mã đọc được từ ảnh tem máy, dùng cho Model, Số serial (số khung), Số máy (số động cơ). Có 2 cách:
//  1. Gõ tay.
//  2. Bấm "Đọc từ ảnh", chọn ảnh chụp tem / biển tên máy → hệ thống đọc chữ trong ảnh (OCR)
//     và gợi ý các mã phù hợp; bấm vào gợi ý để điền, vẫn sửa tay được.
// kind: "model" | "serial" | "engine" – quyết định cách chọn mã gợi ý.
const NOT_FOUND = {
  model: "Không tìm thấy mã model trong ảnh.",
  serial: "Không tìm thấy số serial trong ảnh.",
  engine: "Không tìm thấy số máy trong ảnh.",
};

function ModelInput({ id, value, setValue, invalid, disabled, kind = "model", placeholder = "VD: PC200-8", maxLength = 100 }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null); // ảnh vừa chọn
  const [progress, setProgress] = useState(null); // null: không đọc; 0..100: đang đọc
  const [candidates, setCandidates] = useState(null); // null: chưa đọc; []: không tìm thấy
  const [error, setError] = useState("");

  const onPick = async (e) => {
    const file = e.target.files[0];
    e.target.value = ""; // cho phép chọn lại cùng 1 ảnh
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Hãy chọn file ảnh (JPG, PNG…).");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setError("");
    setCandidates(null);
    setProgress(0);
    try {
      const text = await readTextFromImage(file, setProgress);
      const found = findCandidates(text, kind);
      setCandidates(found);
      if (found.length > 0 && !String(value).trim()) setValue(found[0]); // ô đang trống thì điền sẵn gợi ý đầu tiên
    } catch {
      setError("Không đọc được ảnh, hãy thử ảnh khác hoặc nhập tay.");
    } finally {
      setProgress(null);
    }
  };

  const reading = progress !== null;

  return (
    <div className="model-input">
      <div className="model-input-row">
        <input
          id={id}
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
        />
        <button
          type="button"
          className="btn btn-secondary btn-icon model-ocr-btn"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || reading}
          title="Chụp / chọn ảnh tem máy để hệ thống tự đọc mã"
        >
          <CameraIcon /> {reading ? `Đang đọc ${progress}%` : "Đọc từ ảnh"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onPick} />
      </div>

      {(preview || error) && (
        <div className="model-ocr-result">
          {preview && <img src={preview} alt="Ảnh tem máy" className="model-ocr-thumb" />}
          <div className="model-ocr-text">
            {error && <span className="text-danger">{error}</span>}
            {reading && <span className="text-muted">Đang nhận dạng chữ trong ảnh…</span>}
            {candidates?.length === 0 && (
              <span className="text-muted">{NOT_FOUND[kind]} Hãy chụp rõ, thẳng tem máy hoặc nhập tay.</span>
            )}
            {candidates?.length > 0 && (
              <>
                <span className="text-muted">Gợi ý từ ảnh (bấm để chọn, kiểm tra lại trước khi lưu):</span>
                <div className="model-chips">
                  {candidates.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`model-chip ${c === value ? "active" : ""}`}
                      onClick={() => setValue(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ModelInput;
