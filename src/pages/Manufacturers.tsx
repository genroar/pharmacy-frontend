import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Edit, Trash2, Building2, Globe, MapPin, Users, Eye, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

interface Manufacturer {
  id: string;
  name: string;
  description?: string;
  website?: string;
  country?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    suppliers: number;
  };
}

const Manufacturers: React.FC = () => {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingManufacturer, setEditingManufacturer] = useState<Manufacturer | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const loadManufacturers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getManufacturers({
        page: currentPage,
        limit: 50,
        search: searchTerm,
        active: statusFilter === 'all' ? undefined : statusFilter === 'active'
      });

      if (response.success && response.data) {
        setManufacturers(response.data.manufacturers);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error loading manufacturers:', error);
      toast.error('Failed to load manufacturers');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    loadManufacturers();
  }, [loadManufacturers]);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handleAddManufacturer = async () => {
    try {
      setIsSubmitting(true);

      if (!formData.name.trim()) {
        toast.error('Manufacturer name is required');
        return;
      }

      const response = await apiService.createManufacturer({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined
      });

      if (response.success) {
        toast.success('Manufacturer created successfully');
        setIsCreateDialogOpen(false);
        setFormData({ name: '', description: '' });
        loadManufacturers();
      } else {
        toast.error(response.message || 'Failed to create manufacturer');
      }
    } catch (error) {
      console.error('Error creating manufacturer:', error);
      toast.error('Failed to create manufacturer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditManufacturer = async () => {
    if (!editingManufacturer) return;

    try {
      setIsSubmitting(true);

      const response = await apiService.updateManufacturer(editingManufacturer.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined
      });

      if (response.success) {
        toast.success('Manufacturer updated successfully');
        setIsEditDialogOpen(false);
        setEditingManufacturer(null);
        setFormData({ name: '', description: '' });
        loadManufacturers();
      } else {
        toast.error(response.message || 'Failed to update manufacturer');
      }
    } catch (error) {
      console.error('Error updating manufacturer:', error);
      toast.error('Failed to update manufacturer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteManufacturer = async (manufacturer: Manufacturer) => {
    if (manufacturer._count.suppliers > 0) {
      toast.error('Cannot delete manufacturer with existing suppliers');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${manufacturer.name}"?`)) {
      try {
        setIsDeleting(manufacturer.id);
        const response = await apiService.deleteManufacturer(manufacturer.id);
        if (response.success) {
          toast.success('Manufacturer deleted successfully');
          loadManufacturers();
        } else {
          toast.error(response.message || 'Failed to delete manufacturer');
        }
      } catch (error) {
        console.error('Error deleting manufacturer:', error);
        toast.error('Failed to delete manufacturer');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  const openEditDialog = (manufacturer: Manufacturer) => {
    setEditingManufacturer(manufacturer);
    setFormData({
      name: manufacturer.name,
      description: manufacturer.description || ''
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setEditingManufacturer(null);
  };

  const filteredManufacturers = useMemo(() => {
    return manufacturers.filter(manufacturer => {
      const matchesSearch = manufacturer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           manufacturer.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' ||
                           (statusFilter === 'active' && manufacturer.isActive) ||
                           (statusFilter === 'inactive' && !manufacturer.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [manufacturers, searchTerm, statusFilter]);

  const renderManufacturerCard = (manufacturer: Manufacturer) => (
    <Card key={manufacturer.id} className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{manufacturer.name}</CardTitle>
          </div>
          <Badge variant={manufacturer.isActive ? 'default' : 'secondary'}>
            {manufacturer.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {manufacturer.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{manufacturer.description}</p>
        )}

        <div className="space-y-2">
          {manufacturer.country && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>{manufacturer.country}</span>
            </div>
          )}

          {manufacturer.website && (
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <Globe className="h-4 w-4" />
              <a
                href={manufacturer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline truncate"
              >
                {manufacturer.website}
              </a>
            </div>
          )}

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Users className="h-4 w-4" />
            <span>{manufacturer._count.suppliers} supplier{manufacturer._count.suppliers !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="flex space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(manufacturer)}
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteManufacturer(manufacturer)}
            disabled={manufacturer._count.suppliers > 0 || isDeleting === manufacturer.id}
            className="flex-1"
          >
            {isDeleting === manufacturer.id ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent mr-1" />
            ) : manufacturer._count.suppliers > 0 ? (
              <AlertTriangle className="h-4 w-4 mr-1" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            {isDeleting === manufacturer.id ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderManufacturerRow = (manufacturer: Manufacturer) => (
    <tr key={manufacturer.id} className="border-b hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="flex items-center space-x-3">
          <Building2 className="h-5 w-5 text-blue-600" />
          <div>
            <div className="font-medium text-gray-900">{manufacturer.name}</div>
            {manufacturer.description && (
              <div className="text-sm text-gray-500 line-clamp-1">{manufacturer.description}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        {manufacturer.country && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span>{manufacturer.country}</span>
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        {manufacturer.website && (
          <a
            href={manufacturer.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline text-sm flex items-center space-x-1"
          >
            <Globe className="h-4 w-4" />
            <span>Website</span>
          </a>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-sm">{manufacturer._count.suppliers}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge variant={manufacturer.isActive ? 'default' : 'secondary'}>
          {manufacturer.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="px-6 py-4">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(manufacturer)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteManufacturer(manufacturer)}
            disabled={manufacturer._count.suppliers > 0 || isDeleting === manufacturer.id}
          >
            {isDeleting === manufacturer.id ? (
              <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
            ) : manufacturer._count.suppliers > 0 ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6 px-[20px] pt-[20px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manufacturers</h1>
          <p className="text-gray-600">Manage pharmaceutical manufacturers and their suppliers</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200">
              <Plus className="h-4 w-4 mr-2" />
              Add Manufacturer
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Manufacturer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter manufacturer name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddManufacturer} disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Manufacturer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search manufacturers..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-r-none"
                >
                  List
                </Button>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-l-none"
                >
                  Grid
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredManufacturers.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No manufacturers found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding your first manufacturer.'}
            </p>

          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredManufacturers.map(renderManufacturerCard)}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Manufacturer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Country
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Suppliers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredManufacturers.map(renderManufacturerRow)}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Manufacturer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter manufacturer name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditManufacturer} disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Manufacturer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Manufacturers;
