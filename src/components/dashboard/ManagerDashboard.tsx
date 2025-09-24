import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  UserPlus,
  BarChart3,
  PieChart,
  LineChart,
  Download,
  Eye,
  CheckCircle,
  X,
  UserCog,
  Plus,
  RefreshCw,
  Undo2,
  Receipt
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const ManagerDashboard = () => {
  const { user, logout } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [selectedBranch, setSelectedBranch] = useState<any>(null);
  const [branchDetails, setBranchDetails] = useState<any>(null);
  const [showBranchDetails, setShowBranchDetails] = useState(false);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [showAllRecentSales, setShowAllRecentSales] = useState(false);
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [realSalesData, setRealSalesData] = useState<any[]>([]);
  const [realProductsData, setRealProductsData] = useState<any[]>([]);
  const [realRevenue, setRealRevenue] = useState(0);
  const [realProductsCount, setRealProductsCount] = useState(0);
  const [realUsersCount, setRealUsersCount] = useState(0);
  const [realCustomersCount, setRealCustomersCount] = useState(0);
  const [realRefundsData, setRealRefundsData] = useState<any[]>([]);
  const [realRefundsCount, setRealRefundsCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [activeStatTab, setActiveStatTab] = useState(0); // Only first card is active, no changes allowed

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading manager dashboard data...');
      console.log('🔍 User context:', { id: user?.id, role: user?.role, branchId: user?.branchId, adminId: user?.adminId });

      // Get manager's assigned branch
      const branchId = user?.branchId;
      if (!branchId) {
        console.error('❌ Manager has no assigned branch');
        setError('No branch assigned to this manager');
        return;
      }

      // Load all data in parallel
      const [dashboardResponse, salesResponse, productsResponse, usersResponse, customersResponse, refundsResponse] = await Promise.all([
        apiService.getDashboardData(branchId),
        apiService.getSales({ page: 1, limit: 50 }),
        apiService.getProducts({ page: 1, limit: 100 }),
        apiService.getUsers({ page: 1, limit: 100 }),
        apiService.getCustomers({ branchId: user?.branchId || "", page: 1, limit: 100 }),
        apiService.getRefunds({ page: 1, limit: 50 })
      ]);

      console.log('📊 Dashboard response:', dashboardResponse);
      console.log('📊 Sales response:', salesResponse);
      console.log('📊 Products response:', productsResponse);
      console.log('📊 Users response:', usersResponse);
      console.log('📊 Customers response:', customersResponse);
      console.log('📊 Refunds response:', refundsResponse);

      // Process dashboard data
      if (dashboardResponse.success) {
        setDashboardData(dashboardResponse.data);
      }

      // Process sales data
      if (salesResponse.success && salesResponse.data) {
        const sales = salesResponse.data.sales || [];
        setRealSalesData(sales);
        const totalRevenue = sales.reduce((sum: number, sale: any) => sum + (sale.totalAmount || 0), 0);
        setRealRevenue(totalRevenue);
      }

      // Process products data
      if (productsResponse.success && productsResponse.data) {
        const products = productsResponse.data.products || [];
        setRealProductsData(products);
        setRealProductsCount(products.length);
      }

      // Process users data (only cashiers and managers under this admin)
      if (usersResponse.success && usersResponse.data) {
        const users = usersResponse.data.users || [];
        setAllUsers(users);
        setRealUsersCount(users.length);
      }

      // Process customers data
      if (customersResponse.success && customersResponse.data) {
        const customers = customersResponse.data.customers || [];
        setRealCustomersCount(customers.length);
      }

      // Process refunds data
      if (refundsResponse.success && refundsResponse.data) {
        const refunds = refundsResponse.data.refunds || [];
        setRealRefundsData(refunds);
        setRealRefundsCount(refunds.length);
      }

      // Get manager's branch details
      const branchResponse = await apiService.getBranches();
      if (branchResponse.success && branchResponse.data?.branches) {
        const managerBranch = branchResponse.data.branches.find((branch: any) => branch.id === branchId);
        if (managerBranch) {
          setSelectedBranch(managerBranch);
          setBranchDetails(managerBranch);
        }
      }

      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('❌ Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load data on component mount
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  // Get recent sales
  const recentSales = useMemo(() => {
    return realSalesData.slice(0, 5).map(sale => ({
      id: sale.id,
      customer: sale.customer?.name || 'Walk-in Customer',
      amount: formatCurrency(sale.totalAmount || 0),
      items: sale.items?.length || 0,
      time: new Date(sale.createdAt).toLocaleTimeString(),
      date: new Date(sale.createdAt).toLocaleDateString()
    }));
  }, [realSalesData]);

  // Get recent refunds
  const recentRefunds = useMemo(() => {
    return realRefundsData.slice(0, 5).map(refund => ({
      id: refund.id,
      originalSaleId: refund.originalSaleId,
      amount: formatCurrency(parseFloat(refund.refundAmount || 0)),
      reason: refund.refundReason || 'No reason provided',
      refundedBy: refund.refundedByUser?.name || 'Unknown',
      time: new Date(refund.createdAt).toLocaleTimeString(),
      date: new Date(refund.createdAt).toLocaleDateString()
    }));
  }, [realRefundsData]);

  // Get low stock products
  const lowStockProducts = useMemo(() => {
    return realProductsData.filter(product =>
      product.stock <= (product.minStock || 10)
    ).slice(0, 5);
  }, [realProductsData]);

  // Get cashiers under this manager
  const cashiers = useMemo(() => {
    return allUsers.filter(user => user.role === 'CASHIER');
  }, [allUsers]);

  // Get managers under this admin
  const managers = useMemo(() => {
    return allUsers.filter(user => user.role === 'MANAGER');
  }, [allUsers]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading manager dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-4" />
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={loadDashboardData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Manager Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Welcome back, {user?.name || 'Manager'} • {selectedBranch?.name || 'Branch Management'}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
             
              <div className="flex items-center space-x-2">
                <Wifi className="w-4 h-4 text-green-500" />
                <span className="text-sm text-green-600">Live Data</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Branch Overview */}
      <Card className="mb-6 shadow-soft border-0">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span>Branch Overview</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {selectedBranch?.name || 'No Branch Assigned'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { title: "Total Revenue", value: formatCurrency(realRevenue), icon: DollarSign, trendValue: "+12.5%" },
              { title: "Total Sales", value: realSalesData.length.toString(), icon: ShoppingCart, trendValue: "+8.2%" },
              { title: "Total Products", value: realProductsCount.toString(), icon: Package, trendValue: "+5.1%" },
              { title: "Total Users", value: realUsersCount.toString(), icon: Users, trendValue: "+15.3%" },
              { title: "Total Refunds", value: realRefundsCount.toString(), icon: Undo2, trendValue: "+2.0%" }
            ].map((stat, index) => {
              const IconComponent = stat.icon;
              const isActive = activeStatTab === index;

              return (
                <div
                  key={index}
                  className={`
                    p-4 rounded-lg cursor-pointer transition-all duration-300 group
                    ${isActive
                      ? 'bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] text-white shadow-lg scale-105'
                      : 'bg-white hover:bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:text-white hover:shadow-lg hover:scale-105'
                    }
                  `}
                  onClick={() => {}} // No click action - only first card stays active
                >
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
                            {stat.trendValue}
                          </span>
                        </div>
                        <span className={`text-xs ${isActive ? 'text-white/80' : 'text-gray-500 group-hover:text-white/80'}`}>
                          vs last month
                        </span>
                      </div>
                    </div>
                    <div className={`p-3 rounded-xl ml-4 ${isActive ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-white/20'}`}>
                      <IconComponent className={`w-8 h-8 ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-white'}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales */}
        <Card className="lg:col-span-2 shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>Recent Sales</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSales.length > 0 ? (
                recentSales.map((sale, index) => (
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
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recent sales found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cashier Management */}
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <UserCog className="w-5 h-5 text-primary" />
              <span>Cashier Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Cashiers</p>
                    <p className="text-sm text-blue-600">{cashiers.length} active</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => window.location.href = '/manager/users'}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Cashier
                </Button>
              </div>

              <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Users className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="font-medium text-purple-900">Customers</p>
                    <p className="text-sm text-purple-600">{realCustomersCount} registered</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  <Eye className="w-4 h-4 mr-2" />
                  View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Refunds */}
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Undo2 className="w-5 h-5 text-red-500" />
              <span>Recent Refunds</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentRefunds.length > 0 ? (
                recentRefunds.map((refund, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                        <Undo2 className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-red-900">Refund #{refund.id.slice(-8)}</p>
                        <p className="text-sm text-red-600">{refund.reason}</p>
                        <p className="text-xs text-red-500">By: {refund.refundedBy}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-red-900">{refund.amount}</p>
                      <p className="text-xs text-red-600">{refund.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Undo2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recent refunds found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className="lg:col-span-2 shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <span>Low Stock Alert</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {lowStockProducts.length > 0 ? (
                lowStockProducts.map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-medium text-orange-900">{product.name}</p>
                        <p className="text-sm text-orange-600">Current: {product.stock} • Min: {product.minStock || 10}</p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      Low Stock
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                  <p>All products are well stocked</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>


      </div>

      {/* Last Updated */}

    </div>
  );
};

export default ManagerDashboard;
