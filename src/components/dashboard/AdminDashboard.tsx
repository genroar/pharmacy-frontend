import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  ChevronDown,
  ChevronUp,
  Search,
  Filter
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";

const AdminDashboard = () => {

  const navigate = useNavigate();
  const { logout } = useAuth();
  const {
    selectedCompanyId,
    setSelectedCompanyId,
    selectedBranchId,
    setSelectedBranchId,
    allCompanies,
    allBranches,
    selectedCompany,
    selectedBranch: globalSelectedBranch
  } = useAdmin();

  // Memoize logout function to prevent re-renders
  const memoizedLogout = useCallback(() => {
    logout();
  }, [logout]);
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
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [realSalesData, setRealSalesData] = useState<any[]>([]);
  const [realProductsData, setRealProductsData] = useState<any[]>([]);
  const [realRevenue, setRealRevenue] = useState(0);
  const [realTotalSales, setRealTotalSales] = useState(0);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isBranchSummaryCollapsed, setIsBranchSummaryCollapsed] = useState(false);
  const [activeStatTab, setActiveStatTab] = useState(0); // Only first card is active, no changes allowed

  // Expiry alerts state
  const [nearExpiryBatches, setNearExpiryBatches] = useState<any[]>([]);
  const [expiredBatches, setExpiredBatches] = useState<any[]>([]);
  const [showAllExpiryAlerts, setShowAllExpiryAlerts] = useState(false);

  // Company management state (now handled by AdminContext)
  const [globalSelectedCompany, setGlobalSelectedCompany] = useState<any>(null);

  // Loading state for company/branch selection
  const [isLoading, setIsLoading] = useState(false);

  // Real-time clock timer
  useEffect(() => {
    const updateDateTime = () => {
      setCurrentDateTime(new Date());
    };

    updateDateTime();
    timerRef.current = setInterval(updateDateTime, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if user is properly authenticated before making API calls
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in.');
        return;
      }

      // Get current user info
      const currentUserData = JSON.parse(localStorage.getItem('medibill_user') || '{}');
      setCurrentUser(currentUserData);
      const currentUserRole = currentUserData.role;
      const currentUserId = currentUserData.id;
      const currentUserBranchId = currentUserData.branchId || currentUserData.branch?.id;

      // Load real data from database - sales, products, and users in parallel
      // Companies are now loaded by AdminContext
      const [salesResponse, productsResponse, usersResponse] = await Promise.all([
        apiService.getSales({
          page: 1,
          limit: 100,
          ...(selectedBranchId && { branchId: selectedBranchId })
        }), // Load recent sales from selected branch
        apiService.getProducts({
          page: 1,
          limit: 100,
          ...(selectedBranchId && { branchId: selectedBranchId })
        }), // Load products from selected branch
        apiService.getUsers({
          page: 1,
          limit: 100,
          ...(selectedBranchId && { branchId: selectedBranchId })
        }) // Load users from selected branch
      ]);

      // Process real sales data
      if (salesResponse.success && salesResponse.data) {
        const sales = salesResponse.data.sales || [];
        setRealSalesData(sales);

        // Calculate real revenue and total sales
        const totalRevenue = sales.reduce((sum: number, sale: any) => sum + (sale.totalAmount || 0), 0);
        const totalSalesCount = sales.length;
        setRealRevenue(totalRevenue);
        setRealTotalSales(totalSalesCount);

        // Create dashboard data structure with real data
        setDashboardData({
          totalRevenue: totalRevenue,
          totalSales: totalSalesCount,
          totalUsers: 0, // Will be set after users are loaded
          recentSales: sales.slice(0, 10), // Show last 10 sales
          lowStockProducts: [] // Will be set after products are loaded
        });
      } else {
        setError('Failed to load sales data');
      }

      // Process real products data
      if (productsResponse.success && productsResponse.data) {
        const products = productsResponse.data.products || [];
        setRealProductsData(products);

        // Find low stock products
        const lowStockProducts = products.filter((product: any) =>
          product.stock <= product.minStock
        );

        // Update dashboard data with low stock products
        setDashboardData(prev => ({
          ...prev,
          lowStockProducts: lowStockProducts
        }));

        // Set top products (you can customize this logic)
        setTopProducts(products.slice(0, 10));
      } else {
        setError('Failed to load products data');
      }

      // Branches are now loaded by the AdminContext

      if (usersResponse.success && usersResponse.data) {
        const usersData = usersResponse.data.users || [];

        // Filter users based on user role
        let filteredUsers = usersData;
        if (currentUserRole === 'ADMIN') {
          // ADMIN can see users from all branches they manage
          // For now, show all MANAGER and CASHIER users (in real implementation, filter by branch ownership)
          filteredUsers = usersData.filter((user: any) =>
            user.role === 'MANAGER' || user.role === 'CASHIER'
          );
        } else if (currentUserRole === 'SUPERADMIN') {
          // SUPERADMIN can see all users except other SUPERADMINs
          filteredUsers = usersData.filter((user: any) =>
            user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'CASHIER'
          );
        }

        setAllUsers(filteredUsers);

        // Update dashboard data with total users count
        setDashboardData(prev => ({
          ...prev,
          totalUsers: filteredUsers.length
        }));
      }

      // Companies are now handled by AdminContext
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array since this function doesn't depend on any props or state

  // Load expiry alerts data
  const loadExpiryAlerts = useCallback(async () => {
    try {
      console.log('Loading expiry alerts (Admin)...', { selectedBranchId, selectedCompanyId });

      // Load near expiry batches (within 30 days)
      const nearExpiryResponse = await apiService.getNearExpiryBatches(30);
      console.log('Near expiry response (Admin):', nearExpiryResponse);
      if (nearExpiryResponse?.success) {
        setNearExpiryBatches(nearExpiryResponse.data || []);
      } else {
        console.warn('Failed to load near expiry batches:', nearExpiryResponse?.message);
        setNearExpiryBatches([]);
      }

      // Load expired batches (past expiry date)
      const expiredResponse = await apiService.getNearExpiryBatches(0);
      console.log('Expired response (Admin):', expiredResponse);
      if (expiredResponse?.success) {
        setExpiredBatches(expiredResponse.data || []);
      } else {
        console.warn('Failed to load expired batches:', expiredResponse?.message);
        setExpiredBatches([]);
      }

      console.log('Near expiry batches (Admin):', nearExpiryBatches);
      console.log('Expired batches (Admin):', expiredBatches);
    } catch (error) {
      console.error('Error loading expiry alerts (Admin):', error);
      // Set empty arrays on error to prevent UI issues
      setNearExpiryBatches([]);
      setExpiredBatches([]);
    }
  }, [selectedBranchId, selectedCompanyId]);

  // Load dashboard data on component mount
  useEffect(() => {
    loadDashboardData();
    loadExpiryAlerts();
  }, [loadDashboardData, loadExpiryAlerts]);

  // Reload dashboard data when selected branch changes
  useEffect(() => {
    if (selectedBranchId) {
      loadDashboardData();
    }
  }, [selectedBranchId, loadDashboardData]);

  // Reload expiry alerts when branch selection changes
  useEffect(() => {
    loadExpiryAlerts();
  }, [selectedBranchId, selectedCompanyId, loadExpiryAlerts]);

  // Filter data based on selected branch
  const filteredData = useMemo(() => {
    if (!selectedBranchId) {
      return {
        sales: realSalesData,
        products: realProductsData,
        users: allUsers,
        revenue: realRevenue,
        totalSales: realTotalSales
      };
    }

    const filteredSales = realSalesData.filter(sale => sale.branchId === selectedBranchId);
    const filteredProducts = realProductsData.filter(product => product.branchId === selectedBranchId);
    const filteredUsers = allUsers.filter(user => user.branchId === selectedBranchId);
    const filteredRevenue = filteredSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const filteredTotalSales = filteredSales.length;

    return {
      sales: filteredSales,
      products: filteredProducts,
      users: filteredUsers,
      revenue: filteredRevenue,
      totalSales: filteredTotalSales
    };
  }, [selectedBranchId, realSalesData, realProductsData, allUsers, realRevenue, realTotalSales]);

  // Filter branches based on selected company
  const filteredBranches = useMemo(() => {
    if (!selectedCompanyId) {
      return allBranches;
    }
    return allBranches.filter(branch => branch.companyId === selectedCompanyId);
  }, [selectedCompanyId, allBranches]);

  // selectedBranch is now provided by AdminContext

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PK', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const getTimeAgo = useCallback((dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} days ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks} weeks ago`;
  }, []);

  const handleBranchClick = useCallback(async (branch: any) => {
    // Prevent multiple calls if already loading
    if (loading) return;

    // Validate branch has an ID
    if (!branch || !branch.id) {
      console.error('Invalid branch data:', branch);
      setError('Invalid branch data');
      return;
    }

    try {
      setSelectedBranch(branch);
      setLoading(true);

      // Load branch-specific data
      const [dashboardResponse, lowStockResponse, customersResponse] = await Promise.all([
        apiService.getDashboardStats(branch.id),
        apiService.getProducts({ branchId: branch.id, lowStock: true, limit: 50 }),
        apiService.getCustomers({ branchId: branch.id, limit: 10 })
      ]);

      if (dashboardResponse.success && dashboardResponse.data) {
        setBranchDetails({
          ...dashboardResponse.data,
          lowStockProducts: lowStockResponse.success ? lowStockResponse.data.products : [],
          recentCustomers: customersResponse.success ? customersResponse.data.customers : [],
          branchInfo: branch
        });
        setShowBranchDetails(true);
      }
    } catch (err) {
      console.error('Error loading branch details:', err);
      setError('Failed to load branch details');
      // Don't show branch details if there's an error
      setShowBranchDetails(false);
    } finally {
      setLoading(false);
    }
  }, [loading]); // Only depends on loading state

  // All hooks must be called before any conditional returns
  const adminStats = useMemo(() => [
    {
      title: selectedBranchId ? `${globalSelectedBranch?.name} Revenue` : "Total Revenue",
      value: formatCurrency(filteredData.revenue || 0),
      change: selectedBranchId ? "Branch Data" : "All Data",
      icon: DollarSign,
      trend: "up",
      trendValue: "+12.5%",
      description: "vs last month"
    },
    {
      title: selectedBranchId ? `${globalSelectedBranch?.name} Sales` : "Total Sales",
      value: filteredData.totalSales.toString(),
      change: selectedBranchId ? "Branch Data" : "All Data",
      icon: ShoppingCart,
      trend: "up",
      trendValue: "+8.2%",
      description: "vs last month"
    },
    {
      title: selectedBranchId ? `${globalSelectedBranch?.name} Products` : "Total Products",
      value: filteredData.products.length.toString(),
      change: selectedBranchId ? "Branch Data" : "All Data",
      icon: Package,
      trend: "up",
      trendValue: "+5.1%",
      description: "vs last month"
    },
    {
      title: currentUser?.role === 'ADMIN' ? "All My Branches" : "Total Branches",
      value: allBranches.length.toString(),
      change: "Real Data",
      icon: Building2,
      trend: "up",
      trendValue: "+2.0%",
      description: "vs last month"
    },
    {
      title: selectedBranchId ? `${globalSelectedBranch?.name} Users` : (currentUser?.role === 'ADMIN' ? "All My Users" : "Total Users"),
      value: selectedBranchId ? filteredData.users.length.toString() : allUsers.length.toString(),
      change: selectedBranchId ? "Branch Data" : "All Data",
      icon: Users,
      trend: "up",
      trendValue: "+15.3%",
      description: "vs last month"
    }
  ], [filteredData.revenue, filteredData.totalSales, filteredData.products.length, filteredData.users.length, allBranches.length, allUsers.length, currentUser?.role, selectedBranchId, globalSelectedBranch?.name, formatCurrency]);

  // Memoize date/time formatting to prevent unnecessary re-renders
  const formattedDateTime = useMemo(() => ({
    date: currentDateTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }),
    time: currentDateTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }), [currentDateTime]);

  // Memoize event handlers to prevent re-renders
  const handleShowAllRecentSales = useCallback(() => {
    setShowAllRecentSales(!showAllRecentSales);
  }, [showAllRecentSales]);

  const handleShowAllLowStock = useCallback(() => {
    setShowAllLowStock(!showAllLowStock);
  }, [showAllLowStock]);

  const handleShowAllBranches = useCallback(() => {
    setShowAllBranches(!showAllBranches);
  }, [showAllBranches]);

  const handleShowAllUsers = useCallback(() => {
    setShowAllUsers(!showAllUsers);
  }, [showAllUsers]);

  const handleCloseBranchDetails = useCallback(() => {
    setShowBranchDetails(false);
  }, []);

  const handleGoToBranches = useCallback(() => {
    navigate('/admin/branches');
  }, [navigate]);

  const handleGoToUsers = useCallback(() => {
    navigate('/admin/users');
  }, [navigate]);

  const handleBranchSelect = useCallback(async (branchId: string | null) => {
    setIsLoading(true);
    setSelectedBranchId(branchId);
    setIsBranchDropdownOpen(false);

    // Simulate loading for better UX
    await new Promise(resolve => setTimeout(resolve, 2500));
    setIsLoading(false);
  }, [setSelectedBranchId]);

  const handleCompanySelect = useCallback(async (companyId: string | null) => {
    setIsLoading(true);

    // Use AdminContext methods for persistence
    setSelectedCompanyId(companyId);
    setSelectedBranchId(null); // Reset branch selection when company changes

    // Find the selected company
    const selectedCompany = companyId ? allCompanies.find(c => c.id === companyId) : null;
    setGlobalSelectedCompany(selectedCompany);

    // Simulate loading for better UX
    await new Promise(resolve => setTimeout(resolve, 2500));
    setIsLoading(false);
  }, [allCompanies, setSelectedCompanyId, setSelectedBranchId]);

  const handleToggleBranchSummary = useCallback(() => {
    setIsBranchSummaryCollapsed(!isBranchSummaryCollapsed);
  }, [isBranchSummaryCollapsed]);

  // Conditional returns after all hooks
  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadDashboardData}>Retry</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background rounded-[20px] min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {currentUser?.role === 'ADMIN' ? 'Admin Dashboard' : 'Super Admin Dashboard'}
          </h1>
          <p className="text-muted-foreground text-sm mt-[5pxf]">
            {selectedBranchId
              ? `Overview of ${globalSelectedBranch?.name} branch operations`
              : currentUser?.role === 'ADMIN'
                ? 'Overview of all your branches, revenue, users, and products'
                : 'Complete overview of all pharmacy operations'
            }
          </p>
        </div>
        <div className="flex items-center space-x-4">
        {/* Company Selector */}
        {/* <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={false}
              className="w-48 justify-between bg-white border border-gray-300 hover:bg-gray-50"
            >
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4" />
                <span className="truncate">
                  {selectedCompanyId
                    ? globalSelectedCompany?.name
                    : "All Companies"
                  }
                </span>
              </div>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 bg-white border border-gray-200 shadow-lg">
            <Command>
              <CommandInput placeholder="Search companies..." />
              <CommandList>
                <CommandEmpty>No companies found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all-companies"
                    onSelect={() => handleCompanySelect(null)}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>All Companies</span>
                    {!selectedCompanyId && <CheckCircle className="ml-auto h-4 w-4" />}
                  </CommandItem>
                  {allCompanies.map((company) => (
                    <CommandItem
                      key={company.id}
                      value={company.name}
                      onSelect={() => handleCompanySelect(company.id)}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      <span className="truncate">{company.name}</span>
                      {selectedCompanyId === company.id && <CheckCircle className="ml-auto h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover> */}

        {/* Branch Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={false}
              className="w-48 justify-between bg-white border border-gray-300 hover:bg-gray-50"
            >
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4" />
                <span className="truncate">
                  {selectedBranchId
                    ? globalSelectedBranch?.name
                    : "All Branches"
                  }
                </span>
              </div>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 bg-white border border-gray-200 shadow-lg">
            <Command>
              <CommandInput placeholder="Search branches..." />
              <CommandList>
                <CommandEmpty>No branches found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="all-branches"
                    onSelect={() => handleBranchSelect(null)}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <span>All Branches</span>
                    {!selectedBranchId && <CheckCircle className="ml-auto h-4 w-4" />}
                  </CommandItem>
                  {filteredBranches.map((branch) => (
                    <CommandItem
                      key={branch.id}
                      value={branch.name}
                      onSelect={() => handleBranchSelect(branch.id)}
                    >
                      <Building2 className="mr-2 h-4 w-4" />
                      <span className="truncate">{branch.name}</span>
                      {selectedBranchId === branch.id && <CheckCircle className="ml-auto h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Digital Time Display */}
        <div className="w-full sm:w-80">
          <div className="text-right mb-[10px]">
            <p className="text-sm font-medium text-foreground">
              {currentDateTime.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            <div className="text-sm font-bold text-[#0C2C8A]">
              {currentDateTime.toLocaleTimeString('en-US', {
                hour12: true,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          </div>
        </div>
      </div>

      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0C2C8A]"></div>
            <p className="text-gray-700 font-medium">Loading data...</p>
          </div>
        </div>
      )}

      {/* Company and Branch Selectors */}

      {/* Admin Stats Grid - Tab-like Behavior */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {adminStats.map((stat, index) => {
          const IconComponent = stat.icon;
          const isActive = activeStatTab === index;

          return (
            <Card
              key={index}
              className="bg-white border border-[#0C2C8A] shadow-md"
              onClick={() => {}} // No click action - only first card stays active
            >
              <CardContent className="p-6">
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-600">
                    {stat.title}
                  </h3>
                  <p className="text-2xl font-bold mb-3 text-gray-900">
                    {stat.value}
                  </p>

                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-[#0C2C8A]" />
                    <span className="text-sm font-medium text-[#0C2C8A]">
                      {stat.trendValue}
                    </span>
                    <span className="text-xs text-gray-500">
                      {stat.description}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Expiry Alerts Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Expiry Alerts
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAllExpiryAlerts(!showAllExpiryAlerts)}
              className="text-sm"
            >
              {showAllExpiryAlerts ? 'Show Less' : 'Show All'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Expired Items */}
            {expiredBatches.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-red-700 flex items-center gap-2">
                    <X className="w-4 h-4" />
                    Expired Items ({expiredBatches.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(showAllExpiryAlerts ? expiredBatches : expiredBatches.slice(0, 3)).map((batch: any, index: number) => (
                    <div key={index} className="p-3 bg-red-100 rounded-lg border border-red-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-red-800">{batch.product?.name || 'Unknown Product'}</p>
                          <p className="text-sm text-red-600">Batch: {batch.batchNo}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-red-800">
                            Expired {Math.ceil((new Date().getTime() - new Date(batch.expireDate).getTime()) / (1000 * 60 * 60 * 24))} days ago
                          </p>
                          <p className="text-xs text-red-600">
                            {new Date(batch.expireDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {expiredBatches.length > 3 && !showAllExpiryAlerts && (
                    <p className="text-sm text-red-600 text-center">
                      +{expiredBatches.length - 3} more expired items
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Near Expiry Items */}
            {nearExpiryBatches.length > 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-orange-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Near Expiry ({nearExpiryBatches.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(showAllExpiryAlerts ? nearExpiryBatches : nearExpiryBatches.slice(0, 3)).map((batch: any, index: number) => {
                    const daysUntilExpiry = Math.ceil((new Date(batch.expireDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={index} className="p-3 bg-orange-100 rounded-lg border border-orange-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-orange-800">{batch.product?.name || 'Unknown Product'}</p>
                            <p className="text-sm text-orange-600">Batch: {batch.batchNo}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-orange-800">
                              {daysUntilExpiry > 0 ? `${daysUntilExpiry} days left` : 'Expires today'}
                            </p>
                            <p className="text-xs text-orange-600">
                              {new Date(batch.expireDate).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {nearExpiryBatches.length > 3 && !showAllExpiryAlerts && (
                    <p className="text-sm text-orange-600 text-center">
                      +{nearExpiryBatches.length - 3} more near expiry items
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* No Alerts Message */}
          {expiredBatches.length === 0 && nearExpiryBatches.length === 0 && (
            <div className="text-center py-4">
              <div className="flex flex-col items-center space-y-1">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <p className="text-base font-medium text-gray-700">No Expiry Alerts</p>
                <p className="text-xs text-gray-500">All products are within their expiry dates</p>
              </div>
            </div>
          )}
        </div>


      {/* Recent Sales and Low Stock Alert in one row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales - Takes 2/3 of the width */}
        <Card className="lg:col-span-2 shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-[#0C2C8A]" />
              <span>Recent Sales</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredData.sales?.length > 0 ? (
                <>
                  {(showAllRecentSales ? filteredData.sales : filteredData.sales.slice(0, 4)).map((sale: any, index: number) => (
                    <div key={index} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-foreground text-sm">
                          {sale.customer?.name || 'Walk-in Customer'}
                        </p>
                        <Badge variant="outline" className="text-xs">
                          {formatCurrency(sale.totalAmount)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>Branch: {sale.branch?.name}</p>
                        <p>Cashier: {sale.user?.name}</p>
                        <p>Time: {formatDate(sale.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                  {filteredData.sales.length > 4 && (
                    <Button
                      variant="outline"
                      className="w-full mt-3"
                      onClick={handleShowAllRecentSales}
                    >
                      {showAllRecentSales ? 'Show Less' : `View More (${filteredData.sales.length - 4} more)`}
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  {selectedBranchId ? `No recent sales found for ${globalSelectedBranch?.name}` : 'No recent sales found'}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert - Takes 1/3 of the width */}
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              <span>Low Stock Alert</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const lowStockProducts = filteredData.products.filter((product: any) =>
                  product.stock <= product.minStock
                );

                return lowStockProducts.length > 0 ? (
                  <>
                    {(showAllLowStock ? lowStockProducts : lowStockProducts.slice(0, 4)).map((product: any, index: number) => (
                      <div key={index} className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-foreground text-sm">{product.name}</p>
                          <Badge variant="outline" className="text-xs bg-warning/20 text-warning border-warning/30">
                            {product.stock} {product.unitType}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>Branch: {product.branch?.name}</p>
                          <p>Min Stock: {product.minStock} {product.unitType}</p>
                        </div>
                      </div>
                    ))}
                    {lowStockProducts.length > 4 && (
                      <Button
                        variant="outline"
                        className="w-full mt-3"
                        onClick={handleShowAllLowStock}
                      >
                        {showAllLowStock ? 'Show Less' : `View More (${lowStockProducts.length - 4} more)`}
                      </Button>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-success" />
                    </div>
                    <p className="text-success font-medium text-lg">
                      {selectedBranchId ? `All products in ${globalSelectedBranch?.name} are well stocked!` : 'All products are well stocked!'}
                    </p>
                    <p className="text-muted-foreground text-sm mt-2">
                      {selectedBranchId ? 'No low stock alerts for this branch' : 'No low stock alerts at this time'}
                    </p>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* All Branches Overview */}
        <Card className="lg:col-span-2 shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#0C2C8A]" />
                <span>
                  {currentUser?.role === 'ADMIN' ? 'All My Branches' : 'All Branches'} ({allBranches.length})
                </span>
              </div>
              {currentUser?.role !== 'ADMIN' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShowAllBranches}
                >
                  {showAllBranches ? 'Show Less' : 'Show All'}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(currentUser?.role === 'ADMIN' || showAllBranches ? allBranches : allBranches.slice(0, 4)).map((branch: any, index: number) => (
                <div
                  key={index}
                  className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleBranchClick(branch)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#0C2C8A]/10 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-[#0C2C8A]" />
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
                  <div className="text-xs text-muted-foreground flex items-center space-x-4">
                    <span>📞 {branch.phone}</span>
                    <span>📧 {branch.email}</span>
                    <span className="text-primary">Click for details</span>
                  </div>
                </div>
              ))}
              {allBranches.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No branches found</p>
              )}
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={handleGoToBranches}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Manage Branches
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* All Users Overview */}
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-[#0C2C8A]" />
                <span>
                  {currentUser?.role === 'ADMIN' ? 'All My Users' : 'All Users'} ({allUsers.length})
                </span>
              </div>
              {currentUser?.role !== 'ADMIN' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShowAllUsers}
                >
                  {showAllUsers ? 'Show Less' : 'Show All'}
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(currentUser?.role === 'ADMIN' || showAllUsers ? allUsers : allUsers.slice(0, 4)).map((user: any, index: number) => (
                <div key={index} className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-[#0C2C8A]/10 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-[#0C2C8A]">
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
                            user.role === 'ADMIN' ? "bg-[#0C2C8A]/10 text-[#0C2C8A] border-[#0C2C8A]/20" :
                              user.role === 'MANAGER' ? "bg-[#0C2C8A]/10 text-[#0C2C8A] border-[#0C2C8A]/20" :
                                "bg-[#0C2C8A]/10 text-[#0C2C8A] border-[#0C2C8A]/20"
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
                  <div className="text-xs text-muted-foreground">
                    <p>📧 {user.email}</p>
                    <p>🏢 {user.branch?.name || 'No Branch'}</p>
                  </div>
                </div>
              ))}
              {allUsers.length === 0 && (
                <p className="text-muted-foreground text-center py-4">No users found</p>
              )}
              <Button
                variant="outline"
                className="w-full"
                size="sm"
                onClick={handleGoToUsers}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Manage Users
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>




      {/* Products Table */}
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-[#0C2C8A]" />
            <span>
              {selectedBranchId
                ? `${globalSelectedBranch?.name} Products`
                : 'Products From All Branches'
              }
            </span>
            <Badge variant="secondary" className="ml-2">
              {filteredData.products.length} {filteredData.products.length === 1 ? 'Product' : 'Products'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">#</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product Name</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Branch</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Price</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.products.length > 0 ? (
                  filteredData.products.map((product: any, index: number) => (
                    <tr key={product.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-4 px-4">
                        <div className="w-8 h-8 bg-[#0C2C8A]/10 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-[#0C2C8A]">#{index + 1}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-foreground">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.description || 'No description'}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="outline" className="text-xs">
                          {product.branch?.name || 'Unknown Branch'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm font-medium ${product.stock <= product.minStock ? 'text-red-600' : 'text-green-600'
                            }`}>
                            {product.stock} {product.unitType}
                          </span>
                          {product.stock <= product.minStock && (
                            <Badge variant="destructive" className="text-xs bg-[#FBE4C8] border-[1px] border-[#F59F0B] ">Low Stock</Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-muted-foreground">
                        {formatCurrency(product.sellingPrice)}
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant="secondary" className="text-xs">
                          {product.category?.name || 'Uncategorized'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                      {selectedBranchId
                        ? `No products found for ${globalSelectedBranch?.name}`
                        : 'No products data available'
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>


      {/* Branch Details Modal */}
      {showBranchDetails && branchDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{branchDetails.branchInfo?.name} Dashboard</h2>
                  <p className="text-muted-foreground">Branch-specific overview and analytics</p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCloseBranchDetails}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Branch Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="shadow-soft border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                        <p className="text-xl font-bold text-foreground">{formatCurrency(branchDetails.totalStats?.revenue || 0)}</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-[#0C2C8A]" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-soft border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                        <p className="text-xl font-bold text-foreground">{(branchDetails.totalStats?.sales || 0).toLocaleString()}</p>
                      </div>
                      <ShoppingCart className="w-8 h-8 text-accent" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-soft border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Products</p>
                        <p className="text-xl font-bold text-foreground">{(branchDetails.inventory?.totalProducts || 0).toLocaleString()}</p>
                      </div>
                      <Package className="w-8 h-8 text-success" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-soft border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Customers</p>
                        <p className="text-xl font-bold text-foreground">{(branchDetails.customers?.total || 0).toLocaleString()}</p>
                      </div>
                      <Users className="w-8 h-8 text-warning" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Sales */}
                <Card className="shadow-soft border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <ShoppingCart className="w-5 h-5 text-[#0C2C8A]" />
                      <span>Recent Sales</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {branchDetails.recentSales?.length > 0 ? (
                        branchDetails.recentSales.map((sale: any, index: number) => (
                          <div key={index} className="p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-foreground text-sm">
                                {sale.customer?.name || 'Walk-in Customer'}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {formatCurrency(sale.totalAmount)}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <p>Cashier: {sale.user?.name}</p>
                              <p>Time: {formatDate(sale.createdAt)}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No recent sales found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Customers */}
                <Card className="shadow-soft border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Users className="w-5 h-5 text-[#0C2C8A]" />
                      <span>Recent Customers</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {branchDetails.recentCustomers?.length > 0 ? (
                        branchDetails.recentCustomers.map((customer: any, index: number) => (
                          <div key={index} className="p-3 bg-muted/30 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-foreground text-sm">{customer.name}</p>
                              <Badge variant="outline" className="text-xs">
                                {formatCurrency(customer.totalPurchases || 0)}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <p>Phone: {customer.phone}</p>
                              <p>Points: {customer.loyaltyPoints || 0}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-center py-4">No customers found</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Low Stock Alert */}
              <Card className="shadow-soft border-0">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    <span>Low Stock Alert - {branchDetails.branchInfo?.name}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {branchDetails.lowStockProducts?.length > 0 ? (
                      branchDetails.lowStockProducts.map((product: any, index: number) => (
                        <div key={index} className="p-3 bg-warning/10 rounded-lg border border-warning/20">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-foreground text-sm">{product.name}</p>
                            <Badge variant="outline" className="text-xs bg-warning/20 text-warning border-warning/30">
                              {product.stock} {product.unitType}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <p>Min Stock: {product.minStock} {product.unitType}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="w-8 h-8 text-success" />
                        </div>
                        <p className="text-success font-medium text-lg">All products are well stocked!</p>
                        <p className="text-muted-foreground text-sm mt-2">No low stock alerts for this branch</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
