import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Plus, Edit, Trash2, Package, MapPin, AlertTriangle, Grid3X3, List } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';

interface Shelf {
  id: string;
  name: string;
  description?: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    batches: number;
  };
}

const Shelves: React.FC = () => {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingShelf, setEditingShelf] = useState<Shelf | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: ''
  });

  const loadShelves = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getShelves({
        page: currentPage,
        limit: 50,
        search: searchTerm,
        active: statusFilter === 'all' ? undefined : statusFilter === 'active'
      });

      if (response.success && response.data) {
        setShelves(response.data.shelves);
        setTotalPages(response.data.pagination.pages);
      }
    } catch (error) {
      console.error('Error loading shelves:', error);
      toast.error('Failed to load shelves');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchTerm, statusFilter]);

  useEffect(() => {
    loadShelves();
  }, [loadShelves]);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handleAddShelf = async () => {
    try {
      if (!formData.name.trim()) {
        toast.error('Shelf name is required');
        return;
      }

      setIsSubmitting(true);
      const response = await apiService.createShelf({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        location: formData.location.trim() || undefined
      });

      if (response.success) {
        toast.success('Shelf created successfully');
        setIsCreateDialogOpen(false);
        setFormData({ name: '', description: '', location: '' });
        loadShelves();
      } else {
        toast.error(response.message || 'Failed to create shelf');
      }
    } catch (error) {
      console.error('Error creating shelf:', error);
      toast.error('Failed to create shelf');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditShelf = async () => {
    if (!editingShelf) return;

    try {
      setIsSubmitting(true);
      const response = await apiService.updateShelf(editingShelf.id, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        location: formData.location.trim() || undefined
      });

      if (response.success) {
        toast.success('Shelf updated successfully');
        setIsEditDialogOpen(false);
        setEditingShelf(null);
        setFormData({ name: '', description: '', location: '' });
        loadShelves();
      } else {
        toast.error(response.message || 'Failed to update shelf');
      }
    } catch (error) {
      console.error('Error updating shelf:', error);
      toast.error('Failed to update shelf');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShelf = async (shelf: Shelf) => {
    if (shelf._count.batches > 0) {
      toast.error('Cannot delete shelf with existing batches');
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${shelf.name}"?`)) {
      try {
        setIsDeleting(true);
        const response = await apiService.deleteShelf(shelf.id);
        if (response.success) {
          toast.success('Shelf deleted successfully');
          loadShelves();
        } else {
          toast.error(response.message || 'Failed to delete shelf');
        }
      } catch (error) {
        console.error('Error deleting shelf:', error);
        toast.error('Failed to delete shelf');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const openEditDialog = (shelf: Shelf) => {
    setEditingShelf(shelf);
    setFormData({
      name: shelf.name,
      description: shelf.description || '',
      location: shelf.location || ''
    });
    setIsEditDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', location: '' });
    setEditingShelf(null);
  };

  const filteredShelves = useMemo(() => {
    return shelves.filter(shelf => {
      const matchesSearch = shelf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           shelf.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           shelf.location?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' ||
                           (statusFilter === 'active' && shelf.isActive) ||
                           (statusFilter === 'inactive' && !shelf.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [shelves, searchTerm, statusFilter]);

  const renderShelfCard = (shelf: Shelf) => (
    <Card key={shelf.id} className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">{shelf.name}</CardTitle>
          </div>
          <Badge variant={shelf.isActive ? 'default' : 'secondary'}>
            {shelf.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {shelf.description && (
          <p className="text-sm text-gray-600 line-clamp-2">{shelf.description}</p>
        )}

        <div className="space-y-2">
          {shelf.location && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4" />
              <span>{shelf.location}</span>
            </div>
          )}

          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Package className="h-4 w-4" />
            <span>{shelf._count.batches} batch{shelf._count.batches !== 1 ? 'es' : ''}</span>
          </div>
        </div>

        <div className="flex space-x-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(shelf)}
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteShelf(shelf)}
            disabled={shelf._count.batches > 0 || isDeleting}
            className="flex-1"
          >
            {shelf._count.batches > 0 ? (
              <AlertTriangle className="h-4 w-4 mr-1" />
            ) : isDeleting ? (
              <div className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  const renderShelfRow = (shelf: Shelf) => (
    <tr key={shelf.id} className="border-b hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="flex items-center space-x-3">
          <Package className="h-5 w-5 text-blue-600" />
          <div>
            <div className="font-medium text-gray-900">{shelf.name}</div>
            {shelf.description && (
              <div className="text-sm text-gray-500 line-clamp-1">{shelf.description}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        {shelf.location && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            <span>{shelf.location}</span>
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-2">
          <Package className="h-4 w-4 text-gray-400" />
          <span className="text-sm">{shelf._count.batches}</span>
        </div>
      </td>
      <td className="px-6 py-4">
        <Badge variant={shelf.isActive ? 'default' : 'secondary'}>
          {shelf.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      <td className="px-6 py-4">
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openEditDialog(shelf)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDeleteShelf(shelf)}
            disabled={shelf._count.batches > 0 || isDeleting}
          >
            {shelf._count.batches > 0 ? (
              <AlertTriangle className="h-4 w-4" />
            ) : isDeleting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="space-y-6 p-[20px] ">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shelves</h1>
          <p className="text-gray-600">Manage storage shelves and their locations</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className='bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200' >
              <Plus className="h-4 w-4 mr-2" />
              Add Shelf
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Shelf</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter shelf name"
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
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Enter location (e.g., Warehouse A, Room 101)"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddShelf} disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Shelf'}
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
                  placeholder="Search shelves..."
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
                  <SelectItem
                    value="all"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    All Status
                  </SelectItem>
                  <SelectItem
                    value="active"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Active
                  </SelectItem>
                  <SelectItem
                    value="inactive"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Inactive
                  </SelectItem>
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
      ) : filteredShelves.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No shelves found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding your first shelf.'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Shelf
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredShelves.map(renderShelfCard)}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shelf
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batches
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
                {filteredShelves.map(renderShelfRow)}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Shelf</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter shelf name"
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
            <div>
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Enter location (e.g., Warehouse A, Room 101)"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditShelf} disabled={isSubmitting}>
                {isSubmitting ? 'Updating...' : 'Update Shelf'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shelves;
