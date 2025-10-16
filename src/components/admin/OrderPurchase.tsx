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
  ShoppingCart,
  Download,
  Search,
  Package,
  AlertTriangle,
  RefreshCw,
  Filter
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unitPrice: number;
  category: string;
  branch: {
    id: string;
    name: string;
  };
  supplier?: string;
  lastRestocked?: string;
  orderQuantity?: number; // Add editable order quantity
}

interface Branch {
  id: string;
  name: string;
}

const OrderPurchase = () => {
  const { user: currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [stockFilter, setStockFilter] = useState("low"); // low, critical, all

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
    loadProducts();
    loadBranches();
  }, [selectedBranch, stockFilter]);

  // Load products when search term changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadProducts();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadProducts = async () => {
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

      console.log('Loading products with params:', {
        page: 1,
        limit: 1000,
        branchId: branchIdToUse,
        stockFilter,
        userRole: currentUser?.role,
        userBranchId: currentUser?.branchId
      });

      const response = await apiService.getProducts({
        page: 1,
        limit: 1000,
        branchId: branchIdToUse
      });

      console.log('API response:', response);

      if (response.success && response.data?.products) {
        // Map API response to component format
        let productsData = response.data.products.map((product: any) => {
          const maxStock = product.maxStock || product.minStock * 10;
          const suggestedOrderQty = Math.max(0, maxStock - product.stock);

          return {
            id: product.id,
            name: product.name,
            sku: product.barcode || product.id,
            currentStock: product.stock,
            minStock: product.minStock,
            maxStock: maxStock,
            unitPrice: product.sellingPrice,
            category: product.category?.name || 'Uncategorized',
            branch: {
              id: product.branch?.id || '',
              name: product.branch?.name || 'Unknown Branch'
            },
            supplier: product.supplier?.name,
            lastRestocked: product.updatedAt,
            orderQuantity: suggestedOrderQty // Set initial order quantity
          };
        });

        console.log('Mapped products data:', productsData);

        // Filter products based on stock level
        if (stockFilter === "low") {
          productsData = productsData.filter((product: Product) =>
            product.currentStock <= product.minStock
          );
        } else if (stockFilter === "critical") {
          productsData = productsData.filter((product: Product) =>
            product.currentStock <= (product.minStock * 0.5)
          );
        }

        console.log('Filtered products data:', productsData);

        // Apply search filter
        if (searchTerm) {
          productsData = productsData.filter((product: Product) =>
            product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.category.toLowerCase().includes(searchTerm.toLowerCase())
          );
        }

        setProducts(productsData);
      } else {
        setError("Failed to load products");
      }
    } catch (err) {
      console.error("Error loading products:", err);
      setError("Failed to load products");
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

  const handleOrderQuantityChange = (productId: string, newQuantity: number) => {
    setProducts(prevProducts =>
      prevProducts.map(product =>
        product.id === productId
          ? { ...product, orderQuantity: Math.max(0, newQuantity) }
          : product
      )
    );
  };

  const getStockStatus = (product: Product) => {
    if (product.currentStock <= (product.minStock * 0.5)) {
      return { status: "Critical", color: "destructive" };
    } else if (product.currentStock <= product.minStock) {
      return { status: "Low", color: "destructive" };
    } else {
      return { status: "Normal", color: "default" };
    }
  };

  const calculateOrderQuantity = (product: Product) => {
    // Use the orderQuantity from the product if set, otherwise calculate suggested quantity
    return product.orderQuantity || 0;
  };

  const downloadOrderList = () => {
    const orderData = products.map(product => ({
      "Product Name": product.name,
      "SKU": product.sku,
      "Current Stock": product.currentStock,
      "Min Stock": product.minStock,
      "Max Stock": product.maxStock,
      "Unit Price": product.unitPrice,
      "Suggested Order Qty": calculateOrderQuantity(product),
      "Total Value": (calculateOrderQuantity(product) * product.unitPrice).toFixed(2),
      "Category": product.category,
      "Branch": product.branch.name,
      "Supplier": product.supplier || "N/A",
      "Last Restocked": product.lastRestocked || "N/A"
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
    link.setAttribute("download", `order_purchase_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalOrderValue = products.reduce((sum, product) =>
    sum + ((product.orderQuantity || 0) * product.unitPrice), 0
  );

  const totalOrderItems = products.reduce((sum, product) =>
    sum + (product.orderQuantity || 0), 0
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
                <h1 className="text-3xl font-bold text-gray-900">Order Purchase</h1>
                <p className="text-gray-600 mt-1">
                  Manage low stock products and create purchase orders
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
                onClick={downloadOrderList}
                disabled={products.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white font-medium"
              >
                <Download className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
              <Button
                onClick={loadProducts}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Products</p>
                <p className="text-2xl font-bold text-gray-900">{products.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Low Stock</p>
                <p className="text-2xl font-bold text-red-600">
                  {products.filter(p => p.currentStock <= p.minStock).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Order Items</p>
                <p className="text-2xl font-bold text-green-600">{totalOrderItems}</p>
              </div>
              <ShoppingCart className="h-8 w-8 text-green-500" />
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
                placeholder="Search products by name, SKU, or category..."
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
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
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
              Products Requiring Reorder ({products.length})
            </h3>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" />
              <span className="text-gray-600">Loading products...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-600">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>{error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-8 w-8 mx-auto mb-2" />
              <p>No products found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold">Product</TableHead>
                    <TableHead className="font-semibold">Stock Info</TableHead>
                    <TableHead className="font-semibold">Pricing</TableHead>
                    <TableHead className="font-semibold text-center">Order Qty</TableHead>
                    <TableHead className="font-semibold text-right">Total Value</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Branch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const stockStatus = getStockStatus(product);
                    const orderQuantity = calculateOrderQuantity(product);
                    const totalValue = orderQuantity * product.unitPrice;

                    return (
                      <TableRow key={product.id} className="hover:bg-gray-50">
                        <TableCell>
                          <div>
                            <div className="font-medium text-gray-900">{product.name}</div>
                            <div className="text-sm text-gray-500">SKU: {product.sku}</div>
                            <div className="text-sm text-gray-500">{product.category}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center space-x-4">
                              <div>
                                <span className="text-gray-600">Current:</span>
                                <span className="ml-1 font-medium">{product.currentStock}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Min:</span>
                                <span className="ml-1">{product.minStock}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">Max:</span>
                                <span className="ml-1">{product.maxStock}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">${product.unitPrice.toFixed(2)}</div>
                            <div className="text-gray-500">per unit</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min="0"
                            value={orderQuantity}
                            onChange={(e) => handleOrderQuantityChange(product.id, parseInt(e.target.value) || 0)}
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
                          {product.branch.name}
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
    </div>
  );
};

export default OrderPurchase;
