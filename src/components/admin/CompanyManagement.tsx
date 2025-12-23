import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Store,
  ArrowRight,
  AlertTriangle
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
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
  const { setSelectedCompanyId, refreshCompanies: refreshGlobalCompanies, refreshBranches: refreshGlobalBranches } = useAdmin();
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
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
      errors.name = 'Business name is required';
    } else if (formData.name.length < 2) {
      errors.name = 'Business name must be at least 2 characters';
    } else if (formData.name.length > 100) {
      errors.name = 'Business name must be less than 100 characters';
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
        description: "Failed to load businesses",
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
      setFormErrors(prev => ({ ...prev, name: 'A business with this name already exists' }));
      toast({
        title: "Error",
        description: "A business with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiService.createCompany(formData);
      if (response.success) {
        toast({
          title: "Success",
          description: "Business created successfully",
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
        // Refresh global companies to update dropdown instantly
        await refreshGlobalCompanies();
        console.log('✅ Company created and global dropdown updated');
      }
    } catch (error: any) {
      console.error('Error creating company:', error);

      // Handle specific server validation errors
      if (error.message && error.message.includes('already exists')) {
        setFormErrors(prev => ({ ...prev, name: 'A business with this name already exists' }));
        toast({
          title: "Error",
          description: "A business with this name already exists. Please choose a different name.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create business",
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
      setFormErrors(prev => ({ ...prev, name: 'A business with this name already exists' }));
      toast({
        title: "Error",
        description: "A business with this name already exists. Please choose a different name.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiService.updateCompany(selectedCompany.id, formData);
      if (response.success) {
        toast({
          title: "Success",
          description: "Business updated successfully",
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
        // Refresh global companies to update dropdown instantly
        await refreshGlobalCompanies();
        console.log('✅ Company updated and global dropdown updated');
      }
    } catch (error: any) {
      console.error('Error updating company:', error);

      // Handle specific server validation errors
      if (error.message && error.message.includes('already exists')) {
        setFormErrors(prev => ({ ...prev, name: 'A business with this name already exists' }));
        toast({
          title: "Error",
          description: "A business with this name already exists. Please choose a different name.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to update business",
          variant: "destructive",
        });
      }
    }
  };

  const openDeleteDialog = (company: Company) => {
    setCompanyToDelete(company);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteCompany = async () => {
    if (!companyToDelete) return;

    try {
      const response = await apiService.deleteCompany(companyToDelete.id);
      if (response.success) {
        toast({
          title: "Success",
          description: "Business deleted successfully",
        });
        setIsDeleteDialogOpen(false);
        setCompanyToDelete(null);
        loadCompanies();
        // Refresh global companies and branches to update dropdowns instantly
        await refreshGlobalCompanies();
        await refreshGlobalBranches();
        console.log('✅ Business deleted and global dropdowns updated');
      }
    } catch (error: any) {
      console.error('Error deleting business:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete business",
        variant: "destructive",
      });
    }
  };

  const handleClickToGo = (companyId: string) => {
    // Clear branch selection from localStorage to show all branches by default
    if (user?.id) {
      localStorage.removeItem(`selected_branch_${user.id}`);
    }

    // Set the selected company in AdminContext
    setSelectedCompanyId(companyId);

    // Find the selected company details
    const company = companies.find(c => c.id === companyId);

    // Show success message
    toast({
      title: "Business Selected",
      description: `You are now viewing ${company?.name || 'the selected business'}'s dashboard.`,
      duration: 3000,
    });

    // Navigate to the main dashboard with the selected company context
    navigate('/');
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
          <p className="mt-2 text-gray-600">Loading businesses...</p>
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
                      ? 'Manage your businesses and their branches'
                      : 'Manage all businesses and their branches'
                    }
                  </p>
                </div>
              </div>
            </div>
            <div className="flex  items-end gap-[20px] space-y-3">
              <div className="text-right flex  items-center gap-[10px] ">
                <p className="text-sm text-gray-500">Total Businesses :</p>
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
                    Create Business
                  </Button>
                </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Business</DialogTitle>
              <DialogDescription>
                Add a new business to your account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Business Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter business name"
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
                  placeholder="Enter business description"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter business address"
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
                Create Business
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Businesses Found</h3>
            <p className="text-gray-600 mb-4">Get started by creating your first business</p>
            <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Business
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <span>Businesses Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold text-gray-900">Business</TableHead>
                    <TableHead className="font-semibold text-gray-900">Contact</TableHead>
                    <TableHead className="font-semibold text-gray-900">Branches</TableHead>
                    <TableHead className="font-semibold text-gray-900">Staff</TableHead>
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
                          <span className="font-semibold text-blue-700">{company._count.users + company._count.employees}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm text-gray-600">{formatDate(company.createdAt)}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center justify-center space-x-2">
                          <Button
                            onClick={() => handleClickToGo(company.id)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-sm"
                          >
                            Manage
                            <ArrowRight className="w-3 h-3 ml-1" />
                          </Button>
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
                            onClick={() => openDeleteDialog(company)}
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
            <DialogTitle>Edit Business</DialogTitle>
            <DialogDescription>
              Update business information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Business Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter business name"
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
                placeholder="Enter business description"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter business address"
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
              Update Business
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <DialogTitle className="text-xl font-bold text-gray-900 text-center">
              Delete Business
            </DialogTitle>
            <DialogDescription className="text-center text-gray-600 mt-2">
              Are you sure you want to delete <span className="font-semibold text-gray-900">"{companyToDelete?.name}"</span>?
              This action cannot be undone and will remove all associated data including branches, staff, and products.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-800">
                <p className="font-medium mb-1">Warning: This will permanently delete:</p>
                <ul className="list-disc list-inside space-y-1 text-red-700">
                  <li>All branches ({companyToDelete?.branches?.length || 0})</li>
                  <li>All staff members ({(companyToDelete?._count?.users || 0) + (companyToDelete?._count?.employees || 0)})</li>
                  <li>All products and inventory data</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6 flex gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              className="flex-1 border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteCompany}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Business
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyManagement;
