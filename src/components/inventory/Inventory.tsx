import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import CategoryManagement from "./CategoryManagement";
import CategoryForm from "./CategoryForm";
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
import { useToast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  description?: string;
  formula?: string; // Product composition/formula
  sku?: string; // Stock Keeping Unit
  category: {
    id: string;
    name: string;
    type?: string; // Category type (MEDICAL, NON_MEDICAL, GENERAL)
  };
  supplier?: {
    id: string;
    name: string;
  };
  branch: {
    id: string;
    name: string;
  };
  barcode?: string;
  requiresPrescription: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  batches?: {
    id: string;
    batchNo: string;
    quantity: number;        // Current remaining quantity
    totalBoxes?: number;     // Original boxes purchased
    unitsPerBox?: number;    // Units per box
    purchasePrice?: number;
    sellingPrice?: number;
    expireDate?: string;
    supplierName?: string;
    supplier?: {
      id: string;
      name: string;
      manufacturer?: {
        id: string;
        name: string;
      };
    };
  }[];
  // Batch-derived fields
  price?: number;
  stock?: number;
  minStock?: number;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  type?: string; // Category type (MEDICAL, NON_MEDICAL, GENERAL)
}

interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  manufacturerId?: string;
  manufacturer?: {
    id: string;
    name: string;
  };
  isActive: boolean;
}

const Inventory = () => {
  const { user } = useAuth();
  const { selectedBranchId, selectedBranch, setSelectedBranchId, allBranches } = useAdmin();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedProductType, setSelectedProductType] = useState("all");
  const [selectedManufacturer, setSelectedManufacturer] = useState("all");
  const [selectedSupplier, setSelectedSupplier] = useState("all");
  const [showAllProducts, setShowAllProducts] = useState(true); // Show all products by default
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  // Stock filter checkboxes
  const [showNoStock, setShowNoStock] = useState(false); // Products without any stock (never had stock)
  const [showOutOfStock, setShowOutOfStock] = useState(false); // Products that are out of stock (stock = 0)
  const [showLowStock, setShowLowStock] = useState(false); // Products with low stock (stock <= minStock)
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [isCategoryManagementOpen, setIsCategoryManagementOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateCategoryDialogOpen, setIsCreateCategoryDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]); // Store all products for filtering
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
    formula: "",
    barcode: "",
    requiresPrescription: false
  });

  // Form state for creating new category
  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    type: 'general' as 'medical' | 'non-medical' | 'general',
    color: "#3B82F6"
  });


  // Load data on component mount
  useEffect(() => {
    console.log('Component mounted, loading data...');
    loadData();
  }, [selectedBranchId]); // Re-run when selected branch changes

  // Apply filters when filter states or search query changes
  useEffect(() => {
    console.log('🔄 Filters or search query changed, applying filters...');
    applyFilters();
  }, [selectedCategory, selectedProductType, selectedManufacturer, selectedSupplier, allProducts, searchQuery, showNoStock, showOutOfStock, showLowStock]);

  // Reload data when showAllProducts changes
  useEffect(() => {
    if (showAllProducts !== false) {
      console.log('ShowAllProducts changed, reloading data...');
      loadData();
    }
  }, [showAllProducts]);

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

    const handleSaleChanged = (event: CustomEvent) => {
      console.log('🔄 Real-time sale change received:', event.detail);
      const { action, sale } = event.detail;

      if (action === 'created') {
        // Reload inventory data to reflect stock changes
        console.log('🔄 Sale created, reloading inventory data...');
        loadData();
      }
    };

    // Add event listeners
    window.addEventListener('productChanged', handleProductChanged as EventListener);
    window.addEventListener('inventoryChanged', handleInventoryChanged as EventListener);
    window.addEventListener('saleChanged', handleSaleChanged as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('productChanged', handleProductChanged as EventListener);
      window.removeEventListener('inventoryChanged', handleInventoryChanged as EventListener);
      window.removeEventListener('saleChanged', handleSaleChanged as EventListener);
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
        // Admin uses selected branch if provided; if only one branch exists, it was auto-selected in AdminContext
        if (selectedBranchId) {
          branchId = selectedBranchId;
          console.log('Admin selected specific branch:', selectedBranch?.name);
        } else {
          console.log('Admin viewing all branches - loading all products');
        }
      } else {
        // Regular users see only their branch products
          branchId = user?.branchId || "default-branch";
        console.log('Regular user branch:', branchId);
      }

      // Load products from database - fetch ALL products for filtering
      const params: any = { limit: 10000 }; // High limit to get all products
      if (branchId) {
        params.branchId = branchId;
      }

      console.log('Calling getProducts API with params:', params);

      // Force reset backend ready state to ensure we try embedded server
      const isElectron = typeof window !== 'undefined' && typeof (window as any).electronAPI !== 'undefined';
      if (isElectron) {
        // Reset backend ready state to force re-check (will use embedded server)
        apiService.resetBackendReady();
      }

      const response = await apiService.getProducts(params);

      console.log('=== PRODUCTS API RESPONSE ===');
      console.log('Products API response:', response);
      console.log('Requesting products for branchId:', branchId);
      console.log('Response success:', response.success);
      console.log('Response data:', response.data);
      console.log('Response data type:', typeof response.data);
      console.log('Response message:', response.message);

      if (response.success && response.data) {
        // Handle both response formats: { products: [...] } and direct array
        const allProducts = Array.isArray(response.data)
          ? response.data
          : (response.data.products || []);

        if (!Array.isArray(allProducts)) {
          console.error('❌ Products data is not an array:', allProducts);
          setError('Invalid products data format received from server');
          setProducts([]);
          setAllProducts([]);
          return;
        }

        console.log('Total products from API:', allProducts.length);
        console.log('All products:', allProducts);

        // Batch data is now included in the product response
        console.log('🔄 Processing products with batch data...');
        const productsWithBatchData = allProducts.map((product: any) => {
          console.log(`🔄 Processing product ${product.name}:`, {
            price: product.price,
            stock: product.stock,
            currentBatch: product.currentBatch
          });

          return {
            ...product,
            price: product.price || 0, // Price now comes from batch data
            stock: product.stock || 0,  // Stock now comes from batch data
            batches: product.batches || [] // Include batches for manufacturer filtering
          };
        });

        console.log('🔄 Products with batch data:', productsWithBatchData);
        const allProductsWithBatchData = productsWithBatchData;

        // Filter products based on search and category
        let filteredProducts = allProductsWithBatchData;

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

        // Store all products for filtering
        setAllProducts(productsWithBatchData);
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

      // Load categories from database - show categories for selected branch
      const categoryBranchId = (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')
        ? (selectedBranchId || user?.branchId || "")
        : (user?.branchId || "");

      const categoriesResponse = await apiService.getCategories({
        branchId: categoryBranchId
      });
      if (categoriesResponse.success && categoriesResponse.data) {
        // Show all categories for the current branch (not filtered by products)
        setCategories(categoriesResponse.data.categories);
      } else {
        // Fallback to empty array if no categories found
        setCategories([]);
      }

      // Load suppliers from database - show suppliers for selected branch
      const supplierBranchId = (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')
        ? (selectedBranchId || user?.branchId || "")
        : (user?.branchId || "");

      const suppliersResponse = await apiService.getSuppliers({
        branchId: supplierBranchId
      });
      console.log('🔍 Suppliers API response:', suppliersResponse);
      if (suppliersResponse.success && suppliersResponse.data) {
        // Handle different response formats
        let suppliersData: Supplier[] = [];

        // Check if data is an array directly
        if (Array.isArray(suppliersResponse.data)) {
          suppliersData = suppliersResponse.data as Supplier[];
        }
        // Check if data has suppliers property
        else if ('suppliers' in suppliersResponse.data && Array.isArray(suppliersResponse.data.suppliers)) {
          suppliersData = suppliersResponse.data.suppliers as Supplier[];
        }

        // Map supplier data to include manufacturer info
        const mappedSuppliers = suppliersData.map((supplier: any) => ({
          id: supplier.id,
          name: supplier.name,
          contactPerson: supplier.contactPerson,
          phone: supplier.phone,
          email: supplier.email,
          address: supplier.address,
          manufacturerId: supplier.manufacturerId,
          manufacturer: supplier.manufacturer ? {
            id: supplier.manufacturer.id,
            name: supplier.manufacturer.name
          } : undefined,
          isActive: supplier.isActive
        }));

        console.log('🔍 Setting suppliers to state:', mappedSuppliers);
        setSuppliers(mappedSuppliers);
      } else {
        console.error('Failed to load suppliers:', suppliersResponse.message);
        // Set empty array if no suppliers found
        setSuppliers([]);
      }

      // Load manufacturers from database
      const manufacturersResponse = await apiService.getManufacturers({
        page: 1,
        limit: 1000,
        active: true
      });
      console.log('🔍 Manufacturers API response:', manufacturersResponse);
      if (manufacturersResponse.success && manufacturersResponse.data) {
        const manufacturersData = manufacturersResponse.data.manufacturers || [];
        console.log('🔍 Setting manufacturers to state:', manufacturersData);
        setManufacturers(manufacturersData);
      } else {
        console.error('Failed to load manufacturers:', manufacturersResponse.message);
        setManufacturers([]);
      }

    } catch (err: any) {
      console.error('❌ Error loading data:', err);
      console.error('❌ Error message:', err?.message);
      console.error('❌ Error stack:', err?.stack);

      // Check if it's a connection error
      if (err?.message && err.message.includes('Failed to fetch')) {
        setError('⚠️ Backend server is not running. Please start the server and refresh the page.');
      } else {
        const errorMessage = err?.message || 'Unknown error occurred';
        console.error('❌ Failed to load inventory data:', errorMessage);
        setError(`Failed to load inventory data: ${errorMessage}. Please check your connection and try again.`);

        // Clear data - do NOT set fallback/demo data
        setProducts([]);
        setCategories([]);
        setSuppliers([]);
        setManufacturers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Get unique manufacturers from API
  const getUniqueManufacturers = () => {
    // Return manufacturers from state loaded from API
    return manufacturers.map(m => ({
      id: m.id,
      name: m.name
    }));
  };

  // Get unique suppliers from products
  const getUniqueSuppliers = () => {
    const supplierNames = new Set<string>();

    // First, add suppliers from the loaded suppliers list
    console.log('🔍 Current suppliers state:', suppliers);
    suppliers.forEach(supplier => {
      if (supplier.name) {
        supplierNames.add(supplier.name);
      }
    });

    // Also add suppliers from products
    console.log('🔍 Current allProducts:', allProducts);
    allProducts.forEach(product => {
      if (product.supplier && product.supplier.name) {
        supplierNames.add(product.supplier.name);
      }
    });

    const uniqueSuppliers = Array.from(supplierNames).sort();
    console.log('🔍 Unique suppliers to display:', uniqueSuppliers);

    return uniqueSuppliers;
  };

  // Apply filters based on selected criteria
  const applyFilters = () => {
    // IMPORTANT: Stock filters apply to ALL products from database first
    // They are primary filters that work independently
    let filtered = [...allProducts];

    // Stock-based filters (checkboxes) - Apply FIRST to all database products
    if (showNoStock || showOutOfStock || showLowStock) {
      filtered = filtered.filter(product => {
        const stock = product.stock || 0;
        const minStock = product.minStock || 10;

        // Products without stock (no batches at all or never had stock)
        if (showNoStock && stock === 0 && (!product.batches || product.batches.length === 0)) {
          return true;
        }

        // Out of stock (stock = 0)
        if (showOutOfStock && stock === 0) {
          return true;
        }

        // Low stock (stock > 0 but <= minStock threshold)
        if (showLowStock && stock > 0 && stock <= minStock) {
          return true;
        }

        return false;
      });
    }

    // Filter by search query (applies after stock filter)
    if (searchQuery) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter(product => product.category?.id === selectedCategory);
    }

    // Filter by product type (from category type)
    if (selectedProductType !== "all") {
      filtered = filtered.filter(product => {
        // Check both product.category.type and categories array
        const categoryType = product.category?.type || categories.find(cat => cat.id === product.category?.id)?.type;
        return categoryType === selectedProductType.toUpperCase();
      });
    }

    // Filter by manufacturer (via supplier)
    if (selectedManufacturer !== "all") {
      filtered = filtered.filter(product => {
        // Get the supplier for this product
        const supplier = suppliers.find(s => s.id === product.supplier?.id);
        if (supplier && supplier.manufacturerId) {
          return supplier.manufacturerId === selectedManufacturer;
        }
        return false;
      });
    }

    // Filter by supplier
    if (selectedSupplier !== "all") {
      filtered = filtered.filter(product => product.supplier?.name === selectedSupplier);
    }

    setProducts(filtered);
    setPagination(prev => ({
      ...prev,
      total: filtered.length,
      pages: Math.ceil(filtered.length / prev.limit)
    }));
  };

  const lowStockCount = 0; // Stock is now managed via batches
  const totalProducts = pagination.total;

  // Calculate total value from all batches across all products
  // Total value = sum of (quantity * purchasePrice) for each batch
  const totalValue = useMemo(() => {
    let total = 0;
    allProducts.forEach((product: any) => {
      if (product.batches && Array.isArray(product.batches)) {
        product.batches.forEach((batch: any) => {
          const quantity = batch.quantity || 0;
          const purchasePrice = batch.purchasePrice || 0;
          total += quantity * purchasePrice;
        });
      }
    });
    return total;
  }, [allProducts]);

  const getStockStatus = (stock: number, minStock: number) => {
    if (stock === 0) return { status: "out", color: "destructive" };
    if (stock <= minStock) return { status: "low", color: "warning" };
    return { status: "good", color: "default" };
  };


  const generateBarcode = () => {
    const randomNum = Math.floor(Math.random() * 10000000000000);
    return randomNum.toString().padStart(13, '0');
  };

  const handleCreateCategory = async (formData: any) => {
    // Check if admin has selected a branch
    if ((user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && !selectedBranchId) {
      toast({
        title: "Branch Selection Required",
        description: "Please select a branch before creating a category!",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Determine branchId: use selectedBranchId for admin, or user's branchId for others
      const branchId = (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')
        ? (selectedBranchId || user?.branchId || '')
        : (user?.branchId || '');

      const categoryData = {
        name: formData.name,
        description: formData.description || "",
        type: formData.type, // Already converted to uppercase in CategoryForm
        color: formData.color,
        branchId: branchId // Always include branchId
      };

      // CRITICAL: Create category - embedded server saves to SQLite FIRST
      // Then optionally syncs to PostgreSQL backend (non-blocking)
      const response = await apiService.createCategory(categoryData);

      // CRITICAL: Show success if SQLite save succeeded (response.success === true)
      // This means data is saved locally, regardless of backend sync status
      if (response.success) {
        console.log('Category created successfully:', response.data);

        // Reload data to get the updated list
        await loadData();

        // Auto-select the newly created category in the product form
        if (response.data && response.data.id) {
          setNewMedicine({...newMedicine, categoryId: response.data.id});
        }

        // Reset form
        setNewCategory({
          name: "",
          description: "",
          type: 'general',
          color: "#3B82F6"
        });

        setIsCreateCategoryDialogOpen(false);
        toast({
          title: "Success",
          description: "Category created successfully!",
          variant: "default",
        });
        return;
      }

      // Handle offline mode - embedded server saved to SQLite but backend sync failed
      // This is still a success from user perspective (data is saved locally)
      if (response.code === 'OFFLINE_MODE') {
        // Data was saved to SQLite via embedded server
        // Backend sync will happen later when backend is available
        toast({
          title: "Category Added (Offline)",
          description: "Category has been saved locally. It will sync when connection is restored.",
        });
        setLoading(false);
        setIsCreateCategoryDialogOpen(false);
        setNewCategory({ name: "", description: "", type: 'general', color: "#3B82F6" });
        setTimeout(() => loadData(), 1000);
        return;
      }

      // Only show error for actual failures (validation, database errors, etc.)
      toast({
        title: "Creation Failed",
        description: response.message || "Failed to create category",
        variant: "destructive",
      });
    } catch (error: any) {
      console.error('Error creating category:', error);

      // Check if error is a network/connection issue
      const isNetworkError = error.message?.includes('fetch') ||
                            error.message?.includes('Failed to fetch') ||
                            error.message?.includes('NetworkError') ||
                            error.name === 'TypeError';

      if (isNetworkError) {
        // Network error - embedded server might not be running
        toast({
          title: "Error",
          description: "Cannot connect to local server. Please restart the application.",
          variant: "destructive",
        });
      } else {
        // Other errors (validation, auth, etc.) - show actual error
        toast({
          title: "Creation Error",
          description: error.message || "Failed to create category. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicine = async () => {
    if (!newMedicine.name || !newMedicine.categoryId) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields!",
        variant: "destructive",
      });
      return;
    }

    // Check if admin has selected a branch
    if ((user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && !selectedBranchId) {
      toast({
        title: "Branch Selection Required",
        description: "Please select a branch before adding a product!",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Get branch ID - use user's branch or get first available branch
      let branchId = (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')
        ? (selectedBranchId || user?.branchId || null)
        : (user?.branchId || null);

      // If no branch, try to get the first available
      if (!branchId) {
        try {
          const branchesResponse = await apiService.getBranches();
          if (branchesResponse.success && branchesResponse.data?.branches?.length > 0) {
            branchId = branchesResponse.data.branches[0].id;
          }
        } catch (e) {
          console.log('Could not fetch branches:', e);
        }
      }

      // branchId can be null - backend will handle it

      // Product data - stock/prices managed through batches, supplier is assigned at batch level
      const productData = {
        name: newMedicine.name,
        description: "",
        formula: newMedicine.formula || "",
        categoryId: newMedicine.categoryId,
        branchId: branchId,
        barcode: newMedicine.barcode || "",
        requiresPrescription: newMedicine.requiresPrescription,
        isActive: true,
        minStock: 1,
        maxStock: 1000,
        unitsPerPack: 1
      };

      console.log('Creating product with data:', productData);
      console.log('Using branchId for product creation:', branchId);
      console.log('Using default branchId');

      // CRITICAL: Create product - embedded server saves to SQLite FIRST
      // Then optionally syncs to PostgreSQL backend (non-blocking)
      const response = await apiService.createProduct(productData);

      // CRITICAL: Show success if SQLite save succeeded (response.success === true)
      // This means data is saved locally, regardless of backend sync status
      if (response.success && response.data) {
        console.log('Product created successfully:', response.data);

        // Transform the API response to match Product interface
        const newProduct: Product = {
          id: response.data.id,
          name: response.data.name,
          description: response.data.description || undefined,
          formula: response.data.formula || undefined,
          sku: response.data.sku,
          category: response.data.category || { id: response.data.categoryId, name: 'Unknown' },
          supplier: response.data.supplier || { id: '', name: 'Unknown' },
          branch: response.data.branch || { id: response.data.branchId, name: 'Unknown' },
          barcode: response.data.barcode || undefined,
          requiresPrescription: response.data.requiresPrescription || false,
          isActive: response.data.isActive !== undefined ? Boolean(response.data.isActive) : true,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt || response.data.createdAt,
          price: response.data.price || response.data.sellingPrice || 0,
          stock: response.data.stock || response.data.quantity || 0,
          minStock: response.data.minStock || 1,
          batches: []
        };

        console.log('✅ Product created - Transforming to Product interface');
        console.log('📦 New product data:', newProduct);
        console.log('🔍 Current branch filter:', {
          userRole: user?.role,
          selectedBranchId,
          userBranchId: user?.branchId,
          productBranchId: newProduct.branch.id
        });

        // Immediately add the product to the state so it appears in the list
        setAllProducts(prev => {
          // Check if product already exists (avoid duplicates)
          const exists = prev.some(p => p.id === newProduct.id);
          if (exists) {
            console.log('Product already exists in state, updating...');
            return prev.map(p => p.id === newProduct.id ? newProduct : p);
          }
          console.log('Adding new product to state');
          return [...prev, newProduct];
        });

        setProducts(prev => {
          // Check if product already exists (avoid duplicates)
          const exists = prev.some(p => p.id === newProduct.id);
          if (exists) {
            return prev.map(p => p.id === newProduct.id ? newProduct : p);
          }

          // Check branch filter - only show if product belongs to current branch
          let shouldShow = true;

          // Determine current branch filter
          let currentBranchId: string | undefined;
          if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
            currentBranchId = selectedBranchId;
          } else {
            currentBranchId = user?.branchId;
          }

          // If branch filter is active, check if product matches
          if (currentBranchId && newProduct.branch.id !== currentBranchId) {
            console.log('Product branch does not match current filter:', {
              productBranch: newProduct.branch.id,
              currentBranch: currentBranchId
            });
            shouldShow = false;
          }

          // Apply search filter
          if (shouldShow && searchQuery) {
            const query = searchQuery.toLowerCase();
            shouldShow = (
              newProduct.name.toLowerCase().includes(query) ||
              newProduct.barcode?.toLowerCase().includes(query)
            );
          }

          // Apply stock filters
          if (shouldShow) {
            if (showOutOfStock && (newProduct.stock || 0) !== 0) {
              shouldShow = false;
            }
            if (showLowStock && (newProduct.stock || 0) > (newProduct.minStock || 10)) {
              shouldShow = false;
            }
            if (showNoStock && (newProduct.stock || 0) > 0) {
              shouldShow = false;
            }
          }

          if (shouldShow) {
            console.log('Adding new product to displayed products list');
            return [...prev, newProduct];
          } else {
            console.log('New product filtered out by current filters');
          }
          return prev;
        });

        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('productCreated', {
          detail: { product: newProduct }
        }));

        // Reset form
        setNewMedicine({
          name: "",
          categoryId: "",
          formula: "",
          barcode: "",
          requiresPrescription: false
        });

        setIsAddDialogOpen(false);
        setLoading(false);

        toast({
          title: "Success",
          description: "Product added successfully!",
          variant: "default",
        });

        // Reload data in background to ensure everything is in sync
        // But don't wait for it - user already sees the product
        setTimeout(() => {
          loadData().catch(err => {
            console.error('Error reloading data after product creation:', err);
          });
        }, 1000);
        return;
      }

      // Handle offline mode - embedded server saved to SQLite but backend sync failed
      // This is still a success from user perspective (data is saved locally)
      if (response.code === 'OFFLINE_MODE') {
        // Data was saved to SQLite via embedded server
        // Backend sync will happen later when backend is available
        toast({
          title: "Product Added (Offline)",
          description: "Product has been saved locally. It will sync when connection is restored.",
        });
        setIsAddDialogOpen(false);
        setLoading(false);
        setNewMedicine({ name: "", categoryId: "", barcode: "", formula: "", requiresPrescription: false });
        // Reload to show the new product from SQLite
        setTimeout(() => {
          loadData().catch(err => {
            console.error('Error reloading data after product creation (offline):', err);
          });
        }, 1000);
        return;
      }

      // Only show error for actual failures (validation, database errors, etc.)
      console.error('[Inventory] Product creation failed:', response);
      console.error('[Inventory] Error message:', response.message);
      console.error('[Inventory] Error code:', response.code);
      console.error('[Inventory] Error details:', response.errors);

      setLoading(false);
      toast({
        title: "Add Failed",
        description: response.message || "Failed to add product. Please check console for details.",
        variant: "destructive",
      });
    } catch (error: any) {
      console.error('Error adding product:', error);

      // Check if error is a network/connection issue
      const isNetworkError = error.message?.includes('fetch') ||
                            error.message?.includes('Failed to fetch') ||
                            error.message?.includes('NetworkError') ||
                            error.name === 'TypeError';

      setLoading(false);

      if (isNetworkError) {
        // Network error - embedded server might not be running
        // This is a critical issue in Electron mode
        toast({
          title: "Error",
          description: "Cannot connect to local server. Please restart the application.",
          variant: "destructive",
        });
      } else {
        // Other errors (validation, auth, etc.) - show actual error
        console.error('[Inventory] Product creation error:', error);
        console.error('[Inventory] Error stack:', error.stack);
        toast({
          title: "Add Error",
          description: error.message || "Failed to add product. Please check console for details and try again.",
          variant: "destructive",
        });
      }
    } finally {
      // Only reset dialog if it's still open (not already closed in success case)
      // Don't reload data here - it's already handled in success/error cases
      if (isAddDialogOpen) {
        setIsAddDialogOpen(false);
      }
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setNewMedicine({
      name: product.name,
      categoryId: product.category?.id || '',
      formula: product.formula || "",
      barcode: product.barcode || "",
      requiresPrescription: product.requiresPrescription || false
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !newMedicine.name || !newMedicine.categoryId) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields!",
        variant: "destructive",
      });
      return;
    }

    // Check if admin has selected a branch
    if ((user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && !selectedBranchId) {
      toast({
        title: "Branch Selection Required",
        description: "Please select a branch before updating a product!",
        variant: "destructive",
      });
      return;
    }

      try {
        setLoading(true);

      const productData = {
        name: newMedicine.name,
        description: editingProduct.description || "",
        formula: newMedicine.formula || "",
        sku: editingProduct.sku || "", // Add SKU field
        categoryId: newMedicine.categoryId,
        supplierId: editingProduct.supplier?.id || "",
        branchId: editingProduct.branch?.id || "",
        barcode: newMedicine.barcode || "",
        requiresPrescription: newMedicine.requiresPrescription, // Use form value
        isActive: editingProduct.isActive !== undefined ? editingProduct.isActive : true,
        minStock: 1,
        maxStock: 1000,
        unitsPerPack: 1
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
            limit: 10000,
            branchId: (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') ? (selectedBranchId || user?.branchId || "") : (user?.branchId || "default-branch")
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
          formula: "",
          barcode: "",
          requiresPrescription: false
        });

        setIsEditDialogOpen(false);
        toast({
          title: "Success",
          description: "Product updated successfully!",
          variant: "default",
        });
      } else {
        console.error('Failed to update product:', response.message);
        console.error('Validation errors:', response.errors);
        toast({
          title: "Update Failed",
          description: `Failed to update product: ${response.message}. Errors: ${response.errors?.join(', ') || 'Unknown error'}`,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error updating product:', error);
      console.error('Error details:', error.response?.data);
      toast({
        title: "Update Error",
        description: `Failed to update product: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (product: Product) => {
    // Check if admin has selected a branch
    if ((user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && !selectedBranchId) {
      toast({
        title: "Branch Selection Required",
        description: "Please select a branch before deleting a product!",
        variant: "destructive",
      });
      return;
    }

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
            limit: 10000,
            branchId: (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') ? (selectedBranchId || user?.branchId || "") : (user?.branchId || "default-branch")
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
        toast({
          title: "Success",
          description: "Product deleted successfully!",
          variant: "default",
        });
      } else {
        toast({
          title: "Delete Failed",
          description: response.message || "Failed to delete product",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: "Delete Error",
        description: "Failed to delete product. Please try again.",
        variant: "destructive",
      });
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

    // Check if admin has selected a branch
    if ((user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && !selectedBranchId) {
      toast({
        title: "Branch Selection Required",
        description: "Please select a branch before deleting products!",
        variant: "destructive",
      });
      return;
    }

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
        toast({
          title: "Success",
          description: `Successfully deleted ${response.data.data.deletedCount} products!`,
          variant: "default",
        });
      } else {
        toast({
          title: "Bulk Delete Failed",
          description: response.message || "Failed to bulk delete products",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error bulk deleting products:', error);
      toast({
        title: "Bulk Delete Error",
        description: "Failed to bulk delete products. Please try again.",
        variant: "destructive",
      });
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
        'Category': product.category?.name || 'Uncategorized',
        'Supplier': product.supplier?.name || 'Unknown',
        'Formula': product.formula || '',
        'Price': `PKR ${product.price || 0}`,
        'Stock': `${product.stock || 0} units`,
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

      toast({
        title: "Export Successful",
        description: "Inventory exported successfully!",
        variant: "default",
      });
    } catch (error) {
      console.error('Error exporting inventory:', error);
      toast({
        title: "Export Error",
        description: "Error exporting inventory. Please try again.",
        variant: "destructive",
      });
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
      toast({
        title: "Invalid File Type",
        description: "Please select an Excel (.xlsx, .xls) or CSV file.",
        variant: "destructive",
      });
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
              // Skip unit type - not used anymore
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
        toast({
          title: "Excel Not Supported",
          description: "Excel files are not fully supported yet. Please save your Excel file as CSV format and try again.",
          variant: "destructive",
        });
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
        toast({
          title: "No Valid Products",
          description: "No valid products found in the file. Please ensure your CSV has product names and selling prices.",
          variant: "destructive",
        });
        return;
      }

      // Show a toast with the count
      toast({
        title: "File Parsed Successfully",
        description: `Found ${validProducts.length} valid products out of ${extractedData.length} total rows.`,
        variant: "default",
      });

      setImportedProducts(validProducts);
      setIsPreviewDialogOpen(true);
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "File Processing Error",
        description: "Error processing file. Please try again or convert Excel to CSV format.",
        variant: "destructive",
      });
    } finally {
      setProcessingImage(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please select an image file.",
        variant: "destructive",
      });
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
        },
        {
          name: 'Amoxicillin 250mg',
          category: 'Antibiotics',
          costPrice: 15.00,
          sellingPrice: 25.00,
          stock: 50,
        },
        {
          name: 'Vitamin C 1000mg',
          category: 'Vitamins',
          costPrice: 8.00,
          sellingPrice: 12.00,
          stock: 75,
        }
      ];

      setImportedProducts(mockExtractedData);
      setIsPreviewDialogOpen(true);
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Image Processing Error",
        description: "Error processing image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingImage(false);
    }
  };

  const handleProceedImport = async () => {
    // Check if admin has selected a branch
    if ((user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') && !selectedBranchId) {
      toast({
        title: "Branch Selection Required",
        description: "Please select a branch before importing products!",
        variant: "destructive",
      });
      return;
    }

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
      let branchId = (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN')
        ? (selectedBranchId || user?.branchId || "")
        : (user?.branchId || "default-branch");

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

        // Supplier is assigned at batch level, not product level

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
          // supplierId not needed - supplier is assigned at batch level
          branchId: branchId,
          costPrice: costPrice,
          sellingPrice: sellingPrice,
          stock: stock,
          minStock: minStock,
          maxStock: productData.maxStock || null,
          unitType: "tablets", // Default unit type
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
        toast({
          title: "No Valid Products",
          description: "No valid products to import. Please check that your CSV file has the correct format with product names, categories, and prices.",
          variant: "destructive",
        });
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
            limit: 10000,
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
                limit: 10000
              });
              console.log('All products response (no filter):', allProductsResponseNoFilter);

              if (allProductsResponseNoFilter.success && allProductsResponseNoFilter.data) {
                const allProductsNoFilter = allProductsResponseNoFilter.data.products;
                console.log('Total products (no filter):', allProductsNoFilter.length);
                console.log('All products data (no filter):', allProductsNoFilter);

                // Filter products by branchId manually
                const branchFilteredProducts = allProductsNoFilter.filter(product =>
                  product.branch?.id === branchId
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
        toast({
          title: "Import Failed",
          description: response.message || 'Failed to import products. Please try again.',
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error importing products:', error);
      toast({
        title: "Import Error",
        description: "Error importing products. Please try again.",
        variant: "destructive",
      });
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
          <p className="text-muted-foreground text-sm mt-[5px]">Manage your business inventory</p>
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
              <Button variant="outline" className="text-white hover:text-blue-600 bg-blue-600 border-blue-600 hover:bg-blue-50 shadow-md hover:shadow-lg transition-all duration-200">
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

              <CategoryForm
                onSubmit={handleCreateCategory}
                onCancel={() => setIsCreateCategoryDialogOpen(false)}
                isSubmitting={loading}
                submitButtonText="Create Category"
              />
            </DialogContent>
          </Dialog>

          {/* Add Medicine Dialog */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="text-white bg-blue-600 hover:bg-blue-700 border-blue-600 shadow-md hover:shadow-lg transition-all duration-200"
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
                    <div className="flex gap-2">
                      <Select value={newMedicine.categoryId} onValueChange={(value) => setNewMedicine({...newMedicine, categoryId: value})}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem
                              key={category.id}
                              value={category.id}
                              className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                            >
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCreateCategoryDialogOpen(true)}
                        className="px-3"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add New
                      </Button>
                    </div>
                  </div>


                </div>

                {/* Product Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Product Details</h3>

                  <div className="space-y-2">
                    <Label htmlFor="formula">Formula/Composition</Label>
                    <Textarea
                      id="formula"
                      placeholder="Enter product formula or composition (e.g., Paracetamol 500mg, Lactose, Starch)"
                      value={newMedicine.formula}
                      onChange={(e) => setNewMedicine({...newMedicine, formula: e.target.value})}
                      rows={3}
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

                  {/* Prescription Required Checkbox */}
                  <div className="flex items-center space-x-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="requiresPrescription"
                      checked={newMedicine.requiresPrescription}
                      onChange={(e) => setNewMedicine({...newMedicine, requiresPrescription: e.target.checked})}
                      className="w-5 h-5 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                    />
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <Label htmlFor="requiresPrescription" className="text-amber-800 font-medium cursor-pointer">
                        Requires Doctor's Prescription
                      </Label>
                    </div>
                  </div>

                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-6">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="text-white bg-blue-600 hover:bg-blue-700 border-blue-600 shadow-md hover:shadow-lg transition-all duration-200" onClick={handleAddMedicine} disabled={loading}>
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
                          <SelectItem
                            key={category.id}
                            value={category.id}
                            className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                          >
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                {/* Product Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground border-b pb-2">Product Details</h3>

                  <div className="space-y-2">
                    <Label htmlFor="edit-formula">Formula/Composition</Label>
                    <Textarea
                      id="edit-formula"
                      placeholder="Enter product formula or composition (e.g., Paracetamol 500mg, Lactose, Starch)"
                      value={newMedicine.formula}
                      onChange={(e) => setNewMedicine({...newMedicine, formula: e.target.value})}
                      rows={3}
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

                  {/* Prescription Required Checkbox */}
                  <div className="flex items-center space-x-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <input
                      type="checkbox"
                      id="edit-requiresPrescription"
                      checked={newMedicine.requiresPrescription}
                      onChange={(e) => setNewMedicine({...newMedicine, requiresPrescription: e.target.checked})}
                      className="w-5 h-5 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                    />
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      <Label htmlFor="edit-requiresPrescription" className="text-amber-800 font-medium cursor-pointer">
                        Requires Doctor's Prescription
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-6">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="text-white bg-blue-600 hover:bg-blue-700 border-blue-600 shadow-md hover:shadow-lg transition-all duration-200" onClick={handleUpdateProduct} disabled={loading}>
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

      {/* All Filters in One Line */}
      <Card className="shadow-soft border-0">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* View Categories Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCategoryManagementOpen(true)}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              <FolderOpen className="w-4 h-4" />
              View Categories
            </Button>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category-filter" className="w-[150px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Product Type Filter */}
            <Select value={selectedProductType} onValueChange={setSelectedProductType}>
              <SelectTrigger id="type-filter" className="w-[140px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="MEDICAL">Medical</SelectItem>
                <SelectItem value="NON_MEDICAL">Non-Medical</SelectItem>
                <SelectItem value="GENERAL">General</SelectItem>
              </SelectContent>
            </Select>

            {/* Manufacturer Filter */}
            <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
              <SelectTrigger id="manufacturer-filter" className="w-[160px]">
                <SelectValue placeholder="All Manufacturers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Manufacturers</SelectItem>
                {getUniqueManufacturers().map((manufacturer) => (
                  <SelectItem key={manufacturer.id} value={manufacturer.id}>
                    {manufacturer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Supplier Filter */}
            <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
              <SelectTrigger id="supplier-filter" className="w-[150px]">
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {getUniqueSuppliers().length > 0 ? (
                  getUniqueSuppliers().map((supplier) => (
                    <SelectItem key={supplier} value={supplier}>
                      {supplier}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="no-suppliers" disabled>
                    No suppliers available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Stock Filter Checkboxes */}
            <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 rounded-lg border">
              <span className="text-sm font-medium text-muted-foreground">Stock:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showNoStock}
                  onChange={(e) => setShowNoStock(e.target.checked)}
                  className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                />
                <span className="text-sm text-gray-700">No Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOutOfStock}
                  onChange={(e) => setShowOutOfStock(e.target.checked)}
                  className="w-4 h-4 text-red-600 border-red-300 rounded focus:ring-red-500"
                />
                <span className="text-sm text-red-700">Out of Stock</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLowStock}
                  onChange={(e) => setShowLowStock(e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                />
                <span className="text-sm text-amber-700">Low Stock</span>
              </label>
            </div>

            {/* Clear Filters Button */}
            {(selectedCategory !== "all" || selectedProductType !== "all" || selectedManufacturer !== "all" || selectedSupplier !== "all" || showNoStock || showOutOfStock || showLowStock) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedCategory("all");
                  setSelectedProductType("all");
                  setSelectedManufacturer("all");
                  setSelectedSupplier("all");
                  setShowNoStock(false);
                  setShowOutOfStock(false);
                  setShowLowStock(false);
                }}
                className="flex items-center gap-2 h-8 w-8 p-0"
                title="Clear Filters"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
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
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Supplier</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Manufacturer</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Formula</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Price</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Total Qty</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Remaining</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-muted-foreground">
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
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground">{product.name}</p>
                                {product.requiresPrescription && (
                                  <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    Rx
                                  </Badge>
                                )}
                              </div>
                              {product.barcode && (
                                <p className="text-sm text-muted-foreground flex items-center">
                                  <Barcode className="w-3 h-3 mr-1" />
                                  {product.barcode}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <Badge variant="outline">{product.category?.name || 'Uncategorized'}</Badge>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">
                              {(() => {
                                // Get supplier from first batch with supplier info
                                const batchWithSupplier = product.batches?.find(b => b.supplier || b.supplierName);
                                const supplierName = batchWithSupplier?.supplier?.name || batchWithSupplier?.supplierName;
                                return supplierName ? (
                                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                                    {supplierName}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">
                              {(() => {
                                // Get manufacturer from first batch's supplier
                                const batchWithManufacturer = product.batches?.find(b => b.supplier?.manufacturer);
                                const manufacturerName = batchWithManufacturer?.supplier?.manufacturer?.name;
                                return manufacturerName ? (
                                  <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
                                    {manufacturerName}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">
                              <p className="text-muted-foreground">{product.formula || 'No formula provided'}</p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">
                              <p className="font-medium text-green-600">
                                PKR {product.price || 0}
                              </p>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">
                              {(() => {
                                // Calculate ORIGINAL total quantity from all batches (totalBoxes × unitsPerBox)
                                const totalQty = product.batches?.reduce((sum, batch) => {
                                  const originalQty = (batch.totalBoxes || 0) * (batch.unitsPerBox || 1);
                                  return sum + originalQty;
                                }, 0) || 0;
                                return (
                                  <p className="font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">
                                    {totalQty} units
                                  </p>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="text-sm">
                              {(() => {
                                const remaining = product.stock || 0;
                                const minStock = product.minStock || 10;
                                let colorClass = 'text-green-600'; // Good stock
                                let bgClass = 'bg-green-50';

                                if (remaining === 0) {
                                  colorClass = 'text-red-600';
                                  bgClass = 'bg-red-50';
                                } else if (remaining <= minStock) {
                                  colorClass = 'text-amber-600';
                                  bgClass = 'bg-amber-50';
                                }

                                return (
                                  <span className={`font-medium ${colorClass} ${bgClass} px-2 py-1 rounded`}>
                                    {remaining} units
                                  </span>
                                );
                              })()}
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
                        <th className="text-left py-3 px-4 font-medium text-gray-700">Formula</th>
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
                            <Input
                              placeholder="Enter formula/composition"
                              value={product.formula || ''}
                              onChange={(e) => {
                                const updated = [...importedProducts];
                                updated[index].formula = e.target.value;
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