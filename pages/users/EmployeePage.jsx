import CatalogPage from "../catalog/CatalogPage";
import { notifyUserChanged } from "../../utils/userEvents";
import useApiData from "../../hooks/useApiData";
import { formatDate } from "../../utils/format";
import { GENDER, toOptions } from "../../utils/labels";
import { todayStr } from "../../utils/dateLimits";

const STATUSES = [
  { value: "WORKING", label: "Đang làm việc" },
  { value: "RESIGNED", label: "Đã nghỉ việc" },
];

// Màn Quản lý nhân viên (chỉ Quản lý)
function EmployeePage() {
  const { data: lookups } = useApiData("/lookups", { departments: [], roles: [] });
  const departments = lookups.departments.map((d) => ({ value: String(d.id), label: d.name }));

  return (
    <CatalogPage
      afterSave={notifyUserChanged} // sửa họ tên của chính mình thì tên ở góc trên cập nhật theo
      title="Quản lý nhân viên"
      description="Hồ sơ nhân viên công ty. Nhân viên cần đăng nhập hệ thống thì cấp tài khoản ở mục Quản lý tài khoản."
      endpoint="/employees"
      itemName="nhân viên"
      searchPlaceholder="Tìm theo mã, họ tên, số điện thoại, email…"
      searchText={(e) => [e.code, e.full_name, e.phone, e.email, e.position, e.username].join(" ")}
      filters={[
        { key: "department_id", label: "Phòng ban", options: departments },
        { key: "status", label: "Trạng thái", options: STATUSES },
      ]}
      columns={[
        { key: "code", label: "Mã NV", render: (e) => <strong>{e.code}</strong> },
        {
          key: "full_name",
          label: "Họ tên",
          render: (e) => (
            <>
              <span className="cell-main">{e.full_name}</span>
              <span className="cell-sub">{e.position || "—"}</span>
            </>
          ),
        },
        { key: "department_name", label: "Phòng ban" },
        { key: "phone", label: "Điện thoại" },
        { key: "email", label: "Email" },
        {
          key: "hire_date",
          label: "Ngày vào làm",
          render: (e) => formatDate(e.hire_date) || <span className="text-muted">—</span>,
        },
        {
          key: "username",
          label: "Tài khoản",
          render: (e) => (e.username ? e.username : <span className="text-muted">Chưa có</span>),
        },
        {
          key: "status",
          label: "Trạng thái",
          render: (e) =>
            e.status === "WORKING" ? (
              <span className="badge badge-success">Đang làm việc</span>
            ) : (
              <span className="badge badge-neutral">Đã nghỉ việc</span>
            ),
        },
      ]}
      fields={[
        { name: "full_name", label: "Họ tên", required: true, maxLength: 100 },
        {
          name: "department_id",
          label: "Phòng ban",
          type: "select",
          required: true,
          options: departments,
          emptyOption: "— Chọn phòng ban —",
        },
        { name: "gender", label: "Giới tính", type: "select", options: toOptions(GENDER), emptyOption: "— Chọn —" },
        { name: "date_of_birth", label: "Ngày sinh", type: "date", max: todayStr(), maxLabel: "hôm nay" },
        { name: "id_number", label: "Số CCCD", maxLength: 12, placeholder: "12 chữ số" },
        { name: "phone", label: "Số điện thoại", maxLength: 11 },
        { name: "email", label: "Email", type: "email", maxLength: 100 },
        { name: "position", label: "Chức vụ", maxLength: 100, placeholder: "VD: Nhân viên kinh doanh" },
        { name: "address", label: "Địa chỉ", full: true, maxLength: 255 },
        { name: "hire_date", label: "Ngày vào làm", type: "date" },
        {
          name: "status",
          label: "Trạng thái",
          type: "select",
          options: STATUSES,
          hint: "Chuyển sang Đã nghỉ việc thì tài khoản (nếu có) bị khoá luôn.",
        },
      ]}
      emptyForm={{ status: "WORKING" }}
      rowLabel={(e) => `${e.code} – ${e.full_name}`}
      deleteBlocked={(e) => (e.username ? "Nhân viên đã có tài khoản, không thể xoá" : null)}
      createSubtitle="Mã nhân viên được tạo tự động (NV0001, NV0002…)."
      editSubtitle={(e) => `Mã nhân viên: ${e.code}`}
    />
  );
}

export default EmployeePage;
