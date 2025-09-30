import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import CategoryManagement from "./CategoryManagement";
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
  Pill,
  RefreshCw,
  Droplets,
  Syringe,
  X,
  Save,
  Loader2,
  TrendingUp,
  TrendingDown,
  Download,
  Upload,
  FileSpreadsheet,
  Image,
  FolderOpen
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";

interface Product {
  id: string;
  name: string;
  description?: string;
  category: {
    id: string;
    name: string;
  };
  supplier: {
    id: string;
    name: string;
  };
  branch: {
    id: string;
    name: string;
  };
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minStock: number;
  maxStock?: number;
  unitType: string;
  unitsPerPack: number;
  barcode?: string;
  requiresPrescription: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
}

const Inventory = () => {
  const { user } = useAuth();
  const { selectedBranchId, selectedBranch } = useAdmin();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAllProducts, setShowAllProducts] = useState(true); // Show all products by default
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [importedProducts, setImportedProducts] = useState<any[]>([]);
  const [processingImage, setProcessingImage] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0
  });

  // Form state for adding new medicine
  const [newMedicine, setNewMedicine] = useState({
    name: "",
    categoryId: "",
    costPrice: "",
    sellingPrice: "",
    stock: "",
    minStock: "10",
    maxStock: "",
    barcode: "",
    unitsPerPack: "1"
  });

  // Form state for creating new category
  const [newCategory, setNewCategory] = useState({
    name: "",
    description: ""
  });


  // Load data on component mount
  useEffect(() => {
    console.log('Component mounted, loading data...');
    loadData();
  }, [selectedBranchId]); // Re-run when selected branch changes

  // Reload data when search or showAllProducts changes
  useEffect(() => {
    if (searchQuery || showAllProducts !== false) {
      console.log('Search or showAllProducts changed, reloading data...');
      loadData();
    }
  }, [searchQuery, showAllProducts]);

  // Debug: Log products state changes
  useEffect(() => {
    console.log('🔄 Products state changed:', products.length, 'products');
    console.log('Products data:', products);
  }, [products]);

  // Real-time data synchronization
  useEffect(() => {
    const handleProductChanged = (event: CustomEvent) => {
      console.log('🔄 Real-time product change received:', event.detail);
      const { action, product } = event.detail;

      if (action === 'created') {
        // Add new product to the list
        setProducts(prev => [product, ...prev]);
      } else if (action === 'updated') {
        // Update existing product
        setProducts(prev => prev.map(p => p.id === product.id ? product : p));
      } else if (action === 'deleted') {
        // Remove product from the list
        setProducts(prev => prev.filter(p => p.id !== product.id));
      }
    };

    const handleInventoryChanged = (event: CustomEvent) => {
      console.log('🔄 Real-time inventory change received:', event.detail);
      const { action, data } = event.detail;

      if (action === 'product_added') {
        // Add new product to the list
        setProducts(prev => [data, ...prev]);
      } else if (action === 'product_removed') {
        // Remove product from the list
        setProducts(prev => prev.filter(p => p.id !== data.id));
      } else if (action === 'stock_updated') {
        // Update product stock
        setProducts(prev => prev.map(p =>
          p.id === data.productId
            ? { ...p, stock: data.newStock }
            : p
        ));
      }
    };

    // Add event listeners
    window.addEventListener('productChanged', handleProductChanged as EventListener);
    window.addEventListener('inventoryChanged', handleInventoryChanged as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('productChanged', handleProductChanged as EventListener);
      window.removeEventListener('inventoryChanged', handleInventoryChanged as EventListener);
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('=== INVENTORY LOAD DATA DEBUG ===');
      console.log('User object:', user);
      console.log('User role:', user?.role);
      console.log('User branchId:', user?.branchId);
      console.log('Admin context:', { selectedBranchId, selectedBranch: selectedBranch?.name });
      console.log('Current products count:', products.length);
      console.log('Is user authenticated:', !!user);

      // Determine which branch to load products from
      let branchId: string | undefined;

      if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
        // Admin users can see products from selected branch or all branches
        if (selectedBranchId) {
          branchId = selectedBranchId;
          console.log('Admin selected specific branch:', selectedBranch?.name);
        } else {
          // Admin viewing all branches - don't filter by branch
          console.log('Admin viewing all branches - loading all products');
        }
      } else {
        // Regular users see only their branch products
        branchId = user?.branchId || "cmfprkvh6000t7yyp8q2197xa";
        console.log('Regular user branch:', branchId);
      }

      // Load products from database
      const params: any = { limit: 1000 };
      if (branchId) {
        params.branchId = branchId;
      }

      console.log('Calling getProducts API with params:', params);

      const response = await apiService.getProducts(params);

      console.log('=== PRODUCTS API RESPONSE ===');
      console.log('Products API response:', response);
      console.log('Requesting products for branchId:', branchId);
      console.log('Response success:', response.success);
      console.log('Response data:', response.data);
      console.log('Response data type:', typeof response.data);
      console.log('Response message:', response.message);

      if (response.success && response.data) {
        const allProducts = response.data.products;
        console.log('Total products from API:', allProducts.length);
        console.log('All products:', allProducts);

        // Filter products based on search and category
        let filteredProducts = allProducts;

        if (searchQuery) {
          console.log('Filtering by search query:', searchQuery);
          filteredProducts = filteredProducts.filter((product: any) =>
            product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            product.barcode?.includes(searchQuery)
          );
          console.log('Products after search filter:', filteredProducts.length);
        }

        // Category filtering removed - all products are shown

        // TEMPORARY: Show all products without pagination for debugging
        console.log('TEMPORARY DEBUG: Showing all products without pagination');
        const debugProducts = filteredProducts; // Show all products

        console.log('Setting products in loadData:', {
          allProducts: allProducts.length,
          filteredProducts: filteredProducts.length,
          allProductsData: allProducts,
          filteredProductsData: filteredProducts
        });

        setProducts(debugProducts); // TEMPORARY: Use debug products
        setPagination({
          page: 1,
          limit: 50,
          total: filteredProducts.length,
          pages: 1
        });

        console.log('Final products set to state:', debugProducts.length);
        console.log('Final products data:', debugProducts);
      } else {
        console.log('API call failed, trying fallback...');
        // Fallback: try to get products without any parameters
        try {
          const fallbackResponse = await apiService.getProducts();
          console.log('Fallback API response:', fallbackResponse);
          if (fallbackResponse.success && fallbackResponse.data) {
            const fallbackProducts = fallbackResponse.data.products || [];
            console.log('Fallback products:', fallbackProducts.length);
            setProducts(fallbackProducts);
            setPagination({
              page: 1,
              limit: 50,
              total: fallbackProducts.length,
              pages: 1
            });
          } else {
            setProducts([]);
            setPagination({
              page: 1,
              limit: 50,
              total: 0,
              pages: 0
            });
          }
        } catch (fallbackError) {
          console.error('Fallback API call also failed:', fallbackError);
          setProducts([]);
          setPagination({
            page: 1,
            limit: 50,
            total: 0,
            pages: 0
          });
        }
      }

      // Load categories from database - show all categories for current branch
      const categoriesResponse = await apiService.getCategories({
        branchId: user?.branchId || ""
      });
      if (categoriesResponse.success && categoriesResponse.data) {
        // Show all categories for the current branch (not filtered by products)
        setCategories(categoriesResponse.data.categories);
      } else {
        // Fallback to empty array if no categories found
        setCategories([]);
      }

      // Load suppliers from database - show all suppliers for current branch
      const suppliersResponse = await apiService.getSuppliers({
        branchId: user?.branchId || ""
      });
      if (suppliersResponse.success && suppliersResponse.data) {
        // Show all suppliers for the current branch (not filtered by products)
        setSuppliers(suppliersResponse.data.suppliers);
      } else {
        console.error('Failed to load suppliers:', suppliersResponse.message);
        // Set empty array if no suppliers found
        setSuppliers([]);
      }

    } catch (err) {
      console.error('Error loading data:', err);

      // Check if it's a connection error
      if (err.message && err.message.includes('Failed to fetch')) {
        setError('⚠️ Backend server is not running. Please start the server and refresh the page.');
      } else {
        console.error('❌ Failed to load inventory data:', err);
        setError('Failed to load inventory data');

        // Set fallback data when server is not available
        setProducts([]);
        setCategories([
          { id: 'cat_001', name: 'Pain Relief' },
          { id: 'cat_002', name: 'Antibiotics' },
          { id: 'cat_003', name: 'Vitamins' },
          { id: 'cat_004', name: 'Cold & Flu' },
          { id: 'cat_005', name: 'Digestive Health' }
        ]);
        setSuppliers([
          { id: 'sup_001', name: 'Default Supplier', contactPerson: 'John Doe', phone: '+92 300 1234567', email: 'contact@supplier.com', address: '123 Supplier St', isActive: true }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const totalProducts = pagination.total;
  const totalValue = products.reduce((sum, p) => sum + (p.sellingPrice * p.stock), 0);

  const getStockStatus = (stock: number, minStock: number) => {
    if (stock === 0) return { status: "out", color: "destructive" };
    if (stock <= minStock) return { status: "low", color: "warning" };
    return { status: "good", color: "default" };
  };

  const getUnitIcon = (unitType: string) => {
    switch (unitType) {
      case "tablets":
      case "capsules":
        return <Pill className="w-4 h-4" />;
      case "bottles":
        return <Droplets className="w-4 h-4" />;
      case "vials":
        return <Syringe className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const generateBarcode = () => {
    const randomNum = Math.floor(Math.random() * 10000000000000);
    return randomNum.toString().padStart(13, '0');
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name) {
      alert("Please enter category name!");
      return;
    }

    try {
      setLoading(true);

      const categoryData = {
        name: newCategory.name,
        description: newCategory.description || ""
      };

      // Create category via API
      const response = await apiService.createCategory(categoryData);

      if (response.success) {
        console.log('Category created successfully:', response.data);

        // Reload data to get the updated list
        await loadData();

        // Reset form
        setNewCategory({
          name: "",
          description: ""
        });

        setIsCreateCategoryDialogOpen(false);
        alert("Category created successfully!");
      } else {
        alert(response.message || "Failed to create category");
      }
    } catch (error) {
      console.error('Error creating category:', error);
      alert("Failed to create category. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicine = async () => {
    if (!newMedicine.name || !newMedicine.categoryId || !newMedicine.sellingPrice || !newMedicine.stock) {
      alert("Please fill all required fields!");
      return;
    }

    try {
      setLoading(true);

      // Get branch ID - use user's branch or get first available branch
      let branchId = user?.branchId || "cmfprkvh6000t7yyp8q2197xa";
      if (!branchId) {
        const branchesResponse = await apiService.getBranches();
        if (branchesResponse.success && branchesResponse.data?.branches?.length > 0) {
          branchId = branchesResponse.data.branches[0].id;
        }
      }

      if (!branchId) {
        alert("No branch available. Please contact administrator.");
        return;
      }

      // Use default supplier - no need to fetch suppliers
      const supplierId = 'default-supplier';

      const productData = {
        name: newMedicine.name,
        description: "",
        categoryId: newMedicine.categoryId,
        supplierId: supplierId,
        branchId: branchId,
        costPrice: parseFloat(newMedicine.costPrice) || 0,
        sellingPrice: parseFloat(newMedicine.sellingPrice),
        stock: parseInt(newMedicine.stock),
        minStock: parseInt(newMedicine.minStock) || 10,
        maxStock: newMedicine.maxStock ? parseInt(newMedicine.maxStock) : null,
        unitType: "tablets", // Default unit type
        unitsPerPack: 1, // Always 1 since pricing is per unit
        barcode: newMedicine.barcode || null,
        requiresPrescription: false, // Default to false
        isActive: true
      };

      console.log('Creating product with data:', productData);
      console.log('Using branchId for product creation:', branchId);
      console.log('Using default branchId');

      // Create product via API
      const response = await apiService.createProduct(productData);

      if (response.success) {
        console.log('Product created successfully:', response.data);

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('productCreated', {
          detail: { product: response.data }
        }));

        // Reload data to get the updated list - fetch products for the current branch
        try {
          const allProductsResponse = await apiService.getProducts({
            limit: 1000,
            branchId: branchId
          });
          console.log('Product reload response:', allProductsResponse);
          if (allProductsResponse.success && allProductsResponse.data) {
            const allProducts = allProductsResponse.data.products;
            console.log('Products found after creation:', allProducts.length);

            // If no products found with branch filter, try without branch filter
            if (allProducts.length === 0) {
              console.log('No products found with branch filter, trying without branch filter...');
              const allProductsResponseNoFilter = await apiService.getProducts({ limit: 1000 });
              if (allProductsResponseNoFilter.success && allProductsResponseNoFilter.data) {
                const allProductsNoFilter = allProductsResponseNoFilter.data.products;
                console.log('Total products (no filter):', allProductsNoFilter.length);

                // Filter products by branchId manually
                const branchFilteredProducts = allProductsNoFilter.filter(product =>
                  product.branch.id === branchId
                );
                console.log('Manually filtered products for branch:', branchFilteredProducts.length);

                // Use manually filtered products
                const filteredProducts = branchFilteredProducts;

                // Apply search and category filters
                let finalFilteredProducts = filteredProducts;

                if (searchQuery) {
                  finalFilteredProducts = finalFilteredProducts.filter((product: any) =>
                    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    product.barcode?.includes(searchQuery)
                  );
                }

                if (selectedCategory !== "all") {
                  finalFilteredProducts = finalFilteredProducts.filter((product: any) =>
                    product.categoryId === selectedCategory
                  );
                }

                // Apply pagination
                const startIndex = (pagination.page - 1) * pagination.limit;
                const endIndex = startIndex + pagination.limit;
                const paginatedProducts = finalFilteredProducts.slice(startIndex, endIndex);

                setProducts(paginatedProducts);
                setPagination(prev => ({
                  ...prev,
                  total: finalFilteredProducts.length,
                  pages: Math.ceil(finalFilteredProducts.length / prev.limit)
                }));
                console.log('✅ Products loaded successfully:', paginatedProducts.length, 'products');

                console.log('Products updated after creation (manual filter):', paginatedProducts.length);
                return;
              }
            }

            // Apply search and category filters
            let filteredProducts = allProducts;

            if (searchQuery) {
              filteredProducts = filteredProducts.filter((product: any) =>
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.barcode?.includes(searchQuery)
              );
            }

            if (selectedCategory !== "all") {
              filteredProducts = filteredProducts.filter((product: any) =>
                product.categoryId === selectedCategory
              );
            }

            // Apply pagination
            const startIndex = (pagination.page - 1) * pagination.limit;
            const endIndex = startIndex + pagination.limit;
            const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

            console.log('Setting products after creation:', {
              filteredProducts: filteredProducts.length,
              paginatedProducts: paginatedProducts.length,
              startIndex,
              endIndex,
              currentPage: pagination.page,
              limit: pagination.limit
            });

            setProducts(paginatedProducts);
            setPagination(prev => ({
              ...prev,
              total: filteredProducts.length,
              pages: Math.ceil(filteredProducts.length / prev.limit)
            }));
          }
        } catch (error) {
          console.error('Error reloading data after product creation:', error);
          await loadData();
        }

        // Force refresh after a short delay to ensure products are visible
        setTimeout(async () => {
          console.log('Force refreshing products after creation...');
          await loadData();
        }, 1000);

        // Reset form
        setNewMedicine({
          name: "",
          categoryId: "",
          costPrice: "",
          sellingPrice: "",
          stock: "",
          minStock: "10",
          maxStock: "",
          barcode: "",
          unitsPerPack: "1"
        });

        setIsAddDialogOpen(false);
        alert("Medicine added successfully!");
      } else {
        alert(response.message || "Failed to add medicine");
      }
    } catch (error) {
      console.error('Error adding medicine:', error);
      alert("Failed to add medicine. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewMedicine({
      name: product.name,
      categoryId: product.category.id,
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      stock: product.stock.toString(),
      minStock: product.minStock.toString(),
      maxStock: product.maxStock?.toString() || "",
      barcode: product.barcode || "",
      unitsPerPack: product.unitsPerPack.toString()
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !newMedicine.name || !newMedicine.categoryId || !newMedicine.sellingPrice || !newMedicine.stock) {
      alert("Please fill all required fields!");
      return;
    }

      try {
        setLoading(true);

      const productData = {
        name: newMedicine.name,
        description: editingProduct.description || "",
        categoryId: newMedicine.categoryId,
        supplierId: editingProduct.supplier.id,
        branchId: editingProduct.branch.id,
        costPrice: parseFloat(newMedicine.costPrice) || 0,
        sellingPrice: parseFloat(newMedicine.sellingPrice),
        stock: parseInt(newMedicine.stock),
        minStock: parseInt(newMedicine.minStock) || 10,
        maxStock: newMedicine.maxStock ? parseInt(newMedicine.maxStock) : null,
        unitType: editingProduct.unitType || "tablets",
        unitsPerPack: editingProduct.unitsPerPack || 1,
        barcode: newMedicine.barcode || "",
        requiresPrescription: editingProduct.requiresPrescription || false,
        isActive: editingProduct.isActive !== undefined ? editingProduct.isActive : true
      };

      console.log('Updating product with data:', productData);
      console.log('Editing product (source):', editingProduct);

      // Update product via API
      const response = await apiService.updateProduct(editingProduct.id, productData);

        if (response.success) {
        console.log('Product updated successfully:', response.data);

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('productUpdated', {
          detail: { product: response.data }
        }));

        // Reload data to get the updated list - fetch products for the current branch
        try {
          const allProductsResponse = await apiService.getProducts({
            limit: 1000,
            branchId: user?.branchId || "cmfprkvh6000t7yyp8q2197xa"
          });
          if (allProductsResponse.success && allProductsResponse.data) {
            const allProducts = allProductsResponse.data.products;

            // Apply search and category filters
            let filteredProducts = allProducts;

            if (searchQuery) {
              filteredProducts = filteredProducts.filter((product: any) =>
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.barcode?.includes(searchQuery)
              );
            }

            if (selectedCategory !== "all") {
              filteredProducts = filteredProducts.filter((product: any) =>
                product.categoryId === selectedCategory
              );
            }

            // Apply pagination
            const startIndex = (pagination.page - 1) * pagination.limit;
            const endIndex = startIndex + pagination.limit;
            const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

            setProducts(paginatedProducts);
            setPagination({
              page: pagination.page,
              limit: pagination.limit,
              total: filteredProducts.length,
              pages: Math.ceil(filteredProducts.length / pagination.limit)
            });
          }
        } catch (error) {
          console.error('Error reloading data after product update:', error);
          await loadData();
        }

        // Reset form and close dialog
        setEditingProduct(null);
        setNewMedicine({
          name: "",
          categoryId: "",
          costPrice: "",
          sellingPrice: "",
          stock: "",
          minStock: "10",
          maxStock: "",
          barcode: "",
          unitsPerPack: "1"
        });

        setIsEditDialogOpen(false);
        alert("Product updated successfully!");
      } else {
        console.error('Failed to update product:', response.message);
        console.error('Validation errors:', response.errors);
        alert(`Failed to update product: ${response.message}. Errors: ${response.errors?.join(', ') || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      console.error('Error details:', error.response?.data);
      alert(`Failed to update product: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (product: Product) => {
    setDeletingProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;

    try {
      setLoading(true);
      const response = await apiService.deleteProduct(deletingProduct.id);

      if (response.success) {
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('productDeleted', {
          detail: { productId: deletingProduct.id }
        }));

        // Reload data to get the updated list - fetch products for the current branch
        try {
          const allProductsResponse = await apiService.getProducts({
            limit: 1000,
            branchId: user?.branchId || "cmfprkvh6000t7yyp8q2197xa"
          });
          if (allProductsResponse.success && allProductsResponse.data) {
            const allProducts = allProductsResponse.data.products;

            // Apply search and category filters
            let filteredProducts = allProducts;

            if (searchQuery) {
              filteredProducts = filteredProducts.filter((product: any) =>
                product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                product.barcode?.includes(searchQuery)
              );
            }

            if (selectedCategory !== "all") {
              filteredProducts = filteredProducts.filter((product: any) =>
                product.categoryId === selectedCategory
              );
            }

            // Apply pagination
            const startIndex = (pagination.page - 1) * pagination.limit;
            const endIndex = startIndex + pagination.limit;
            const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

            setProducts(paginatedProducts);
            setPagination({
              page: pagination.page,
              limit: pagination.limit,
              total: filteredProducts.length,
              pages: Math.ceil(filteredProducts.length / pagination.limit)
            });
          }
        } catch (error) {
          console.error('Error reloading data after product deletion:', error);
        await loadData();
        }

        // Close dialog and reset state
        setIsDeleteDialogOpen(false);
        setDeletingProduct(null);
        } else {
          alert(response.message || "Failed to delete medicine");
        }
      } catch (error) {
        console.error('Error deleting medicine:', error);
        alert("Failed to delete medicine. Please try again.");
      } finally {
        setLoading(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setDeletingProduct(null);
  };

  // Bulk delete functions
  const handleSelectProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  const handleBulkDeleteClick = () => {
    if (selectedProducts.length === 0) return;
    setIsBulkDeleteDialogOpen(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedProducts.length === 0) return;

    try {
      setLoading(true);
      const response = await apiService.bulkDeleteProducts(selectedProducts);

      if (response.success) {
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('productsBulkDeleted', {
          detail: { productIds: selectedProducts }
        }));

        // Reload data to get the updated list
        await loadData();
        setSelectedProducts([]);
        console.log(`Successfully bulk deleted ${response.data.data.deletedCount} products`);
      } else {
        alert(response.message || "Failed to bulk delete products");
      }
    } catch (error) {
      console.error('Error bulk deleting products:', error);
      setError('Failed to bulk delete products');
    } finally {
      setLoading(false);
      setIsBulkDeleteDialogOpen(false);
    }
  };

  const handleCancelBulkDelete = () => {
    setIsBulkDeleteDialogOpen(false);
  };

  // Export functionality
  const handleExportInventory = () => {
    try {
      // Create Excel data
      const excelData = products.map(product => ({
        'Product Name': product.name,
        'Category': product.category.name,
        'Supplier': product.supplier.name,
        'Cost Price': product.costPrice,
        'Selling Price': product.sellingPrice,
        'Stock': product.stock,
        'Min Stock': product.minStock,
        'Max Stock': product.maxStock || '',
        'Unit Type': product.unitType,
        'Barcode': product.barcode || '',
        'Requires Prescription': product.requiresPrescription ? 'Yes' : 'No',
        'Description': product.description || ''
      }));

      // Convert to CSV
      const headers = Object.keys(excelData[0]);
      const csvContent = [
        headers.join(','),
        ...excelData.map(row =>
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes in CSV
            if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      alert('Inventory exported successfully!');
    } catch (error) {
      console.error('Error exporting inventory:', error);
      alert('Error exporting inventory. Please try again.');
    }
  };

  // Import functionality
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Please select an Excel (.xlsx, .xls) or CSV file.');
      return;
    }

    setProcessingImage(true);
    try {
      let extractedData: any[] = [];

      // Check if it's a CSV file
      if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
        // Parse CSV content
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(file);
        });

        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          alert('File appears to be empty or invalid.');
          return;
        }

        // Get headers
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

        // Parse data rows
        console.log('Parsing CSV data...');
        console.log('Headers:', headers);
        console.log('Total lines:', lines.length);

        extractedData = lines.slice(1).map((line, index) => {
          console.log(`Processing line ${index + 1}:`, line);
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          console.log(`Split values:`, values);
          const row: any = {};

          headers.forEach((header, headerIndex) => {
            const value = values[headerIndex] || '';
            const lowerHeader = header.toLowerCase().trim();
            console.log(`Header "${header}" (${lowerHeader}) -> Value: "${value}"`);

            // More flexible header matching
            if (lowerHeader.includes('name') || lowerHeader.includes('product') || lowerHeader === 'name') {
              row.name = value;
            } else if (lowerHeader.includes('category') || lowerHeader === 'category') {
              row.category = value;
            } else if ((lowerHeader.includes('cost') && lowerHeader.includes('price')) || lowerHeader === 'cost price') {
              row.costPrice = parseFloat(value) || 0;
            } else if ((lowerHeader.includes('selling') && lowerHeader.includes('price')) || lowerHeader === 'selling price') {
              row.sellingPrice = parseFloat(value) || 0;
            } else if ((lowerHeader.includes('stock') && !lowerHeader.includes('min') && !lowerHeader.includes('max')) || lowerHeader === 'stock') {
              row.stock = parseInt(value) || 0;
            } else if ((lowerHeader.includes('unit') && lowerHeader.includes('type')) || lowerHeader === 'unit type') {
              row.unitType = value || 'tablets';
            } else if ((lowerHeader.includes('units') && lowerHeader.includes('pack')) || lowerHeader === 'units per pack') {
              // Skip units per pack - always 1 for unit pricing
            } else if (lowerHeader.includes('barcode') || lowerHeader === 'barcode') {
              row.barcode = value;
            } else if (lowerHeader.includes('prescription') || lowerHeader === 'requires prescription') {
              row.requiresPrescription = value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' || value.toLowerCase() === '1';
            } else if (lowerHeader.includes('description') || lowerHeader === 'description') {
              row.description = value;
            }
          });

          // Set default values for required fields
          if (!row.unitType) row.unitType = 'tablets';
          // unitsPerPack is always 1 for unit pricing
          if (!row.costPrice) row.costPrice = 0;
          // Ensure stock is always a valid number (default to 0 if not provided)
          row.stock = parseInt(row.stock) || 0;
          if (!row.requiresPrescription) row.requiresPrescription = false;

          console.log(`Parsed row ${index + 1}:`, row);
          return row;
        }).filter(row => {
          const hasName = !!row.name && row.name.trim() !== '';
          console.log(`Row "${row.name}" has name: ${hasName}`);
          return hasName;
        }); // Only include rows with product names
      } else {
        // For Excel files, show a message to convert to CSV first
        alert('Excel files are not fully supported yet. Please save your Excel file as CSV format and try again.\n\nTo convert:\n1. Open your Excel file\n2. Go to File > Save As\n3. Choose CSV format\n4. Upload the CSV file');
        return;
      }

      console.log('Extracted data:', extractedData);
      console.log('Total extracted products:', extractedData.length);

      if (extractedData.length === 0) {
        alert('No valid product data found in the file. Please check that your file has product names in the first column.');
        return;
      }

      console.log('=== FILE PARSING COMPLETE ===');
      console.log('Total products extracted:', extractedData.length);
      console.log('All extracted products:', extractedData);

      // Validate extracted data with more lenient validation
      const validProducts = extractedData.filter(product => {
        const hasName = product.name && product.name.trim() !== '';
        const hasPrice = product.sellingPrice && !isNaN(parseFloat(product.sellingPrice)) && parseFloat(product.sellingPrice) > 0;

        console.log(`Product "${product.name}" validation:`, {
          hasName,
          hasPrice,
          sellingPrice: product.sellingPrice,
          sellingPriceType: typeof product.sellingPrice
        });

        return hasName && hasPrice;
      });

      console.log('Valid products after validation:', validProducts.length);
      console.log('All extracted products:', extractedData);
      console.log('Valid products:', validProducts);

      if (validProducts.length === 0) {
        alert('No valid products found in the file. Please ensure your CSV has:\n- Product names (non-empty)\n- Selling prices (numeric values > 0)\n- Categories (optional, will use default)');
        return;
      }

      // Show a simple alert with the count
      alert(`File parsed successfully! Found ${validProducts.length} valid products out of ${extractedData.length} total rows.`);

      setImportedProducts(validProducts);
      setIsPreviewDialogOpen(true);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file. Please try again or convert Excel to CSV format.');
    } finally {
      setProcessingImage(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    setProcessingImage(true);
    try {
      // Convert image to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Simulate OCR processing (in real implementation, you'd call an OCR service)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock extracted data (replace with actual OCR processing)
      const mockExtractedData = [
        {
          name: 'Paracetamol 500mg',
          category: 'Analgesics',
          costPrice: 2.50,
          sellingPrice: 5.00,
          stock: 100,
          unitType: 'tablets'
        },
        {
          name: 'Amoxicillin 250mg',
          category: 'Antibiotics',
          costPrice: 15.00,
          sellingPrice: 25.00,
          stock: 50,
          unitType: 'capsules'
        },
        {
          name: 'Vitamin C 1000mg',
          category: 'Vitamins',
          costPrice: 8.00,
          sellingPrice: 12.00,
          stock: 75,
          unitType: 'tablets'
        }
      ];

      setImportedProducts(mockExtractedData);
      setIsPreviewDialogOpen(true);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Error processing image. Please try again.');
    } finally {
      setProcessingImage(false);
    }
  };

  const handleProceedImport = async () => {
    try {
      setLoading(true);

      // Prepare products for bulk import
      const productsToImport = [];
      const createdCategories = [];
      const createdSuppliers = [];

      console.log('=== PREPARING PRODUCTS FOR IMPORT ===');
      console.log('Imported products count:', importedProducts.length);
      console.log('Available categories:', categories);
      console.log('Available suppliers:', suppliers);

      // Get branchId once for all products
      let branchId = user?.branchId || "cmfprkvh6000t7yyp8q2197xa";

      // If no branchId from user object, try to get it from localStorage
      if (!branchId) {
        const storedUser = localStorage.getItem('medibill_user');
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            branchId = parsedUser.branch?.id;
          } catch (e) {
            console.error('Error parsing stored user:', e);
          }
        }
      }

      // If still no branchId, get the first available branch
      if (!branchId) {
        try {
          const branchesResponse = await apiService.getBranches();
          if (branchesResponse.success && branchesResponse.data?.branches?.length > 0) {
            branchId = branchesResponse.data.branches[0].id;
            console.log('Using first available branch:', branchId);
          } else {
            console.error('No branches available');
            alert('No branches available. Please contact administrator.');
            setLoading(false);
            return;
          }
        } catch (e) {
          console.error('Error fetching branches:', e);
          alert('Error fetching branches. Please try again.');
          setLoading(false);
          return;
        }
      }

      console.log('=== BRANCH ID DETERMINED ===');
      console.log('Final branchId for all products:', branchId);
      console.log('BranchId type:', typeof branchId);

      for (const productData of importedProducts) {
        console.log(`\n--- Processing product: ${productData.name} ---`);
        console.log('Product data:', productData);

        // Find category ID - try exact match first, then partial match
        let category = categories.find(cat =>
          cat.name.toLowerCase() === productData.category.toLowerCase()
        );

        // If no exact match, try partial match
        if (!category) {
          category = categories.find(cat =>
            cat.name.toLowerCase().includes(productData.category.toLowerCase()) ||
            productData.category.toLowerCase().includes(cat.name.toLowerCase())
          );
        }

        // If still no match, try to map common category names
        let finalCategoryName = productData.category; // Default to original category name
        if (!category) {
          const categoryMappings: { [key: string]: string } = {
            'medicine': 'Analgesics',
            'medicines': 'Analgesics',
            'drugs': 'Analgesics',
            'pharmaceuticals': 'Analgesics',
            'pain': 'Analgesics',
            'pain relief': 'Analgesics',
            'antibiotic': 'Antibiotics',
            'antibiotics': 'Antibiotics',
            'infection': 'Antibiotics',
            'vitamin': 'Vitamins',
            'vitamins': 'Vitamins',
            'supplements': 'Vitamins',
            'stomach': 'Gastric',
            'gastric': 'Gastric',
            'digestive': 'Gastric',
            'cough': 'Cough & Cold',
            'cold': 'Cough & Cold',
            'respiratory': 'Cough & Cold',
            'eye': 'Ophthalmic',
            'ophthalmic': 'Ophthalmic',
            'diabetes': 'Diabetes',
            'diabetic': 'Diabetes'
          };

          const mappedCategoryName = categoryMappings[productData.category.toLowerCase()];
          if (mappedCategoryName) {
            finalCategoryName = mappedCategoryName; // Use mapped name
            category = categories.find(cat =>
              cat.name.toLowerCase() === mappedCategoryName.toLowerCase()
            );
          }
        }

        console.log('Found category:', category);
        console.log('Available categories:', categories.map(c => ({ id: c.id, name: c.name })));
        console.log('Final category name to use:', finalCategoryName);

        // Set category data for backend
        if (category) {
          // Category exists, use its ID
          productData.categoryId = category.id;
          productData.categoryName = undefined; // Not needed since category exists
          console.log(`Using existing category: ${category.name} (ID: ${category.id})`);
        } else {
          // Category doesn't exist, let backend create it automatically
          console.log(`Category "${finalCategoryName}" not found, will be created automatically by backend`);
          productData.categoryName = finalCategoryName;
          productData.categoryId = 'auto-create'; // Placeholder, backend will handle this
        }

        // Use default supplier ID - no need to create or validate suppliers
        let supplierId = 'default-supplier';
        console.log(`Using default supplier for: ${productData.name}`);

        console.log('=== BULK IMPORT DEBUG ===');
        console.log(`Using branchId for product ${productData.name}:`, branchId);
        console.log('User object:', user);
        console.log('Using default branchId');
        console.log('Final branchId:', branchId);
        console.log('BranchId type:', typeof branchId);
        console.log('BranchId length:', branchId?.length);

        // Ensure all numeric fields are properly converted
        const sellingPrice = parseFloat(productData.sellingPrice) || 0;
        const costPrice = parseFloat(productData.costPrice) || (sellingPrice * 0.7); // Default to 70% of selling price
        const stock = parseInt(productData.stock) || 0;
        const minStock = parseInt(productData.minStock) || 10;

        console.log(`Product ${productData.name} numeric conversion:`, {
          originalSellingPrice: productData.sellingPrice,
          convertedSellingPrice: sellingPrice,
          originalCostPrice: productData.costPrice,
          convertedCostPrice: costPrice,
          originalStock: productData.stock,
          convertedStock: stock
        });

        const productToImport = {
          name: productData.name.trim(),
          description: (productData.description || "").trim(),
          categoryId: productData.categoryId, // Use the categoryId we set (either existing or 'auto-create')
          categoryName: productData.categoryName, // Include categoryName for auto-creation
          supplierId: supplierId, // Will be handled as default-supplier
          branchId: branchId,
          costPrice: costPrice,
          sellingPrice: sellingPrice,
          stock: stock,
          minStock: minStock,
          maxStock: productData.maxStock || null,
          unitType: (productData.unitType || "tablets").trim(),
          unitsPerPack: 1, // Always 1 for unit pricing
          barcode: (productData.barcode || "").trim() || null,
          requiresPrescription: Boolean(productData.requiresPrescription),
          isActive: true
        };

        // Final validation before adding to import list
        if (!productToImport.name || productToImport.sellingPrice <= 0) {
          console.error(`Skipping invalid product: ${productData.name}`, {
            name: productToImport.name,
            sellingPrice: productToImport.sellingPrice
          });
          continue;
        }

        productsToImport.push(productToImport);
        console.log(`Added product to import list: ${productData.name}`);
        console.log('Product to import:', productToImport);
      }

      console.log(`Total products prepared for import: ${productsToImport.length} out of ${importedProducts.length}`);
      console.log('Products to import:', productsToImport);

      if (productsToImport.length === 0) {
        alert('No valid products to import. Please check that your CSV file has the correct format with product names, categories, and prices.');
        setLoading(false);
        return;
      }

      // Call bulk import API
      console.log('=== CALLING BULK IMPORT API ===');
      console.log('Products to import:', productsToImport);
      console.log('Number of products:', productsToImport.length);
      console.log('API Base URL:', import.meta.env.VITE_API_BASE_URL);
      console.log('Token present:', !!localStorage.getItem('token'));
      console.log('User from context:', user);

      // Validate products before sending
      const invalidProducts = productsToImport.filter(p => !p.name || p.sellingPrice <= 0 || !p.branchId);
      if (invalidProducts.length > 0) {
        console.error('Invalid products found:', invalidProducts);
        alert(`Found ${invalidProducts.length} invalid products. Please check the data and try again.`);
        setLoading(false);
        return;
      }

      let response;
      try {
        console.log('Sending request to backend...');
        response = await apiService.bulkImportProducts(productsToImport);
        console.log('=== BULK IMPORT API RESPONSE ===');
        console.log('Response:', response);
        console.log('Response success:', response.success);
        console.log('Response data:', response.data);

        if (!response.success) {
          console.error('API call failed:', response.message);
          alert(`Import failed: ${response.message}`);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('=== BULK IMPORT API ERROR ===');
        console.error('Error details:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');

        // More detailed error message
        let errorMessage = 'Unknown error occurred';
        if (error instanceof Error) {
          if (error.message.includes('Network')) {
            errorMessage = 'Network error: Please check your internet connection and try again.';
          } else if (error.message.includes('401')) {
            errorMessage = 'Authentication error: Please log in again.';
          } else if (error.message.includes('403')) {
            errorMessage = 'Permission denied: You do not have permission to import products.';
          } else if (error.message.includes('500')) {
            errorMessage = 'Server error: Please try again later or contact support.';
          } else {
            errorMessage = `Import failed: ${error.message}`;
          }
        }

        alert(errorMessage);
        setLoading(false);
        return;
      }

      if (response && response.success) {
        console.log('Bulk import successful, reloading data...');
        console.log('Import response data:', response.data);
        console.log('Successful products:', response.data.successful);
        console.log('Failed products:', response.data.failed);

        // Reset filters to show all products
        setSelectedCategory("all");
        setSearchQuery("");
        setPagination(prev => ({ ...prev, page: 1 }));

        // Reload data - fetch products for the current branch to ensure imported products are visible
        console.log('About to reload data...');
        console.log('Using branchId for reload:', branchId);
        console.log('BranchId type for reload:', typeof branchId);
        console.log('BranchId length for reload:', branchId?.length);

        try {
          const allProductsResponse = await apiService.getProducts({
            limit: 1000,
            branchId: branchId
          });
          console.log('All products response after import:', allProductsResponse);

          if (allProductsResponse.success && allProductsResponse.data) {
            const allProducts = allProductsResponse.data.products;
            console.log('Total products after import:', allProducts.length);
            console.log('All products data:', allProducts);

            // If no products found with branch filter, try without branch filter
            if (allProducts.length === 0) {
              console.log('No products found with branch filter, trying without branch filter...');
              const allProductsResponseNoFilter = await apiService.getProducts({
                limit: 1000
              });
              console.log('All products response (no filter):', allProductsResponseNoFilter);

              if (allProductsResponseNoFilter.success && allProductsResponseNoFilter.data) {
                const allProductsNoFilter = allProductsResponseNoFilter.data.products;
                console.log('Total products (no filter):', allProductsNoFilter.length);
                console.log('All products data (no filter):', allProductsNoFilter);

                // Filter products by branchId manually
                const branchFilteredProducts = allProductsNoFilter.filter(product =>
                  product.branch.id === branchId
                );
                console.log('Manually filtered products for branch:', branchFilteredProducts.length);
                console.log('Branch IDs in products:', allProductsNoFilter.map(p => ({ name: p.name, branchId: p.branch.id })));

                // Use manually filtered products
                const filteredProducts = branchFilteredProducts;

                // Apply pagination
                const startIndex = 0; // Start from first page
                const endIndex = 50; // Show first 50 products
                const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

                setProducts(paginatedProducts);
                setPagination({
                  page: 1,
                  limit: 50,
                  total: filteredProducts.length,
                  pages: Math.ceil(filteredProducts.length / 50)
                });

                console.log('Products updated after import (manual filter):', paginatedProducts.length);
                console.log('Updated products list (manual filter):', paginatedProducts);
              }
            } else {
              // Since we reset filters, show all products without any filtering
              const filteredProducts = allProducts;

              // Apply pagination
              const startIndex = 0; // Start from first page
              const endIndex = 50; // Show first 50 products
              const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

              setProducts(paginatedProducts);
              setPagination({
                page: 1,
                limit: 50,
                total: filteredProducts.length,
                pages: Math.ceil(filteredProducts.length / 50)
              });

              console.log('Products updated after import:', paginatedProducts.length);
              console.log('Updated products list:', paginatedProducts);
            }
          }
        } catch (error) {
          console.error('Error reloading data after import:', error);
          // Fallback to regular loadData
          await loadData();
        }
        console.log('Data reload completed');

        // Close dialogs
        setIsPreviewDialogOpen(false);
        setIsImportDialogOpen(false);
        setImportedProducts([]);

        // Show results with detailed information
        const { successCount, failureCount } = response.data;
        const updatedCount = response.data.failed.filter((f: any) => f.error.includes('Updated existing product')).length;
        const skippedCount = response.data.failed.filter((f: any) => f.error.includes('already exists') && !f.error.includes('Updated')).length;
        const actualFailureCount = failureCount - updatedCount - skippedCount;

        let message = `Import completed!\n\n✅ Added: ${successCount} new products`;

        if (updatedCount > 0) {
          message += `\n🔄 Updated: ${updatedCount} existing products (stock added)`;
        }

        if (skippedCount > 0) {
          message += `\n⏭️ Skipped: ${skippedCount} existing products`;
        }

        if (actualFailureCount > 0) {
          message += `\n❌ Failed: ${actualFailureCount} products`;
          // Show details of failed products
          const failedProducts = response.data.failed;
          if (failedProducts && failedProducts.length > 0) {
            message += `\n\nFailed products:\n`;
            failedProducts.slice(0, 5).forEach((failed: any, index: number) => {
              message += `${index + 1}. ${failed.product.name}: ${failed.error}\n`;
            });
            if (failedProducts.length > 5) {
              message += `... and ${failedProducts.length - 5} more. Check console for details.`;
            }
          }
        }

        alert(message);

        console.log('Import completed successfully:', {
          total: response.data.total,
          successful: response.data.successCount,
          skipped: skippedCount,
          failed: actualFailureCount,
          successfulProducts: response.data.successful.length
        });
      } else {
        alert(response.message || 'Failed to import products. Please try again.');
      }
    } catch (error) {
      console.error('Error importing products:', error);
      alert('Error importing products. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inventory Management</h1>
          <p className="text-muted-foreground text-sm mt-[5px]">Manage your pharmacy inventory</p>
        </div>

        {/* Date and Time Display */}
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true
            })}
          </p>
        </div>
        <div className="flex items-center space-x-3">


          {/* Export/Import Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleExportInventory}
              className="text-[#0c2c8a] border-[1px] border-[#0c2c8a] "
            >
              <Upload className="w-4 h-4 mr-2" />
              Export
            </Button>

            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="text-[#1C623C]  border-[1px] border-[#1a623a]"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Import
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle className="flex items-center space-x-2">
                    <Download className="w-5 h-5 text-primary" />
                    <span>Import Products</span>
                  </DialogTitle>
                  <DialogDescription>
                    Choose how you want to import products into your inventory.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-medium mb-2">Choose Import Method</h3>
                    <p className="text-sm text-gray-500 mb-6">
                      Select how you want to import your products
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Excel Sheet Upload */}
                    <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Upload CSV File</h4>
                          <p className="text-sm text-gray-500">Import products from CSV file</p>
                        </div>
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleExcelUpload}
                          className="hidden"
                          id="excel-upload"
                          aria-label="Upload CSV file"
                          title="Upload CSV file"
                        />
                        <Button
                          variant="outline"
                          className="border-blue-500 text-blue-600 hover:bg-blue-50"
                          onClick={() => document.getElementById('excel-upload')?.click()}
                        >
                          <FileSpreadsheet className="w-4 h-4 mr-2" />
                          Upload Sheet
                        </Button>
                      </div>
                    </div>

                    {/* Image Upload */}
                    <div className="border-2 border-dashed border-[#0c2c8a] rounded-lg p-6 text-center hover:border-[#153186] transition-colors">
                      <div className="flex flex-col items-center space-y-3">
                        <div className="w-12 h-12 bg-[#0c2c8a]/10 rounded-full flex items-center justify-center">
                          <Image className="w-6 h-6 text-[#0c2c8a]" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">Upload Photo</h4>
                          <p className="text-sm text-gray-500">Take a photo of your product list</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          id="image-upload"
                          aria-label="Upload image file"
                          title="Upload image file"
                        />
                        <Button
                          variant="outline"
                          className="border-[#0c2c8a] text-[#0c2c8a] hover:bg-[#0c2c8a]/10"
                          onClick={() => document.getElementById('image-upload')?.click()}
                          disabled={processingImage}
                        >
                          {processingImage ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <Image className="w-4 h-4 mr-2" />
                              Upload Photo
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-xs text-gray-400">
                      Supported formats: CSV, Images (.png, .jpg, .jpeg)
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Bulk Delete Button */}
          {selectedProducts.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDeleteClick}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedProducts.length})
            </Button>
          )}
          {/* Create Category Dialog */}
          <Dialog open={isCreateCategoryDialogOpen} onOpenChange={setIsCreateCategoryDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="text-white hover:text-[#0c2c8a] bg-[#0c2c8a]  border-[1px] border-[#0c2c8a]">
                <Plus className="w-4 h-4 mr-2" />
                Create Category
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Plus className="w-5 h-5 text-[#0c2c8a]" />
                  <span>Create New Category</span>
                </DialogTitle>
                <DialogDescription>
                  Add a new category to organize your products.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="categoryName">Category Name *</Label>
                  <Input
                    id="categoryName"
                    placeholder="e.g., Catagory Name"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="categoryDescription">Description</Label>
                  <Textarea
                    id="categoryDescription"
                    placeholder="Brief description of the category..."
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateCategoryDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="text-white bg-[#0c2c8a] hover:bg-transparent  hover:text-[#0c2c8a]  border-[1px] border-[#0c2c8a] " onClick={handleCreateCategory} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Create Category
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Medicine Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="text-white bg-[#0c2c8a] hover:bg-transparent  hover:text-[#0c2c8a]  border-[1px] border-[#0c2c8a] "
                onClick={() => {
                  console.log('Add Product button clicked');
                  setIsAddDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Plus className="w-5 h-5 text-[#0c2c8a]" />
                  <span>Add New Medicine</span>
                </DialogTitle>
                <DialogDescription>
                  Add a new product to your inventory with all necessary details.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Basic Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="name">Medicine Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Paracetamol 500mg"
                      value={newMedicine.name}
                      onChange={(e) => setNewMedicine({...newMedicine, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select value={newMedicine.categoryId} onValueChange={(value) => setNewMedicine({...newMedicine, categoryId: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>


                </div>

                {/* Pricing & Stock */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Pricing & Stock</h3>

                  <div className="space-y-2">
                    <Label htmlFor="costPrice">Cost Price per Unit (PKR)</Label>
                    <Input
                      id="costPrice"
                      type="number"
                      placeholder="e.g., 3.00"
                      value={newMedicine.costPrice}
                      onChange={(e) => setNewMedicine({...newMedicine, costPrice: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sellingPrice">Selling Price per Unit (PKR) *</Label>
                    <Input
                      id="sellingPrice"
                      type="number"
                      placeholder="e.g., 5.00"
                      value={newMedicine.sellingPrice}
                      onChange={(e) => setNewMedicine({...newMedicine, sellingPrice: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stock">Current Stock (Units) *</Label>
                    <Input
                      id="stock"
                      type="number"
                      placeholder="e.g., 150"
                      value={newMedicine.stock}
                      onChange={(e) => setNewMedicine({...newMedicine, stock: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="minStock">Minimum Stock Level (Units)</Label>
                    <Input
                      id="minStock"
                      type="number"
                      placeholder="e.g., 50"
                      value={newMedicine.minStock}
                      onChange={(e) => setNewMedicine({...newMedicine, minStock: e.target.value})}
                    />
                  </div>


                  <div className="space-y-2">
                    <Label htmlFor="maxStock">Maximum Stock Level</Label>
                    <Input
                      id="maxStock"
                      type="number"
                      placeholder="e.g., 200"
                      value={newMedicine.maxStock}
                      onChange={(e) => setNewMedicine({...newMedicine, maxStock: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="barcode"
                        placeholder="e.g., 1234567890123"
                        value={newMedicine.barcode}
                        onChange={(e) => setNewMedicine({...newMedicine, barcode: e.target.value})}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewMedicine({...newMedicine, barcode: generateBarcode()})}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>

                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-6">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="text-white bg-[#0c2c8a] hover:bg-transparent  hover:text-[#0c2c8a]  border-[1px] border-[#0c2c8a] " onClick={handleAddMedicine} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Add Product
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Product Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Edit className="w-5 h-5 text-primary" />
                  <span>Edit Product</span>
                </DialogTitle>
                <DialogDescription>
                  Update the product information and save changes to your inventory.
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Basic Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Medicine Name *</Label>
                    <Input
                      id="edit-name"
                      placeholder="e.g., Paracetamol 500mg"
                      value={newMedicine.name}
                      onChange={(e) => setNewMedicine({...newMedicine, name: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-category">Category *</Label>
                    <Select value={newMedicine.categoryId} onValueChange={(value) => setNewMedicine({...newMedicine, categoryId: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-unitsPerPack">Units per Pack</Label>
                    <Input
                      id="edit-unitsPerPack"
                      type="number"
                      placeholder="e.g., 20"
                      value={newMedicine.unitsPerPack}
                      onChange={(e) => setNewMedicine({...newMedicine, unitsPerPack: e.target.value})}
                    />
                  </div>
                </div>

                {/* Pricing & Stock */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Pricing & Stock</h3>

                  <div className="space-y-2">
                    <Label htmlFor="edit-costPrice">Cost Price (PKR)</Label>
                    <Input
                      id="edit-costPrice"
                      type="number"
                      placeholder="e.g., 60"
                      value={newMedicine.costPrice}
                      onChange={(e) => setNewMedicine({...newMedicine, costPrice: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-sellingPrice">Selling Price (PKR) *</Label>
                    <Input
                      id="edit-sellingPrice"
                      type="number"
                      placeholder="e.g., 85"
                      value={newMedicine.sellingPrice}
                      onChange={(e) => setNewMedicine({...newMedicine, sellingPrice: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-stock">Current Stock *</Label>
                    <Input
                      id="edit-stock"
                      type="number"
                      placeholder="e.g., 150"
                      value={newMedicine.stock}
                      onChange={(e) => setNewMedicine({...newMedicine, stock: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-minStock">Minimum Stock Level</Label>
                    <Input
                      id="edit-minStock"
                      type="number"
                      placeholder="e.g., 50"
                      value={newMedicine.minStock}
                      onChange={(e) => setNewMedicine({...newMedicine, minStock: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-maxStock">Maximum Stock Level</Label>
                    <Input
                      id="edit-maxStock"
                      type="number"
                      placeholder="e.g., 200"
                      value={newMedicine.maxStock}
                      onChange={(e) => setNewMedicine({...newMedicine, maxStock: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-barcode">Barcode</Label>
                    <div className="flex space-x-2">
                      <Input
                        id="edit-barcode"
                        placeholder="e.g., 1234567890123"
                        value={newMedicine.barcode}
                        onChange={(e) => setNewMedicine({...newMedicine, barcode: e.target.value})}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setNewMedicine({...newMedicine, barcode: generateBarcode()})}
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-6">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="text-white bg-[#0c2c8a] hover:bg-transparent  hover:text-[#0c2c8a]  border-[1px] border-[#0c2c8a] " onClick={handleUpdateProduct} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Update Product
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <span>Confirm Delete</span>
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. The product will be permanently removed from your inventory.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      Delete Product
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Are you sure you want to delete this product? This action cannot be undone.
                    </p>
                    {deletingProduct && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium text-gray-900">
                          {deletingProduct.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Category: {deletingProduct.category.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Stock: {deletingProduct.stock} units
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancelDelete}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Confirm Delete
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Bulk Delete Confirmation Dialog */}
          <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  <span>Confirm Bulk Delete</span>
                </DialogTitle>
                <DialogDescription>
                  This action cannot be undone. The selected products will be permanently removed from your inventory.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      Delete {selectedProducts.length} Products
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Are you sure you want to delete {selectedProducts.length} selected products? This action cannot be undone.
                    </p>
                    <div className="mt-3 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm font-medium text-gray-900">
                        Selected Products:
                      </p>
                      <div className="mt-2 max-h-32 overflow-y-auto">
                        {selectedProducts.map(productId => {
                          const product = products.find(p => p.id === productId);
                          return product ? (
                            <p key={productId} className="text-xs text-gray-500">
                              • {product.name}
                            </p>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancelBulkDelete}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleConfirmBulkDelete}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete {selectedProducts.length} Products
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-md border-[1px] border-[#0c2c8a]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold text-foreground">{totalProducts}</p>
              </div>
              <Package className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-[1px] border-[#0c2c8a]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold text-warning">{lowStockCount}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-[1px] border-[#0c2c8a]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold text-foreground">PKR {totalValue.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-[1px] border-[#0c2c8a]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold text-foreground">{categories.length}</p>
              </div>
              <TrendingDown className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card className="shadow-soft border-0">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCategoryManagementOpen(true)}
                className="flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                View Categories
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card className="shadow-soft border-0">
        <CardHeader>
          <CardTitle>Products ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Loading products...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              <p>{error}</p>
              <Button onClick={loadData} className="mt-2">
                Try Again
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground w-12">
                      <input
                        type="checkbox"
                        checked={selectedProducts.length === products.length && products.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                        aria-label="Select all products"
                        title="Select all products"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Product</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Pricing</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Stock</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-muted-foreground">
                        <div className="flex flex-col items-center space-y-2">
                          <Package className="w-12 h-12 text-muted-foreground/50" />
                          <p className="text-lg font-medium">No products found</p>
                          <p className="text-sm">Start by adding your first product to the inventory</p>
                          <Button
                            onClick={() => {
                              console.log('Empty state Add Product button clicked');
                              setIsAddDialogOpen(true);
                            }}
                            className="mt-2 text-[#0c2c8a] bg-transparent border-[1px] border-[#0c2c8a] hover:bg-transparent "
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Product
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    products.map((product) => {
                      const stockStatus = getStockStatus(product.stock, product.minStock);

                      return (
                        <tr key={product.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-4 px-4 w-12">
                            <input
                              type="checkbox"
                              checked={selectedProducts.includes(product.id)}
                              onChange={() => handleSelectProduct(product.id)}
                              className="rounded border-gray-300"
                              aria-label={`Select ${product.name}`}
                              title={`Select ${product.name}`}
                            />
                          </td>
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-medium text-foreground">{product.name}</p>
                              {product.barcode && (
                                <p className="text-sm text-muted-foreground flex items-center">
                                  <Barcode className="w-3 h-3 mr-1" />
                                  {product.barcode}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline">{product.category.name}</Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">
                              <p className="font-medium">PKR {product.sellingPrice}</p>
                              <p className="text-muted-foreground">Cost: PKR {product.costPrice}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{product.stock}</span>
                              <Badge
                                variant={stockStatus.color === 'destructive' ? 'destructive' : 'default'}
                                className={stockStatus.color === 'warning' ? 'bg-orange-100 text-orange-800 border-orange-200' : ''}
                              >
                                {stockStatus.status}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Min: {product.minStock} | Max: {product.maxStock || 'N/A'}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Edit"
                                onClick={() => handleEditProduct(product)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(product)}
                                className="text-destructive hover:text-destructive"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              <span>Preview Imported Products</span>
            </DialogTitle>
            <DialogDescription>
              Review and edit the imported products before adding them to your inventory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Review the extracted product information below. You can edit any fields before proceeding with the import.
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Extracted Products ({importedProducts.length})</h3>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Product Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Category</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Unit Type</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Cost Price</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Selling Price</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Stock</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Units/Pack</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Barcode</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedProducts.map((product, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">
                            <Input
                              value={product.name}
                              onChange={(e) => {
                                const updated = [...importedProducts];
                                updated[index].name = e.target.value;
                                setImportedProducts(updated);
                              }}
                              className="w-full"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Select
                              value={product.category}
                              onValueChange={(value) => {
                                const updated = [...importedProducts];
                                updated[index].category = value;
                                setImportedProducts(updated);
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category.id} value={category.name}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {!categories.find(cat => cat.name.toLowerCase() === product.category.toLowerCase()) && (
                              <p className="text-xs text-blue-600 mt-1">
                                📁 Category "{product.category}" will be auto-created during import.
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Select
                              value={product.unitType}
                              onValueChange={(value) => {
                                const updated = [...importedProducts];
                                updated[index].unitType = value;
                                setImportedProducts(updated);
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="tablets">Tablets</SelectItem>
                                <SelectItem value="capsules">Capsules</SelectItem>
                                <SelectItem value="syrup">Syrup</SelectItem>
                                <SelectItem value="injection">Injection</SelectItem>
                                <SelectItem value="drops">Drops</SelectItem>
                                <SelectItem value="cream">Cream</SelectItem>
                                <SelectItem value="ointment">Ointment</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              step="0.01"
                              value={product.costPrice}
                              onChange={(e) => {
                                const updated = [...importedProducts];
                                updated[index].costPrice = parseFloat(e.target.value) || 0;
                                setImportedProducts(updated);
                              }}
                              className="w-full"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              step="0.01"
                              value={product.sellingPrice}
                              onChange={(e) => {
                                const updated = [...importedProducts];
                                updated[index].sellingPrice = parseFloat(e.target.value) || 0;
                                setImportedProducts(updated);
                              }}
                              className="w-full"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              value={product.stock}
                              onChange={(e) => {
                                const updated = [...importedProducts];
                                updated[index].stock = parseInt(e.target.value) || 0;
                                setImportedProducts(updated);
                              }}
                              className="w-full"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              type="number"
                              value={product.unitsPerPack}
                              onChange={(e) => {
                                const updated = [...importedProducts];
                                updated[index].unitsPerPack = parseInt(e.target.value) || 1;
                                setImportedProducts(updated);
                              }}
                              className="w-full"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <Input
                              value={product.barcode || ''}
                              onChange={(e) => {
                                const updated = [...importedProducts];
                                updated[index].barcode = e.target.value;
                                setImportedProducts(updated);
                              }}
                              className="w-full"
                              placeholder="Optional"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsPreviewDialogOpen(false);
                  setImportedProducts([]);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleProceedImport}
                disabled={loading}
                className="text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Proceed Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Management */}
      <CategoryManagement
        isOpen={isCategoryManagementOpen}
        onClose={() => setIsCategoryManagementOpen(false)}
        onCategoryChange={() => {
          // Reload categories and products when categories change
          loadData();
        }}
      />
    </div>
  );
};

export default Inventory;