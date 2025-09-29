import { useState, useEffect, useCallback, useRef, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiService } from "@/services/api";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import AdminUserManagement from "../admin/AdminUserManagement";
import SuperAdminSettings from "../settings/SuperAdminSettings";
import {
  Users,
  UserPlus,
  Building2,
  TrendingUp,
  DollarSign,
  Activity,
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Mail,
  Phone,
  Calendar,
  Shield,
  Crown,
  BarChart3,
  PieChart,
  Settings,
  ArrowLeft,
  MapPin,
  Store,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  MoreVertical,
  UserCheck,
  UserX,
  Filter,
  CreditCard,
  Clock,
  LogOut,
  AlertCircle,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface Admin {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  userCount: number;
  managerCount: number;
  totalSales: number;
  lastActive: string;
  status: 'active' | 'inactive' | 'suspended';
  plan: 'basic' | 'premium' | 'enterprise';
  createdAt: string;
  subscriptionEnd: string;
  branchId?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  adminId: string;
  lastActive: string;
  status: 'active' | 'inactive';
  role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER';
  createdAt: string;
}

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
  adminId?: string;
  createdBy?: string;
  createdAt: string;
  _count: {
    users: number;
    products: number;
    customers: number;
  };
}

const SuperAdminDashboard = () => {
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [isViewUsersOpen, setIsViewUsersOpen] = useState(false);

  // console.log('🔍 SuperAdminDashboard: Component rendered with user:', user);
  const [isViewAdminDetailsOpen, setIsViewAdminDetailsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'overview' | 'admins' | 'users' | 'payments' | 'settings' | 'user-management'>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreateAdminOpen, setIsCreateAdminOpen] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Initialize from localStorage if available
    const saved = localStorage.getItem('superadmin-sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('superadmin-sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stats, setStats] = useState({
    totalAdmins: 0,
    totalUsers: 0,
    totalSales: 0,
    activeAdmins: 0
  });
  const [allBranches, setAllBranches] = useState<Array<{ id: string, name: string }>>([]);
  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    password: "",
    branchId: "",
    plan: "basic"
  });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeStatTab, setActiveStatTab] = useState(0); // Only first card is active, no changes allowed
  const { toast } = useToast();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load data on component mount
  useEffect(() => {
    loadData();
    loadBranches();
  }, []);

  // Update date and time every second - optimized to prevent unnecessary re-renders
  useEffect(() => {
    const updateDateTime = () => {
      setCurrentDateTime(new Date());
    };

    // Initial update
    updateDateTime();

    // Set up timer
    timerRef.current = setInterval(updateDateTime, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      // Check if user is properly authenticated before making API calls
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in.');
        return;
      }

      const [adminsResponse, statsResponse] = await Promise.all([
        apiService.getAdmins({ page: 1, limit: 100 }),
        apiService.getSuperAdminStats()
      ]);

      if (adminsResponse.success && adminsResponse.data) {
        setAdmins(adminsResponse.data.admins);
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      if (error instanceof Error && error.message.includes('Authentication required')) {
        setError('Please log in to continue');
      } else {
        setError('Failed to load data');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadBranches = useCallback(async () => {
    try {
      const response = await apiService.getBranches();
      console.log('Branches response:', response);
      if (response.success && response.data) {
        // Check if data is an array or has a branches property
        const branchesData = Array.isArray(response.data) ? response.data : response.data.branches;
        const branchesList = branchesData.map((branch: any) => ({
          id: branch.id,
          name: branch.name
        }));
        setAllBranches(branchesList);
        setBranches(branchesData);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  }, []);

  const loadAdminUsers = async (adminId: string) => {
    try {
      setIsLoadingUsers(true);
      const response = await apiService.getAdminUsers(adminId);

      if (response.success) {
        setUsers(response.data || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load users",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading admin users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadAllBranches = async () => {
    try {
      setIsLoadingBranches(true);
      const response = await apiService.getBranches();
      if (response.success && response.data) {
        const branchesData = Array.isArray(response.data) ? response.data : response.data.branches;
        setBranches(branchesData);
      } else {
        toast({
          title: "Error",
          description: "Failed to load branches",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      toast({
        title: "Error",
        description: "Failed to load branches",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBranches(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await apiService.updateUser(userId, { isActive: newStatus === 'active' });

      if (response.success) {
        // Update local state
        setUsers(prevUsers =>
          prevUsers.map(user =>
            user.id === userId ? { ...user, status: newStatus } : user
          )
        );

        toast({
          title: "Success",
          description: `User ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to update user status",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  const toggleAdminStatus = async (adminId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const response = await apiService.updateAdmin(adminId, { isActive: newStatus === 'active' });

      if (response.success) {
        // Update local state
        setAdmins(prevAdmins =>
          prevAdmins.map(admin =>
            admin.id === adminId ? { ...admin, status: newStatus } : admin
          )
        );

        // If admin is being deactivated, deactivate all their users
        if (newStatus === 'inactive') {
          const adminUsers = users.filter(user => user.adminId === adminId);
          for (const user of adminUsers) {
            await apiService.updateUser(user.id, { isActive: false });
          }

          // Update local users state
          setUsers(prevUsers =>
            prevUsers.map(user =>
              user.adminId === adminId ? { ...user, status: 'inactive' } : user
            )
          );
        }

        toast({
          title: "Success",
          description: `Admin ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully${newStatus === 'inactive' ? '. All users under this admin have been deactivated.' : ''}`,
        });

        // Reload data to get updated statistics
        loadData();
      } else {
        toast({
          title: "Error",
          description: "Failed to update admin status",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating admin status:', error);
      toast({
        title: "Error",
        description: "Failed to update admin status",
        variant: "destructive",
      });
    }
  };

  const handleViewAdminDetails = async (admin: Admin) => {
    setSelectedAdmin(admin);
    setIsViewAdminDetailsOpen(true);
    await loadAdminUsers(admin.id);
    await loadAllBranches();
  };

  const handleDeleteAdmin = (admin: Admin) => {
    setAdminToDelete(admin);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteAdmin = async () => {
    if (!adminToDelete) return;

    try {
      setIsDeleting(true);
      await apiService.deleteAdmin(adminToDelete.id);

      toast({
        title: "Success",
        description: `Admin ${adminToDelete.name} has been permanently deleted from the database.`,
        variant: "default",
      });

      // Reload admins list
      await loadData();

      // Close dialog
      setIsDeleteDialogOpen(false);
      setAdminToDelete(null);
    } catch (error) {
      console.error('Error deleting admin:', error);
      toast({
        title: "Error",
        description: "Failed to delete admin. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredAdmins = admins.filter(admin =>
    admin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    admin.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalAdmins = stats.totalAdmins;
  const totalUsers = stats.totalUsers;
  const totalBranches = branches.length;
  const activeAdmins = stats.activeAdmins;

  const createAdmin = async () => {
    console.log('Creating admin with data:', newAdmin);

    if (!newAdmin.name || !newAdmin.email || !newAdmin.phone || !newAdmin.company || !newAdmin.password) {
      setError("Please fill in all required fields! Missing: " +
        (!newAdmin.name ? 'Name, ' : '') +
        (!newAdmin.email ? 'Email, ' : '') +
        (!newAdmin.phone ? 'Phone, ' : '') +
        (!newAdmin.company ? 'Company, ' : '') +
        (!newAdmin.password ? 'Password' : '')
      );
      return;
    }

    setIsLoading(true);
    try {
      const adminData = {
        name: newAdmin.name,
        email: newAdmin.email,
        phone: newAdmin.phone,
        company: newAdmin.company,
        plan: 'basic', // Default plan
        branchId: null, // Will be created by backend
        password: newAdmin.password
      };

      console.log('Sending admin data:', adminData);
      const response = await apiService.createAdmin(adminData);

      if (response.success) {
        setSuccess(`Admin created successfully! Username: ${newAdmin.email.split('@')[0]}_admin, Password: ${newAdmin.password}`);
        loadData(); // Reload data
        setNewAdmin({
          name: "",
          email: "",
          phone: "",
          company: "",
          address: "",
          password: "",
          branchId: "",
          plan: "basic"
        });
        setIsCreateAdminOpen(false);
      } else {
        setError(response.message || "Failed to create admin");
      }
    } catch (error) {
      console.error('Error creating admin:', error);
      setError("Failed to create admin. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-[#0C2C8A]/10 text-[#0C2C8A]';
      case 'inactive': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'basic': return 'bg-[#0C2C8A]/10 text-[#0C2C8A]';
      case 'premium': return 'bg-[#0C2C8A]/10 text-[#0C2C8A]';
      case 'enterprise': return 'bg-[#0C2C8A]/10 text-[#0C2C8A]';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'admins', label: 'Admin Management', icon: Users },
    { id: 'users', label: 'User Analytics', icon: PieChart },
    { id: 'payments', label: 'Admin Payments', icon: CreditCard },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  return (
    <div className="flex h-screen bg-[#0C2C8A]">
      {/* Sidebar */}
      <div className={`bg-[#0C2C8A] border-r border-[#153186] shadow-sm transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
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

        <nav className={`space-y-2 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {sidebarItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id && viewMode !== 'user-management';
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setViewMode(item.id as any);
                }}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium relative transition-all duration-300 ${
                  isActive
                    ? 'text-blue-900'
                    : 'text-white hover:bg-white hover:bg-opacity-10'
                }`}
                style={{
                  backgroundColor: isActive ? '#f8f9fa' : 'transparent',
                  borderRadius: isActive ? '25px' : '0',
                  marginRight: isActive ? '0' : '0'
                }}
                title={isCollapsed ? item.label : undefined}
              >
                <IconComponent className={`w-5 h-5 ${isCollapsed ? 'mr-0' : 'mr-3'} ${isActive ? 'text-blue-900' : 'text-white'}`} />
                {!isCollapsed && <span className="font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-[#153186]">
          <Button
            onClick={logout}
            variant="ghost"
            className={`w-full text-white hover:bg-white hover:bg-opacity-10 rounded-2xl transition-all ${isCollapsed ? 'justify-center' : 'justify-start'}`}
            title={isCollapsed ? 'Log Out' : undefined}
          >
            <LogOut className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'}`} />
            {!isCollapsed && 'Log Out'}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto bg-[#f8f9fa] rounded-lg m-4 transition-all duration-300 ${isCollapsed ? 'ml-2' : 'ml-4'}`}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground">
                {viewMode === 'overview' && 'Dashboard Overview'}
                {viewMode === 'admins' && 'Admin Management'}
                {viewMode === 'users' && 'User Analytics'}
                {viewMode === 'payments' && 'Admin Payments'}
                {viewMode === 'settings' && 'Settings'}
                {viewMode === 'user-management' && 'User Management'}
              </h2>
              <p className="text-muted-foreground">
                {viewMode === 'overview' && 'Monitor your platform performance and key metrics'}
                {viewMode === 'admins' && 'Manage all admins and their subscriptions'}
                {viewMode === 'users' && 'Analyze user activity and engagement'}
                {viewMode === 'payments' && 'Manage admin payments and billing'}
                {viewMode === 'settings' && 'Configure platform settings and preferences'}
                {viewMode === 'user-management' && `Managing users for ${selectedAdmin?.name || 'Admin'}`}
              </p>
            </div>

            {/* Date and Time Display with Analog Clock */}
            <div className="flex items-center space-x-4">
              {/* Date and Time Text */}
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
              </div>

              {/* Analog Clock */}
              <div className="relative w-20 h-20 bg-white rounded-full border-4 border-[#0C2C8A] shadow-lg overflow-hidden">
                {/* Clock Center */}
                <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-[#0C2C8A] rounded-full transform -translate-x-1/2 -translate-y-1/2 z-10"></div>

                {/* Hour Hand */}
                <div
                  className="absolute top-1/2 left-1/2 w-1 bg-[#0C2C8A] z-5"
                  style={{
                    height: '16px',
                    transform: `rotate(${(currentDateTime.getHours() % 12) * 30 + currentDateTime.getMinutes() * 0.5}deg)`,
                    transformOrigin: '50% 100%',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-2px',
                    marginTop: '-16px'
                  }}
                ></div>

                {/* Minute Hand */}
                <div
                  className="absolute top-1/2 left-1/2 w-1 bg-[#0C2C8A] z-5"
                  style={{
                    height: '16px',
                    transform: `rotate(${currentDateTime.getMinutes() * 6}deg)`,
                    transformOrigin: '50% 100%',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-2px',
                    marginTop: '-16px'
                  }}
                ></div>

                {/* Second Hand */}
                <div
                  className="absolute top-1/2 left-1/2 w-0.5 bg-red-500 z-5"
                  style={{
                    height: '20px',
                    transform: `rotate(${currentDateTime.getSeconds() * 6}deg)`,
                    transformOrigin: '50% 100%',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-1px',
                    marginTop: '-20px'
                  }}
                ></div>

                {/* Clock Numbers */}
                <div className="absolute top-1 text-xs font-bold text-[#0C2C8A] left-1/2 transform -translate-x-1/2">12</div>
                <div className="absolute right-1 top-1/2 text-xs font-bold text-[#0C2C8A] transform translate-y-[-50%]">3</div>
                <div className="absolute bottom-1 text-xs font-bold text-[#0C2C8A] left-1/2 transform -translate-x-1/2">6</div>
                <div className="absolute left-1 top-1/2 text-xs font-bold text-[#0C2C8A] transform translate-y-[-50%]">9</div>
              </div>
            </div>

            {viewMode === 'admins' && (
              <Dialog open={isCreateAdminOpen} onOpenChange={setIsCreateAdminOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#0C2C8A] hover:bg-transparent hover:text-[#0C2C8A] border-[1px] border-[#0C2C8A] hover:opacity-90">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Admin
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                      <UserPlus className="w-5 h-5 text-[#0C2C8A]" />
                      <span>Create New Admin</span>
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-6">
                    {/* Row 1: Name and Email */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="adminName">Admin Name *</Label>
                        <Input
                          id="adminName"
                          placeholder="Enter admin name"
                          value={newAdmin.name}
                          onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminEmail">Email Address *</Label>
                        <Input
                          id="adminEmail"
                          type="email"
                          placeholder="Enter email address"
                          value={newAdmin.email}
                          onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Row 2: Phone and Company */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="adminPhone">Phone Number *</Label>
                        <Input
                          id="adminPhone"
                          placeholder="Enter phone number"
                          value={newAdmin.phone}
                          onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="adminCompany">Company Name *</Label>
                        <Input
                          id="adminCompany"
                          placeholder="Enter company name"
                          value={newAdmin.company}
                          onChange={(e) => setNewAdmin({ ...newAdmin, company: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Row 3: Password (Full Width) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="adminPassword">Password *</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const generatedPassword = Math.random().toString(36).slice(-8);
                            setNewAdmin({ ...newAdmin, password: generatedPassword });
                          }}
                        >
                          Generate Password
                        </Button>
                      </div>
                      <Input
                        id="adminPassword"
                        type="password"
                        placeholder="Enter password for admin (min 6 characters)"
                        value={newAdmin.password}
                        onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                      />
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          This password will be used by the admin to login. You can share this with the admin.
                        </p>
                        {newAdmin.password && (
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full ${newAdmin.password.length >= 6 ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className={`text-xs ${newAdmin.password.length >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                              {newAdmin.password.length >= 6 ? 'Password is strong' : 'Password must be at least 6 characters'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Row 4: Address (Full Width) - Branch and Plan fields removed */}
                    <div className="space-y-2">
                      <Label htmlFor="adminAddress">Address *</Label>
                      <Input
                        id="adminAddress"
                        placeholder="Enter full address"
                        value={newAdmin.address}
                        onChange={(e) => setNewAdmin({ ...newAdmin, address: e.target.value })}
                      />
                    </div>

                    {/* Success Message */}
                    {success && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <p className="text-green-800 font-medium">Admin Created Successfully!</p>
                        </div>
                        <p className="text-green-700 text-sm mt-1">{success}</p>
                      </div>
                    )}

                    {/* Error Message */}
                    {error && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <p className="text-red-800 font-medium">Error Creating Admin</p>
                        </div>
                        <p className="text-red-700 text-sm mt-1">{error}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2 pt-6 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsCreateAdminOpen(false);
                        setNewAdmin({
                          name: '',
                          email: '',
                          phone: '',
                          company: '',
                          address: '',
                          password: '',
                          branchId: '',
                          plan: 'basic'
                        });
                        setError('');
                        setSuccess('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createAdmin}
                      disabled={isLoading}
                      className="bg-[#0C2C8A] hover:bg-transparent hover:text-[#0C2C8A] border-[1px] border-[#0C2C8A] hover:opacity-90"
                    >
                      {isLoading ? 'Creating...' : 'Create Admin'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Overview Tab */}
          {viewMode === 'overview' && (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadData}
                    className="mt-2"
                  >
                    Retry
                  </Button>
                </div>
              )}

              {/* Stats Cards - Tab-like Behavior */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { title: "Total Admins", value: totalAdmins.toString(), icon: Users, trendValue: "+12.5%" },
                  { title: "Total Users", value: totalUsers.toString(), icon: UserPlus, trendValue: "+8.2%" },
                  { title: "Total Branches", value: branches.length.toString(), icon: Building2, trendValue: "+5.1%" },
                  { title: "Active Admins", value: activeAdmins.toString(), icon: Activity, trendValue: "+15.3%" }
                ].map((stat, index) => {
                  const IconComponent = stat.icon;
                  const isActive = activeStatTab === index;

                  return (
                    <Card
                      key={index}
                      className="bg-white border border-[#0C2C8A] shadow-md"
                      onClick={() => { }} // No click action - only first card stays active
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
                              vs last month
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Recent Admins */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Building2 className="w-5 h-5 text-[#0C2C8A]" />
                    <span>Recent Admins</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {admins.slice(0, 3).map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-[#0C2C8A]/10 rounded-full flex items-center justify-center">
                            <Shield className="w-5 h-5 text-[#0C2C8A]" />
                          </div>
                          <div>
                            <p className="font-medium">{admin.name}</p>
                            <p className="text-sm text-muted-foreground">{admin.company}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{admin.userCount} users</p>
                          <p className="text-xs text-muted-foreground">{admin.managerCount} managers</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Admin Management Tab */}
          {viewMode === 'admins' && (
            <div className="space-y-6">
              {/* Search and Filters */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search admins by name, company, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Button variant="outline" onClick={loadData}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>

              {/* Admins Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Admin
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Company
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Contact
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Users
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Last Active
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredAdmins.map((admin) => (
                          <tr key={admin.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-[#0C2C8A]/10 rounded-full flex items-center justify-center">
                                  <Shield className="w-5 h-5 text-[#0C2C8A]" />
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">{admin.name}</div>
                                  <div className="text-sm text-gray-500">{admin.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">{admin.company}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="space-y-1">
                                <div className="flex items-center text-sm text-gray-900">
                                  <Phone className="w-4 h-4 text-gray-400 mr-2" />
                                  {admin.phone}
                                </div>
                                <div className="flex items-center text-sm text-gray-500">
                                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                                  <span className="truncate max-w-xs">{admin.address}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Badge
                                className={`flex items-center space-x-1 px-2 py-1 rounded-md text-xs font-medium w-fit ${getStatusColor(
                                  admin.status
                                )}`}
                              >
                                {admin.status === "active" ? (
                                  <UserCheck className="w-3 h-3" />
                                ) : (
                                  <UserX className="w-3 h-3" />
                                )}
                                <span>{admin.status.toUpperCase()}</span>
                              </Badge>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{admin.userCount}</div>
                              <div className="text-sm text-gray-500">{admin.managerCount} managers</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {admin.lastActive}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleAdminStatus(admin.id, admin.status)}
                                  className="flex items-center gap-1"
                                >
                                  {admin.status === "active" ? (
                                    <ToggleRight className="w-4 h-4 text-[#0C2C8A]" />
                                  ) : (
                                    <ToggleLeft className="w-4 h-4 text-[#0C2C8A]" />
                                  )}
                                  <span className="text-xs">
                                    {admin.status === "active" ? "Deactivate" : "Activate"}
                                  </span>
                                </Button>

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleViewAdminDetails(admin)}
                                  className="flex items-center gap-1"
                                >
                                  <Settings className="w-4 h-4" />
                                  <span className="text-xs">Details</span>
                                </Button>

                                <Button
                                  size="sm"
                                  onClick={() => handleDeleteAdmin(admin)}
                                  className="flex items-center gap-1 bg-red-600 text-white hover:bg-red-700"
                                  title="Delete Admin Permanently"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span className="text-xs">Delete</span>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* User Analytics Tab */}
          {viewMode === 'users' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PieChart className="w-5 h-5 text-[#0C2C8A]" />
                    <span>User Distribution by Admin</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {admins.map((admin) => {
                      const adminUsers = users.filter(user => user.adminId === admin.id);
                      const percentage = totalUsers > 0 ? (adminUsers.length / totalUsers) * 100 : 0;

                      return (
                        <div key={admin.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{admin.name}</span>
                            <span className="text-sm text-muted-foreground">
                              {adminUsers.length} users ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-[#0C2C8A] h-2 rounded-full transition-all duration-300"
                              style={{ width: `${percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Admin Payments Tab */}
          {viewMode === 'payments' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="w-5 h-5 text-[#0C2C8A]" />
                    <span>Admin Payment Management</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Payment Overview Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-blue-600">Total Revenue</p>
                            <p className="text-2xl font-bold text-blue-800">
                              PKR {admins.reduce((total, admin) => {
                                const amount = admin.plan === 'basic' ? 5000 : admin.plan === 'premium' ? 10000 : 20000;
                                return total + amount;
                              }, 0).toLocaleString()}
                            </p>
                          </div>
                          <DollarSign className="w-8 h-8 text-[#0C2C8A]" />
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-green-600">Paid Subscriptions</p>
                            <p className="text-2xl font-bold text-green-800">
                              {admins.filter(() => Math.random() > 0.3).length}
                            </p>
                          </div>
                          <UserCheck className="w-8 h-8 text-[#0C2C8A]" />
                        </div>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-600">Pending Payments</p>
                            <p className="text-2xl font-bold text-red-800">
                              {admins.filter(() => Math.random() <= 0.3).length}
                            </p>
                          </div>
                          <UserX className="w-8 h-8 text-[#0C2C8A]" />
                        </div>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-purple-600">Total Admins</p>
                            <p className="text-2xl font-bold text-purple-800">{admins.length}</p>
                          </div>
                          <Users className="w-8 h-8 text-[#0C2C8A]" />
                        </div>
                      </div>
                    </div>

                    {/* Admin Payment Plans */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Admin Subscription Plans</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-2 border-blue-200">
                          <CardHeader>
                            <CardTitle className="text-[#0C2C8A]">Basic Plan</CardTitle>
                            <div className="text-3xl font-bold">PKR 5,000<span className="text-sm font-normal">/month</span></div>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2 text-sm">
                              <li>• Up to 10 users</li>
                              <li>• 1 branch</li>
                              <li>• Basic reporting</li>
                              <li>• Email support</li>
                            </ul>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-purple-200">
                          <CardHeader>
                            <CardTitle className="text-[#0C2C8A]">Premium Plan</CardTitle>
                            <div className="text-3xl font-bold">PKR 10,000<span className="text-sm font-normal">/month</span></div>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2 text-sm">
                              <li>• Up to 50 users</li>
                              <li>• 3 branches</li>
                              <li>• Advanced reporting</li>
                              <li>• Priority support</li>
                            </ul>
                          </CardContent>
                        </Card>

                        <Card className="border-2 border-orange-200">
                          <CardHeader>
                            <CardTitle className="text-[#0C2C8A]">Enterprise Plan</CardTitle>
                            <div className="text-3xl font-bold">PKR 20,000<span className="text-sm font-normal">/month</span></div>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2 text-sm">
                              <li>• Unlimited users</li>
                              <li>• Unlimited branches</li>
                              <li>• Custom reporting</li>
                              <li>• 24/7 support</li>
                            </ul>
                          </CardContent>
                        </Card>
                      </div>
                    </div>

                    {/* Admin Payment Status Table */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Admin Payment Status</h3>
                      <Card>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Admin
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Company
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Plan
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Amount
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Payment Status
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Last Payment
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Next Due
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {admins.map((admin) => {
                                  // Mock payment data - in real app, this would come from backend
                                  const paymentStatus = Math.random() > 0.3 ? 'paid' : 'pending';
                                  const lastPayment = paymentStatus === 'paid' ? '2024-01-15' : 'Never';
                                  const nextDue = '2024-02-15';
                                  const planAmount = admin.plan === 'basic' ? 5000 : admin.plan === 'premium' ? 10000 : 20000;

                                  return (
                                    <tr key={admin.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-blue-600" />
                                          </div>
                                          <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{admin.name}</div>
                                            <div className="text-sm text-gray-500">{admin.email}</div>
                                          </div>
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{admin.company}</div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge className={`${getPlanColor(admin.plan)}`}>
                                          {admin.plan.toUpperCase()}
                                        </Badge>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                          PKR {planAmount.toLocaleString()}
                                        </div>
                                        <div className="text-sm text-gray-500">per month</div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge className={
                                          paymentStatus === 'paid'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }>
                                          {paymentStatus === 'paid' ? (
                                            <>
                                              <UserCheck className="w-3 h-3 mr-1" />
                                              PAID
                                            </>
                                          ) : (
                                            <>
                                              <UserX className="w-3 h-3 mr-1" />
                                              PENDING
                                            </>
                                          )}
                                        </Badge>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {lastPayment}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {nextDue}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center space-x-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-[#0C2C8A] hover:text-[#0C2C8A]/80"
                                          >
                                            <CreditCard className="w-4 h-4 mr-1" />
                                            View Details
                                          </Button>
                                          {paymentStatus === 'pending' && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="text-[#0C2C8A] hover:text-[#0C2C8A]/80"
                                            >
                                              <DollarSign className="w-4 h-4 mr-1" />
                                              Mark Paid
                                            </Button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Settings Tab */}
          {viewMode === 'settings' && (
            <SuperAdminSettings />
          )}

          {/* User Management View */}
          {viewMode === 'user-management' && selectedAdmin && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  onClick={() => setViewMode('admins')}
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Admins</span>
                </Button>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">User Management</h2>
                  <p className="text-muted-foreground">Managing users for {selectedAdmin.name}</p>
                </div>
              </div>
              <AdminUserManagement
                adminId={selectedAdmin.id}
                adminName={selectedAdmin.name}
                branchId={selectedAdmin.branchId || ''}
              />
            </div>
          )}
        </div>
      </div>

      {/* View Users Dialog */}
      <Dialog open={isViewUsersOpen} onOpenChange={setIsViewUsersOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-[#0C2C8A]" />
              <span>Users for {selectedAdmin?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedAdmin && users.filter(user => user.adminId === selectedAdmin.id).map((user) => (
              <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(user.status)}`}>
                    {user.status.toUpperCase()}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">Last active: {user.lastActive}</p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Enhanced Admin Details Dialog */}
      <Dialog open={isViewAdminDetailsOpen} onOpenChange={setIsViewAdminDetailsOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span>{selectedAdmin?.name}</span>
              <Badge className="bg-blue-100 text-blue-800">Admin</Badge>
            </DialogTitle>
            <p className="text-muted-foreground">
              Manage {selectedAdmin?.company} admin and their users
            </p>
          </DialogHeader>

          {selectedAdmin && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="users">Users ({users.length})</TabsTrigger>
                <TabsTrigger value="branches">Branches</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Admin Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <div className="flex items-center space-x-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <span>{selectedAdmin.email}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <div className="flex items-center space-x-2">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <span>{selectedAdmin.phone}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Company</Label>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <span>{selectedAdmin.company}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Address</Label>
                        <div className="flex items-center space-x-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span>{selectedAdmin.address}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Badge className={`${getStatusColor(selectedAdmin.status)}`}>
                          {selectedAdmin.status === 'active' ? <UserCheck className="w-3 h-3 mr-1" /> : <UserX className="w-3 h-3 mr-1" />}
                          {selectedAdmin.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <Label>Plan</Label>
                        <Badge className={`${getPlanColor(selectedAdmin.plan)}`}>
                          {selectedAdmin.plan.toUpperCase()}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <p className="text-2xl font-bold text-[#0C2C8A]">{selectedAdmin.userCount}</p>
                          <p className="text-sm text-muted-foreground">Total Users</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-[#0C2C8A]">{selectedAdmin.managerCount}</p>
                          <p className="text-sm text-muted-foreground">Managers</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <p className="text-2xl font-bold text-[#0C2C8A]">{branches.filter(branch => branch.adminId === selectedAdmin.id || branch.createdBy === selectedAdmin.id).length}</p>
                          <p className="text-sm text-muted-foreground">Total Branches</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <p className="text-2xl font-bold text-[#0C2C8A]">{selectedAdmin.createdAt}</p>
                          <p className="text-sm text-muted-foreground">Created</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="users" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Users Management</h3>
                  <Button size="sm" onClick={() => loadAdminUsers(selectedAdmin.id)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>


                {isLoadingUsers ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Loading users...</span>
                    </div>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No users found for this admin</p>
                    <p className="text-sm text-gray-400">Users will appear here when they are created under this admin</p>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {users.map((user) => (
                            <tr key={user.id}>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                    <Users className="w-4 h-4 text-gray-600" />
                                  </div>
                                  <span className="font-medium">{user.name}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">{user.email}</td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Badge className="bg-[#0C2C8A]/10 text-[#0C2C8A]">{user.role}</Badge>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <Badge className={`${getStatusColor(user.status)}`}>
                                  {user.status === 'active' ? <UserCheck className="w-3 h-3 mr-1" /> : <UserX className="w-3 h-3 mr-1" />}
                                  {user.status.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div className="flex items-center space-x-2">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <span>{user.createdAt}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleUserStatus(user.id, user.status)}
                                  className="flex items-center space-x-1"
                                >
                                  {user.status === 'active' ? (
                                    <ToggleRight className="w-4 h-4 text-[#0C2C8A]" />
                                  ) : (
                                    <ToggleLeft className="w-4 h-4 text-[#0C2C8A]" />
                                  )}
                                  <span className="text-xs">
                                    {user.status === 'active' ? 'Deactivate' : 'Activate'}
                                  </span>
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="branches" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Branch Information</h3>
                    <p className="text-sm text-muted-foreground">Total Branches: {branches.filter(branch => branch.adminId === selectedAdmin.id || branch.createdBy === selectedAdmin.id).length}</p>
                  </div>
                  <Button size="sm" onClick={loadAllBranches}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </Button>
                </div>

                {isLoadingBranches ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex items-center space-x-2">
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Loading branches...</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {branches.filter(branch => branch.adminId === selectedAdmin.id || branch.createdBy === selectedAdmin.id).map((branch) => (
                      <Card key={branch.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2">
                            <Store className="w-5 h-5 text-[#0C2C8A]" />
                            <span>{branch.name}</span>
                            {branch.isActive ? (
                              <Badge className="bg-green-100 text-green-800">Active</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center space-x-2 text-sm">
                            <MapPin className="w-4 h-4 text-gray-400" />
                            <span>{branch.address}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{branch.phone}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span>{branch.email}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
                            <div className="text-center">
                              <p className="text-lg font-bold text-[#0C2C8A]">{branch._count.users}</p>
                              <p className="text-xs text-muted-foreground">Users</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-[#0C2C8A]">{branch._count.products}</p>
                              <p className="text-xs text-muted-foreground">Products</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-[#0C2C8A]">{branch._count.customers}</p>
                              <p className="text-xs text-muted-foreground">Customers</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}

          <div className="flex justify-end pt-6 border-t">
            <Button variant="outline" onClick={() => setIsViewAdminDetailsOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span>Delete Admin</span>
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <strong>{adminToDelete?.name}</strong>?
              This action will remove the admin and ALL their related data from the database including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All users under this admin</li>
                <li>All products and inventory</li>
                <li>All sales and transactions</li>
                <li>All customers and suppliers</li>
                <li>All branches and settings</li>
              </ul>
              <strong className="text-red-600">This action cannot be undone!</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteAdmin}
              disabled={isDeleting}
              className="flex items-center space-x-2"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Permanently</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default memo(SuperAdminDashboard);
