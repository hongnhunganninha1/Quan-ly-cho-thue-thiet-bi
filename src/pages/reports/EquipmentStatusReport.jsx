import ReportShell from "./ReportShell";
import useApiData from "../../hooks/useApiData";
import { formatDate, formatReportNumber as n, todayISO } from "../../utils/format";
import { EQUIPMENT_STATUS } from "../../utils/labels";

const PARTS = ["available", "reserved", "rented", "inactive"];
const PART_STATUS = { available: "AVAILABLE", reserved: "RESERVED", rented: "RENTED", inactive: "INACTIVE" };

// Báo cáo kiểm kê thiết bị: số máy theo trạng thái, theo loại và theo bãi
function EquipmentStatusReport({ user }) {
  const { data, error, loading } = useApiData("/reports/equipment-status");
  const rows = data?.byCategory || [];
  const sum = (key) => rows.reduce((s, r) => s + Number(r[key] || 0), 0);
  const total = sum("total");

  // Bản in: mỗi nhóm thiết bị là 1 dòng in đậm (cộng các loại trong nhóm), bên dưới là các loại
  const categoryRows = [];
  rows.forEach((r, i) => {
    if (i === 0 || rows[i - 1].group_id !== r.group_id) {
      const inGroup = rows.filter((x) => x.group_id === r.group_id);
      const g = (key) => inGroup.reduce((s, x) => s + Number(x[key] || 0), 0);
      categoryRows.push({ kind: "group", cells: [r.group_name, n(g("total")), ...PARTS.map((p) => n(g(p)))] });
    }
    categoryRows.push({ cells: [r.category_name, n(r.total), ...PARTS.map((p) => n(r[p]))] });
  });
  const partColumns = PARTS.map((p) => ({ label: EQUIPMENT_STATUS[PART_STATUS[p]].label, align: "right", width: 85 }));

  return (
    <ReportShell
      title="Báo cáo kiểm kê thiết bị"
      description="Số máy theo trạng thái tại thời điểm xem (không tính máy đã thanh lý)."
      user={user}
      print={
        data && {
          formCode: "BC01-TB",
          period: `Số liệu tại ngày ${formatDate(todayISO())}`,
          unit: "chiếc",
          orientation: "portrait",
          sections: [
            {
              title: "I. THEO NHÓM, LOẠI THIẾT BỊ",
              columns: [{ label: "Nhóm / Loại thiết bị", align: "left" }, { label: "Tổng số máy", align: "right", width: 70 }, ...partColumns],
              rows: [...categoryRows, { kind: "total", cells: ["Tổng cộng", n(total), ...PARTS.map((p) => n(sum(p)))] }],
            },
            {
              title: "II. THEO BÃI MÁY",
              columns: [
                { label: "Bãi máy", align: "left" },
                { label: "Sức chứa", align: "right", width: 65 },
                { label: "Máy tại bãi", align: "right", width: 65 },
                { label: "Sẵn sàng", align: "right", width: 70 },
                { label: "Đã giữ chỗ", align: "right", width: 70 },
                { label: "Ngừng hoạt động", align: "right", width: 80 },
                { label: "Tỷ lệ lấp đầy (%)", align: "right", width: 75 },
              ],
              rows: data.byWarehouse.map((w) => ({
                cells: [
                  `${w.code} – ${w.name}`,
                  n(w.capacity),
                  n(w.total),
                  n(w.available),
                  n(w.reserved),
                  n(w.inactive),
                  w.capacity ? n(Math.min(100, (w.total / w.capacity) * 100), 1) : "",
                ],
              })),
            },
          ],
          notes: [
            `Ghi chú: Số máy đang ở công trình (không thuộc bãi nào): ${data.onSite} chiếc. Không tính ${data.liquidated} máy đã thanh lý.`,
          ],
        }
      }
      canExport={Boolean(rows.length)}
    >
      {error && <div className="modal-error">{error}</div>}
      {loading && <p className="text-muted">Đang tải…</p>}
      {data && (
        <>
          <div className="report-kpis">
            <div className="kpi">
              <span>Tổng số máy</span>
              <strong>{total}</strong>
              <small>{data.liquidated} máy đã thanh lý không tính</small>
            </div>
            {PARTS.map((p) => (
              <div className="kpi" key={p}>
                <span>{EQUIPMENT_STATUS[PART_STATUS[p]].label}</span>
                <strong>{sum(p)}</strong>
                <small>{total ? Math.round((sum(p) / total) * 100) : 0}% đội máy</small>
              </div>
            ))}
          </div>

          <section className="catalog-card">
            <header className="panel-header">
              <h2>Theo loại thiết bị</h2>
            </header>
            <div className="legend">
              {PARTS.map((p) => (
                <span key={p}>
                  <i style={{ background: EQUIPMENT_STATUS[PART_STATUS[p]].color }} />
                  {EQUIPMENT_STATUS[PART_STATUS[p]].label}
                </span>
              ))}
            </div>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nhóm / Loại thiết bị</th>
                    <th className="align-right">Tổng</th>
                    <th className="align-right">Sẵn sàng</th>
                    <th className="align-right">Đã giữ chỗ</th>
                    <th className="align-right">Đang cho thuê</th>
                    <th className="align-right">Ngừng hoạt động</th>
                    <th>Tỉ lệ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => [
                    // Dòng tiêu đề nhóm trước loại đầu tiên của mỗi nhóm
                    i === 0 || rows[i - 1].group_id !== r.group_id ? (
                      <tr key={`g${r.group_id}`} className="group-row">
                        <td colSpan={7}>{r.group_name}</td>
                      </tr>
                    ) : null,
                    <tr key={r.category_id}>
                      <td className="indent-cell">{r.category_name}</td>
                      <td className="align-right">{r.total}</td>
                      {PARTS.map((p) => (
                        <td key={p} className="align-right">
                          {Number(r[p] || 0)}
                        </td>
                      ))}
                      <td>
                        <div
                          className="stack-bar"
                          role="img"
                          aria-label={PARTS.map((p) => `${EQUIPMENT_STATUS[PART_STATUS[p]].label} ${r[p] || 0}`).join(", ")}
                        >
                          {PARTS.map((p) =>
                            Number(r[p]) > 0 ? (
                              <span
                                key={p}
                                title={`${EQUIPMENT_STATUS[PART_STATUS[p]].label}: ${r[p]}`}
                                style={{
                                  width: `${(r[p] / r.total) * 100}%`,
                                  background: EQUIPMENT_STATUS[PART_STATUS[p]].color,
                                }}
                              />
                            ) : null,
                          )}
                        </div>
                      </td>
                    </tr>,
                  ])}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Tổng cộng</td>
                    <td className="align-right">{total}</td>
                    {PARTS.map((p) => (
                      <td key={p} className="align-right">
                        {sum(p)}
                      </td>
                    ))}
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="catalog-card">
            <header className="panel-header">
              <h2>Theo bãi máy</h2>
              <span className="text-muted">{data.onSite} máy đang ở công trình (không thuộc bãi nào)</span>
            </header>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bãi máy</th>
                    <th className="align-right">Máy tại bãi</th>
                    <th className="align-right">Sẵn sàng</th>
                    <th className="align-right">Đã giữ chỗ</th>
                    <th className="align-right">Ngừng hoạt động</th>
                    <th>Mức lấp đầy (so với sức chứa)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byWarehouse.map((w) => {
                    const rate = w.capacity ? Math.min(100, Math.round((w.total / w.capacity) * 100)) : 0;
                    return (
                      <tr key={w.id}>
                        <td>
                          <strong>{w.code}</strong> – {w.name}
                        </td>
                        <td className="align-right">{w.total}</td>
                        <td className="align-right">{Number(w.available || 0)}</td>
                        <td className="align-right">{Number(w.reserved || 0)}</td>
                        <td className="align-right">{Number(w.inactive || 0)}</td>
                        <td>
                          {w.capacity ? (
                            <div className="meter" title={`${w.total} / ${w.capacity} chỗ`}>
                              <div className="meter-track">
                                <div className="meter-fill" style={{ width: `${rate}%` }} />
                              </div>
                              <span className="meter-value">{rate}%</span>
                            </div>
                          ) : (
                            <span className="text-muted">Chưa khai báo sức chứa</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </ReportShell>
  );
}

export default EquipmentStatusReport;
