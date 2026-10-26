import { useCallback, useState } from "react";
import "./CatalogPage.css";
import "./CategoryPage.css";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import FormModal from "../../components/common/FormModal";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Toast from "../../components/common/Toast";
import { EditIcon, PlusIcon, TrashIcon } from "../../components/common/Icons";

function ChevronIcon() {
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
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

const CODE_HINT = "Chữ cái không dấu, chữ số, dấu gạch ngang (VD: MXD-BX).";

// Màn Quản lý loại thiết bị, phân 2 cấp: Nhóm thiết bị → Loại thiết bị.
// Bên trái là danh sách nhóm, bên phải là các loại thuộc nhóm đang chọn (kèm số máy).
function CategoryPage() {
  const { data: rows, error, reload } = useApiData("/categories", []);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null); // { level: "group" | "type", row }
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const groups = rows.filter((r) => r.parent_id === null);
  const selected = groups.find((g) => g.id === selectedId) || groups[0];
  const types = selected ? rows.filter((r) => r.parent_id === selected.id) : [];
  const totalEquipments = groups.reduce((s, g) => s + g.equipment_count, 0);

  const done = (message) => {
    setToast({ type: "success", message });
    reload();
  };

  const save = async (values) => {
    try {
      const body = { ...values, parent_id: form.level === "group" ? "" : values.parent_id };
      const r = form.row ? await api.put(`/categories/${form.row.id}`, body) : await api.post("/categories", body);
      if (form.level === "group" && !form.row) setSelectedId(r.id);
      if (form.level === "type") setSelectedId(Number(values.parent_id));
      setForm(null);
      done(r.message);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  const fields =
    form?.level === "group"
      ? [
          { name: "name", label: "Tên nhóm", required: true, maxLength: 100, placeholder: "VD: Thiết bị đào đắp đất" },
          {
            name: "code",
            label: "Mã nhóm",
            required: true,
            uppercase: true,
            maxLength: 20,
            placeholder: "VD: DDD",
            hint: CODE_HINT,
          },
          { name: "description", label: "Mô tả", type: "textarea", full: true, maxLength: 255 },
        ]
      : [
          {
            name: "parent_id",
            label: "Thuộc nhóm",
            type: "select",
            required: true,
            full: true,
            options: groups.map((g) => ({ value: String(g.id), label: g.name })),
            emptyOption: "— Chọn nhóm —",
          },
          { name: "name", label: "Tên loại", required: true, maxLength: 100, placeholder: "VD: Máy xúc đào bánh xích" },
          {
            name: "code",
            label: "Mã loại",
            required: true,
            uppercase: true,
            maxLength: 20,
            placeholder: "VD: MXD-BX",
            hint: CODE_HINT,
          },
          { name: "description", label: "Mô tả", type: "textarea", full: true, maxLength: 255 },
        ];

  const initialValues = form?.row
    ? {
        parent_id: form.row.parent_id ? String(form.row.parent_id) : "",
        code: form.row.code,
        name: form.row.name,
        description: form.row.description || "",
      }
    : { parent_id: selected ? String(selected.id) : "" };

  const deleteBlocked = (r) =>
    r.parent_id === null && r.child_count > 0
      ? "Nhóm đang có loại con"
      : r.parent_id !== null && r.equipment_count > 0
        ? "Loại đang có thiết bị"
        : null;

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>Quản lý loại thiết bị</h1>
        </div>
        <button className="btn btn-accent btn-icon" onClick={() => setForm({ level: "group", row: null })}>
          <PlusIcon /> Thêm nhóm
        </button>
      </div>

      {error && <div className="modal-error">{error}</div>}

      <div className="category-layout">
        {/* Danh sách nhóm */}
        <aside className="catalog-card group-list">
          <header className="group-list-header">
            <strong>Nhóm thiết bị</strong>
            <span className="count-pill">{totalEquipments}</span>
          </header>
          {groups.length === 0 && <p className="table-message">Chưa có nhóm nào.</p>}
          {groups.map((g) => (
            <button
              key={g.id}
              className={`group-item ${selected?.id === g.id ? "active" : ""}`}
              onClick={() => setSelectedId(g.id)}
            >
              <span className="group-icon">
                <FolderIcon />
              </span>
              <span className="group-name">{g.name}</span>
              <span className="count-pill">{g.equipment_count}</span>
              <ChevronIcon />
            </button>
          ))}
        </aside>

        {/* Các loại thuộc nhóm đang chọn */}
        <section className="catalog-card type-panel">
          {!selected ? (
            <p className="table-message">Thêm nhóm thiết bị đầu tiên để bắt đầu.</p>
          ) : (
            <>
              <header className="type-panel-header">
                <div>
                  <h2>
                    {selected.name} <span className="count-pill">{selected.equipment_count}</span>
                  </h2>
                  <p>
                    Mã nhóm <strong>{selected.code}</strong>
                    {selected.description ? ` · ${selected.description}` : ""}
                  </p>
                </div>
                <div className="type-panel-actions">
                  <button className="icon-button" title="Sửa nhóm" onClick={() => setForm({ level: "group", row: selected })}>
                    <EditIcon />
                  </button>
                  <button
                    className="icon-button icon-danger"
                    title={deleteBlocked(selected) || "Xoá nhóm"}
                    disabled={Boolean(deleteBlocked(selected))}
                    onClick={() => setDeleting(selected)}
                  >
                    <TrashIcon />
                  </button>
                  <button className="btn btn-accent btn-icon" onClick={() => setForm({ level: "type", row: null })}>
                    <PlusIcon /> Thêm loại
                  </button>
                </div>
              </header>

              {types.length === 0 ? (
                <p className="table-message">Nhóm này chưa có loại thiết bị nào.</p>
              ) : (
                <ul className="type-list">
                  {types.map((t) => (
                    <li key={t.id} className="type-item">
                      <div className="type-info">
                        <span className="type-name">{t.name}</span>
                        <span className="cell-sub">
                          <span className="badge badge-info">{t.code}</span>
                          {t.description ? ` ${t.description}` : ""}
                        </span>
                      </div>
                      <span className="count-pill" title="Số thiết bị">
                        {t.equipment_count}
                      </span>
                      <div className="row-actions">
                        <button className="icon-button" title="Sửa loại" onClick={() => setForm({ level: "type", row: t })}>
                          <EditIcon />
                        </button>
                        <button
                          className="icon-button icon-danger"
                          title={deleteBlocked(t) || "Xoá loại"}
                          disabled={Boolean(deleteBlocked(t))}
                          onClick={() => setDeleting(t)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      {form && (
        <FormModal
          title={`${form.row ? "Sửa" : "Thêm"} ${form.level === "group" ? "nhóm" : "loại"} thiết bị`}
          subtitle={form.level === "type" && !form.row ? "Loại là cấp gắn trực tiếp với từng máy." : null}
          size="md"
          fields={fields}
          initialValues={initialValues}
          row={form.row}
          submitLabel={form.row ? "Lưu thay đổi" : "Thêm mới"}
          onSubmit={save}
          onClose={() => setForm(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={`Xoá ${deleting.parent_id === null ? "nhóm" : "loại"} thiết bị`}
          message={
            <>
              Bạn có chắc muốn xoá <strong>{deleting.name}</strong>? Thao tác này không thể hoàn tác.
            </>
          }
          onConfirm={async () => {
            try {
              const r = await api.del(`/categories/${deleting.id}`);
              if (deleting.id === selected?.id) setSelectedId(null);
              setDeleting(null);
              done(r.message);
              return null;
            } catch (err) {
              return err.message;
            }
          }}
          onClose={() => setDeleting(null)}
        />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

export default CategoryPage;
