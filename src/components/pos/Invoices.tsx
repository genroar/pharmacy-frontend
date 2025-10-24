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
import { useToast } from "@/hooks/use-toast";
import {
  Receipt,
  Search,
  Filter,
  Download,
  Printer,
  Eye,
  Calendar,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Package,
  Pill,
  Droplets,
  Syringe,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Edit,
  Save,
  X
} from "lucide-react";

interface InvoiceItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  batchNumber?: string;
  expiryDate?: string;
  product: {
    id: string;
    name: string;
    unitType: string;
    barcode?: string;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  userId: string;
  branchId: string;
  subtotal: number;
  discountAmount: number;
  discountPercentage?: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  saleDate?: string;
  createdAt: string;
  receiptNumber?: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  user: {
    id: string;
    name: string;
    username: string;
  };
  branch: {
    id: string;
    name: string;
    address: string;
  };
  items: InvoiceItem[];
  receipts: Array<{
    id: string;
    receiptNumber: string;
    printedAt?: string;
  }>;
}

const Invoices = () => {
  const { user } = useAuth();
  const { selectedBranchId, selectedBranch } = useAdmin();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    discountPercentage: 0,
    saleDate: '',
    notes: ''
  });
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundItems, setRefundItems] = useState<Array<{
    productId: string;
    productName: string;
    maxQuantity: number;
    quantity: number;
    unitPrice: number;
    reason: string;
  }>>([]);
  const [refundReason, setRefundReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // No mock data - only use real data from API

  useEffect(() => {
    loadInvoices();

    // Listen for new invoices created from POS
    const handleInvoiceCreated = (event: CustomEvent) => {
      loadInvoices();
    };

    window.addEventListener('invoiceCreated', handleInvoiceCreated as EventListener);

    return () => {
      window.removeEventListener('invoiceCreated', handleInvoiceCreated as EventListener);
    };
  }, []);

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);

      // Load from real API with date filtering and branch filtering
      console.log('🔍 Loading invoices with date filter:', { startDate, endDate });
      console.log('🔍 User context:', {
        id: user?.id,
        name: user?.name,
        role: user?.role,
        branchId: user?.branchId,
        adminId: user?.adminId
      });

      // Determine which invoices to load based on user role and selected branch
      const params: any = {
        limit: 1000,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
        // Admin users can see invoices from selected branch or all branches
        if (selectedBranchId) {
          params.branchId = selectedBranchId;
          console.log('Admin selected specific branch for invoices:', selectedBranch?.name);
        } else {
          console.log('Admin viewing all branches - loading all invoices');
        }
      } else {
        // Regular users see only their branch invoices
        params.branchId = user?.branchId;
        console.log('Regular user branch for invoices:', user?.branchId);
      }

      const response = await apiService.getSales(params);
      console.log('Invoices API response:', response);
      if (response.success && response.data?.sales) {
        console.log('Sales data from API:', response.data.sales);
        console.log('Number of invoices received:', response.data.sales.length);
        response.data.sales.forEach((sale: any, index: number) => {
          console.log(`Invoice ${index + 1}: Created by ${sale.user?.username} (${sale.user?.role}) - Total: ${sale.totalAmount}`);
        });
        // Transform sales data to match invoice format
        const transformedInvoices = response.data.sales.map((sale: any) => {
          console.log('Transforming sale:', sale);
          console.log('Sale customer data:', sale.customer);
          console.log('Sale items data:', sale.items);
          return {
          id: sale.id,
          invoiceNumber: sale.id, // Using sale ID as invoice number
          customerId: sale.customerId,
          userId: sale.userId,
          branchId: sale.branchId,
          subtotal: sale.subtotal,
          discountAmount: sale.discountAmount,
          discountPercentage: sale.discountPercentage,
          totalAmount: sale.totalAmount,
          paymentMethod: sale.paymentMethod,
          paymentStatus: sale.paymentStatus,
          status: sale.status,
          saleDate: sale.saleDate,
          createdAt: sale.createdAt,
          updatedAt: sale.updatedAt,
          customer: sale.customer ? {
            id: sale.customer.id,
            name: sale.customer.name,
            phone: sale.customer.phone,
            email: sale.customer.email,
            address: sale.customer.address
          } : null,
          user: sale.user,
          branch: sale.branch,
          items: (sale.items || []).map((item: any) => ({
            id: item.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            product: {
              id: item.product?.id || item.productId,
              name: item.product?.name || 'Unknown Product',
              unitType: item.product?.unitType || 'Item',
              sku: item.product?.sku || '',
              description: item.product?.description || ''
            }
          })),
          receipts: sale.receipts || [],
          receiptNumber: sale.receipts?.[0]?.receiptNumber || sale.id
          };
        });
        console.log('Transformed invoices:', transformedInvoices);
        console.log('Customer data in invoices:', transformedInvoices.map(inv => ({ id: inv.id, customer: inv.customer })));
        console.log('Receipt data in invoices:', transformedInvoices.map(inv => ({ id: inv.id, receipts: inv.receipts, receiptNumber: inv.receiptNumber })));
        setInvoices(transformedInvoices);
      } else {
        // No data from API - show empty list
        console.log('No invoices found in API response');
        setInvoices([]);
      }
    } catch (error) {
      console.error('Error loading invoices:', error);
      // Show empty list on error instead of mock data
      setInvoices([]);
      toast({
        title: "Error",
        description: "Failed to load invoices. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchQuery, statusFilter, paymentMethodFilter]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices, selectedBranchId]);

  const filterInvoices = () => {
    console.log('🔍 Filtering invoices...');
    console.log('Total invoices before filtering:', invoices.length);

    let filtered = [...invoices];

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(invoice =>
        invoice.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        invoice.customer?.phone?.includes(searchQuery) ||
        invoice.receipts?.some(receipt =>
          receipt.receiptNumber?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(invoice => invoice.status === statusFilter);
    }

    // Payment method filter
    if (paymentMethodFilter !== "all") {
      filtered = filtered.filter(invoice => invoice.paymentMethod === paymentMethodFilter);
    }

    console.log('Filtered invoices count:', filtered.length);
    console.log('Filtered invoices:', filtered.map(inv => ({ id: inv.id, createdBy: inv.user?.username, total: inv.totalAmount })));

    setFilteredInvoices(filtered);
    setCurrentPage(1);
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "CASH":
        return <Banknote className="w-4 h-4" />;
      case "CARD":
        return <CreditCard className="w-4 h-4" />;
      case "MOBILE":
        return <Smartphone className="w-4 h-4" />;
      default:
        return <CreditCard className="w-4 h-4" />;
    }
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "CANCELLED":
        return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatReceiptNumber = (receiptNumber: string) => {
    if (receiptNumber === 'N/A' || !receiptNumber) {
      return 'N/A';
    }

    // If already in RCP format, return as is
    if (receiptNumber.startsWith('RCP-')) {
      return receiptNumber;
    }

    // Format as RCP-{original_receipt_number}
    return `RCP-${receiptNumber}`;
  };

  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);

  // Calculate total revenue from filtered invoices
  const totalRevenue = filteredInvoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0);
  const totalInvoices = filteredInvoices.length;
  const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

  const viewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsInvoiceDialogOpen(true);
  };

  const editInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setEditFormData({
      discountPercentage: invoice.discountPercentage || 0,
      saleDate: invoice.saleDate ? new Date(invoice.saleDate).toISOString().split('T')[0] : '',
      notes: ''
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingInvoice) return;

    try {
      setIsEditing(true);

      // Call backend API to update the sale
      const response = await apiService.updateSale(editingInvoice.id, {
        discountPercentage: editFormData.discountPercentage,
        saleDate: editFormData.saleDate || undefined,
        notes: editFormData.notes
      });

      if (response.success) {
        // Update the invoice in the local state with the response data
        const updatedInvoices = invoices.map(inv =>
          inv.id === editingInvoice.id
            ? {
                ...inv,
                discountPercentage: response.data.discountPercentage,
                discountAmount: response.data.discountAmount,
                totalAmount: response.data.totalAmount,
                saleDate: response.data.saleDate,
                updatedAt: response.data.updatedAt
              }
            : inv
        );

        setInvoices(updatedInvoices);
        setFilteredInvoices(updatedInvoices);

        // Close edit dialog
        setIsEditDialogOpen(false);
        setEditingInvoice(null);

        toast({
          title: "Success",
          description: "Invoice updated successfully!",
        });
      } else {
        toast({
          title: "Error",
          description: `Failed to update invoice: ${response.message}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast({
        title: "Error",
        description: "Error updating invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const printInvoice = (invoice: Invoice) => {
    try {
      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups to print invoices');
        return;
      }

      // Generate HTML content for the invoice
      const invoiceHTML = generateInvoiceHTML(invoice);

      printWindow.document.write(invoiceHTML);
      printWindow.document.close();

      // Wait for content to load, then print
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      };
    } catch (error) {
      console.error('Error printing invoice:', error);
      alert('Error printing invoice. Please try again.');
    }
  };

  const downloadInvoice = (invoice: Invoice) => {
    try {
      // Generate HTML content for the invoice
      const invoiceHTML = generateInvoiceHTML(invoice);

      // Create a blob with the HTML content
      const blob = new Blob([invoiceHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // Create a temporary link element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice.invoiceNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast({
        title: "Error",
        description: "Error downloading invoice. Please try again.",
        variant: "destructive",
      });
    }
  };

  const generateInvoiceHTML = (invoice: Invoice) => {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoiceNumber}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            color: black;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #ddd;
            padding: 30px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #1C623C;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #1C623C;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #666;
            margin: 5px 0;
          }
          .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .invoice-details, .customer-details {
            flex: 1;
          }
          .invoice-details h3, .customer-details h3 {
            color: #1C623C;
            margin-bottom: 10px;
            font-size: 16px;
          }
          .info-row {
            margin: 5px 0;
            font-size: 14px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .items-table th, .items-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          .items-table th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #1C623C;
          }
          .items-table tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .totals {
            margin-top: 20px;
            text-align: right;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            padding: 5px 0;
          }
          .total-final {
            font-weight: bold;
            font-size: 18px;
            color: #1C623C;
            border-top: 2px solid #1C623C;
            padding-top: 10px;
            margin-top: 10px;
          }
          .status {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .status-completed {
            background-color: #d4edda;
            color: #155724;
          }
          .status-refunded {
            background-color: #f8d7da;
            color: #721c24;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #666;
            font-size: 12px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          @media print {
            body { margin: 0; padding: 10px; }
            .invoice-container { border: none; padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <h1>${invoice.branch.name}</h1>
            <p>Your Health, Our Priority</p>
          </div>

          <div class="invoice-info">
            <div class="invoice-details">
              <h3>Invoice Details</h3>
              <div class="info-row"><strong>Invoice #:</strong> ${invoice.invoiceNumber}</div>
              <div class="info-row"><strong>Date:</strong> ${invoice.saleDate ? formatDate(invoice.saleDate) : formatDate(invoice.createdAt)}</div>
              <div class="info-row"><strong>Status:</strong> <span class="status status-${invoice.status.toLowerCase()}">${invoice.status}</span></div>
              <div class="info-row"><strong>Payment Method:</strong> ${invoice.paymentMethod}</div>
              <div class="info-row"><strong>Cashier:</strong> ${invoice.user.name}</div>
              <div class="info-row"><strong>Branch:</strong> ${invoice.branch.name}</div>
            </div>

            <div class="customer-details">
              <h3>Customer Information</h3>
              ${invoice.customer ? `
                <div class="info-row"><strong>Name:</strong> ${invoice.customer.name}</div>
              ` : `
                <div class="info-row"><strong>Customer Type:</strong> Walk-in Customer</div>
              `}
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.items.map(item => `
                <tr>
                  <td>${item.product.name}</td>
                  <td>${item.quantity} ${item.product.unitType}</td>
                  <td>PKR ${item.unitPrice.toFixed(2)}</td>
                  <td>PKR ${item.totalPrice.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>PKR ${invoice.subtotal.toFixed(2)}</span>
            </div>
            ${(invoice.discountPercentage && invoice.discountPercentage > 0) || invoice.discountAmount > 0 ? `
              <div class="total-row" style="color: #16a34a;">
                <span>${invoice.discountPercentage && invoice.discountPercentage > 0 ? `Discount (${invoice.discountPercentage}%):` : 'Discount:'}</span>
                <span>-PKR ${invoice.discountPercentage && invoice.discountPercentage > 0 ? (invoice.subtotal * invoice.discountPercentage / 100).toFixed(2) : invoice.discountAmount.toFixed(2)}</span>
              </div>
            ` : ''}
            <div class="total-row total-final">
              <span>TOTAL:</span>
              <span>PKR ${invoice.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for choosing ${invoice.branch.name}!</p>
            <p>For any queries, please contact us at your nearest branch.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const openRefundDialog = (invoice: Invoice) => {
    console.log('Opening refund dialog for invoice:', invoice);
    console.log('Invoice status:', invoice.status);
    console.log('Invoice items:', invoice.items);
    console.log('Invoice items length:', invoice.items?.length || 0);
    console.log('Invoice items structure:', JSON.stringify(invoice.items, null, 2));

    // Check if invoice is already refunded
    if (invoice.status === 'REFUNDED') {
      alert('This invoice has already been refunded.');
      return;
    }

    // Check if invoice is completed
    if (invoice.status !== 'COMPLETED') {
      alert('Only completed invoices can be refunded.');
      return;
    }

    setSelectedInvoice(invoice);

    // Check if invoice has items
    if (!invoice.items || invoice.items.length === 0) {
      console.error('No items found in invoice:', invoice);
      alert('No items found in this invoice. Cannot process refund.');
      return;
    }

    // Initialize refund items with invoice items
    const items = (invoice.items || []).map(item => {
      console.log('Mapping item for refund:', item);
      console.log('Item product:', item.product);
      return {
        productId: item.productId,
        productName: item.product?.name || 'Unknown Product',
        maxQuantity: item.quantity,
        quantity: 0, // Start with 0 quantity for refund
        unitPrice: item.unitPrice,
        reason: "Customer requested refund"
      };
    });

    console.log('Mapped refund items:', items);
    setRefundItems(items);
    setRefundReason("Customer requested refund");
    setIsRefundDialogOpen(true);
  };

  const handleRefundItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...refundItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setRefundItems(updatedItems);
  };

  const createRefund = async () => {
    if (!selectedInvoice) return;

    try {
      setIsRefunding(true);

      // Filter out items with quantity 0
      const itemsToRefund = refundItems.filter(item => item.quantity > 0);

      if (itemsToRefund.length === 0) {
        alert("Please select at least one item to refund.");
        return;
      }

      // Calculate total refund amount
      const totalRefundAmount = itemsToRefund.reduce((total, item) => {
        return total + (item.quantity * item.unitPrice);
      }, 0);

      console.log('Creating refund with data:', {
        originalSaleId: selectedInvoice.id,
        refundReason: refundReason,
        totalRefundAmount: totalRefundAmount,
        items: itemsToRefund
      });

      const refundData = {
        originalSaleId: selectedInvoice.id,
        refundReason: refundReason,
        items: itemsToRefund.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          reason: item.reason
        })),
        refundedBy: selectedInvoice.user.id
      };

      const response = await apiService.createRefund(refundData);
      if (response.success) {
        console.log('Refund created successfully:', response.data);
        toast({
          title: "Success",
          description: `Refund created successfully for invoice: ${selectedInvoice.invoiceNumber}. Refund Amount: PKR ${totalRefundAmount.toFixed(2)}`,
        });
        setIsRefundDialogOpen(false);
        // Reset refund form
        setRefundItems([]);
        setRefundReason("");
        // Reload invoices to reflect the refund
        loadInvoices();
      } else {
        console.error('Refund creation failed:', response);
        toast({
          title: "Error",
          description: `Failed to create refund: ${response.message}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating refund:', error);
      toast({
        title: "Error",
        description: "Error creating refund. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefunding(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-background min-h-screen">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading invoices...</p>
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
            <h1 className="text-3xl font-bold ">Invoices</h1>
            <p className="text-muted-foreground">Manage and view all purchase invoices</p>
          </div>
          <Button onClick={loadInvoices} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
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

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by invoice number, customer name, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <Select  value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="all"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    All Status
                  </SelectItem>
                  <SelectItem
                    value="COMPLETED"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Completed
                  </SelectItem>
                  <SelectItem
                    value="PENDING"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Pending
                  </SelectItem>
                  <SelectItem
                    value="CANCELLED"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Cancelled
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Payment Method Filter */}
              <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="all"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    All Payment Methods
                  </SelectItem>
                  <SelectItem
                    value="CASH"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Cash
                  </SelectItem>
                  <SelectItem
                    value="CARD"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Card
                  </SelectItem>
                  <SelectItem
                    value="MOBILE"
                    className="!hover:bg-blue-100 !hover:text-blue-900 !focus:bg-blue-200 !focus:text-blue-900 !transition-colors !duration-200 cursor-pointer"
                  >
                    Mobile
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Results Count */}
              <div className="flex items-center text-sm text-muted-foreground">
                <Filter className="w-4 h-4 mr-2" />
                {filteredInvoices.length} invoice(s) found
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Invoices List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-[#0c2c8a]" />
              <span>Invoice List</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paginatedInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No invoices found</p>
                <p className="text-xs">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {paginatedInvoices.map((invoice) => (
                  <div key={invoice.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h3 className="font-semibold text-lg">{invoice.invoiceNumber}</h3>
                          <p className="text-sm text-muted-foreground">
                            {invoice.customer?.name || 'Walk-in Customer'}
                          </p>
                        </div>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-[#0c2c8a]">
                          PKR {invoice.totalAmount.toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.saleDate ? formatDate(invoice.saleDate) : formatDate(invoice.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                      <div className="flex items-center space-x-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>{invoice.user.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        {getPaymentMethodIcon(invoice.paymentMethod)}
                        <span>{invoice.paymentMethod}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span>{invoice.items.length} item(s)</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span>{invoice.branch.name}</span>
                      </div>
                    </div>

                    {/* Items Preview */}
                    <div className="mb-3">
                      <p className="text-sm font-medium mb-2">Items:</p>
                      <div className="space-y-1">
                        {invoice.items.slice(0, 2).map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              {getUnitIcon(item.product.unitType)}
                              <span>{item.product.name}</span>
                              <span className="text-muted-foreground">
                                ({item.quantity} {item.product.unitType})
                              </span>
                            </div>
                            <span className="font-medium">PKR {item.totalPrice.toFixed(2)}</span>
                          </div>
                        ))}
                        {invoice.items.length > 2 && (
                          <p className="text-xs text-muted-foreground">
                            +{invoice.items.length - 2} more item(s)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Invoice Summary */}
                    <div className="mb-3 p-3 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span className="font-medium">PKR {invoice.subtotal.toFixed(2)}</span>
                        </div>
                        {((invoice.discountPercentage && invoice.discountPercentage > 0) || invoice.discountAmount > 0) && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount:</span>
                            <span>
                              {invoice.discountPercentage && invoice.discountPercentage > 0
                                ? `${invoice.discountPercentage}% (-PKR ${(invoice.subtotal * invoice.discountPercentage / 100).toFixed(2)})`
                                : `-PKR ${invoice.discountAmount.toFixed(2)}`
                              }
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between font-semibold">
                          <span>Total:</span>
                          <span className="text-[#0c2c8a]">PKR {invoice.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewInvoice(invoice)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printInvoice(invoice)}
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadInvoice(invoice)}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => editInvoice(invoice)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRefundDialog(invoice)}
                        className={invoice.status === 'REFUNDED'
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        }
                        disabled={invoice.status === 'REFUNDED'}
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        {invoice.status === 'REFUNDED' ? 'Refunded' : 'Refund'}
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
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length} invoices
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

        {/* Total Revenue Display */}
        {filteredInvoices.length > 0 && (
          <div className="text-center py-4">
            <div className="text-sm text-gray-600">
              Total Revenue: <span className="font-semibold text-green-600">PKR {totalRevenue.toFixed(2)}</span>
              <span className="text-gray-500 ml-2">({totalInvoices} invoice{totalInvoices !== 1 ? 's' : ''})</span>
            </div>
          </div>
        )}

        {/* Invoice Details Dialog */}
        <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Invoice Details - {selectedInvoice?.invoiceNumber}</span>
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm" onClick={() => selectedInvoice && printInvoice(selectedInvoice)}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => selectedInvoice && downloadInvoice(selectedInvoice)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedInvoice && openRefundDialog(selectedInvoice)}
                    className={selectedInvoice?.status === 'REFUNDED'
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    }
                    disabled={selectedInvoice?.status === 'REFUNDED'}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {selectedInvoice?.status === 'REFUNDED' ? 'Refunded' : 'Refund'}
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-6">
                {/* Invoice Header */}
                <div className="flex justify-between items-start border-b pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-primary">{selectedInvoice.branch.name}</h2>
                    <p className="text-muted-foreground">Your Health, Our Priority</p>
                    <div className="mt-4 space-y-1 text-sm">
                      <p><strong>Invoice Number:</strong> {selectedInvoice.invoiceNumber}</p>
                      <p><strong>Date:</strong> {selectedInvoice.saleDate ? formatDate(selectedInvoice.saleDate) : formatDate(selectedInvoice.createdAt)}</p>
                      <p><strong>Cashier:</strong> {selectedInvoice.user.name}</p>
                      <p><strong>Branch:</strong> {selectedInvoice.branch.name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      PKR {selectedInvoice.totalAmount.toFixed(2)}
                    </p>
                    <div className="mt-2">
                      {getStatusBadge(selectedInvoice.status)}
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  {selectedInvoice.customer && (selectedInvoice.customer.name || selectedInvoice.customer.phone) ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p><strong>Name:</strong> {selectedInvoice.customer.name}</p>
                        <p><strong>Phone:</strong> {selectedInvoice.customer.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p><strong>Email:</strong> {selectedInvoice.customer.email || 'N/A'}</p>
                        <p><strong>Address:</strong> {selectedInvoice.customer.address || 'N/A'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      <p><strong>Customer Type:</strong> Walk-in Customer</p>
                      <p><strong>No customer details available</strong></p>
                    </div>
                  )}
                </div>

                {/* Items */}
                <div className="space-y-3">
                  <h3 className="font-semibold">Items Purchased</h3>
                  {selectedInvoice.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center py-2 border-b border-dashed">
                      <div className="flex-1">
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} {item.product.unitType} × PKR {item.unitPrice.toFixed(2)}
                          {item.batchNumber && ` • Batch: ${item.batchNumber}`}
                          {item.expiryDate && ` • Exp: ${new Date(item.expiryDate).toLocaleDateString()}`}
                        </p>
                      </div>
                      <p className="font-semibold">PKR {item.totalPrice.toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>PKR {selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {((selectedInvoice.discountPercentage && selectedInvoice.discountPercentage > 0) || selectedInvoice.discountAmount > 0) && (
                    <div className="flex justify-between text-green-600">
                      <span>
                        {selectedInvoice.discountPercentage && selectedInvoice.discountPercentage > 0
                          ? `Discount (${selectedInvoice.discountPercentage}%):`
                          : 'Discount:'
                        }
                      </span>
                      <span>
                        -PKR {selectedInvoice.discountPercentage && selectedInvoice.discountPercentage > 0
                          ? (selectedInvoice.subtotal * selectedInvoice.discountPercentage / 100).toFixed(2)
                          : selectedInvoice.discountAmount.toFixed(2)
                        }
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span className="text-primary">PKR {selectedInvoice.totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Payment Method:</strong> {selectedInvoice.paymentMethod}</p>
                      <p><strong>Status:</strong> {selectedInvoice.paymentStatus}</p>
                    </div>
                    <div>
                      <p><strong>Receipt Number:</strong> {selectedInvoice.receipts?.[0]?.receiptNumber || selectedInvoice.invoiceNumber || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Refund Dialog */}
        <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Create Refund - {selectedInvoice?.invoiceNumber}</span>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={createRefund}
                    disabled={isRefunding}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {isRefunding ? 'Processing...' : 'Process Refund'}
                  </Button>
                </div>
              </DialogTitle>
            </DialogHeader>

            {selectedInvoice && (
              <div className="space-y-6">
                {/* Refund Reason */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Refund Reason</label>
                  <Input
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Enter reason for refund..."
                  />
                </div>

                {/* Items to Refund */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Items to Refund</h3>
                  <div className="text-sm text-muted-foreground">
                    Debug: {refundItems.length} items loaded
                  </div>
                  <div className="space-y-3">
                    {refundItems.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No items found in this invoice.</p>
                        <p className="text-sm">Invoice ID: {selectedInvoice?.id}</p>
                        <p className="text-sm">Items in invoice: {selectedInvoice?.items?.length || 0}</p>
                        <p className="text-sm">Debug: {refundItems.length} items loaded</p>
                        <div className="text-xs text-muted-foreground mt-2">
                          <p>Invoice structure: {JSON.stringify(selectedInvoice?.items?.slice(0, 1), null, 2)}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Try to reload the invoice data
                            console.log('Reloading invoice data...');
                            if (selectedInvoice) {
                              openRefundDialog(selectedInvoice);
                            }
                          }}
                          className="mt-2"
                        >
                          Retry Loading Items
                        </Button>
                      </div>
                    ) : (
                      refundItems.map((item, index) => (
                      <div key={item.productId} className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium">{item.productName}</h4>
                            <p className="text-sm text-muted-foreground">
                              Unit Price: PKR {item.unitPrice.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              Max: {item.maxQuantity} units
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Quantity to Refund</label>
                            <Input
                              type="number"
                              min="0"
                              max={item.maxQuantity}
                              value={item.quantity}
                              onChange={(e) => handleRefundItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Reason</label>
                            <Input
                              value={item.reason}
                              onChange={(e) => handleRefundItemChange(index, 'reason', e.target.value)}
                              placeholder="Reason for this item..."
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-sm text-muted-foreground">
                            Total Refund Amount:
                          </span>
                          <span className="font-medium">
                            PKR {(item.quantity * item.unitPrice).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Refund Summary */}
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total Refund Amount:</span>
                    <span className="text-xl font-bold text-orange-600">
                      PKR {refundItems.reduce((total, item) => total + (item.quantity * item.unitPrice), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Invoice Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-blue-600" />
                <span>Edit Invoice - {editingInvoice?.invoiceNumber}</span>
              </DialogTitle>
            </DialogHeader>

            {editingInvoice && (
              <div className="space-y-6">
                {/* Invoice Info */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold mb-2">Invoice Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Customer:</span>
                      <span className="ml-2 font-medium">
                        {editingInvoice.customer?.name || 'Walk-in Customer'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Items:</span>
                      <span className="ml-2 font-medium">{editingInvoice.items.length} item(s)</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span className="ml-2 font-medium">PKR {editingInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Current Total:</span>
                      <span className="ml-2 font-medium text-[#0c2c8a]">PKR {editingInvoice.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Edit Form */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Discount Percentage</label>
                      <div className="flex items-center space-x-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={editFormData.discountPercentage}
                          onChange={(e) => setEditFormData({
                            ...editFormData,
                            discountPercentage: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                          })}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      {editFormData.discountPercentage > 0 && (
                        <p className="text-xs text-green-600">
                          Discount Amount: -PKR {((editingInvoice.subtotal * editFormData.discountPercentage) / 100).toFixed(2)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Sale Date</label>
                      <Input
                        type="date"
                        value={editFormData.saleDate}
                        onChange={(e) => setEditFormData({
                          ...editFormData,
                          saleDate: e.target.value
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes (Optional)</label>
                    <Input
                      value={editFormData.notes}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        notes: e.target.value
                      })}
                      placeholder="Add any notes about this invoice..."
                    />
                  </div>
                </div>

                {/* New Totals Preview */}
                {editFormData.discountPercentage !== (editingInvoice.discountPercentage || 0) && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">New Totals Preview</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>PKR {editingInvoice.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>Discount ({editFormData.discountPercentage}%):</span>
                        <span>-PKR {((editingInvoice.subtotal * editFormData.discountPercentage) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>New Total:</span>
                        <span className="text-blue-600">
                          PKR {(editingInvoice.subtotal - (editingInvoice.subtotal * editFormData.discountPercentage / 100)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    onClick={handleEditSave}
                    disabled={isEditing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isEditing ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Invoices;
