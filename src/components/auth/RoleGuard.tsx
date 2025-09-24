import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface RoleGuardProps {
  children: React.ReactNode;
  roles?: string[];
  resource?: string;
  action?: string;
  fallback?: React.ReactNode;
  requireAll?: boolean; // If true, user must have ALL roles, otherwise ANY role
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  roles = [],
  resource,
  action,
  fallback = null,
  requireAll = false
}) => {
  const { user, hasRole, hasPermission, canAccess } = useAuth();

  if (!user) {
    return <>{fallback}</>;
  }

  // Check role-based access
  if (roles.length > 0) {
    const hasRequiredRole = requireAll
      ? roles.every(role => hasRole([role]))
      : hasRole(roles);

    // Debug logging for SUPERADMIN tabs
    if (roles.includes('SUPERADMIN')) {
      console.log('🔍 RoleGuard Debug - Roles:', roles, 'User role:', user.role, 'Has required role:', hasRequiredRole);
    }

    if (!hasRequiredRole) {
      return <>{fallback}</>;
    }
  }

  // Check resource-based access
  if (resource) {
    const canAccessResource = canAccess(resource);

    // Debug logging for SUPERADMIN resources
    if (resource === 'admin_payments' || resource === 'admin_management') {
      console.log('🔍 RoleGuard Resource Debug - Resource:', resource, 'Can access:', canAccessResource, 'User role:', user.role);
    }

    // Debug logging for Refunds and Sales resources
    if (resource === 'refunds' || resource === 'sales') {
      console.log(`🔍 ${resource.toUpperCase()} RoleGuard Debug - Resource:`, resource, 'Action:', action, 'Can access:', canAccessResource, 'User role:', user.role);
    }

    if (!canAccessResource) {
      return <>{fallback}</>;
    }

    // Check specific action permission
    if (action && !hasPermission(resource, action)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

// Convenience components for common use cases
export const AdminOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => (
  <RoleGuard roles={['SUPERADMIN', 'ADMIN', 'PRODUCT_OWNER']} fallback={fallback}>
    {children}
  </RoleGuard>
);

export const ManagerOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => (
  <RoleGuard roles={['MANAGER', 'ADMIN', 'SUPERADMIN', 'PRODUCT_OWNER']} fallback={fallback}>
    {children}
  </RoleGuard>
);

export const PharmacistOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => (
  <RoleGuard roles={['PHARMACIST', 'MANAGER', 'ADMIN', 'SUPERADMIN', 'PRODUCT_OWNER']} fallback={fallback}>
    {children}
  </RoleGuard>
);

export const CashierOnly: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => (
  <RoleGuard roles={['CASHIER', 'PHARMACIST', 'MANAGER', 'ADMIN', 'SUPERADMIN', 'PRODUCT_OWNER']} fallback={fallback}>
    {children}
  </RoleGuard>
);

// Resource-based guards
export const CanManageUsers: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => (
  <RoleGuard resource="users" action="manage" fallback={fallback}>
    {children}
  </RoleGuard>
);

export const CanManageProducts: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => (
  <RoleGuard resource="products" action="manage" fallback={fallback}>
    {children}
  </RoleGuard>
);

export const CanViewReports: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => (
  <RoleGuard resource="reports" action="read" fallback={fallback}>
    {children}
  </RoleGuard>
);

export const CanManageSettings: React.FC<{ children: React.ReactNode; fallback?: React.ReactNode }> = ({
  children,
  fallback = null
}) => (
  <RoleGuard resource="settings" action="manage" fallback={fallback}>
    {children}
  </RoleGuard>
);

// Hook for programmatic permission checking
export const usePermissions = () => {
  const { hasPermission, hasRole, canAccess, user } = useAuth();

  return {
    hasPermission,
    hasRole,
    canAccess,
    user,
    isAdmin: hasRole(['SUPERADMIN', 'ADMIN', 'PRODUCT_OWNER']),
    isManager: hasRole(['MANAGER', 'ADMIN', 'SUPERADMIN', 'PRODUCT_OWNER']),
    isPharmacist: hasRole(['PHARMACIST', 'MANAGER', 'ADMIN', 'SUPERADMIN', 'PRODUCT_OWNER']),
    isCashier: hasRole(['CASHIER', 'PHARMACIST', 'MANAGER', 'ADMIN', 'SUPERADMIN', 'PRODUCT_OWNER'])
  };
};
