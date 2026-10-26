// Cấu hình form khách hàng, dùng chung cho màn Quản lý khách hàng và nút "Thêm khách hàng mới" khi lập hợp đồng.
export const CUSTOMER_TYPES = [
  { value: "COMPANY", label: "Doanh nghiệp" },
  { value: "INDIVIDUAL", label: "Cá nhân" },
];

const isCompany = (form) => form.customer_type === "COMPANY";

export const CUSTOMER_EMPTY = { customer_type: "COMPANY" };

export const CUSTOMER_FIELDS = [
  { name: "customer_type", label: "Loại khách hàng", type: "select", options: CUSTOMER_TYPES, required: true },
  { name: "phone", label: "Số điện thoại", required: true, placeholder: "VD: 0912345678", maxLength: 11 },
  {
    name: "name",
    label: "Tên khách hàng",
    required: true,
    full: true,
    maxLength: 200,
    placeholder: "Tên công ty hoặc họ tên cá nhân",
  },
  {
    name: "tax_code",
    label: "Mã số thuế",
    required: true,
    show: isCompany,
    placeholder: "10 chữ số",
    maxLength: 14,
  },
  {
    name: "id_number",
    label: "Số CCCD",
    required: true,
    show: (f) => !isCompany(f),
    placeholder: "12 chữ số",
    maxLength: 12,
  },
  { name: "email", label: "Email", type: "email", maxLength: 100, placeholder: "VD: lienhe@congty.vn" },
  { name: "representative", label: "Người đại diện", show: isCompany, maxLength: 100 },
  { name: "representative_title", label: "Chức vụ người đại diện", show: isCompany, maxLength: 100 },
  { name: "address", label: "Địa chỉ", full: true, maxLength: 255 },
  { name: "bank_account", label: "Số tài khoản ngân hàng", maxLength: 50 },
  { name: "bank_name", label: "Ngân hàng", maxLength: 100 },
  { name: "note", label: "Ghi chú", type: "textarea", full: true },
];
