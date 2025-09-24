import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  Wifi,
  Clock,
  DollarSign,
  Pill,
  Calendar,
  Building2,
  Download,
  Eye,
  RefreshCw,
  UserPlus
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'manager' | 'cashier'>('cashier');
  const [activeStat, setActiveStat] = useState<string | null>("sales"); // Only first stat is active, no changes allowed
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [branchSales, setBranchSales] = useState<any>({});
  const [userSales, setUserSales] = useState<any>({});
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showBranchDetails, setShowBranchDetails] = useState(false);
  const [showUserDetails, setShowUserDetails] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const handleStatClick = (statId: string) => {
    // No action - only first stat stays active
  };

  const loadSalesData = async () => {
    try {
      // Load sales data for all branches
      const salesResponse = await apiService.getSales({ page: 1, limit: 1000 });
      if (salesResponse.success && salesResponse.data) {
        const sales = salesResponse.data.sales || [];

        // Calculate sales by branch
        const branchSalesData: any = {};
        const userSalesData: any = {};

        sales.forEach((sale: any) => {
          const branchId = sale.branch?.id;
          const userId = sale.user?.id;

          if (branchId) {
            if (!branchSalesData[branchId]) {
              branchSalesData[branchId] = {
                totalSales: 0,
                totalAmount: 0,
                sales: []
              };
            }
            branchSalesData[branchId].totalSales += 1;
            branchSalesData[branchId].totalAmount += sale.totalAmount || 0;
            branchSalesData[branchId].sales.push(sale);
          }

          if (userId) {
            if (!userSalesData[userId]) {
              userSalesData[userId] = {
                totalSales: 0,
                totalAmount: 0,
                sales: []
              };
            }
            userSalesData[userId].totalSales += 1;
            userSalesData[userId].totalAmount += sale.totalAmount || 0;
            userSalesData[userId].sales.push(sale);
          }
        });

        setBranchSales(branchSalesData);
        setUserSales(userSalesData);
      }
    } catch (err) {
      console.warn('Could not load sales data:', err);
    }
  };

  const handleBranchClick = (branch: any) => {
    setSelectedBranch(branch);
    setShowBranchDetails(true);
  };

  const handleUserClick = (user: any) => {
    setSelectedUser(user);
    setShowUserDetails(true);
  };

  const handleViewAllSales = () => {
    navigate('/reports');
  };

  const handleManageInventory = () => {
    navigate('/inventory');
  };

  const formatCurrency = (amount: number) => {
    return `PKR ${amount.toLocaleString()}`;
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get branch ID - use user's branch or get first available branch
      let branchId = user?.branchId;
      if (!branchId) {
        const branchesResponse = await apiService.getBranches();
        if (branchesResponse.success && branchesResponse.data?.branches?.length > 0) {
          branchId = branchesResponse.data.branches[0].id;
        }
      }

      // Get real dashboard data from reports API (same as reports section)
      const dashboardResponse = await apiService.getDashboardData(branchId || "");

      if (dashboardResponse.success && dashboardResponse.data) {
        const data = dashboardResponse.data;
        console.log('Dashboard data loaded:', data);

        setDashboardData({
          today: data.today,
          month: data.month,
          recentSales: data.recentSales || [],
          totalProducts: 0, // Will be updated from inventory data
          lowStockCount: 0  // Will be updated from inventory data
        });
        setLastUpdated(new Date());
      } else {
        setError('Failed to load dashboard data');
      }

      // Load branches, users, and sales data
      try {
        const [branchesResponse, usersResponse] = await Promise.all([
          apiService.getBranches(),
          apiService.getUsers()
        ]);

        if (branchesResponse.success && branchesResponse.data) {
          setAllBranches(branchesResponse.data.branches || []);
        }

        if (usersResponse.success && usersResponse.data) {
          setAllUsers(usersResponse.data.users || []);
        }

        // Load sales data
        await loadSalesData();
      } catch (err) {
        console.warn('Could not load branches/users data:', err);
      }

      // Load real low stock items from inventory report (optional)
      try {
        const inventoryResponse = await apiService.getInventoryReport({ branchId: branchId || "" });
        if (inventoryResponse.success && inventoryResponse.data) {
          setLowStockItems(inventoryResponse.data.lowStockProducts || []);
          // Update dashboard data with inventory counts
          setDashboardData(prev => ({
            ...prev,
            totalProducts: inventoryResponse.data.summary?.totalProducts || 0,
            lowStockCount: inventoryResponse.data.summary?.lowStockCount || 0
          }));
        }
      } catch (inventoryError) {
        console.warn('Could not load inventory data:', inventoryError);
        // Set empty array if inventory fails
        setLowStockItems([]);

        // Try to get basic product count as fallback
        try {
          const productsResponse = await apiService.getProducts({ branchId: branchId || "" });
          if (productsResponse.success && productsResponse.data) {
            const products = productsResponse.data.products || [];
            const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

            setDashboardData(prev => ({
              ...prev,
              totalProducts: products.length,
              lowStockCount: lowStockCount
            }));
          }
        } catch (productError) {
          console.warn('Could not load product data:', productError);
        }
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user?.branchId]);

  // Auto-refresh every 2 minutes for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, []);

  // Refresh data when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Update date and time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Role-based stats - Admin sees all, Cashier sees limited
  const getStatsForRole = () => {
    if (!dashboardData) return [];

    const baseStats = [
      {
        id: "products",
        title: "Total Products",
        value: `${dashboardData.totalProducts || 0}`,
        change: "Active products",
        icon: Package,
        trend: "neutral"
      },
      {
        id: "stock",
        title: "Low Stock Items",
        value: `${dashboardData.lowStockCount || 0}`,
        change: "Need restocking",
        icon: AlertTriangle,
        trend: (dashboardData.lowStockCount || 0) > 0 ? "warning" : "neutral"
      }
    ];

    // Admin sees additional stats
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      return [
        {
          id: "sales",
          title: "Today's Sales",
          value: `PKR ${dashboardData.today?.revenue?.toLocaleString() || '0'}`,
          change: `${dashboardData.today?.transactions || 0} sales`,
          icon: DollarSign,
          trend: "up"
        },
        {
          id: "profit",
          title: "Today's Profit",
          value: `PKR ${dashboardData.today?.profit?.toLocaleString() || '0'}`,
          change: `${dashboardData.today?.growth || 0}% growth`,
          icon: TrendingUp,
          trend: "up"
        },
        ...baseStats
      ];
    }

    // Cashier sees only basic stats (Total Products + Low Stock)
    return baseStats;
  };

  const stats = getStatsForRole();

  const recentSales = dashboardData?.recentSales?.map(sale => {
    const timeAgo = new Date(sale.createdAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timeAgo.getTime()) / (1000 * 60));

    let timeString;
    if (diffInMinutes < 1) timeString = "Just now";
    else if (diffInMinutes < 60) timeString = `${diffInMinutes} min ago`;
    else if (diffInMinutes < 1440) timeString = `${Math.floor(diffInMinutes / 60)} hour${Math.floor(diffInMinutes / 60) > 1 ? 's' : ''} ago`;
    else timeString = `${Math.floor(diffInMinutes / 1440)} day${Math.floor(diffInMinutes / 1440) > 1 ? 's' : ''} ago`;

    return {
      id: sale.id,
      customer: sale.customer?.name || "Walk-in Customer",
      amount: `PKR ${sale.totalAmount.toLocaleString()}`,
      time: timeString,
      items: 1 // We don't have item count in the API response
    };
  }) || [];


  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {user?.role === 'ADMIN' || user?.role === 'MANAGER' ? 'Admin Dashboard' : 'Cashier Dashboard'}
          </h1>
          <p className="text-muted-foreground">
            {user?.role === 'ADMIN' || user?.role === 'MANAGER'
              ? 'Complete overview of all pharmacy operations'
              : 'Inventory and stock management overview'
            }
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            Live Data
          </Badge>
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              {currentDateTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {currentDateTime.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true
              })}
            </p>
            {lastUpdated && (
              <p className="text-xs text-muted-foreground">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Stats Grid - Tab-like Behavior */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          const isActive = activeStat === stat.id;

          return (
            <Card
              key={index}
              className={`
                shadow-soft border-0 transition-all duration-300 cursor-pointer group
                ${isActive
                  ? 'bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] text-white shadow-lg scale-105'
                  : 'bg-white hover:bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:shadow-lg hover:scale-105'
                }
              `}
              onClick={() => handleStatClick(stat.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className={`text-sm font-medium mb-2 ${isActive ? 'text-white/90' : 'text-gray-600 group-hover:text-white/90'}`}>
                      {stat.title}
                    </p>
                    <p className={`text-2xl font-bold mb-2 ${isActive ? 'text-white' : 'text-gray-900 group-hover:text-white'}`}>
                      {stat.value}
                    </p>
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center">
                        <TrendingUp className={`w-4 h-4 mr-1 ${isActive ? 'text-white' : 'text-green-600 group-hover:text-white'}`} />
                        <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-green-600 group-hover:text-white'}`}>
                          {stat.trend === 'up' ? '+12.5%' : stat.trend === 'warning' ? '+5.1%' : '+8.2%'}
                        </span>
                      </div>
                      <span className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-500 group-hover:text-white/80'}`}>
                        vs last month
                      </span>
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl ml-4 ${isActive ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-white/20'}`}>
                    <IconComponent className={`w-8 h-8 ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-white'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid - Role Based */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Admin/Manager: Recent Sales */}
        {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
          <Card className="lg:col-span-2 shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-primary" />
                <span>Recent Sales</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentSales.map((sale, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <ShoppingCart className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{sale.customer}</p>
                        <p className="text-sm text-muted-foreground">{sale.id} • {sale.items} items</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">{sale.amount}</p>
                      <p className="text-xs text-muted-foreground">{sale.time}</p>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleViewAllSales}
                >
                  View All Sales
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Low Stock Alert - All Roles */}
        <Card className={`shadow-soft border-0 ${(user?.role === 'ADMIN' || user?.role === 'MANAGER') ? '' : 'lg:col-span-3'}`}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <span>Low Stock Alert</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockItems.length > 0 ? (
                lowStockItems.map((item, index) => (
                  <div key={index} className="p-3 bg-warning/5 border border-warning/20 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-foreground text-sm">{item.name}</p>
                      <Pill className="w-4 h-4 text-warning" />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Stock: {item.stock}/{item.minStock}</span>
                      <span className="text-muted-foreground">
                        {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                      <div
                        className="bg-warning h-1.5 rounded-full"
                        style={{ width: `${Math.min((item.stock / item.minStock) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Pill className="w-8 h-8 mx-auto mb-2 text-green-500" />
                  <p>All products are well stocked!</p>
                </div>
              )}
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={handleManageInventory}
              >
                Manage Inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branches and Users Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* All Branches */}
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span>All Branches ({allBranches.length})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllBranches(!showAllBranches)}
              >
                {showAllBranches ? 'Show Less' : 'Show All'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(showAllBranches ? allBranches : allBranches.slice(0, 4)).map((branch: any, index: number) => {
                const salesData = branchSales[branch.id] || { totalSales: 0, totalAmount: 0 };
                return (
                  <div
                    key={index}
                    className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleBranchClick(branch)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{branch.name}</p>
                          <p className="text-xs text-muted-foreground">{branch.address}</p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={branch.isActive ? "bg-success/10 text-success border-success/20" : "bg-muted/50 text-muted-foreground border-border"}
                      >
                        {branch.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-4">
                        <span>📞 {branch.phone}</span>
                        <span>📧 {branch.email}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-primary font-medium">{salesData.totalSales} sales</p>
                        <p className="text-primary font-medium">{formatCurrency(salesData.totalAmount)}</p>
                      </div>
                    </div>
                    <div className="text-xs text-primary text-center">
                      Click for details →
                    </div>
                  </div>
                );
              })}
              {allBranches.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No branches found</p>
              )}
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => window.location.href = '/admin/branches'}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Manage Branches
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* All Users */}
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <span>All Users ({allUsers.length})</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllUsers(!showAllUsers)}
              >
                {showAllUsers ? 'Show Less' : 'Show All'}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(showAllUsers ? allUsers : allUsers.slice(0, 4)).map((user: any, index: number) => {
                const salesData = userSales[user.id] || { totalSales: 0, totalAmount: 0 };
                return (
                  <div
                    key={index}
                    className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => handleUserClick(user)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-primary">
                            {user.name.split(' ').map((n: string) => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{user.name}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant="outline"
                          className={
                            user.role === 'SUPERADMIN' ? "bg-red-100 text-red-800 border-red-200" :
                            user.role === 'ADMIN' ? "bg-orange-100 text-orange-800 border-orange-200" :
                            user.role === 'MANAGER' ? "bg-blue-100 text-blue-800 border-blue-200" :
                            "bg-gray-100 text-gray-800 border-gray-200"
                          }
                        >
                          {user.role}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={user.isActive ? "bg-success/10 text-success border-success/20" : "bg-muted/50 text-muted-foreground border-border"}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center justify-between mb-2">
                      <div>
                        <p>📧 {user.email}</p>
                        <p>🏢 {user.branch?.name || 'No Branch'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-primary font-medium">{salesData.totalSales} sales</p>
                        <p className="text-primary font-medium">{formatCurrency(salesData.totalAmount)}</p>
                      </div>
                    </div>
                    <div className="text-xs text-primary text-center">
                      Click for details →
                    </div>
                  </div>
                );
              })}
              {allUsers.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No users found</p>
              )}
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={() => window.location.href = '/admin/users'}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {loading && (
        <Card className="shadow-soft border-0">
          <CardContent className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="shadow-soft border-0">
          <CardContent className="p-12 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadDashboardData} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Branch Details Modal */}
      {showBranchDetails && selectedBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span>{selectedBranch.name} - Sales Details</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBranchDetails(false)}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                    <p className="text-2xl font-bold text-primary">
                      {branchSales[selectedBranch.id]?.totalSales || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(branchSales[selectedBranch.id]?.totalAmount || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Average Sale</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(
                        branchSales[selectedBranch.id]?.totalSales > 0
                          ? (branchSales[selectedBranch.id]?.totalAmount || 0) / branchSales[selectedBranch.id]?.totalSales
                          : 0
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Recent Sales</h3>
                  <div className="space-y-2">
                    {branchSales[selectedBranch.id]?.sales?.slice(0, 10).map((sale: any, index: number) => (
                      <div key={index} className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{sale.customer?.name || 'Walk-in Customer'}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(sale.createdAt).toLocaleDateString()} at {new Date(sale.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary">{formatCurrency(sale.totalAmount)}</p>
                            <p className="text-sm text-muted-foreground">{sale.items?.length || 1} items</p>
                          </div>
                        </div>
                      </div>
                    )) || (
                      <p className="text-muted-foreground text-center py-4">No sales found for this branch</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <span>{selectedUser.name} - Sales Details</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUserDetails(false)}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Sales</p>
                    <p className="text-2xl font-bold text-primary">
                      {userSales[selectedUser.id]?.totalSales || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(userSales[selectedUser.id]?.totalAmount || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground">Average Sale</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(
                        userSales[selectedUser.id]?.totalSales > 0
                          ? (userSales[selectedUser.id]?.totalAmount || 0) / userSales[selectedUser.id]?.totalSales
                          : 0
                      )}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Recent Sales</h3>
                  <div className="space-y-2">
                    {userSales[selectedUser.id]?.sales?.slice(0, 10).map((sale: any, index: number) => (
                      <div key={index} className="p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{sale.customer?.name || 'Walk-in Customer'}</p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(sale.createdAt).toLocaleDateString()} at {new Date(sale.createdAt).toLocaleTimeString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Branch: {sale.branch?.name || 'Unknown'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary">{formatCurrency(sale.totalAmount)}</p>
                            <p className="text-sm text-muted-foreground">{sale.items?.length || 1} items</p>
                          </div>
                        </div>
                      </div>
                    )) || (
                      <p className="text-muted-foreground text-center py-4">No sales found for this user</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
};

export default Dashboard;