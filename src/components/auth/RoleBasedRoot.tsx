import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ZapeeraDashboard from '@/components/dashboard/ZapeeraDashboard';
import RoleBasedDashboard from '@/components/dashboard/RoleBasedDashboard';

const RoleBasedRoot = () => {
  const { user } = useAuth();
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);

  // Check if admin has already seen the welcome dashboard
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      const seenWelcome = localStorage.getItem(`admin_welcome_seen_${user.id}`);
      setHasSeenWelcome(seenWelcome === 'true');
    } else {
      setHasSeenWelcome(true); // For non-admins, consider as seen
    }
  }, [user]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // SUPERADMIN should see the SuperAdmin dashboard
  if (user.role === 'SUPERADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  // ADMIN logic: Show Zapeera dashboard only on first visit
  if (user.role === 'ADMIN') {
    if (hasSeenWelcome === null) {
      // Still loading
      return <div>Loading...</div>;
    }

    if (!hasSeenWelcome) {
      // First time - show Zapeera dashboard and mark as seen
      localStorage.setItem(`admin_welcome_seen_${user.id}`, 'true');
      return <ZapeeraDashboard />;
    } else {
      // Already seen - redirect to admin dashboard
      return <Navigate to="/dashboard" replace />;
    }
  }

  // All other roles (MANAGER, CASHIER, etc.) should see their role-based dashboard
  return <RoleBasedDashboard />;
};

export default RoleBasedRoot;
