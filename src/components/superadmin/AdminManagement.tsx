import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  UserCog,
  Users,
  Building2,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Crown,
  Shield,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Settings,
  Activity,
  DollarSign,
  Store,
  MoreVertical,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

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
  status: 'active' | 'inactive';
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
  createdAt: string;
  _count: {
    users: number;
    products: number;
    customers: number;
  };
}

const AdminManagement = () => {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  const [error, setError] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();

  // Load admins from API
  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getAdmins({ page: 1, limit: 100, search: searchTerm });

      if (response.success && response.data) {
        setAdmins(response.data.admins);
      } else {
        setError('Failed to load admins');
        toast({
          title: "Error",
          description: "Failed to load admins",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading admins:', error);
      setError('Failed to load admins');
      toast({
        title: "Error",
        description: "Failed to load admins",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadAdminUsers = async (adminId: string) => {
    try {
      setIsLoadingUsers(true);
      const response = await apiService.getAdminUsers(adminId);

      if (response.success) {
        setUsers(response.data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load staff",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load staff",
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadBranches = async () => {
    try {
      setIsLoadingBranches(true);
      const response = await apiService.getBranches();

      if (response.success && response.data) {
        setBranches(response.data.branches);
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
          description: "Failed to update staff status",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating user status:', error);
      toast({
        title: "Error",
        description: "Failed to update staff status",
        variant: "destructive",
      });
    }
  };

  const handleViewAdmin = async (admin: Admin) => {
    setSelectedAdmin(admin);
    setIsViewDialogOpen(true);
    await loadAdminUsers(admin.id);
    await loadBranches();
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
      await loadAdmins();

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

  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = admin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         admin.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         admin.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || admin.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><UserCheck className="w-3 h-3 mr-1" />Active</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800"><UserX className="w-3 h-3 mr-1" />Inactive</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800"><UserX className="w-3 h-3 mr-1" />Suspended</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-600" />;
      case 'superadmin':
        return <Crown className="w-4 h-4 text-purple-600" />;
      default:
        return <UserCog className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-blue-100 text-blue-800">Admin</Badge>;
      case 'superadmin':
        return <Badge className="bg-purple-100 text-purple-800">Super Admin</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const getUserRoleBadge = (role: string) => {
    switch (role) {
      case 'manager':
        return <Badge className="bg-orange-100 text-orange-800">Manager</Badge>;
      case 'cashier':
        return <Badge className="bg-green-100 text-green-800">Cashier</Badge>;
      case 'pharmacist':
        return <Badge className="bg-blue-100 text-blue-800">Pharmacist</Badge>;
      default:
        return <Badge variant="secondary">{role}</Badge>;
    }
  };

  const totalAdmins = filteredAdmins.length;
  const activeAdmins = filteredAdmins.filter(a => a.status === 'active').length;
  const totalUsers = filteredAdmins.reduce((sum, admin) => sum + admin.userCount, 0);
  const totalSales = filteredAdmins.reduce((sum, admin) => sum + admin.totalSales, 0);

  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span>Loading admins...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Management</h1>
          <p className="text-muted-foreground">Manage all admins and their users across branches</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={loadAdmins}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Admin</DialogTitle>
                <DialogDescription>
                  Create a new admin account for a branch.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="Enter full name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Enter email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="Enter phone number" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Business Name</Label>
                  <Input id="company" placeholder="Enter business name" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsAddDialogOpen(false)}>
                  Add Admin
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Admins</p>
                <p className="text-2xl font-bold text-foreground">{totalAdmins}</p>
              </div>
              <UserCog className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Admins</p>
                <p className="text-2xl font-bold text-green-600">{activeAdmins}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold text-green-600">${totalSales.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by admin name, business, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAdmins.map((admin) => (
          <Card key={admin.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <Shield className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{admin.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{admin.company}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {getStatusBadge(admin.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{admin.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{admin.phone}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{admin.address}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{admin.userCount}</p>
                  <p className="text-xs text-muted-foreground">Staff</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">${admin.totalSales.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Sales</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Last active: {admin.lastActive}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewAdmin(admin)}
                    className="flex items-center space-x-1"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Manage</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteAdmin(admin)}
                    className="flex items-center space-x-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* View Admin Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <span>{selectedAdmin?.name}</span>
              <Badge className="bg-blue-100 text-blue-800">Admin</Badge>
            </DialogTitle>
            <DialogDescription>
              Manage {selectedAdmin?.company} admin and their users
            </DialogDescription>
          </DialogHeader>

          {selectedAdmin && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="users">Staff ({users.length})</TabsTrigger>
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
                        {getStatusBadge(selectedAdmin.status)}
                      </div>
                      <div className="space-y-2">
                        <Label>Plan</Label>
                        <Badge className="bg-purple-100 text-purple-800">{selectedAdmin.plan}</Badge>
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
                          <p className="text-2xl font-bold text-blue-600">{selectedAdmin.userCount}</p>
                          <p className="text-sm text-muted-foreground">Total Users</p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{selectedAdmin.managerCount}</p>
                          <p className="text-sm text-muted-foreground">Managers</p>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <p className="text-2xl font-bold text-purple-600">${selectedAdmin.totalSales.toLocaleString()}</p>
                          <p className="text-sm text-muted-foreground">Total Sales</p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <p className="text-2xl font-bold text-orange-600">{selectedAdmin.createdAt}</p>
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
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                                  <Users className="w-4 h-4 text-gray-600" />
                                </div>
                                <span className="font-medium">{user.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              {getUserRoleBadge(user.role)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(user.status)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-400" />
                                <span className="text-sm">{user.createdAt}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleUserStatus(user.id, user.status)}
                                className="flex items-center space-x-1"
                              >
                                {user.status === 'active' ? (
                                  <ToggleRight className="w-4 h-4 text-green-600" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4 text-gray-400" />
                                )}
                                <span className="text-xs">
                                  {user.status === 'active' ? 'Deactivate' : 'Activate'}
                                </span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="branches" className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Branch Information</h3>
                  <Button size="sm" onClick={loadBranches}>
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
                    {branches.map((branch) => (
                      <Card key={branch.id}>
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-2">
                            <Store className="w-5 h-5 text-blue-600" />
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
                              <p className="text-lg font-bold text-blue-600">{branch._count.users}</p>
                              <p className="text-xs text-muted-foreground">Staff</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-green-600">{branch._count.products}</p>
                              <p className="text-xs text-muted-foreground">Products</p>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-bold text-purple-600">{branch._count.customers}</p>
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
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

export default AdminManagement;
