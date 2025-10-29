import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  UserCog,
  Pill,
  Receipt,
  BarChart3,
  Building2,
  Clock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Home
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { useSidebarContext } from './MainLayout';

interface NavItem {
  name: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  resource?: string;
  action?: string;
  children?: NavItem[];
}

const navigationItems: NavItem[] = [
  // Dashboard - Available to all roles
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] },

  // Point of Sale - Only for Cashiers (standalone, not in dropdown)
  { name: 'Point of Sale', href: '/create-invoice', icon: ShoppingCart, roles: ['CASHIER'] },

  // Invoices - Only for Cashiers (standalone)
  { name: 'Invoices', href: '/invoices', icon: FileText, roles: ['CASHIER'] },

  // Refunds - Only for Cashiers (standalone)
  { name: 'Refunds', href: '/refunds', icon: Receipt, roles: ['CASHIER'] },

  // Customers - Available to all roles
  { name: 'Customers', href: '/customers', icon: Users, roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] },

  // Sales Dropdown - Available to Manager, Admin, SuperAdmin (removed CASHIER)
  {
    name: 'Sales',
    icon: ShoppingCart,
    roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'],
    children: [
      { name: 'Point of Sale', href: '/create-invoice', icon: ShoppingCart, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },
      { name: 'Invoices', href: '/invoices', icon: FileText, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },
      { name: 'Refunds', href: '/refunds', icon: Receipt, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] }
    ]
  },

  // Inventory Dropdown - Available to Manager, Admin, SuperAdmin (removed CASHIER)
  {
    name: 'Inventory',
    icon: Package,
    roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'],
    children: [
      { name: 'All Products', href: '/inventory', icon: Package, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },
      { name: 'Categories', href: '/inventory/categories', icon: Package, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },
      { name: 'Manufacturers', href: '/manufacturers', icon: Building2, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },
      { name: 'Suppliers', href: '/suppliers', icon: Building2, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },
      { name: 'Shelves', href: '/shelves', icon: Package, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },
      { name: 'Batches', href: '/batches', icon: Package, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },
      { name: 'Order Purchase', href: '/order-purchase', icon: ShoppingCart, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] }
    ]
  },

  // Management Dropdown - Available to Admin, SuperAdmin
  {
    name: 'Business Management',
    icon: UserCog,
    roles: ['ADMIN', 'SUPERADMIN'],
    children: [
      { name: 'Staff', href: '/admin/users', icon: UserCog, roles: ['ADMIN', 'SUPERADMIN'] },
      { name: 'Branch', href: '/admin/branches', icon: Building2, roles: ['ADMIN', 'SUPERADMIN'] },
    ]
  },

   // Reports - Available to Manager, Admin, SuperAdmin
   { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'] },

];

const DropdownNavItem: React.FC<{ item: NavItem; isCollapsed: boolean }> = React.memo(({ item, isCollapsed }) => {
  const location = useLocation();

  // Check if any child is active
  const isChildActive = item.children?.some(child => location.pathname === child.href) || false;
  const isActive = location.pathname === item.href || isChildActive;

  // Keep dropdown open if any child is active
  const [isOpen, setIsOpen] = useState(isChildActive);

  // Update isOpen state when location changes
  React.useEffect(() => {
    setIsOpen(isChildActive);
  }, [isChildActive]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isCollapsed) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <RoleGuard roles={item.roles} resource={item.resource} action={item.action}>
      <div className="relative">
        <button
          onClick={handleToggle}
          className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium relative transition-all duration-300 ${
            isActive
              ? 'text-blue-600 bg-blue-50'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
          title={isCollapsed ? item.name : undefined}
        >
          <div className="flex items-center">
            <item.icon className={`w-5 h-5 ${isCollapsed ? 'mr-0' : 'mr-3'} ${isActive ? 'text-blue-600' : 'text-gray-700'}`} />
            {!isCollapsed && <span className="ml-3">{item.name}</span>}
          </div>
          {!isCollapsed && item.children && (
            <div className="ml-2 transition-transform duration-300 ease-in-out">
              <ChevronDown
                className={`w-4 h-4 text-gray-700 transition-transform duration-300 ease-in-out ${
                  isOpen ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </div>
          )}
        </button>

        {/* Dropdown Menu */}
        {!isCollapsed && item.children && (
          <div
            className={`ml-4 mt-1 space-y-1 overflow-hidden ${
              isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="space-y-1">
              {item.children.map((child, index) => (
                <RoleGuard key={child.name} roles={child.roles} resource={child.resource} action={child.action}>
                  <Link
                    to={child.href!}
                    className={`flex items-center px-4 py-2 text-sm font-medium relative transition-all duration-300 transform ${
                      location.pathname === child.href
                        ? 'text-blue-600 bg-blue-50 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50'
                    } ${
                      isOpen ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Don't close the dropdown when clicking on child items
                    }}
                  >
                    <child.icon className={`w-4 h-4 mr-3 transition-colors duration-300 ${location.pathname === child.href ? 'text-blue-600' : 'text-gray-700'}`} />
                    <span className="transition-colors duration-300">{child.name}</span>
                  </Link>
                </RoleGuard>
              ))}
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
});

const NavItem: React.FC<{ item: NavItem; isCollapsed: boolean }> = React.memo(({ item, isCollapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === item.href;

  // If item has children, render as dropdown
  if (item.children) {
    return <DropdownNavItem item={item} isCollapsed={isCollapsed} />;
  }

  // Regular navigation item
  return (
    <RoleGuard roles={item.roles} resource={item.resource} action={item.action}>
      <Link
        to={item.href!}
        className={`flex items-center px-4 py-3 text-sm font-medium relative transition-all duration-300 ${
          isActive
            ? 'text-blue-600 bg-blue-50'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
        title={isCollapsed ? item.name : undefined}
        onClick={(e) => {
          // Prevent sidebar from expanding when clicking navigation items
          e.stopPropagation();
        }}
      >
        <item.icon className={`w-5 h-5 ${isCollapsed ? 'mr-0' : 'mr-3'} ${isActive ? 'text-blue-600' : 'text-gray-700'}`} />
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
    <div className={`fixed  top-0 left-0 h-screen flex flex-col bg-white border-r border-gray-200 z-50 transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo / Title */}
      <div className="p-6 text-gray-900 text-xl font-semibold flex items-center justify-between border-b border-gray-200">
        {!isCollapsed && (
          <div className="flex items-center space-x-2">
            <img
              src="/images/logo.png"
              alt="Zapeera Logo"
              className=" w-40 object-contain"
            />
          </div>
        )}
        {isCollapsed && (
          <img
            src="/images/favicon.png"
            alt="Zapeera Logo"
            className="w-8 h-8 object-contain"
          />
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 hover:bg-gray-100 rounded-md transition-all"
        >
          {isCollapsed ? <ChevronRight className="w-5 h-5 text-gray-700" /> : <ChevronLeft className="w-5 h-5 text-gray-700" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : ''} space-y-2 overflow-y-auto`}>
        {navigationItems.map((item) => (
          <NavItem key={`${item.name}-${isCollapsed}`} item={item} isCollapsed={isCollapsed} />
        ))}
      </nav>

      {/* Back to Zappera Dashboard & Logout Buttons */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        {/* Back to Zappera Dashboard Button */}
        <a
          href="https://zappera.com"
          target="_blank"
          rel="noopener noreferrer"
          className={`w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-all ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Back to Zappera Dashboard' : undefined}
        >
          <Home className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && 'Back to Zappera'}
        </a>

        {/* Logout Button */}
        <button
          onClick={logout}
          className={`w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-all ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Log Out' : undefined}
        >
          <LogOut className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && 'Log Out'}
        </button>
      </div>
    </div>
  );
};
