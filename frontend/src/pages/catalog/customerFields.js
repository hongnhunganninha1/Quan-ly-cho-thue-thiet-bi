import { createElement } from "react";

// Cấu hình form khách hàng, dùng chung cho màn Quản lý khách hàng và nút "Thêm khách hàng mới" khi lập hợp đồng.
// Không có ô chọn loại khách hàng: loại tự suy ra từ MST / CCCD (backend cũng suy ra như vậy khi lưu).
// 12 chữ số → CCCD → cá nhân; còn lại (10 số hoặc 10 số-3 số) → mã số thuế → doanh nghiệp.
export const isIndividualId = (idNumber) => /^\d{12}$/.test(String(idNumber || "").trim());
const isIndividual = (form) => isIndividualId(form.id_number);
const isCompany = (form) => !isIndividual(form);

export const CUSTOMER_EMPTY = {};

export const CUSTOMER_FIELDS = [
  { name: "name", label: "Tên khách hàng", required: true, full: true, maxLength: 200, placeholder: "Tên công ty hoặc họ tên khách hàng cá nhân" },
  {
    name: "id_number",
    label: "Mã số thuế / Số CCCD",
    required: true,
    maxLength: 14,
    placeholder: "MST 10 số (10 số-3 số) hoặc CCCD 12 số",
    hint: (f) => (isIndividual(f) ? "Số CCCD → khách hàng cá nhân." : /^\d{10}(-\d{3})?$/.test(String(f.id_number || "").trim()) ? "Mã số thuế → khách hàng doanh nghiệp." : ""),
  },
  { name: "email", label: "Email", type: "email", maxLength: 100, placeholder: "VD: lienhe@congty.vn" },
  // Doanh nghiệp: tự nhập người đại diện; cá nhân: người đại diện chính là khách hàng (tự điền theo tên, không sửa)
  { name: "representative", label: "Người đại diện", required: true, show: isCompany, maxLength: 50, span: 2 },
  { name: "representative_title", label: "Chức vụ người đại diện", show: isCompany, maxLength: 50, span: 2 },
  {
    name: "representative",
    label: "Người đại diện",
    type: "custom",
    show: isIndividual,
    span: 3,
    hint: "Khách hàng cá nhân: người đại diện trùng với tên khách hàng.",
    render: ({ id, form }) => createElement("input", { id, value: form.name || "", placeholder: "Tự lấy theo tên khách hàng", disabled: true }),
  },
  // SĐT đặt cạnh người đại diện (doanh nghiệp: 3 ô / hàng; cá nhân: 2 ô / hàng)
  { name: "phone", label: "Số điện thoại", required: true, placeholder: "VD: 0912345678", maxLength: 11, span: (f) => (isCompany(f) ? 2 : 3) },
  { name: "address", label: "Địa chỉ", full: true, maxLength: 255 },
  { name: "bank_account", label: "Số tài khoản ngân hàng", maxLength: 20 },
  { name: "bank_name", label: "Ngân hàng", maxLength: 100 },
  { name: "note", label: "Ghi chú", type: "textarea", full: true },
];
