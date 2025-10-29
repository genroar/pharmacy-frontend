import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ShoppingCart,
  Download,
  Search,
  Package,
  AlertTriangle,
  RefreshCw,
  Filter,
  Plus,
  RotateCcw
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface Batch {
  id: string;
  batchNo: string;
  productId: string;
  productName: string;
  productSku: string;
  category: string;
  supplier: string;
  branch: {
    id: string;
    name: string;
  };
  currentStock: number;
  totalProductStock: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  expireDate?: string;
  productionDate?: string;
  orderQuantity: number;
  isLowStock: boolean;
  isCritical: boolean;
  isNearExpiry: boolean;
  isExpired: boolean;
  reason: string;
}

interface Branch {
  id: string;
  name: string;
}

const OrderPurchase = () => {
  const { user: currentUser } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [stockFilter, setStockFilter] = useState("all"); // all, low, critical, nearExpiry, expired
  const [showRestockDialog, setShowRestockDialog] = useState(false);
  const [showNewBatchDialog, setShowNewBatchDialog] = useState(false);
  const [selectedBatchForRestock, setSelectedBatchForRestock] = useState<Batch | null>(null);
  const [restockQuantity, setRestockQuantity] = useState(0);

  // Set default branch for managers and cashiers
  useEffect(() => {
    if (currentUser?.role === 'MANAGER' || currentUser?.role === 'CASHIER') {
      if (currentUser?.branchId && selectedBranch === "all") {
        setSelectedBranch(currentUser.branchId);
      }
    }
  }, [currentUser, selectedBranch]);

  // Load data on component mount and when filters change
  useEffect(() => {
    loadBatches();
    loadBranches();
  }, [selectedBranch, stockFilter]);

  // Load batches when search term changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadBatches();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadBatches = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Determine which branch to filter by based on user role and selection
      let branchIdToUse = undefined;

      if (selectedBranch !== "all") {
        // User selected a specific branch
        branchIdToUse = selectedBranch;
      } else if (currentUser?.role === 'MANAGER' || currentUser?.role === 'CASHIER') {
        // Managers and Cashiers should only see their assigned branch
        branchIdToUse = currentUser?.branchId;
      }
      // SuperAdmin and Admin can see all branches when "All Branches" is selected

      console.log('Loading low stock batches with params:', {
        page: 1,
        limit: 1000,
        branchId: branchIdToUse,
        search: searchTerm,
        userRole: currentUser?.role,
        userBranchId: currentUser?.branchId
      });

      const response = await apiService.getLowStockBatches({
        page: 1,
        limit: 1000,
        branchId: branchIdToUse,
        search: searchTerm
      });

      console.log('API response:', response);

      if (response.success && response.data?.batches) {
        let batchesData = response.data.batches;

        console.log('Mapped batches data:', batchesData);

        // Filter batches based on stock level
        if (stockFilter === "low") {
          batchesData = batchesData.filter((batch: Batch) => batch.isLowStock);
        } else if (stockFilter === "critical") {
          batchesData = batchesData.filter((batch: Batch) => batch.isCritical);
        } else if (stockFilter === "nearExpiry") {
          batchesData = batchesData.filter((batch: Batch) => batch.isNearExpiry);
        } else if (stockFilter === "expired") {
          batchesData = batchesData.filter((batch: Batch) => batch.isExpired);
        }
        // "all" shows all batches requiring attention

        console.log('Filtered batches data:', batchesData);

        setBatches(batchesData);
      } else {
        setError("Failed to load batches");
      }
    } catch (err) {
      console.error("Error loading batches:", err);
      setError("Failed to load batches");
    } finally {
      setIsLoading(false);
    }
  };

  const loadBranches = async () => {
    try {
      const response = await apiService.getBranches();
      if (response.success && response.data) {
        let branchesData = Array.isArray(response.data) ? response.data : response.data.branches;

        // Filter branches based on user role
        if (currentUser?.role === 'MANAGER' || currentUser?.role === 'CASHIER') {
          // Managers and Cashiers should only see their assigned branch
          branchesData = branchesData.filter((branch: any) =>
            branch.id === currentUser?.branchId
          );
        }
        // SuperAdmin and Admin can see all branches

        setBranches(branchesData.map((branch: any) => ({
          id: branch.id,
          name: branch.name
        })));
      }
    } catch (err) {
      console.error("Error loading branches:", err);
    }
  };

  const handleSearch = () => {
    // Search is handled by useEffect with debounce
  };

  const handleFilterChange = () => {
    // Filter changes are handled by useEffect
  };

  const handleOrderQuantityChange = (batchId: string, newQuantity: number) => {
    setBatches(prevBatches =>
      prevBatches.map(batch =>
        batch.id === batchId
          ? { ...batch, orderQuantity: Math.max(0, newQuantity) }
          : batch
      )
    );
  };

  const handleRestockBatch = (batch: Batch) => {
    setSelectedBatchForRestock(batch);
    setRestockQuantity(0);
    setShowRestockDialog(true);
  };

  const confirmRestock = async () => {
    if (!selectedBatchForRestock || restockQuantity <= 0) return;

    try {
      setIsLoading(true);
      const response = await apiService.restockBatch(selectedBatchForRestock.id, {
        quantity: restockQuantity,
        notes: `Restocked ${restockQuantity} units for batch ${selectedBatchForRestock.batchNo}`
      });

      if (response.success) {
        // Update the batch in the local state
        setBatches(prevBatches =>
          prevBatches.map(batch =>
            batch.id === selectedBatchForRestock.id
              ? { ...batch, currentStock: batch.currentStock + restockQuantity }
              : batch
          )
        );
        setShowRestockDialog(false);
        setSelectedBatchForRestock(null);
        setRestockQuantity(0);
        // Reload batches to get updated data
        await loadBatches();
      } else {
        setError(response.message || 'Failed to restock batch');
      }
    } catch (err) {
      console.error('Error restocking batch:', err);
      setError('Failed to restock batch');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewBatch = () => {
    setShowNewBatchDialog(true);
  };

  const getStockStatus = (batch: Batch) => {
    if (batch.isExpired) {
      return { status: "Expired", color: "destructive" };
    } else if (batch.isCritical) {
      return { status: "Critical", color: "destructive" };
    } else if (batch.isNearExpiry) {
      return { status: "Near Expiry", color: "secondary" };
    } else if (batch.isLowStock) {
      return { status: "Low Stock", color: "destructive" };
    } else {
      return { status: "Normal", color: "default" };
    }
  };

  const calculateOrderQuantity = (batch: Batch) => {
    // Use the orderQuantity from the batch if set, otherwise calculate suggested quantity
    return batch.orderQuantity || 0;
  };

  const downloadOrderList = () => {
    const orderData = batches.map(batch => ({
      "Batch No": batch.batchNo,
      "Product Name": batch.productName,
      "SKU": batch.productSku,
      "Current Stock": batch.currentStock,
      "Total Product Stock": batch.totalProductStock,
      "Min Stock": batch.minStock,
      "Max Stock": batch.maxStock,
      "Unit Price": batch.unitPrice,
      "Suggested Order Qty": calculateOrderQuantity(batch),
      "Total Value": (calculateOrderQuantity(batch) * batch.unitPrice).toFixed(2),
      "Category": batch.category,
      "Branch": batch.branch.name,
      "Supplier": batch.supplier,
      "Expiry Date": batch.expireDate || "N/A",
      "Production Date": batch.productionDate || "N/A",
      "Issue Reason": batch.reason,
      "Status": getStockStatus(batch).status
    }));

    // Convert to CSV
    const headers = Object.keys(orderData[0]);
    const csvContent = [
      headers.join(","),
      ...orderData.map(row =>
        headers.map(header => `"${row[header]}"`).join(",")
      )
    ].join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `batch_order_purchase_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalOrderValue = batches.reduce((sum, batch) =>
    sum + ((batch.orderQuantity || 0) * batch.unitPrice), 0
  );

  const totalOrderItems = batches.reduce((sum, batch) =>
    sum + (batch.orderQuantity || 0), 0
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean White Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Batch Order Purchase</h1>
                <p className="text-gray-600 mt-1">
                  Manage batches requiring attention: low stock, near expiry, and expired items
                  {currentUser?.role === 'MANAGER' || currentUser?.role === 'CASHIER' ? (
                    <span className="ml-2 text-blue-600 font-medium">
                      • {branches.find(b => b.id === selectedBranch)?.name || 'Your Branch'}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={handleAddNewBatch}
                className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add New Batch
              </Button>
              <Button
                onClick={downloadOrderList}
                disabled={batches.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all duration-200"
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
              <Button
                onClick={loadBatches}
                disabled={isLoading}
                variant="outline"
                className="border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-6">
        {/* Compact Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Issues</p>
                <p className="text-2xl font-bold text-gray-900">{batches.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-red-600">
                  {batches.filter(b => b.isLowStock).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Near Expiry</p>
                <p className="text-2xl font-bold text-orange-600">
                  {batches.filter(b => b.isNearExpiry).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Expired</p>
                <p className="text-2xl font-bold text-red-800">
                  {batches.filter(b => b.isExpired).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-800" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-purple-600">
                  ${totalOrderValue.toFixed(2)}
                </p>
              </div>
              <Package className="h-8 w-8 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Compact Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search batches by product name, SKU, batch number, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-3">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  {(currentUser?.role === 'SUPERADMIN' || currentUser?.role === 'ADMIN') && (
                    <SelectItem value="all">All Branches</SelectItem>
                  )}
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Stock" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Issues</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="nearExpiry">Near Expiry</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Modern Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-600" />
              Batches Requiring Reorder ({batches.length})
            </h3>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span className="text-gray-600">Loading batches...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-8 w-8 mx-auto mb-2" />
              <p>No batches found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Batch & Product</TableHead>
                    <TableHead className="font-semibold">Stock Info</TableHead>
                    <TableHead className="font-semibold">Pricing</TableHead>
                    <TableHead className="font-semibold text-center">Order Qty</TableHead>
                    <TableHead className="font-semibold text-right">Total Value</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Branch</TableHead>
                    <TableHead className="font-semibold text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const stockStatus = getStockStatus(batch);
                    const orderQuantity = calculateOrderQuantity(batch);
                    const totalValue = orderQuantity * batch.unitPrice;

                    return (
                      <TableRow key={batch.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{batch.productName}</div>
                            <div className="text-sm text-gray-500">SKU: {batch.productSku}</div>
                            <div className="text-sm text-gray-500">Batch: {batch.batchNo}</div>
                            <div className="text-sm text-gray-500">{batch.category}</div>
                            <div className="text-xs text-blue-600 font-medium">{batch.reason}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center space-x-4">
                              <div>
                                <span className="text-gray-600">Current:</span>
                                <span className="ml-1 font-medium">{batch.currentStock}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Total Product:</span>
                                <span className="ml-1">{batch.totalProductStock}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Min:</span>
                                <span className="ml-1">{batch.minStock}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Max:</span>
                                <span className="ml-1">{batch.maxStock}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">${batch.unitPrice.toFixed(2)}</div>
                            <div className="text-gray-500">per unit</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={orderQuantity}
                            onChange={(e) => handleOrderQuantityChange(batch.id, parseInt(e.target.value) || 0)}
                            className="w-20 text-center font-medium"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-semibold text-green-600">
                            ${totalValue.toFixed(2)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={stockStatus.color as any}
                            className={stockStatus.color === 'destructive' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}
                          >
                            {stockStatus.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {batch.branch.name}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            onClick={() => handleRestockBatch(batch)}
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restock
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Restock Dialog */}
      <Dialog open={showRestockDialog} onOpenChange={setShowRestockDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Restock Batch</DialogTitle>
            <DialogDescription>
              Add more units to this batch inventory.
            </DialogDescription>
          </DialogHeader>
          {selectedBatchForRestock && (
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <RotateCcw className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedBatchForRestock.productName}</h3>
                  <p className="text-sm text-gray-500">Batch: {selectedBatchForRestock.batchNo}</p>
                  <p className="text-sm text-gray-500">Current Stock: {selectedBatchForRestock.currentStock}</p>
                </div>
              </div>
              <div>
                <Label htmlFor="restock-quantity">Quantity to Add</Label>
                <Input
                  id="restock-quantity"
                  type="number"
                  min="1"
                  value={restockQuantity}
                  onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 0)}
                  placeholder="Enter quantity to add"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestockDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmRestock}
              disabled={restockQuantity <= 0 || isLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isLoading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
              Restock Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Batch Dialog */}
      <Dialog open={showNewBatchDialog} onOpenChange={setShowNewBatchDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Batch</DialogTitle>
            <DialogDescription>
              Create a new batch for inventory management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center py-8">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">New Batch Creation</h3>
              <p className="text-gray-500 mb-4">
                This feature will redirect you to the batch management page where you can create a new batch.
              </p>
              <Button
                onClick={() => {
                  setShowNewBatchDialog(false);
                  // Navigate to batch management page
                  window.location.href = '/batches';
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Go to Batch Management
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBatchDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrderPurchase;
