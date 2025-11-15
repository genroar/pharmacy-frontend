import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  User,
  Phone,
  Mail,
  MapPin,
  Edit,
  Trash2,
  ShoppingCart,
  Calendar,
  Star,
  Receipt,
  TrendingUp,
  Package,
  Clock,
  DollarSign
} from "lucide-react";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  totalPurchases: number;
  lastVisit: string;
  loyaltyPoints: number;
  isVIP: boolean;
  createdBy?: string;
}

interface PurchaseHistory {
  id: string;
  date: string;
  items: string[];
  total: number;
  paymentMethod: string;
  receiptNumber: string;
}

const Customers = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedBranchId, selectedBranch } = useAdmin();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [createdByFilter, setCreatedByFilter] = useState("all"); // New filter for created by
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  // Form state for adding new customer
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load customers on component mount
  useEffect(() => {
    loadCustomers();
  }, [searchQuery, createdByFilter, selectedBranchId]);

  // Refresh customers when component becomes visible (e.g., after returning from POS)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadCustomers();
      }
    };

    const handleCustomerCreated = () => {
      console.log('Customer created event received, refreshing customer list...');
      loadCustomers();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('customerCreated', handleCustomerCreated);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('customerCreated', handleCustomerCreated);
    };
  }, []);

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and phone number are required!",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await apiService.createCustomer({
        name: newCustomer.name,
        phone: newCustomer.phone,
        email: newCustomer.email,
        address: newCustomer.address,
        branchId: selectedBranchId || user?.branchId || ""
      });

      if (response.success) {
        toast({
          title: "Success",
          description: "Customer added successfully!",
        });

        // Reset form
        setNewCustomer({
          name: "",
          phone: "",
          email: "",
          address: ""
        });

        setIsAddDialogOpen(false);
        loadCustomers();
      } else {
        toast({
          title: "Error",
          description: response.message || "Failed to add customer",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: "Error",
        description: "Failed to add customer. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Determine which branch to load customers from
      let branchId: string | undefined;

      if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
        // Admin users can see customers from selected branch or all branches
        if (selectedBranchId) {
          branchId = selectedBranchId;
          console.log('Admin selected specific branch for customers:', selectedBranch?.name);
        } else {
          console.log('Admin viewing all branches - loading all customers');
        }
      } else {
        // Regular users see only their branch customers
        branchId = user?.branchId || "default-branch";
        if (!branchId || branchId === "default-branch") {
          const branchesResponse = await apiService.getBranches();
          if (branchesResponse.success && branchesResponse.data?.branches?.length > 0) {
            branchId = branchesResponse.data.branches[0].id;
          }
        }
        console.log('Regular user branch for customers:', branchId);
      }

      console.log('Loading customers with params:', {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        branchId: branchId || ""
      });

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        branchId: branchId || ""
      };

      // Add createdByRole filter if not "all"
      if (createdByFilter !== "all") {
        params.createdByRole = createdByFilter;
      }

      const response = await apiService.getCustomers(params);

      console.log('Full API response:', response);

      if (response.success && response.data) {
        console.log('Customers API response data:', response.data);
        console.log('Number of customers in response:', response.data.customers?.length || 0);

        // Transform API data to match Customer interface
        const transformedCustomers = response.data.customers.map((customer: any) => {
          console.log('Individual customer data:', customer);
          return {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email || "",
            address: customer.address || "",
            totalPurchases: Number(customer.totalPurchases) || 0,
            lastVisit: customer.lastVisit ? new Date(customer.lastVisit).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            loyaltyPoints: Number(customer.loyaltyPoints) || 0,
            isVIP: Boolean(customer.isVIP) || false,
            createdBy: customer.createdBy || null
          };
        });

        console.log('Transformed customers:', transformedCustomers);
        console.log('Setting customers state with:', transformedCustomers.length, 'customers');
        setCustomers(transformedCustomers);
        setPagination(response.data.pagination);
      } else {
        console.error('API response failed:', response);
        setError('Failed to load customers: ' + (response.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error loading customers:', err);
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseHistory = async (customerId: string) => {
    try {
      const response = await apiService.getCustomerPurchaseHistory(customerId, {
        page: 1,
        limit: 10
      });

      if (response.success && response.data) {
        setPurchaseHistory(response.data.sales);
      }
    } catch (err) {
      console.error('Error loading purchase history:', err);
    }
  };


  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         customer.phone.includes(searchQuery) ||
                         customer.email.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const totalCustomers = customers.length;
  const vipCustomers = customers.filter(c => c.isVIP).length;
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + c.loyaltyPoints, 0);
  const totalPurchases = customers.reduce((sum, c) => sum + c.totalPurchases, 0);
  const averagePurchase = customers.length > 0 ? totalPurchases / customers.length : 0;

  // Debug logging
  console.log('Customer stats:', {
    totalCustomers,
    vipCustomers,
    totalLoyaltyPoints,
    totalPurchases,
    averagePurchase,
    customers: customers.map(c => ({
      name: c.name,
      totalPurchases: c.totalPurchases,
      loyaltyPoints: c.loyaltyPoints,
      isVIP: c.isVIP
    }))
  });

  const startNewSale = (customer: Customer) => {
    // Store customer info in localStorage for POS to access
    localStorage.setItem('selectedCustomer', JSON.stringify(customer));
    // Navigate to POS
    navigate('/pos');
  };

  const viewPurchaseHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    await loadPurchaseHistory(customer.id);
    setIsHistoryDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customer Management</h1>
          <p className="text-muted-foreground">Manage customer relationships and loyalty</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={loadCustomers}
            disabled={loading}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="text-white bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700 shadow-md hover:shadow-lg transition-all duration-200"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-md border-[1px] border-[#0c2c8a]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Customers</p>
                <p className="text-2xl font-bold text-foreground">{totalCustomers}</p>
              </div>
              <User className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-[1px] border-[#0c2c8a]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">VIP Customers</p>
                <p className="text-2xl font-bold text-warning">{vipCustomers}</p>
              </div>
              <Star className="w-8 h-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-[1px] border-[#0c2c8a]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Loyalty Points</p>
                <p className="text-2xl font-bold text-success">{totalLoyaltyPoints.toLocaleString()}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-[1px] border-[#0c2c8a]">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Purchase</p>
                <p className="text-2xl font-bold text-primary">PKR {averagePurchase.toFixed(0)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
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
                placeholder="Search by name, phone, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2 items-center">
              {/* Created By Filter */}
              <Select value={createdByFilter} onValueChange={setCreatedByFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Created By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="CASHIER">Cashier</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card className="shadow-soft border-0">
          <CardContent className="p-12 text-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading customers...</p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="shadow-soft border-0">
          <CardContent className="p-12 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={loadCustomers} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Customer Table */}
      {!loading && !error && (
        <Card className="shadow-soft border-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Total Purchases</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-600">
                          {customer.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">{customer.address}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span>{customer.phone}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-[150px]">{customer.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-primary">PKR {customer.totalPurchases.toLocaleString()}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{new Date(customer.lastVisit).toLocaleDateString()}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.isVIP ? "default" : "outline"}>
                        {customer.isVIP ? "VIP" : "Regular"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewPurchaseHistory(customer)}
                          className="h-8 px-2"
                        >
                          <Receipt className="w-4 h-4 mr-1" />
                          History
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredCustomers.length === 0 && (
        <Card className="shadow-soft border-0">
          <CardContent className="p-12 text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No customers found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filter criteria</p>

          </CardContent>Recent Purchases

        </Card>
      )}

      {/* Purchase History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-[#0c2c8a]" />
              <span>Purchase History - {selectedCustomer?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              {/* Customer Summary */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Total Purchases</p>
                      <p className="text-xl font-bold text-primary">PKR {selectedCustomer.totalPurchases.toLocaleString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Loyalty Points</p>
                      <p className="text-xl font-bold text-warning">{selectedCustomer.loyaltyPoints}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Last Visit</p>
                      <p className="text-lg font-semibold">{new Date(selectedCustomer.lastVisit).toLocaleDateString()}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge variant={selectedCustomer.isVIP ? "default" : "outline"}>
                        {selectedCustomer.isVIP ? "VIP" : "Regular"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Purchase History */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Recent Purchases</h3>
                {purchaseHistory.length > 0 ? (
                  purchaseHistory.map((purchase) => (
                    <Card key={purchase.id} className="hover:shadow-medium transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <Receipt className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-semibold">Receipt #{purchase.id}</p>
                              <p className="text-sm text-muted-foreground">{new Date(purchase.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">PKR {purchase.totalAmount}</p>
                            <Badge variant="outline" className="capitalize">{purchase.paymentMethod}</Badge>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-medium">Items Purchased:</p>
                          <div className="flex flex-wrap gap-2">
                            {purchase.items.map((item, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                <Package className="w-3 h-3 mr-1" />
                                {item.product.name} ({item.quantity} {item.product.unitType})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Receipt className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold text-foreground mb-2">No purchase history</h3>
                      <p className="text-muted-foreground">This customer hasn't made any purchases yet.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Plus className="w-5 h-5 text-primary" />
              <span>Add New Customer</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name *</Label>
              <Input
                id="customerName"
                placeholder="Enter customer name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone Number *</Label>
              <Input
                id="customerPhone"
                placeholder="Enter phone number"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerEmail">Email (Optional)</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="Enter email address"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerAddress">Address (Optional)</Label>
              <Textarea
                id="customerAddress"
                placeholder="Enter address"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setNewCustomer({
                  name: "",
                  phone: "",
                  email: "",
                  address: ""
                });
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomer}
              disabled={isSubmitting || !newCustomer.name.trim() || !newCustomer.phone.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Customer
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;