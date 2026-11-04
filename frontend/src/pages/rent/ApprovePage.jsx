import { useCallback, useState } from "react";
import "../catalog/CatalogPage.css";
import "./Rent.css";
import useApiData from "../../hooks/useApiData";
import Toast from "../../components/common/Toast";
import PagerFooter, { PageSizeSelect } from "../../components/common/Pager";
import usePager from "../../hooks/usePager";
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
  const pendingPager = usePager(pending.data);
  const depositPager = usePager(noDeposit);

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>Hợp đồng chờ duyệt</h1>
        </div>
      </div>

      <section className="catalog-card">
        <header className="panel-header">
          <h2>Chờ duyệt ({pending.data.length})</h2>
          <PageSizeSelect pager={pendingPager} />
        </header>
        <ContractTable
          rows={pendingPager.pageRows}
          onOpen={setOpenId}
          emptyText={pending.loading ? "Đang tải dữ liệu…" : "Không có hợp đồng nào đang chờ duyệt."}
        />
        <PagerFooter pager={pendingPager} />
      </section>

      <section className="catalog-card">
        <header className="panel-header">
          <h2>Đã duyệt, chờ khách đặt cọc ({noDeposit.length})</h2>
          <span className="text-muted">Quá 3 ngày chưa đặt cọc thì Quản lý huỷ hợp đồng để trả máy.</span>
          <PageSizeSelect pager={depositPager} />
        </header>
        <ContractTable rows={depositPager.pageRows} onOpen={setOpenId} emptyText="Không có hợp đồng nào đang chờ đặt cọc." />
        <PagerFooter pager={depositPager} />
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
          onEdit={() => setToast({ type: "error", message: "Sửa hợp đồng ở mục Cho thuê → Hợp đồng." })}
        />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

export default ApprovePage;
