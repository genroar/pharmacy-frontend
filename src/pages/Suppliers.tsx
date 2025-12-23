import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Eye,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  Package,
  Grid3X3,
  List,
  AlertTriangle,
  CheckCircle,
  X
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { toast } from "@/hooks/use-toast";

interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  manufacturerId?: string;
  manufacturer?: {
    id: string;
    name: string;
    country?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
  };
}

interface Manufacturer {
  id: string;
  name: string;
  country?: string;
}

const Suppliers = () => {
  const { user } = useAuth();
  const { selectedCompanyId, selectedBranchId, selectedBranch } = useAdmin();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state for adding/editing suppliers
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    manufacturerId: ''
  });

  // Load manufacturers
  const loadManufacturers = async () => {
    try {
      const response = await apiService.getManufacturers({
        page: 1,
        limit: 100,
        active: true
      });

      if (response.success) {
        setManufacturers(response.data.manufacturers || []);
      }
    } catch (error) {
      console.error('Error loading manufacturers:', error);
    }
  };

  // Load suppliers
  const loadSuppliers = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading suppliers for branch:', selectedBranchId, 'company:', selectedCompanyId);
      const response = await apiService.getSuppliers({
        page: 1,
        limit: 100,
        search: searchQuery
      });
      console.log('🔍 Suppliers API response:', response);

      if (response.success) {
        setSuppliers(response.data.suppliers || []);
      } else {
        setError('Failed to load suppliers');
      }
    } catch (err) {
      console.error('Error loading suppliers:', err);
      setError('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  // Reload suppliers when branch or company changes
  useEffect(() => {
    loadSuppliers();
    loadManufacturers();
  }, [searchQuery, selectedBranchId, selectedCompanyId]);

  // Filter suppliers based on search
  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         supplier.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         supplier.phone.includes(searchQuery);
    return matchesSearch;
  });

  // Get stats
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter(s => s.isActive).length;
  const inactiveSuppliers = suppliers.filter(s => !s.isActive).length;

  const handleAddSupplier = async () => {
    try {
      setIsSubmitting(true);

      // Clean up form data - convert empty strings to undefined for optional fields
      const cleanedFormData = {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        email: formData.email?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        manufacturerId: formData.manufacturerId || undefined
      };

      // CRITICAL: Create supplier - embedded server saves to SQLite FIRST
      // Then optionally syncs to PostgreSQL backend (non-blocking)
      const response = await apiService.createSupplier(cleanedFormData);

      // CRITICAL: Show success if SQLite save succeeded (response.success === true)
      // This means data is saved locally, regardless of backend sync status
      if (response.success) {
        // SQLite save succeeded - show success immediately
        toast({
          title: "Supplier Added",
          description: "Supplier has been added successfully.",
        });
        setShowAddDialog(false);
        setFormData({
          name: '',
          contactPerson: '',
          phone: '',
          email: '',
          address: '',
          manufacturerId: ''
        });
        // Reload to show the new supplier
        setTimeout(() => loadSuppliers(), 500);
        return;
      }

      // Handle offline mode - embedded server saved to SQLite but backend sync failed
      // This is still a success from user perspective (data is saved locally)
      if (response.code === 'OFFLINE_MODE') {
        // Data was saved to SQLite via embedded server
        // Backend sync will happen later when backend is available
        toast({
          title: "Supplier Added (Offline)",
          description: "Supplier has been saved locally. It will sync when connection is restored.",
        });
        setShowAddDialog(false);
        setFormData({
          name: '',
          contactPerson: '',
          phone: '',
          email: '',
          address: '',
          manufacturerId: ''
        });
        // Reload to show the new supplier from SQLite
        setTimeout(() => loadSuppliers(), 1000);
        return;
      }

      // Only show error for actual failures (validation, database errors, etc.)
      // NOT for network/backend unavailability (that's handled above)
      toast({
        title: "Error",
        description: response.message || "Failed to add supplier",
        variant: "destructive",
      });
    } catch (err: any) {
      console.error('Error adding supplier:', err);
      // Check if it's a timeout
      if (err.message?.includes('timeout') || err.name === 'AbortError') {
        toast({
          title: "Supplier Added (Offline)",
          description: "Supplier has been saved locally. It will sync when connection is restored.",
        });
        setShowAddDialog(false);
        setFormData({ name: '', contactPerson: '', phone: '', email: '', address: '', manufacturerId: '' });
        setTimeout(() => loadSuppliers(), 1000);
      } else {
        toast({
          title: "Error",
          description: "Failed to add supplier",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSupplier = async () => {
    if (!editingSupplier) return;

    try {
      setIsSubmitting(true);

      // Clean up form data - convert empty strings to undefined for optional fields
      const cleanedFormData = {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.phone.trim(),
        email: formData.email?.trim() || undefined,
        address: formData.address?.trim() || undefined,
        manufacturerId: formData.manufacturerId || undefined
      };
      console.log('🔍 Editing supplier:', editingSupplier.id);
      console.log('🔍 Form data:', cleanedFormData);
      const response = await apiService.updateSupplier(editingSupplier.id, cleanedFormData);
      console.log('🔍 Update response:', response);

      if (response.success) {
        toast({
          title: "Supplier Updated",
          description: "Supplier has been updated successfully.",
        });
        setEditingSupplier(null);
        setFormData({
          name: '',
          contactPerson: '',
          phone: '',
          email: '',
          address: '',
          manufacturerId: ''
        });
        loadSuppliers();
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to update supplier",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error updating supplier:', err);
      toast({
        title: "Error",
        description: "Failed to update supplier",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;

    try {
      setIsDeleting(true);
      console.log('🔍 Deleting supplier:', deletingSupplier.id);
      const response = await apiService.deleteSupplier(deletingSupplier.id);
      console.log('🔍 Delete response:', response);

      if (response.success) {
        toast({
          title: "Supplier Deleted",
          description: "Supplier has been deleted successfully.",
        });
        setDeletingSupplier(null);
        setShowDeleteDialog(false);
        loadSuppliers();
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to delete supplier",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error deleting supplier:', err);
      toast({
        title: "Error",
        description: "Failed to delete supplier",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openEditDialog = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email || '',
      address: supplier.address || '',
      manufacturerId: supplier.manufacturerId || ''
    });
  };

  const openDeleteDialog = (supplier: Supplier) => {
    setDeletingSupplier(supplier);
    setShowDeleteDialog(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading suppliers...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600">{error}</p>
            <Button onClick={loadSuppliers} className="mt-4">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-6">
      {/* Branch Context Info */}
      {selectedBranchId && selectedBranch && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-purple-600" />
          <span className="text-purple-800">
            Showing suppliers for: <strong>{selectedBranch.name}</strong>
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <Building2 className="w-8 h-8 mr-3 text-purple-600" />
            Suppliers
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your suppliers and vendor information • {totalSuppliers} suppliers total
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center bg-white rounded-lg border border-gray-200">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="rounded-r-none"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="rounded-l-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Suppliers</p>
                <p className="text-2xl font-bold text-purple-600">{totalSuppliers}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active</p>
                <p className="text-2xl font-bold text-green-600">{activeSuppliers}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Inactive</p>
                <p className="text-2xl font-bold text-red-600">{inactiveSuppliers}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <X className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="mb-6 bg-white border-0 shadow-soft">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Suppliers</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search by name, contact person, phone, email, or address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers List */}
      <Card className="bg-white border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="w-5 h-5 mr-2 text-purple-600" />
            Suppliers ({filteredSuppliers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery ? 'Try adjusting your search criteria' : 'Get started by adding your first supplier'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setShowAddDialog(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Supplier
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSuppliers.map((supplier) => (
                <Card key={supplier.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{supplier.name}</h3>
                          <p className="text-sm text-gray-500">{supplier.contactPerson}</p>
                          {supplier.manufacturer && (
                            <p className="text-xs text-blue-600 flex items-center">
                              <Building2 className="h-3 w-3 mr-1" />
                              {supplier.manufacturer.name}
                              {supplier.manufacturer.country && ` (${supplier.manufacturer.country})`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(supplier)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => openDeleteDialog(supplier)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-2" />
                        {supplier.phone}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                      <Badge variant={supplier.isActive ? "default" : "secondary"}>
                        {supplier.isActive ? "Active" : "Inactive"}
                      </Badge>
                      {supplier._count && (
                        <div className="flex items-center text-sm text-gray-500">
                          <Package className="w-4 h-4 mr-1" />
                          {supplier._count.products} products
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Supplier</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Contact</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Phone</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Manufacturer</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Products</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{supplier.name}</p>
                            <p className="text-sm text-gray-500">{supplier.contactPerson}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <User className="w-4 h-4 mr-2" />
                          {supplier.contactPerson}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Phone className="w-4 h-4 mr-2" />
                          {supplier.phone}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {supplier.manufacturer ? (
                          <div className="flex items-center text-sm text-blue-600">
                            <Building2 className="w-4 h-4 mr-2" />
                            <div>
                              <div className="font-medium">{supplier.manufacturer.name}</div>
                              {supplier.manufacturer.country && (
                                <div className="text-xs text-gray-500">{supplier.manufacturer.country}</div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">No manufacturer</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <Badge variant={supplier.isActive ? "default" : "secondary"}>
                          {supplier.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <Package className="w-4 h-4 mr-1" />
                          {supplier._count?.products || 0}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(supplier)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => openDeleteDialog(supplier)}
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
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Supplier Dialog */}
      <Dialog open={showAddDialog || !!editingSupplier} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingSupplier(null);
          setFormData({
            name: '',
            contactPerson: '',
            phone: '',
            email: '',
            address: '',
            manufacturerId: ''
          });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Building2 className="w-5 h-5 mr-2 text-purple-600" />
              {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier ? 'Update supplier information' : 'Enter supplier details to add them to your system'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter supplier name"
                />
              </div>
              <div>
                <Label htmlFor="contactPerson">Contact Person *</Label>
                <Input
                  id="contactPerson"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="Enter contact person name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Enter supplier address"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="manufacturer">Manufacturer (Optional)</Label>
              <select
                id="manufacturer"
                value={formData.manufacturerId}
                onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Select manufacturer"
              >
                <option value="">Select a manufacturer</option>
                {manufacturers.map((manufacturer) => (
                  <option key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.name} {manufacturer.country && `(${manufacturer.country})`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button

              variant="outline"
              onClick={() => {
                setShowAddDialog(false);
                setEditingSupplier(null);
                setFormData({
                  name: '',
                  contactPerson: '',
                  phone: '',
                  email: '',
                  address: ''
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingSupplier ? handleEditSupplier : handleAddSupplier}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!formData.name || !formData.contactPerson || !formData.phone || isSubmitting}
            >
              {isSubmitting ? 'Saving...' : (editingSupplier ? 'Update' : 'Add') + ' Supplier'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span>Confirm Delete</span>
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The supplier will be permanently removed from your system.
            </DialogDescription>
          </DialogHeader>

          {deletingSupplier && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    Delete Supplier
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Are you sure you want to delete this supplier?
                  </p>
                  <div className="mt-3 p-3 bg-gray-50 rounded-md">
                    <p className="text-sm font-medium text-gray-900">
                      {deletingSupplier.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {deletingSupplier.contactPerson} • {deletingSupplier.email}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSupplier}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              {isDeleting ? 'Deleting...' : 'Delete Supplier'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Suppliers;
