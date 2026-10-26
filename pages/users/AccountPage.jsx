import { useState } from "react";
import CatalogPage from "../catalog/CatalogPage";
import { notifyUserChanged } from "../../utils/userEvents";
import useApiData from "../../hooks/useApiData";
import { api } from "../../api/client";
import { formatDateTime } from "../../utils/format";

// Màn Quản lý tài khoản (chỉ Quản lý): cấp tài khoản, đổi vai trò, khoá / mở khoá, cấp lại mật khẩu
function AccountPage() {
  const [refresh, setRefresh] = useState(0);
  const { data: lookups } = useApiData("/lookups", { departments: [], roles: [] });
  // Nhân viên chưa có tài khoản: tải lại mỗi khi danh sách tài khoản thay đổi
  const { data: freeEmployees, reload: reloadFree } = useApiData("/users/available-employees", []);
  const roles = lookups.roles.map((r) => ({ value: String(r.id), label: r.name }));

  const isLockedNow = (u) => u.status === "LOCKED" || (u.locked_until && new Date(u.locked_until.replace(" ", "T")) > new Date());

  return (
    <CatalogPage
      afterSave={notifyUserChanged}
      title="Quản lý tài khoản"
      description="Tài khoản đăng nhập của nhân viên. Mỗi nhân viên có tối đa một tài khoản."
      endpoint="/users"
      itemName="tài khoản"
      addLabel="Cấp tài khoản"
      refreshSignal={refresh}
      searchPlaceholder="Tìm theo tên đăng nhập, họ tên, phòng ban…"
      searchText={(u) => [u.username, u.full_name, u.employee_code, u.department_name].join(" ")}
      filters={[
        { key: "role_id", label: "Vai trò", options: roles },
        { key: "status", label: "Trạng thái", options: [{ value: "ACTIVE", label: "Hoạt động" }, { value: "LOCKED", label: "Bị khoá" }] },
      ]}
      columns={[
        {
          key: "username",
          label: "Tên đăng nhập",
          render: (u) => (
            <>
              <strong>{u.username}</strong>
              {u.is_me && <span className="cell-sub">(bạn)</span>}
            </>
          ),
        },
        {
          key: "full_name",
          label: "Nhân viên",
          render: (u) => (
            <>
              <span className="cell-main">{u.full_name}</span>
              <span className="cell-sub">
                {u.employee_code} · {u.department_name}
              </span>
            </>
          ),
        },
        {
          key: "role_name",
          label: "Vai trò",
          render: (u) => <span className={`badge ${u.role_code === "ADMIN" ? "badge-info" : "badge-neutral"}`}>{u.role_name}</span>,
        },
        {
          key: "last_login_at",
          label: "Đăng nhập gần nhất",
          render: (u) => formatDateTime(u.last_login_at) || <span className="text-muted">Chưa đăng nhập</span>,
        },
        {
          key: "status",
          label: "Trạng thái",
          render: (u) =>
            u.status === "LOCKED" ? (
              <span className="badge badge-danger">Bị khoá</span>
            ) : isLockedNow(u) ? (
              <span className="badge badge-warning">Tạm khoá (sai mật khẩu)</span>
            ) : u.must_change_password ? (
              <span className="badge badge-warning">Chờ đổi mật khẩu</span>
            ) : (
              <span className="badge badge-success">Hoạt động</span>
            ),
        },
      ]}
      fieldsFor={(row) =>
        row
          ? [{ name: "role_id", label: "Vai trò", type: "select", required: true, options: roles, full: true }]
          : [
              {
                name: "employee_id",
                label: "Nhân viên",
                type: "select",
                required: true,
                full: true,
                emptyOption: freeEmployees.length ? "— Chọn nhân viên chưa có tài khoản —" : "Tất cả nhân viên đang làm việc đã có tài khoản",
                options: freeEmployees.map((e) => ({ value: String(e.id), label: `${e.code} – ${e.full_name} (${e.department_name})` })),
              },
              {
                name: "username",
                label: "Tên đăng nhập",
                required: true,
                maxLength: 50,
                placeholder: "VD: mai.nt",
                hint: "Chữ thường không dấu, chữ số, dấu chấm.",
              },
              { name: "role_id", label: "Vai trò", type: "select", required: true, options: roles },
            ]
      }
      emptyForm={{ role_id: "2" }}
      createSubtitle="Hệ thống tạo mật khẩu tạm; nhân viên phải đổi mật khẩu ở lần đăng nhập đầu."
      editSubtitle={(u) => `${u.username} – ${u.full_name}`}
      canEdit={(u) => !u.is_me}
      hideDelete
      rowLabel={(u) => u.username}
      rowActions={(u) => {
        if (u.is_me) return [];
        const actions = [
          {
            key: "reset",
            label: "Cấp lại mật khẩu",
            title: "Cấp lại mật khẩu tạm",
            confirm: {
              title: "Cấp lại mật khẩu",
              message: `Tạo mật khẩu tạm mới cho ${u.username}? Mật khẩu cũ sẽ không dùng được nữa.`,
              confirmLabel: "Cấp lại",
              tone: "primary",
            },
            run: () => api.post(`/users/${u.id}/reset-password`),
          },
        ];
        if (isLockedNow(u)) {
          actions.push({
            key: "unlock",
            label: "Mở khoá tài khoản",
            disabled: u.employee_status !== "WORKING",
            title: u.employee_status !== "WORKING" ? "Nhân viên đã nghỉ việc" : "Mở khoá tài khoản",
            run: async () => {
              const r = await api.patch(`/users/${u.id}/unlock`);
              setRefresh((x) => x + 1);
              return r;
            },
          });
        } else {
          actions.push({
            key: "lock",
            label: "Khoá tài khoản",
            danger: true,
            confirm: {
              title: "Khoá tài khoản",
              message: `Khoá tài khoản ${u.username} (${u.full_name})? Người này sẽ không đăng nhập được nữa.`,
              confirmLabel: "Khoá",
            },
            run: () => api.patch(`/users/${u.id}/lock`),
          });
        }
        return actions;
      }}
      // Mở form thì tải lại danh sách "nhân viên chưa có tài khoản" (có thể vừa thay đổi)
      onOpenForm={reloadFree}
    />
  );
}

export default AccountPage;
