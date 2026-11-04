import { useCallback, useEffect, useMemo, useState } from "react";
import "./CatalogPage.css";
import { api } from "../../api/client";
import { normalizeText } from "../../utils/format";
import FormModal from "../../components/common/FormModal";
import PagerFooter, { PageSizeSelect } from "../../components/common/Pager";
import usePager from "../../hooks/usePager";
import { renderOptions } from "../../utils/options";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import RowMenu from "../../components/common/RowMenu";
import NoticeDialog from "../../components/common/NoticeDialog";
import Toast from "../../components/common/Toast";
import { EditIcon, PlusIcon, SearchIcon, TrashIcon } from "../../components/common/Icons";
import TreeSelect from "../../components/common/TreeSelect";


// Bộ lọc theo ngày tạo: số ngày tính lùi từ hôm nay (0 = hôm nay; "month" = tháng này)
const DATE_RANGES = [
  { value: "", label: "Mọi lúc" },
  { value: "0", label: "Hôm nay" },
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
  { value: "month", label: "Tháng này" },
];

function inDateRange(value, range) {
  if (!range) return true;
  if (!value) return false;
  const d = new Date(String(value).replace(" ", "T"));
  const now = new Date();
  if (range === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(range));
  return d >= from;
}

// Khung chung cho các màn danh sách: tìm kiếm, lọc, bảng, phân trang, thêm / sửa / xoá.
// Mỗi màn (khách hàng, bãi máy, nhân viên, thiết bị…) chỉ cần khai báo cấu hình:
//   title                : tiêu đề của trang
//   endpoint             : đường dẫn API, VD "/customers"
//   itemName             : tên đối tượng, VD "khách hàng" (dùng trong các câu thông báo)
//   columns              : các cột của bảng [{ key, label, render(row), align, wrap }]
//   searchText(row)      : chuỗi dùng để tìm kiếm của một dòng
//   searchPlaceholder    : gợi ý trong ô tìm kiếm
//   filters              : các bộ lọc [{ key, label, options: [{ value, label, group? }], match?(row, value) }]
//                          width: độ rộng riêng; tree: true → ô chọn dạng cây (options có children), allLabel = dòng "tất cả"
//   sorts                : các cách sắp xếp [{ value, label, compare(a, b) }], cách đầu tiên là mặc định
//   dateFilter           : lọc theo ngày tạo { key: "created_at", label: "Ngày nhập" }
//   fields               : các ô nhập của form (xem FormModal);
//                          hoặc fieldsFor(row) nếu form thêm và form sửa khác nhau (row = null khi thêm)
//   emptyForm            : giá trị form khi thêm mới; hoặc hàm (filterValues) => giá trị (VD điền sẵn theo bộ lọc đang chọn)
//   rowLabel(row)        : tên hiển thị của một dòng trong câu hỏi xác nhận xoá
//   deleteBlocked(row)   : trả về lý do không xoá được (để làm mờ nút xoá), hoặc null
//   createSubtitle, editSubtitle(row): dòng phụ dưới tiêu đề form
// Tuỳ chọn thêm:
//   hideAdd, hideDelete, canEdit(row), addLabel, formSize ("lg" | "xl"), formChildren(form, row)
//   updatePath(row)      : đường dẫn API khi sửa (mặc định endpoint/id)
//   rowActions(row)      : các chức năng thêm trong menu ba chấm [{ key, label, icon, first, danger, disabled, title, onClick() }
//                          hoặc { ..., confirm: { title, message, confirmLabel, tone, inputLabel }, run(text) → Promise }]
//   refreshSignal        : số tăng lên thì tải lại danh sách (khi trang cha vừa thay đổi dữ liệu)
//   onOpenForm(row)      : gọi mỗi khi mở form (VD: tải lại danh sách lựa chọn)
//   afterSave(result, values, row): việc làm thêm sau khi lưu thành công (VD: tải ảnh thiết bị lên)
//   initialFilters       : giá trị bộ lọc lúc mở trang, VD { category: "12" } (đi từ màn Loại thiết bị sang)
//   openAddWith          : có thì mở sẵn form thêm mới, điền sẵn các giá trị này (VD { category_id: "12" })
function CatalogPage({
  title,
  endpoint,
  itemName,
  columns,
  searchText,
  searchPlaceholder = "Tìm kiếm…",
  filters = [],
  sorts = [],
  dateFilter,
  fields,
  fieldsFor,
  emptyForm = {},
  rowLabel,
  deleteBlocked = () => null,
  createSubtitle,
  editSubtitle,
  hideAdd = false,
  hideDelete = false,
  canEdit = () => true,
  addLabel,
  formSize = "lg",
  formChildren,
  updatePath,
  rowActions,
  refreshSignal = 0,
  onOpenForm,
  afterSave,
  initialFilters = {},
  openAddWith = null,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filterValues, setFilterValues] = useState(initialFilters);
  const [sortValue, setSortValue] = useState(sorts[0]?.value || "");
  const [dateRange, setDateRange] = useState("");
  // null: đóng form; { row: null }: thêm; { row }: sửa. openAddWith → mở sẵn form thêm với giá trị điền sẵn
  const [editing, setEditing] = useState(() => (openAddWith ? { row: null, preset: openAddWith } : null));
  const [confirming, setConfirming] = useState(null); // { title, message, ..., run } đang hỏi xác nhận
  const [toast, setToast] = useState(null);
  const [notice, setNotice] = useState(null);

  // Tải lại danh sách từ backend (sau khi thêm / sửa / xoá, hoặc bấm nút tải lại)
  const load = useCallback(async () => {
    try {
      setRows(await api.get(endpoint));
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  // Tải danh sách khi mở trang, và mỗi khi trang cha báo dữ liệu đã đổi (refreshSignal)
  useEffect(() => {
    let active = true; // rời trang trước khi tải xong thì bỏ qua kết quả
    api
      .get(endpoint)
      .then((data) => active && setRows(data))
      .catch((err) => active && setLoadError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [endpoint, refreshSignal]);

  // Lọc theo từ khoá (không phân biệt dấu, hoa thường) và theo các bộ lọc
  const filtered = useMemo(() => {
    const kw = normalizeText(keyword.trim());
    const list = rows.filter(
      (row) =>
        (!kw || normalizeText(searchText(row)).includes(kw)) &&
        filters.every(
          (f) => !filterValues[f.key] || (f.match ? f.match(row, filterValues[f.key]) : String(row[f.key]) === filterValues[f.key])
        ) &&
        (!dateFilter || inDateRange(row[dateFilter.key], dateRange))
    );
    const sort = sorts.find((x) => x.value === sortValue);
    return sort ? [...list].sort(sort.compare) : list;
  }, [rows, keyword, filterValues, filters, searchText, sorts, sortValue, dateFilter, dateRange]);

  // Đổi từ khoá / bộ lọc / sắp xếp thì quay về trang 1
  const pager = usePager(filtered, JSON.stringify([keyword, filterValues, dateRange, sortValue]));
  const pageRows = pager.pageRows;

  const closeToast = useCallback(() => setToast(null), []);
  const closeForm = useCallback(() => setEditing(null), []);
  const closeConfirm = useCallback(() => setConfirming(null), []);

  // Xử lý kết quả thành công từ backend: thông báo nhỏ, hoặc hộp thoại nếu có thông tin quan trọng
  const done = (result) => {
    if (result?.notice) setNotice(result.notice);
    else setToast({ type: "success", message: result?.message || "Đã lưu." });
    load();
  };

  const formFields = (row) => (fieldsFor ? fieldsFor(row) : fields);

  // Lưu form: thêm mới (POST) hoặc cập nhật (PUT). Trả về chuỗi lỗi để form hiện ra.
  const handleSave = async (values) => {
    try {
      const row = editing.row;
      // File (ảnh…) không gửi kèm JSON, afterSave sẽ tải lên riêng
      const body = Object.fromEntries(Object.entries(values).filter(([, v]) => !(v instanceof File)));
      const result = row
        ? await api.put(updatePath ? updatePath(row) : `${endpoint}/${row.id}`, body)
        : await api.post(endpoint, body);
      setEditing(null);
      if (afterSave) {
        try {
          await afterSave(result, values, row);
        } catch (err) {
          setToast({ type: "error", message: `Đã lưu thông tin nhưng chưa cập nhật được ảnh: ${err.message}` });
          load();
          return null;
        }
      }
      done(result);
      return null;
    } catch (err) {
      return err; // kèm err.field để form tô đỏ ô bị trùng
    }
  };

  const askDelete = (row) =>
    setConfirming({
      title: `Xoá ${itemName}`,
      message: (
        <>
          Bạn có chắc muốn xoá <strong>{rowLabel(row)}</strong>? Thao tác này không thể hoàn tác.
        </>
      ),
      confirmLabel: "Xoá",
      run: () => api.del(`${endpoint}/${row.id}`),
    });

  // Bấm một nút thao tác thêm: hỏi xác nhận (nếu có) rồi gọi API
  const handleAction = async (action) => {
    if (action.onClick) return action.onClick();
    if (action.confirm) return setConfirming({ ...action.confirm, run: action.run });
    try {
      done(await action.run());
    } catch (err) {
      setToast({ type: "error", message: err.message });
    }
  };

  const handleConfirm = async (text) => {
    try {
      const result = await confirming.run(text);
      setConfirming(null);
      done(result);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  // Giá trị ban đầu của form khi sửa: lấy từ dòng đang chọn, NULL đổi thành chuỗi rỗng
  const formValues = (row) => {
    if (!row) return { ...(typeof emptyForm === "function" ? emptyForm(filterValues) : emptyForm), ...(editing?.preset || {}) };
    const values = {};
    for (const f of formFields(row)) {
      if (f.type === "section") continue;
      let v = row[f.name] ?? "";
      if (f.type === "date" && v) v = String(v).slice(0, 10);
      values[f.name] = v;
    }
    return values;
  };

  const colCount = columns.length + 2;

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>{title}</h1>
        </div>
        {!hideAdd && (
          <button
            className="btn btn-accent btn-icon"
            onClick={() => {
              onOpenForm?.(null);
              setEditing({ row: null });
            }}
          >
            <PlusIcon /> {addLabel || `Thêm ${itemName}`}
          </button>
        )}
      </div>

      <section className="catalog-card">
        {/* Thanh công cụ: tìm kiếm, lọc, tải lại */}
        <div className="toolbar">
          <label className="search-box">
            <SearchIcon />
            <input
              type="search"
              placeholder={searchPlaceholder}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
              }}
              aria-label="Tìm kiếm"
            />
          </label>

          {filters.map((f) =>
            f.tree ? (
              <TreeSelect
                key={f.key}
                className="toolbar-select"
                value={filterValues[f.key] || ""}
                onChange={(v) => setFilterValues((prev) => ({ ...prev, [f.key]: v }))}
                options={f.options}
                placeholder={f.label}
                allLabel={f.allLabel || f.label}
                ariaLabel={f.label}
              />
            ) : (
            <select
              key={f.key}
              className="toolbar-select"
              value={filterValues[f.key] || ""}
              onChange={(e) => {
                setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }));
              }}
              aria-label={f.label}
              style={f.width ? { width: f.width } : undefined}
            >
              <option value="">{f.label}</option>
              {renderOptions(f.options)}
            </select>
            ),
          )}

          {dateFilter && (
            <select
              className="toolbar-select"
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
              }}
              aria-label={dateFilter.label}
            >
              {DATE_RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {dateFilter.label}: {r.label}
                </option>
              ))}
            </select>
          )}

          {sorts.length > 0 && (
            <select className="toolbar-select" value={sortValue} onChange={(e) => setSortValue(e.target.value)} aria-label="Sắp xếp">
              {sorts.map((x) => (
                <option key={x.value} value={x.value}>
                  ⇅ {x.label}
                </option>
              ))}
            </select>
          )}

          <PageSizeSelect pager={pager} />
        </div>

        {/* Bảng dữ liệu */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-index">STT</th>
                {columns.map((c) => (
                  <th key={c.key} className={c.align === "right" ? "align-right" : ""}>
                    {c.label}
                  </th>
                ))}
                <th className="col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="table-message">
                    Đang tải dữ liệu…
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={colCount} className="table-message table-error">
                    {loadError}
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="table-message">
                    {rows.length === 0 ? `Chưa có ${itemName} nào.` : "Không tìm thấy kết quả phù hợp."}
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => {
                  const blocked = deleteBlocked(row);
                  return (
                    <tr key={row.id}>
                      <td className="col-index">{pager.start + i + 1}</td>
                      {columns.map((c) => (
                        <td key={c.key} className={`${c.align === "right" ? "align-right" : ""} ${c.wrap ? "cell-wrap" : ""}`}>
                          {c.render ? c.render(row) : row[c.key] ?? <span className="text-muted">—</span>}
                        </td>
                      ))}
                      <td className="col-actions">
                        <RowMenu
                          label={`Thao tác: ${rowLabel(row)}`}
                          items={[
                            // Chức năng thêm của từng màn; mục có first: true đứng trước "Chỉnh sửa"
                            ...(rowActions?.(row) || [])
                              .filter((a) => a.first)
                              .map((a) => ({ ...a, onClick: () => handleAction(a) })),
                            canEdit(row) && {
                              key: "edit",
                              label: "Chỉnh sửa",
                              icon: <EditIcon />,
                              onClick: () => {
                                onOpenForm?.(row);
                                setEditing({ row });
                              },
                            },
                            ...(rowActions?.(row) || [])
                              .filter((a) => !a.first)
                              .map((a) => ({ ...a, onClick: () => handleAction(a) })),
                            !hideDelete && {
                              key: "delete",
                              label: "Xoá",
                              icon: <TrashIcon />,
                              danger: true,
                              disabled: Boolean(blocked),
                              title: blocked || "",
                              onClick: () => askDelete(row),
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {!loadError && <PagerFooter pager={pager} />}
      </section>

      {editing && (
        <FormModal
          title={editing.row ? `Sửa ${itemName}` : addLabel || `Thêm ${itemName}`}
          subtitle={editing.row ? editSubtitle?.(editing.row) : createSubtitle}
          fields={formFields(editing.row)}
          initialValues={formValues(editing.row)}
          row={editing.row}
          size={formSize}
          submitLabel={editing.row ? "Lưu thay đổi" : "Thêm mới"}
          onSubmit={handleSave}
          onClose={closeForm}
        >
          {formChildren ? (form) => formChildren(form, editing.row) : undefined}
        </FormModal>
      )}

      {confirming && (
        <ConfirmDialog
          title={confirming.title}
          message={confirming.message}
          confirmLabel={confirming.confirmLabel}
          tone={confirming.tone}
          inputLabel={confirming.inputLabel}
          onConfirm={handleConfirm}
          onClose={closeConfirm}
        />
      )}

      {notice && <NoticeDialog notice={notice} onClose={() => setNotice(null)} />}

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

export default CatalogPage;
