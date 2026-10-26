import { useCallback, useState } from "react";
import "../catalog/CatalogPage.css";
import "../equipment/Equipment.css";
import "./Rent.css";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import Toast from "../../components/common/Toast";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import RowMenu from "../../components/common/RowMenu";
import { EyeIcon, RefreshIcon, SearchIcon } from "../../components/common/Icons";
import ContractDetailModal from "./ContractDetailModal";
import { formatDate, formatDateTime, normalizeText } from "../../utils/format";

// Màn Nhắc duyệt: các hợp đồng đang chờ Quản lý duyệt, đã chờ bao lâu, đã nhắc chưa.
// Nhân viên: chờ quá 1 ngày thì bấm Nhắc duyệt → Quản lý nhận thông báo (mỗi hợp đồng 1 lần / ngày).
// Quản lý: xem hợp đồng nào bị nhắc nhiều, mở ra để duyệt.
function RemindPage({ user }) {
  const isAdmin = user?.role === "ADMIN";
  const { data: rows, loading, error, reload } = useApiData("/contracts/reminders", []);
  const [keyword, setKeyword] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [reminding, setReminding] = useState(null);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const kw = normalizeText(keyword.trim());
  const list = rows.filter(
    (r) =>
      (!onlyMine || r.created_by === user.id) &&
      (!kw || normalizeText(`${r.contract_no} ${r.customer_name} ${r.created_by_name}`).includes(kw)),
  );
  const overdue = rows.filter((r) => r.waited_days >= 1).length;
  const remindedToday = rows.filter((r) => r.remind_block === "Hôm nay đã nhắc duyệt hợp đồng này rồi.").length;

  const done = (message) => {
    setToast({ type: "success", message });
    reload();
  };

  const sendRemind = async (note) => {
    try {
      const r = await api.post(`/contracts/${reminding.id}/remind`, { note });
      setReminding(null);
      done(r.message);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  // Màu số ngày chờ: dưới 1 ngày bình thường, 1–2 ngày vàng, từ 3 ngày đỏ
  const waitBadge = (d) => (d >= 3 ? "badge-danger" : d >= 1 ? "badge-warning" : "badge-neutral");

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>Nhắc duyệt</h1>
        </div>
        <button className="btn btn-secondary btn-icon" onClick={reload}>
          <RefreshIcon /> Tải lại
        </button>
      </div>

      <section className="catalog-card">
        <div className="summary-chips" style={{ paddingBottom: 4 }}>
          <span className="badge badge-info">{rows.length} hợp đồng đang chờ duyệt</span>
          <span className="badge badge-warning">{overdue} hợp đồng chờ quá 1 ngày</span>
          <span className="badge badge-neutral">{remindedToday} hợp đồng đã nhắc hôm nay</span>
        </div>

        <div className="toolbar">
          <label className="search-box">
            <SearchIcon />
            <input
              type="search"
              placeholder="Tìm theo số hợp đồng, khách hàng, người lập…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>
          {!isAdmin && (
            <label className="form-check">
              <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />
              <span>Chỉ hợp đồng tôi lập</span>
            </label>
          )}
        </div>

        {error && (
          <div className="modal-error" style={{ margin: 16 }}>
            {error}
          </div>
        )}

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Hợp đồng</th>
                <th>Khách hàng</th>
                <th>Người lập</th>
                <th>Gửi duyệt lúc</th>
                <th>Đã chờ</th>
                <th>Nhắc duyệt</th>
                <th className="col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-message">
                    {loading
                      ? "Đang tải dữ liệu…"
                      : rows.length === 0
                        ? "Không có hợp đồng nào đang chờ duyệt."
                        : "Không tìm thấy kết quả phù hợp."}
                  </td>
                </tr>
              ) : (
                list.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button className="link-cell" onClick={() => setOpenId(r.id)} title="Xem hợp đồng">
                        {r.contract_no}
                      </button>
                      <span className="cell-sub">
                        {formatDate(r.start_date)} – {formatDate(r.end_date)}
                      </span>
                    </td>
                    <td className="cell-wrap">{r.customer_name}</td>
                    <td>{r.created_by_name}</td>
                    <td>{formatDateTime(r.submitted_at || r.updated_at)}</td>
                    <td>
                      <span className={`badge ${waitBadge(r.waited_days)}`}>
                        {r.waited_days >= 1 ? `${r.waited_days} ngày` : "Dưới 1 ngày"}
                      </span>
                    </td>
                    <td className="cell-wrap">
                      {r.remind_count > 0 ? (
                        <>
                          <span className="cell-main">
                            {r.remind_count} lần · gần nhất {formatDateTime(r.last_reminded_at)}
                          </span>
                          {r.last_message && <span className="cell-sub">{r.last_message}</span>}
                        </>
                      ) : (
                        <span className="text-muted">Chưa nhắc</span>
                      )}
                    </td>
                    <td className="col-actions">
                      <RowMenu
                        items={[
                          !isAdmin && {
                            key: "remind",
                            label: "Nhắc duyệt",
                            disabled: Boolean(r.remind_block),
                            title: r.remind_block || "Gửi thông báo nhắc Quản lý duyệt",
                            onClick: () => setReminding(r),
                          },
                          {
                            key: "view",
                            label: isAdmin ? "Xem và duyệt" : "Xem hợp đồng",
                            icon: <EyeIcon />,
                            onClick: () => setOpenId(r.id),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="form-hint" style={{ padding: "12px 16px" }}>
          Hợp đồng chờ duyệt quá 1 ngày thì Nhân viên được nhắc duyệt. Thông báo chỉ Quản lý nhìn thấy; mỗi hợp đồng
          nhắc tối đa 1 lần mỗi ngày.
        </p>
      </section>

      {reminding && (
        <ConfirmDialog
          title="Nhắc duyệt hợp đồng"
          message={`Gửi thông báo nhắc Quản lý duyệt hợp đồng ${reminding.contract_no} (đã chờ ${reminding.waited_days} ngày)?`}
          confirmLabel="Gửi nhắc"
          tone="primary"
          inputLabel="Lời nhắn (không bắt buộc)"
          inputRequired={false}
          onConfirm={sendRemind}
          onClose={() => setReminding(null)}
        />
      )}

      {openId && (
        <ContractDetailModal
          id={openId}
          user={user}
          onClose={() => setOpenId(null)}
          onChanged={done}
          onEdit={() => {}}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

export default RemindPage;
