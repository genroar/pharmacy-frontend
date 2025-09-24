import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  Settings,
  Stethoscope,
  Wifi,
  WifiOff,
  Bell,
  Shield,
  RotateCcw,
  UserCheck,
  Clock,
  Receipt,
  Truck,
  Award,
  CreditCard,
  UserCog,
  Building2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const AppSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const [isOnline, setIsOnline] = useState(true);
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || 'cashier';

  // Cashier items - basic POS operations
  const cashierItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Inventory", url: "/inventory", icon: Package },
    { title: "Point of Sale", url: "/pos", icon: ShoppingCart },
    { title: "Refunds & Returns", url: "/refunds", icon: RotateCcw },
    { title: "Customers", url: "/customers", icon: Users },
    { title: "Invoices", url: "/invoices", icon: Receipt },
  ];

  // Manager items - includes reports
  const managerItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Inventory", url: "/inventory", icon: Package },
    { title: "Point of Sale", url: "/pos", icon: ShoppingCart },
    { title: "Refunds & Returns", url: "/refunds", icon: RotateCcw },
    { title: "Customers", url: "/customers", icon: Users },
    { title: "Invoices", url: "/invoices", icon: Receipt },
    { title: "Reports", url: "/reports", icon: TrendingUp },
  ];

  // Admin items - full access to all tabs
  const adminItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Inventory", url: "/inventory", icon: Package },
    { title: "Point of Sale", url: "/pos", icon: ShoppingCart },
    { title: "Refunds & Returns", url: "/refunds", icon: RotateCcw },
    { title: "Customers", url: "/customers", icon: Users },
    { title: "Invoices", url: "/invoices", icon: Receipt },
    { title: "Reports", url: "/reports", icon: TrendingUp },
    { title: "Prescriptions", url: "/prescriptions", icon: Stethoscope },
    { title: "User Management", url: "/admin/users", icon: Shield },
    { title: "Employee Management", url: "/admin/employees", icon: UserCheck },
    { title: "Branch Management", url: "/admin/branches", icon: Building2 },
    { title: "Subscription", url: "/admin/subscription", icon: CreditCard },
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  // SuperAdmin items - full access to all tabs
  const superAdminItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Inventory", url: "/inventory", icon: Package },
    { title: "Point of Sale", url: "/pos", icon: ShoppingCart },
    { title: "Refunds & Returns", url: "/refunds", icon: RotateCcw },
    { title: "Customers", url: "/customers", icon: Users },
    { title: "Invoices", url: "/invoices", icon: Receipt },
    { title: "Reports", url: "/reports", icon: TrendingUp },
    { title: "Prescriptions", url: "/prescriptions", icon: Stethoscope },
    { title: "User Management", url: "/admin/users", icon: Shield },
    { title: "Employee Management", url: "/admin/employees", icon: UserCheck },
    { title: "Branch Management", url: "/admin/branches", icon: Building2 },
    { title: "Admin Payment", url: "/superadmin/payments", icon: CreditCard },
    { title: "Admin Management", url: "/superadmin/admins", icon: UserCog },
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  // Get menu items based on role
  const getMainMenuItems = () => {
    if (userRole === "superadmin") {
      return superAdminItems;
    } else if (userRole === "admin") {
      return adminItems;
    } else if (userRole === "manager") {
      return managerItems;
    } else {
      return cashierItems;
    }
  };

  const managementItems = [
    { title: "Settings", url: "/settings", icon: Settings },
  ];

  // Check if a route is active
  const isRouteActive = (url: string) => {
    if (url === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(url);
  };

  // Navigation classes - active & hover styling
  const getNavCls = (url: string) => {
    const isActive = isRouteActive(url);
    return isActive
      ? "flex items-center gap-3 px-3 py-2 rounded-md font-medium text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] shadow-sm transition-all duration-200"
      : "flex items-center gap-3 px-3 py-2 rounded-md text-gray-600 hover:bg-green-50 hover:text-green-700 transition-all duration-200";
  };

  return (
    <Sidebar className={`${collapsed ? "w-16" : "w-64"} bg-white border-r border-gray-200 shadow-sm`} collapsible="icon">
      <SidebarContent className="flex flex-col h-full">
        {/* Header */}
        <div className={`p-4 border-b border-gray-200 ${collapsed ? "px-2" : ""}`}>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] rounded-lg flex items-center justify-center flex-shrink-0 shadow-md">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div className="flex-1">
                <h2 className="font-bold text-gray-900">POS</h2>
                <p className="text-xs text-gray-500">Pharmacy POS</p>
                <Badge
                  variant="outline"
                  className={`text-xs mt-1 ${
                    userRole === "admin"
                      ? "bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] text-white border-transparent"
                      : userRole === "manager"
                      ? "bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] text-white border-transparent"
                      : "bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] text-white border-transparent"
                  }`}
                >
                  {userRole === "admin"
                    ? "System Admin"
                    : userRole === "manager"
                    ? "Branch Manager"
                    : "Cashier"}
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Connection Status */}
        {!collapsed && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className={
                  isOnline
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-yellow-50 text-yellow-700 border-yellow-200"
                }
              >
                {isOnline ? (
                  <Wifi className="w-3 h-3 mr-1" />
                ) : (
                  <WifiOff className="w-3 h-3 mr-1" />
                )}
                {isOnline ? "Online" : "Offline"}
              </Badge>
              <div className="flex items-center space-x-1">
                <Bell className="w-4 h-4 text-gray-400" />
                <Badge

                  className="w-5 h-5 rounded-full bg-gray-100 text-black p-0 flex items-center justify-center text-xs"
                >
                  3
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Main Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {getMainMenuItems().map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls(item.url)}>
                      <item.icon className={`w-5 h-5 ${
                        isRouteActive(item.url) ? "text-white" : "text-gray-500"
                      }`} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* SuperAdmin Management */}
        {userRole === "superadmin" && (
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Platform Management
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} end className={getNavCls(item.url)}>
                        <item.icon className={`w-5 h-5 ${
                          isRouteActive(item.url) ? "text-white" : "text-gray-500"
                        }`} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}


        {/* Management */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Management
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls(item.url)}>
                      <item.icon className={`w-5 h-5 ${
                        isRouteActive(item.url) ? "text-white" : "text-gray-500"
                      }`} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* User Info */}
        {!collapsed && (
          <div className="mt-auto p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                userRole === "admin"
                  ? "bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)]"
                  : userRole === "manager"
                  ? "bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)]"
                  : "bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)]"
              }`}>
                <span className={`text-sm font-medium ${
                  userRole === "admin"
                    ? "text-white"
                    : userRole === "manager"
                    ? "text-white"
                    : "text-white"
                }`}>
                  {user?.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase() : "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-xs text-gray-500 capitalize">{user?.role || "Cashier"}</p>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              <p>Device: TABLET-001</p>
              <p>Last Sync: 2 min ago</p>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
