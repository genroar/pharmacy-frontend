import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  isActive: boolean;
  createdAt: string;
  _count?: {
    users: number;
    products: number;
    customers: number;
  };
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
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

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
    email: ""
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
  }, []);

  const loadBranches = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getBranches();

      if (response.success && response.data) {
        const branchesData = Array.isArray(response.data) ? response.data : response.data.branches;
        setBranches(branchesData);
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

  const filteredBranches = branches.filter(branch =>
    branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    branch.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateBranch = async () => {
    if (!newBranch.name || !newBranch.address || !newBranch.phone || !newBranch.email) {
      setError("Please fill in all required fields!");
      return;
    }

    try {
      setIsLoading(true);
      const response = await apiService.createBranch({
        ...newBranch
      });

      if (response.success) {
        setNewBranch({ name: "", address: "", phone: "", email: "" });
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
              className="flex items-center gap-2 bg-primary hover:bg-primary/90"
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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search branches by name, address, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </CardContent>
      </Card>

      {/* Branches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBranches.map((branch) => (
          <Card key={branch.id} className="shadow-soft border-0 hover:shadow-lg transition-all duration-300 group">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900 group-hover:text-primary transition-colors">
                      {branch.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={branch.isActive ? "default" : "secondary"}
                        className={branch.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                      >
                        {branch.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(branch.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Contact Information */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">{branch.address}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700">{branch.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-700 truncate">{branch.email}</span>
                </div>
              </div>

              {/* Manager Info */}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <UserCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 text-sm">
                      {getManagerName(branch.managerId)}
                    </div>
                    {getManagerRole(branch.managerId) ? (
                      <div className="text-xs text-gray-500">
                        {getManagerRole(branch.managerId)}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Assign manager in User Management
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats */}
              {branch._count && (
                <div className="pt-3 border-t border-gray-100">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-xl font-bold text-primary">
                        {branch._count.users || 0}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">Users</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-primary">
                        {branch._count.products || 0}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">Products</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-primary">
                        {branch._count.customers || 0}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">Customers</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
                className="bg-primary hover:bg-primary/90"
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
