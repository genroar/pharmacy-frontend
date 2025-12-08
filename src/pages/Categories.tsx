import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Filter,
  Package,
  AlertTriangle,
  AlertCircle,
  Barcode,
  Edit,
  Trash2,
  Eye,
  Tag,
  Folder,
  FolderOpen,
  Grid3X3,
  List,
  MoreHorizontal,
  Copy,
  Archive,
  Star,
  StarOff
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { toast } from "@/hooks/use-toast";
import CategoryForm from "@/components/inventory/CategoryForm";

interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    products: number;
  };
  // Frontend-only fields for enhanced UI
  type?: 'MEDICAL' | 'NON_MEDICAL' | 'GENERAL';
  parentId?: string;
  isActive?: boolean;
  productCount?: number;
  color?: string;
  icon?: string;
  children?: Category[];
}

const Categories = () => {
  const { user } = useAuth();
  const { selectedBranchId } = useAdmin();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form state for adding/editing categories
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'GENERAL' as 'MEDICAL' | 'NON_MEDICAL' | 'GENERAL',
    parentId: '',
    color: '#3B82F6',
    icon: 'Package'
  });

  // Load categories
  const loadCategories = async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading categories...');
      // Use selectedBranchId for admin users, or user's branchId for others
      const branchId = (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')
        ? selectedBranchId || ''
        : user?.branchId || '';

      const response = await apiService.getCategories({
        branchId
      });
      console.log('🔍 Categories API response:', response);

      if (response.success) {
        // Handle both array and object response formats
        const categoriesData = Array.isArray(response.data) ? response.data : (response.data?.categories || []);
        console.log('🔍 Categories data:', categoriesData);

        // Transform backend data to include frontend-only fields
        const transformedCategories = categoriesData.map((category: any) => ({
          ...category,
          type: category.type || 'general',
          isActive: category.isActive !== undefined ? category.isActive : true,
          productCount: category._count?.products || 0,
          color: category.color || '#3B82F6',
          icon: category.icon || 'Package',
          description: category.description || ''
        }));

        setCategories(transformedCategories);
      } else {
        console.log('🔍 No categories found or API failed');
        setCategories([]);
        setError(null); // Clear any previous errors
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      setCategories([]);
      setError('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [selectedBranchId]);

  // Filter categories based on search and type
  const filteredCategories = (Array.isArray(categories) ? categories : []).filter(category => {
    const matchesSearch = category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         category.description.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === "all" || category.type === selectedType;

    return matchesSearch && matchesType;
  });

  // Get unique types
  const types = Array.from(new Set((Array.isArray(categories) ? categories : []).map(c => c.type)));

  // Get category statistics
  const totalCategories = Array.isArray(categories) ? categories.length : 0;
  const activeCategories = (Array.isArray(categories) ? categories : []).filter(c => c.isActive).length;
  const medicalCategories = (Array.isArray(categories) ? categories : []).filter(c => c.type === 'MEDICAL').length;
  const nonMedicalCategories = (Array.isArray(categories) ? categories : []).filter(c => c.type === 'NON_MEDICAL').length;

  const handleAddCategory = async (formData: any) => {
    try {
      setIsSubmitting(true);

      // Send the fields that the backend expects
      // Use selectedBranchId for admin users, or user's branchId for others
      const branchId = (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')
        ? selectedBranchId || ''
        : user?.branchId || '';

      const categoryData = {
        name: formData.name,
        description: formData.description,
        type: formData.type, // Already converted to uppercase in CategoryForm
        color: formData.color,
        branchId
      };
      console.log('🔍 Creating category with data:', categoryData);
      const response = await apiService.createCategory(categoryData);
      console.log('🔍 Create category response:', response);

      if (response.success) {
        toast({
          title: "Category Added",
          description: "Category has been saved to database successfully.",
        });
        setShowAddDialog(false);
        setFormData({
          name: '',
          description: '',
          type: 'GENERAL',
          parentId: '',
          color: '#3B82F6',
          icon: 'Package'
        });
        loadCategories();
      } else {
        // Show error - do NOT use demo mode
        toast({
          title: "Error",
          description: response.message || "Failed to add category. Please try again.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error adding category:', err);
      // Show error - do NOT use demo mode
      toast({
        title: "Error",
        description: "Failed to add category. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditCategory = async (formData: any) => {
    if (!editingCategory) return;

    try {
      setIsSubmitting(true);

      // Convert type to uppercase to match backend validation
      const updateData = {
        name: formData.name,
        description: formData.description,
        type: formData.type, // Already converted to uppercase in CategoryForm
        color: formData.color
      };

      const response = await apiService.updateCategory(editingCategory.id, updateData);

      if (response.success) {
        toast({
          title: "Category Updated",
          description: "Category has been updated successfully.",
        });
        setEditingCategory(null);
        setFormData({
          name: '',
          description: '',
          type: 'GENERAL',
          parentId: '',
          color: '#3B82F6',
          icon: 'Package'
        });
        loadCategories();
      } else {
        toast({
          title: "Error",
          description: "Failed to update category.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error updating category:', err);
      toast({
        title: "Error",
        description: "Failed to update category.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    // Find the category to check if it has products
    const category = categories.find(cat => cat.id === categoryId);

    if (category && category._count?.products > 0) {
      toast({
        title: "Cannot Delete Category",
        description: "This category cannot be deleted because it contains products. Please move or delete all products first.",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      setIsDeleting(categoryId);
      const response = await apiService.deleteCategory(categoryId);

      if (response.success) {
        toast({
          title: "Category Deleted",
          description: "Category has been deleted from database successfully.",
        });
        loadCategories();
      } else {
        // Show error - do NOT use demo mode
          toast({
          title: "Error",
          description: response.message || "Failed to delete category. Please try again.",
            variant: "destructive",
          });
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      // Show error - do NOT use demo mode
      toast({
        title: "Error",
        description: "Failed to delete category. Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description,
      type: category.type,
      parentId: category.parentId || '',
      color: category.color,
      icon: category.icon
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'medical':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'non-medical':
        return <Package className="w-4 h-4 text-green-600" />;
      default:
        return <Package className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'medical':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'non-medical':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading categories...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={loadCategories}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center">
            <Tag className="w-8 h-8 mr-3 text-purple-600" />
            Categories
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage product categories and organize your inventory • {Array.isArray(categories) ? categories.length : 0} categories total
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
            Add Category
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-white border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Categories</p>
                <p className="text-2xl font-bold text-gray-900">{totalCategories}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Tag className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Categories</p>
                <p className="text-2xl font-bold text-green-600">{activeCategories}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Medical Categories</p>
                <p className="text-2xl font-bold text-blue-600">{medicalCategories}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-0 shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Non-Medical Categories</p>
                <p className="text-2xl font-bold text-orange-600">{nonMedicalCategories}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6 bg-white border-0 shadow-soft">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search">Search Categories</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="lg:w-64">
              <Label htmlFor="type">Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="all"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    All Types
                  </SelectItem>
                  <SelectItem
                    value="MEDICAL"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Medical
                  </SelectItem>
                  <SelectItem
                    value="NON_MEDICAL"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Non-Medical
                  </SelectItem>
                  <SelectItem
                    value="GENERAL"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    General
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Display */}
      <Card className="bg-white border-0 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Tag className="w-5 h-5 mr-2" />
            Categories ({filteredCategories.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
              <p className="text-gray-500 mb-4">
                {searchQuery || selectedType !== "all"
                  ? "Try adjusting your search or filter criteria."
                  : "Get started by adding your first category."
                }
              </p>
              {!searchQuery && selectedType === "all" && (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Category
                </Button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCategories.map((category) => (
                <Card key={category.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: category.color }}
                      >
                        <Package className="w-6 h-6" />
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(category)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`${category._count?.products > 0
                            ? 'text-gray-400 cursor-not-allowed'
                            : 'text-red-600 hover:text-red-700'
                          }`}
                          onClick={() => handleDeleteCategory(category.id)}
                          disabled={category._count?.products > 0 || isDeleting === category.id}
                          title={category._count?.products > 0
                            ? `Cannot delete: ${category._count.products} products in this category`
                            : 'Delete category'
                          }
                        >
                          {isDeleting === category.id ? (
                            <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>

                      <div className="flex items-center justify-between">
                        <Badge className={getTypeColor(category.type)}>
                          {getTypeIcon(category.type)}
                          <span className="ml-1 capitalize">{category.type}</span>
                        </Badge>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">
                            {category.productCount} products
                          </span>
                          {category._count?.products > 0 && (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center">
                          {category.isActive ? (
                            <Star className="w-4 h-4 text-green-600" />
                          ) : (
                            <StarOff className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-xs text-gray-500 ml-1">
                            {category.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
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
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Category</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Products</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white mr-3"
                            style={{ backgroundColor: category.color }}
                          >
                            <Package className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{category.name}</p>
                            <p className="text-sm text-gray-500">{category.description}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <Badge className={getTypeColor(category.type)}>
                          {getTypeIcon(category.type)}
                          <span className="ml-1 capitalize">{category.type}</span>
                        </Badge>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">{category.productCount}</span>
                          {category._count?.products > 0 && (
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {category.isActive ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => openEditDialog(category)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`${category._count?.products > 0
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-red-600 hover:text-red-700'
                            }`}
                            onClick={() => handleDeleteCategory(category.id)}
                            disabled={category._count?.products > 0 || isDeleting === category.id}
                            title={category._count?.products > 0
                              ? `Cannot delete: ${category._count.products} products in this category`
                              : 'Delete category'
                            }
                          >
                            {isDeleting === category.id ? (
                              <div className="w-4 h-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
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

      {/* Add/Edit Category Dialog */}
      <Dialog open={showAddDialog || !!editingCategory} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingCategory(null);
          setFormData({
            name: '',
            description: '',
            type: 'GENERAL',
            parentId: '',
            color: '#3B82F6',
            icon: 'Package'
          });
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Edit Category' : 'Add New Category'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Update category information' : 'Create a new product category'}
            </DialogDescription>
          </DialogHeader>

          <CategoryForm
            initialData={editingCategory ? {
              name: editingCategory.name,
              description: editingCategory.description || '',
              type: (editingCategory.type?.toLowerCase() as 'general' | 'medical' | 'non-medical') || 'general',
              color: editingCategory.color || '#3B82F6'
            } : {}}
            onSubmit={editingCategory ? handleEditCategory : handleAddCategory}
            onCancel={() => {
              setShowAddDialog(false);
              setEditingCategory(null);
            }}
            isSubmitting={isSubmitting}
            submitButtonText={editingCategory ? 'Update Category' : 'Add Category'}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Categories;
