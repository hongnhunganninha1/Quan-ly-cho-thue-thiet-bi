import { useCallback, useMemo, useState } from "react";
import "../catalog/CatalogPage.css";
import "./Rent.css";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import Toast from "../../components/common/Toast";
import { PlusIcon, RefreshIcon, SearchIcon } from "../../components/common/Icons";
import ContractForm from "./ContractForm";
import ContractDetailModal from "./ContractDetailModal";
import ContractTable from "./ContractTable";
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

const PAGE_SIZE = 10;

// Màn Quản lý hợp đồng: danh sách, lập / sửa hợp đồng, xem hồ sơ và xử lý theo trạng thái
function ContractPage({ user }) {
  const { data: rows, error, loading, reload } = useApiData("/contracts", []);
  const [tab, setTab] = useState("ALL");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState({ view: "list" }); // list | form (kèm contract khi sửa)
  const [openId, setOpenId] = useState(null);
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
        (!kw || normalizeText(`${r.contract_no} ${r.customer_name} ${r.site_name} ${r.equipment_codes}`).includes(kw))
    );
  }, [rows, tab, keyword]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

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
          <h1>Quản lý hợp đồng</h1>
        </div>
        <button className="btn btn-accent btn-icon" onClick={() => setMode({ view: "form" })}>
          <PlusIcon /> Lập hợp đồng
        </button>
      </div>

      <section className="catalog-card">
        <div className="status-tabs">
          {CONTRACT_TABS.map((t) => (
            <button
              key={t.key}
              className={`status-tab ${tab === t.key ? "active" : ""}`}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
            >
              {t.label}
              <span className="count">{counts[t.key]}</span>
            </button>
          ))}
        </div>
        <div className="toolbar">
          <label className="search-box">
            <SearchIcon />
            <input
              type="search"
              placeholder="Tìm theo số hợp đồng, khách hàng, công trình, mã máy…"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <span className="toolbar-count">{filtered.length} hợp đồng</span>
          <button className="icon-button" onClick={reload} title="Tải lại" aria-label="Tải lại">
            <RefreshIcon />
          </button>
        </div>

        {error ? (
          <p className="table-message table-error">{error}</p>
        ) : (
          <ContractTable
            rows={filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)}
            onOpen={setOpenId}
            emptyText={loading ? "Đang tải dữ liệu…" : "Không có hợp đồng nào."}
          />
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
              ‹ Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} className={p === currentPage ? "active" : ""} onClick={() => setPage(p)}>
                {p}
              </button>
            ))}
            <button disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
              Sau ›
            </button>
          </div>
        )}
      </section>

      {openId && (
        <ContractDetailModal id={openId} user={user} onClose={() => setOpenId(null)} onChanged={changed} onEdit={editContract} />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

export default ContractPage;
