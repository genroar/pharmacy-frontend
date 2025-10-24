import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { apiService } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Package, Search, Plus, Edit, Trash2, Eye, Receipt } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

interface Purchase {
  id: string;
  supplierId: string;
  invoiceNo?: string;
  purchaseDate: string;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL';
  notes?: string;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    name: string;
    contactPerson: string;
    phone: string;
  };
  purchaseItems: Array<{
    id: string;
    productId: string;
    batchId?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    product: {
      id: string;
      name: string;
      sku: string;
      barcode?: string;
    };
    batch?: {
      id: string;
      batchNo: string;
      quantity: number;
      expireDate?: string;
    };
  }>;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  unitType: string;
  price: number; // Price from batch data
}

interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
}

const Purchases = () => {
  const { user } = useAuth();
  const { selectedCompanyId, selectedBranchId } = useAdmin();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    supplierId: '',
    invoiceNo: '',
    purchaseDate: new Date(),
    paidAmount: 0,
    notes: '',
    items: [] as Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      batchNo: string;
      expireDate: Date;
      productionDate: Date;
    }>
  });

  const [newItem, setNewItem] = useState({
    productId: '',
    quantity: 1,
    unitPrice: 0,
    batchNo: '',
    expireDate: new Date(),
    productionDate: new Date(),
  });

  // Load data
  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getPurchases({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        supplierId: supplierFilter !== 'all' ? supplierFilter : undefined,
      });
      setPurchases(response.data);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      console.error('Error loading purchases:', error);
      setError('Failed to load purchases');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, supplierFilter]);

  const loadProducts = useCallback(async () => {
    try {
      const response = await apiService.getProducts({
        page: 1,
        limit: 1000,
        branchId: selectedBranchId,
      });
      setProducts(response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    }
  }, [selectedBranchId]);

  const loadSuppliers = useCallback(async () => {
    try {
      const response = await apiService.getSuppliers({
        page: 1,
        limit: 1000,
        branchId: selectedBranchId,
      });
      setSuppliers(response.data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    if (selectedBranchId) {
      loadPurchases();
      loadProducts();
      loadSuppliers();
    }
  }, [selectedBranchId, loadPurchases, loadProducts, loadSuppliers]);

  // Filter purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter(purchase => {
      const matchesSearch = purchase.supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           purchase.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           purchase.id.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [purchases, searchTerm]);

  // Calculate totals
  const totalAmount = useMemo(() => {
    return formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }, [formData.items]);

  const outstandingAmount = totalAmount - formData.paidAmount;

  // Handle form changes
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNewItemChange = (field: string, value: any) => {
    setNewItem(prev => ({ ...prev, [field]: value }));
  };

  const handleDateChange = (field: string, date: Date | undefined) => {
    if (date) {
      setFormData(prev => ({ ...prev, [field]: date }));
    }
  };

  const handleNewItemDateChange = (field: string, date: Date | undefined) => {
    if (date) {
      setNewItem(prev => ({ ...prev, [field]: date }));
    }
  };

  // Add item to purchase
  const handleAddItem = () => {
    if (!newItem.productId || newItem.quantity <= 0 || newItem.unitPrice <= 0) {
      toast({
        title: "Error",
        description: "Please fill in all required fields for the item",
        variant: "destructive",
      });
      return;
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem }]
    }));

    setNewItem({
      productId: '',
      quantity: 1,
      unitPrice: 0,
      batchNo: '',
      expireDate: new Date(),
      productionDate: new Date(),
    });
  };

  // Remove item from purchase
  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Handle product selection
  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setNewItem(prev => ({
        ...prev,
        productId,
        unitPrice: (product.price || 0) * 0.8, // Default to 80% of current price from batch
      }));
    }
  };

  // Create/Update purchase
  const handleSubmit = async () => {
    if (!formData.supplierId || formData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please select a supplier and add at least one item",
        variant: "destructive",
      });
      return;
    }

    try {
      const purchaseData = {
        supplierId: formData.supplierId,
        invoiceNo: formData.invoiceNo || undefined,
        purchaseDate: formData.purchaseDate.toISOString(),
        paidAmount: formData.paidAmount,
        notes: formData.notes || undefined,
        items: formData.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          batchNo: item.batchNo || undefined,
          expireDate: item.expireDate.toISOString(),
          productionDate: item.productionDate.toISOString(),
        })),
      };

      if (editingPurchase) {
        await apiService.updatePurchase(editingPurchase.id, purchaseData);
        toast({
          title: "Success",
          description: "Purchase updated successfully",
        });
      } else {
        await apiService.createPurchase(purchaseData);
        toast({
          title: "Success",
          description: "Purchase created successfully",
        });
      }

      handleCloseModal();
      loadPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
      toast({
        title: "Error",
        description: "Failed to save purchase",
        variant: "destructive",
      });
    }
  };

  // Delete purchase
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this purchase?')) return;

    try {
      await apiService.deletePurchase(id);
      toast({
        title: "Success",
        description: "Purchase deleted successfully",
      });
      loadPurchases();
    } catch (error) {
      console.error('Error deleting purchase:', error);
      toast({
        title: "Error",
        description: "Failed to delete purchase",
        variant: "destructive",
      });
    }
  };

  // Modal handlers
  const handleOpenModal = (purchase?: Purchase) => {
    if (purchase) {
      setEditingPurchase(purchase);
      setFormData({
        supplierId: purchase.supplierId,
        invoiceNo: purchase.invoiceNo || '',
        purchaseDate: new Date(purchase.purchaseDate),
        paidAmount: purchase.paidAmount,
        notes: purchase.notes || '',
        items: [],
      });
    } else {
      setEditingPurchase(null);
      setFormData({
        supplierId: '',
        invoiceNo: '',
        purchaseDate: new Date(),
        paidAmount: 0,
        notes: '',
        items: [],
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPurchase(null);
    setFormData({
      supplierId: '',
      invoiceNo: '',
      purchaseDate: new Date(),
      paidAmount: 0,
      notes: '',
      items: [],
    });
  };

  const handleViewPurchase = (purchase: Purchase) => {
    setViewingPurchase(purchase);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      COMPLETED: { color: 'bg-green-100 text-green-800', label: 'Completed' },
      CANCELLED: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
      PARTIAL: { color: 'bg-blue-100 text-blue-800', label: 'Partial' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Management</h1>
          <p className="text-gray-600">Manage your purchase orders and inventory</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> New Purchase
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="search">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search purchases..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="supplier">Supplier</Label>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Suppliers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Suppliers</SelectItem>
                {suppliers.map(supplier => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={loadPurchases}
              variant="outline"
              className="w-full"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Purchases Table */}
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Purchase #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Total Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPurchases.map((purchase) => (
              <TableRow key={purchase.id}>
                <TableCell className="font-medium">{purchase.id.slice(-8)}</TableCell>
                <TableCell>{purchase.supplier.name}</TableCell>
                <TableCell>{purchase.invoiceNo || '-'}</TableCell>
                <TableCell>{format(new Date(purchase.purchaseDate), 'MMM dd, yyyy')}</TableCell>
                <TableCell>${purchase.totalAmount.toFixed(2)}</TableCell>
                <TableCell>${purchase.paidAmount.toFixed(2)}</TableCell>
                <TableCell>${purchase.outstanding.toFixed(2)}</TableCell>
                <TableCell>{getStatusBadge(purchase.status)}</TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewPurchase(purchase)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenModal(purchase)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(purchase.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <PaginationItem key={page}>
                  <PaginationLink
                    onClick={() => setCurrentPage(page)}
                    isActive={currentPage === page}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Purchase Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              {editingPurchase ? 'Edit Purchase' : 'New Purchase'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {/* Supplier Selection */}
            <div>
              <Label htmlFor="supplier">Supplier *</Label>
              <Select value={formData.supplierId} onValueChange={(value) => handleInputChange('supplierId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Invoice Number */}
            <div>
              <Label htmlFor="invoiceNo">Invoice Number</Label>
              <Input
                id="invoiceNo"
                value={formData.invoiceNo}
                onChange={(e) => handleInputChange('invoiceNo', e.target.value)}
                placeholder="Enter invoice number"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <Label>Purchase Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.purchaseDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.purchaseDate}
                    onSelect={(date) => handleDateChange('purchaseDate', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Paid Amount */}
            <div>
              <Label htmlFor="paidAmount">Paid Amount</Label>
              <Input
                id="paidAmount"
                type="number"
                value={formData.paidAmount}
                onChange={(e) => handleInputChange('paidAmount', parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                step="0.01"
              />
            </div>

            {/* Notes */}
            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Enter any additional notes..."
                rows={3}
              />
            </div>
          </div>

          {/* Items Section */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Purchase Items</h3>

            {/* Add New Item */}
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium mb-3">Add Item</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="product">Product *</Label>
                  <Select value={newItem.productId} onValueChange={handleProductSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(product => (
                        <SelectItem
                          key={product.id}
                          value={product.id}
                          className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                        >
                          {product.name} ({product.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="quantity">Quantity *</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => handleNewItemChange('quantity', parseInt(e.target.value) || 1)}
                    min="1"
                  />
                </div>

                <div>
                  <Label htmlFor="unitPrice">Unit Price *</Label>
                  <Input
                    id="unitPrice"
                    type="number"
                    value={newItem.unitPrice}
                    onChange={(e) => handleNewItemChange('unitPrice', parseFloat(e.target.value) || 0)}
                    step="0.01"
                    min="0"
                  />
                </div>

                <div>
                  <Label htmlFor="batchNo">Batch Number</Label>
                  <Input
                    id="batchNo"
                    value={newItem.batchNo}
                    onChange={(e) => handleNewItemChange('batchNo', e.target.value)}
                    placeholder="Enter batch number"
                  />
                </div>

                <div>
                  <Label>Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newItem.expireDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newItem.expireDate}
                        onSelect={(date) => handleNewItemDateChange('expireDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Production Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newItem.productionDate, 'PPP')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newItem.productionDate}
                        onSelect={(date) => handleNewItemDateChange('productionDate', date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="col-span-2">
                  <Button onClick={handleAddItem} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Item
                  </Button>
                </div>
              </div>
            </div>

            {/* Items List */}
            {formData.items.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Added Items</h4>
                {formData.items.map((item, index) => {
                  const product = products.find(p => p.id === item.productId);
                  return (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                      <div className="flex-1">
                        <span className="font-medium">{product?.name}</span>
                        <span className="text-gray-500 ml-2">({product?.sku})</span>
                        <div className="text-sm text-gray-600">
                          Qty: {item.quantity} × ${item.unitPrice.toFixed(2)} = ${(item.quantity * item.unitPrice).toFixed(2)}
                          {item.batchNo && ` | Batch: ${item.batchNo}`}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Total Amount:</span>
              <span className="text-lg font-bold">${totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Paid Amount:</span>
              <span className="text-lg font-bold">${formData.paidAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center border-t pt-2">
              <span className="text-lg font-semibold">Outstanding:</span>
              <span className="text-lg font-bold">${outstandingAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 mt-6">
            <Button variant="outline" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={formData.items.length === 0}>
              {editingPurchase ? 'Update Purchase' : 'Create Purchase'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Purchase Modal */}
      <Dialog open={!!viewingPurchase} onOpenChange={() => setViewingPurchase(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Purchase Details</DialogTitle>
          </DialogHeader>

          {viewingPurchase && (
            <div className="space-y-6">
              {/* Purchase Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Purchase ID</Label>
                  <p className="text-lg">{viewingPurchase.id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <div className="mt-1">{getStatusBadge(viewingPurchase.status)}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Supplier</Label>
                  <p className="text-lg">{viewingPurchase.supplier.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Invoice Number</Label>
                  <p className="text-lg">{viewingPurchase.invoiceNo || '-'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Purchase Date</Label>
                  <p className="text-lg">{format(new Date(viewingPurchase.purchaseDate), 'PPP')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Total Amount</Label>
                  <p className="text-lg font-semibold">${viewingPurchase.totalAmount.toFixed(2)}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Purchase Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Batch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingPurchase.purchaseItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.product.name}</div>
                            <div className="text-sm text-gray-500">{item.product.sku}</div>
                          </div>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>${item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell>${item.totalPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          {item.batch ? (
                            <div>
                              <div className="font-medium">{item.batch.batchNo}</div>
                              {item.batch.expireDate && (
                                <div className="text-sm text-gray-500">
                                  Expires: {format(new Date(item.batch.expireDate), 'MMM dd, yyyy')}
                                </div>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Notes */}
              {viewingPurchase.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                  <p className="mt-1 p-3 bg-gray-50 rounded">{viewingPurchase.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Purchases;
