import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  Settings,
  UserCog,
  Pill,
  Receipt,
  BarChart3,
  Building2,
  CreditCard,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { useSidebarContext } from './MainLayout';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  resource?: string;
  action?: string;
}

const navigationItems: NavItem[] = [
  // Dashboard - Available to all roles
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] },

  // Core POS Operations - Available to all roles
  { name: 'Inventory', href: '/inventory', icon: Package, roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] },
  { name: 'POS', href: '/pos', icon: ShoppingCart, roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] },
  { name: 'Refunds', href: '/refunds', icon: Receipt, roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] },
  { name: 'Invoices', href: '/invoices', icon: FileText, roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] },
  { name: 'Customers', href: '/customers', icon: Users, roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] },

  // Reports - Available to Manager, Admin, SuperAdmin
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },

  // Prescriptions - Available to Admin, SuperAdmin
  { name: 'Prescriptions', href: '/prescriptions', icon: Pill, roles: ['ADMIN', 'SUPERADMIN'] },

  // User Management - Available to Admin, SuperAdmin
  { name: 'User Management', href: '/admin/users', icon: UserCog, roles: ['ADMIN', 'SUPERADMIN'] },

  // Branch Management - Available to Admin, SuperAdmin
  { name: 'Branch Management', href: '/admin/branches', icon: Building2, roles: ['ADMIN', 'SUPERADMIN'] },

  // Subscription - Available to Manager, Admin, SuperAdmin
  { name: 'Subscription', href: '/admin/subscription', icon: CreditCard, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },

  // Settings - Available to Admin, SuperAdmin
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['ADMIN', 'SUPERADMIN'] }
];

const NavItem: React.FC<{ item: NavItem; isCollapsed: boolean }> = React.memo(({ item, isCollapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === item.href;

  return (
    <RoleGuard roles={item.roles} resource={item.resource} action={item.action}>
      <Link
        to={item.href}
        className={`flex items-center px-4 py-3 text-sm font-medium relative transition-all duration-300 ${
          isActive
            ? 'text-blue-900'
            : 'text-white hover:bg-white hover:bg-opacity-10'
        }`}
        style={{
          backgroundColor: isActive ? '#f8f9fa' : 'transparent',
          borderRadius: isActive ? '25px' : '0',
          marginRight: isActive ? '0' : '0'
        }}
        title={isCollapsed ? item.name : undefined}
        onClick={(e) => {
          // Prevent sidebar from expanding when clicking navigation items
          e.stopPropagation();
        }}
      >
        <item.icon className={`w-5 h-5 ${isCollapsed ? 'mr-0' : 'mr-3'} ${isActive ? 'text-blue-900' : 'text-white'}`} />
        {!isCollapsed && <span className="ml-3">{item.name}</span>}
      </Link>
    </RoleGuard>
  );
});

export const RoleBasedSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const { isCollapsed, setIsCollapsed } = useSidebarContext();

  if (!user) return null;

  return (
    <div className={`fixed  top-0 left-0 h-screen flex flex-col bg-[#0c2c8a] z-50 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo / Title */}
      <div className="p-6 text-white text-xl font-semibold flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <span className="w-8 h-8 flex items-center justify-center bg-white text-blue-900 rounded-full font-bold">N</span>
            <span>NextBill</span>
          </div>
        )}
        {isCollapsed && (
          <span className="w-8 h-8 flex items-center justify-center bg-white text-blue-900 rounded-full font-bold">N</span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-white hover:bg-opacity-10 rounded-md transition-all"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5 text-white" /> : <ChevronLeft className="w-5 h-5 text-white" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} space-y-2 overflow-y-auto`}>
        {navigationItems.map((item) => (
          <NavItem key={`${item.name}-${isCollapsed}`} item={item} isCollapsed={isCollapsed} />
        ))}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-blue-700">
        <button
          onClick={logout}
          className={`w-full flex items-center px-4 py-3 text-sm font-medium text-white hover:bg-white hover:bg-opacity-10 rounded-2xl transition-all ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Log Out' : undefined}
        >
          <LogOut className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && 'Log Out'}
        </button>
      </div>
    </div>
  );
};
