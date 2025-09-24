import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';

interface User {
  id: string;
  name: string;
  role: 'PRODUCT_OWNER' | 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'PHARMACIST' | 'CASHIER';
  branchId?: string;
  adminId?: string;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasPermission: (resource: string, action: string) => boolean;
  hasRole: (roles: string[]) => boolean;
  canAccess: (resource: string) => boolean;
  checkAuthStatus: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Render counter for debugging
  const renderCount = useRef(0);
  renderCount.current++;
  console.log(`AuthProvider render #${renderCount.current}`);

  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('medibill_user');
    const savedToken = localStorage.getItem('token');
    // Debug: Loading user from localStorage

    if (savedUser && savedToken) {
      try {
        const userData = JSON.parse(savedUser);
        // Debug: Parsed user data
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        localStorage.removeItem('medibill_user');
        localStorage.removeItem('token');
      }
    } else {
      // Clear any stale data if token is missing
      localStorage.removeItem('medibill_user');
      localStorage.removeItem('token');
    }
  }, []);

  // Listen for authentication required events
  useEffect(() => {
    const handleAuthRequired = (event: CustomEvent) => {
      // Debug: Authentication required
      logout();
    };

    window.addEventListener('authRequired', handleAuthRequired as EventListener);
    return () => {
      window.removeEventListener('authRequired', handleAuthRequired as EventListener);
    };
  }, []);

  const login = useCallback((userData: User) => {
    console.log('🔍 AuthContext: Login function called with userData:', userData);
    // Debug: Login called
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('medibill_user', JSON.stringify(userData));
    console.log('✅ AuthContext: User state updated and saved to localStorage');
    // Debug: User saved to localStorage
  }, []);

  const logout = useCallback(() => {
    // Debug: Logging out user
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('medibill_user');
    localStorage.removeItem('token');

    // Force redirect to login page
    window.location.href = '/login';
  }, []);

  // Role-based permission checking
  const hasPermission = (resource: string, action: string): boolean => {
    if (!user) return false;

    // Define role-based permissions
    const rolePermissions: Record<string, Record<string, string[]>> = {
      PRODUCT_OWNER: {
        users: ['manage'],
        branches: ['manage'],
        settings: ['manage'],
        integrations: ['manage'],
        backup: ['manage'],
        analytics: ['read'],
        billing: ['manage']
      },
      SUPERADMIN: {
        users: ['manage'],
        employees: ['manage'],
        branches: ['manage'],
        products: ['manage'],
        categories: ['manage'],
        suppliers: ['manage'],
        sales: ['manage'],
        reports: ['manage'],
        dashboard: ['read'],
        settings: ['manage'],
        integrations: ['manage'],
        backup: ['manage'],
        commissions: ['manage'],
        customers: ['manage'],
        refunds: ['manage']
      },
      ADMIN: {
        users: ['create', 'read', 'update'],
        employees: ['manage'],
        products: ['manage'],
        categories: ['manage'],
        suppliers: ['manage'],
        sales: ['manage'],
        reports: ['read', 'export'],
        dashboard: ['read'],
        refunds: ['manage'],
        customers: ['manage'],
        commissions: ['read'],
        settings: ['read'],
        invoices: ['read', 'create', 'update'],
        branches: ['manage'],
        subscription: ['read', 'manage']
      },
      MANAGER: {
        users: ['create', 'read', 'update'],
        employees: ['manage'],
        products: ['manage'],
        categories: ['manage'],
        suppliers: ['manage'],
        sales: ['create', 'read', 'update'],
        reports: ['read', 'export'],
        dashboard: ['read'],
        refunds: ['read', 'approve', 'reject'],
        customers: ['manage'],
        commissions: ['read'],
        settings: ['read'],
        invoices: ['read', 'create', 'update']
      },
      PHARMACIST: {
        products: ['read', 'update'],
        prescriptions: ['manage'],
        customers: ['read', 'update'],
        medication_history: ['read'],
        sales: ['read', 'update'],
        stock_movements: ['read', 'update'],
        dashboard: ['read'],
        reports: ['read'],
        categories: ['read'],
        invoices: ['read']
      },
      CASHIER: {
        sales: ['create', 'read'],
        receipts: ['create', 'read'],
        refunds: ['create', 'read'],
        products: ['read'],
        customers: ['read', 'create', 'update'],
        categories: ['read'],
        dashboard: ['read'],
        reports: ['read'],
        invoices: ['read']
      }
    };

    const userPermissions = rolePermissions[user.role] || {};
    const resourcePermissions = userPermissions[resource] || [];

    return resourcePermissions.includes(action) || resourcePermissions.includes('manage');
  };

  const hasRole = (roles: string[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const canAccess = (resource: string): boolean => {
    if (!user) return false;

    const accessibleResources: Record<string, string[]> = {
      PRODUCT_OWNER: ['users', 'branches', 'settings', 'integrations', 'backup', 'analytics', 'billing'],
      SUPERADMIN: ['users', 'employees', 'branches', 'products', 'categories', 'suppliers', 'sales', 'reports', 'dashboard', 'settings', 'integrations', 'backup', 'commissions', 'customers', 'refunds', 'invoices', 'admin_payments', 'admin_management'],
      ADMIN: ['users', 'employees', 'branches', 'products', 'categories', 'suppliers', 'sales', 'reports', 'dashboard', 'refunds', 'customers', 'commissions', 'settings', 'invoices', 'subscription'],
      MANAGER: ['users', 'employees', 'products', 'categories', 'suppliers', 'sales', 'reports', 'dashboard', 'refunds', 'customers', 'commissions', 'settings', 'invoices'],
      PHARMACIST: ['products', 'prescriptions', 'customers', 'medication_history', 'sales', 'stock_movements', 'dashboard', 'reports', 'categories', 'invoices'],
      CASHIER: ['sales', 'receipts', 'refunds', 'products', 'customers', 'categories', 'dashboard', 'reports', 'invoices']
    };

    const userAccessibleResources = accessibleResources[user.role] || [];
    return userAccessibleResources.includes(resource);
  };

  const checkAuthStatus = (): boolean => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('medibill_user');

    if (!token || !userData) {
      if (isAuthenticated) {
        // User thinks they're authenticated but no token/user data
        logout();
      }
      return false;
    }

    return isAuthenticated && !!user;
  };

  const value: AuthContextType = useMemo(() => ({
    user,
    login,
    logout,
    isAuthenticated,
    hasPermission,
    hasRole,
    canAccess,
    checkAuthStatus
  }), [user, login, logout, isAuthenticated, hasPermission, hasRole, canAccess, checkAuthStatus]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
