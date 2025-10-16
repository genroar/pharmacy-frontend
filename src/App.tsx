import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminProvider } from "./contexts/AdminContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LoginForm from "./components/auth/LoginForm";
import AdminSignupForm from "./components/auth/AdminSignupForm";
import AuthContainer from "./components/auth/AuthContainer";
import MainLayout from "./components/layout/MainLayout";
import Index from "./pages/Index";
import POS from "./pages/POS";
import Login from "./pages/Login";
import InventoryPage from "./pages/Inventory";
import CustomersPage from "./pages/Customers";
import ReportsPage from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./components/dashboard/AdminDashboard";
import UserManagement from "./components/admin/UserManagement";
import ManagerUserManagement from "./components/manager/ManagerUserManagement";
import EmployeeManagement from "./components/admin/EmployeeManagement";
import BranchManagement from "./components/admin/BranchManagement";
import CompanyManagement from "./components/admin/CompanyManagement";
import Dashboard from "./components/dashboard/Dashboard";
import AdminReports from "./components/admin/AdminReports";
import RoleManagement from "./components/admin/RoleManagement";
import SuperAdmin from "./pages/SuperAdmin";
import RoleBasedDashboard from "./components/dashboard/RoleBasedDashboard";
import { RoleBasedSidebar } from "./components/layout/RoleBasedSidebar";
import Refunds from "./components/pos/Refunds";
import Invoices from "./components/pos/Invoices";
import EmployeeCheckIn from "./components/pos/EmployeeCheckIn";
import ShiftManagement from "./components/pos/ShiftManagement";
import PerformanceTracking from "./components/pos/PerformanceTracking";
import InventoryTransfers from "./components/inventory/InventoryTransfers";
import CommissionTracking from "./components/pos/CommissionTracking";
import AdminPayments from "./components/superadmin/AdminPayments";
import AdminManagement from "./components/superadmin/AdminManagement";
import SubscriptionManagement from "./components/admin/SubscriptionManagement";
import AdminShiftManagement from "./components/admin/ShiftManagement";
import OrderPurchase from "./components/admin/OrderPurchase";
import BusinessTypeGuard from "./components/auth/BusinessTypeGuard";
import ZapeeraDashboard from "./components/dashboard/ZapeeraDashboard";
import ZapeeraLayout from "./components/layout/ZapeeraLayout";
import { useRealtimeNotifications } from "./hooks/useRealtimeNotifications";
import AuthStatus from "./components/auth/AuthStatus";

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Role-based Protected Route Component
const RoleProtectedRoute = ({
  children,
  allowedRoles
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) => {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user?.role || '')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Your role: {user?.role} | Required roles: {allowedRoles.join(', ')}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Main App Routes Component
const AppRoutes = () => {
  const { isAuthenticated, login } = useAuth();

  // Initialize real-time notifications
  useRealtimeNotifications();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<AuthContainer />} />
        <Route path="/signup" element={<AuthContainer />} />

        {/* Protected Routes */}
        <Route path="/" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <ZapeeraDashboard />
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/dashboard" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleBasedDashboard />
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/pos" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <POS />
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/customers" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <MainLayout>
                <CustomersPage />
              </MainLayout>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/invoices" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN', 'MANAGER', 'CASHIER', 'PHARMACIST']}>
                <MainLayout>
                  <Invoices />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/refunds" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN', 'MANAGER', 'CASHIER', 'PHARMACIST']}>
                <MainLayout>
                  <Refunds />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/checkin" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <MainLayout>
                <EmployeeCheckIn />
              </MainLayout>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/shifts" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <MainLayout>
                <ShiftManagement />
              </MainLayout>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/performance" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <MainLayout>
                <PerformanceTracking />
              </MainLayout>
            </BusinessTypeGuard>
          </AuthStatus>
        } />

        {/* Manager & Admin Routes */}
        <Route path="/inventory-transfers" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['MANAGER', 'SUPERADMIN']}>
                <MainLayout>
                  <InventoryTransfers />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/commission" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['MANAGER', 'SUPERADMIN']}>
                <MainLayout>
                  <CommissionTracking />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/inventory" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN', 'MANAGER', 'CASHIER', 'PHARMACIST']}>
                <MainLayout>
                  <InventoryPage />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/order-purchase" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN', 'MANAGER', 'CASHIER']}>
                <MainLayout>
                  <OrderPurchase />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/reports" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['MANAGER', 'ADMIN', 'SUPERADMIN']}>
                <MainLayout>
                  <ReportsPage />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />

        {/* All Users - Settings */}
        <Route path="/settings" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <ZapeeraLayout>
                <SettingsPage />
              </ZapeeraLayout>
            </BusinessTypeGuard>
          </AuthStatus>
        } />

        {/* Admin Only Routes */}
        <Route path="/admin" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN']}>
                <MainLayout>
                  <AdminDashboard />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/admin/users" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN', 'PRODUCT_OWNER']}>
                <MainLayout>
                  <UserManagement />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/manager/users" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['MANAGER']}>
                <MainLayout>
                  <ManagerUserManagement />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/admin/employees" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN', 'MANAGER']}>
                <MainLayout>
                  <EmployeeManagement />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/admin/roles" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'PRODUCT_OWNER']}>
                <MainLayout>
                  <RoleManagement />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/admin/reports" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN']}>
                <MainLayout>
                  <AdminReports />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/admin/companies" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN']}>
                <ZapeeraLayout>
                  <CompanyManagement />
                </ZapeeraLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/admin/branches" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'ADMIN']}>
                <ZapeeraLayout>
                  <BranchManagement />
                </ZapeeraLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/admin/subscription" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['ADMIN']}>
                <MainLayout>
                  <SubscriptionManagement />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/admin/shifts" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'CASHIER']}>
                <MainLayout>
                  <AdminShiftManagement />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />

        {/* SuperAdmin Routes */}
        <Route path="/superadmin" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN', 'PRODUCT_OWNER']}>
                <SuperAdmin />
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/superadmin/payments" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN']}>
                <MainLayout>
                  <AdminPayments />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />
        <Route path="/superadmin/admins" element={
          <AuthStatus>
            <BusinessTypeGuard>
              <RoleProtectedRoute allowedRoles={['SUPERADMIN']}>
                <MainLayout>
                  <AdminManagement />
                </MainLayout>
              </RoleProtectedRoute>
            </BusinessTypeGuard>
          </AuthStatus>
        } />

        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AppRoutes />
        </TooltipProvider>
      </AdminProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;