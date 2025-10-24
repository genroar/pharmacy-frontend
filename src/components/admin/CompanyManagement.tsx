import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Phone,
  Mail,
  Users,
  Package,
  Store
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface Company {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdBy: string | null;
  createdByUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  branches: Array<{
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
  }>;
  _count: {
    users: number;
    employees: number;
    products: number;
  };
}

const CompanyManagement = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: ''
  });
  const [formErrors, setFormErrors] = useState({
    name: '',
    description: '',
    address: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    loadCompanies();
  }, []);

  const validateForm = () => {
    const errors = {
      name: '',
      description: '',
      address: '',
      phone: '',
      email: ''
    };

    if (!formData.name.trim()) {
      errors.name = 'Company name is required';
    } else if (formData.name.length < 2) {
      errors.name = 'Company name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      errors.name = 'Company name must be less than 100 characters';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    setFormErrors(errors);
    return !Object.values(errors).some(error => error !== '');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (formErrors[field as keyof typeof formErrors]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const openCreateDialog = () => {
    setFormData({
      name: '',
      description: '',
      address: '',
      phone: '',
      email: ''
    });
    setFormErrors({
      name: '',
      description: '',
      address: '',
      phone: '',
      email: ''
    });
    setIsCreateDialogOpen(true);
  };

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCompanies();
      if (response.success) {
        let filteredCompanies = response.data;

        // Filter companies based on user role and ownership
        if (user?.role === 'ADMIN') {
          // ADMIN can only see companies they created
          filteredCompanies = response.data.filter(company =>
            company.createdBy === user.id
          );
        } else if (user?.role === 'SUPERADMIN') {
          // SUPERADMIN can see all companies
          filteredCompanies = response.data;
        }

        setCompanies(filteredCompanies);

        // Debug: Log ownership information
        console.log('🏢 Company Ownership Information:');
        console.log('Current User:', user?.name, `(${user?.role})`);
        console.log('Total Companies:', response.data.length);
        console.log('Filtered Companies:', filteredCompanies.length);
        filteredCompanies.forEach(company => {
          console.log(`📋 ${company.name} - Created by: ${company.createdBy} (${company.createdBy === user?.id ? '✅ YOUR COMPANY' : '❌ NOT YOURS'})`);
        });
      }
    } catch (error) {
      console.error('Error loading companies:', error);
      toast({
        title: "Error",
        description: "Failed to load companies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompany = async () => {
    // Validate form first
    if (!validateForm()) {
      return;
    }

    // Check if company name already exists (client-side check)
    const existingCompany = companies.find(company =>
      company.name.toLowerCase() === formData.name.toLowerCase()
    );

    if (existingCompany) {
      setFormErrors(prev => ({ ...prev, name: 'A company with this name already exists' }));
      toast({
        title: "Error",
        description: "A company with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiService.createCompany(formData);
      if (response.success) {
        toast({
          title: "Success",
          description: "Company created successfully",
        });
        setIsCreateDialogOpen(false);
        setFormData({
          name: '',
          description: '',
          address: '',
          phone: '',
          email: ''
        });
        setFormErrors({
          name: '',
          description: '',
          address: '',
          phone: '',
          email: ''
        });
        loadCompanies();
      }
    } catch (error: any) {
      console.error('Error creating company:', error);

      // Handle specific server validation errors
      if (error.message && error.message.includes('already exists')) {
        setFormErrors(prev => ({ ...prev, name: 'A company with this name already exists' }));
        toast({
          title: "Error",
          description: "A company with this name already exists. Please choose a different name.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create company",
          variant: "destructive",
        });
      }
    }
  };

  const handleEditCompany = async () => {
    if (!selectedCompany) return;

    // Validate form first
    if (!validateForm()) {
      return;
    }

    // Check if company name already exists (excluding current company)
    const existingCompany = companies.find(company =>
      company.id !== selectedCompany.id &&
      company.name.toLowerCase() === formData.name.toLowerCase()
    );

    if (existingCompany) {
      setFormErrors(prev => ({ ...prev, name: 'A company with this name already exists' }));
      toast({
        title: "Error",
        description: "A company with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiService.updateCompany(selectedCompany.id, formData);
      if (response.success) {
        toast({
          title: "Success",
          description: "Company updated successfully",
        });
        setIsEditDialogOpen(false);
        setSelectedCompany(null);
        setFormData({
          name: '',
          description: '',
          address: '',
          phone: '',
          email: ''
        });
        loadCompanies();
      }
    } catch (error: any) {
      console.error('Error updating company:', error);

      // Handle specific server validation errors
      if (error.message && error.message.includes('already exists')) {
        setFormErrors(prev => ({ ...prev, name: 'A company with this name already exists' }));
        toast({
          title: "Error",
          description: "A company with this name already exists. Please choose a different name.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update company",
          variant: "destructive",
        });
      }
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    if (!confirm('Are you sure you want to delete this company? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await apiService.deleteCompany(companyId);
      if (response.success) {
        toast({
          title: "Success",
          description: "Company deleted successfully",
        });
        loadCompanies();
      }
    } catch (error: any) {
      console.error('Error deleting company:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete company",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (company: Company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name,
      description: company.description || '',
      address: company.address || '',
      phone: company.phone || '',
      email: company.email || ''
    });
    setIsEditDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="space-y-8 p-6">
        {/* Enhanced Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex justify-between items-start">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl">
                  <Building2 className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Business Management
                  </h1>
                  <p className="text-gray-600 text-lg">
                    {user?.role === 'ADMIN'
                      ? 'Manage your companies and their branches'
                      : 'Manage all companies and their branches'
                    }
                  </p>
                </div>
              </div>
              {user?.role === 'ADMIN' && (
                <div className="flex items-center space-x-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p className="text-sm text-blue-700 font-medium">
                    📋 You can only see companies you created
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col items-end space-y-3">
              <div className="text-right">
                <p className="text-sm text-gray-500">Total Companies</p>
                <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
                if (open) {
                  openCreateDialog();
                } else {
                  setIsCreateDialogOpen(false);
                }
              }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Company
                  </Button>
                </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Company</DialogTitle>
              <DialogDescription>
                Add a new company to your account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter company name"
                  className={formErrors.name ? 'border-red-500' : ''}
                />
                {formErrors.name && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>
                )}
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter company description"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter company address"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="Enter email address"
                    className={formErrors.email ? 'border-red-500' : ''}
                  />
                  {formErrors.email && (
                    <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCompany} disabled={!formData.name.trim()}>
                Create Company
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
            </div>
          </div>
        </div>

      {/* Companies Table */}
      {companies.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Companies Found</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first company</p>
            <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Company
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Companies Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">Company</TableHead>
                    <TableHead className="font-semibold text-gray-900">Contact</TableHead>
                    <TableHead className="font-semibold text-gray-900">Branches</TableHead>
                    <TableHead className="font-semibold text-gray-900">Users</TableHead>
                    <TableHead className="font-semibold text-gray-900">Products</TableHead>
                    <TableHead className="font-semibold text-gray-900">Owner</TableHead>
                    <TableHead className="font-semibold text-gray-900">Created</TableHead>
                    <TableHead className="font-semibold text-gray-900 text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="py-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Building2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{company.name}</p>
                              {company.description && (
                                <p className="text-sm text-gray-600 line-clamp-2">{company.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="space-y-1">
                          {company.address && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <MapPin className="w-3 h-3 text-blue-500" />
                              <span className="truncate max-w-32">{company.address}</span>
                            </div>
                          )}
                          {company.phone && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Phone className="w-3 h-3 text-green-500" />
                              <span>{company.phone}</span>
                            </div>
                          )}
                          {company.email && (
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Mail className="w-3 h-3 text-purple-500" />
                              <span className="truncate max-w-32">{company.email}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center space-x-2">
                          <Store className="w-4 h-4 text-green-600" />
                          <span className="font-semibold text-green-700">{company.branches.length}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center space-x-2">
                          <Users className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold text-blue-700">{company._count.users}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4 text-purple-600" />
                          <span className="font-semibold text-purple-700">{company._count.products}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="space-y-1">
                          <p className="font-medium text-gray-900">
                            {company.createdByUser?.name || 'Unknown Admin'}
                          </p>
                          {company.createdByUser && (
                            <p className="text-xs text-gray-500">{company.createdByUser.role}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm text-gray-600">{formatDate(company.createdAt)}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center justify-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(company)}
                            className="h-8 w-8 p-0 hover:bg-blue-100"
                          >
                            <Edit className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteCompany(company.id)}
                            className="h-8 w-8 p-0 hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update company information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Company Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter company name"
                className={formErrors.name ? 'border-red-500' : ''}
              />
              {formErrors.name && (
                <p className="text-sm text-red-600 mt-1">{formErrors.name}</p>
              )}
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter company description"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter company address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                  className={formErrors.email ? 'border-red-500' : ''}
                />
                {formErrors.email && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.email}</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditCompany} disabled={!formData.name.trim()}>
              Update Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyManagement;
