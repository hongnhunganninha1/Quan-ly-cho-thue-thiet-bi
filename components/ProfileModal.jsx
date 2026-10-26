import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";
import useApiData from "../hooks/useApiData";
import UserAvatar from "./common/UserAvatar";
import { CameraIcon, TrashIcon } from "./common/Icons";
import { formatDate, formatDateTime } from "../utils/format";
import { GENDER } from "../utils/labels";
import "../pages/catalog/CatalogPage.css"; // khung hộp thoại, ô nhập
import "../pages/equipment/Equipment.css"; // bảng thông tin (info-grid)
import ImageCropper from "./common/ImageCropper";
import "./ProfileModal.css";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Hộp thoại "Hồ sơ cá nhân": ai đăng nhập cũng xem được hồ sơ của mình,
// tự sửa số điện thoại, email, địa chỉ và đổi ảnh đại diện.
// Họ tên, CCCD, phòng ban, chức vụ… chỉ xem; muốn sửa thì nhờ Quản lý (màn Quản lý nhân viên).
// onSaved({ avatarUrl }): báo cho App cập nhật ảnh trên thanh đầu trang.
function ProfileModal({ onClose, onSaved }) {
  const { data, error } = useApiData("/profile");

  useEffect(() => {
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-lg" role="dialog" aria-modal="true" aria-labelledby="profile-title" onMouseDown={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2 id="profile-title">Hồ sơ cá nhân</h2>
            <p className="modal-subtitle">Bạn có thể cập nhật ảnh đại diện và thông tin liên hệ của mình.</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            ×
          </button>
        </header>
        {error && <div className="modal-body"><div className="modal-error">{error}</div></div>}
        {!data && !error && <div className="modal-body text-muted">Đang tải…</div>}
        {data && <ProfileForm profile={data} onClose={onClose} onSaved={onSaved} />}
      </div>
    </div>,
    document.body
  );
}

// Form tách riêng để khởi tạo giá trị từ hồ sơ vừa tải về
function ProfileForm({ profile, onClose, onSaved }) {
  const [form, setForm] = useState({ phone: profile.phone || "", email: profile.email || "", address: profile.address || "" });
  const [avatar, setAvatar] = useState(profile.avatar_url || ""); // "" | URL đang có | File mới chọn
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const isFile = avatar instanceof File;
  const avatarSrc = useMemo(() => (isFile ? URL.createObjectURL(avatar) : avatar), [isFile, avatar]);
  useEffect(() => {
    if (!isFile) return undefined;
    return () => URL.revokeObjectURL(avatarSrc);
  }, [isFile, avatarSrc]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const [cropping, setCropping] = useState(null); // ảnh gốc đang căn chỉnh
  const [original, setOriginal] = useState(null); // ảnh gốc vừa chọn (để căn chỉnh lại)

  // Chọn ảnh xong thì mở hộp thoại căn chỉnh; ảnh lưu lên là ảnh đã cắt vuông 400×400
  const pickAvatar = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type)) return setError("Ảnh đại diện chỉ nhận JPG, PNG hoặc WEBP.");
    if (file.size > 20 * 1024 * 1024) return setError("Ảnh gốc tối đa 20 MB.");
    setError("");
    setOriginal(file);
    setCropping(file);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.put("/profile", form);
      let avatarUrl = profile.avatar_url || null;
      if (isFile) {
        const fd = new FormData();
        fd.append("avatar", avatar);
        avatarUrl = (await api.upload("/profile/avatar", fd)).avatar_url;
      } else if (!avatar && profile.avatar_url) {
        await api.del("/profile/avatar");
        avatarUrl = null;
      }
      onSaved({ avatarUrl });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const info = [
    ["Mã nhân viên", profile.code],
    ["Giới tính", GENDER[profile.gender]],
    ["Ngày sinh", formatDate(profile.date_of_birth)],
    ["Số CCCD", profile.id_number],
    ["Phòng ban", profile.department_name],
    ["Chức vụ", profile.position],
    ["Ngày vào làm", formatDate(profile.hire_date)],
    ["Tài khoản", `${profile.username} · ${profile.role_name}`],
    ["Đăng nhập gần nhất", formatDateTime(profile.last_login_at)],
  ];

  return (
    <form className="modal-body" onSubmit={save} noValidate>
      <div className="profile-top">
        <div className="profile-avatar">
          <UserAvatar name={profile.full_name} url={avatarSrc} size={96} />
          <div className="profile-avatar-actions">
            <button type="button" className="btn btn-secondary btn-icon" onClick={() => fileRef.current?.click()}>
              <CameraIcon /> {avatarSrc ? "Đổi ảnh" : "Chọn ảnh"}
            </button>
            {isFile && original && (
              <button type="button" className="btn btn-secondary" onClick={() => setCropping(original)}>
                Căn chỉnh
              </button>
            )}
            {avatarSrc && (
              <button type="button" className="btn btn-secondary btn-icon" onClick={() => setAvatar("")}>
                <TrashIcon /> Bỏ ảnh
              </button>
            )}
          </div>
          {isFile && <small className="text-muted">Ảnh mới sẽ được lưu khi bấm Lưu thay đổi.</small>}
          <input ref={fileRef} type="file" accept={AVATAR_TYPES.join(",")} hidden onChange={pickAvatar} />
          {cropping && (
            <ImageCropper
              file={cropping}
              aspect={1}
              shape="circle"
              outputWidth={400}
              title="Căn chỉnh ảnh đại diện"
              onCancel={() => setCropping(null)}
              onDone={(f) => {
                setAvatar(f);
                setCropping(null);
              }}
            />
          )}
        </div>
        <div className="profile-name">
          <h3>{profile.full_name}</h3>
          <span>
            {profile.position || "Nhân viên"} · {profile.department_name}
          </span>
        </div>
      </div>

      <h3 className="form-section">Thông tin nhân viên</h3>
      <dl className="info-grid">
        {info.map(([label, value]) => (
          <div className="info-item" key={label}>
            <dt>{label}</dt>
            <dd>{value || <span className="text-muted">—</span>}</dd>
          </div>
        ))}
      </dl>
      <p className="form-hint profile-note">Cần sửa họ tên, CCCD, phòng ban hoặc chức vụ? Hãy liên hệ Quản lý.</p>

      <h3 className="form-section">Thông tin liên hệ</h3>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="profile-phone">Số điện thoại</label>
          <input id="profile-phone" value={form.phone} onChange={set("phone")} maxLength={11} placeholder="VD: 0912345678" />
        </div>
        <div className="form-field">
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" type="email" value={form.email} onChange={set("email")} maxLength={100} />
        </div>
        <div className="form-field form-field-full">
          <label htmlFor="profile-address">Địa chỉ</label>
          <input id="profile-address" value={form.address} onChange={set("address")} maxLength={255} />
        </div>
      </div>

      {error && <div className="modal-error">{error}</div>}

      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Huỷ
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}

export default ProfileModal;
