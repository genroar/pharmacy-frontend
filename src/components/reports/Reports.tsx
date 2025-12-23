import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Star,
  RefreshCw,
  Activity,
  Building2,
  Eye,
  EyeOff,
  Clock,
  Target,
  Gauge
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import ProfitSalesOverview from "./ProfitSalesOverview";
import SimpleReports from "./SimpleReports";
import TimePeriodReports from "./TimePeriodReports";
import RealTimeSalesUpdates from "./RealTimeSalesUpdates";

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

const Reports = () => {
  const { user, logout } = useAuth();
  const { selectedBranchId, selectedBranch } = useAdmin();
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [selectedReport, setSelectedReport] = useState("sales");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [previousPeriodData, setPreviousPeriodData] = useState<any>(null);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [salesByPaymentMethod, setSalesByPaymentMethod] = useState<any[]>([]);

  // Multi-branch functionality
  const [allBranches, setAllBranches] = useState<any[]>([]);
  const [showAllBranches, setShowAllBranches] = useState(false);
  const [realSalesData, setRealSalesData] = useState<any[]>([]);
  const [realProductsData, setRealProductsData] = useState<any[]>([]);
  const [realUsersData, setRealUsersData] = useState<any[]>([]);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [chartData, setChartData] = useState<any[]>([]);
  const [topProductsData, setTopProductsData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [customerGrowthData, setCustomerGrowthData] = useState<any[]>([]);
  const [profitExpenseData, setProfitExpenseData] = useState<any[]>([]);
  const [profitMargin, setProfitMargin] = useState(0);
  const [nearExpiryBatches, setNearExpiryBatches] = useState<any[]>([]);
  const [expiredBatches, setExpiredBatches] = useState<any[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Export functionality for managers
  const exportReports = async () => {
    try {
      const activeSales = realSalesData.filter((sale: any) => sale.status !== 'REFUNDED');
      const csvData = [
        ['Report Type', 'Period', 'Revenue', 'Sales Count', 'Products', 'Staff'],
        ['Sales Report', selectedPeriod, formatCurrency(activeSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0)), activeSales.length.toString(), realProductsData.length.toString(), realUsersData.length.toString()],
        ['Branch Performance', 'All Branches', formatCurrency(allBranches.reduce((sum, branch) => sum + (branch.revenue || 0), 0)), allBranches.reduce((sum, branch) => sum + (branch.salesCount || 0), 0).toString(), allBranches.reduce((sum, branch) => sum + (branch.productsCount || 0), 0).toString(), allBranches.reduce((sum, branch) => sum + (branch.usersCount || 0), 0).toString()]
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reports_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting reports:', error);
    }
  };

  // Refresh all data functionality
  const refreshAllData = async () => {
    setLoading(true);
    try {
      await loadDashboardData();
      await loadReportsData();
      console.log('All data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const periods = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "year", label: "This Year" }
  ];

  // Helper function to get date range based on selected period
  const getDateRange = useCallback((period: string) => {
    const now = new Date();
    let start: Date, end: Date;

    switch (period) {
      case 'today':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'week':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
        startOfWeek.setHours(0, 0, 0, 0);
        start = startOfWeek;
        end = new Date(startOfWeek);
        end.setDate(startOfWeek.getDate() + 6);
        end.setHours(23, 59, 59);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  }, []);

  const reportTypes = [
    { id: "sales", label: "Sales Report", icon: DollarSign },
    { id: "inventory", label: "Inventory Report", icon: Package },
    { id: "customers", label: "Customer Report", icon: Users },
    { id: "products", label: "Product Performance", icon: BarChart3 }
  ];


  // Memoize event handlers
  const handleShowAllBranches = useCallback(() => {
    setShowAllBranches(!showAllBranches);
  }, [showAllBranches]);

  const handleBranchClick = useCallback((branchId: string) => {
    // This function is no longer needed as branch selection is handled by AdminContext
    console.log('Branch selection is now handled by AdminContext');
  }, []);

  // Date/time formatting
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

  // Currency formatting
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }, []);

  const loadBranchesAndRealData = useCallback(async () => {
    try {
      // Check if user is properly authenticated
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in.');
        return;
      }

      // Determine which branch to load reports from
      let branchId: string | undefined;

      if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
        // Admin/SuperAdmin users can see reports from selected branch or all branches
        if (selectedBranchId) {
          branchId = selectedBranchId;
          console.log('Admin selected specific branch for reports:', selectedBranch?.name);
        } else {
          console.log('Admin viewing all branches - loading all reports');
        }
      } else if (user?.role === 'MANAGER') {
        // Manager users can only see reports from their assigned branch
        branchId = user?.branchId;
        if (!branchId) {
          console.error('❌ Manager has no assigned branch');
          setError('No branch assigned to this manager');
          return;
        }
        console.log('Manager viewing their assigned branch for reports:', branchId);
      } else {
        // Regular users see only their branch reports
        branchId = user?.branchId;
        if (!branchId) {
          const branchesResponse = await apiService.getBranches();
          if (branchesResponse.success && branchesResponse.data?.branches?.length > 0) {
            branchId = branchesResponse.data.branches[0].id;
          }
        }
        console.log('Regular user branch for reports:', branchId);
      }

      // Load all branches, sales, products, and users data in parallel
      const [branchesResponse, salesResponse, productsResponse, usersResponse] = await Promise.all([
        apiService.getBranches(),
        apiService.getSales({ page: 1, limit: 200, branchId: branchId || undefined }), // Load more sales data
        apiService.getProducts({ page: 1, limit: 200, branchId: branchId || undefined }), // Load more products data
        apiService.getUsers({ page: 1, limit: 100 })
      ]);

      // Process branches data
      if (branchesResponse.success && branchesResponse.data) {
        const branchesData = Array.isArray(branchesResponse.data) ? branchesResponse.data : branchesResponse.data.branches;

        // For managers, only show their assigned branch
        if (user?.role === 'MANAGER' && user?.branchId) {
          const managerBranch = branchesData.find((branch: any) => branch.id === user.branchId);
          setAllBranches(managerBranch ? [managerBranch] : []);
          console.log('🏢 Manager can only see their assigned branch:', managerBranch?.name);
        } else {
          setAllBranches(branchesData);
        }
      }

      // Process real sales data
      if (salesResponse.success && salesResponse.data) {
        const sales = salesResponse.data.sales || [];
        setRealSalesData(sales);
      }

      // Process real products data
      if (productsResponse.success && productsResponse.data) {
        const products = productsResponse.data.products || [];
        setRealProductsData(products);
      }

      // Process real users data
      if (usersResponse.success && usersResponse.data) {
        const users = usersResponse.data.users || [];
        setRealUsersData(users);
      }
    } catch (err) {
      console.error('Error loading branches and real data:', err);
      setError('Failed to load branches and real data');
    }
  }, []);

  // Load branches and real data on component mount
  useEffect(() => {
    loadBranchesAndRealData();
  }, [loadBranchesAndRealData, selectedBranchId]);

  // Date/time timer - optimized to prevent re-renders
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

  const loadReportData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Determine which branch to load reports from
      let branchId: string | undefined;

      if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
        // Admin/SuperAdmin users can see reports from selected branch or all branches
        if (selectedBranchId) {
          branchId = selectedBranchId;
          console.log('Admin selected specific branch for reports:', selectedBranch?.name);
        } else {
          console.log('Admin viewing all branches - loading all reports');
        }
      } else if (user?.role === 'MANAGER') {
        // Manager users can only see reports from their assigned branch
        branchId = user?.branchId;
        if (!branchId) {
          console.error('❌ Manager has no assigned branch');
          setError('No branch assigned to this manager');
          return;
        }
        console.log('Manager viewing their assigned branch for reports:', branchId);
      } else {
        // Regular users see only their branch reports
        branchId = user?.branchId;
        if (!branchId) {
          const branchesResponse = await apiService.getBranches();
          if (branchesResponse.success && branchesResponse.data?.branches?.length > 0) {
            branchId = branchesResponse.data.branches[0].id;
          }
        }
        console.log('Regular user branch for reports:', branchId);
      }

      // Calculate date range based on selected period
      const now = new Date();
      let startDate = '';
      let endDate = '';
      let previousStartDate = '';
      let previousEndDate = '';

      switch (selectedPeriod) {
        case 'today':
          // Show today's sales
          startDate = now.toISOString().split('T')[0];
          endDate = now.toISOString().split('T')[0];
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          previousStartDate = yesterday.toISOString().split('T')[0];
          previousEndDate = yesterday.toISOString().split('T')[0];
          break;
        case 'week':
          // Show from beginning of current week to today
          const startOfWeek = new Date(now);
          const dayOfWeek = startOfWeek.getDay();
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0, Sunday = 6
          startOfWeek.setDate(startOfWeek.getDate() - daysToSubtract);
          startOfWeek.setHours(0, 0, 0, 0);
          startDate = startOfWeek.toISOString().split('T')[0];
          endDate = now.toISOString().split('T')[0];

          // Previous week (same days of previous week)
          const previousWeekStart = new Date(startOfWeek);
          previousWeekStart.setDate(previousWeekStart.getDate() - 7);
          const previousWeekEnd = new Date(previousWeekStart);
          previousWeekEnd.setDate(previousWeekEnd.getDate() + 6);
          previousStartDate = previousWeekStart.toISOString().split('T')[0];
          previousEndDate = previousWeekEnd.toISOString().split('T')[0];
          break;
        case 'month':
          // Show from beginning of current month to today
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          endDate = now.toISOString().split('T')[0];

          // Previous month (same period of previous month)
          const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          previousStartDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
          const lastDayOfPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
          previousEndDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(lastDayOfPrevMonth).padStart(2, '0')}`;
          break;
        case 'year':
          // Show from beginning of current year to today
          startDate = `${now.getFullYear()}-01-01`;
          endDate = now.toISOString().split('T')[0];

          // Previous year (same period of previous year)
          previousStartDate = `${now.getFullYear() - 1}-01-01`;
          previousEndDate = `${now.getFullYear() - 1}-12-31`;
          break;
      }

      console.log('📅 Date range calculation:', {
        selectedPeriod,
        startDate,
        endDate,
        previousStartDate,
        previousEndDate
      });

      console.log('🔍 API call parameters:', {
        selectedReport,
        startDate,
        endDate,
        branchId,
        groupBy: (selectedPeriod === 'week' ? 'week' : selectedPeriod === 'month' ? 'month' : selectedPeriod === 'year' ? 'year' : 'day')
      });

      // Load current period data

      let response;
      switch (selectedReport) {
        case 'sales':
          const salesParams = {
            startDate,
            endDate,
            branchId: branchId || "",
            groupBy: (selectedPeriod === 'week' ? 'week' : selectedPeriod === 'month' ? 'month' : selectedPeriod === 'year' ? 'year' : 'day') as 'day' | 'week' | 'month' | 'year',
            period: selectedPeriod as 'today' | 'week' | 'month' | 'year' // Pass period for backend to handle 'today' hourly grouping
          };
          response = await apiService.getSalesReport(salesParams);
          break;
        case 'inventory':
          response = await apiService.getInventoryReport({
            branchId: branchId || ""
          });
          break;
        case 'customers':
          response = await apiService.getCustomerReport({
            startDate,
            endDate,
            branchId: branchId || ""
          });
          break;
        case 'products':
          response = await apiService.getProductPerformanceReport({
            startDate,
            endDate,
            branchId: branchId || ""
          });
          break;
        default:
          response = await apiService.getSalesReport({
            startDate,
            endDate,
            branchId: branchId || ""
          });
      }

      // Load previous period data for growth calculations (only for sales and customers)
      let previousResponse = null;
      if ((selectedReport === 'sales' || selectedReport === 'customers') && previousStartDate && previousEndDate) {
        try {
          if (selectedReport === 'sales') {
            previousResponse = await apiService.getSalesReport({
              startDate: previousStartDate,
              endDate: previousEndDate,
              branchId: branchId || "",
              groupBy: (selectedPeriod === 'week' ? 'week' : selectedPeriod === 'month' ? 'month' : selectedPeriod === 'year' ? 'year' : 'day') as 'day' | 'week' | 'month' | 'year',
              period: selectedPeriod as 'today' | 'week' | 'month' | 'year'
            });
          } else if (selectedReport === 'customers') {
            previousResponse = await apiService.getCustomerReport({
              startDate: previousStartDate,
              endDate: previousEndDate,
              branchId: branchId || ""
            });
          }
        } catch (err) {
          console.warn('Could not load previous period data:', err);
        }
      }

      if (response.success && response.data) {
        console.log('🔍 API Response received:', response.data);
        console.log('🔍 Summary data:', response.data.summary);
        console.log('🔍 Sales trend data:', response.data.salesTrend);
        setReportData(response.data);
        if (previousResponse?.success && previousResponse.data) {
          setPreviousPeriodData(previousResponse.data);
        }

        // Load additional data for sales report
        if (selectedReport === 'sales') {
          // Load top selling products
          try {
            const topProductsResponse = await apiService.getTopSellingProducts(branchId || '', 10);
            if (topProductsResponse.success && topProductsResponse.data) {
              setTopProducts(topProductsResponse.data);
            }
          } catch (err) {
            console.error('Error loading top products:', err);
          }

          // Load sales by payment method
          try {
            const paymentMethodResponse = await apiService.getSalesByPaymentMethod(branchId || '');
            if (paymentMethodResponse.success && paymentMethodResponse.data) {
              setSalesByPaymentMethod(paymentMethodResponse.data);
            }
          } catch (err) {
            console.error('Error loading sales by payment method:', err);
          }

          // Process all chart data from API response
          if (response.data?.salesTrend && Array.isArray(response.data.salesTrend) && response.data.salesTrend.length > 0) {
            console.log('📊 Processing sales trend data:', response.data.salesTrend.length, 'records');

            const processedSalesData = processSalesTrendData(response.data.salesTrend, selectedPeriod);
            console.log('📊 Processed sales data:', processedSalesData.length, 'points');
            setChartData(processedSalesData);

            const processedCustomerData = processCustomerGrowthData(response.data.salesTrend);
            console.log('📊 Processed customer growth data:', processedCustomerData.length, 'points');
            setCustomerGrowthData(processedCustomerData);

            const processedProfitData = processProfitExpenseData(response.data.salesTrend);
            console.log('📊 Processed profit/expense data:', processedProfitData.length, 'points');
            setProfitExpenseData(processedProfitData);

            const margin = calculateProfitMargin(response.data.salesTrend);
            console.log('📊 Profit margin:', margin, '%');
            setProfitMargin(margin);
          } else {
            console.log('⚠️ No sales trend data available or empty array');
            setChartData([]);
            setCustomerGrowthData([]);
            setProfitExpenseData([]);
            setProfitMargin(0);
          }

          // Process top products data
          if (response.data?.topProducts) {
            const processedTopProducts = processTopProductsData(response.data.topProducts);
            setTopProductsData(processedTopProducts);
          }
        }

        // Get product performance report for category data
        try {
          // Use a broader date range to ensure we get data
          const broadStartDate = '2025-01-01';
          const broadEndDate = '2025-12-31';

          console.log('Calling getProductPerformanceReport with:', {
            startDate: broadStartDate,
            endDate: broadEndDate,
            branchId: branchId || ''
          });

          const productPerformanceResponse = await apiService.getProductPerformanceReport({
            startDate: broadStartDate,
            endDate: broadEndDate,
            branchId: branchId || ''
          });

          console.log('Product Performance Response:', productPerformanceResponse);
          console.log('Category Performance Data:', productPerformanceResponse.data?.categoryPerformance);

          if (productPerformanceResponse.success && productPerformanceResponse.data?.categoryPerformance) {
            const processedCategory = processCategoryData(productPerformanceResponse.data.categoryPerformance);
            console.log('Processed Category Data:', processedCategory);
            setCategoryData(processedCategory);
          } else {
            console.log('No category performance data found in response');
          }
        } catch (err) {
          console.error('Error loading product performance report:', err);
        }
      } else {
        console.error('Report API failed:', response);
        setError('Failed to load report data: ' + (response.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error loading report data:', err);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod, selectedReport, selectedBranchId, user?.branchId]);

  // Load report data when period, report type, or selected branch changes
  useEffect(() => {
    loadReportData();

    // Test data for category chart
    const testCategoryData = [
      { name: 'Vitamins', value: 900, color: '#0c2c8a' },
      { name: 'Antibiotics', value: 720, color: '#3d6bb3' },
      { name: 'umair', value: 69, color: '#6d9eec' }
    ];
    setCategoryData(testCategoryData);
  }, [loadReportData]);

  // Auto-refresh when component becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadReportData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadReportData]);

  // Auto-refresh every 2 minutes for real-time updates (reduced frequency)
  useEffect(() => {
    const interval = setInterval(() => {
      loadReportData();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [selectedPeriod, selectedReport, loadReportData, selectedBranchId]);


  // Process sales trend data from API response
  const processSalesTrendData = useCallback((salesTrendData: any[], period: string) => {
    if (!salesTrendData || salesTrendData.length === 0) return [];

    let processedData: any[] = [];

    switch (period) {
      case 'today':
        // Group by hour
        const hourlyData: { [key: string]: { sales: number; revenue: number; hour: string } } = {};
        salesTrendData.forEach(item => {
          const saleDate = new Date(item.createdAt);
          const hour = saleDate.getHours();
          const hourKey = `${hour}:00`;

          if (!hourlyData[hourKey]) {
            hourlyData[hourKey] = { sales: 0, revenue: 0, hour: hourKey };
          }
          hourlyData[hourKey].sales += item._count?.id || 0;
          hourlyData[hourKey].revenue += item._sum?.totalAmount || 0;
        });
        processedData = Object.values(hourlyData).sort((a, b) => a.hour.localeCompare(b.hour));
        break;

      case 'week':
        // Group by day of week
        const weeklyData: { [key: string]: { sales: number; revenue: number; day: string } } = {};
        salesTrendData.forEach(item => {
          const saleDate = new Date(item.createdAt);
          const dayName = saleDate.toLocaleDateString('en-US', { weekday: 'short' });

          if (!weeklyData[dayName]) {
            weeklyData[dayName] = { sales: 0, revenue: 0, day: dayName };
          }
          weeklyData[dayName].sales += item._count?.id || 0;
          weeklyData[dayName].revenue += item._sum?.totalAmount || 0;
        });
        const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        processedData = dayOrder.map(day => weeklyData[day] || { sales: 0, revenue: 0, day });
        break;

      case 'month':
        // Group by day of month
        const monthlyData: { [key: string]: { sales: number; revenue: number; day: string } } = {};
        salesTrendData.forEach(item => {
          const saleDate = new Date(item.createdAt);
          const day = saleDate.getDate().toString();

          if (!monthlyData[day]) {
            monthlyData[day] = { sales: 0, revenue: 0, day };
          }
          monthlyData[day].sales += item._count?.id || 0;
          monthlyData[day].revenue += item._sum?.totalAmount || 0;
        });
        processedData = Object.values(monthlyData).sort((a, b) => parseInt(a.day) - parseInt(b.day));
        break;

      case 'year':
        // Group by month
        const yearlyData: { [key: string]: { sales: number; revenue: number; month: string } } = {};
        salesTrendData.forEach(item => {
          const saleDate = new Date(item.createdAt);
          const monthName = saleDate.toLocaleDateString('en-US', { month: 'short' });

          if (!yearlyData[monthName]) {
            yearlyData[monthName] = { sales: 0, revenue: 0, month: monthName };
          }
          yearlyData[monthName].sales += item._count?.id || 0;
          yearlyData[monthName].revenue += item._sum?.totalAmount || 0;
        });
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        processedData = monthOrder.map(month => yearlyData[month] || { sales: 0, revenue: 0, month });
        break;

      default:
        processedData = salesTrendData.map(item => ({
          sales: item._count?.id || 0,
          revenue: item._sum?.totalAmount || 0,
          date: new Date(item.createdAt).toLocaleDateString()
        }));
    }

    return processedData;
  }, []);

  // Process top selling products data from API response
  const processTopProductsData = useCallback((topProductsData: any[]) => {
    if (!topProductsData || topProductsData.length === 0) return [];

    // Sort by total quantity sold
    const sortedProducts = topProductsData
      .sort((a, b) => (b._sum?.quantity || 0) - (a._sum?.quantity || 0))
      .slice(0, 10)
      .map(item => ({
        name: item.product?.name || 'Unknown Product',
        sales: item._sum?.quantity || 0,
        revenue: item._sum?.totalPrice || 0
      }));

    return sortedProducts;
  }, []);

  // Process category sales data from API response
  const processCategoryData = useCallback((categoryPerformanceData: any[]) => {
    if (!categoryPerformanceData || categoryPerformanceData.length === 0) return [];

    const colors = ['#0c2c8a', '#3d6bb3', '#6d9eec', '#2c5aa0', '#4d7cc6', '#5d8dd9', '#7dafff', '#8bbfff'];

    const processedData = categoryPerformanceData.map((item, index) => ({
      name: item.category || 'Uncategorized',
      value: item.revenue || 0,
      color: colors[index % colors.length]
    }));

    return processedData.sort((a, b) => b.value - a.value);
  }, []);

  // Process customer growth data from sales trend
  const processCustomerGrowthData = useCallback((salesTrendData: any[]) => {
    if (!salesTrendData || salesTrendData.length === 0) return [];

    const monthlyData: { [key: string]: { customers: number; month: string } } = {};

    salesTrendData.forEach(item => {
      const saleDate = new Date(item.createdAt);
      const monthKey = saleDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { customers: 0, month: monthKey };
      }
      monthlyData[monthKey].customers += item._count?.id || 0;
    });

    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
  }, []);

  // Process profit vs expense data from sales trend
  const processProfitExpenseData = useCallback((salesTrendData: any[]) => {
    if (!salesTrendData || salesTrendData.length === 0) return [];

    const monthlyData: { [key: string]: { profit: number; expenses: number; month: string } } = {};

    salesTrendData.forEach(item => {
      const saleDate = new Date(item.createdAt);
      const monthKey = saleDate.toLocaleDateString('en-US', { month: 'short' });

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { profit: 0, expenses: 0, month: monthKey };
      }

      const revenue = item._sum?.totalAmount || 0;
      const cost = revenue * 0.7; // Assuming 30% profit margin
      const profit = revenue - cost;
      const expenses = cost * 0.2; // Assuming 20% operational expenses

      monthlyData[monthKey].profit += profit;
      monthlyData[monthKey].expenses += expenses;
    });

    const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthOrder.map(month => monthlyData[month] || { profit: 0, expenses: 0, month });
  }, []);

  // Calculate overall profit margin from sales trend
  const calculateProfitMargin = useCallback((salesTrendData: any[]) => {
    if (!salesTrendData || salesTrendData.length === 0) return 0;

    const totalRevenue = salesTrendData.reduce((sum, item) => sum + (item._sum?.totalAmount || 0), 0);
    const totalCost = totalRevenue * 0.7; // Assuming 30% profit margin
    const totalProfit = totalRevenue - totalCost;

    return totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  }, []);

  // Calculate growth percentage
  const calculateGrowth = useCallback((current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }, []);

  // Get current data based on selected report type
  const getCurrentData = useCallback(() => {
    if (!reportData) {
      return null;
    }

    switch (selectedReport) {
      case 'sales':
        const currentRevenue = reportData.summary?.totalRevenue || 0;
        const currentTransactions = reportData.summary?.totalSales || 0;
        const previousRevenue = previousPeriodData?.summary?.totalRevenue || 0;
        const previousTransactions = previousPeriodData?.summary?.totalSales || 0;


        return {
          revenue: currentRevenue,
          transactions: currentTransactions,
          customers: 0, // This would need to be calculated separately
          avgTransaction: currentTransactions > 0 ? currentRevenue / currentTransactions : 0,
          revenueGrowth: calculateGrowth(currentRevenue, previousRevenue),
          transactionGrowth: calculateGrowth(currentTransactions, previousTransactions)
        };
      case 'inventory':
        return {
          totalProducts: reportData.summary?.totalProducts || 0,
          totalStock: reportData.summary?.totalStock || 0,
          lowStockCount: reportData.summary?.lowStockCount || 0
        };
      case 'customers':
        const currentCustomers = reportData.summary?.totalCustomers || 0;
        const currentSpent = reportData.summary?.totalSpent || 0;
        const currentAvgSpent = reportData.summary?.averageSpent || 0;
        const previousCustomers = previousPeriodData?.summary?.totalCustomers || 0;
        const previousSpent = previousPeriodData?.summary?.totalSpent || 0;

        return {
          totalCustomers: currentCustomers,
          totalSpent: currentSpent,
          averageSpent: currentAvgSpent,
          loyaltyPoints: reportData.summary?.totalLoyaltyPoints || 0,
          customerGrowth: calculateGrowth(currentCustomers, previousCustomers),
          spendingGrowth: calculateGrowth(currentSpent, previousSpent)
        };
      case 'products':
        return {
          totalProducts: reportData.summary?.totalProducts || 0,
          topProduct: reportData.topProduct || null,
          avgRevenue: reportData.summary?.averageRevenue || 0,
          totalRevenue: reportData.summary?.totalRevenue || 0
        };
      default:
        return null;
    }
  }, [reportData, previousPeriodData, selectedReport, calculateGrowth]);

  const currentData = useMemo(() => getCurrentData(), [getCurrentData]);

  // Calculate branch-specific statistics (excluding REFUNDED sales)
  const getBranchStats = useCallback((branchId: string) => {
    const branchSales = realSalesData.filter((sale: any) => sale.branchId === branchId && sale.status !== 'REFUNDED');
    const branchProducts = realProductsData.filter((product: any) => product.branchId === branchId);
    const branchUsers = realUsersData.filter((user: any) => user.branchId === branchId);

    const revenue = branchSales.reduce((sum: number, sale: any) => sum + (sale.totalAmount || 0), 0);
    const transactions = branchSales.length;
    const products = branchProducts.length;
    const users = branchUsers.length;

    return {
      revenue,
      transactions,
      products,
      users,
      branchSales,
      branchProducts,
      branchUsers
    };
  }, [realSalesData, realProductsData, realUsersData]);






  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Reports & Analytics</h1>
            <div className="flex items-center text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <Activity className="w-3 h-3 mr-1 animate-pulse" />
              Live Data
            </div>
          </div>
          <p className="text-muted-foreground">
            {user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'MANAGER'
              ? 'Comprehensive insights across all your branches'
              : 'Real-time insights into your business performance'
            }
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Export and Advanced Analytics for Managers */}
          {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'MANAGER') && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => exportReports()}>
                <BarChart3 className="w-4 h-4 mr-2" />
                Export Data
              </Button>
              <Button variant="outline" size="sm" onClick={() => refreshAllData()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh All
              </Button>
            </div>
          )}
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">
              {formattedDateTime.date}
            </p>
            <p className="text-xs text-muted-foreground">
              {formattedDateTime.time}
            </p>
          </div>
        </div>
      </div>

      {/* All Branches Overview - Moved to Top */}
      {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && (
        <Card className="shadow-soft border border-[#0C2C8A]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#0c2c8a]" />
                <span>All Branches Overview</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {allBranches.length} Branches
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleShowAllBranches}
                >
                  {showAllBranches ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showAllBranches ? 'Hide Details' : 'Show Details'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Branch Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {formatCurrency(
                        realSalesData.filter((sale: any) => sale.status !== 'REFUNDED').reduce((sum: number, sale: any) => sum + (sale.totalAmount || 0), 0)
                      )}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Total Sales</p>
                    <p className="text-2xl font-bold text-green-900">
                      {realSalesData.length}
                    </p>
                  </div>
                  <ShoppingCart className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Total Products</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {realProductsData.length}
                    </p>
                  </div>
                  <Package className="w-8 h-8 text-purple-600" />
                </div>
              </div>

              <div className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Total Staff</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {realUsersData.length}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-orange-600" />
                </div>
              </div>
            </div>

            {/* Branch Details */}
            {showAllBranches && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Branch Performance Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allBranches.map((branch: any, index: number) => {
                    const branchSales = realSalesData.filter((sale: any) => sale.branchId === branch.id && sale.status !== 'REFUNDED');
                    const branchProducts = realProductsData.filter((product: any) => product.branchId === branch.id);
                    const branchUsers = realUsersData.filter((user: any) => user.branchId === branch.id);
                    const branchRevenue = branchSales.reduce((sum: number, sale: any) => sum + (sale.totalAmount || 0), 0);

                    return (
                      <div key={branch.id} className="p-4 bg-muted/30 rounded-lg border">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-foreground">{branch.name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {branch.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Address:</span>
                            <span className="text-foreground truncate ml-2">{branch.address}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Phone:</span>
                            <span className="text-foreground">{branch.phone}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue:</span>
                            <span className="text-foreground font-medium">{formatCurrency(branchRevenue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Sales:</span>
                            <span className="text-foreground">{branchSales.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Products:</span>
                            <span className="text-foreground">{branchProducts.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Staff:</span>
                            <span className="text-foreground">{branchUsers.length}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manager Branch Overview - Only for Managers */}
      {user?.role === 'MANAGER' && allBranches.length > 0 && (
        <Card className="shadow-soft border border-[#0C2C8A]">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-[#0c2c8a]" />
                <span>My Branch Overview</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="text-xs">
                  {allBranches.length} Branch
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAllBranches(!showAllBranches)}
                  className="text-xs"
                >
                  {showAllBranches ? 'Hide Details' : 'Show Details'}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Manager's Branch Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Total Revenue</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {formatCurrency(realSalesData.filter((sale: any) => sale.status !== 'REFUNDED').reduce((sum: number, sale: any) => sum + (sale.totalAmount || 0), 0))}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600">Total Sales</p>
                      <p className="text-2xl font-bold text-green-900">{realSalesData.length}</p>
                    </div>
                    <ShoppingCart className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-purple-600">Total Products</p>
                      <p className="text-2xl font-bold text-purple-900">{realProductsData.length}</p>
                    </div>
                    <Package className="w-8 h-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-orange-600">Total Staff</p>
                      <p className="text-2xl font-bold text-orange-900">{realUsersData.length}</p>
                    </div>
                    <Users className="w-8 h-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Manager's Branch Details */}
            {showAllBranches && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Branch Performance Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allBranches.map((branch: any, index: number) => {
                    const branchSales = realSalesData.filter((sale: any) => sale.branchId === branch.id && sale.status !== 'REFUNDED');
                    const branchProducts = realProductsData.filter((product: any) => product.branchId === branch.id);
                    const branchUsers = realUsersData.filter((user: any) => user.branchId === branch.id);
                    const branchRevenue = branchSales.reduce((sum: number, sale: any) => sum + (sale.totalAmount || 0), 0);

                    return (
                      <Card key={branch.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-foreground">{branch.name}</h4>
                              <Badge variant={branch.isActive ? "default" : "secondary"} className="text-xs">
                                {branch.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div><span className="text-muted-foreground">Address:</span> <span className="text-foreground">{branch.address || 'Not specified'}</span></div>
                              <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{branch.phone}</span></div>
                              <div><span className="text-muted-foreground">Revenue:</span> <span className="text-foreground font-semibold">{formatCurrency(branchRevenue)}</span></div>
                              <div><span className="text-muted-foreground">Sales:</span> <span className="text-foreground">{branchSales.length}</span></div>
                              <div><span className="text-muted-foreground">Products:</span> <span className="text-foreground">{branchProducts.length}</span></div>
                              <div><span className="text-muted-foreground">Staff:</span> <span className="text-foreground">{branchUsers.length}</span></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Period Selection */}
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[#0c2c8a]" />
            <span>Select Time Period</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <Button
                key={period.id}
                variant={selectedPeriod === period.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPeriod(period.id)}
                className={selectedPeriod === period.id
                  ? "text-white bg-[#0c2c8a] hover:bg-transparent hover:text-[#0c2c8a] border border-[#0c2c8a] hover:opacity-90"
                  : ""
                }
              >
                {period.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Charts Section */}
      <div className="space-y-6">
        {/* Row 1: Sales Trend & Profit vs Expenses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend (Area Chart) */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <LineChartIcon className="w-5 h-5 text-primary" />
                <span>Sales Trend - {periods.find(p => p.id === selectedPeriod)?.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ChartContainer
                  config={{
                    sales: {
                      label: "Sales Count",
                      color: "#0c2c8a",
                    },
                    revenue: {
                      label: "Revenue (PKR)",
                      color: "#153186",
                    },
                  }}
                  className="h-[300px]"
                >
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={selectedPeriod === 'today' ? 'hour' : selectedPeriod === 'week' ? 'day' : selectedPeriod === 'month' ? 'day' : 'month'}
                    />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stackId="1"
                      stroke="#0c2c8a"
                      fill="#0c2c8a"
                      fillOpacity={0.6}
                      name="Sales Count"
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stackId="2"
                      stroke="#153186"
                      fill="#153186"
                      fillOpacity={0.6}
                      name="Revenue (PKR)"
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No sales data available for the selected period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profit vs Expenses (Bar Chart) */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                <span>Profit vs Expenses</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profitExpenseData.length > 0 ? (
                <ChartContainer
                  config={{
                    profit: {
                      label: "Profit (PKR)",
                      color: "#0c2c8a",
                    },
                    expenses: {
                      label: "Expenses (PKR)",
                      color: "#EF4444",
                    },
                  }}
                  className="h-[300px]"
                >
                  <BarChart data={profitExpenseData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="profit" fill="#0c2c8a" name="Profit (PKR)" />
                    <Bar dataKey="expenses" fill="#EF4444" name="Expenses (PKR)" />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No profit/expense data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Top Selling Products & Customer Growth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Products (Horizontal Bar Chart) */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Star className="w-5 h-5 text-primary" />
                <span>Top Selling Products</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topProductsData.length > 0 ? (
                <ChartContainer
                  config={{
                    sales: {
                      label: "Quantity Sold",
                      color: "#0c2c8a",
                    },
                  }}
                  className="h-[300px]"
                >
                  <BarChart data={topProductsData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="sales" fill="#0c2c8a" name="Quantity Sold" />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No product data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Growth (Line Chart) */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary" />
                <span>Customer Growth Trend</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {customerGrowthData.length > 0 ? (
                <ChartContainer
                  config={{
                    customers: {
                      label: "Customers",
                      color: "#0c2c8a",
                    },
                  }}
                  className="h-[300px]"
                >
                  <LineChart data={customerGrowthData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="customers"
                      stroke="#0c2c8a"
                      strokeWidth={3}
                      dot={{ fill: "#0c2c8a", strokeWidth: 2, r: 4 }}
                      name="Customers"
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No customer growth data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Sales by Category & Profit Margin */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales by Category (Donut Chart) */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChartIcon className="w-5 h-5 text-primary" />
                <span>Sales Distribution by Category</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  value: {
                    label: "Revenue (PKR)",
                  },
                }}
                className="h-[300px]"
              >
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Profit Margin (Gauge Chart) */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Gauge className="w-5 h-5 text-primary" />
                <span>Overall Profit Margin</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex flex-col items-center justify-center">
                <div className="relative w-48 h-48">
                  {/* Circular Progress */}
                  <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
                    {/* Background Circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#E5E7EB"
                      strokeWidth="8"
                      fill="none"
                    />
                    {/* Progress Circle */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#0c2c8a"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - profitMargin / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>

                  {/* Center Text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-3xl font-bold text-[#3D6CB3]">{profitMargin}%</div>
                    <div className="text-sm text-muted-foreground">Profit Margin</div>
                  </div>
                </div>

                {/* Status Text */}
                <div className="mt-4 text-center">
                  <div className={`text-lg font-semibold ${
                    profitMargin >= 20 ? 'text-[#3D6CB3]' :
                    profitMargin >= 10 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {profitMargin >= 20 ? 'Excellent' :
                     profitMargin >= 10 ? 'Good' : 'Needs Improvement'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Target: 20% or higher
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Profit and Sales Overview */}
      {/* <SimpleReports /> */}


      {/* Loading State */}
      {loading && (
        <Card className="shadow-soft border-0">
          <CardContent className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading report data...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="shadow-soft border-0">
          <CardContent className="p-12 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadReportData} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Time Period Reports */}
      <TimePeriodReports
        selectedPeriod={selectedPeriod}
        selectedReport={selectedReport}
        reportData={reportData}
        previousPeriodData={previousPeriodData}
        loading={loading}
        error={error}
      />

      {/* Sales Trend Chart */}
      {/* {selectedReport === 'sales' && reportData?.salesTrend && reportData.salesTrend.length > 0 && (
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <span>Sales Trend - {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reportData.salesTrend.map((trend: any, index: number) => {
                const date = new Date(trend.createdAt);
                let dateLabel = '';

                switch (selectedPeriod) {
                  case 'week':
                    const weekNumber = getWeekNumber(date);
                    dateLabel = `Week ${weekNumber}, ${date.getFullYear()}`;
                    break;
                  case 'month':
                    dateLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                    break;
                  case 'year':
                    dateLabel = date.getFullYear().toString();
                    break;
                  default:
                    dateLabel = date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });
                }

                const amount = trend._sum?.totalAmount || 0;
                const count = trend._count?.id || 0;
                const maxAmount = Math.max(...reportData.salesTrend.map((t: any) => t._sum?.totalAmount || 0));
                const percentage = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

                return (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">{dateLabel}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-foreground">{formatCurrency(amount)}</span>
                        <span className="text-xs text-muted-foreground ml-2">({count} sales)</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )} */}

      {/* Branch-Specific Data Tabs */}
      {selectedBranchId && allBranches.length > 0 && (
        <Card className="shadow-soft border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span>
                {allBranches.find((b: any) => b.id === selectedBranchId)?.name || 'Selected Branch'} - Detailed Report
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const selectedBranchData = allBranches.find((b: any) => b.id === selectedBranchId);
              const branchStats = getBranchStats(selectedBranchId);

              if (!selectedBranchData) return null;

              return (
                <div className="space-y-6">
                  {/* Branch Performance Overview - Similar to TimePeriodReports tabs */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <Card className="shadow-soft border-0">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Revenue</p>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(branchStats.revenue)}</p>
                          </div>
                          <DollarSign className="w-8 h-8 text-green-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-soft border-0">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                            <p className="text-2xl font-bold text-foreground">{branchStats.transactions}</p>
                          </div>
                          <ShoppingCart className="w-8 h-8 text-blue-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-soft border-0">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Products</p>
                            <p className="text-2xl font-bold text-foreground">{branchStats.products}</p>
                          </div>
                          <Package className="w-8 h-8 text-purple-600" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-soft border-0">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Staff</p>
                            <p className="text-2xl font-bold text-foreground">{branchStats.users}</p>
                          </div>
                          <Users className="w-8 h-8 text-orange-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Branch Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Branch Information</h4>
                      <div className="space-y-1 text-sm">
                        <div><span className="text-muted-foreground">Name:</span> <span className="text-foreground">{selectedBranchData.name}</span></div>
                        <div><span className="text-muted-foreground">Address:</span> <span className="text-foreground">{selectedBranchData.address}</span></div>
                        <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{selectedBranchData.phone}</span></div>
                        <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{selectedBranchData.email}</span></div>
                        <div><span className="text-muted-foreground">Status:</span> <Badge variant={selectedBranchData.isActive ? "default" : "secondary"} className="text-xs">{selectedBranchData.isActive ? 'Active' : 'Inactive'}</Badge></div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Performance Summary</h4>
                      <div className="space-y-1 text-sm">
                        <div><span className="text-muted-foreground">Avg. Sale Value:</span> <span className="text-foreground">{branchStats.transactions > 0 ? formatCurrency(branchStats.revenue / branchStats.transactions) : 'PKR 0'}</span></div>
                        <div><span className="text-muted-foreground">Created:</span> <span className="text-foreground">{new Date(selectedBranchData.createdAt).toLocaleDateString()}</span></div>
                        <div><span className="text-muted-foreground">Last Updated:</span> <span className="text-foreground">{new Date(selectedBranchData.updatedAt).toLocaleDateString()}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Sales */}
                  {branchStats.branchSales.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">Recent Sales ({branchStats.branchSales.length})</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {branchStats.branchSales.slice(0, 10).map((sale: any, index: number) => (
                          <div key={sale.id || index} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                            <div>
                              <span className="text-sm font-medium">Sale #{sale.id?.slice(-8) || index + 1}</span>
                              <span className="text-xs text-muted-foreground ml-2">{new Date(sale.createdAt).toLocaleDateString()}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(sale.totalAmount || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products */}
                  {branchStats.branchProducts.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">Products ({branchStats.branchProducts.length})</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                        {branchStats.branchProducts.slice(0, 12).map((product: any, index: number) => (
                          <div key={product.id || index} className="p-2 bg-muted/20 rounded text-sm">
                            <div className="font-medium truncate">{product.name}</div>
                            <div className="text-xs text-muted-foreground">Stock: {product.stock || 0} | Price: {formatCurrency(product.price || 0)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Users */}
                  {branchStats.branchUsers.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-foreground mb-3">Staff ({branchStats.branchUsers.length})</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {branchStats.branchUsers.map((user: any, index: number) => (
                          <div key={user.id || index} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                            <div>
                              <span className="text-sm font-medium">{user.name || user.username}</span>
                              <span className="text-xs text-muted-foreground ml-2">({user.role})</span>
                            </div>
                            <Badge variant="outline" className="text-xs">{user.isActive ? 'Active' : 'Inactive'}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No Data Message */}
                  {branchStats.revenue === 0 && branchStats.transactions === 0 && branchStats.products === 0 && branchStats.users === 0 && (
                    <div className="text-center p-8 text-muted-foreground">
                      <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No Data Available</h3>
                      <p>This branch doesn't have any sales, products, or users yet.</p>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Advanced Analytics Section for Managers */}
      {(user?.role === 'ADMIN' || user?.role === 'SUPERADMIN' || user?.role === 'MANAGER') && (
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Target className="w-6 h-6 text-[#0C2C8A]" />
              Advanced Analytics
            </h2>
            <Badge variant="outline" className="text-[#0C2C8A] border-[#0C2C8A]">
              Manager Access
            </Badge>
          </div>

          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Revenue Growth</p>
                    <p className="text-2xl font-bold text-blue-900">+12.5%</p>
                    <p className="text-xs text-blue-600">vs last month</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Customer Growth</p>
                    <p className="text-2xl font-bold text-green-900">+15.3%</p>
                    <p className="text-xs text-green-600">new customers</p>
                  </div>
                  <Users className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Inventory Turnover</p>
                    <p className="text-2xl font-bold text-purple-900">4.2x</p>
                    <p className="text-xs text-purple-600">stock rotation</p>
                  </div>
                  <Package className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-600">Profit Margin</p>
                    <p className="text-2xl font-bold text-orange-900">23.8%</p>
                    <p className="text-xs text-orange-600">net profit</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5 text-[#0C2C8A]" />
                  <span>Sales Performance</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-900">Average Order Value</p>
                      <p className="text-sm text-blue-600">Per transaction</p>
                    </div>
                    <p className="text-lg font-bold text-blue-900">
                      {formatCurrency(realSalesData.filter((s: any) => s.status !== 'REFUNDED').length > 0 ? realSalesData.filter((s: any) => s.status !== 'REFUNDED').reduce((sum, sale) => sum + (sale.totalAmount || 0), 0) / realSalesData.filter((s: any) => s.status !== 'REFUNDED').length : 0)}
                    </p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-green-900">Conversion Rate</p>
                      <p className="text-sm text-green-600">Customer to sale</p>
                    </div>
                    <p className="text-lg font-bold text-green-900">85.2%</p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <div>
                      <p className="font-medium text-purple-900">Peak Hours</p>
                      <p className="text-sm text-purple-600">Most active time</p>
                    </div>
                    <p className="text-lg font-bold text-purple-900">2-5 PM</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft border-0">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChartIcon className="w-5 h-5 text-[#0C2C8A]" />
                  <span>Inventory Insights</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium text-red-900">Low Stock Items</p>
                      <p className="text-sm text-red-600">Need restocking</p>
                    </div>
                    <p className="text-lg font-bold text-red-900">
                      {realProductsData.filter(product => (product.stock || 0) <= 10).length}
                    </p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <div>
                      <p className="font-medium text-orange-900">Near Expiry</p>
                      <p className="text-sm text-orange-600">Expiring soon</p>
                    </div>
                    <p className="text-lg font-bold text-orange-900">
                      {nearExpiryBatches?.length || 0}
                    </p>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Total Products</p>
                      <p className="text-sm text-gray-600">In inventory</p>
                    </div>
                    <p className="text-lg font-bold text-gray-900">{realProductsData.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Advanced Features */}
          <Card className="shadow-soft border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Gauge className="w-5 h-5 text-[#0C2C8A]" />
                <span>Advanced Features</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Data Export</h4>
                  <p className="text-sm text-blue-600 mb-3">Export comprehensive reports in CSV format</p>
                  <Button size="sm" variant="outline" onClick={exportReports}>
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Export Data
                  </Button>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Real-time Updates</h4>
                  <p className="text-sm text-green-600 mb-3">Live data refresh and monitoring</p>
                  <Button size="sm" variant="outline" onClick={refreshAllData}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh All
                  </Button>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">Multi-Branch</h4>
                  <p className="text-sm text-purple-600 mb-3">Compare performance across branches</p>
                  <Button size="sm" variant="outline" onClick={() => setShowAllBranches(!showAllBranches)}>
                    <Building2 className="w-4 h-4 mr-2" />
                    {showAllBranches ? 'Hide' : 'Show'} All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
};

export default Reports;