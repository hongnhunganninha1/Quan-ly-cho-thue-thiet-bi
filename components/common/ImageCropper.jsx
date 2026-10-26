import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ImageCropper.css";

const MAX_ZOOM = 4;

// Hộp thoại căn chỉnh ảnh trước khi tải lên: kéo để di chuyển, phóng to / thu nhỏ, xoay 90°.
// Ảnh luôn phủ kín khung cắt (không để lộ khoảng trống).
//   file      : File ảnh người dùng vừa chọn
//   aspect    : tỉ lệ khung cắt rộng / cao (1 = vuông, 4/3 …)
//   shape     : "circle" (ảnh đại diện) | "rect"
//   outputWidth: chiều rộng ảnh xuất ra (px)
//   onDone(file): trả về File ảnh đã cắt (JPEG); onCancel(): bỏ qua
function ImageCropper({
  file,
  aspect = 1,
  shape = "rect",
  outputWidth = 800,
  title = "Căn chỉnh ảnh",
  onDone,
  onCancel,
}) {
  const frameW = 360;
  const frameH = Math.round(frameW / aspect);
  const [img, setImg] = useState(null); // { el, w, h }
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0); // 0 | 90 | 180 | 270
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // tâm ảnh so với tâm khung (px)
  const [saving, setSaving] = useState(false);
  const drag = useRef(null);

  // Đọc ảnh
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => setImg({ el, src: url, w: el.naturalWidth, h: el.naturalHeight });
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Kích thước ảnh sau khi xoay và tỉ lệ phóng để phủ kín khung
  const turned = rotate % 180 !== 0;
  const effW = img ? (turned ? img.h : img.w) : 1;
  const effH = img ? (turned ? img.w : img.h) : 1;
  const scale = Math.max(frameW / effW, frameH / effH) * zoom;

  // Giữ ảnh không trượt ra ngoài khung
  const clamp = useCallback(
    (o) => {
      const maxX = Math.max(0, (effW * scale - frameW) / 2);
      const maxY = Math.max(0, (effH * scale - frameH) / 2);
      return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
    },
    [effW, effH, scale, frameW, frameH],
  );

  // Vị trí thực tế (đã giới hạn) — thu nhỏ / xoay xong ảnh tự kéo về cho phủ kín khung
  const pos = clamp(offset);

  useEffect(() => {
    // Bắt phím Esc trước (capture) để chỉ đóng hộp thoại căn chỉnh, không đóng luôn form phía sau
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, start: pos };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const d = drag.current;
    setOffset(clamp({ x: d.start.x + e.clientX - d.x, y: d.start.y + e.clientY - d.y }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const onWheel = (e) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))));
  };

  const reset = () => {
    setZoom(1);
    setRotate(0);
    setOffset({ x: 0, y: 0 });
  };

  // Vẽ phần ảnh nằm trong khung ra canvas rồi xuất thành file JPEG
  const save = () => {
    if (!img) return;
    setSaving(true);
    const outW = outputWidth;
    const outH = Math.round(outputWidth / aspect);
    const k = outW / frameW;
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // ảnh PNG trong suốt thì nền trắng
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = "high";
    ctx.translate(outW / 2 + pos.x * k, outH / 2 + pos.y * k);
    ctx.rotate((rotate * Math.PI) / 180);
    const dw = img.w * scale * k;
    const dh = img.h * scale * k;
    ctx.drawImage(img.el, -dw / 2, -dh / 2, dw, dh);
    canvas.toBlob(
      (blob) => {
        setSaving(false);
        if (!blob) return;
        const name = `${file.name.replace(/\.[^.]+$/, "") || "anh"}.jpg`;
        onDone(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  };

  return createPortal(
    <div className="modal-backdrop cropper-backdrop" onMouseDown={onCancel}>
      <div className="modal cropper" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            <p className="modal-subtitle">Kéo ảnh để chọn vị trí, dùng thanh trượt hoặc con lăn chuột để phóng to.</p>
          </div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Đóng">
            ×
          </button>
        </header>
        <div className="modal-body">
          <div
            className={`cropper-frame ${shape === "circle" ? "circle" : ""}`}
            style={{ width: frameW, height: frameH }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
          >
            {img && (
              <img
                src={img.src}
                alt="Ảnh cần căn chỉnh"
                draggable={false}
                style={{
                  width: img.w * scale,
                  height: img.h * scale,
                  transform: `translate(-50%, -50%) translate(${pos.x}px, ${pos.y}px) rotate(${rotate}deg)`,
                }}
              />
            )}
            <div className="cropper-mask" />
          </div>

          <div className="cropper-controls">
            <label className="cropper-zoom">
              <span>Thu phóng</span>
              <input
                type="range"
                min="1"
                max={MAX_ZOOM}
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
              <span className="cropper-zoom-value">{Math.round(zoom * 100)}%</span>
            </label>
            <div className="cropper-buttons">
              <button type="button" className="btn btn-secondary" onClick={() => setRotate((r) => (r + 270) % 360)}>
                ⟲ Xoay trái
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setRotate((r) => (r + 90) % 360)}>
                ⟳ Xoay phải
              </button>
              <button type="button" className="btn btn-secondary" onClick={reset}>
                Đặt lại
              </button>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Huỷ
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={!img || saving}>
              {saving ? "Đang xử lý…" : "Dùng ảnh này"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ImageCropper;
