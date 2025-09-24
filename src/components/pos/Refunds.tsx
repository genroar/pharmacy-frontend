import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DateRangeFilter from "@/components/ui/DateRangeFilter";
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import {
  RotateCcw,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  Calendar,
  User,
  AlertCircle,
  Package,
  Pill,
  Droplets,
  Syringe,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowLeft
} from "lucide-react";

interface RefundedItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitType: string;
}

interface RefundRecord {
  id: string;
  originalInvoiceId: string;
  originalInvoiceNumber: string;
  receiptNumber: string;
  refundAmount: number;
  refundReason: string;
  refundedAt: string;
  refundedBy: string;
  items: RefundedItem[];
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
}

const Refunds = () => {
  const { user } = useAuth();
  const { selectedBranchId, selectedBranch } = useAdmin();
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [filteredRefunds, setFilteredRefunds] = useState<RefundRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedRefund, setSelectedRefund] = useState<RefundRecord | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [isSearchingReceipt, setIsSearchingReceipt] = useState(false);
  const [foundInvoice, setFoundInvoice] = useState<any>(null);
  const [isCreateRefundDialogOpen, setIsCreateRefundDialogOpen] = useState(false);

  useEffect(() => {
    loadRefunds();

    // Listen for new refunds
    const handleRefundCreated = (event: CustomEvent) => {
      console.log('🔄 Refund created event received, refreshing refunds list');
      loadRefunds();
    };

    // Real-time data synchronization
    const handleRefundChanged = (event: CustomEvent) => {
      console.log('🔄 Real-time refund change received:', event.detail);
      const { action, refund } = event.detail;

      if (action === 'created') {
        // Add new refund to the list
        const transformedRefund = {
          id: refund.id,
          originalInvoiceId: refund.originalSaleId,
          originalInvoiceNumber: refund.originalSale?.receipts?.[0]?.receiptNumber || refund.originalSale?.id || 'N/A',
          receiptNumber: refund.originalSale?.receipts?.[0]?.receiptNumber || refund.originalSale?.id || 'N/A',
          refundAmount: parseFloat(String(refund.refundAmount)) || 0,
          refundReason: refund.refundReason,
          refundedAt: refund.createdAt || new Date().toISOString(),
          refundedBy: refund.refundedByUser?.name || 'Unknown',
          items: refund.items?.map((item: any) => ({
            productId: item.productId,
            productName: item.product?.name || 'Unknown',
            quantity: item.quantity,
            unitPrice: parseFloat(String(item.unitPrice)) || 0,
            totalPrice: parseFloat(String(item.unitPrice)) * item.quantity,
            unitType: item.product?.unitType || 'pcs',
            reason: item.reason
          })) || [],
          customer: refund.originalSale?.customer ? {
            id: refund.originalSale.customer.id,
            name: refund.originalSale.customer.name,
            phone: refund.originalSale.customer.phone
          } : undefined
        };

        setRefunds(prev => [transformedRefund, ...prev]);
      } else if (action === 'updated') {
        // Update existing refund
        setRefunds(prev => prev.map(r => r.id === refund.id ? {
          ...r,
          refundAmount: parseFloat(String(refund.refundAmount)) || 0,
          refundReason: refund.refundReason
        } : r));
      } else if (action === 'deleted') {
        // Remove refund from the list
        setRefunds(prev => prev.filter(r => r.id !== refund.id));
      }
    };

    window.addEventListener('invoiceRefunded', handleRefundCreated as EventListener);
    window.addEventListener('refundCreated', handleRefundCreated as EventListener);
    window.addEventListener('refundChanged', handleRefundChanged as EventListener);

    return () => {
      window.removeEventListener('invoiceRefunded', handleRefundCreated as EventListener);
      window.removeEventListener('refundCreated', handleRefundCreated as EventListener);
      window.removeEventListener('refundChanged', handleRefundChanged as EventListener);
    };
  }, []);

  const loadRefunds = useCallback(async () => {
    try {
      console.log('🔄 Loading refunds...');
      setLoading(true);

      // Check if user is loaded
      if (!user) {
        console.log('⚠️ User not loaded yet, skipping refunds load');
        setLoading(false);
        return;
      }

      // Clear localStorage to force API call
      localStorage.removeItem('refundedInvoices');

      // Try to load from API first with date filtering
      console.log('🔍 Loading refunds with date filter:', { startDate, endDate });
      console.log('🔍 User context:', {
        id: user?.id,
        role: user?.role,
        adminId: user?.adminId,
        branchId: user?.branchId
      });

      try {
        // Determine which refunds to load based on user role and selected branch
        const params: any = {
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        };

        if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
          // Admin users can see refunds from selected branch or all branches
          if (selectedBranchId) {
            params.branchId = selectedBranchId;
            console.log('Admin selected specific branch for refunds:', selectedBranch?.name);
          } else {
            console.log('Admin viewing all branches - loading all refunds');
          }
        } else {
          // Regular users see only their branch refunds
          params.branchId = user?.branchId;
          console.log('Regular user branch for refunds:', user?.branchId);
        }

        const response = await apiService.getRefunds(params);
        console.log('🔍 API Response:', response);
        if (response.success && response.data) {
          console.log('🔍 Refunds data from API:', response.data.refunds);
          console.log('🔍 Number of refunds received:', response.data.refunds?.length || 0);
          response.data.refunds?.forEach((refund: any, index: number) => {
            console.log(`Refund ${index + 1}: Created by ${refund.refundedByUser?.username} (${refund.refundedByUser?.role}) - Amount: ${refund.refundAmount}`);
          });

          // Transform API data to match frontend format
          const transformedRefunds = response.data.refunds.map((refund: any) => {
            try {
              console.log('🔍 Processing refund:', refund.id, 'refundAmount:', refund.refundAmount, 'type:', typeof refund.refundAmount);

            // Handle Prisma Decimal type for refundAmount
            console.log('🔍 Raw refund amount:', refund.refundAmount, 'Type:', typeof refund.refundAmount, 'Constructor:', refund.refundAmount?.constructor?.name);
            const refundAmount = refund.refundAmount?.toString ? refund.refundAmount.toString() : String(refund.refundAmount);
            const parsedAmount = parseFloat(refundAmount);
            console.log('🔍 Refund amount conversion:', {
              raw: refund.refundAmount,
              string: refundAmount,
              parsed: parsedAmount,
              isNaN: isNaN(parsedAmount),
              final: isNaN(parsedAmount) ? 0 : parsedAmount
            });
            console.log('🔍 Refund ID:', refund.id, 'Original Sale ID:', refund.originalSaleId);

            // Handle Date object for refundedAt with proper validation
            let refundedAt;
            try {
              if (refund.createdAt) {
                // Handle both string and Date object
                const dateStr = typeof refund.createdAt === 'string' ? refund.createdAt : refund.createdAt.toString();
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) {
                  console.warn('⚠️ Invalid date for refund:', refund.id, 'Date:', refund.createdAt);
                  refundedAt = new Date().toISOString();
                } else {
                  refundedAt = date.toISOString();
                }
              } else {
                refundedAt = new Date().toISOString();
              }
            } catch (dateError) {
              console.warn('⚠️ Date conversion error for refund:', refund.id, dateError);
              refundedAt = new Date().toISOString();
            }
            console.log('🔍 Refunded at:', refund.createdAt, 'Formatted:', refundedAt);

            return {
              id: refund.id,
              originalInvoiceId: refund.originalSaleId,
              originalInvoiceNumber: refund.originalSale?.receipts?.[0]?.receiptNumber || refund.originalSale?.id || 'N/A',
              receiptNumber: refund.originalSale?.receipts?.[0]?.receiptNumber || refund.originalSale?.id || 'N/A',
              refundAmount: isNaN(parsedAmount) ? 0 : parsedAmount,
              refundReason: refund.refundReason || 'No reason provided',
              refundedAt: refundedAt,
              refundedBy: refund.refundedByUser?.name || 'Unknown',
              items: refund.items?.map((item: any) => {
                // Handle Prisma Decimal types for prices
                const unitPriceStr = item.unitPrice?.toString ? item.unitPrice.toString() : String(item.unitPrice);
                const unitPrice = parseFloat(unitPriceStr) || 0;
                const quantity = parseInt(item.quantity) || 0;
                const totalPrice = unitPrice * quantity;

                console.log('🔍 Item price:', item.unitPrice, 'String:', unitPriceStr, 'Parsed:', unitPrice, 'Quantity:', quantity, 'Total:', totalPrice);

                return {
                  productId: item.productId,
                  productName: item.product?.name || 'Unknown Product',
                  quantity: quantity,
                  unitPrice: unitPrice,
                  totalPrice: totalPrice,
                  unitType: item.product?.unitType || 'units',
                  reason: item.reason || 'No reason provided'
                };
              }) || [],
              customer: refund.originalSale?.customer ? {
                id: refund.originalSale.customer.id,
                name: refund.originalSale.customer.name,
                phone: refund.originalSale.customer.phone,
                email: refund.originalSale.customer.email,
                address: refund.originalSale.customer.address
              } : undefined
            };

            console.log('🔍 Final refund object:', {
              id: refund.id,
              refundAmount: isNaN(parsedAmount) ? 0 : parsedAmount,
              receiptNumber: refund.originalSale?.receipts?.[0]?.receiptNumber || refund.originalSale?.id || 'N/A'
            });
            } catch (error) {
              console.error('❌ Error processing refund:', refund.id, error);
              // Return a fallback refund object
              return {
                id: refund.id || 'unknown',
                originalInvoiceId: refund.originalSaleId || 'unknown',
                originalInvoiceNumber: 'N/A',
                receiptNumber: 'N/A',
                refundAmount: 0,
                refundReason: refund.refundReason || 'No reason provided',
                refundedAt: new Date().toISOString(),
                refundedBy: 'Unknown',
                items: [],
                customer: undefined
              };
            }
          });

          console.log('🔍 Final transformed refunds:', transformedRefunds.map(r => ({ id: r.id, amount: r.refundAmount, receiptNumber: r.receiptNumber })));
          setRefunds(transformedRefunds);
          console.log('✅ Refunds loaded successfully, count:', transformedRefunds.length);
          return;
        }
      } catch (apiError) {
        console.error('❌ API call failed:', apiError);
        console.log('API call failed, falling back to localStorage:', apiError);

        // Fallback to localStorage or create test data
        const storedRefunds = localStorage.getItem('refundedInvoices');
        if (storedRefunds) {
          const parsedRefunds = JSON.parse(storedRefunds);
          console.log('🔍 Using localStorage data:', parsedRefunds);
          setRefunds(parsedRefunds);
        } else {
          console.log('🔍 No localStorage data, setting empty refunds');
          setRefunds([]);
        }
      }
    } catch (error) {
      console.error('Error loading refunds:', error);
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    filterRefunds();
  }, [refunds, searchQuery]);

  useEffect(() => {
    if (user) {
      console.log('🔄 User loaded, loading refunds...');
      loadRefunds();
    }
  }, [loadRefunds, user, selectedBranchId]);

  const filterRefunds = () => {
    console.log('🔍 Filtering refunds...');
    console.log('Total refunds before filtering:', refunds.length);

    let filtered = [...refunds];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(refund =>
        refund.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        refund.originalInvoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        refund.customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        refund.customer?.phone.includes(searchQuery) ||
        refund.refundReason.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    console.log('Filtered refunds count:', filtered.length);
    console.log('Filtered refunds:', filtered.map(refund => ({ id: refund.id, createdBy: refund.refundedBy, amount: refund.refundAmount })));

    setFilteredRefunds(filtered);
    setCurrentPage(1);
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

  const formatDate = (dateString: string) => {
    console.log('🔍 formatDate called with:', dateString, 'Type:', typeof dateString);

    if (!dateString) {
      console.log('🔍 No dateString provided, returning Invalid Date');
      return 'Invalid Date';
    }

    const date = new Date(dateString);
    console.log('🔍 Date object created:', date, 'isNaN:', isNaN(date.getTime()));

    if (isNaN(date.getTime())) {
      console.log('🔍 Invalid date, returning Invalid Date');
      return 'Invalid Date';
    }

    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    console.log('🔍 Formatted date:', formatted);
    return formatted;
  };

  const paginatedRefunds = filteredRefunds.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredRefunds.length / itemsPerPage);

  const viewRefund = (refund: RefundRecord) => {
    setSelectedRefund(refund);
    setIsRefundDialogOpen(true);
  };

  const printRefund = (refund: RefundRecord) => {
    alert(`Printing refund record: ${refund.receiptNumber}`);
  };

  const downloadRefund = (refund: RefundRecord) => {
    alert(`Downloading refund record: ${refund.receiptNumber}`);
  };

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading refunds...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold ">Refunds & Returns</h1>
            <p className="text-muted-foreground">View all refunded and returned invoices</p>
          </div>
        </div>

        {/* Date Range Filter */}
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onClear={() => {
            setStartDate("");
            setEndDate("");
          }}
        />

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by receipt number, invoice number, customer name, or reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Filter className="w-4 h-4 mr-2" />
                {filteredRefunds.length} refund(s) found
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Refunds List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              <span>Refunded Invoices</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedRefunds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <RotateCcw className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No refunds found</p>
                <p className="text-xs">Refunded invoices will appear here</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedRefunds.map((refund) => (
                  <div key={refund.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h3 className="font-semibold text-lg">{refund.receiptNumber}</h3>
                          <p className="text-sm text-muted-foreground">
                            Original Invoice: {refund.originalInvoiceNumber}
                          </p>
                        </div>
                        <Badge className="bg-red-100 text-red-800">Refunded</Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">
                          -PKR {isNaN(refund.refundAmount) ? '0.00' : refund.refundAmount.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(refund.refundedAt)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                      <div className="flex items-center space-x-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{refund.customer?.name || 'Walk-in Customer'}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>Refunded by: {refund.refundedBy}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span>{refund.items.length} item(s)</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="truncate">{refund.refundReason}</span>
                      </div>
                    </div>

                    {/* Items Preview */}
                    <div className="mb-3">
                      <p className="text-sm font-medium mb-2">Refunded Items:</p>
                      <div className="space-y-1">
                        {refund.items.slice(0, 2).map((item, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              {getUnitIcon(item.unitType)}
                              <span>{item.productName}</span>
                              <span className="text-muted-foreground">
                                ({item.quantity} {item.unitType})
                              </span>
                            </div>
                            <span className="font-medium text-red-600">-PKR {isNaN(item.totalPrice) ? '0.00' : item.totalPrice.toFixed(2)}</span>
                          </div>
                        ))}
                        {refund.items.length > 2 && (
                          <p className="text-xs text-muted-foreground">
                            +{refund.items.length - 2} more item(s)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewRefund(refund)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printRefund(refund)}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadRefund(refund)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRefunds.length)} of {filteredRefunds.length} refunds
                </p>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Refund Details Dialog */}
        <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Refund Details - {selectedRefund?.receiptNumber}</span>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => selectedRefund && printRefund(selectedRefund)}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => selectedRefund && downloadRefund(selectedRefund)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            {selectedRefund && (
              <div className="space-y-6">
                {/* Refund Header */}
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-primary">MediBill Pulse Pharmacy</h2>
                    <p className="text-muted-foreground">Refund Receipt</p>
                    <div className="mt-4 space-y-1 text-sm">
                      <p><strong>Refund ID:</strong> {selectedRefund.id}</p>
                      <p><strong>Receipt Number:</strong> {selectedRefund.receiptNumber}</p>
                      <p><strong>Original Invoice:</strong> {selectedRefund.originalInvoiceNumber}</p>
                      <p><strong>Refund Date:</strong> {formatDate(selectedRefund.refundedAt)}</p>
                      <p><strong>Refunded By:</strong> {selectedRefund.refundedBy}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-600">
                      -PKR {isNaN(selectedRefund.refundAmount) ? '0.00' : selectedRefund.refundAmount.toFixed(2)}
                    </p>
                    <Badge className="bg-red-100 text-red-800 mt-2">Refunded</Badge>
                  </div>
                </div>

                {/* Customer Info */}
                {selectedRefund.customer && (
                  <div className="border-b pb-4">
                    <h3 className="font-semibold mb-2">Customer Information</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Name:</strong> {selectedRefund.customer.name}</p>
                        <p><strong>Phone:</strong> {selectedRefund.customer.phone}</p>
                      </div>
                      <div>
                        <p><strong>Email:</strong> {selectedRefund.customer.email || 'N/A'}</p>
                        <p><strong>Address:</strong> {selectedRefund.customer.address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Refund Reason */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold mb-2">Refund Reason</h3>
                  <p className="text-sm bg-red-50 p-3 rounded-md border border-red-200">
                    {selectedRefund.refundReason}
                  </p>
                </div>

                {/* Refunded Items */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Refunded Items</h3>
                  {selectedRefund.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-dashed">
                      <div className="flex-1">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} {item.unitType} × PKR {isNaN(item.unitPrice) ? '0.00' : item.unitPrice.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-semibold text-red-600">-PKR {isNaN(item.totalPrice) ? '0.00' : item.totalPrice.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                {/* Refund Summary */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Refund Amount:</span>
                    <span className="text-red-600">-PKR {isNaN(selectedRefund.refundAmount) ? '0.00' : selectedRefund.refundAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t pt-4 text-center text-xs text-muted-foreground">
                  <p>This is a refund receipt. Items have been returned to inventory.</p>
                  <p>Generated on {formatDate(selectedRefund.refundedAt)}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Refunds;