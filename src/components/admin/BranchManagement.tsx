import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  Package,
  UserCheck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  managerId?: string;
  companyId: string;
  isActive: boolean;
  createdAt: string;
  company?: {
    id: string;
    name: string;
  };
  _count?: {
    users: number;
    products: number;
    customers: number;
  };
}

interface Company {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const BranchManagement = () => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);

  // Form states
  const [newBranch, setNewBranch] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    companyId: ""
  });

  const [editBranch, setEditBranch] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    managerId: "",
    isActive: true
  });

  // Load data on component mount
  useEffect(() => {
    loadBranches();
    loadUsers();
    loadCompanies();
  }, []);

  const loadBranches = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getBranches();

      if (response.success && response.data) {
        const branchesData = Array.isArray(response.data) ? response.data : response.data.branches;
        setBranches(branchesData as Branch[]);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
      setError('Failed to load branches');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await apiService.getUsers({ page: 1, limit: 1000 });
      if (response.success && response.data) {
        const usersData = Array.isArray(response.data) ? response.data : response.data.users;
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await apiService.getCompanies();
      if (response.success && response.data) {
        setCompanies(response.data);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const filteredBranches = branches.filter(branch => {
    const matchesSearch = branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branch.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCompany = selectedCompanyId === "all" || !selectedCompanyId || branch.companyId === selectedCompanyId;

    return matchesSearch && matchesCompany;
  });

  const handleCreateBranch = async () => {
    if (!newBranch.name || !newBranch.address || !newBranch.phone || !newBranch.email || !newBranch.companyId) {
      setError("Please fill in all required fields including company selection!");
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiService.createBranch({
        name: newBranch.name,
        address: newBranch.address,
        phone: newBranch.phone,
        email: newBranch.email,
        companyId: newBranch.companyId
      });

      if (response.success) {
        setNewBranch({ name: "", address: "", phone: "", email: "", companyId: "" });
        setIsCreateDialogOpen(false);
        await loadBranches();
        setError("");
      } else {
        setError(response.message || 'Failed to create branch');
      }
    } catch (error: any) {
      console.error('Error creating branch:', error);
      setError(error?.message || 'Failed to create branch');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditBranch = async () => {
    if (!editingBranch || !editBranch.name || !editBranch.address || !editBranch.phone || !editBranch.email) {
      setError("Please fill in all required fields!");
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiService.updateBranch(editingBranch.id, {
        ...editBranch,
        managerId: editBranch.managerId || undefined
      });

      if (response.success) {
        setEditingBranch(null);
        setIsEditDialogOpen(false);
        await loadBranches();
        setError("");
      } else {
        setError(response.message || 'Failed to update branch');
      }
    } catch (error: any) {
      console.error('Error updating branch:', error);
      setError(error?.message || 'Failed to update branch');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!deletingBranch) return;

    try {
      setIsLoading(true);
      const response = await apiService.deleteBranch(deletingBranch.id);

      if (response.success) {
        setDeletingBranch(null);
        setIsDeleteDialogOpen(false);
        await loadBranches();
        setError("");
      } else {
        setError(response.message || 'Failed to delete branch');
      }
    } catch (error: any) {
      console.error('Error deleting branch:', error);
      setError(error?.message || 'Failed to delete branch');
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (branch: Branch) => {
    setEditingBranch(branch);
    setEditBranch({
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      email: branch.email,
      managerId: branch.managerId || "",
      isActive: branch.isActive
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (branch: Branch) => {
    setDeletingBranch(branch);
    setIsDeleteDialogOpen(true);
  };

  const getManagerName = (managerId?: string) => {
    if (!managerId) return "No Manager";
    const manager = users.find(user => user.id === managerId);
    return manager ? manager.name : "Unknown Manager";
  };

  const getManagerRole = (managerId?: string) => {
    if (!managerId) return "";
    const manager = users.find(user => user.id === managerId);
    return manager ? manager.role : "";
  };

  if (isLoading && branches.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Branches</h3>
            <p className="text-gray-600">Please wait while we fetch your branch data...</p>
          </div>
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
            <h1 className="text-3xl font-bold text-gray-900">Branch Management</h1>
            <p className="text-gray-600 mt-1">
              Manage pharmacy branches and their details • {branches.length} branches total
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Plus className="w-4 h-4" />
              Add Branch
            </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6">
          <Alert variant="destructive" className="shadow-soft border-0">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}


      {/* Search and Filters */}
      <Card className="mb-6 shadow-soft border-0">
        <CardContent className="p-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search branches by name, address, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11"
              />
            </div>
            <div className="w-64">
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Filter by company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="all"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    All Companies
                  </SelectItem>
                  {companies.map(company => (
                    <SelectItem
                      key={company.id}
                      value={company.id}
                      className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                    >
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branches Table */}
      <Card className="shadow-soft border-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch Details
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact Info
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Manager
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statistics
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBranches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {branch.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {branch.company?.name || 'Unknown Company'} • Created {new Date(branch.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[200px]" title={branch.address}>
                            {branch.address}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span>{branch.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="truncate max-w-[200px]" title={branch.email}>
                            {branch.email}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {getManagerName(branch.managerId)}
                          </div>
                          {getManagerRole(branch.managerId) ? (
                            <div className="text-xs text-gray-500">
                              {getManagerRole(branch.managerId)}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              No manager assigned
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {branch._count ? (
                        <div className="flex gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-semibold text-primary">
                              {branch._count.users || 0}
                            </div>
                            <div className="text-xs text-gray-500">Users</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-primary">
                              {branch._count.products || 0}
                            </div>
                            <div className="text-xs text-gray-500">Products</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-primary">
                              {branch._count.customers || 0}
                            </div>
                            <div className="text-xs text-gray-500">Customers</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">No data</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={branch.isActive ? "default" : "secondary"}
                        className={branch.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                      >
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(branch)}
                          className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(branch)}
                          className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* Empty State */}
      {filteredBranches.length === 0 && !isLoading && (
        <Card className="shadow-soft border-0">
          <CardContent className="text-center py-16">
            <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Building2 className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">
              {searchTerm ? "No branches found" : "No branches yet"}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {searchTerm
                ? "No branches match your search criteria. Try adjusting your search terms."
                : "Get started by creating your first pharmacy branch to manage your business operations."
              }
            </p>
            {!searchTerm && (
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First Branch
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Branch Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Branch</DialogTitle>
            <DialogDescription>
              Add a new pharmacy branch to the system. You can assign a manager later after creating users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company">Company *</Label>
              <Select value={newBranch.companyId} onValueChange={(value) => setNewBranch({ ...newBranch, companyId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map(company => (
                    <SelectItem
                      key={company.id}
                      value={company.id}
                      className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                    >
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Branch Name *</Label>
              <Input
                id="name"
                value={newBranch.name}
                onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                placeholder="Enter branch name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={newBranch.address}
                onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                placeholder="Enter branch address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={newBranch.phone}
                  onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={newBranch.email}
                  onChange={(e) => setNewBranch({ ...newBranch, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBranch} disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Branch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Branch Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch information and settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Branch Name *</Label>
              <Input
                id="edit-name"
                value={editBranch.name}
                onChange={(e) => setEditBranch({ ...editBranch, name: e.target.value })}
                placeholder="Enter branch name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address *</Label>
              <Input
                id="edit-address"
                value={editBranch.address}
                onChange={(e) => setEditBranch({ ...editBranch, address: e.target.value })}
                placeholder="Enter branch address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone *</Label>
                <Input
                  id="edit-phone"
                  value={editBranch.phone}
                  onChange={(e) => setEditBranch({ ...editBranch, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editBranch.email}
                  onChange={(e) => setEditBranch({ ...editBranch, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-manager">Manager</Label>
              <select
                id="edit-manager"
                value={editBranch.managerId}
                onChange={(e) => setEditBranch({ ...editBranch, managerId: e.target.value })}
                className="w-full px-3 py-2 border border-input rounded-md bg-background"
                aria-label="Select manager"
              >
                <option value="">No Manager</option>
                {users.filter(user => ['ADMIN', 'MANAGER'].includes(user.role)).map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-active"
                checked={editBranch.isActive}
                onChange={(e) => setEditBranch({ ...editBranch, isActive: e.target.checked })}
                className="rounded"
                aria-label="Active branch status"
              />
              <Label htmlFor="edit-active">Active Branch</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditBranch} disabled={isLoading}>
              {isLoading ? "Updating..." : "Update Branch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Branch Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingBranch?.name}"? This action will deactivate the branch and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteBranch} disabled={isLoading}>
              {isLoading ? "Deleting..." : "Delete Branch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BranchManagement;
