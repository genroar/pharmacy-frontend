import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Building2,
  Shield,
  Settings,
  Stethoscope,
  Search,
  Edit,
  Trash2,
  Eye,
  Loader2
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  branchId: string;
  branch: {
    id: string;
    name: string;
  };
  createdBy?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Branch {
  id: string;
  name: string;
}

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");

  // Define available roles based on current user's role
  const getAvailableRoles = () => {
    if (currentUser?.role === 'SUPERADMIN') {
      return [
        { id: "ADMIN", label: "Admin", icon: Settings, description: "Branch administration" },
        { id: "MANAGER", label: "Manager", icon: Stethoscope, description: "Branch management" },
        { id: "CASHIER", label: "Cashier", icon: Users, description: "Sales and billing" }
      ];
    } else if (currentUser?.role === 'ADMIN') {
      return [
        { id: "MANAGER", label: "Manager", icon: Stethoscope, description: "Branch management" },
        { id: "CASHIER", label: "Cashier", icon: Users, description: "Sales and billing" }
      ];
    }
    return [];
  };

  const roles = getAvailableRoles();

  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    username: "",
    branchId: "",
    role: "",
    password: ""
  });

  // Load data on component mount
  useEffect(() => {
    loadUsers();
    loadBranches();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Get current user's data from AuthContext
      if (!currentUser) {
        setError('User not authenticated');
        return;
      }

      const branchId = currentUser?.branchId || currentUser?.branch?.id;
      const currentUserId = currentUser?.id;
      const currentUserRole = currentUser?.role;

      // Note: Loading all users, not filtering by branch

      // Try to make a direct API call to get users
      try {
        const token = localStorage.getItem('token');
        console.log('Making direct API call with token:', token ? 'Present' : 'Missing');

        const response = await fetch(`http://localhost:5001/api/users?page=1&limit=100`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });


        if (response.ok) {
          const data = await response.json();

          if (data.success && data.data && data.data.users) {
            const usersData = data.data.users.map((user: any) => ({
              id: user.id,
              username: user.username,
              name: user.name,
              email: user.email,
              role: user.role,
              branchId: user.branchId,
              branch: user.branch,
              createdBy: user.createdBy,
              isActive: user.isActive,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            }));

            // Filter users based on current user's role
            const filteredUsers = usersData.filter((user: User) => {
              // If current user is ADMIN, only show MANAGER and CASHIER created by this ADMIN
              if (currentUserRole === 'ADMIN') {
                return (user.role === 'MANAGER' || user.role === 'CASHIER') && user.createdBy === currentUserId;
              }

              // If current user is SUPERADMIN, show all roles
              if (currentUserRole === 'SUPERADMIN') {
                return user.role === 'ADMIN' || user.role === 'MANAGER' || user.role === 'CASHIER';
              }

              // Default: show MANAGER and CASHIER
              return user.role === 'MANAGER' || user.role === 'CASHIER';
            });

            setUsers(filteredUsers);

            if (filteredUsers.length === 0) {
              setError(`Found ${usersData.length} users but none are MANAGER or CASHIER roles. Only ${usersData.map(u => u.role).join(', ')} roles found.`);
            }
          } else {
            console.error('API response not successful:', data);
            setError(data.message || "Failed to load users");
          }
        } else {
          const errorData = await response.json();
          console.error('API call failed:', errorData);
          setError(`API Error: ${errorData.message || 'Failed to load users'}`);
        }
      } catch (apiError) {
        console.error('Direct API call failed:', apiError);
        setError("Failed to load users. Please check your connection and try again.");
      }

    } catch (error) {
      console.error('Error loading users:', error);
      setError("Failed to load users. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const response = await apiService.getBranches();
      if (response.success && response.data) {
        const branchesData = Array.isArray(response.data) ? response.data : response.data.branches;
        setBranches(branchesData.map((branch: any) => ({
          id: branch.id,
          name: branch.name
        })));
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBranch = selectedBranch === "all" || user.branch?.name === selectedBranch;

    return matchesSearch && matchesBranch;
  });

  const handleCreateUser = async () => {
    // For SUPERADMIN creating ADMIN, branchId is not required
    const isSuperAdminCreatingAdmin = currentUser?.role === 'SUPERADMIN' && newUser.role === 'ADMIN';

    if (!newUser.name || !newUser.email || !newUser.username || !newUser.role || !newUser.password || (!isSuperAdminCreatingAdmin && !newUser.branchId)) {
      setError("Please fill in all required fields including username and branch selection!");
      return;
    }

    try {
      setIsLoading(true);

      // Use the selected branch ID from the form, or null for SUPERADMIN creating ADMIN
      const branchId = isSuperAdminCreatingAdmin ? null : newUser.branchId;

      console.log('Creating user with data:', {
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        name: newUser.name,
        role: newUser.role,
        branchId: branchId,
        isSuperAdminCreatingAdmin
      });

      const response = await apiService.createUser({
        username: newUser.username,
        email: newUser.email,
        password: newUser.password,
        name: newUser.name,
        role: newUser.role as 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER',
        branchId: branchId
      });

      if (response.success && response.data) {
        setSuccess(`User created successfully! Username: ${newUser.username}, Password: ${newUser.password}`);
        setError("");
        setNewUser({ name: "", email: "", username: "", branchId: "", role: "", password: "" });
        setIsCreateDialogOpen(false);

        // Reset search and filter states
        setSearchTerm("");
        setSelectedBranch("all");

        // Reload users list to ensure we have the latest data from the server
        await loadUsers();
      } else {
        console.error('Create user failed:', response);
        setError(response.message || 'Failed to create user');
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to create user';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    const roleData = roles.find(r => r.id === role);
    if (roleData) {
      const IconComponent = roleData.icon;
      return <IconComponent className="w-4 h-4" />;
    }
    return <Users className="w-4 h-4" />;
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "ADMIN": return "destructive";
      case "MANAGER": return "default";
      case "CASHIER": return "secondary";
      default: return "outline";
    }
  };

  // Handler functions for user actions
  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setNewUser({
      name: user.name,
      email: user.email,
      username: user.username,
      branchId: user.branchId,
      role: user.role,
      password: "" // Don't pre-fill password for security
    });
    setIsEditDialogOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!selectedUser) return;

    try {
      setIsLoading(true);
      setError("");

      const response = await apiService.deleteUser(selectedUser.id);

      if (response.success) {
        setSuccess(`User ${selectedUser.name} deleted successfully!`);
        setUsers(prevUsers => prevUsers.filter(user => user.id !== selectedUser.id));
        setIsDeleteDialogOpen(false);
        setSelectedUser(null);
      } else {
        setError(response.message || 'Failed to delete user');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete user';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser || !newUser.name || !newUser.email || !newUser.username || !newUser.role || !newUser.branchId) {
      setError("Please fill in all required fields!");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const updateData: any = {
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role as 'MANAGER' | 'CASHIER',
        branchId: newUser.branchId
      };

      // Only include password if it's provided
      if (newUser.password) {
        updateData.password = newUser.password;
      }

      const response = await apiService.updateUser(selectedUser.id, updateData);

      if (response.success) {
        setSuccess(`User ${newUser.name} updated successfully!`);
        setError("");
        setNewUser({ name: "", email: "", username: "", branchId: "", role: "", password: "" });
        setIsEditDialogOpen(false);
        setSelectedUser(null);

        // Update the user in the current list
        setUsers(prevUsers => prevUsers.map(user =>
          user.id === selectedUser.id
            ? { ...user, ...updateData, branch: branches.find(b => b.id === newUser.branchId) || user.branch }
            : user
        ));
      } else {
        setError(response.message || 'Failed to update user');
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update user';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && users.length === 0) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground">Manage branch users and their permissions</p>
        </div>

        <div className="flex space-x-3">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="text-white bg-[#0c2c8a] hover:bg-transparent hover:text-[#0c2c8a] border-[1px] border-[#0c2c8a] hover:opacity-90">
                <UserPlus className="w-4 h-4 mr-2" />
                Create New User
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to your pharmacy system. They will receive login credentials via email.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Name</Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="col-span-3"
                    placeholder="Enter full name"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="email" className="text-right">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="col-span-3"
                    placeholder="Enter email address"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="username" className="text-right">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="col-span-3"
                    placeholder="Enter username"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="role" className="text-right">Role</Label>
                  <Select value={newUser.role} onValueChange={(value) => setNewUser({...newUser, role: value})}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center space-x-2">
                            {getRoleIcon(role.id)}
                            <span>{role.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Only show branch selection if not SUPERADMIN creating ADMIN */}
                {!(currentUser?.role === 'SUPERADMIN' && newUser.role === 'ADMIN') && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="branch" className="text-right">Branch</Label>
                    <Select value={newUser.branchId} onValueChange={(value) => setNewUser({...newUser, branchId: value})}>
                      <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            <div className="flex items-center space-x-2">
                              <Building2 className="h-4 w-4" />
                              <span>{branch.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="password" className="text-right">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="col-span-3"
                    placeholder="Enter temporary password"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90" onClick={handleCreateUser}>
                  Create User
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => {
              setNewUser({ name: "", email: "", username: "", branchId: "", role: "CASHIER", password: "" });
              setIsCreateDialogOpen(true);
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Quick Create Cashier
          </Button>
        </div>
      </div>
      {/* Success Message */}
      {success && (
        <Card className="shadow-soft border-0 border-l-4 border-green-500">
          <CardContent className="p-4">
            <p className="text-green-600">{success}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSuccess("")}
              className="mt-2"
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}

      {/* Filters */}
      <Card className="shadow-soft border-0">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="text-sm font-medium text-muted-foreground mb-2 block">
                Search Users
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="md:w-48">
              <Label htmlFor="branch-filter" className="text-sm font-medium text-muted-foreground mb-2 block">
                Filter by Branch
              </Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.name}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#0C2C8A]" />
            <span>Users ({filteredUsers.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Username</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Branch</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Created</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-muted-foreground">
                      {users.length === 0 ? "No users found in this branch" : "No users match your search criteria"}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-[#E9ECF4] rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-[#0C2C8A]">
                              {user.name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-foreground">{user.username}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center space-x-1 w-fit">
                          {getRoleIcon(user.role)}
                          <span className="capitalize">{user.role}</span>
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground">{user.branch?.name || 'Unknown Branch'}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge
                          variant={user.isActive ? 'default' : 'secondary'}
                          className={user.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}
                        >
                          {user.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewUser(user)}
                            title="View User Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteUser(user)}
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Role Information */}
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roles.map((role) => {
              const IconComponent = role.icon;
              return (
                <div key={role.id} className="p-4 border border-border rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-[#E9ECF4] rounded-lg">
                      <IconComponent className="w-5 h-5 text-[#0C2C8A]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{role.label}</h3>
                      <p className="text-sm text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {role.id === 'MANAGER' && 'Branch management, inventory, sales reports'}
                    {role.id === 'CASHIER' && 'Sales, billing, customer management'}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* View User Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View detailed information about this user.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-xl font-medium text-primary">
                    {selectedUser.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                  <p className="text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Username</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.username}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Role</Label>
                  <div className="mt-1">
                    <Badge variant={getRoleBadgeVariant(selectedUser.role)} className="flex items-center space-x-1 w-fit">
                      {getRoleIcon(selectedUser.role)}
                      <span>{selectedUser.role}</span>
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Branch</Label>
                  <p className="text-sm text-muted-foreground">{selectedUser.branch?.name || 'Unknown Branch'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    <Badge
                      variant={selectedUser.isActive ? 'default' : 'secondary'}
                      className={selectedUser.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}
                    >
                      {selectedUser.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Created</Label>
                  <p className="text-sm text-muted-foreground">{new Date(selectedUser.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Last Updated</Label>
                  <p className="text-sm text-muted-foreground">{new Date(selectedUser.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave password empty to keep current password.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">
                Name
              </Label>
              <Input
                id="edit-name"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="col-span-3"
                placeholder="Enter full name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-email" className="text-right">
                Email
              </Label>
              <Input
                id="edit-email"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="col-span-3"
                placeholder="Enter email address"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-username" className="text-right">
                Username
              </Label>
              <Input
                id="edit-username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                className="col-span-3"
                placeholder="Enter username"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-password" className="text-right">
                Password
              </Label>
              <Input
                id="edit-password"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="col-span-3"
                placeholder="Enter new password (optional)"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-role" className="text-right">
                Role
              </Label>
              <Select value={newUser.role} onValueChange={(value) => setNewUser({ ...newUser, role: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center space-x-2">
                        {getRoleIcon(role.id)}
                        <span>{role.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-branch" className="text-right">
                Branch
              </Label>
              <Select value={newUser.branchId} onValueChange={(value) => setNewUser({ ...newUser, branchId: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateUser} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <div className="flex items-center space-x-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-lg font-medium text-red-600">
                    {selectedUser.name.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-red-900">{selectedUser.name}</h3>
                  <p className="text-sm text-red-700">{selectedUser.email}</p>
                  <p className="text-sm text-red-600">Role: {selectedUser.role}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteUser}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
