import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { SearchableSelect } from '../components/ui/searchable-select';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import { useToast } from '../hooks/use-toast';
import { apiService } from '../services/api';
import { Search, Plus, Edit, Trash2, Package, Calendar, AlertTriangle, Filter, Download, RotateCcw, Eye } from 'lucide-react';
import { format } from 'date-fns';

// Safe date helpers to avoid RangeError from date-fns/format when date is invalid
const safeFormatDate = (dateLike: string | Date | number | undefined | null, pattern: string, fallback: string = 'N/A') => {
  if (!dateLike) return fallback;

  let d: Date;
  if (dateLike instanceof Date) {
    d = dateLike;
  } else if (typeof dateLike === 'number') {
    d = new Date(dateLike);
  } else if (typeof dateLike === 'string') {
    d = new Date(dateLike);
  } else {
    return fallback;
  }

  // Check if date is valid
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return fallback;
  }

  try {
    return format(d, pattern);
  } catch (error) {
    console.warn('Error formatting date:', dateLike, error);
    return fallback;
  }
};

const safeFormatDateForInput = (dateLike: string | Date | number | undefined | null) => {
  // For input[type=date] values: return "" if invalid
  if (!dateLike) return '';

  let d: Date;
  if (dateLike instanceof Date) {
    d = dateLike;
  } else if (typeof dateLike === 'number') {
    d = new Date(dateLike);
  } else if (typeof dateLike === 'string') {
    d = new Date(dateLike);
  } else {
    return '';
  }

  // Check if date is valid
  if (!(d instanceof Date) || isNaN(d.getTime())) {
    return '';
  }

  try {
    return format(d, 'yyyy-MM-dd');
  } catch (error) {
    console.warn('Error formatting date for input:', dateLike, error);
    return '';
  }
};

interface Batch {
  id: string;
  batchNo: string;
  productId: string;
  supplierId?: string;
  supplierName?: string;
  supplierOutstanding: number;
  supplierInvoiceNo?: string;
  expireDate?: string;
  productionDate?: string;
  shelfId?: string;
  shelfName?: string;
  isActive: boolean;
  isReported: boolean;
  createdAt: string;
  updatedAt: string;
  // Stock and pricing fields from database
  quantity?: number; // Current stock quantity (main field from database)
  totalStock?: number; // Mapped from quantity for display
  stockQuantity?: number; // Mapped from quantity for display
  totalBoxes?: number;
  unitsPerBox?: number;
  costPrice?: number; // Mapped from purchasePrice
  sellingPrice?: number;
  purchasePrice?: number; // Original database field
  costPricePerUnit?: number;
  costPricePerBox?: number;
  sellingPricePerUnit?: number;
  sellingPricePerBox?: number;
  stockPurchasePrice?: number;
  paidAmount?: number;
  purchasingMethod?: string;
  minStockLevel?: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  supplier?: {
    id: string;
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
  sku?: string;
}

interface Supplier {
  id: string;
  name: string;
  manufacturerId?: string;
  manufacturer?: {
    id: string;
    name: string;
  };
}

interface Manufacturer {
  id: string;
  name: string;
}

interface Shelf {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    products: number;
  };
}

const Batches = () => {
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [restockingBatch, setRestockingBatch] = useState<Batch | null>(null);
  const [viewingBatch, setViewingBatch] = useState<Batch | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<Batch | null>(null);
  const [nearExpiryBatches, setNearExpiryBatches] = useState<Batch[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedManufacturerFilter, setSelectedManufacturerFilter] = useState<string>('all');
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');

  // Dialog states for Add New buttons
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isShelfDialogOpen, setIsShelfDialogOpen] = useState(false);

  // Restock form state
  const [restockData, setRestockData] = useState({
    quantity: 0,
    notes: '',
  });

  // Form state
  const [formData, setFormData] = useState({
    batchNo: '',
    productId: '',
    supplierId: '',
    supplierName: '',
    expireDate: '',
    productionDate: '',
    shelfId: '',
    shelfName: '',
    // New pricing and stock fields
    costPricePerUnit: 0,
    costPricePerBox: 0,
    sellingPricePerUnit: 0,
    sellingPricePerBox: 0,
    stockQuantity: 0,
    totalBoxes: 0, // Add totalBoxes field
    unitsPerBox: 1,
    minStockLevel: 10,
  });

  // Load data
  const loadBatches = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔍 Loading batches with params:', {
        page: 1,
        limit: 100,
        search: searchTerm,
        isActive: activeTab === 'active',
        isReported: activeTab === 'reported',
      });
      console.log('🔍 Current state values:', {
        searchTerm,
        activeTab,
        isActive: activeTab === 'active',
        isReported: activeTab === 'reported'
      });
      console.log('🔍 Making API call to getBatches...');
      const response = await apiService.getBatches({
        page: 1,
        limit: 100,
        search: searchTerm,
        isActive: activeTab === 'active',
        isReported: activeTab === 'reported',
      });
      console.log('🔍 Batches API response:', response);
      console.log('🔍 Response success:', response.success);
      console.log('🔍 Response data:', response.data);

      if (response.success) {
        console.log('🔍 Raw batches from API:', response.data.batches);
        // Debug: Log first batch's expireDate to see what format it's in
        if (response.data.batches.length > 0) {
          console.log('🔍 First batch expireDate raw:', response.data.batches[0].expireDate);
          console.log('🔍 First batch expireDate type:', typeof response.data.batches[0].expireDate);
          console.log('🔍 First batch all date fields:', {
            expireDate: response.data.batches[0].expireDate,
            expiryDate: (response.data.batches[0] as any).expiryDate,
            expirationDate: (response.data.batches[0] as any).expirationDate,
            productionDate: response.data.batches[0].productionDate,
          });
        }
        const mappedBatches = response.data.batches.map((batch: any) => {
          // Try multiple possible field names for expiry date (some databases might use different names)
          const expireDateValue = batch.expireDate || (batch as any).expiryDate || (batch as any).expirationDate;
          const productionDateValue = batch.productionDate || (batch as any).production;

          return {
            id: batch.id,
            batchNo: batch.batchNo,
            productId: batch.productId,
            supplierId: batch.supplierId,
            supplierName: batch.supplierName,
            supplierOutstanding: batch.supplierOutstanding || 0,
            supplierInvoiceNo: batch.supplierInvoiceNo,
            expireDate: expireDateValue ? (typeof expireDateValue === 'string' ? expireDateValue : expireDateValue.toISOString?.() || expireDateValue) : null,
            productionDate: productionDateValue ? (typeof productionDateValue === 'string' ? productionDateValue : productionDateValue.toISOString?.() || productionDateValue) : null,
            shelfId: batch.shelfId,
          shelfName: batch.shelfName,
          isActive: batch.isActive,
          isReported: batch.isReported,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
          // Stock and pricing fields - using correct database field names
          quantity: batch.quantity || 0,
          totalStock: batch.quantity || 0, // Map quantity to totalStock for display
          stockQuantity: batch.quantity || 0, // Map quantity to stockQuantity for display
          totalBoxes: batch.totalBoxes || 0,
          unitsPerBox: batch.unitsPerBox || 0,
          costPrice: batch.purchasePrice || 0, // Map purchasePrice to costPrice
          sellingPrice: batch.sellingPrice || 0,
          purchasePrice: batch.purchasePrice || 0, // Keep original field name too
          costPricePerUnit: batch.costPricePerUnit || 0,
          costPricePerBox: batch.costPricePerBox || 0,
          sellingPricePerUnit: batch.sellingPricePerUnit || 0,
          sellingPricePerBox: batch.sellingPricePerBox || 0,
          stockPurchasePrice: batch.stockPurchasePrice || 0,
          paidAmount: batch.paidAmount || 0,
          purchasingMethod: batch.purchasingMethod,
          minStockLevel: batch.minStockLevel || 0,
          product: {
            id: batch.product.id,
            name: batch.product.name,
            sku: batch.product.sku || ''
          },
          supplier: batch.supplier ? {
            id: batch.supplier.id,
            name: batch.supplier.name
          } : undefined
          };
        });

        // Debug: Log first mapped batch's expireDate
        if (mappedBatches.length > 0) {
          console.log('🔍 First mapped batch expireDate:', mappedBatches[0].expireDate);
          console.log('🔍 First mapped batch expireDate formatted:', safeFormatDate(mappedBatches[0].expireDate, 'MMM dd, yyyy'));
        }

        console.log('🔍 Mapped batches:', mappedBatches);
        setBatches(mappedBatches);
      }
    } catch (error) {
      console.error('Error loading batches:', error);
      toast({
        title: "Error",
        description: "Failed to load batches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, activeTab, toast]);

  const loadProducts = useCallback(async () => {
    try {
      const response = await apiService.getProducts({ page: 1, limit: 1000 });
      if (response.success) {
        setProducts(response.data.products.map((product: any) => ({
          id: product.id,
          name: product.name,
          sku: product.sku || '',
        })));
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    try {
      const response = await apiService.getSuppliers({ page: 1, limit: 1000 });
      if (response.success) {
        setSuppliers(response.data.suppliers.map((supplier: any) => ({
          id: supplier.id,
          name: supplier.name,
          manufacturerId: supplier.manufacturerId,
          manufacturer: supplier.manufacturer ? {
            id: supplier.manufacturer.id,
            name: supplier.manufacturer.name
          } : undefined
        })));
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  }, []);

  const loadManufacturers = useCallback(async () => {
    try {
      const response = await apiService.getManufacturers({ page: 1, limit: 1000, active: true });
      if (response.success) {
        setManufacturers(response.data.manufacturers || []);
      }
    } catch (error) {
      console.error('Error loading manufacturers:', error);
    }
  }, []);

  const loadShelves = useCallback(async () => {
    try {
      const response = await apiService.getShelves({ page: 1, limit: 1000, active: true });
      if (response.success) {
        setShelves(response.data.shelves);
      }
    } catch (error) {
      console.error('Error loading shelves:', error);
    }
  }, []);

  const loadNearExpiryBatches = useCallback(async () => {
    try {
      const response = await apiService.getNearExpiryBatches(30);
      if (response.success) {
        setNearExpiryBatches(response.data.map((batch: any) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          productId: batch.productId,
          supplierId: batch.supplierId,
          supplierName: batch.supplierName,
          supplierOutstanding: batch.supplierOutstanding || 0,
          supplierInvoiceNo: batch.supplierInvoiceNo,
          expireDate: batch.expireDate,
          productionDate: batch.productionDate,
          shelfId: batch.shelfId,
          shelfName: batch.shelfName,
          isActive: batch.isActive,
          isReported: batch.isReported,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
          product: {
            id: batch.product.id,
            name: batch.product.name,
            sku: batch.product.sku || ''
          },
          supplier: batch.supplier ? {
            id: batch.supplier.id,
            name: batch.supplier.name
          } : undefined
        })));
      }
    } catch (error) {
      console.error('Error loading near expiry batches:', error);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showFilterDropdown) {
        const target = event.target as Element;
        if (!target.closest('.relative')) {
          setShowFilterDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFilterDropdown]);

  useEffect(() => {
    loadProducts();
    loadSuppliers();
    loadManufacturers();
    loadShelves();
    loadNearExpiryBatches();
  }, [loadProducts, loadSuppliers, loadManufacturers, loadShelves, loadNearExpiryBatches]);

  // Handle form submission
  const handleSubmit = async () => {
    // Validation
    if (!formData.batchNo.trim()) {
      toast({
        title: "❌ Batch Number Required",
        description: "Please enter a batch number to continue",
        variant: "destructive",
      });
      return;
    }

    if (!formData.productId) {
      toast({
        title: "❌ Product Selection Required",
        description: "Please select a product from the dropdown",
        variant: "destructive",
      });
      return;
    }

    if (!formData.supplierId) {
      toast({
        title: "❌ Supplier Selection Required",
        description: "Please select a supplier from the dropdown",
        variant: "destructive",
      });
      return;
    }


    if (!formData.expireDate) {
      toast({
        title: "❌ Expiry Date Required",
        description: "Please select an expiry date for the batch",
        variant: "destructive",
      });
      return;
    }

    if (!formData.productionDate) {
      toast({
        title: "❌ Production Date Required",
        description: "Please select a production date for the batch",
        variant: "destructive",
      });
      return;
    }

    if (!formData.shelfId) {
      toast({
        title: "❌ Shelf Selection Required",
        description: "Please select a shelf for the batch",
        variant: "destructive",
      });
      return;
    }

    if (!formData.shelfName || formData.shelfName.trim() === '') {
      toast({
        title: "❌ Shelf Name Required",
        description: "Please enter a shelf name for the batch",
        variant: "destructive",
      });
      return;
    }

    // Validate new pricing and stock fields
    if (!formData.costPricePerUnit || formData.costPricePerUnit <= 0) {
      toast({
        title: "❌ Cost Price Required",
        description: "Please enter a valid cost price per unit",
        variant: "destructive",
      });
      return;
    }

    if (!formData.sellingPricePerUnit || formData.sellingPricePerUnit <= 0) {
      toast({
        title: "❌ Selling Price Required",
        description: "Please enter a valid selling price per unit",
        variant: "destructive",
      });
      return;
    }

    if (!formData.stockQuantity || formData.stockQuantity <= 0) {
      toast({
        title: "❌ Stock Quantity Required",
        description: "Please enter a valid stock quantity",
        variant: "destructive",
      });
      return;
    }

    if (!formData.totalBoxes || formData.totalBoxes < 0) {
      toast({
        title: "❌ Total Boxes Required",
        description: "Please enter a valid total boxes count",
        variant: "destructive",
      });
      return;
    }

    if (!formData.unitsPerBox || formData.unitsPerBox <= 0) {
      toast({
        title: "❌ Units per Box Required",
        description: "Please enter a valid units per box count",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Clean up form data - ensure required fields are provided
      // Map frontend field names to backend expected field names
      const cleanedFormData = {
        batchNo: formData.batchNo,
        productId: formData.productId,
        supplierId: formData.supplierId,
        supplierName: formData.supplierName || null,
        expireDate: formData.expireDate,
        productionDate: formData.productionDate, // Required field - don't set to null
        shelfId: formData.shelfId, // Required field - don't set to null
        shelfName: formData.shelfName.trim(), // Required field - don't set to null
        // Map pricing and stock fields to backend expected names
        purchasePrice: formData.costPricePerUnit,
        sellingPrice: formData.sellingPricePerUnit,
        quantity: formData.stockQuantity,
        totalBoxes: formData.totalBoxes || 0, // Required field
        unitsPerBox: formData.unitsPerBox || 1, // Required field
        // Only include isActive and isReported for updates, not for creation
        ...(editingBatch && {
          isActive: true, // Default to active for updates
          isReported: false, // Default to not reported for updates
        }),
      };

      if (editingBatch) {
        console.log('🔍 Updating batch with data:', cleanedFormData);
        const response = await apiService.updateBatch(editingBatch.id, cleanedFormData);
        if (response.success) {
          toast({
            title: "✅ Batch Updated Successfully",
            description: `Batch "${formData.batchNo}" has been updated`,
          });
          setEditingBatch(null);
          loadBatches();
        } else {
          // Handle backend validation errors
          if (response.errors && response.errors.length > 0) {
            response.errors.forEach((error: string) => {
              toast({
                title: "❌ Validation Error",
                description: error,
                variant: "destructive",
              });
            });
          } else {
            toast({
              title: "❌ Update Failed",
              description: response.message || "Failed to update batch",
              variant: "destructive",
            });
          }
        }
      } else {
        const response = await apiService.createBatch(cleanedFormData);
        if (response.success) {
          toast({
            title: "✅ Batch Created Successfully",
            description: `New batch "${formData.batchNo}" has been added`,
          });
          setShowAddModal(false);
          loadBatches();
        } else {
          // Handle backend validation errors
          if (response.errors && response.errors.length > 0) {
            response.errors.forEach((error: string) => {
              toast({
                title: "❌ Validation Error",
                description: error,
                variant: "destructive",
              });
            });
          } else {
            toast({
              title: "❌ Creation Failed",
              description: response.message || "Failed to create batch",
              variant: "destructive",
            });
          }
        }
      }
      resetForm();
    } catch (error: any) {
      console.error('Error saving batch:', error);
      console.log('Error details:', {
        message: error.message,
        errors: error.errors,
        response: error.response
      });

      // Handle backend validation errors
      if (error.errors && error.errors.length > 0) {
        error.errors.forEach((err: string) => {
          toast({
            title: "❌ Validation Error",
            description: err,
            variant: "destructive",
          });
        });
      } else if (error.response && error.response.errors && error.response.errors.length > 0) {
        error.response.errors.forEach((err: string) => {
          toast({
            title: "❌ Validation Error",
            description: err,
            variant: "destructive",
          });
        });
      } else {
        toast({
          title: "❌ Failed to Save Batch",
          description: error.message || "An error occurred while saving the batch. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      batchNo: '',
      productId: '',
      supplierId: '',
      supplierName: '',
      expireDate: '',
      productionDate: '',
      shelfId: '',
      shelfName: '',
      // New pricing and stock fields
      costPricePerUnit: 0,
      costPricePerBox: 0,
      sellingPricePerUnit: 0,
      sellingPricePerBox: 0,
      stockQuantity: 0,
      totalBoxes: 0,
      unitsPerBox: 1,
      minStockLevel: 10,
    });
  };

  const handleEdit = (batch: Batch) => {
    setEditingBatch(batch);

    // Calculate unit prices
    const costPricePerUnit = batch.costPricePerUnit || batch.purchasePrice || 0;
    const sellingPricePerUnit = batch.sellingPricePerUnit || batch.sellingPrice || 0;
    const unitsPerBox = batch.unitsPerBox || 1;

    // Calculate box prices from unit prices
    const costPricePerBox = batch.costPricePerBox || (costPricePerUnit * unitsPerBox);
    const sellingPricePerBox = batch.sellingPricePerBox || (sellingPricePerUnit * unitsPerBox);

    setFormData({
      batchNo: batch.batchNo,
      productId: batch.productId,
      supplierId: batch.supplierId || '',
      supplierName: batch.supplierName || '',
      expireDate: safeFormatDateForInput(batch.expireDate),
      productionDate: safeFormatDateForInput(batch.productionDate),
      shelfId: batch.shelfId || '',
      shelfName: batch.shelfName || '',
      // Use actual batch data for pricing and stock fields
      costPricePerUnit: costPricePerUnit,
      costPricePerBox: costPricePerBox,
      sellingPricePerUnit: sellingPricePerUnit,
      sellingPricePerBox: sellingPricePerBox,
      stockQuantity: batch.quantity || batch.totalStock || batch.stockQuantity || 0,
      totalBoxes: batch.totalBoxes || 0,
      unitsPerBox: unitsPerBox,
      minStockLevel: batch.minStockLevel || 10,
    });
  };


  const handleDeleteClick = (batch: Batch) => {
    setDeletingBatch(batch);
  };

  const handleConfirmDelete = async () => {
    if (!deletingBatch) return;

    try {
      setIsDeleting(deletingBatch.id);
      const response = await apiService.deleteBatch(deletingBatch.id);
      if (response.success) {
        toast({
          title: "✅ Batch Deleted Successfully",
          description: `Batch "${deletingBatch.batchNo}" has been removed from the system`,
        });
        loadBatches();
        setDeletingBatch(null);
      }
    } catch (error) {
      console.error('Error deleting batch:', error);
      toast({
        title: "❌ Failed to Delete Batch",
        description: "An error occurred while deleting the batch. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleViewBatch = (batch: Batch) => {
    setViewingBatch(batch);
  };

  // Download batch history as CSV
  const handleDownloadBatchHistory = () => {
    try {
      // Prepare CSV data
      const csvHeaders = [
        'Batch No',
        'Product Name',
        'Product SKU',
        'Supplier',
        'Stock Quantity',
        'Cost Price',
        'Selling Price',
        'Production Date',
        'Expiry Date',
        'Shelf',
        'Status',
        'Created At'
      ];

      const csvData = batches.map(batch => [
        batch.batchNo,
        batch.product?.name || 'N/A',
        batch.product?.sku || 'N/A',
        batch.supplier?.name || 'N/A',
        batch.quantity || 0,
        batch.purchasePrice || 0,
        batch.sellingPrice || 0,
        safeFormatDate(batch.productionDate, 'yyyy-MM-dd'),
        safeFormatDate(batch.expireDate, 'yyyy-MM-dd'),
        batch.shelfName || 'N/A',
        batch.isActive ? 'Active' : 'Inactive',
        safeFormatDate(batch.createdAt, 'yyyy-MM-dd HH:mm:ss')
      ]);

      // Create CSV content
      const csvContent = [
        csvHeaders.join(','),
        ...csvData.map(row => row.map(field => `"${field}"`).join(','))
      ].join('\n');

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `batch_history_${safeFormatDate(new Date(), 'yyyy-MM-dd_HH-mm-ss', 'now')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "✅ Download Successful",
        description: `Batch history has been downloaded successfully`,
      });
    } catch (error) {
      console.error('Error downloading batch history:', error);
      toast({
        title: "❌ Download Failed",
        description: "An error occurred while downloading the batch history",
        variant: "destructive",
      });
    }
  };

  const handleRestock = (batch: Batch) => {
    setRestockingBatch(batch);
    setRestockData({
      quantity: 0,
      notes: '',
    });
  };

  // Filter batches based on selected filter type
  const getFilteredBatches = () => {
    let filteredBatches = batches;

    // Apply search filter
    if (searchTerm) {
      filteredBatches = filteredBatches.filter(batch =>
        batch.batchNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.product?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        batch.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    switch (filterType) {
      case 'near-expiry':
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        filteredBatches = filteredBatches.filter(batch => {
          if (!batch.expireDate) return false;
          const expiryDate = new Date(batch.expireDate);
          if (isNaN(expiryDate.getTime())) return false;
          return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
        });
        break;
      case 'expired':
        filteredBatches = filteredBatches.filter(batch => {
          if (!batch.expireDate) return false;
          const expiryDate = new Date(batch.expireDate);
          if (isNaN(expiryDate.getTime())) return false;
          return expiryDate < new Date();
        });
        break;
      case 'low-stock':
        filteredBatches = filteredBatches.filter(batch => {
          const stock = batch.quantity || 0;
          const minStock = batch.minStockLevel || 10;
          // Include batch if:
          // 1. Stock is at or below the minStockLevel threshold, OR
          // 2. Stock is critically low (<= 20 units) as a safety check
          return stock <= minStock || stock <= 20;
        });
        break;
      case 'all':
      default:
        // No additional filtering
        break;
    }

    // Apply manufacturer filter
    if (selectedManufacturerFilter !== 'all') {
      filteredBatches = filteredBatches.filter(batch => {
        if (batch.supplierId) {
          const supplier = suppliers.find(s => s.id === batch.supplierId);
          if (supplier && supplier.manufacturerId) {
            return supplier.manufacturerId === selectedManufacturerFilter;
          }
        }
        return false;
      });
    }

    // Apply supplier filter
    if (selectedSupplierFilter !== 'all') {
      filteredBatches = filteredBatches.filter(batch =>
        batch.supplierId === selectedSupplierFilter
      );
    }

    return filteredBatches;
  };

  const handleFilterChange = (filter: string) => {
    setFilterType(filter);
    setShowFilterDropdown(false);
  };

  const handleRestockSubmit = async () => {
    if (!restockingBatch) return;

    if (restockData.quantity <= 0) {
      toast({
        title: "❌ Validation Error",
        description: "Please enter a valid quantity to restock",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // Call restock API - adding stock to existing batch
      const response = await apiService.restockBatch(restockingBatch.id, {
        quantity: restockData.quantity,
        notes: restockData.notes,
      });

      if (response.success) {
        toast({
          title: "✅ Restock Successful",
          description: `Added ${restockData.quantity} units to batch "${restockingBatch.batchNo}"`,
        });
        setRestockingBatch(null);
        setRestockData({ quantity: 0, notes: '' });
        loadBatches();
      } else {
        toast({
          title: "❌ Restock Failed",
          description: response.message || "Failed to restock batch",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error restocking batch:', error);
      toast({
        title: "❌ Restock Failed",
        description: "An error occurred while restocking the batch",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isNearExpiry = (expireDate: string | Date | number | undefined | null) => {
    if (!expireDate) return false;
    let expiry: Date;
    if (expireDate instanceof Date) {
      expiry = expireDate;
    } else if (typeof expireDate === 'number') {
      expiry = new Date(expireDate);
    } else if (typeof expireDate === 'string') {
      expiry = new Date(expireDate);
    } else {
      return false;
    }

    if (isNaN(expiry.getTime())) return false;

    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (expireDate: string | Date | number | undefined | null) => {
    if (!expireDate) return false;
    let expiry: Date;
    if (expireDate instanceof Date) {
      expiry = expireDate;
    } else if (typeof expireDate === 'number') {
      expiry = new Date(expireDate);
    } else if (typeof expireDate === 'string') {
      expiry = new Date(expireDate);
    } else {
      return false;
    }

    if (isNaN(expiry.getTime())) return false;

    const now = new Date();
    return expiry < now;
  };

  return (
    <div className="space-y-6 p-[20px]">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Batch Management</h1>
          <p className="text-muted-foreground">Manage product batches and inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadBatchHistory}>
            <Download className="w-4 h-4 mr-2" />
            Download Batch History
          </Button>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200">
                <Plus className="w-4 h-4 mr-2" />
                Add New Batch
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Batch</DialogTitle>
                <DialogDescription>
                  Enter the details for the new product batch
                </DialogDescription>
              </DialogHeader>
              <BatchForm
                formData={formData}
                setFormData={setFormData}
                products={products}
                suppliers={suppliers}
                shelves={shelves}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                editingBatch={editingBatch}
                isSubmitting={isSubmitting}
                setIsSupplierDialogOpen={setIsSupplierDialogOpen}
                setIsProductDialogOpen={setIsProductDialogOpen}
                setIsShelfDialogOpen={setIsShelfDialogOpen}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="active">Active Batches</TabsTrigger>
                  <TabsTrigger value="reported">Reported Batches</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search batches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={selectedSupplierFilter} onValueChange={setSelectedSupplierFilter}>
                <SelectTrigger className="w-48 bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100">
                  <SelectValue placeholder="Filter by Supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedManufacturerFilter} onValueChange={setSelectedManufacturerFilter}>
                <SelectTrigger className="w-48 bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100">
                  <SelectValue placeholder="Filter by Manufacturer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Manufacturers</SelectItem>
                  {manufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer.id} value={manufacturer.id}>
                      {manufacturer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100 focus:ring-indigo-500"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  All Batches
                </Button>
                {showFilterDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-indigo-50 border border-indigo-200 rounded-md shadow-lg z-10">
                    <div className="py-1">
                      <button
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-100 hover:text-indigo-900 transition-colors duration-150 ${
                          filterType === 'all' ? 'bg-indigo-100 text-indigo-900' : 'text-indigo-700'
                        }`}
                        onClick={() => handleFilterChange('all')}
                      >
                        All Batches
                      </button>
                      <button
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-100 hover:text-indigo-900 transition-colors duration-150 ${
                          filterType === 'near-expiry' ? 'bg-indigo-100 text-indigo-900' : 'text-indigo-700'
                        }`}
                        onClick={() => handleFilterChange('near-expiry')}
                      >
                        Near Expiry
                      </button>
                      <button
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-100 hover:text-indigo-900 transition-colors duration-150 ${
                          filterType === 'expired' ? 'bg-indigo-100 text-indigo-900' : 'text-indigo-700'
                        }`}
                        onClick={() => handleFilterChange('expired')}
                      >
                        Expired
                      </button>
                      <button
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-indigo-100 hover:text-indigo-900 transition-colors duration-150 ${
                          filterType === 'low-stock' ? 'bg-indigo-100 text-indigo-900' : 'text-indigo-700'
                        }`}
                        onClick={() => handleFilterChange('low-stock')}
                      >
                        Low Stock
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Near Expiry Warning */}
      {nearExpiryBatches.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">
                Near Expiry Medicines ({nearExpiryBatches.length})
              </span>
            </div>
            <p className="text-sm text-orange-700 mt-1">
              Some batches are expiring within 30 days. Please check and take necessary action.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Batch List</CardTitle>
          <CardDescription>
            Manage your product batches and track inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">Batch No.</th>
                    <th className="text-left p-4">Product</th>
                    <th className="text-left p-4">Supplier</th>
                    <th className="text-left p-4">Stock Quantity</th>
                    <th className="text-left p-4">Expire Date</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredBatches().map((batch) => (
                    <tr key={batch.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium">{batch.batchNo}</td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{batch.product.name}</div>
                          <div className="text-sm text-gray-500">{batch.product.sku}</div>
                        </div>
                      </td>
                      <td className="p-4">{batch.supplierName || 'N/A'}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-600" />
                          <div className="flex flex-col">
                            <span className={`font-medium text-lg ${
                              (batch.quantity || 0) <= 10
                                ? 'text-red-600'
                                : (batch.quantity || 0) <= 50
                                ? 'text-orange-600'
                                : 'text-green-600'
                            }`}>
                              {batch.quantity || 0}
                            </span>
                            <span className="text-xs text-gray-500">units</span>
                            {(batch.quantity || 0) <= 10 && (
                              <Badge className="bg-red-100 text-red-800 text-xs mt-1 w-fit">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {batch.expireDate ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {safeFormatDate(batch.expireDate, 'MMM dd, yyyy')}
                            {isExpired(batch.expireDate) && (
                              <Badge className="bg-red-500 text-white hover:bg-red-600">Expired</Badge>
                            )}
                            {isNearExpiry(batch.expireDate) && !isExpired(batch.expireDate) && (
                              <Badge className="bg-orange-500 text-white hover:bg-orange-600">Near Expiry</Badge>
                            )}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="p-4">
                        <Badge className={batch.isActive ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-500 text-white hover:bg-gray-600'}>
                          {batch.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewBatch(batch)}
                            className="text-green-600 hover:text-green-700"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestock(batch)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Restock"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteClick(batch)}
                            disabled={isDeleting === batch.id}
                            className="text-red-600 hover:text-red-700"
                            title="Delete"
                          >
                            {isDeleting === batch.id ? (
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

      {/* Edit Modal */}
      {editingBatch && (
        <Dialog open={!!editingBatch} onOpenChange={() => setEditingBatch(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Batch</DialogTitle>
              <DialogDescription>
                Update the batch information
              </DialogDescription>
            </DialogHeader>
            <BatchForm
              formData={formData}
              setFormData={setFormData}
              products={products}
              suppliers={suppliers}
              shelves={shelves}
              onSubmit={handleSubmit}
              onCancel={() => {
                setEditingBatch(null);
                resetForm();
              }}
              editingBatch={editingBatch}
              isSubmitting={isSubmitting}
              setIsSupplierDialogOpen={setIsSupplierDialogOpen}
              setIsProductDialogOpen={setIsProductDialogOpen}
              setIsShelfDialogOpen={setIsShelfDialogOpen}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Restock Modal */}
      {restockingBatch && (
        <Dialog open={!!restockingBatch} onOpenChange={() => setRestockingBatch(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Restock Batch</DialogTitle>
              <DialogDescription>
                Add more stock to batch "{restockingBatch.batchNo}"
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restockQuantity">Quantity to Add *</Label>
                <Input
                  id="restockQuantity"
                  type="number"
                  placeholder="Enter quantity to add"
                  value={restockData.quantity}
                  onChange={(e) => setRestockData({ ...restockData, quantity: parseInt(e.target.value) || 0 })}
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restockNotes">Notes (Optional)</Label>
                <Textarea
                  id="restockNotes"
                  placeholder="Add any notes about this restock..."
                  value={restockData.notes}
                  onChange={(e) => setRestockData({ ...restockData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setRestockingBatch(null)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRestockSubmit}
                  disabled={isSubmitting || restockData.quantity <= 0}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Restocking...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Restock
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Batch Details Modal */}
      {viewingBatch && (
        <Dialog open={!!viewingBatch} onOpenChange={() => setViewingBatch(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Batch Details - {viewingBatch.batchNo}</DialogTitle>
              <DialogDescription>
                Complete information for batch {viewingBatch.batchNo}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Product Information</Label>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{viewingBatch.product.name}</div>
                      <div className="text-sm text-gray-600">SKU: {viewingBatch.product.sku}</div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Supplier</Label>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{viewingBatch.supplierName || 'N/A'}</div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Batch Number</Label>
                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                      <div className="font-medium">{viewingBatch.batchNo}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Stock Information</Label>
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-600" />
                        <span className="text-2xl font-bold text-blue-600">
                          {viewingBatch.quantity || 0}
                        </span>
                        <span className="text-gray-600">units</span>
                      </div>
                      {(viewingBatch.quantity || 0) <= 10 && (
                        <Badge className="bg-red-100 text-red-800 text-xs mt-2">
                          Low Stock
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <div className="mt-2">
                      <Badge className={viewingBatch.isActive ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}>
                        {viewingBatch.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {viewingBatch.isReported && (
                        <Badge className="bg-orange-500 text-white ml-2">Reported</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Dates and Expiry */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Production Date</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    {viewingBatch.productionDate ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {safeFormatDate(viewingBatch.productionDate, 'MMM dd, yyyy')}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Expiry Date</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    {viewingBatch.expireDate ? (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {safeFormatDate(viewingBatch.expireDate, 'MMM dd, yyyy')}
                        {isExpired(viewingBatch.expireDate) && (
                          <Badge className="bg-red-500 text-white">Expired</Badge>
                        )}
                        {isNearExpiry(viewingBatch.expireDate) && !isExpired(viewingBatch.expireDate) && (
                          <Badge className="bg-orange-500 text-white">Near Expiry</Badge>
                        )}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </div>
              </div>

              {/* Pricing Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Cost Price</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">PKR {viewingBatch.purchasePrice || viewingBatch.costPrice || 0}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Selling Price</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">PKR {viewingBatch.sellingPrice || 0}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Total Boxes</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">{viewingBatch.totalBoxes || 0}</div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Shelf Location</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">{viewingBatch.shelfName || 'N/A'}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Purchasing Method</Label>
                  <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                    <div className="font-medium">{viewingBatch.purchasingMethod || 'N/A'}</div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setViewingBatch(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setViewingBatch(null);
                    handleEdit(viewingBatch);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Batch
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!deletingBatch}
        onClose={() => setDeletingBatch(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Batch"
        description="Are you sure you want to delete this batch? This action cannot be undone."
        confirmText="Delete Batch"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting === deletingBatch?.id}
        loadingText="Deleting..."
        itemName={deletingBatch ? `Batch: ${deletingBatch.batchNo}` : undefined}
        itemDetails="This will permanently remove the batch and all associated data."
        icon={<Trash2 className="w-4 h-4" />}
      />

      {/* Add New Supplier Dialog */}
      <Dialog open={isSupplierDialogOpen} onOpenChange={setIsSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
            <DialogDescription>
              Create a new supplier for your inventory
            </DialogDescription>
          </DialogHeader>
          <SupplierForm
            onSuccess={(supplier) => {
              setSuppliers([...suppliers, supplier]);
              setFormData({ ...formData, supplierId: supplier.id, supplierName: supplier.name });
              setIsSupplierDialogOpen(false);
            }}
            onCancel={() => setIsSupplierDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Add New Product Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
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
          <ProductForm
            onSuccess={(product) => {
              setProducts([...products, product]);
              setFormData({ ...formData, productId: product.id });
              setIsProductDialogOpen(false);
            }}
            onCancel={() => setIsProductDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Add New Shelf Dialog */}
      <Dialog open={isShelfDialogOpen} onOpenChange={setIsShelfDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Shelf</DialogTitle>
            <DialogDescription>
              Create a new shelf for your inventory
            </DialogDescription>
          </DialogHeader>
          <ShelfForm
            onSuccess={(shelf) => {
              setShelves([...shelves, shelf]);
              setFormData({ ...formData, shelfId: shelf.id, shelfName: shelf.name });
              setIsShelfDialogOpen(false);
            }}
            onCancel={() => setIsShelfDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

    </div>
  );
};

// Batch Form Component
interface BatchFormProps {
  formData: any;
  setFormData: (data: any) => void;
  products: Product[];
  suppliers: Supplier[];
  shelves: Shelf[];
  onSubmit: () => void;
  onCancel: () => void;
  editingBatch?: Batch | null;
  isSubmitting?: boolean;
  setIsSupplierDialogOpen: (open: boolean) => void;
  setIsProductDialogOpen: (open: boolean) => void;
  setIsShelfDialogOpen: (open: boolean) => void;
}

const BatchForm: React.FC<BatchFormProps> = ({
  formData,
  setFormData,
  products,
  suppliers,
  shelves,
  onSubmit,
  onCancel,
  editingBatch,
  isSubmitting = false,
  setIsSupplierDialogOpen,
  setIsProductDialogOpen,
  setIsShelfDialogOpen
}) => {
  return (
    <div className="space-y-6">

      {/* Basic Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="supplier">Supplier <span className="text-red-500">*</span></Label>
          <div className="flex gap-2">
            <SearchableSelect
              options={suppliers.map(supplier => ({
                value: supplier.id,
                label: supplier.name
              }))}
              value={formData.supplierId}
              onValueChange={(value) => {
                const selectedSupplier = suppliers.find(s => s.id === value);
                setFormData({
                  ...formData,
                  supplierId: value,
                  supplierName: selectedSupplier?.name || ''
                });
              }}
              placeholder="Select supplier"
              emptyText="No supplier found"
              className="flex-1 bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100 focus:ring-blue-500"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSupplierDialogOpen(true)}
              className="whitespace-nowrap"
            >
              Add New
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="product">Product Name <span className="text-red-500">*</span></Label>
          <div className="flex gap-2">
            <SearchableSelect
              options={products.map(product => ({
                value: product.id,
                label: product.name
              }))}
              value={formData.productId}
              onValueChange={(value) => setFormData({ ...formData, productId: value })}
              placeholder="Select product"
              emptyText="No product found"
              className="flex-1 bg-green-50 border-green-200 text-green-900 hover:bg-green-100 focus:ring-green-500"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsProductDialogOpen(true)}
              className="whitespace-nowrap"
            >
              Add New
            </Button>
          </div>
        </div>
      </div>

      {/* Batch Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="batchNo">Batch No. <span className="text-red-500">*</span></Label>
          <Input
            id="batchNo"
            placeholder="Enter batch no."
            value={formData.batchNo}
            onChange={(e) => setFormData({ ...formData, batchNo: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="productionDate">Production Date <span className="text-red-500">*</span></Label>
          <Input
            id="productionDate"
            type="date"
            value={formData.productionDate}
            onChange={(e) => setFormData({ ...formData, productionDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expireDate">Expire Date <span className="text-red-500">*</span></Label>
          <Input
            id="expireDate"
            type="date"
            value={formData.expireDate}
            onChange={(e) => setFormData({ ...formData, expireDate: e.target.value })}
          />
        </div>

      </div>

      {/* Shelf Selection */}
      <div className="space-y-2">
        <Label htmlFor="shelf">Shelf <span className="text-red-500">*</span></Label>
        <div className="flex gap-2">
          <SearchableSelect
            options={shelves.map(shelf => ({
              value: shelf.id,
              label: shelf.name
            }))}
            value={formData.shelfId}
            onValueChange={(value) => {
              const selectedShelf = shelves.find(s => s.id === value);
              setFormData({
                ...formData,
                shelfId: value,
                shelfName: selectedShelf?.name || ''
              });
            }}
            placeholder="Select Shelf"
            emptyText="No shelf found"
            className="flex-1 bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100 focus:ring-purple-500"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsShelfDialogOpen(true)}
            className="whitespace-nowrap"
          >
            Add New
          </Button>
        </div>
      </div>

      {/* Pricing Information */}
      <div className="space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">Pricing & Stock Information</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="costPricePerUnit">Cost Price per Unit (PKR) *</Label>
            <Input
              id="costPricePerUnit"
              type="number"
              step="0.01"
              placeholder="e.g., 3.50"
              value={formData.costPricePerUnit}
              onChange={(e) => {
                const costPricePerUnit = parseFloat(e.target.value) || 0;
                const unitsPerBox = formData.unitsPerBox || 1;
                setFormData({
                  ...formData,
                  costPricePerUnit: costPricePerUnit,
                  costPricePerBox: costPricePerUnit * unitsPerBox
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="costPricePerBox">Cost Price per Box (PKR) <span className="text-red-500">*</span></Label>
            <Input
              id="costPricePerBox"
              type="number"
              step="0.01"
              placeholder="e.g., 350.00"
              value={formData.costPricePerBox}
              onChange={(e) => setFormData({ ...formData, costPricePerBox: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sellingPricePerUnit">Selling Price per Unit (PKR) *</Label>
            <Input
              id="sellingPricePerUnit"
              type="number"
              step="0.01"
              placeholder="e.g., 5.00"
              value={formData.sellingPricePerUnit}
              onChange={(e) => {
                const sellingPricePerUnit = parseFloat(e.target.value) || 0;
                const unitsPerBox = formData.unitsPerBox || 1;
                setFormData({
                  ...formData,
                  sellingPricePerUnit: sellingPricePerUnit,
                  sellingPricePerBox: sellingPricePerUnit * unitsPerBox
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sellingPricePerBox">Selling Price per Box (PKR) <span className="text-red-500">*</span></Label>
            <Input
              id="sellingPricePerBox"
              type="number"
              step="0.01"
              placeholder="e.g., 500.00"
              value={formData.sellingPricePerBox}
              onChange={(e) => setFormData({ ...formData, sellingPricePerBox: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="stockQuantity">Stock Quantity (Units) *</Label>
            <Input
              id="stockQuantity"
              type="number"
              placeholder="e.g., 100"
              value={formData.stockQuantity}
              onChange={(e) => setFormData({ ...formData, stockQuantity: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="unitsPerBox">Units per Box <span className="text-red-500">*</span></Label>
            <Input
              id="unitsPerBox"
              type="number"
              placeholder="e.g., 10"
              value={formData.unitsPerBox}
              onChange={(e) => {
                const unitsPerBox = parseInt(e.target.value) || 1;
                const costPricePerUnit = formData.costPricePerUnit || 0;
                const sellingPricePerUnit = formData.sellingPricePerUnit || 0;
                setFormData({
                  ...formData,
                  unitsPerBox: unitsPerBox,
                  costPricePerBox: costPricePerUnit * unitsPerBox,
                  sellingPricePerBox: sellingPricePerUnit * unitsPerBox
                });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="totalBoxes">Total Boxes <span className="text-red-500">*</span></Label>
            <Input
              id="totalBoxes"
              type="number"
              placeholder="e.g., 50"
              value={formData.totalBoxes}
              onChange={(e) => setFormData({ ...formData, totalBoxes: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minStockLevel">Minimum Stock Level <span className="text-red-500">*</span></Label>
            <Input
              id="minStockLevel"
              type="number"
              placeholder="e.g., 10"
              value={formData.minStockLevel}
              onChange={(e) => setFormData({ ...formData, minStockLevel: parseInt(e.target.value) || 10 })}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-200" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (editingBatch ? 'Update' : 'Add') + ' Batch'}
        </Button>
      </div>
    </div>
  );
};

// Supplier Form Component
interface SupplierFormProps {
  onSuccess: (supplier: Supplier) => void;
  onCancel: () => void;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiService.createSupplier(formData);
      if (response.success) {
        onSuccess(response.data);
      }
    } catch (error) {
      console.error('Error creating supplier:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="supplierName">Supplier Name *</Label>
        <Input
          id="supplierName"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="contactPerson">Contact Person *</Label>
        <Input
          id="contactPerson"
          value={formData.contactPerson}
          onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone *</Label>
        <Input
          id="phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          required
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Add Supplier
        </Button>
      </div>
    </form>
  );
};

// Product Form Component
interface ProductFormProps {
  onSuccess: (product: Product) => void;
  onCancel: () => void;
}

const ProductForm: React.FC<ProductFormProps> = ({ onSuccess, onCancel }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    formula: '',
    categoryId: '',
    barcode: '',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Generate random barcode
  const generateBarcode = () => {
    const randomNum = Math.floor(Math.random() * 10000000000000);
    return randomNum.toString().padStart(13, '0');
  };

  // Load categories on component mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        console.log('🔍 Loading categories for ProductForm...');

        // Get branchId from user context (Batches component should have access to this)
        // For now, we'll let the backend determine branchId from user context
        const response = await apiService.getCategories({
          limit: 1000 // Get all categories
        });
        console.log('🔍 Categories API response:', response);

        if (response.success && response.data) {
          // Handle both array and object response formats
          const categoriesData = Array.isArray(response.data) ? response.data : (response.data?.categories || []);
          console.log('🔍 Categories data:', categoriesData);
          setCategories(categoriesData);
        } else {
          console.log('🔍 No categories found or API failed:', response.message);
          // If no categories exist, we'll show an empty state
          setCategories([]);
        }
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategories([]);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Product name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.categoryId || formData.categoryId === 'loading' || formData.categoryId === 'no-categories') {
      toast({
        title: "Category Required",
        description: "Please select a category. If no categories are available, please create one first.",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await apiService.createProduct({
        name: formData.name,
        description: "",
        formula: formData.formula || "",
        categoryId: formData.categoryId,
        supplierId: 'default-supplier',
        branchId: 'default-branch',
        barcode: formData.barcode || null,
        requiresPrescription: false,
        isActive: true,
        minStock: 1,
        maxStock: 1000,
        unitsPerPack: 1
      });
      if (response.success) {
        onSuccess(response.data);
      } else {
        toast({
          title: "Creation Failed",
          description: 'Failed to create product: ' + (response.message || 'Unknown error'),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating product:', error);
      toast({
        title: "Creation Error",
        description: 'Error creating product: ' + (error instanceof Error ? error.message : 'Unknown error'),
        variant: "destructive",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4 ">
        <div className="space-y-2">
          <Label htmlFor="productName">Medicine Name *</Label>
          <Input
            id="productName"
            placeholder="e.g., Paracetamol 500mg"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="productCategory">Category *</Label>
          <Select
            value={formData.categoryId}
            onValueChange={(value) => {
              // Only allow valid category IDs, not special values
              if (value !== 'loading' && value !== 'no-categories') {
                setFormData({ ...formData, categoryId: value });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {loadingCategories ? (
                <SelectItem value="loading" disabled>Loading categories...</SelectItem>
              ) : categories.length > 0 ? (
                categories.map((category) => (
                  <SelectItem
                    key={category.id}
                    value={category.id}
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    {category.name}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-categories" disabled>No categories available - Please create a category first</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="productFormula">Formula/Composition</Label>
          <Textarea
            id="productFormula"
            placeholder="Enter product formula or composition (e.g., Paracetamol 500mg, Lactose, Starch)"
            value={formData.formula}
            onChange={(e) => setFormData({ ...formData, formula: e.target.value })}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="productBarcode">Barcode</Label>
          <div className="flex space-x-2">
            <Input
              id="productBarcode"
              placeholder="e.g., 1234567890123"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormData({ ...formData, barcode: generateBarcode() })}
            >
              Generate
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-6">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="text-white bg-blue-600 hover:bg-blue-700 border-blue-600 shadow-md hover:shadow-lg transition-all duration-200">
          Add Product
        </Button>
      </div>
    </form>
  );
};

// Shelf Form Component
interface ShelfFormProps {
  onSuccess: (shelf: Shelf) => void;
  onCancel: () => void;
}

const ShelfForm: React.FC<ShelfFormProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await apiService.createShelf(formData);
      if (response.success) {
        onSuccess(response.data);
      }
    } catch (error) {
      console.error('Error creating shelf:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="shelfName">Shelf Name *</Label>
        <Input
          id="shelfName"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shelfDescription">Description</Label>
        <Input
          id="shelfDescription"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="shelfLocation">Location</Label>
        <Input
          id="shelfLocation"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Add Shelf
        </Button>
      </div>
    </form>
  );
};

export default Batches;
