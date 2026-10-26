import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import StatusBadge from "../../components/common/StatusBadge";
import EquipmentThumb from "../../components/common/EquipmentThumb";
import FormModal from "../../components/common/FormModal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Toast from "../../components/common/Toast";
import ImageCropper from "../../components/common/ImageCropper";
import { formatDate, formatDateTime, formatMoney, formatNumber } from "../../utils/format";
import { CONTRACT_STATUS, DOC_TYPES, EQUIPMENT_STATUS, ITEM_CONDITION, toOptions } from "../../utils/labels";
import { todayStr } from "../../utils/dateLimits";

const TABS = [
  { key: "info", label: "Thông tin" },
  { key: "docs", label: "Giấy tờ" },
  { key: "rentals", label: "Lịch sử cho thuê" },
];

// Trạng thái người dùng được tự đổi (các trạng thái khác do hợp đồng đổi)
const MANUAL_STATUS = [
  { value: "AVAILABLE", label: "Sẵn sàng (đã sửa xong / hoạt động lại)" },
  { value: "INACTIVE", label: "Ngừng hoạt động (hỏng, bảo dưỡng)" },
  { value: "LIQUIDATED", label: "Đã thanh lý (không dùng nữa)" },
];

// Số ngày còn lại đến ngày hết hạn của giấy tờ
function daysUntil(date) {
  if (!date) return null;
  return Math.ceil(
    (new Date(`${String(date).slice(0, 10)}T00:00:00`) - new Date(new Date().toDateString())) / 86400000,
  );
}

// Hộp thoại hồ sơ chi tiết một thiết bị
// initialTab: tab mở sẵn ("info" | "docs" | "rentals"); initialForm: "status" để mở luôn hộp thoại đổi trạng thái
function EquipmentDetailModal({
  id,
  onClose,
  onChanged,
  canManageStatus = false,
  initialTab = "info",
  initialForm = null,
}) {
  const { data: eq, error, reload } = useApiData(`/equipments/${id}`);
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState(initialForm); // "doc" | "status"
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [newImage, setNewImage] = useState(null); // ảnh vừa chọn, chưa lưu: { file, preview }
  const [cropping, setCropping] = useState(null); // ảnh gốc đang căn chỉnh
  const [savingImage, setSavingImage] = useState(false);
  const [confirm, setConfirm] = useState(null); // "removeImage" | "closeUnsaved"
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  // Đóng hồ sơ: nếu có ảnh mới chưa lưu thì hỏi lại trước
  const requestClose = useCallback(() => {
    if (newImage) setConfirm("closeUnsaved");
    else onClose();
  }, [newImage, onClose]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !form && !deletingDoc && !confirm) requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose, form, deletingDoc, confirm]);

  // Giải phóng bộ nhớ của ảnh xem trước khi không dùng nữa
  useEffect(() => () => newImage && URL.revokeObjectURL(newImage.preview), [newImage]);

  const changed = (message) => {
    setToast({ type: "success", message });
    reload();
    onChanged();
  };

  const uploadDoc = async (values) => {
    if (!(values.file instanceof File)) return "Vui lòng chọn file giấy tờ.";
    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) fd.append(k, v);
    try {
      const r = await api.upload(`/equipments/${id}/documents`, fd);
      setForm(null);
      changed(r.message);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  const changeStatus = async (values) => {
    try {
      const r = await api.patch(`/equipments/${id}/status`, values);
      setForm(null);
      changed(r.message);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  // Chọn ảnh: chỉ xem trước, bấm "Lưu ảnh" mới tải lên
  const pickImage = (file) => {
    if (!file) return;
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) {
      setToast({ type: "error", message: "Ảnh thiết bị chỉ nhận file JPG, PNG hoặc WEBP." });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setToast({ type: "error", message: "Ảnh gốc quá lớn, tối đa 20 MB." });
      return;
    }
    setCropping(file); // căn chỉnh trước, ảnh lưu là ảnh đã cắt tỉ lệ 4:3
  };

  const saveImage = async () => {
    const fd = new FormData();
    fd.append("image", newImage.file);
    setSavingImage(true);
    try {
      const r = await api.upload(`/equipments/${id}/image`, fd);
      setNewImage(null);
      changed(r.message);
    } catch (err) {
      setToast({ type: "error", message: err.message });
    } finally {
      setSavingImage(false);
    }
  };

  const removeImage = async () => {
    try {
      const r = await api.del(`/equipments/${id}/image`);
      setConfirm(null);
      changed(r.message);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  const canChangeStatus = eq && !["RESERVED", "RENTED", "LIQUIDATED"].includes(eq.status);

  // Các hộp thoại con vẽ bên ngoài lớp nền của hộp thoại này, để bấm ra ngoài hộp thoại con không đóng luôn hồ sơ
  return createPortal(
    <>
      <div className="modal-backdrop" onMouseDown={requestClose}>
        <div className="modal modal-xl" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
          <header className="modal-header">
            <div>
              <h2>{eq ? `${eq.code} – ${eq.name}` : "Hồ sơ thiết bị"}</h2>
              {eq && (
                <p className="modal-subtitle">
                  <StatusBadge map={EQUIPMENT_STATUS} value={eq.status} /> &nbsp;
                  {eq.warehouse_name
                    ? `Đang ở ${eq.warehouse_name}`
                    : eq.status === "RENTED"
                      ? "Đang ở công trình"
                      : ""}
                  {eq.status_note && <> · Lý do: {eq.status_note}</>}
                </p>
              )}
            </div>
            <button type="button" className="modal-close" onClick={requestClose} aria-label="Đóng">
              ×
            </button>
          </header>

          <div className="modal-body">
            {error && <div className="modal-error">{error}</div>}
            {!eq && !error && <p className="text-muted">Đang tải…</p>}

            {eq && (
              <>
                <div className="tabs" role="tablist">
                  {TABS.map((t) => (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={tab === t.key}
                      className={`tab ${tab === t.key ? "active" : ""}`}
                      onClick={() => setTab(t.key)}
                    >
                      {t.label}
                      {t.key === "docs" && ` (${eq.documents.length})`}
                    </button>
                  ))}
                </div>

                {tab === "info" && (
                  <div className="eq-info-layout">
                    <div className="eq-photo">
                      {newImage ? (
                        <img src={newImage.preview} alt="Ảnh mới (chưa lưu)" className="eq-photo-new" />
                      ) : eq.image_url ? (
                        <a href={eq.image_url} target="_blank" rel="noreferrer" title="Xem ảnh gốc">
                          <img src={eq.image_url} alt={eq.name} />
                        </a>
                      ) : (
                        <EquipmentThumb size={200} />
                      )}

                      {newImage ? (
                        <>
                          <span className="warn-text">Ảnh mới chưa được lưu</span>
                          <button className="btn btn-primary eq-photo-btn" onClick={saveImage} disabled={savingImage}>
                            {savingImage ? "Đang lưu…" : "Lưu ảnh"}
                          </button>
                          <button
                            className="btn btn-secondary eq-photo-btn"
                            onClick={() => setNewImage(null)}
                            disabled={savingImage}
                          >
                            Huỷ
                          </button>
                        </>
                      ) : (
                        <>
                          <label className="btn btn-secondary eq-photo-btn">
                            {eq.image_url ? "Chọn ảnh khác" : "Chọn ảnh"}
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.webp"
                              hidden
                              onChange={(e) => {
                                pickImage(e.target.files[0]);
                                e.target.value = "";
                              }}
                            />
                          </label>
                          {eq.image_url && (
                            <button className="text-action danger" onClick={() => setConfirm("removeImage")}>
                              Xoá ảnh
                            </button>
                          )}
                        </>
                      )}
                      <small className="form-hint">JPG, PNG, WEBP · căn chỉnh khung 4:3 trước khi lưu</small>
                    </div>
                    <div>
                      <dl className="info-grid">
                        <Info label="Danh mục" value={`${eq.group_name} › ${eq.category_name}`} />
                        <Info label="Hãng / Model" value={`${eq.brand_name}${eq.model ? ` – ${eq.model}` : ""}`} />
                        <Info label="Số serial (số khung)" value={eq.serial_number} />
                        <Info label="Số máy" value={eq.engine_number} />
                        <Info label="Năm sản xuất" value={eq.manufacture_year} />
                        <Info label="Tình trạng" value={ITEM_CONDITION[eq.item_condition]?.label} />
                        <Info label="Xuất xứ" value={eq.origin_country} />
                        <Info label="Thông số kỹ thuật" value={eq.specifications} full />
                        <Info label="Ngày mua" value={formatDate(eq.purchase_date)} />
                        <Info label="Giá mua" value={formatMoney(eq.purchase_price)} />
                        <Info label="Số giờ máy" value={formatNumber(eq.operating_hours)} />
                        <Info
                          label="Giá thuê"
                          value={
                            eq.daily_rate
                              ? `${formatMoney(eq.daily_rate)}/ngày · ${formatMoney(eq.hourly_rate)}/giờ`
                              : "Chưa có giá"
                          }
                        />
                        <Info label="Ghi chú" value={eq.note} full />
                      </dl>
                      {/* Chỉ Quản lý được chuyển máy sang Ngừng hoạt động / Thanh lý */}
                      {canManageStatus && (
                        <div className="detail-actions">
                          <button
                            className="btn btn-secondary"
                            disabled={!canChangeStatus}
                            title={canChangeStatus ? "" : "Máy đang theo hợp đồng hoặc đã thanh lý"}
                            onClick={() => setForm("status")}
                          >
                            Đổi trạng thái
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tab === "docs" && (
                  <>
                    <div className="detail-actions top">
                      <button className="btn btn-accent" onClick={() => setForm("doc")}>
                        + Thêm giấy tờ
                      </button>
                    </div>
                    <div className="table-wrapper">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Loại giấy tờ</th>
                            <th>Số</th>
                            <th>Ngày cấp</th>
                            <th>Hết hạn</th>
                            <th>Người tải lên</th>
                            <th className="col-actions">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eq.documents.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="table-message">
                                Chưa có giấy tờ nào.
                              </td>
                            </tr>
                          ) : (
                            eq.documents.map((d) => {
                              const left = daysUntil(d.expiry_date);
                              return (
                                <tr key={d.id}>
                                  <td>{DOC_TYPES[d.doc_type]}</td>
                                  <td>{d.doc_number || <span className="text-muted">—</span>}</td>
                                  <td>{formatDate(d.issued_date) || <span className="text-muted">—</span>}</td>
                                  <td>
                                    {d.expiry_date ? (
                                      <>
                                        {formatDate(d.expiry_date)}{" "}
                                        {left < 0 ? (
                                          <span className="badge badge-danger">Đã hết hạn</span>
                                        ) : left <= 30 ? (
                                          <span className="badge badge-warning">Còn {left} ngày</span>
                                        ) : null}
                                      </>
                                    ) : (
                                      <span className="text-muted">Không thời hạn</span>
                                    )}
                                  </td>
                                  <td>{d.uploaded_by_name || <span className="text-muted">—</span>}</td>
                                  <td className="col-actions">
                                    <div className="row-actions">
                                      <a className="text-action" href={d.file_url} target="_blank" rel="noreferrer">
                                        Xem file
                                      </a>
                                      <button className="text-action danger" onClick={() => setDeletingDoc(d)}>
                                        Xoá
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {tab === "rentals" && (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Hợp đồng</th>
                          <th>Khách hàng</th>
                          <th>Thời gian thuê</th>
                          <th>Bàn giao</th>
                          <th>Thu hồi</th>
                          <th className="align-right">Thành tiền</th>
                          <th>Trạng thái HĐ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eq.rentals.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="table-message">
                              Máy chưa được cho thuê lần nào.
                            </td>
                          </tr>
                        ) : (
                          eq.rentals.map((r) => (
                            <tr key={r.contract_id}>
                              <td>
                                <strong>{r.contract_no}</strong>
                              </td>
                              <td>{r.customer_name}</td>
                              <td>
                                {formatDate(r.start_date)} – {formatDate(r.end_date)}
                              </td>
                              <td>
                                {r.handover_no ? (
                                  <>
                                    <span className="cell-main">{r.handover_no}</span>
                                    <span className="cell-sub">{formatDateTime(r.handover_at)}</span>
                                  </>
                                ) : (
                                  <span className="text-muted">Chưa giao</span>
                                )}
                              </td>
                              <td>
                                {r.return_no ? (
                                  <>
                                    <span className="cell-main">
                                      {r.return_no}{" "}
                                      {r.is_damaged ? <span className="badge badge-danger">Hư hỏng</span> : null}
                                    </span>
                                    <span className="cell-sub">{formatDateTime(r.returned_at)}</span>
                                    {r.is_damaged && r.damage_description ? (
                                      <span className="cell-sub">{r.damage_description}</span>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-muted">{r.handover_no ? "Chưa thu hồi" : "—"}</span>
                                )}
                              </td>
                              <td className="align-right">{formatMoney(r.amount)}</td>
                              <td>
                                <StatusBadge map={CONTRACT_STATUS} value={r.contract_status} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {form === "doc" && eq && (
        <FormModal
          title="Thêm giấy tờ thiết bị"
          subtitle={`${eq.code} – ${eq.name}`}
          fields={[
            {
              name: "doc_type",
              label: "Loại giấy tờ",
              type: "select",
              required: true,
              options: toOptions(DOC_TYPES),
              emptyOption: "— Chọn loại —",
            },
            { name: "doc_number", label: "Số giấy tờ", maxLength: 100 },
            { name: "issued_date", label: "Ngày cấp", type: "date", max: todayStr(), maxLabel: "hôm nay" },
            { name: "expiry_date", label: "Ngày hết hạn", type: "date", hint: "Để trống nếu không có thời hạn." },
            {
              name: "file",
              label: "File",
              type: "file",
              required: true,
              full: true,
              accept: ".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx",
              hint: "PDF, ảnh hoặc Word, tối đa 10 MB.",
            },
          ]}
          initialValues={{}}
          submitLabel="Tải lên"
          onSubmit={uploadDoc}
          onClose={() => setForm(null)}
        />
      )}

      {form === "status" && eq && (
        <FormModal
          title="Đổi trạng thái thiết bị"
          subtitle={`${eq.code} – hiện tại: ${EQUIPMENT_STATUS[eq.status].label}`}
          fields={[
            {
              name: "status",
              label: "Trạng thái mới",
              type: "select",
              required: true,
              full: true,
              options: MANUAL_STATUS.filter((s) => s.value !== eq.status),
              emptyOption: "— Chọn trạng thái —",
            },
            {
              name: "note",
              label: "Lý do",
              type: "textarea",
              full: true,
              maxLength: 200,
              hint: "Bắt buộc khi chuyển sang Ngừng hoạt động hoặc Đã thanh lý. Lý do được hiện trong hồ sơ máy.",
              placeholder: "VD: Hỏng bơm thuỷ lực, đưa đi sửa",
            },
          ]}
          initialValues={{}}
          size="md"
          submitLabel="Xác nhận"
          onSubmit={changeStatus}
          onClose={() => setForm(null)}
        />
      )}

      {confirm === "removeImage" && (
        <ConfirmDialog
          title="Xoá ảnh thiết bị"
          message={`Xoá ảnh của máy ${eq.code}? Thao tác này không thể hoàn tác.`}
          onConfirm={removeImage}
          onClose={() => setConfirm(null)}
        />
      )}

      {confirm === "closeUnsaved" && (
        <ConfirmDialog
          title="Ảnh mới chưa được lưu"
          message="Bạn đã chọn ảnh mới nhưng chưa bấm Lưu ảnh. Đóng hồ sơ thì ảnh mới sẽ bị bỏ."
          confirmLabel="Bỏ ảnh và đóng"
          onConfirm={async () => {
            setConfirm(null);
            setNewImage(null);
            onClose();
            return null;
          }}
          onClose={() => setConfirm(null)}
        />
      )}

      {deletingDoc && (
        <ConfirmDialog
          title="Xoá giấy tờ"
          message={`Xoá ${DOC_TYPES[deletingDoc.doc_type]}${deletingDoc.doc_number ? ` số ${deletingDoc.doc_number}` : ""}? File đã tải lên cũng bị xoá.`}
          onConfirm={async () => {
            try {
              const r = await api.del(`/equipments/documents/${deletingDoc.id}`);
              setDeletingDoc(null);
              changed(r.message);
              return null;
            } catch (err) {
              return err.message;
            }
          }}
          onClose={() => setDeletingDoc(null)}
        />
      )}

      {cropping && (
        <ImageCropper
          file={cropping}
          aspect={4 / 3}
          outputWidth={1200}
          title="Căn chỉnh ảnh thiết bị"
          onCancel={() => setCropping(null)}
          onDone={(f) => {
            setNewImage({ file: f, preview: URL.createObjectURL(f) });
            setCropping(null);
          }}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </>,
    document.body,
  );
}

// Một ô thông tin: nhãn ở trên, giá trị ở dưới
function Info({ label, value, full }) {
  return (
    <div className={`info-item ${full ? "full" : ""}`}>
      <dt>{label}</dt>
      <dd>{value || value === 0 ? value : <span className="text-muted">—</span>}</dd>
    </div>
  );
}

export default EquipmentDetailModal;
