import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  FileText,
  Settings,
  UserCheck,
  Pill,
  Receipt,
  BarChart3,
  Shield,
  Building2,
  UserCog,
  CreditCard,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  resource?: string;
  action?: string;
  children?: NavItem[];
}

const navigationItems: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['MANAGER', 'ADMIN', 'SUPERADMIN'],
    resource: 'dashboard',
    action: 'read'
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Package,
    roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
    resource: 'products',
    action: 'read'
  },
  {
    name: 'POS',
    href: '/pos',
    icon: ShoppingCart,
    roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
    resource: 'sales',
    action: 'create'
  },
  {
    name: 'Refunds',
    href: '/refunds',
    icon: Receipt,
    roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
    resource: 'refunds',
    action: 'read'
  },
  {
    name: 'Invoices',
    href: '/invoices',
    icon: FileText,
    roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
    resource: 'invoices',
    action: 'read'
  },
  {
    name: 'Customers',
    href: '/customers',
    icon: Users,
    roles: ['CASHIER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
    resource: 'customers',
    action: 'read'
  },
  {
    name: 'Prescriptions',
    href: '/prescriptions',
    icon: Pill,
    roles: ['ADMIN'],
    resource: 'prescriptions',
    action: 'read'
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    roles: ['MANAGER', 'ADMIN'],
    resource: 'reports',
    action: 'read'
  },
  {
    name: 'User Management',
    href: '/admin/users',
    icon: UserCog,
    roles: ['ADMIN', 'SUPERADMIN'],
    resource: 'users',
    action: 'read'
  },
  {
    name: 'Cashier Management',
    href: '/manager/users',
    icon: UserCog,
    roles: ['MANAGER'],
    resource: 'users',
    action: 'read'
  },
  {
    name: 'Branch Management',
    href: '/admin/branches',
    icon: Building2,
    roles: ['ADMIN' ],
    resource: 'branches',
    action: 'manage'
  },
  {
    name: 'Subscription',
    href: '/admin/subscription',
    icon: CreditCard,
    roles: ['ADMIN', 'MANAGER'],
    resource: 'subscription',
    action: 'read'
  },
  {
    name: 'Admin Payment',
    href: '/superadmin/payments',
    icon: CreditCard,
    roles: ['SUPERADMIN']
  },
  {
    name: 'Admin Management',
    href: '/superadmin/admins',
    icon: UserCog,
    roles: ['SUPERADMIN']
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['ADMIN', 'SUPERADMIN'],
    resource: 'settings',
    action: 'read'
  }
];

const NavItem: React.FC<{ item: NavItem }> = ({ item }) => {
  const location = useLocation();
  const isActive = location.pathname === item.href;

  // Debug logging for SUPERADMIN tabs
  if (item.name === 'Admin Payment' || item.name === 'Admin Management') {
    console.log('🔍 Debug NavItem:', item.name, 'Roles:', item.roles, 'Resource:', item.resource);
  }

  return (
    <RoleGuard
      roles={item.roles}
      resource={item.resource}
      action={item.action}
    >
      <Link
        to={item.href}
        className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
          isActive
            ? 'bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] text-white'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <item.icon className="w-5 h-5 mr-3" />
        {item.name}
      </Link>
    </RoleGuard>
  );
};

export const RoleBasedSidebar: React.FC = () => {
  const { user, logout } = useAuth();

  console.log('🔍 RoleBasedSidebar: User:', user);
  console.log('🔍 RoleBasedSidebar: User role:', user?.role);

  if (!user) {
    return null;
  }


  return (
    <div className="fixed left-0 top-0 h-screen w-64 bg-background border-r border-border flex flex-col z-50">
      <div className="flex items-center px-4 py-6">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8  rounded-lg flex items-center justify-center">
            <img alt="logo" src="/public/images/pos_logo.png"  />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">NextBill</h1>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          // Debug logging for Refunds and POS
          if (item.name === 'Refunds' || item.name === 'POS') {
            console.log(`🔍 ${item.name.toUpperCase()} Sidebar Debug:`, {
              itemName: item.name,
              roles: item.roles,
              resource: item.resource,
              action: item.action,
              userRole: user.role
            });
          }
          return <NavItem key={item.name} item={item} />;
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-muted-foreground">
              {user.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.role}</p>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
};
