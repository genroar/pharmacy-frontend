import { useAuth } from "@/contexts/AuthContext";
import MainLayout from "../layout/MainLayout";
import Dashboard from "./Dashboard";
import AdminDashboard from "./AdminDashboard";
import ManagerDashboard from "./ManagerDashboard";
import SuperAdminDashboard from "../superadmin/SuperAdminDashboard";

const RoleBasedDashboard = () => {
  const { user } = useAuth();

  console.log('🔍 RoleBasedDashboard: user:', user);

  if (!user) {
    console.log('🔍 RoleBasedDashboard: No user, showing loading...');
    return <div>Loading...</div>;
  }

  console.log('🔍 RoleBasedDashboard: User role:', user.role);

  // Route based on user role
  switch (user.role) {
    case 'SUPERADMIN':
      // SUPERADMIN gets its own full-screen layout
      return <SuperAdminDashboard />;
    case 'ADMIN':
      // ADMIN gets MainLayout with AdminDashboard
      return (
        <MainLayout>
          <AdminDashboard />
        </MainLayout>
      );
    case 'MANAGER':
      // MANAGER gets MainLayout with ManagerDashboard
      return (
        <MainLayout>
          <ManagerDashboard />
        </MainLayout>
      );
    case 'CASHIER':
      // Cashiers get MainLayout with regular Dashboard
      return (
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );
    default:
      // Other roles get MainLayout with regular Dashboard
      return (
        <MainLayout>
          <Dashboard />
        </MainLayout>
      );
  }
};

export default RoleBasedDashboard;
