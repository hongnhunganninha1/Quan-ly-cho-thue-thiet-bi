import ReportShell from "./ReportShell";
import useApiData from "../../hooks/useApiData";
import StatusBadge from "../../components/common/StatusBadge";
import { formatDate, formatMoney, formatReportNumber as n, todayISO } from "../../utils/format";
import { PAYMENT_STATUS } from "../../utils/labels";

// Báo cáo công nợ khách hàng: tiền còn phải thu sau quyết toán, cọc thừa còn phải hoàn
function DebtReport({ user }) {
  const { data, error, loading } = useApiData("/reports/customer-debt");
  const customers = data?.customers || [];
  const receivable = customers.reduce((s, c) => s + Number(c.receivable || 0), 0);
  const refund = customers.reduce((s, c) => s + Number(c.refund_pending || 0), 0);
  const debtors = customers.filter((c) => Number(c.receivable) > 0);
  const open = data?.openSettlements || [];
  const customerName = (id) => customers.find((c) => c.customer_id === id)?.name || "";

  return (
    <ReportShell
      title="Báo cáo công nợ khách hàng"
      description="Số tiền khách còn nợ sau quyết toán và tiền cọc thừa công ty còn phải hoàn, theo từng khách hàng."
      user={user}
      print={{
        formCode: "BC05-CN",
        period: `Số liệu đến ngày ${formatDate(todayISO())}`,
        unit: "đồng",
        signerType: "finance",
        sections: [
          {
            title: "I. CÔNG NỢ THEO KHÁCH HÀNG",
            columns: [
              { label: "Mã khách hàng", align: "left", width: 80 },
              { label: "Tên khách hàng", align: "left" },
              { label: "Điện thoại", align: "left", width: 95 },
              { label: "Số HĐ đã quyết toán", align: "right", width: 80 },
              { label: "Còn phải thu", align: "right", width: 115 },
              { label: "Còn phải hoàn cọc", align: "right", width: 115 },
              { label: "Số lần trả máy trễ", align: "right", width: 75 },
            ],
            rows: [
              ...customers.map((c) => ({
                cells: [c.code, c.name, c.phone, n(c.settled_contracts), n(c.receivable), n(c.refund_pending), n(c.late_returns)],
              })),
              { kind: "total", cells: ["Tổng cộng", "", "", n(customers.reduce((s, c) => s + Number(c.settled_contracts || 0), 0)), n(receivable), n(refund), ""] },
            ],
          },
          {
            title: "II. CHI TIẾT CÁC KHOẢN QUYẾT TOÁN CHƯA THU ĐỦ",
            columns: [
              { label: "Số hợp đồng", align: "left", width: 110 },
              { label: "Khách hàng", align: "left" },
              { label: "Ngày quyết toán", align: "center", width: 90 },
              { label: "Số phải thu", align: "right", width: 110 },
              { label: "Đã thu", align: "right", width: 110 },
              { label: "Còn lại", align: "right", width: 110 },
              { label: "Tình trạng", align: "left", width: 110 },
            ],
            rows: [
              ...open.map((x) => ({
                cells: [
                  x.contract_no,
                  customerName(x.customer_id),
                  formatDate(x.confirmed_at),
                  n(x.amount_due),
                  n(x.paid_amount),
                  n(x.amount_due - x.paid_amount),
                  PAYMENT_STATUS[x.payment_status].label,
                ],
              })),
              ...(open.length
                ? [
                    {
                      kind: "total",
                      cells: [
                        "Tổng cộng",
                        "",
                        "",
                        n(open.reduce((s, x) => s + Number(x.amount_due), 0)),
                        n(open.reduce((s, x) => s + Number(x.paid_amount), 0)),
                        n(open.reduce((s, x) => s + Number(x.amount_due - x.paid_amount), 0)),
                        "",
                      ],
                    },
                  ]
                : []),
            ],
          },
        ],
      }}
      canExport={Boolean(customers.length)}
    >
      {error && <div className="modal-error">{error}</div>}
      {loading && <p className="text-muted">Đang tải…</p>}
      {data && (
        <>
          <div className="report-kpis">
            <div className="kpi">
              <span>Tổng còn phải thu</span>
              <strong>{formatMoney(receivable)}</strong>
              <small>{debtors.length} khách hàng còn nợ</small>
            </div>
            <div className="kpi">
              <span>Cọc thừa còn phải hoàn</span>
              <strong>{formatMoney(refund)}</strong>
            </div>
            <div className="kpi">
              <span>Quyết toán chưa thu đủ</span>
              <strong>{data.openSettlements.length}</strong>
            </div>
          </div>

          <section className="catalog-card">
            <header className="panel-header">
              <h2>Theo khách hàng</h2>
            </header>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Khách hàng</th>
                    <th>Điện thoại</th>
                    <th className="align-right">HĐ đã quyết toán</th>
                    <th className="align-right">Còn phải thu</th>
                    <th className="align-right">Còn phải hoàn</th>
                    <th className="align-right">Lần trả máy trễ</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.customer_id}>
                      <td>
                        <span className="cell-main">{c.name}</span>
                        <span className="cell-sub">{c.code}</span>
                      </td>
                      <td>{c.phone}</td>
                      <td className="align-right">{c.settled_contracts}</td>
                      <td className="align-right">
                        {Number(c.receivable) > 0 ? (
                          <strong className="danger-text">{formatMoney(c.receivable)}</strong>
                        ) : (
                          <span className="text-muted">0 ₫</span>
                        )}
                      </td>
                      <td className="align-right">
                        {Number(c.refund_pending) > 0 ? formatMoney(c.refund_pending) : <span className="text-muted">0 ₫</span>}
                      </td>
                      <td className="align-right">{c.late_returns}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Tổng cộng</td>
                    <td className="align-right">{formatMoney(receivable)}</td>
                    <td className="align-right">{formatMoney(refund)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="catalog-card">
            <header className="panel-header">
              <h2>Các quyết toán chưa thu đủ</h2>
            </header>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hợp đồng</th>
                    <th>Ngày quyết toán</th>
                    <th className="align-right">Phải thu</th>
                    <th className="align-right">Đã thu</th>
                    <th className="align-right">Còn lại</th>
                    <th>Tình trạng</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="table-message">
                        Không có khoản nợ nào.
                      </td>
                    </tr>
                  ) : (
                    data.openSettlements.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.contract_no}</strong>
                        </td>
                        <td>{formatDate(s.confirmed_at)}</td>
                        <td className="align-right">{formatMoney(s.amount_due)}</td>
                        <td className="align-right">{formatMoney(s.paid_amount)}</td>
                        <td className="align-right">
                          <strong>{formatMoney(s.amount_due - s.paid_amount)}</strong>
                        </td>
                        <td>
                          <StatusBadge map={PAYMENT_STATUS} value={s.payment_status} />
                        </td>
                        <td className="cell-wrap">{s.note || <span className="text-muted">—</span>}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </ReportShell>
  );
}

export default DebtReport;
