import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { renderOptions } from "../../utils/options";
import { dateError } from "../../utils/dateLimits";
import DateInput from "./DateInput";

// Hộp thoại form thêm / sửa, vẽ các ô nhập theo danh sách "fields".
//
// Mỗi field: {
//   name, label, type: "text" | "number" | "email" | "select" | "textarea" | "date" | "datetime-local"
//                      | "checkbox" | "file" | "section" (dòng tiêu đề nhóm, không phải ô nhập)
//                      | "custom" (tự vẽ ô nhập bằng render({ form, value, setValue, id, invalid, autoFocus })),
//   required, placeholder, hint, maxLength, accept (file), options: [{ value, label }],
//   emptyOption: "— Chọn —"  → thêm dòng trống đầu danh sách chọn,
//   full: true          → chiếm cả hàng (mặc định chiếm nửa hàng),
//   uppercase: true     → tự viết hoa khi gõ,
//   show(form)          → chỉ hiện khi hàm trả về true (VD: MST chỉ hiện với doanh nghiệp),
//   disabled(form, row) → khoá ô nhập (VD: không cho đổi mã khi đã có thiết bị),
// }
// initialValues: giá trị ban đầu; row: bản ghi đang sửa (null khi thêm mới).
// onSubmit(values): hàm async, trả về chuỗi lỗi nếu thất bại, null nếu thành công.
// children(form): nội dung thêm bên dưới các ô nhập (VD: bảng tính tiền), vẽ lại mỗi khi form đổi.
function FormModal({
  title,
  subtitle,
  fields,
  initialValues,
  row = null,
  submitLabel = "Lưu",
  onSubmit,
  onClose,
  children,
  size = "lg",
}) {
  const [form, setForm] = useState(initialValues);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState(null); // tên ô đang bị lỗi để tô đỏ
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const visibleFields = fields.filter((f) => !f.show || f.show(form));
  const isDisabled = (f) => (f.disabled ? f.disabled(form, row) : false);

  const setValue = (field, value) => {
    setForm((prev) => ({ ...prev, [field.name]: field.uppercase ? value.toUpperCase() : value }));
    if (invalid === field.name) setInvalid(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Kiểm tra ô bắt buộc ngay trên trình duyệt; các điều kiện khác do backend kiểm tra
    const missing = visibleFields.find(
      (f) => f.required && !isDisabled(f) && f.type !== "section" && String(form[f.name] ?? "").trim() === "",
    );
    if (missing) {
      setError(`Vui lòng nhập ${missing.label.toLowerCase()}.`);
      setInvalid(missing.name);
      return;
    }

    // Ô ngày: năm đúng 4 chữ số, ngày có thật, nằm trong min / max của ô (nếu có)
    for (const f of visibleFields) {
      if (!["date", "datetime-local"].includes(f.type) || isDisabled(f)) continue;
      const v = form[f.name];
      const msg =
        dateError(v, f.label) ||
        (v && f.min && String(v) < f.min ? `${f.label} không được trước ${f.minLabel || f.min}.` : "") ||
        (v && f.max && String(v) > f.max ? `${f.label} không được sau ${f.maxLabel || f.max}.` : "");
      if (msg) {
        setError(msg);
        setInvalid(f.name);
        return;
      }
    }

    // Chỉ gửi các ô đang hiện, ô bị ẩn gửi rỗng
    const values = {};
    for (const f of fields) {
      if (f.type === "section") continue;
      values[f.name] = visibleFields.includes(f) ? (form[f.name] ?? "") : "";
    }

    setError("");
    setSubmitting(true);
    const submitError = await onSubmit(values);
    if (submitError) {
      setError(submitError);
      setSubmitting(false);
    }
  };

  // autoFocus: đặt sẵn con trỏ vào ô đầu tiên khi mở hộp thoại
  const renderInput = (f, autoFocus) => {
    const common = {
      id: `field-${f.name}`,
      autoFocus,
      value: form[f.name] ?? "",
      onChange: (e) => setValue(f, e.target.value),
      disabled: isDisabled(f),
      "aria-invalid": invalid === f.name,
      placeholder: f.placeholder,
    };
    if (f.type === "checkbox") {
      return (
        <label className="form-check">
          <input
            id={`field-${f.name}`}
            type="checkbox"
            checked={Boolean(form[f.name])}
            disabled={common.disabled}
            onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.checked }))}
          />
          <span>{f.checkLabel}</span>
        </label>
      );
    }
    if (f.type === "custom") {
      return f.render({
        form,
        value: form[f.name] ?? "",
        setValue: (value) => setValue(f, value),
        id: `field-${f.name}`,
        invalid: invalid === f.name,
        autoFocus,
      });
    }
    if (f.type === "file") {
      return (
        <input
          id={`field-${f.name}`}
          type="file"
          accept={f.accept}
          aria-invalid={invalid === f.name}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, [f.name]: e.target.files[0] || "" }));
            if (invalid === f.name) setInvalid(null);
          }}
        />
      );
    }
    if (f.type === "select") {
      return (
        <select {...common}>
          {f.emptyOption && <option value="">{f.emptyOption}</option>}
          {renderOptions(f.options)}
        </select>
      );
    }
    if (f.type === "textarea") return <textarea rows={3} maxLength={f.maxLength} {...common} />;
    if (f.type === "date" || f.type === "datetime-local") {
      // Ngày luôn nhập và hiển thị theo dd/mm/yyyy, không phụ thuộc ngôn ngữ của trình duyệt
      return (
        <DateInput
          id={common.id}
          autoFocus={autoFocus}
          value={common.value}
          onChange={(v) => setValue(f, v)}
          withTime={f.type === "datetime-local"}
          min={f.min}
          max={f.max}
          disabled={common.disabled}
          invalid={invalid === f.name}
        />
      );
    }
    return (
      <input
        type={["number", "email"].includes(f.type) ? f.type : "text"}
        min={f.type === "number" ? 0 : undefined}
        step={f.type === "number" ? "any" : undefined}
        maxLength={f.maxLength}
        {...common}
      />
    );
  };

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 id="form-modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>

        <form className="modal-body" onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            {visibleFields.map((f, i) =>
              f.type === "section" ? (
                <h3 key={f.name} className="form-section">
                  {f.label}
                </h3>
              ) : (
                <div key={f.name} className={`form-field ${f.full ? "form-field-full" : ""}`}>
                  {f.type !== "checkbox" && (
                    <label htmlFor={`field-${f.name}`}>
                      {f.label}
                      {f.required && <span className="required-mark"> *</span>}
                    </label>
                  )}
                  {renderInput(f, i === 0)}
                  {f.hint && <small className="form-hint">{f.hint}</small>}
                </div>
              ),
            )}
          </div>

          {children?.(form)}

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Huỷ
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Đang lưu…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export default FormModal;
