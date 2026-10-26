import { useState } from "react";
import "./MainLayout.css";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";
import HomePage from "../pages/HomePage";
import ComingSoonPage from "../pages/ComingSoonPage";
import NoPermissionPage from "../pages/NoPermissionPage";
import CustomerPage from "../pages/catalog/CustomerPage";
import WarehousePage from "../pages/catalog/WarehousePage";
import CategoryPage from "../pages/catalog/CategoryPage";
import BrandPage from "../pages/catalog/BrandPage";
import EmployeePage from "../pages/users/EmployeePage";
import AccountPage from "../pages/users/AccountPage";
import EquipmentPage from "../pages/equipment/EquipmentPage";
import PricePage from "../pages/equipment/PricePage";
import AvailabilityPage from "../pages/equipment/AvailabilityPage";
import ContractPage from "../pages/rent/ContractPage";
import ApprovePage from "../pages/rent/ApprovePage";
import HandoverPage from "../pages/rent/HandoverPage";
import ReturnPage from "../pages/rent/ReturnPage";
import EquipmentStatusReport from "../pages/reports/EquipmentStatusReport";
import RevenueReport from "../pages/reports/RevenueReport";
import UtilizationReport from "../pages/reports/UtilizationReport";
import ContractReport from "../pages/reports/ContractReport";
import DebtReport from "../pages/reports/DebtReport";
import { canOpen } from "../data/menu";

// Khai báo trang nào ứng với mục menu nào.
// Làm xong màn nào thì import vào và thêm một dòng ở đây.
const PAGES = {
  home: HomePage,
  "category-customer": CustomerPage,
  "category-warehouse": WarehousePage,
  "category-type": CategoryPage,
  "category-brand": BrandPage,
  "user-account": AccountPage,
  "user-employee": EmployeePage,
  "equipment-profile": EquipmentPage,
  "equipment-price": PricePage,
  "equipment-schedule": AvailabilityPage,
  "rent-contract": ContractPage,
  "rent-approve": ApprovePage,
  "rent-handover": HandoverPage,
  "rent-return": ReturnPage,
  "report-equipment": EquipmentStatusReport,
  "report-revenue": RevenueReport,
  "report-utilization": UtilizationReport,
  "report-contract": ContractReport,
  "report-debt": DebtReport,
};

// Khung chính sau khi đăng nhập: menu trái + thanh đầu trang + nội dung + bản quyền
function MainLayout({
  user,
  onLogout,
  onChangePassword,
  onUserChange,
  notifications,
  onReadNotification,
  onReadAllNotifications,
}) {
  const [activeMenu, setActiveMenu] = useState("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Mở trang không có quyền (VD: bấm thông báo dẫn tới trang của Quản lý) thì báo không có quyền
  const Page = !canOpen(activeMenu, user.role) ? NoPermissionPage : PAGES[activeMenu] || ComingSoonPage;

  return (
    <div className={`dashboard ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        activeMenu={activeMenu}
        onSelect={setActiveMenu}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        role={user.role}
      />

      <main className="dashboard-main">
        <Header
          user={user}
          onLogout={onLogout}
          onChangePassword={onChangePassword}
          onUserChange={onUserChange}
          onNavigate={setActiveMenu}
          notifications={notifications}
          onReadNotification={onReadNotification}
          onReadAllNotifications={onReadAllNotifications}
        />

        <section className="dashboard-content">
          {/* key: đổi trang thì vẽ lại từ đầu, không giữ trạng thái của trang trước */}
          <Page key={activeMenu} activeMenu={activeMenu} onNavigate={setActiveMenu} user={user} />
        </section>

        <Footer />
      </main>
    </div>
  );
}

export default MainLayout;
