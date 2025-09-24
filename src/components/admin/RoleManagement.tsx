import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Shield,
  UserCog,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { RoleGuard } from '@/components/auth/RoleGuard';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  branch: string;
  isActive: boolean;
  lastLogin?: string;
}

interface RoleInfo {
  role: string;
  description: string;
  permissions: string[];
  color: string;
}

const roleInfo: Record<string, RoleInfo> = {
  PRODUCT_OWNER: {
    role: 'Product Owner',
    description: 'Full control of the POS product itself, handling subscriptions and client pharmacies',
    permissions: ['Manage all pharmacies', 'Handle subscriptions', 'System-wide analytics', 'Billing management'],
    color: 'bg-purple-100 text-purple-800'
  },
  SUPER_ADMIN: {
    role: 'Super Admin',
    description: 'Full access across all branches of their pharmacy',
    permissions: ['Manage all users', 'Manage all branches', 'Full system control', 'All reports access'],
    color: 'bg-red-100 text-red-800'
  },
  MANAGER: {
    role: 'Manager',
    description: 'Manages one store/branch operations',
    permissions: ['Manage branch users', 'Manage inventory', 'View branch reports', 'Approve refunds'],
    color: 'bg-blue-100 text-blue-800'
  },
  PHARMACIST: {
    role: 'Pharmacist',
    description: 'Ensures prescriptions and medicine sales are compliant',
    permissions: ['Validate prescriptions', 'Manage medication history', 'Update product details', 'Customer care'],
    color: 'bg-green-100 text-green-800'
  },
  CASHIER: {
    role: 'Cashier',
    description: 'Handles customer checkout and frontend sales',
    permissions: ['Process sales', 'Handle payments', 'Issue receipts', 'Basic customer management'],
    color: 'bg-yellow-100 text-yellow-800'
  }
};

const RoleManagement: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>('');

  // Mock data - replace with actual API calls
  useEffect(() => {
    const mockUsers: User[] = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        role: 'SUPER_ADMIN',
        branch: 'Main Branch',
        isActive: true,
        lastLogin: '2024-01-15T10:30:00Z'
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        role: 'MANAGER',
        branch: 'Downtown Branch',
        isActive: true,
        lastLogin: '2024-01-15T09:15:00Z'
      },
      {
        id: '3',
        name: 'Dr. Mike Johnson',
        email: 'mike@example.com',
        role: 'PHARMACIST',
        branch: 'Main Branch',
        isActive: true,
        lastLogin: '2024-01-15T08:45:00Z'
      },
      {
        id: '4',
        name: 'Sarah Wilson',
        email: 'sarah@example.com',
        role: 'CASHIER',
        branch: 'Downtown Branch',
        isActive: false,
        lastLogin: '2024-01-10T16:20:00Z'
      }
    ];

    setUsers(mockUsers);
    setLoading(false);
  }, []);

  const handleRoleChange = (userId: string, newRole: string) => {
    setUsers(users.map(user =>
      user.id === userId ? { ...user, role: newRole } : user
    ));
    setSelectedUser(null);
    setNewRole('');
  };

  const getRoleBadge = (role: string) => {
    const info = roleInfo[role];
    if (!info) return null;

    return (
      <Badge className={info.color}>
        {info.role}
      </Badge>
    );
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <XCircle className="w-4 h-4 text-red-500" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Role Management</h1>
          <p className="text-muted-foreground">
            Manage user roles and permissions across your pharmacy system
          </p>
        </div>
        <RoleGuard roles={['PRODUCT_OWNER', 'SUPER_ADMIN']}>
          <Button>
            <UserCog className="w-4 h-4 mr-2" />
            Add User
          </Button>
        </RoleGuard>
      </div>

      {/* Role Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(roleInfo).map(([key, info]) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle className="text-sm">{info.role}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2">
                {info.description}
              </p>
              <div className="text-2xl font-bold text-foreground">
                {users.filter(u => u.role === key).length}
              </div>
              <p className="text-xs text-muted-foreground">users</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getRoleBadge(user.role)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(user.isActive)}
                      <span className="text-sm">
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleDateString()
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <RoleGuard roles={['PRODUCT_OWNER', 'SUPER_ADMIN']}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewRole(user.role);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </RoleGuard>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Role Change Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Change User Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Changing role for: <strong>{selectedUser.name}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Current role: {getRoleBadge(selectedUser.role)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  New Role
                </label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(roleInfo).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center space-x-2">
                          <Badge className={info.color}>
                            {info.role}
                          </Badge>
                          <span className="text-sm">{info.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newRole && newRole !== selectedUser.role && (
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Role Change Warning</p>
                      <p className="text-muted-foreground">
                        This will change the user's permissions and access levels.
                        Please ensure this change is authorized.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedUser(null);
                    setNewRole('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleRoleChange(selectedUser.id, newRole)}
                  disabled={!newRole || newRole === selectedUser.role}
                >
                  Update Role
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
