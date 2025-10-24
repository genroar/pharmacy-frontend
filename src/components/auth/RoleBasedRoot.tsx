import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Navigate, useLocation } from 'react-router-dom';
import ZapeeraDashboard from '@/components/dashboard/ZapeeraDashboard';
import RoleBasedDashboard from '@/components/dashboard/RoleBasedDashboard';

const RoleBasedRoot = () => {
  const { user } = useAuth();
  const { selectedCompanyId, isLoading } = useAdmin();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // SUPERADMIN should see the SuperAdmin dashboard
  if (user.role === 'SUPERADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  // ADMIN logic: Show Zapeera dashboard only when needed
  if (user.role === 'ADMIN') {
    if (isLoading) {
      // Still loading
      return <div>Loading...</div>;
    }

    // Show Zapeera dashboard only if:
    // 1. No company is selected, OR
    // 2. User is explicitly navigating to /zapeera route
    if (!selectedCompanyId || location.pathname === '/zapeera') {
      return <ZapeeraDashboard />;
    } else {
      // Company is selected and not on zapeera route - show normal dashboard
      return <RoleBasedDashboard />;
    }
  }

  // All other roles (MANAGER, CASHIER, etc.) should see their role-based dashboard
  return <RoleBasedDashboard />;
};

export default RoleBasedRoot;
