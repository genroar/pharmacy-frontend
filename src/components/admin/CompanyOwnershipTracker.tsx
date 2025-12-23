import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2,
  Users,
  Search,
  Filter,
  User,
  Mail,
  Calendar,
  Shield,
  Eye
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';

interface CompanyOwnership {
  companyId: string;
  companyName: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  createdAt: string;
  branchesCount: number;
  usersCount: number;
  isActive: boolean;
}

const CompanyOwnershipTracker = () => {
  const { user } = useAuth();
  const [ownershipData, setOwnershipData] = useState<CompanyOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');

  useEffect(() => {
    loadOwnershipData();
  }, []);

  const loadOwnershipData = async () => {
    try {
      setLoading(true);

      // Load companies with ownership information
      const companiesResponse = await apiService.getCompanies();

      if (companiesResponse.success && companiesResponse.data) {
        const ownershipInfo: CompanyOwnership[] = [];

        for (const company of companiesResponse.data) {
          // Get admin information for each company
          if (company.createdBy) {
            try {
              const adminResponse = await apiService.getUser(company.createdBy);
              if (adminResponse.success && adminResponse.data) {
                ownershipInfo.push({
                  companyId: company.id,
                  companyName: company.name,
                  adminId: company.createdBy,
                  adminName: adminResponse.data.name,
                  adminEmail: adminResponse.data.email,
                  adminRole: adminResponse.data.role,
                  createdAt: company.createdAt,
                  branchesCount: company.branches?.length || 0,
                  usersCount: company._count?.users || 0,
                  isActive: company.isActive
                });
              }
            } catch (error) {
              console.error(`Error loading admin for company ${company.id}:`, error);
              // Add company with unknown admin
              ownershipInfo.push({
                companyId: company.id,
                companyName: company.name,
                adminId: company.createdBy,
                adminName: 'Unknown Admin',
                adminEmail: 'N/A',
                adminRole: 'UNKNOWN',
                createdAt: company.createdAt,
                branchesCount: company.branches?.length || 0,
                usersCount: company._count?.users || 0,
                isActive: company.isActive
              });
            }
          }
        }

        setOwnershipData(ownershipInfo);
      }
    } catch (error) {
      console.error('Error loading ownership data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-blue-100 text-blue-800';
      case 'SUPERADMIN': return 'bg-red-100 text-red-800';
      case 'MANAGER': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredData = ownershipData.filter(item => {
    const matchesSearch = item.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.adminName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.adminEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === 'all' || item.adminRole === filterRole;

    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading ownership data...</p>
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
          <h1 className="text-3xl font-bold text-foreground">Company Ownership Tracker</h1>
          <p className="text-muted-foreground">
            Track which admin owns which company
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search businesses, admins, or emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Filter by role"
          >
            <option value="all">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPERADMIN">Super Admin</option>
            <option value="MANAGER">Manager</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{ownershipData.length}</p>
                <p className="text-sm text-muted-foreground">Total Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">
                  {new Set(ownershipData.map(item => item.adminId)).size}
                </p>
                <p className="text-sm text-muted-foreground">Unique Admins</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {ownershipData.filter(item => item.adminRole === 'ADMIN').length}
                </p>
                <p className="text-sm text-muted-foreground">Admin Owned</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">
                  {ownershipData.reduce((sum, item) => sum + item.branchesCount, 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Branches</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ownership List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredData.map((item) => (
          <Card key={item.companyId} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{item.companyName}</CardTitle>
                <Badge
                  variant={item.isActive ? "default" : "secondary"}
                  className={item.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                >
                  {item.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Admin Information */}
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center space-x-2 mb-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-sm">Company Owner</span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-gray-900">{item.adminName}</p>
                    <p className="text-sm text-gray-600">{item.adminEmail}</p>
                    <Badge className={getRoleColor(item.adminRole)}>
                      {item.adminRole}
                    </Badge>
                  </div>
                </div>

                {/* Company Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <p className="text-2xl font-bold text-blue-600">{item.branchesCount}</p>
                    <p className="text-xs text-gray-600">Branches</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <p className="text-2xl font-bold text-green-600">{item.usersCount}</p>
                    <p className="text-xs text-gray-600">Staff</p>
                  </div>
                </div>

                {/* Creation Date */}
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Created: {formatDate(item.createdAt)}</span>
                </div>

                {/* Actions */}
                <div className="flex space-x-2 pt-2 border-t">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Mail className="w-4 h-4 mr-1" />
                    Contact Admin
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredData.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No companies found</h3>
          <p className="text-muted-foreground">
            {searchQuery || filterRole !== "all"
              ? "Try adjusting your search criteria"
              : "No businesses have been created yet"
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default CompanyOwnershipTracker;
