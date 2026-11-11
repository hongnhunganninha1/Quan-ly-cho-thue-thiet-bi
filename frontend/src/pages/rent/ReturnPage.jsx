import { useCallback, useEffect, useState } from "react";
import "../catalog/CatalogPage.css";
import "../equipment/Equipment.css";
import "./Rent.css";
import { api } from "../../api/client";
import useApiData from "../../hooks/useApiData";
import FormModal from "../../components/common/FormModal";
import Toast from "../../components/common/Toast";
import StatusBadge from "../../components/common/StatusBadge";
import { SearchIcon } from "../../components/common/Icons";
import PagerFooter, { PageSizeSelect } from "../../components/common/Pager";
import usePager from "../../hooks/usePager";
import ContractDetailModal from "./ContractDetailModal";
import TicketDetailModal from "./TicketDetailModal";
import RowMenu from "../../components/common/RowMenu";
import PrintPreview from "../../components/common/PrintPreview";
import { ticketDoc } from "../../utils/printDocs";
import { EyeIcon } from "../../components/common/Icons";
import { MeterPhotoField } from "../../components/common/MeterPhoto";
import { formatDate, formatDateTime, formatMoney, formatNumber, normalizeText, nowLocalISO } from "../../utils/format";
import { PAYMENT_STATUS, PRICING_TYPE } from "../../utils/labels";
import { warehouseOptions } from "../../utils/options";

const TABS = [
  { key: "returns", label: "Chờ thu hồi" },
  { key: "history", label: "Phiếu thu hồi" },
  { key: "settle", label: "Chờ quyết toán" },
  { key: "settled", label: "Đã quyết toán" },
];

// Bảng tính phí khi thu hồi, tự tính lại (gọi backend) mỗi khi đổi thời điểm trả / giờ máy / bồi thường
function ReturnPreview({ detail, form }) {
  const [fees, setFees] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!form.returned_at || form.operating_hours === "") return;
    let active = true;
    const timer = setTimeout(() => {
      api
        .post("/returns/preview", {
          contract_detail_id: detail.id,
          returned_at: form.returned_at,
          operating_hours: form.operating_hours,
          is_damaged: form.is_damaged,
          compensation_amount: form.compensation_amount,
        })
        .then((f) => {
          if (!active) return;
          setFees(f);
          setError("");
        })
        .catch((err) => active && setError(err.message));
    }, 400); // chờ người dùng gõ xong
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [detail.id, form.returned_at, form.operating_hours, form.is_damaged, form.compensation_amount]);

  if (error) return <div className="alert alert-warning">{error}</div>;
  if (!fees) return null;

  const total = fees.overtime_fee + fees.compensation_amount;
  return (
    <div className="calc-box" style={{ marginBottom: 14 }}>
      <h4>Các khoản tính cho máy này</h4>
      <table className="summary-table">
        <tbody>
          <tr className="sub">
            <td>Tiền thuê theo hợp đồng</td>
            <td>{formatMoney(fees.rental_amount)}</td>
          </tr>
          <tr className={fees.overtime_hours > 0 ? "highlight" : ""}>
            <td>
              Vượt giờ: chạy {formatNumber(fees.used_hours)} giờ / được {formatNumber(fees.allowed_hours)} giờ → vượt{" "}
              {fees.actual_overtime !== fees.overtime_hours
                ? `${formatNumber(fees.actual_overtime)} giờ, làm tròn lên ${formatNumber(fees.overtime_hours)}`
                : formatNumber(fees.overtime_hours)}{" "}
              giờ × giá giờ
              {fees.late_days > 0 && (
                <span className="cell-sub">Trả trễ {fees.late_days} ngày: số giờ máy chạy thêm đã tính vào phí vượt giờ</span>
              )}
            </td>
            <td>{formatMoney(fees.overtime_fee)}</td>
          </tr>
          <tr className={fees.compensation_amount > 0 ? "highlight" : ""}>
            <td>Bồi thường hư hỏng</td>
            <td>{formatMoney(fees.compensation_amount)}</td>
          </tr>
          <tr className="total">
            <td>Phát sinh thêm</td>
            <td>{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>
      <p className="calc-note">Thuê theo ngày được chạy 8 giờ/ngày. Các khoản chưa gồm VAT; VAT tính khi quyết toán (không tính trên bồi thường).</p>
    </div>
  );
}

// Bảng quyết toán của một hợp đồng
function SettlementPreview({ data }) {
  const { contract, returns, totals } = data;
  return (
    <>
      <div className="table-wrapper" style={{ marginBottom: 14 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Máy</th>
              <th>Phiếu thu hồi</th>
              <th className="align-right">Vượt giờ</th>
              <th className="align-right">Bồi thường</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.code} – {r.name}
                </td>
                <td>
                  {r.return_no} · {formatDate(r.returned_at)}
                </td>
                <td className="align-right">
                  {formatMoney(r.overtime_fee)}
                  {r.overtime_hours > 0 && <span className="cell-sub">{formatNumber(r.overtime_hours)} giờ</span>}
                  {r.late_days > 0 && <span className="cell-sub">trả trễ {r.late_days} ngày</span>}
                </td>
                <td className="align-right">{formatMoney(r.compensation_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="calc-box" style={{ marginBottom: 14 }}>
        <table className="summary-table">
          <tbody>
            <tr>
              <td>Tiền thuê (đã trừ chiết khấu, gồm vận chuyển)</td>
              <td>{formatMoney(totals.rental_total)}</td>
            </tr>
            <tr>
              <td>Phí vượt giờ</td>
              <td>{formatMoney(totals.overtime_fee_total)}</td>
            </tr>
            <tr>
              <td>VAT {Number(contract.vat_rate)}% (không tính trên bồi thường)</td>
              <td>{formatMoney(totals.vat_amount)}</td>
            </tr>
            <tr>
              <td>Bồi thường hư hỏng</td>
              <td>{formatMoney(totals.compensation_total)}</td>
            </tr>
            <tr>
              <td>Trừ tiền cọc</td>
              <td>− {formatMoney(totals.deposit_amount)}</td>
            </tr>
            <tr className="total">
              <td>{totals.amount_due >= 0 ? "Khách còn phải trả" : "Công ty hoàn lại cọc thừa"}</td>
              <td>{formatMoney(Math.abs(totals.amount_due))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// Hộp thoại quyết toán: tải bảng tính rồi mới hiện form
function SettlementDialog({ contractId, onDone, onClose }) {
  const { data, error } = useApiData(`/settlements/preview/${contractId}`);

  if (error) {
    return (
      <FormModal title="Quyết toán hợp đồng" fields={[]} initialValues={{}} submitLabel="Đóng" onSubmit={async () => onClose()} onClose={onClose}>
        {() => <div className="modal-error">{error}</div>}
      </FormModal>
    );
  }
  if (!data) return null;

  const refund = data.totals.amount_due < 0;
  return (
    <FormModal
      title={`Quyết toán hợp đồng ${data.contract.contract_no}`}
      subtitle={`${data.contract.customer_name} · ${formatDate(data.contract.start_date)} – ${formatDate(data.contract.end_date)} · ${PRICING_TYPE[data.contract.pricing_type]}`}
      size="xl"
      fields={[
        {
          name: "confirmed_at",
          label: "Thời điểm quyết toán",
          type: "datetime-local",
          required: true,
          hint: "Mặc định là hiện tại; nhập ngày thực tế nếu quyết toán từ trước. Doanh thu được tính vào tháng của ngày này.",
        },
        {
          name: "paid_amount",
          label: refund ? "Số tiền đã hoàn cho khách (₫)" : "Số tiền khách đã trả lúc quyết toán (₫)",
          type: "money",
          hint: "Để 0 nếu chưa thu / chưa hoàn; có thể ghi nhận thêm sau ở tab Đã quyết toán.",
        },
        { name: "note", label: "Ghi chú", maxLength: 255, placeholder: "VD: Khách hẹn trả phần còn lại trước 30/11" },
      ]}
      initialValues={{ confirmed_at: nowLocalISO(), paid_amount: String(Math.abs(data.totals.amount_due)), note: "" }}
      submitLabel="Xác nhận quyết toán"
      onSubmit={async (values) => {
        try {
          const r = await api.post("/settlements", { contract_id: contractId, ...values });
          onDone(r.message);
          return null;
        } catch (err) {
          return err.message;
        }
      }}
      onClose={onClose}
    >
      {() => <SettlementPreview data={data} />}
    </FormModal>
  );
}

// Màn Quản lý thu hồi, bồi thường & quyết toán
// navParam: tab mở sẵn khi đi từ thông báo tới (VD "settle" = Chờ quyết toán)
function ReturnPage({ user, navParam }) {
  const pendingReturns = useApiData("/returns/pending", []);
  const pendingSettle = useApiData("/settlements/pending", []);
  const settlements = useApiData("/settlements", []);
  const returns = useApiData("/returns", []);
  const { data: warehouses, reload: reloadWarehouses } = useApiData("/warehouses", []);
  const [tab, setTab] = useState(["returns", "settle", "settled", "history"].includes(navParam) ? navParam : "returns");
  const [returning, setReturning] = useState(null);
  const [settling, setSettling] = useState(null);
  const [paying, setPaying] = useState(null);
  const [openContract, setOpenContract] = useState(null); // id hợp đồng đang mở xem chi tiết
  const [preview, setPreview] = useState(null); // biên bản đang xem trước để in
  const [viewing, setViewing] = useState(null); // phiếu thu hồi đang xem lại
  const [keyword, setKeyword] = useState("");
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const reloadAll = () => {
    pendingReturns.reload();
    pendingSettle.reload();
    settlements.reload();
    returns.reload();
    reloadWarehouses();
  };

  const done = (message) => {
    setToast({ type: "success", message });
    reloadAll();
  };

  // Ô tra cứu: lọc theo số hợp đồng, khách hàng, mã / tên máy, số phiếu
  const kw = normalizeText(keyword.trim());
  const match = (...parts) => !kw || normalizeText(parts.filter(Boolean).join(" ")).includes(kw);
  const list = {
    returns: pendingReturns.data.filter((d) => match(d.contract_no, d.customer_name, d.code, d.name, d.handover_no)),
    settle: pendingSettle.data.filter((c) => match(c.contract_no, c.customer_name)),
    settled: settlements.data.filter((s) => match(s.contract_no, s.customer_name, s.note)),
    history: returns.data.filter((r) => match(r.return_no, r.contract_no, r.customer_name, r.code, r.name, r.warehouse_name)),
  };
  const counts = {
    returns: list.returns.length,
    settle: list.settle.length,
    settled: list.settled.length,
    history: list.history.length,
  };
  // Phân trang bảng của tab đang mở; đổi tab / từ khoá thì về trang 1
  const pager = usePager(list[tab], `${tab}|${keyword}`);

  // Số hợp đồng bấm được để mở xem chi tiết hợp đồng
  const contractLink = (id, no) => (
    <button className="link-cell" onClick={() => setOpenContract(id)} title="Xem hợp đồng">
      <strong>{no}</strong>
    </button>
  );

  const saveReturn = async (values) => {
    try {
      // Gửi dạng form có file vì kèm ảnh chụp đồng hồ giờ máy
      const fd = new FormData();
      Object.entries({ ...values, contract_detail_id: returning.id }).forEach(([k, v]) =>
        fd.append(k, v instanceof File ? v : String(v ?? "")),
      );
      const r = await api.upload("/returns", fd);
      setReturning(null);
      done(r.message);
      if (r.message.includes("chờ quyết toán")) setTab("settle");
      return null;
    } catch (err) {
      return err.message;
    }
  };

  const savePayment = async (values) => {
    try {
      const r = await api.patch(`/settlements/${paying.id}/payment`, values);
      setPaying(null);
      done(r.message);
      return null;
    } catch (err) {
      return err.message;
    }
  };

  const activeWarehouses = warehouseOptions(warehouses); // bãi đã đầy thì không chọn được

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>Thu hồi, bồi thường & quyết toán</h1>
        </div>
      </div>

      {/* Tab trạng thái nằm ngoài khung danh sách, ngay dưới tiêu đề trang */}
      <div className="status-tabs">
        {TABS.map((t) => (
          <button key={t.key} className={`status-tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label} <span className="count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <section className="catalog-card">
        <div className="toolbar">
          <label className="search-box">
            <SearchIcon />
            <input
              type="search"
              placeholder="Tìm theo số hợp đồng, khách hàng, mã / tên máy, số phiếu…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>
          <PageSizeSelect pager={pager} />
        </div>

        <div className="table-wrapper">
          {tab === "returns" && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hợp đồng</th>
                  <th>Khách hàng</th>
                  <th>Máy</th>
                  <th>Bàn giao</th>
                  <th>Hạn trả</th>
                  <th className="col-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.returns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-message">
                      {pendingReturns.loading ? "Đang tải dữ liệu…" : kw ? "Không tìm thấy kết quả phù hợp." : "Không có máy nào đang cho thuê."}
                    </td>
                  </tr>
                ) : (
                  pager.pageRows.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {contractLink(d.contract_id, d.contract_no)}
                      </td>
                      <td>{d.customer_name}</td>
                      <td>
                        <span className="cell-main">
                          {d.code} – {d.name}
                        </span>
                      </td>
                      <td>
                        {d.handover_no}
                        <span className="cell-sub">
                          {formatDateTime(d.handover_at)} · {formatNumber(d.handover_hours)} giờ máy
                        </span>
                      </td>
                      <td>
                        {formatDate(d.end_date)}
                        {d.overdue_days > 0 && <span className="danger-text">Quá hạn {d.overdue_days} ngày</span>}
                      </td>
                      <td className="col-actions">
                        <RowMenu
                          items={[
                            { key: "return", label: "Lập phiếu thu hồi", onClick: () => setReturning(d) },
                            { key: "view", label: "Xem hợp đồng", icon: <EyeIcon />, onClick: () => setOpenContract(d.contract_id) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === "settle" && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hợp đồng</th>
                  <th>Khách hàng</th>
                  <th>Thời gian thuê</th>
                  <th>Thu hồi xong</th>
                  <th className="align-right">Giá trị HĐ</th>
                  <th className="align-right">Đã cọc</th>
                  <th className="col-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.settle.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-message">
                      {kw ? "Không tìm thấy kết quả phù hợp." : "Không có hợp đồng nào chờ quyết toán."}
                    </td>
                  </tr>
                ) : (
                  pager.pageRows.map((c) => (
                    <tr key={c.id}>
                      <td>{contractLink(c.id, c.contract_no)}</td>
                      <td>{c.customer_name}</td>
                      <td>
                        {formatDate(c.start_date)} – {formatDate(c.end_date)}
                      </td>
                      <td>{formatDateTime(c.last_returned_at)}</td>
                      <td className="align-right">{formatMoney(c.total_amount)}</td>
                      <td className="align-right">{formatMoney(c.deposit_amount)}</td>
                      <td className="col-actions">
                        <RowMenu
                          items={[
                            { key: "settle", label: "Quyết toán", onClick: () => setSettling(c.id) },
                            { key: "view", label: "Xem hợp đồng", icon: <EyeIcon />, onClick: () => setOpenContract(c.id) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === "settled" && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hợp đồng / Khách hàng</th>
                  <th>Ngày quyết toán</th>
                  <th className="align-right">Phải thu / hoàn</th>
                  <th className="align-right">Đã thu / hoàn</th>
                  <th>Thanh toán</th>
                  <th className="col-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.settled.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-message">
                      {kw ? "Không tìm thấy kết quả phù hợp." : "Chưa có quyết toán nào."}
                    </td>
                  </tr>
                ) : (
                  pager.pageRows.map((s) => {
                    const remaining = Math.abs(s.amount_due) - s.paid_amount;
                    return (
                      <tr key={s.id}>
                        <td className="cell-wrap">
                          {contractLink(s.contract_id, s.contract_no)}
                          <span className="cell-sub">{s.customer_name}</span>
                        </td>
                        <td>
                          {formatDate(s.confirmed_at)}
                          <span className="cell-sub">{s.confirmed_by_name}</span>
                        </td>
                        <td className="align-right">
                          {formatMoney(Math.abs(s.amount_due))}
                          <span className="cell-sub">{s.amount_due >= 0 ? "khách phải trả" : "hoàn cho khách"}</span>
                        </td>
                        <td className="align-right">{formatMoney(s.paid_amount)}</td>
                        <td className="cell-wrap cell-compact">
                          <StatusBadge map={PAYMENT_STATUS} value={s.payment_status} />
                          {s.note && <span className="cell-sub">{s.note}</span>}
                        </td>
                        <td className="col-actions">
                          <RowMenu
                            items={[
                              {
                                key: "pay",
                                label: "Ghi nhận thanh toán",
                                disabled: remaining <= 0,
                                title: remaining <= 0 ? "Đã thanh toán đủ" : "",
                                onClick: () => setPaying(s),
                              },
                              {
                                key: "view",
                                label: "Xem hợp đồng",
                                icon: <EyeIcon />,
                                onClick: () => setOpenContract(s.contract_id),
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
          )}

          {tab === "history" && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Số phiếu</th>
                  <th>Hợp đồng / Máy</th>
                  <th className="align-right">Giờ máy / Về bãi</th>
                  <th>Hư hỏng</th>
                  <th className="align-right">Phí phát sinh</th>
                  <th className="col-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.history.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-message">
                      {kw ? "Không tìm thấy kết quả phù hợp." : "Chưa có phiếu thu hồi nào."}
                    </td>
                  </tr>
                ) : (
                  pager.pageRows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <button className="link-cell" onClick={() => setViewing(r)} title="Xem phiếu">
                          <strong>{r.return_no}</strong>
                        </button>
                        <span className="cell-sub">Nhận: {r.received_by_name}</span>
                      </td>
                      <td className="cell-wrap">
                        {contractLink(r.contract_id, r.contract_no)}
                        <span className="cell-sub">
                          {r.code} – {r.name}
                        </span>
                      </td>
                      <td className="align-right">
                        {formatNumber(r.operating_hours)}
                        <span className="cell-sub">{r.warehouse_name}</span>
                      </td>
                      <td className="cell-wrap">
                        {r.is_damaged ? <span className="badge badge-danger">Có</span> : <span className="text-muted">Không</span>}
                        {r.damage_description && <span className="cell-sub">{r.damage_description}</span>}
                      </td>
                      <td className="align-right">
                        {formatMoney(r.overtime_fee + r.compensation_amount)}
                        {r.late_days > 0 && <span className="cell-sub">trễ {r.late_days} ngày</span>}
                      </td>
                      <td className="col-actions">
                        <RowMenu
                          items={[
                            { key: "ticket", label: "Xem phiếu & ảnh đồng hồ", icon: <EyeIcon />, onClick: () => setViewing(r) },
                            { key: "print", label: "In biên bản", onClick: () => setPreview(() => () => ticketDoc(r.contract_id, "return", r.return_no)) },
                            { key: "view", label: "Xem hợp đồng", onClick: () => setOpenContract(r.contract_id) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        <PagerFooter pager={pager} />
      </section>

      {preview && <PrintPreview load={preview} onClose={() => setPreview(null)} />}
      {openContract && (
        <ContractDetailModal
          id={openContract}
          user={user}
          onClose={() => setOpenContract(null)}
          onChanged={done}
          onEdit={() => {}}
        />
      )}

      {viewing && (
        <TicketDetailModal
          kind="return"
          ticket={viewing}
          onClose={() => setViewing(null)}
          onOpenContract={(id) => {
            setViewing(null);
            setOpenContract(id);
          }}
        />
      )}

      {returning && (
        <FormModal
          title="Lập phiếu thu hồi"
          subtitle={`${returning.contract_no} · ${returning.code} – ${returning.name} · hạn trả ${formatDate(returning.end_date)}`}
          size="xl"
          fields={[
            { name: "returned_at", label: "Thời điểm thu hồi", type: "datetime-local", required: true },
            { name: "to_warehouse_id", label: "Nhận về bãi", type: "select", required: true, options: activeWarehouses, emptyOption: "— Chọn bãi —" },
            {
              name: "operating_hours",
              label: "Số giờ máy lúc nhận",
              type: "number",
              required: true,
              hint: `Lúc bàn giao: ${formatNumber(returning.handover_hours)} giờ.`,
            },
            {
              name: "meter_photo",
              label: "Ảnh chụp đồng hồ giờ máy",
              type: "custom",
              required: true,
              full: true,
              hint: returning.handover_meter_photo
                ? "Chụp rõ mặt đồng hồ; đối chiếu với ảnh lúc bàn giao bên cạnh (bấm vào ảnh để xem lớn)."
                : "Chụp rõ mặt đồng hồ, thấy được con số giờ máy.",
              render: (p) => (
                <MeterPhotoField
                  {...p}
                  compareUrl={returning.handover_meter_photo}
                  compareTitle={`Lúc bàn giao (${returning.handover_no}): ${formatNumber(returning.handover_hours)} giờ`}
                />
              ),
            },
            { name: "fuel_level", label: "Mức nhiên liệu (%)", type: "number", placeholder: "0 – 100" },
            { name: "condition_note", label: "Tình trạng máy khi nhận", type: "textarea", full: true },
            { name: "is_damaged", label: "Hư hỏng", type: "checkbox", checkLabel: "Máy bị hư hỏng (máy sẽ chuyển sang Ngừng hoạt động để sửa)", full: true },
            { name: "damage_description", label: "Mô tả hư hỏng", type: "textarea", full: true, required: true, show: (f) => f.is_damaged },
            { name: "compensation_amount", label: "Tiền bồi thường (₫)", type: "money", show: (f) => f.is_damaged },
          ]}
          initialValues={{ returned_at: nowLocalISO(), operating_hours: String(returning.handover_hours), meter_photo: "", is_damaged: false, compensation_amount: "0" }}
          submitLabel="Xác nhận thu hồi"
          onSubmit={saveReturn}
          onClose={() => setReturning(null)}
        >
          {(form) => <ReturnPreview detail={returning} form={form} />}
        </FormModal>
      )}

      {settling && (
        <SettlementDialog
          contractId={settling}
          onClose={() => setSettling(null)}
          onDone={(message) => {
            setSettling(null);
            done(message);
            setTab("settled");
          }}
        />
      )}

      {paying && (
        <FormModal
          title="Ghi nhận thanh toán"
          subtitle={`${paying.contract_no} · còn ${paying.amount_due >= 0 ? "phải thu" : "phải hoàn"} ${formatMoney(Math.abs(paying.amount_due) - paying.paid_amount)}`}
          size="md"
          fields={[
            { name: "amount", label: paying.amount_due >= 0 ? "Số tiền khách trả thêm (₫)" : "Số tiền hoàn thêm cho khách (₫)", type: "money", required: true, full: true },
            { name: "note", label: "Ghi chú", maxLength: 255, full: true },
          ]}
          initialValues={{ amount: String(Math.abs(paying.amount_due) - paying.paid_amount), note: "" }}
          submitLabel="Ghi nhận"
          onSubmit={savePayment}
          onClose={() => setPaying(null)}
        />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

export default ReturnPage;
