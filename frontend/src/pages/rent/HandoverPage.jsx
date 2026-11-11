import { useCallback, useState } from "react";
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
import { formatDate, formatNumber, normalizeText, nowLocalISO, todayISO } from "../../utils/format";
import { EQUIPMENT_STATUS } from "../../utils/labels";

// Màn Quản lý bàn giao: giao từng máy của hợp đồng (đã duyệt, đã đặt cọc) cho khách tại công trình
function HandoverPage({ user }) {
  const pending = useApiData("/handovers/pending", []);
  const history = useApiData("/handovers", []);
  const [tab, setTab] = useState("pending");
  const [handing, setHanding] = useState(null); // máy đang lập phiếu bàn giao
  const [openContract, setOpenContract] = useState(null); // id hợp đồng đang mở xem chi tiết
  const [preview, setPreview] = useState(null); // biên bản đang xem trước để in
  const [viewing, setViewing] = useState(null); // phiếu bàn giao đang xem lại
  const [keyword, setKeyword] = useState("");
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const reloadAll = () => {
    pending.reload();
    history.reload();
  };

  // Ô tra cứu: lọc theo số hợp đồng, khách hàng, địa điểm nhận máy, mã / tên máy, số phiếu
  const kw = normalizeText(keyword.trim());
  const match = (...parts) => !kw || normalizeText(parts.filter(Boolean).join(" ")).includes(kw);
  const pendingList = pending.data.filter((d) => match(d.contract_no, d.customer_name, d.delivery_address, d.code, d.name));
  const historyList = history.data.filter((h) =>
    match(h.handover_no, h.contract_no, h.customer_name, h.code, h.name, h.receiver_name),
  );
  // Phân trang bảng của tab đang mở; đổi tab / từ khoá thì về trang 1
  const pager = usePager(tab === "pending" ? pendingList : historyList, `${tab}|${keyword}`);

  // Số hợp đồng bấm được để mở xem chi tiết hợp đồng
  const contractLink = (id, no) => (
    <button className="link-cell" onClick={() => setOpenContract(id)} title="Xem hợp đồng">
      <strong>{no}</strong>
    </button>
  );

  // Lý do chưa bàn giao được (nếu có)
  const blockReason = (d) => {
    if (!d.deposit_paid_at) return "Khách chưa đặt cọc";
    if (d.start_date > todayISO()) return "Chưa đến ngày bắt đầu thuê";
    if (d.equipment_status === "RENTED") return "Máy chưa thu hồi từ hợp đồng trước";
    if (!["AVAILABLE", "RESERVED"].includes(d.equipment_status)) return "Máy đang ngừng hoạt động";
    return null;
  };

  const save = async (values) => {
    try {
      // Gửi dạng form có file vì kèm ảnh chụp đồng hồ giờ máy
      const fd = new FormData();
      Object.entries({ ...values, contract_detail_id: handing.contract_detail_id }).forEach(([k, v]) =>
        fd.append(k, v instanceof File ? v : String(v ?? "")),
      );
      const r = await api.upload("/handovers", fd);
      setHanding(null);
      setToast({ type: "success", message: r.message });
      reloadAll();
      return null;
    } catch (err) {
      return err.message;
    }
  };

  return (
    <div className="catalog">
      <div className="page-heading">
        <div>
          <h1>Bàn giao thiết bị</h1>
        </div>
      </div>

      {/* Tab trạng thái nằm ngoài khung danh sách, ngay dưới tiêu đề trang */}
      <div className="status-tabs">
        <button className={`status-tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
          Chờ bàn giao <span className="count">{pendingList.length}</span>
        </button>
        <button className={`status-tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
          Phiếu đã lập <span className="count">{historyList.length}</span>
        </button>
      </div>

      <section className="catalog-card">
        <div className="toolbar">
          <label className="search-box">
            <SearchIcon />
            <input
              type="search"
              placeholder="Tìm theo số hợp đồng, khách hàng, địa điểm nhận máy, mã / tên máy, số phiếu…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </label>
          <PageSizeSelect pager={pager} />
        </div>

        {tab === "pending" ? (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hợp đồng</th>
                  <th>Khách hàng</th>
                  <th>Máy</th>
                  <th>Đang ở</th>
                  <th>Ngày bắt đầu thuê</th>
                  <th>Tình trạng</th>
                  <th className="col-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pendingList.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-message">
                      {pending.loading ? "Đang tải dữ liệu…" : kw ? "Không tìm thấy kết quả phù hợp." : "Không có máy nào chờ bàn giao."}
                    </td>
                  </tr>
                ) : (
                  pager.pageRows.map((d) => {
                    const blocked = blockReason(d);
                    return (
                      <tr key={d.contract_detail_id}>
                        <td>{contractLink(d.contract_id, d.contract_no)}</td>
                        <td className="cell-wrap">
                          <span className="cell-main">{d.customer_name}</span>
                        </td>
                        <td>
                          <span className="cell-main">
                            {d.code} – {d.name}
                          </span>
                          <span className="cell-sub">Giờ máy: {formatNumber(d.operating_hours)}</span>
                        </td>
                        <td>{d.warehouse_name || <span className="text-muted">—</span>}</td>
                        <td>{formatDate(d.start_date)}</td>
                        <td>
                          <StatusBadge map={EQUIPMENT_STATUS} value={d.equipment_status} />
                          {blocked && <span className="warn-text">{blocked}</span>}
                        </td>
                        <td className="col-actions">
                          <RowMenu
                            items={[
                              {
                                key: "handover",
                                label: "Lập phiếu bàn giao",
                                disabled: Boolean(blocked),
                                title: blocked || "",
                                onClick: () => setHanding(d),
                              },
                              {
                                key: "view",
                                label: "Xem hợp đồng",
                                icon: <EyeIcon />,
                                onClick: () => setOpenContract(d.contract_id),
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
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Số phiếu</th>
                  <th>Hợp đồng / Khách hàng</th>
                  <th>Máy / Từ bãi</th>
                  <th className="align-right">Giờ máy</th>
                  <th>Người nhận</th>
                  <th className="col-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {historyList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="table-message">
                      {kw ? "Không tìm thấy kết quả phù hợp." : "Chưa có phiếu bàn giao nào."}
                    </td>
                  </tr>
                ) : (
                  pager.pageRows.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <button className="link-cell" onClick={() => setViewing(h)} title="Xem phiếu">
                          <strong>{h.handover_no}</strong>
                        </button>
                      </td>
                      <td className="cell-wrap cell-compact">
                        {contractLink(h.contract_id, h.contract_no)}
                        <span className="cell-sub">{h.customer_name}</span>
                      </td>
                      <td className="cell-wrap">
                        <span className="cell-main">
                          {h.code} – {h.name}
                        </span>
                        <span className="cell-sub">Từ bãi: {h.warehouse_name || "—"}</span>
                      </td>
                      <td className="align-right">
                        {formatNumber(h.operating_hours)}
                        <span className="cell-sub">{h.fuel_level !== null ? `Nhiên liệu ${h.fuel_level}%` : ""}</span>
                      </td>
                      <td>{h.receiver_name}</td>
                      <td className="col-actions">
                        <RowMenu
                          items={[
                            { key: "ticket", label: "Xem phiếu & ảnh đồng hồ", icon: <EyeIcon />, onClick: () => setViewing(h) },
                            { key: "print", label: "In biên bản", onClick: () => setPreview(() => () => ticketDoc(h.contract_id, "handover", h.handover_no)) },
                            { key: "view", label: "Xem hợp đồng", onClick: () => setOpenContract(h.contract_id) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        <PagerFooter pager={pager} />
      </section>

      {preview && <PrintPreview load={preview} onClose={() => setPreview(null)} />}
      {openContract && (
        <ContractDetailModal
          id={openContract}
          user={user}
          onClose={() => setOpenContract(null)}
          onChanged={(message) => {
            setToast({ type: "success", message });
            reloadAll();
          }}
          onEdit={() => {}}
        />
      )}

      {viewing && (
        <TicketDetailModal
          kind="handover"
          ticket={viewing}
          onClose={() => setViewing(null)}
          onOpenContract={(id) => {
            setViewing(null);
            setOpenContract(id);
          }}
        />
      )}

      {handing && (
        <FormModal
          title="Lập phiếu bàn giao"
          subtitle={`${handing.contract_no} · ${handing.code} – ${handing.name} → ${handing.delivery_address}`}
          fields={[
            { name: "handover_at", label: "Thời điểm bàn giao", type: "datetime-local", required: true },
            {
              name: "operating_hours",
              label: "Số giờ máy lúc giao",
              type: "number",
              required: true,
              hint: `Không nhỏ hơn số đang ghi nhận (${formatNumber(handing.operating_hours)}).`,
            },
            {
              name: "meter_photo",
              label: "Ảnh chụp đồng hồ giờ máy",
              type: "custom",
              required: true,
              full: true,
              hint: "Chụp rõ mặt đồng hồ, thấy được con số giờ máy; ảnh lưu kèm phiếu làm bằng chứng khi đối chiếu lúc thu hồi.",
              render: (p) => <MeterPhotoField {...p} />,
            },
            { name: "fuel_level", label: "Mức nhiên liệu (%)", type: "number", placeholder: "0 – 100" },
            { name: "accessories", label: "Phụ kiện kèm theo", maxLength: 500, placeholder: "VD: Gầu 0,8 m³; bộ dụng cụ" },
            { name: "receiver_name", label: "Người nhận máy", required: true, maxLength: 50 },
            { name: "receiver_phone", label: "SĐT người nhận", maxLength: 11 },
            { name: "condition_note", label: "Tình trạng máy khi giao", type: "textarea", full: true, placeholder: "VD: Hoạt động bình thường, xích còn 85%" },
          ]}
          initialValues={{
            handover_at: nowLocalISO(),
            operating_hours: String(handing.operating_hours),
            fuel_level: "",
            meter_photo: "",
            receiver_name: handing.representative || "",
            receiver_phone: handing.customer_phone || "",
          }}
          submitLabel="Xác nhận bàn giao"
          onSubmit={save}
          onClose={() => setHanding(null)}
        />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}

export default HandoverPage;
