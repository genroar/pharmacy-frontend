import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
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

  // Load customers on component mount
  useEffect(() => {
    loadCustomers();
  }, [searchQuery, selectedFilter, selectedBranchId]);

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
        branchId: branchId || "",
        vip: selectedFilter === "vip" ? true : selectedFilter === "regular" ? false : undefined
      });

      const response = await apiService.getCustomers({
        page: pagination.page,
        limit: pagination.limit,
        search: searchQuery,
        branchId: branchId || "",
        vip: selectedFilter === "vip" ? true : selectedFilter === "regular" ? false : undefined
      });

      console.log('Full API response:', response);

      if (response.success && response.data) {
        console.log('Customers API response data:', response.data);
        console.log('Number of customers in response:', response.data.customers?.length || 0);

        // Transform API data to match Customer interface
        const transformedCustomers = response.data.customers.map(customer => {
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
            isVIP: Boolean(customer.isVIP) || false
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


  const filters = ["all", "vip", "regular", "recent", "with-purchases"];

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         customer.phone.includes(searchQuery) ||
                         customer.email.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesFilter = true;
    if (selectedFilter === "vip") matchesFilter = customer.isVIP;
    if (selectedFilter === "regular") matchesFilter = !customer.isVIP;
    if (selectedFilter === "recent") {
      const lastVisit = new Date(customer.lastVisit);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      matchesFilter = lastVisit >= threeDaysAgo;
    }
    if (selectedFilter === "with-purchases") {
      matchesFilter = customer.totalPurchases > 0;
    }

    return matchesSearch && matchesFilter;
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
          <p className="text-xs text-muted-foreground">Debug: {customers.length} customers loaded</p>
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
          <Button className="text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="shadow-soft border-0">
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

        <Card className="shadow-soft border-0">
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

        <Card className="shadow-soft border-0">
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

        <Card className="shadow-soft border-0">
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

            <div className="flex gap-2">
              {filters.map((filter) => {
                const filterLabels: { [key: string]: string } = {
                  "all": "All",
                  "vip": "VIP",
                  "regular": "Regular",
                  "recent": "Recent",
                  "with-purchases": "With Purchases"
                };
                return (
                  <Button
                    key={filter}
                    variant={selectedFilter === filter ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFilter(filter)}
                    className={`${
                      selectedFilter === filter
                        ? "text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)]"
                        : ""
                    }`}
                  >
                    {filterLabels[filter] || filter}
                  </Button>
                );
              })}
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

      {/* Customer Cards */}
      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => (
          <Card key={customer.id} className="shadow-soft border-0 hover:shadow-medium transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-lg font-semibold text-primary">
                      {customer.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Contact Info */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{customer.phone}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span className="truncate">{customer.email}</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{customer.address}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-muted-foreground">Total Purchases</p>
                  <p className="font-semibold text-foreground">PKR {customer.totalPurchases.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Loyalty Points</p>
                  <p className="font-semibold text-warning">{customer.loyaltyPoints}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Last Visit</p>
                  <p className="font-semibold text-foreground">{new Date(customer.lastVisit).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => startNewSale(customer)}
                >
                  <ShoppingCart className="w-4 h-4 mr-1" />
                  New Sale
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => viewPurchaseHistory(customer)}
                >
                  <Receipt className="w-4 h-4 mr-1" />
                  History
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      )}

      {!loading && !error && filteredCustomers.length === 0 && (
        <Card className="shadow-soft border-0">
          <CardContent className="p-12 text-center">
            <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No customers found</h3>
            <p className="text-muted-foreground mb-4">Try adjusting your search or filter criteria</p>
            <Button className="text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90">
              <Plus className="w-4 h-4 mr-2" />
              Add First Customer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Purchase History Dialog */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-primary" />
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
                            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                              <Receipt className="w-5 h-5 text-primary" />
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
    </div>
  );
};

export default Customers;