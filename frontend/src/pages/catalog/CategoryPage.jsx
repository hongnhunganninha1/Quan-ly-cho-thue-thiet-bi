import { useCallback, useState } from "react";
import RowMenu from "../../components/common/RowMenu";
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
// onNavigate: chuyển sang màn khác (từ một loại thiết bị → thêm máy / xem các máy của loại đó)
function CategoryPage({ onNavigate }) {
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
  const typeCount = (g) => rows.filter((r) => r.parent_id === g.id).length;

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
      return err; // kèm err.field để form tô đỏ ô bị trùng
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
            maxLength: 10,
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
            maxLength: 10,
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

  // Chỉ chặn xoá khi đang có thiết bị. Nhóm chưa có máy nào thì xoá được (các loại con rỗng bị xoá theo).
  const deleteBlocked = (r) =>
    r.equipment_count > 0 ? (r.parent_id === null ? "Nhóm đang có thiết bị" : "Loại đang có thiết bị") : null;

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>Loại thiết bị</h1>
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
            <span className="text-muted">
              {groups.length} nhóm · {totalEquipments} máy
            </span>
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
              <span className="group-name">
                {g.name}
                <small>
                  {typeCount(g)} loại · {g.equipment_count} máy
                </small>
              </span>
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
                  <h2>{selected.name}</h2>
                  <p>
                    Mã nhóm <strong>{selected.code}</strong> · {types.length} loại · {selected.equipment_count} máy
                    {selected.description ? ` · ${selected.description}` : ""}
                  </p>
                </div>
                <div className="type-panel-actions">
                  <button className="btn btn-secondary btn-icon btn-sm-plus" onClick={() => setForm({ level: "type", row: null })}>
                    <PlusIcon /> Thêm loại
                  </button>
                  {/* Nút ba chấm của nhóm: Sửa / Xoá (nhóm còn máy thì không hiện Xoá) */}
                  <RowMenu
                    label="Thao tác với nhóm"
                    items={[
                      { key: "edit", label: "Sửa nhóm", icon: <EditIcon />, onClick: () => setForm({ level: "group", row: selected }) },
                      {
                        key: "delete",
                        label: "Xoá nhóm",
                        icon: <TrashIcon />,
                        danger: true,
                        disabled: Boolean(deleteBlocked(selected)),
                        onClick: () => setDeleting(selected),
                      },
                    ]}
                  />
                </div>
              </header>

              {types.length === 0 ? (
                <p className="table-message">Nhóm này chưa có loại thiết bị nào.</p>
              ) : (
                <ul className="type-list">
                  {types.map((t) => (
                    <li
                      key={t.id}
                      className="type-item clickable"
                      title="Bấm để xem các thiết bị thuộc loại này"
                      onClick={() => onNavigate?.(`equipment-profile:type-${t.id}`)}
                    >
                      <span className="type-name">{t.name}</span>
                      <span className="type-code">
                        <span className="badge badge-info">{t.code}</span>
                      </span>
                      <span className="type-desc">{t.description || ""}</span>
                      <span className={`type-count ${t.equipment_count ? "" : "is-zero"}`}>{t.equipment_count} máy</span>
                      {/* Nút ba chấm: Thêm máy / Sửa / Xoá – bấm vào đây không mở danh sách máy */}
                      <span onClick={(e) => e.stopPropagation()}>
                        <RowMenu
                          items={[
                            {
                              key: "add-equipment",
                              label: "Thêm thiết bị loại này",
                              icon: <PlusIcon />,
                              onClick: () => onNavigate?.(`equipment-profile:add-${t.id}`),
                            },
                            { key: "edit", label: "Chỉnh sửa", icon: <EditIcon />, onClick: () => setForm({ level: "type", row: t }) },
                            {
                              key: "delete",
                              label: "Xoá",
                              icon: <TrashIcon />,
                              danger: true,
                              disabled: Boolean(deleteBlocked(t)),
                              onClick: () => setDeleting(t),
                            },
                          ]}
                        />
                      </span>
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
              Bạn có chắc muốn xoá <strong>{deleting.name}</strong>?
              {deleting.parent_id === null && deleting.child_count > 0 && (
                <> {deleting.child_count} loại thiết bị trong nhóm (chưa có máy nào) cũng sẽ bị xoá.</>
              )}{" "}
              Thao tác này không thể hoàn tác.
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
