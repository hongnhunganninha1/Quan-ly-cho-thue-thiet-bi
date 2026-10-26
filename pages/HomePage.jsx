import "./HomePage.css";
import useApiData from "../hooks/useApiData";
import DonutChart from "../components/common/DonutChart";
import { formatDate, formatMoney } from "../utils/format";
import { DOC_TYPES, EQUIPMENT_STATUS } from "../utils/labels";

const STATUS_KEYS = ["available", "reserved", "rented", "inactive"];
const STATUS_CODE = { available: "AVAILABLE", reserved: "RESERVED", rented: "RENTED", inactive: "INACTIVE" };

// Mũi tên tăng (xanh) / giảm (đỏ)
function TrendArrow({ up }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {up ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
    </svg>
  );
}

// So sánh doanh thu tháng này với tháng trước: chênh lệch bao nhiêu tiền, tương đương bao nhiêu %
function RevenueTrend({ current, previous }) {
  const diff = current - previous;
  if (diff === 0) {
    return <span className="stat-trend flat">Không đổi so với tháng trước</span>;
  }
  const up = diff > 0;
  // Tháng trước bằng 0 thì không tính được %
  const percent = previous > 0 ? `${(Math.round((Math.abs(diff) / previous) * 1000) / 10).toLocaleString("vi-VN")}%` : null;
  return (
    <span className={`stat-trend ${up ? "up" : "down"}`} title={`Tháng trước: ${formatMoney(previous)}`}>
      <TrendArrow up={up} />
      <strong>
        {up ? "+" : "−"}
        {formatMoney(Math.abs(diff))}
        {percent && ` (${up ? "+" : "−"}${percent})`}
      </strong>
      <span className="stat-trend-text">so với tháng trước</span>
    </span>
  );
}

// Trang chủ (dashboard): số liệu tổng quan lấy từ API /dashboard
function HomePage({ onNavigate, user }) {
  const { data, error } = useApiData("/dashboard");

  if (error) return <div className="content-empty">{error}</div>;
  if (!data) return <p className="text-muted">Đang tải…</p>;

  const eq = data.equipment;
  const total = Number(eq.total) || 0;
  const percent = (n) => (total ? Math.round((Number(n) / total) * 100) : 0);
  const isAdmin = user.role === "ADMIN";
  const { this_month: thisMonth, last_month: lastMonth } = data.revenue || {}; // doanh thu chỉ trả về cho Quản lý

  const stats = [
    { key: "equipment", label: "Tổng số thiết bị", value: total, note: `Trong ${eq.warehouses} bãi máy` },
    { key: "renting", label: "Đang cho thuê", value: Number(eq.rented), note: `Chiếm ${percent(eq.rented)}% đội máy` },
    {
      key: "pending",
      label: "Hợp đồng chờ duyệt",
      value: data.pending.length,
      note: data.depositWaiting ? `${data.depositWaiting} hợp đồng chờ khách đặt cọc` : "Không có hợp đồng chờ cọc",
    },
    isAdmin
      ? {
          key: "revenue",
          label: "Doanh thu tháng này",
          value: formatMoney(thisMonth),
          note: <RevenueTrend current={Number(thisMonth)} previous={Number(lastMonth)} />,
        }
      : {
          key: "due",
          label: "Sắp đến hạn trả máy",
          value: data.dueSoon.length,
          note: "Hợp đồng còn ≤ 3 ngày hoặc đã quá hạn",
        },
  ];

  return (
    <div className="home">
      {/* Hàng ô số liệu */}
      <div className="stat-grid">
        {stats.map((stat) => (
          <div key={stat.key} className="stat-card">
            <span className="stat-label">{stat.label}</span>
            <strong className="stat-value">{stat.value}</strong>
            <span className="stat-note">{stat.note}</span>
          </div>
        ))}
      </div>

      <div className="home-columns">
        {/* Tình trạng thiết bị */}
        <section className="card">
          <header className="card-header">
            <h2>Tình trạng thiết bị</h2>
            <button className="link-button" onClick={() => onNavigate("equipment-profile")}>
              Xem thiết bị
            </button>
          </header>

          {/* Biểu đồ tròn: mỗi phần là một trạng thái */}
          <DonutChart
            centerLabel="thiết bị"
            data={STATUS_KEYS.map((k) => ({
              key: k,
              label: EQUIPMENT_STATUS[STATUS_CODE[k]].label,
              value: Number(eq[k]) || 0,
              color: EQUIPMENT_STATUS[STATUS_CODE[k]].color,
            }))}
          />
        </section>

        {/* Hợp đồng chờ duyệt */}
        <section className="card">
          <header className="card-header">
            <h2>Hợp đồng chờ duyệt</h2>
            <button className="link-button" onClick={() => onNavigate(isAdmin ? "rent-approve" : "rent-contract")}>
              {isAdmin ? "Đến trang duyệt" : "Xem hợp đồng"}
            </button>
          </header>

          {data.pending.length === 0 ? (
            <p className="card-empty">Không có hợp đồng nào đang chờ duyệt.</p>
          ) : (
            <ul className="pending-list">
              {data.pending.slice(0, 4).map((c) => (
                <li key={c.id}>
                  <div>
                    <strong>{c.contract_no}</strong>
                    <span>{c.customer_name}</span>
                    <small>
                      {c.created_by_name} lập ngày {formatDate(c.created_at)}
                    </small>
                  </div>
                  <strong className="pending-total">{formatMoney(c.total_amount)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Hợp đồng sắp đến hạn / quá hạn */}
      <section className="card">
        <header className="card-header">
          <h2>Hợp đồng sắp đến hạn trả máy</h2>
          <button className="link-button" onClick={() => onNavigate("rent-return")}>
            Đến trang thu hồi
          </button>
        </header>

        {data.dueSoon.length === 0 ? (
          <p className="card-empty">Không có hợp đồng nào sắp đến hạn trong 3 ngày tới.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Số hợp đồng</th>
                  <th>Khách hàng</th>
                  <th>Thiết bị chưa thu hồi</th>
                  <th>Ngày kết thúc</th>
                  <th>Còn lại</th>
                </tr>
              </thead>
              <tbody>
                {data.dueSoon.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.contract_no}</strong>
                    </td>
                    <td>{c.customer_name}</td>
                    <td>{c.equipment_names}</td>
                    <td>{formatDate(c.end_date)}</td>
                    <td>
                      {c.days_left < 0 ? (
                        <span className="badge badge-danger">Quá hạn {-c.days_left} ngày</span>
                      ) : c.days_left === 0 ? (
                        <span className="badge badge-warning">Hết hạn hôm nay</span>
                      ) : (
                        <span className="badge badge-warning">Còn {c.days_left} ngày</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Giấy tờ sắp hết hạn */}
      {data.expiringDocs.length > 0 && (
        <section className="card">
          <header className="card-header">
            <h2>Giấy tờ thiết bị sắp hết hạn (30 ngày tới)</h2>
            <button className="link-button" onClick={() => onNavigate("equipment-profile")}>
              Xem hồ sơ thiết bị
            </button>
          </header>
          <ul className="pending-list">
            {data.expiringDocs.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>
                    {d.code} – {d.name}
                  </strong>
                  <span>
                    {DOC_TYPES[d.doc_type]} {d.doc_number ? `số ${d.doc_number}` : ""}
                  </span>
                </div>
                <span className="badge badge-warning">Hết hạn {formatDate(d.expiry_date)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default HomePage;
