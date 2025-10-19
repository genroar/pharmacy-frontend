import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useToast } from '../hooks/use-toast';
import { apiService } from '../services/api';
import { Search, Plus, Edit, Trash2, Package, Calendar, AlertTriangle, Filter, Download } from 'lucide-react';
import { format } from 'date-fns';

interface Batch {
  id: string;
  batchNo: string;
  productId: string;
  supplierId?: string;
  supplierName?: string;
  totalBoxes: number;
  unitsPerBox: number;
  totalStock: number;
  costPrice: number;
  sellingPrice: number;
  stockPurchasePrice: number;
  paidAmount: number;
  supplierOutstanding: number;
  supplierInvoiceNo?: string;
  purchasingMethod?: string;
  expireDate?: string;
  productionDate?: string;
  shelfId?: string;
  shelfName?: string;
  isActive: boolean;
  isReported: boolean;
  createdAt: string;
  updatedAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode?: string;
  };
  supplier?: {
    id: string;
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
}

interface Supplier {
  id: string;
  name: string;
}

const Batches = () => {
  const { toast } = useToast();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('active');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [nearExpiryBatches, setNearExpiryBatches] = useState<Batch[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    batchNo: '',
    productId: '',
    supplierId: '',
    supplierName: '',
    totalBoxes: 0,
    unitsPerBox: 0,
    totalStock: 0,
    costPrice: 0,
    sellingPrice: 0,
    stockPurchasePrice: 0,
    paidAmount: 0,
    purchasingMethod: '',
    expireDate: '',
    productionDate: '',
    shelfId: '',
    shelfName: '',
    productType: 'medical' as 'medical' | 'non-medical',
  });

  // Load data
  const loadBatches = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getBatches({
        page: 1,
        limit: 100,
        search: searchTerm,
        isActive: activeTab === 'active',
        isReported: activeTab === 'reported',
      });

      if (response.success) {
        setBatches(response.data.batches);
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
        setProducts(response.data.products);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    try {
      const response = await apiService.getSuppliers({ page: 1, limit: 1000 });
      if (response.success) {
        setSuppliers(response.data.suppliers);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  }, []);

  const loadNearExpiryBatches = useCallback(async () => {
    try {
      const response = await apiService.getNearExpiryBatches(30);
      if (response.success) {
        setNearExpiryBatches(response.data);
      }
    } catch (error) {
      console.error('Error loading near expiry batches:', error);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    loadProducts();
    loadSuppliers();
    loadNearExpiryBatches();
  }, [loadProducts, loadSuppliers, loadNearExpiryBatches]);

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

    if (formData.totalBoxes <= 0) {
      toast({
        title: "❌ Invalid Total Boxes",
        description: "Total boxes must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (formData.unitsPerBox <= 0) {
      toast({
        title: "❌ Invalid Units Per Box",
        description: "Units per box must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (formData.costPrice <= 0) {
      toast({
        title: "❌ Invalid Cost Price",
        description: "Cost price must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (formData.sellingPrice <= 0) {
      toast({
        title: "❌ Invalid Selling Price",
        description: "Selling price must be greater than 0",
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

    try {
      if (editingBatch) {
        const response = await apiService.updateBatch(editingBatch.id, formData);
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
        const response = await apiService.createBatch(formData);
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
    }
  };

  const resetForm = () => {
    setFormData({
      batchNo: '',
      productId: '',
      supplierId: '',
      supplierName: '',
      totalBoxes: 0,
      unitsPerBox: 0,
      totalStock: 0,
      costPrice: 0,
      sellingPrice: 0,
      stockPurchasePrice: 0,
      paidAmount: 0,
      purchasingMethod: '',
      expireDate: '',
      productionDate: '',
      shelfId: '',
      shelfName: '',
      productType: 'medical',
    });
  };

  const handleEdit = (batch: Batch) => {
    setEditingBatch(batch);
    setFormData({
      batchNo: batch.batchNo,
      productId: batch.productId,
      supplierId: batch.supplierId || '',
      supplierName: batch.supplierName || '',
      totalBoxes: batch.totalBoxes,
      unitsPerBox: batch.unitsPerBox,
      totalStock: batch.totalStock,
      costPrice: batch.costPrice,
      sellingPrice: batch.sellingPrice,
      stockPurchasePrice: batch.stockPurchasePrice,
      paidAmount: batch.paidAmount,
      purchasingMethod: batch.purchasingMethod || '',
      expireDate: batch.expireDate ? format(new Date(batch.expireDate), 'yyyy-MM-dd') : '',
      productionDate: batch.productionDate ? format(new Date(batch.productionDate), 'yyyy-MM-dd') : '',
      shelfId: batch.shelfId || '',
      shelfName: batch.shelfName || '',
      productType: 'medical',
    });
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this batch?')) {
      try {
        const response = await apiService.deleteBatch(id);
        if (response.success) {
          toast({
            title: "✅ Batch Deleted Successfully",
            description: "The batch has been removed from the system",
          });
          loadBatches();
        }
      } catch (error) {
        console.error('Error deleting batch:', error);
        toast({
          title: "❌ Failed to Delete Batch",
          description: "An error occurred while deleting the batch. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const isNearExpiry = (expireDate: string) => {
    const expiry = new Date(expireDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  const isExpired = (expireDate: string) => {
    const expiry = new Date(expireDate);
    const now = new Date();
    return expiry < now;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Batch Management</h1>
          <p className="text-muted-foreground">Manage product batches and inventory</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Print Batch History
          </Button>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button>
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
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
                editingBatch={editingBatch}
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
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
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
                    <th className="text-left p-4">Stock</th>
                    <th className="text-left p-4">Cost Price</th>
                    <th className="text-left p-4">Sell Price</th>
                    <th className="text-left p-4">Expire Date</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium">{batch.batchNo}</td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{batch.product.name}</div>
                          <div className="text-sm text-gray-500">{batch.product.sku}</div>
                        </div>
                      </td>
                      <td className="p-4">{batch.supplierName || 'N/A'}</td>
                      <td className="p-4">{batch.totalStock}</td>
                      <td className="p-4">${batch.costPrice.toFixed(2)}</td>
                      <td className="p-4">${batch.sellingPrice.toFixed(2)}</td>
                      <td className="p-4">
                        {batch.expireDate ? (
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {format(new Date(batch.expireDate), 'MMM dd, yyyy')}
                            {isExpired(batch.expireDate) && (
                              <Badge variant="destructive">Expired</Badge>
                            )}
                            {isNearExpiry(batch.expireDate) && !isExpired(batch.expireDate) && (
                              <Badge variant="outline" className="text-orange-600">Near Expiry</Badge>
                            )}
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="p-4">
                        <Badge variant={batch.isActive ? 'default' : 'secondary'}>
                          {batch.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(batch)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(batch.id)}
                            className="text-red-600 hover:text-red-700"
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
              onSubmit={handleSubmit}
              onCancel={() => {
                setEditingBatch(null);
                resetForm();
              }}
              editingBatch={editingBatch}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

// Batch Form Component
interface BatchFormProps {
  formData: any;
  setFormData: (data: any) => void;
  products: Product[];
  suppliers: Supplier[];
  onSubmit: () => void;
  onCancel: () => void;
  editingBatch?: Batch | null;
}

const BatchForm: React.FC<BatchFormProps> = ({
  formData,
  setFormData,
  products,
  suppliers,
  onSubmit,
  onCancel,
  editingBatch,
}) => {
  return (
    <div className="space-y-6">
      {/* Product Type */}
      <div className="space-y-2">
        <Label>Product Type</Label>
        <div className="flex gap-4">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="productType"
              value="medical"
              checked={formData.productType === 'medical'}
              onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
            />
            <span>Medical</span>
          </label>
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="productType"
              value="non-medical"
              checked={formData.productType === 'non-medical'}
              onChange={(e) => setFormData({ ...formData, productType: e.target.value })}
            />
            <span>Non Medical</span>
          </label>
        </div>
      </div>

      {/* First Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="barcode">Bar Code (Optional)</Label>
          <Input
            id="barcode"
            placeholder="Enter barcode"
            value={formData.barcode || ''}
            onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="supplier">Supplier</Label>
          <div className="flex gap-2">
            <Select
              value={formData.supplierId}
              onValueChange={(value) => setFormData({ ...formData, supplierId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              + Add as New
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="product">Name</Label>
          <div className="flex gap-2">
            <Select
              value={formData.productId}
              onValueChange={(value) => setFormData({ ...formData, productId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              + Add as New
            </Button>
          </div>
        </div>
      </div>

      {/* Second Row */}
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
          <Label htmlFor="totalBoxes">Total Boxes <span className="text-red-500">*</span></Label>
          <Input
            id="totalBoxes"
            type="number"
            placeholder="Add no. of boxes"
            value={formData.totalBoxes}
            onChange={(e) => setFormData({ ...formData, totalBoxes: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unitsPerBox">Units per box <span className="text-red-500">*</span></Label>
          <Input
            id="unitsPerBox"
            type="number"
            placeholder="Add no. of units per box"
            value={formData.unitsPerBox}
            onChange={(e) => setFormData({ ...formData, unitsPerBox: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>

      {/* Third Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="totalStock">Total Stock</Label>
          <Input
            id="totalStock"
            type="number"
            placeholder="Add Quantity"
            value={formData.totalStock}
            onChange={(e) => setFormData({ ...formData, totalStock: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Cost Price <span className="text-red-500">*</span></Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Units Price"
              value={formData.costPrice}
              onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
            />
            <Button variant="outline" size="sm">↔</Button>
            <Input
              type="number"
              placeholder="Boxes Price"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Sell Price <span className="text-red-500">*</span></Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Units Price"
              value={formData.sellingPrice}
              onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
            />
            <Button variant="outline" size="sm">↔</Button>
            <Input
              type="number"
              placeholder="Boxes Price"
            />
          </div>
        </div>
      </div>

      {/* Fourth Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="expireDate">Expire Date <span className="text-red-500">*</span></Label>
          <Input
            id="expireDate"
            type="date"
            value={formData.expireDate}
            onChange={(e) => setFormData({ ...formData, expireDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shelf">Shelf</Label>
          <div className="flex gap-2">
            <Select
              value={formData.shelfId}
              onValueChange={(value) => setFormData({ ...formData, shelfId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Shelf" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shelf1">Shelf 1</SelectItem>
                <SelectItem value="shelf2">Shelf 2</SelectItem>
                <SelectItem value="shelf3">Shelf 3</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              + Add as New
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="productionDate">Production Date (Optional)</Label>
          <Input
            id="productionDate"
            type="date"
            value={formData.productionDate}
            onChange={(e) => setFormData({ ...formData, productionDate: e.target.value })}
          />
        </div>
      </div>

      {/* Fifth Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="stockPurchasePrice">Stock Purchase Price</Label>
          <Input
            id="stockPurchasePrice"
            type="number"
            value={formData.stockPurchasePrice}
            onChange={(e) => setFormData({ ...formData, stockPurchasePrice: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="paidAmount">Paid Amount</Label>
          <Input
            id="paidAmount"
            type="number"
            value={formData.paidAmount}
            onChange={(e) => setFormData({ ...formData, paidAmount: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      {/* Sixth Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="purchasingMethod">Purchasing Method</Label>
          <Select
            value={formData.purchasingMethod}
            onValueChange={(value) => setFormData({ ...formData, purchasingMethod: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Payment Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="check">Check</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Show More Link */}
      <div className="flex items-center gap-2 text-blue-600 cursor-pointer">
        <span>Show More</span>
        <span className="text-xs">i</span>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onSubmit}>
          {editingBatch ? 'Update' : 'Add'} Batch
        </Button>
      </div>
    </div>
  );
};

export default Batches;
