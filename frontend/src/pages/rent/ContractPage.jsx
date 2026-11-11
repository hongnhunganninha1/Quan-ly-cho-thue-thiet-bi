import { useCallback, useMemo, useState } from "react";
import "../catalog/CatalogPage.css";
import "./Rent.css";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import Toast from "../../components/common/Toast";
import { PlusIcon, SearchIcon } from "../../components/common/Icons";
import PagerFooter, { PageSizeSelect } from "../../components/common/Pager";
import usePager from "../../hooks/usePager";
import ContractForm from "./ContractForm";
import ContractDetailModal from "./ContractDetailModal";
import ContractTable from "./ContractTable";
import PrintPreview from "../../components/common/PrintPreview";
import { contractDoc } from "../../utils/printDocs";
import { normalizeText } from "../../utils/format";

// Nhóm trạng thái hiển thị thành các tab
const CONTRACT_TABS = [
  { key: "ALL", label: "Tất cả", statuses: null },
  { key: "DRAFT", label: "Nháp / bị từ chối", statuses: ["DRAFT", "REJECTED"] },
  { key: "PENDING_APPROVAL", label: "Chờ duyệt", statuses: ["PENDING_APPROVAL"] },
  { key: "APPROVED", label: "Đã duyệt", statuses: ["APPROVED"] },
  { key: "ACTIVE", label: "Đang thuê", statuses: ["ACTIVE"] },
  { key: "COMPLETED", label: "Chờ quyết toán", statuses: ["COMPLETED"] },
  { key: "SETTLED", label: "Đã quyết toán", statuses: ["SETTLED"] },
  { key: "CANCELLED", label: "Đã huỷ", statuses: ["CANCELLED"] },
];

// Màn Quản lý hợp đồng: danh sách, lập / sửa hợp đồng, xem hồ sơ và xử lý theo trạng thái
// navParam: tab mở sẵn khi đi từ nơi khác tới (VD từ Tổng quan / thông báo nhắc duyệt → "PENDING_APPROVAL")
function ContractPage({ user, navParam }) {
  const { data: rows, error, loading, reload } = useApiData("/contracts", []);
  const [tab, setTab] = useState(CONTRACT_TABS.some((t) => t.key === navParam) ? navParam : "ALL");
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState({ view: "list" }); // list | form (kèm contract khi sửa)
  const [openId, setOpenId] = useState(null);
  const [preview, setPreview] = useState(null); // bản in hợp đồng đang xem trước
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const counts = useMemo(() => {
    const result = {};
    for (const t of CONTRACT_TABS) result[t.key] = t.statuses ? rows.filter((r) => t.statuses.includes(r.status)).length : rows.length;
    return result;
  }, [rows]);

  const filtered = useMemo(() => {
    const statuses = CONTRACT_TABS.find((t) => t.key === tab).statuses;
    const kw = normalizeText(keyword.trim());
    return rows.filter(
      (r) =>
        (!statuses || statuses.includes(r.status)) &&
        (!kw || normalizeText(`${r.contract_no} ${r.customer_name} ${r.delivery_address} ${r.equipment_codes}`).includes(kw))
    );
  }, [rows, tab, keyword]);

  const pager = usePager(filtered, `${tab}|${keyword}`); // đổi tab / từ khoá thì về trang 1

  const changed = (message) => {
    setToast({ type: "success", message });
    reload();
  };

  // Mở form sửa: lấy đủ chi tiết hợp đồng
  const editContract = async (c) => {
    setOpenId(null);
    try {
      setMode({ view: "form", contract: c.items ? c : await api.get(`/contracts/${c.id}`) });
    } catch (err) {
      setToast({ type: "error", message: err.message });
    }
  };

  if (mode.view === "form") {
    return (
      <>
        <ContractForm
          contract={mode.contract || null}
          onCancel={() => setMode({ view: "list" })}
          onSaved={(message) => {
            setMode({ view: "list" });
            changed(message);
          }}
        />
        <Toast toast={toast} onClose={closeToast} />
      </>
    );
  }

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>Hợp đồng thuê</h1>
        </div>
        <button className="btn btn-accent btn-icon" onClick={() => setMode({ view: "form" })}>
          <PlusIcon /> Lập hợp đồng
        </button>
      </div>

      {/* Tab trạng thái nằm ngoài khung danh sách, ngay dưới tiêu đề trang */}
      <div className="status-tabs">
        {CONTRACT_TABS.map((t) => (
          <button
            key={t.key}
            className={`status-tab ${tab === t.key ? "active" : ""}`}
            onClick={() => {
              setTab(t.key);
            }}
          >
            {t.label}
            <span className="count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <section className="catalog-card">
        <div className="toolbar">
          <label className="search-box">
            <SearchIcon />
            <input
              type="search"
              placeholder="Tìm theo số hợp đồng, khách hàng, địa điểm nhận máy, mã máy…"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
              }}
            />
          </label>
          <PageSizeSelect pager={pager} />
        </div>

        {error ? (
          <p className="table-message table-error">{error}</p>
        ) : (
          <ContractTable
            rows={pager.pageRows}
            onOpen={setOpenId}
            onPrint={(cid) => setPreview(() => () => contractDoc(cid))}
            emptyText={loading ? "Đang tải dữ liệu…" : "Không có hợp đồng nào."}
          />
        )}

        {!error && <PagerFooter pager={pager} />}
      </section>

      {openId && (
        <ContractDetailModal id={openId} user={user} onClose={() => setOpenId(null)} onChanged={changed} onEdit={editContract} />
      )}
      {preview && <PrintPreview load={preview} onClose={() => setPreview(null)} />}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

export default ContractPage;
