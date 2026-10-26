import { useCallback, useState } from "react";
import "../catalog/CatalogPage.css";
import "./Rent.css";
import useApiData from "../../hooks/useApiData";
import Toast from "../../components/common/Toast";
import { RefreshIcon } from "../../components/common/Icons";
import ContractDetailModal from "./ContractDetailModal";
import ContractTable from "./ContractTable";

// Màn Duyệt hợp đồng (chỉ Quản lý): các hợp đồng đang chờ duyệt, và hợp đồng đã duyệt đang chờ khách đặt cọc
function ApprovePage({ user }) {
  const pending = useApiData("/contracts?status=PENDING_APPROVAL", []);
  const waitingDeposit = useApiData("/contracts?status=APPROVED", []);
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const reloadAll = () => {
    pending.reload();
    waitingDeposit.reload();
  };

  const noDeposit = waitingDeposit.data.filter((c) => !c.deposit_paid_at);

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>Duyệt hợp đồng</h1>
        </div>
        <button className="btn btn-secondary btn-icon" onClick={reloadAll}>
          <RefreshIcon /> Tải lại
        </button>
      </div>

      <section className="catalog-card">
        <header className="panel-header">
          <h2>Chờ duyệt ({pending.data.length})</h2>
        </header>
        <ContractTable
          rows={pending.data}
          onOpen={setOpenId}
          emptyText={pending.loading ? "Đang tải dữ liệu…" : "Không có hợp đồng nào đang chờ duyệt."}
        />
      </section>

      <section className="catalog-card">
        <header className="panel-header">
          <h2>Đã duyệt, chờ khách đặt cọc ({noDeposit.length})</h2>
          <span className="text-muted">Quá 3 ngày chưa đặt cọc thì Quản lý huỷ hợp đồng để trả máy.</span>
        </header>
        <ContractTable rows={noDeposit} onOpen={setOpenId} emptyText="Không có hợp đồng nào đang chờ đặt cọc." />
      </section>

      {openId && (
        <ContractDetailModal
          id={openId}
          user={user}
          onClose={() => setOpenId(null)}
          onChanged={(message) => {
            setToast({ type: "success", message });
            reloadAll();
          }}
          onEdit={() => setToast({ type: "error", message: "Sửa hợp đồng ở màn Quản lý hợp đồng." })}
        />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

export default ApprovePage;
