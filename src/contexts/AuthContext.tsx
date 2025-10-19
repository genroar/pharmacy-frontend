import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { apiService } from '../services/api';

interface User {
  id: string;
  name: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER';
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

  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const initializeAuth = () => {
      const savedUser = localStorage.getItem('medibill_user');
      const savedToken = localStorage.getItem('token');

      if (savedUser && savedToken) {
        try {
          const userData = JSON.parse(savedUser);

          // Simple client-side validation - just check if token exists and user data is valid
          if (userData && userData.id && userData.role) {
            setUser(userData);
            setIsAuthenticated(true);
            // Set token in ApiService
            apiService.setToken(savedToken);
          } else {
            localStorage.removeItem('medibill_user');
            localStorage.removeItem('token');
            setUser(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Error parsing saved user data:', error);
          localStorage.removeItem('medibill_user');
          localStorage.removeItem('token');
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        // Clear any stale data if token is missing
        localStorage.removeItem('medibill_user');
        localStorage.removeItem('token');
        setUser(null);
        setIsAuthenticated(false);
      }

      // Mark as initialized
      setIsInitialized(true);
      localStorage.setItem('auth_initialized', 'true');
    };

    initializeAuth();
  }, []);


  const login = useCallback((userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('medibill_user', JSON.stringify(userData));
    // Set token in ApiService
    const token = localStorage.getItem('token');
    if (token) {
      apiService.setToken(token);
    }
  }, []);

  const logout = useCallback(() => {
    const currentUser = user;
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('medibill_user');
    localStorage.removeItem('token');
    localStorage.removeItem('auth_initialized');
    // Clear token from ApiService
    apiService.setToken(null);

    // Clear admin welcome flag so they can see welcome screen again on next login
    if (currentUser?.role === 'ADMIN') {
      localStorage.removeItem(`admin_welcome_seen_${currentUser.id}`);
    }

    // Force redirect to login page
    window.location.href = '/login';
  }, [user]);

  // Listen for authentication required events
  useEffect(() => {
    const handleAuthRequired = (event: CustomEvent) => {
      // Only logout if we're actually authenticated
      if (isAuthenticated) {
        logout();
      }
    };

    window.addEventListener('authRequired', handleAuthRequired as EventListener);
    return () => {
      window.removeEventListener('authRequired', handleAuthRequired as EventListener);
    };
  }, [isAuthenticated, logout]);

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
      CASHIER: ['sales', 'receipts', 'refunds', 'products', 'customers', 'categories', 'dashboard', 'reports', 'invoices']
    };

    const userAccessibleResources = accessibleResources[user.role] || [];
    return userAccessibleResources.includes(resource);
  };

  const checkAuthStatus = useCallback((): boolean => {
    // Simply return the current authentication state
    // Don't perform any localStorage checks or logout calls
    const result = isAuthenticated && !!user;
    console.log('🔍 checkAuthStatus: isAuthenticated:', isAuthenticated, 'user:', !!user, 'result:', result);
    return result;
  }, [isAuthenticated, user]);

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
