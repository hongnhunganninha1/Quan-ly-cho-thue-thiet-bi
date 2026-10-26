import { useState } from "react";
import CatalogPage from "./CatalogPage";
import CustomerRentalModal from "./CustomerRentalModal";
import { CUSTOMER_EMPTY, CUSTOMER_FIELDS, CUSTOMER_TYPES as TYPES } from "./customerFields";
import { HistoryIcon } from "../../components/common/Icons";
import StatusBadge from "../../components/common/StatusBadge";
import { api } from "../../api/client";
import { CUSTOMER_STATUS, toOptions } from "../../utils/labels";

// Màn Quản lý khách hàng.
// Nhân viên: thêm, cập nhật, tra cứu. Quản lý: thêm quyền ngừng / mở lại giao dịch và xoá khách nhập nhầm.
function CustomerPage({ user }) {
  const isAdmin = user?.role === "ADMIN";
  const [historyOf, setHistoryOf] = useState(null); // khách hàng đang xem lịch sử thuê
  return (
    <>
      <CatalogPage
        hideDelete={!isAdmin}
        rowActions={(c) => [
          { key: "rentals", label: "Lịch sử thuê", icon: <HistoryIcon />, onClick: () => setHistoryOf(c) },
          ...(!isAdmin
            ? []
            : c.status === "STOPPED"
              ? [
                  {
                    key: "activate",
                    label: "Mở lại giao dịch",
                    title: "Mở lại giao dịch với khách hàng",
                    confirm: {
                      title: "Mở lại giao dịch",
                      message: `Cho phép lập hợp đồng mới với ${c.name}?`,
                      confirmLabel: "Mở lại",
                    },
                    run: () => api.patch(`/customers/${c.id}/status`, { status: "ACTIVE" }),
                  },
                ]
              : [
                  {
                    key: "stop",
                    label: "Ngừng giao dịch",
                    title: "Ngừng giao dịch với khách hàng",
                    danger: true,
                    confirm: {
                      title: "Ngừng giao dịch",
                      message: `Ngừng giao dịch với ${c.name}? Khách vẫn giữ lịch sử thuê nhưng không lập được hợp đồng mới.`,
                      confirmLabel: "Ngừng giao dịch",
                      tone: "danger",
                    },
                    run: () => api.patch(`/customers/${c.id}/status`, { status: "STOPPED" }),
                  },
                ]),
        ]}
        title="Quản lý khách hàng"
        description="Danh sách doanh nghiệp và cá nhân thuê thiết bị của công ty."
        endpoint="/customers"
        itemName="khách hàng"
        searchPlaceholder="Tìm theo mã, tên, MST / CCCD, số điện thoại, email…"
        searchText={(c) => [c.code, c.name, c.tax_code, c.id_number, c.phone, c.email, c.representative].join(" ")}
        filters={[
          { key: "customer_type", label: "Loại khách hàng", options: TYPES },
          { key: "status", label: "Trạng thái", options: toOptions(CUSTOMER_STATUS) },
        ]}
        columns={[
          { key: "code", label: "Mã KH", render: (c) => <strong>{c.code}</strong> },
          {
            key: "name",
            label: "Khách hàng",
            wrap: true,
            render: (c) => (
              <>
                <span className="cell-main">{c.name}</span>
                <span className="cell-sub">
                  {c.customer_type === "COMPANY"
                    ? c.representative
                      ? `Đại diện: ${c.representative}${c.representative_title ? ` (${c.representative_title})` : ""}`
                      : "Doanh nghiệp"
                    : "Cá nhân"}
                </span>
              </>
            ),
          },
          {
            key: "identity",
            label: "MST / CCCD",
            render: (c) => (
              <>
                <span className="cell-main">{c.tax_code || c.id_number}</span>
                <span className="cell-sub">{c.tax_code ? "Mã số thuế" : "CCCD"}</span>
              </>
            ),
          },
          {
            key: "phone",
            label: "Liên hệ",
            render: (c) => (
              <>
                <span className="cell-main">{c.phone}</span>
                <span className="cell-sub">{c.email || "—"}</span>
              </>
            ),
          },
          { key: "address", label: "Địa chỉ", wrap: true },
          { key: "status", label: "Trạng thái", render: (c) => <StatusBadge map={CUSTOMER_STATUS} value={c.status} /> },
          {
            key: "contract_count",
            label: "Hợp đồng",
            align: "right",
            render: (c) => (c.contract_count > 0 ? c.contract_count : <span className="text-muted">0</span>),
          },
        ]}
        fields={CUSTOMER_FIELDS}
        emptyForm={CUSTOMER_EMPTY}
        rowLabel={(c) => `${c.code} – ${c.name}`}
        deleteBlocked={(c) => (c.contract_count > 0 ? "Khách hàng đã có hợp đồng, không thể xoá" : null)}
        createSubtitle="Mã khách hàng được tạo tự động (KH0001, KH0002…)."
        editSubtitle={(c) => `Mã khách hàng: ${c.code}`}
      />
      {historyOf && <CustomerRentalModal customer={historyOf} user={user} onClose={() => setHistoryOf(null)} />}
    </>
  );
}

export default CustomerPage;
