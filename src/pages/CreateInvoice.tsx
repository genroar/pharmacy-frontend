import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Package,
  Plus,
  Minus,
  Trash2,
  Receipt,
  ArrowLeft,
  ShoppingCart,
  Printer,
  Download,
  Phone,
  Mail,
  AlertCircle,
  Calendar,
  Banknote,
  CreditCard,
  Smartphone
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";
import { apiService } from "@/services/api";
import { toast } from "@/hooks/use-toast";

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  unitType: string;
  batch: string;
  expiry: string;
  formula?: string; // Product composition/formula for search
  barcode?: string;
}

interface Batch {
  id: string;
  batchNo: string;
  quantity: number;
  sellingPrice: number;
  expireDate?: string;
  expiryStatus?: 'GOOD' | 'WARNING' | 'CRITICAL' | 'EXPIRED';
  daysUntilExpiry?: number;
}

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitType: string;
  batch: string;
  expiry: string;
  batchId?: string;
  instructions?: string;
  discountPercentage?: number;
  discountAmount?: number;
}

interface Receipt {
  id: string;
  receiptNumber: string;
  date: string;
  time: string;
  cashier: string;
  customer?: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  items: CartItem[];
  subtotal: number;
  discountAmount?: number;
  discountPercentage?: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
}

const CreateInvoice = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedBranchId, selectedBranch } = useAdmin();

  // State management
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [invoiceItems, setInvoiceItems] = useState<CartItem[]>([]);
  const [invoiceCustomer, setInvoiceCustomer] = useState({
    name: "",
    phone: ""
  });
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('CASH');
  const [paymentStatus, setPaymentStatus] = useState<string>('COMPLETED'); // COMPLETED = Paid, PENDING = Unpaid
  const [isLoading, setIsLoading] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<Receipt | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundReceiptNumber, setRefundReceiptNumber] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [foundInvoice, setFoundInvoice] = useState<any>(null);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);

  // Batch management state
  const [productBatches, setProductBatches] = useState<Record<string, Batch[]>>({});
  const [selectedBatches, setSelectedBatches] = useState<Record<string, string>>({}); // productId -> batchId
  const [loadingBatches, setLoadingBatches] = useState<Record<string, boolean>>({});

  // Load products on component mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Fetch batches for a specific product
  const fetchProductBatches = useCallback(async (productId: string) => {
    setLoadingBatches(prev => {
      if (prev[productId]) return prev; // Already loading
      return { ...prev, [productId]: true };
    });

    setProductBatches(prev => {
      if (prev[productId]) {
        // Already loaded, cancel loading state
        setLoadingBatches(p => ({ ...p, [productId]: false }));
        return prev;
      }
      return prev;
    });

    try {
      // Determine branchId for fetching batches
      let branchIdForBatches: string | undefined;
      if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
        branchIdForBatches = selectedBranchId || undefined;
      } else {
        branchIdForBatches = user?.branchId || undefined;
      }

      const response = await apiService.getInventoryByBatches({
        productId: productId,
        limit: 100, // Get all batches for this product
        expired: false, // Exclude expired batches
        branchId: branchIdForBatches
      });

      if (response.success && response.data) {
        const batches: Batch[] = response.data.map((batch: any) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          quantity: batch.quantity,
          sellingPrice: batch.sellingPrice,
          expireDate: batch.expireDate,
          expiryStatus: batch.expiryStatus,
          daysUntilExpiry: batch.daysUntilExpiry
        }));

        // Sort batches by expiry date (nearest first)
        batches.sort((a, b) => {
          if (!a.expireDate && !b.expireDate) return 0;
          if (!a.expireDate) return 1;
          if (!b.expireDate) return -1;
          return new Date(a.expireDate).getTime() - new Date(b.expireDate).getTime();
        });

        setProductBatches(prev => {
          if (prev[productId]) return prev; // Don't overwrite if already set
          return { ...prev, [productId]: batches };
        });

        // Auto-select batch with nearest expiry if no batch is selected
        setSelectedBatches(prev => {
          if (prev[productId]) return prev; // Already selected
          if (batches.length > 0) {
            const nearestBatch = batches[0]; // Already sorted by expiry
            return { ...prev, [productId]: nearestBatch.id };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error(`Error fetching batches for product ${productId}:`, error);
      setProductBatches(prev => ({ ...prev, [productId]: [] }));
    } finally {
      setLoadingBatches(prev => ({ ...prev, [productId]: false }));
    }
  }, [user, selectedBranchId]);

  // Filter products based on search query
  useEffect(() => {
    console.log('Search query changed:', searchQuery);
    console.log('Products available:', products.length);

    if (searchQuery.trim() && Array.isArray(products)) {
      const query = searchQuery.toLowerCase();
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.id.toLowerCase().includes(query) ||
        (product.formula && product.formula.toLowerCase().includes(query)) || // Search by formula
        (product.barcode && product.barcode.toLowerCase().includes(query)) // Search by barcode
      );
      console.log('Filtered products:', filtered.length, 'matches for:', searchQuery);
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [searchQuery, products]);

  // Fetch batches for filtered products
  useEffect(() => {
    filteredProducts.forEach(product => {
      if (!productBatches[product.id] && !loadingBatches[product.id]) {
        fetchProductBatches(product.id);
      }
    });
  }, [filteredProducts, productBatches, loadingBatches, fetchProductBatches]);

  // Get selected batch for a product, or auto-select nearest expiry
  const getSelectedBatch = (productId: string): Batch | null => {
    const batches = productBatches[productId] || [];
    if (batches.length === 0) return null;

    const selectedBatchId = selectedBatches[productId];
    if (selectedBatchId) {
      const batch = batches.find(b => b.id === selectedBatchId);
      if (batch && batch.quantity > 0) return batch;
    }

    // Auto-select batch with nearest expiry that has stock
    const availableBatches = batches.filter(b => b.quantity > 0);
    if (availableBatches.length > 0) {
      return availableBatches[0]; // Already sorted by expiry
    }

    return null;
  };

  const loadProducts = async () => {
    try {
      setIsLoading(true);

      // Determine which branch to load products from
      let branchId: string | undefined;

      if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
        // Admin users use selected branch
        if (selectedBranchId) {
          branchId = selectedBranchId;
          console.log('Admin selected specific branch for products:', selectedBranch?.name);
        } else {
          console.log('Admin viewing all branches - loading all products');
        }
      } else {
        // Regular users use their assigned branch
        branchId = user?.branchId || "default-branch";
        console.log('Regular user branch for products:', branchId);
      }

      const params: any = { limit: 1000 };
      if (branchId) {
        params.branchId = branchId;
      }

      const response = await apiService.getProducts(params);
      console.log('Products API response:', response);

      if (response.success && response.data && Array.isArray(response.data.products)) {
        // Transform the API response to match our Product interface
        const transformedProducts = response.data.products.map((product: any) => ({
          id: product.id,
          name: product.name,
          price: product.price || 0, // Price now comes from batch data
          stock: product.stock || 0, // Stock now comes from batch data
          unitType: product.unitType || 'tablets',
          batch: product.currentBatch?.batchNo || 'BATCH001',
          expiry: product.currentBatch?.expireDate ? new Date(product.currentBatch.expireDate).toLocaleDateString() : 'Dec 2025',
          formula: product.formula || '', // Product formula/composition for search
          barcode: product.barcode || ''
        }));

        setProducts(transformedProducts);
        console.log('Products loaded successfully:', transformedProducts.length, 'items');
      } else {
        console.warn('Invalid products response:', response);
        setProducts([]);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setProducts([]);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getUnitIcon = (unitType: string) => {
    switch (unitType.toLowerCase()) {
      case 'tablets':
      case 'capsules':
        return <Package className="w-4 h-4" />;
      case 'syrup':
        return <Package className="w-4 h-4" />;
      case 'injection':
        return <Package className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const addToInvoiceCart = (product: Product, quantity: number, unitType: string) => {
    // Get the selected batch or auto-select nearest expiry
    const selectedBatch = getSelectedBatch(product.id);

    if (!selectedBatch) {
      toast({
        title: "No Batch Available",
        description: "No available batches found for this product. Please check inventory.",
        variant: "destructive",
      });
      return;
    }

    // Validate quantity against batch stock
    if (quantity > selectedBatch.quantity) {
      toast({
        title: "Insufficient Stock",
        description: `Available stock in batch ${selectedBatch.batchNo}: ${selectedBatch.quantity} units.`,
        variant: "destructive",
      });
      return;
    }

    const existingItem = invoiceItems.find(item =>
      item.name === product.name && item.unitType === unitType && item.batchId === selectedBatch.id
    );

    if (existingItem) {
      // Check if adding quantity exceeds batch stock
      if (existingItem.quantity + quantity > selectedBatch.quantity) {
        toast({
          title: "Insufficient Stock",
          description: `Available stock in batch ${selectedBatch.batchNo}: ${selectedBatch.quantity} units.`,
          variant: "destructive",
        });
        return;
      }
      updateInvoiceQuantity(existingItem.id, existingItem.quantity + quantity);
    } else {
      const batchPrice = selectedBatch.sellingPrice || product.price;
      const expiryDate = selectedBatch.expireDate
        ? new Date(selectedBatch.expireDate).toLocaleDateString()
        : "N/A";

      const newItem: CartItem = {
        id: `${product.id}-${unitType}-${selectedBatch.id}-${Date.now()}`,
        name: product.name,
        quantity,
        unitPrice: batchPrice,
        totalPrice: batchPrice * quantity,
        unitType,
        batch: selectedBatch.batchNo,
        batchId: selectedBatch.id,
        expiry: expiryDate,
        instructions: unitType === "pack" ? "Take as directed" : `Take ${quantity} ${unitType} as directed`,
        discountPercentage: 0,
        discountAmount: 0
      };
      setInvoiceItems([...invoiceItems, newItem]);
    }
  };

  const updateInvoiceQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setInvoiceItems(invoiceItems.filter(item => item.id !== itemId));
    } else {
      setInvoiceItems(invoiceItems.map(item => {
        if (item.id === itemId) {
          const subtotal = item.unitPrice * newQuantity;
          const itemDiscount = item.discountPercentage ? (subtotal * item.discountPercentage / 100) : (item.discountAmount || 0);
          const totalPrice = subtotal - itemDiscount;
          return { ...item, quantity: newQuantity, totalPrice: totalPrice };
        }
        return item;
      }));
    }
  };

  const updateItemDiscount = (itemId: string, discountPercentage: number) => {
    setInvoiceItems(invoiceItems.map(item => {
      if (item.id === itemId) {
        const subtotal = item.unitPrice * item.quantity;
        const discountAmount = discountPercentage > 0 ? (subtotal * discountPercentage / 100) : 0;
        const totalPrice = subtotal - discountAmount;
        return {
          ...item,
          discountPercentage: discountPercentage,
          discountAmount: discountAmount,
          totalPrice: totalPrice
        };
      }
      return item;
    }));
  };

  const createInvoice = async () => {
    if (invoiceItems.length === 0) {
      toast({
        title: "No items selected",
        description: "Please add at least one item to create an invoice.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log('Creating invoice with items:', invoiceItems);

      // Create customer if details provided
      let customerId = null;
      let customerName = "Walk-in Customer";
      let customerPhone = "";

      if (invoiceCustomer.name && invoiceCustomer.phone) {
        customerName = invoiceCustomer.name;
        customerPhone = invoiceCustomer.phone;
      } else if (invoiceCustomer.phone) {
        customerName = `Customer-${invoiceCustomer.phone}`;
        customerPhone = invoiceCustomer.phone;
      } else if (invoiceCustomer.name) {
        customerName = invoiceCustomer.name;
        customerPhone = `000-${Date.now()}`;
      } else {
        const timestamp = Date.now();
        customerName = `Walk-in-${timestamp}`;
        customerPhone = `000-${timestamp}`;
      }

      console.log('Customer details:', { customerName, customerPhone });

      // Create customer (optional)
      if (invoiceCustomer.name || invoiceCustomer.phone) {
        try {
          const customerResponse = await apiService.createCustomer({
            name: customerName,
            phone: customerPhone,
            email: "",
            address: "",
            branchId: user?.branchId || ""
          });

          if (customerResponse.success) {
            customerId = customerResponse.data.id;
            console.log('Customer created successfully:', customerId);
          }
        } catch (error) {
          console.error('Customer creation failed:', error);
          // Continue with sale even if customer creation fails
        }
      }

      // Calculate totals
      const subtotal = invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const discountAmount = (subtotal * discountPercentage) / 100;
      const totalAmount = subtotal - discountAmount;

      console.log('Calculated totals:', { subtotal, discountAmount, totalAmount });

      // Validate required fields
      let branchId: string | undefined;

      if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
        // Admin users use selected branch
        if (selectedBranchId) {
          branchId = selectedBranchId;
          console.log('Admin selected specific branch:', selectedBranch?.name);
        } else {
          toast({
            title: "Error",
            description: "Please select a branch from the admin dashboard first.",
            variant: "destructive",
          });
          return;
        }
      } else {
        // Regular users use their assigned branch
        branchId = user?.branchId;
        if (!branchId) {
          toast({
            title: "Error",
            description: "Branch ID is required. Please contact support.",
            variant: "destructive",
          });
          return;
        }
      }

      // Create sale - match API expected format
      const saleData = {
        items: invoiceItems.map(item => ({
          productId: item.id.split('-')[0],
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          batchId: item.batchId || undefined, // Use batchId if available
          batchNumber: item.batch || undefined, // Fallback to batchNumber
          expiryDate: item.expiry || undefined,
          discountPercentage: item.discountPercentage || undefined, // Item-level discount
          discountAmount: item.discountAmount || undefined, // Item-level discount amount
          totalPrice: item.totalPrice // Item total after discount (for verification)
        })),
        customerId: customerId || undefined, // API expects undefined, not null
        branchId: branchId,
        paymentMethod: paymentMethod.toUpperCase() as 'CASH' | 'CARD' | 'MOBILE' | 'BANK_TRANSFER',
        paymentStatus: paymentStatus.toUpperCase() as 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED',
        discountAmount: discountAmount, // Global discount amount
        discountPercentage: discountPercentage || 0, // Global discount percentage
        saleDate: new Date().toISOString()
      };

      console.log('Sale data:', saleData);

      const saleResponse = await apiService.createSale(saleData);
      console.log('Sale response:', saleResponse);

      if (!saleResponse.success) {
        console.error('Sale creation failed:', saleResponse);
        const errorMessage = saleResponse.errors ?
          saleResponse.errors.join(', ') :
          saleResponse.message || "Failed to create invoice. Please try again.";

        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      // Dispatch sale change event to notify inventory system
      window.dispatchEvent(new CustomEvent('saleChanged', {
        detail: {
          action: 'created',
          sale: saleResponse.data
        }
      }));

      // Create receipt data
      const receipt: Receipt = {
        id: saleResponse.data.id,
        receiptNumber: saleResponse.data.receiptNumber || `INV-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        cashier: user?.name || "Cashier",
        customer: invoiceCustomer.name || invoiceCustomer.phone ? {
          name: customerName,
          phone: customerPhone,
          email: "",
          address: ""
        } : undefined,
        items: invoiceItems,
        subtotal: subtotal,
        discountAmount: discountAmount,
        discountPercentage: discountPercentage,
        total: totalAmount,
        paymentMethod: paymentMethod.toUpperCase(),
        paymentStatus: paymentStatus === 'COMPLETED' ? 'Completed' : 'Pending'
      };

      // Set current receipt and show dialog
      setCurrentReceipt(receipt);
      setIsReceiptDialogOpen(true);

      // Success toast
      toast({
        title: "Invoice Created Successfully!",
        description: `Invoice #${receipt.receiptNumber} has been created.`,
        duration: 3000,
      });

      // Reset form but keep the screen open
      setInvoiceItems([]);
      setInvoiceCustomer({ name: "", phone: "" });
      setDiscountPercentage(0);
      setPaymentMethod('CASH');
      setPaymentStatus('COMPLETED');
      setSearchQuery("");

    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: `An error occurred while creating the invoice: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const printReceipt = () => {
    if (!currentReceipt) return;

    // Generate receipt HTML content
    const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Pharmacy Receipt - ${currentReceipt.receiptNumber}</title>
          <style>
          * { box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              line-height: 1.4;
              margin: 0;
              padding: 20px;
              background: white;
              color: black;
            width: 300px;
            }
            .receipt-header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .receipt-header h1 {
              margin: 0;
            font-size: 16px;
              font-weight: bold;
            }
            .receipt-header p {
              margin: 5px 0;
              font-size: 10px;
            }
            .receipt-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 15px;
            font-size: 10px;
            }
            .customer-info {
              margin-bottom: 15px;
            padding: 8px;
              background: #f5f5f5;
              border: 1px solid #ddd;
            font-size: 10px;
            }
            .customer-info h3 {
              margin: 0 0 5px 0;
            font-size: 11px;
            }
            .items {
              margin-bottom: 15px;
            }
            .items h3 {
              margin: 0 0 10px 0;
            font-size: 11px;
              border-bottom: 1px solid #000;
              padding-bottom: 5px;
            }
            .item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              padding: 5px 0;
              border-bottom: 1px dotted #ccc;
            }
            .item-name {
              font-weight: bold;
            font-size: 11px;
            }
            .item-details {
            font-size: 9px;
              color: #666;
              margin-top: 2px;
            }
            .item-price {
              text-align: right;
              font-weight: bold;
            font-size: 11px;
            }
            .totals {
              border-top: 2px solid #000;
              padding-top: 10px;
              margin-top: 15px;
            }
            .total-line {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            font-size: 11px;
            }
            .total-final {
              font-weight: bold;
              font-size: 14px;
              border-top: 1px solid #000;
              padding-top: 5px;
              margin-top: 10px;
            }
            .payment-info {
              margin-top: 15px;
            padding: 8px;
              background: #f0f0f0;
              border: 1px solid #ccc;
            font-size: 10px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
            font-size: 9px;
              color: #666;
            }
            @media print {
            body { margin: 0; padding: 10px; width: 100%; }
            @page { size: 80mm auto; margin: 0; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
          <h1>Zapeera Pharmacy</h1>
            <p>Your Health, Our Priority</p>
          </div>

          <div class="receipt-info">
            <div>
              <strong>Receipt:</strong> ${currentReceipt.receiptNumber}<br>
              <strong>Date:</strong> ${currentReceipt.date}
            </div>
            <div>
              <strong>Time:</strong> ${currentReceipt.time}<br>
              <strong>Cashier:</strong> ${currentReceipt.cashier}
            </div>
          </div>

          ${currentReceipt.customer ? `
          <div class="customer-info">
            <h3>Customer Information</h3>
            <strong>Name:</strong> ${currentReceipt.customer.name}<br>
            <strong>Phone:</strong> ${currentReceipt.customer.phone}<br>
            ${currentReceipt.customer.email ? `<strong>Email:</strong> ${currentReceipt.customer.email}<br>` : ''}
            ${currentReceipt.customer.address ? `<strong>Address:</strong> ${currentReceipt.customer.address}` : ''}
          </div>
          ` : ''}

          <div class="items">
            <h3>Items Purchased:</h3>
            ${currentReceipt.items.map(item => `
              <div class="item">
                <div>
                  <div class="item-name">${item.name}</div>
                  <div class="item-details">${item.quantity} ${item.unitType} × PKR ${item.unitPrice.toFixed(2)}</div>
                  ${item.instructions ? `<div class="item-details">${item.instructions}</div>` : ''}
                </div>
                <div class="item-price">PKR ${item.totalPrice.toFixed(2)}</div>
              </div>
            `).join('')}
          </div>

          <div class="totals">
            <div class="total-line">
              <span>Subtotal:</span>
              <span>PKR ${currentReceipt.subtotal.toFixed(2)}</span>
            </div>
            ${currentReceipt.discountPercentage && currentReceipt.discountPercentage > 0 ? `
            <div class="total-line" style="color: #16a34a;">
              <span>Discount (${currentReceipt.discountPercentage}%):</span>
              <span>-PKR ${currentReceipt.discountAmount?.toFixed(2) || '0.00'}</span>
            </div>
            ` : ''}
            <div class="total-line total-final">
              <span>TOTAL:</span>
              <span>PKR ${currentReceipt.total.toFixed(2)}</span>
            </div>
          </div>

          <div class="payment-info">
            <strong>Payment Method:</strong> ${currentReceipt.paymentMethod.toUpperCase()}<br>
            <strong>Status:</strong> ${currentReceipt.paymentStatus}
          </div>

          <div class="footer">
          <p>Thank you for choosing Zapeera!</p>
          <p>For any queries, contact us</p>
            <p>Your Health, Our Priority</p>
          </div>
        </body>
      </html>
    `;

    // Create a hidden iframe for printing (works in Electron)
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const frameDoc = printFrame.contentWindow?.document;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(receiptHTML);
      frameDoc.close();

      // Wait for content to load, then print
      printFrame.onload = () => {
      setTimeout(() => {
          try {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
          } catch (e) {
            console.error('Print error:', e);
            // Fallback: Try window.print() on the main window
            const newWindow = window.open('', '_blank');
            if (newWindow) {
              newWindow.document.write(receiptHTML);
              newWindow.document.close();
              setTimeout(() => {
                newWindow.print();
                newWindow.close();
      }, 500);
    }
          }
          // Clean up iframe after printing
          setTimeout(() => {
            document.body.removeChild(printFrame);
          }, 1000);
        }, 300);
      };
    }
  };

  const downloadReceipt = async () => {
    if (!currentReceipt) return;

    try {
      // Generate HTML content for the receipt
      const receiptHTML = generateReceiptHTML(currentReceipt);
      const filename = `receipt-${currentReceipt.receiptNumber}.html`;

      // Check if running in Electron
      if (window.electronAPI?.saveFile) {
        // Use Electron's save dialog
        const result = await window.electronAPI.saveFile({
          content: receiptHTML,
          filename: filename,
          type: 'html'
        });

        if (result.success) {
          toast({
            title: "Receipt Downloaded",
            description: `Receipt saved to: ${result.filePath}`,
          });
        } else if (!result.canceled) {
          throw new Error(result.error || 'Failed to save file');
        }
      } else {
        // Fallback for browser: Use blob download
      const blob = new Blob([receiptHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
        link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast({
        title: "Receipt Downloaded",
        description: "Receipt has been downloaded successfully!",
      });
      }
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast({
        title: "Error",
        description: "Error downloading receipt. Please try again.",
        variant: "destructive",
      });
    }
  };

  const generateReceiptHTML = (receipt: Receipt) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pharmacy Receipt - ${receipt.receiptNumber}</title>
        <style>
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
            margin: 0;
            padding: 20px;
            background: white;
            color: black;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .receipt-header h1 {
            margin: 0;
            font-size: 18px;
            font-weight: bold;
          }
          .receipt-header p {
            margin: 5px 0;
            font-size: 10px;
          }
          .receipt-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            font-size: 11px;
          }
          .customer-info {
            margin-bottom: 15px;
            padding: 10px;
            background: #f5f5f5;
            border: 1px solid #ddd;
          }
          .customer-info h3 {
            margin: 0 0 5px 0;
            font-size: 12px;
          }
          .items {
            margin-bottom: 15px;
          }
          .items h3 {
            margin: 0 0 10px 0;
            font-size: 12px;
            border-bottom: 1px solid #000;
            padding-bottom: 5px;
          }
          .item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            padding: 5px 0;
            border-bottom: 1px dotted #ccc;
          }
          .item-name {
            font-weight: bold;
            flex: 1;
          }
          .item-details {
            font-size: 10px;
            color: #666;
            margin-top: 2px;
          }
          .item-price {
            text-align: right;
            font-weight: bold;
          }
          .totals {
            border-top: 2px solid #000;
            padding-top: 10px;
            margin-top: 15px;
          }
          .total-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          .total-final {
            font-weight: bold;
            font-size: 14px;
            border-top: 1px solid #000;
            padding-top: 5px;
            margin-top: 10px;
          }
          .payment-info {
            margin-top: 15px;
            padding: 10px;
            background: #f0f0f0;
            border: 1px solid #ccc;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 10px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="receipt-header">
          <h1>Zapeera Pharmacy</h1>
          <p>Your Health, Our Priority</p>
        </div>

        <div class="receipt-info">
          <div>
            <strong>Receipt:</strong> ${receipt.receiptNumber}<br>
            <strong>Date:</strong> ${receipt.date}
          </div>
          <div>
            <strong>Time:</strong> ${receipt.time}<br>
            <strong>Cashier:</strong> ${receipt.cashier}
          </div>
        </div>

        ${receipt.customer ? `
        <div class="customer-info">
          <h3>Customer Information</h3>
          <strong>Name:</strong> ${receipt.customer.name}<br>
          <strong>Phone:</strong> ${receipt.customer.phone}<br>
          ${receipt.customer.email ? `<strong>Email:</strong> ${receipt.customer.email}<br>` : ''}
          ${receipt.customer.address ? `<strong>Address:</strong> ${receipt.customer.address}` : ''}
        </div>
        ` : ''}

        <div class="items">
          <h3>Items Purchased:</h3>
          ${receipt.items.map(item => `
            <div class="item">
              <div>
                <div class="item-name">${item.name}</div>
                <div class="item-details">${item.quantity} ${item.unitType} × PKR ${item.unitPrice.toFixed(2)}</div>
                ${item.instructions ? `<div class="item-details">${item.instructions}</div>` : ''}
              </div>
              <div class="item-price">PKR ${item.totalPrice.toFixed(2)}</div>
            </div>
          `).join('')}
        </div>

        <div class="totals">
          <div class="total-line">
            <span>Subtotal:</span>
            <span>PKR ${receipt.subtotal.toFixed(2)}</span>
          </div>
          ${receipt.discountPercentage && receipt.discountPercentage > 0 ? `
          <div class="total-line" style="color: #16a34a;">
            <span>Discount (${receipt.discountPercentage}%):</span>
            <span>-PKR ${receipt.discountAmount?.toFixed(2) || '0.00'}</span>
          </div>
          ` : ''}
          <div class="total-line total-final">
            <span>TOTAL:</span>
            <span>PKR ${receipt.total.toFixed(2)}</span>
          </div>
        </div>

        <div class="payment-info">
          <strong>Payment Method:</strong> ${receipt.paymentMethod.toUpperCase()}<br>
          <strong>Status:</strong> ${receipt.paymentStatus}
        </div>

        <div class="footer">
          <p>Thank you for choosing Zapeera Pharmacy!</p>
          <p>For any queries, contact us at: +92-XXX-XXXXXXX</p>
          <p>Your Health, Our Priority</p>
        </div>
      </body>
      </html>
    `;
  };

  // Invoice lookup functionality
  const lookupInvoice = async () => {
    if (!refundReceiptNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a receipt number",
        variant: "destructive",
      });
      return;
    }

    try {
      setInvoiceLookupLoading(true);

      // Make API call to get sales data
      const response = await apiService.getSales({
        limit: 1000,
        startDate: undefined,
        endDate: undefined,
        branchId: undefined
      });

      if (response.success && response.data?.sales) {
        // Find invoice by receipt number
        const foundInvoice = response.data.sales.find((sale: any) =>
          sale.receipts?.some((receipt: any) =>
            receipt.receiptNumber.toLowerCase() === refundReceiptNumber.toLowerCase()
          )
        );

        if (foundInvoice) {
          // Transform the sale data to match the expected format
          const transformedInvoice = {
            id: foundInvoice.id,
            invoiceNumber: foundInvoice.id,
            customerId: foundInvoice.customerId,
            userId: foundInvoice.userId,
            branchId: foundInvoice.branchId,
            subtotal: foundInvoice.subtotal,
            taxAmount: foundInvoice.taxAmount,
            discountAmount: foundInvoice.discountAmount,
            totalAmount: foundInvoice.totalAmount,
            paymentMethod: foundInvoice.paymentMethod,
            paymentStatus: foundInvoice.paymentStatus,
            status: foundInvoice.status,
            createdAt: foundInvoice.createdAt,
            updatedAt: foundInvoice.createdAt,
            customer: foundInvoice.customer,
            user: foundInvoice.user,
            branch: foundInvoice.branch,
            items: foundInvoice.items.map((item: any) => ({
              id: item.id,
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              product: item.product
            })),
            receipts: [],
            receiptNumber: foundInvoice.id
          };

          setFoundInvoice(transformedInvoice);
        } else {
          toast({
            title: "Invoice Not Found",
            description: `Invoice with receipt number "${refundReceiptNumber}" not found.`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to load invoices. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error looking up invoice:', error);
      toast({
        title: "Error",
        description: 'Error looking up invoice. Please try again.',
        variant: "destructive",
      });
    } finally {
      setInvoiceLookupLoading(false);
    }
  };

  // Refund and return functionality
  const processRefund = async () => {
    if (!refundReceiptNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter a receipt number",
        variant: "destructive",
      });
      return;
    }

    if (!refundReason.trim()) {
      toast({
        title: "Error",
        description: "Please enter a refund reason",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('🔍 DEBUG - Starting refund process for receipt:', refundReceiptNumber);

      // Find the original sale by receipt number
      const salesResponse = await apiService.getSales({
        limit: 1000
      });

      console.log('🔍 DEBUG - Sales search response:', salesResponse);

      if (!salesResponse.success || !salesResponse.data?.sales?.length) {
        toast({
          title: "Error",
          description: "Sale not found with the given receipt number",
          variant: "destructive",
        });
        return;
      }

      // Find the specific sale by receipt number
      const sales = salesResponse.data.sales;
      const originalSale = sales.find((sale: any) =>
        sale.receipts?.some((receipt: any) =>
          receipt.receiptNumber === refundReceiptNumber
        )
      );

      if (!originalSale) {
        toast({
          title: "Error",
          description: `Receipt number ${refundReceiptNumber} not found`,
          variant: "destructive",
        });
        return;
      }

      console.log('🔍 DEBUG - Found original sale:', originalSale);

      // Automatically use all items from the original sale for refund
      const itemsToRefund = originalSale.items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        reason: refundReason || "Customer requested refund",
        batchId: item.batchId || null, // Include batch ID for stock return
        saleItemId: item.id || null
      }));

      const totalRefundAmount = originalSale.totalAmount;

      // Prepare refund data
      const refundData = {
        originalSaleId: originalSale.id,
        refundReason: refundReason || "Customer requested refund",
        items: itemsToRefund,
        refundedBy: user?.id || ""
      };

      console.log('🔍 DEBUG - Prepared refund data:', refundData);

      // Call the refund API
      const refundResponse = await apiService.createRefund(refundData);

      console.log('🔍 DEBUG - Refund API response:', refundResponse);

      if (refundResponse.success) {
        toast({
          title: "Refund Processed Successfully",
          description: `Receipt Number: ${refundReceiptNumber}\nRefund Amount: PKR ${totalRefundAmount.toFixed(2)}\nReason: ${refundReason}\n\nStock has been updated and items are back in inventory.`,
        });

        // Reset refund form
        setRefundReceiptNumber("");
        setRefundReason("");
        setFoundInvoice(null);
        setIsRefundDialogOpen(false);

        // Refresh products to show updated stock
        loadProducts();

        // Trigger refresh of refunds list by dispatching a custom event
        window.dispatchEvent(new CustomEvent('refundCreated', {
          detail: { refund: refundResponse.data.refund }
        }));
      } else {
        toast({
          title: "Error",
          description: refundResponse.message || "Failed to process refund. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      toast({
        title: "Error",
        description: 'Error processing refund. Please try again.',
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
            <div className="flex items-center space-x-3">
              <Receipt className="w-6 h-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Create Invoice</h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setIsRefundDialogOpen(true)}
              variant="outline"
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              Refunds & Returns
            </Button>
            <div className="text-sm text-gray-600">
              Items: {invoiceItems.length} | Total: PKR {invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}
            </div>
            {invoiceItems.length === 0 && (
              <div className="text-sm text-green-600 font-medium">
                Ready to create new invoice
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side: Search & Customer Details */}
          <div className="space-y-6">
            {/* Product Search Section */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Search & Add Products</h3>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by medicine name, formula, or barcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 text-base"
                  />
                </div>

                {/* Products List */}
                <div className="space-y-2 max-h-80 overflow-y-auto border rounded-lg p-4 bg-gray-50">
                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p>Loading products...</p>
                    </div>
                  ) : searchQuery.trim() && Array.isArray(filteredProducts) && filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => {
                      const batches = productBatches[product.id] || [];
                      const selectedBatch = getSelectedBatch(product.id);
                      const isLoadingBatch = loadingBatches[product.id];

                      return (
                      <div key={product.id} className="p-3 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div className="space-y-3">
                          {/* Product Info Row */}
                          <div className="flex items-center space-x-3">
                            {/* Product Info */}
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              {getUnitIcon(product.unitType)}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-sm truncate">{product.name}</h4>
                                <span className="text-xs text-muted-foreground">
                                  {product.unitType} • Stock: {product.stock}
                                </span>
                              </div>
                            </div>

                            {/* Price */}
                            <span className="text-sm font-bold text-primary whitespace-nowrap">
                              PKR {selectedBatch?.sellingPrice || product.price}
                            </span>
                          </div>

                          {/* Quantity Input and Action Buttons */}
                          <div className="flex items-center space-x-2">
                            <Input
                              type="number"
                              min="0"
                              max={selectedBatch?.quantity || 1000}
                              placeholder="Qty"
                              className="w-16 h-8 text-sm text-center"
                              id={`invoice-pack-${product.id}`}
                            />

                            {/* Action Buttons */}
                            <div className="flex space-x-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="px-2 h-8 text-xs"
                                onClick={() => {
                                  const input = document.getElementById(`invoice-pack-${product.id}`) as HTMLInputElement;
                                  const quantity = parseInt(input.value) || 0;
                                  if (quantity > 0) {
                                    addToInvoiceCart(product, quantity, "pack");
                                    input.value = "";
                                  }
                                }}
                                disabled={!selectedBatch || batches.length === 0}
                              >
                                <Package className="w-3 h-3 mr-1" />
                                Pack
                              </Button>
                              <Button
                                size="sm"
                                className="px-2 h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                                onClick={() => {
                                  const input = document.getElementById(`invoice-pack-${product.id}`) as HTMLInputElement;
                                  const quantity = parseInt(input.value) || 0;
                                  if (quantity > 0) {
                                    addToInvoiceCart(product, quantity, product.unitType);
                                    input.value = "";
                                  }
                                }}
                                disabled={!selectedBatch || batches.length === 0}
                              >
                                {getUnitIcon(product.unitType)}
                                <span className="ml-1">Add</span>
                              </Button>
                            </div>
                          </div>

                          {/* Batch Selection Table */}
                          {isLoadingBatch ? (
                            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                              <span>Loading batches...</span>
                            </div>
                          ) : batches.length > 0 ? (
                            <div className="space-y-2">
                              <Label className="text-xs font-medium">Select Batch:</Label>
                              <div className="border rounded-lg overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-50">
                                      <TableHead className="w-12"></TableHead>
                                      <TableHead className="text-xs">Batch No.</TableHead>
                                      <TableHead className="text-xs">Quantity</TableHead>
                                      <TableHead className="text-xs">Expiry Date</TableHead>
                                      <TableHead className="text-xs">Days Left</TableHead>
                                      <TableHead className="text-xs text-right">Price</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {batches.map((batch) => {
                                      const expiryDate = batch.expireDate
                                        ? new Date(batch.expireDate).toLocaleDateString()
                                        : "No expiry";
                                      const statusColor = batch.expiryStatus === 'CRITICAL' ? 'text-red-600 font-semibold' :
                                                         batch.expiryStatus === 'WARNING' ? 'text-orange-600' :
                                                         batch.expiryStatus === 'EXPIRED' ? 'text-gray-400' :
                                                         'text-green-600';
                                      const isSelected = selectedBatches[product.id] === batch.id;
                                      const isLowStock = batch.quantity <= 10;

                                      return (
                                        <TableRow
                                          key={batch.id}
                                          className={`cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}
                                          onClick={() => {
                                            setSelectedBatches(prev => ({ ...prev, [product.id]: batch.id }));
                                          }}
                                        >
                                          <TableCell className="w-12">
                                            <Checkbox
                                              checked={isSelected}
                                              onCheckedChange={() => {
                                                setSelectedBatches(prev => ({ ...prev, [product.id]: batch.id }));
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </TableCell>
                                          <TableCell className="font-medium text-xs">
                                            {batch.batchNo}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            <span className={isLowStock ? 'text-orange-600 font-medium' : ''}>
                                              {batch.quantity}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {expiryDate}
                                          </TableCell>
                                          <TableCell>
                                            {batch.daysUntilExpiry !== undefined && batch.daysUntilExpiry > 0 ? (
                                              <span className={`text-xs ${statusColor}`}>
                                                {batch.daysUntilExpiry} days
                                              </span>
                                            ) : batch.expireDate ? (
                                              <span className="text-xs text-red-600">Expired</span>
                                            ) : (
                                              <span className="text-xs text-gray-400">-</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs text-right font-medium">
                                            PKR {batch.sellingPrice.toFixed(2)}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              No batches available
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                  ) : searchQuery.trim() ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No products found</p>
                      <p className="text-xs">Try a different search term</p>
                    </div>
                  ) : !searchQuery.trim() ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Start typing to search for medicines</p>
                      <p className="text-xs">Search by name, barcode, or SKU</p>
                      {products.length > 0 && (
                        <p className="text-xs mt-2 text-blue-600">
                          {products.length} products available in inventory
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No products found</p>
                      <p className="text-xs">Try a different search term</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customer Details Section */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Customer Details (Optional)</h3>
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      placeholder="Enter customer name (optional)"
                      value={invoiceCustomer.name}
                      onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">Phone Number</Label>
                    <Input
                      id="customerPhone"
                      placeholder="Enter phone number (optional)"
                      value={invoiceCustomer.phone}
                      onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, phone: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Side: Selected Items & Totals */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">Selected Items</h3>

                {/* Selected Items List */}
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {invoiceItems.map((item) => {
                    const itemSubtotal = item.unitPrice * item.quantity;
                    const itemDiscount = item.discountPercentage || 0;
                    const itemDiscountAmount = item.discountAmount || 0;
                    const displayPrice = item.totalPrice;

                    return (
                    <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{item.name}</h4>
                          <div className="flex items-center space-x-2 mt-1">
                            {getUnitIcon(item.unitType)}
                            <span className="text-xs text-muted-foreground">
                              {item.quantity} {item.unitType} • PKR {item.unitPrice.toFixed(2)} each
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Batch: {item.batch} • Exp: {item.expiry}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateInvoiceQuantity(item.id, 0)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateInvoiceQuantity(item.id, item.quantity - 1)}
                            className="w-8 h-8 p-0"
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center font-medium">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateInvoiceQuantity(item.id, item.quantity + 1)}
                            className="w-8 h-8 p-0"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="text-right">
                          {itemDiscount > 0 ? (
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground line-through">PKR {itemSubtotal.toFixed(2)}</p>
                              <p className="font-semibold text-primary">PKR {displayPrice.toFixed(2)}</p>
                              <p className="text-xs text-green-600">-{itemDiscount}%</p>
                            </div>
                          ) : (
                            <p className="font-semibold text-primary">PKR {displayPrice.toFixed(2)}</p>
                          )}
                        </div>
                      </div>

                      {/* Item Discount Input */}
                      <div className="flex items-center space-x-2 pt-2 border-t border-gray-200">
                        <Label htmlFor={`discount-${item.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                          Discount:
                        </Label>
                        <Input
                          id={`discount-${item.id}`}
                          type="number"
                          min="0"
                          max="100"
                          placeholder="0"
                          value={itemDiscount || ''}
                          onChange={(e) => {
                            const discount = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                            updateItemDiscount(item.id, discount);
                          }}
                          className="w-20 h-7 text-xs text-center"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        {itemDiscount > 0 && (
                          <span className="text-xs text-green-600 font-medium">
                            -PKR {itemDiscountAmount.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>
                  )})}

                  {invoiceItems.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No items selected</p>
                      <p className="text-xs">Search and add medicines to create invoice</p>
                    </div>
                  )}
                </div>

                {/* Discount Section */}
                {invoiceItems.length > 0 && (
                  <div className="space-y-3 border-t pt-4 mt-4">
                    <h4 className="font-medium text-sm">Discount</h4>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="0"
                        value={discountPercentage || ''}
                        onChange={(e) => setDiscountPercentage(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                        className="flex-1"
                      />
                      <span className="text-sm font-medium">%</span>
                    </div>
                  </div>
                )}

                {/* Totals */}
                {invoiceItems.length > 0 && (
                  <div className="space-y-2 border-t pt-4 mt-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal (after item discounts)</span>
                      <span className="font-medium">PKR {invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}</span>
                    </div>
                    {discountPercentage > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Global Discount ({discountPercentage}%)</span>
                        <span className="font-medium text-green-600">-PKR {((invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0) * discountPercentage) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total</span>
                      <span className="text-primary">PKR {(invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0) * (1 - discountPercentage / 100)).toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Payment Method & Status Selection */}
                {invoiceItems.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Payment Method */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Payment Method</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={paymentMethod === 'CASH' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPaymentMethod('CASH')}
                            className={paymentMethod === 'CASH' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                          >
                            Cash
                          </Button>
                          <Button
                            type="button"
                            variant={paymentMethod === 'CARD' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPaymentMethod('CARD')}
                            className={paymentMethod === 'CARD' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                          >
                            Card
                          </Button>
                          <Button
                            type="button"
                            variant={paymentMethod === 'MOBILE' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPaymentMethod('MOBILE')}
                            className={paymentMethod === 'MOBILE' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                          >
                            Mobile
                          </Button>
                          <Button
                            type="button"
                            variant={paymentMethod === 'BANK_TRANSFER' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPaymentMethod('BANK_TRANSFER')}
                            className={paymentMethod === 'BANK_TRANSFER' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                          >
                            Bank
                          </Button>
                        </div>
                      </div>

                      {/* Payment Status */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Payment Status</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={paymentStatus === 'COMPLETED' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPaymentStatus('COMPLETED')}
                            className={paymentStatus === 'COMPLETED' ? 'bg-green-600 hover:bg-green-700' : ''}
                          >
                            Paid
                          </Button>
                          <Button
                            type="button"
                            variant={paymentStatus === 'PENDING' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPaymentStatus('PENDING')}
                            className={paymentStatus === 'PENDING' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                          >
                            Unpaid
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-6 border-t mt-6">
                  <Button
                    variant="outline"
                    onClick={() => navigate('/pos')}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createInvoice}
                    disabled={invoiceItems.length === 0 || isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isLoading ? (
                      "Creating..."
                    ) : (
                      <>
                        <Receipt className="w-4 h-4 mr-2" />
                        Create Invoice
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Receipt Dialog */}
      <Dialog open={isReceiptDialogOpen} onOpenChange={setIsReceiptDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Pharmacy Receipt</span>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={printReceipt}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
                <Button variant="outline" size="sm" onClick={downloadReceipt}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                {currentReceipt?.customer?.phone && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const smsUrl = `sms:${currentReceipt.customer.phone}?body=${encodeURIComponent(`Zapeera Pharmacy Receipt\nReceipt: ${currentReceipt.receiptNumber}\nTotal: PKR ${currentReceipt.total.toFixed(2)}\nDate: ${currentReceipt.date} ${currentReceipt.time}\n\nThank you for choosing us!`)}`;
                    window.location.href = smsUrl;
                  }}>
                    <Phone className="w-4 h-4 mr-2" />
                    SMS
                  </Button>
                )}
                {currentReceipt?.customer?.email && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const emailSubject = `Receipt from Zapeera Pharmacy - ${currentReceipt.receiptNumber}`;
                    const emailBody = `Dear ${currentReceipt.customer.name},\n\nThank you for your purchase at Zapeera Pharmacy!\n\nReceipt Details:\n- Receipt Number: ${currentReceipt.receiptNumber}\n- Date: ${currentReceipt.date}\n- Time: ${currentReceipt.time}\n- Total: PKR ${currentReceipt.total.toFixed(2)}\n\nThank you for choosing us!`;
                    const emailUrl = `mailto:${currentReceipt.customer.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
                    window.location.href = emailUrl;
                  }}>
                    <Mail className="w-4 h-4 mr-2" />
                    Email
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {currentReceipt && (
            <div className="space-y-6 print:p-6">
              {/* Receipt Number - Clickable to Copy */}
              <div
                className="text-center bg-gray-100 p-3 rounded-lg cursor-pointer hover:bg-gray-200 transition-colors group"
                onClick={() => {
                  navigator.clipboard.writeText(currentReceipt.receiptNumber);
                  toast({
                    title: "Copied!",
                    description: `Receipt number ${currentReceipt.receiptNumber} copied to clipboard`,
                  });
                }}
              >
                <p className="text-xs text-gray-500 mb-1">Click to copy receipt number</p>
                <p className="text-xl font-bold text-gray-900 font-mono group-hover:text-blue-600">
                  {currentReceipt.receiptNumber}
                </p>
              </div>

              {/* Receipt Header */}
              <div className="text-center border-b pb-4">
                <h1 className="text-2xl font-bold text-gray-900">Zapeera Pharmacy</h1>
                <p className="text-sm text-gray-600">Your Health, Our Priority</p>
              </div>

              {/* Receipt Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Date:</strong> {currentReceipt.date}</p>
                </div>
                <div>
                  <p><strong>Time:</strong> {currentReceipt.time}</p>
                  <p><strong>Cashier:</strong> {currentReceipt.cashier}</p>
                </div>
              </div>

              {/* Customer Info */}
              {currentReceipt.customer && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <p><strong>Name:</strong> {currentReceipt.customer.name}</p>
                  <p><strong>Phone:</strong> {currentReceipt.customer.phone}</p>
                  {currentReceipt.customer.email && <p><strong>Email:</strong> {currentReceipt.customer.email}</p>}
                  {currentReceipt.customer.address && <p><strong>Address:</strong> {currentReceipt.customer.address}</p>}
                </div>
              )}

              {/* Items */}
              <div>
                <h3 className="font-semibold mb-3 border-b pb-2">Items Purchased:</h3>
                <div className="space-y-2">
                  {currentReceipt.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-start py-2 border-b border-gray-100">
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          {item.quantity} {item.unitType} × PKR {item.unitPrice.toFixed(2)}
                        </p>
                        {item.instructions && (
                          <p className="text-xs text-gray-500 mt-1">{item.instructions}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">PKR {item.totalPrice.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>PKR {currentReceipt.subtotal.toFixed(2)}</span>
                  </div>
                  {currentReceipt.discountPercentage && currentReceipt.discountPercentage > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({currentReceipt.discountPercentage}%):</span>
                      <span>-PKR {currentReceipt.discountAmount?.toFixed(2) || '0.00'}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>TOTAL:</span>
                    <span>PKR {currentReceipt.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Payment Method:</strong> {currentReceipt.paymentMethod.toUpperCase()}</p>
                <p><strong>Status:</strong> {currentReceipt.paymentStatus}</p>
              </div>

              {/* Footer */}
              <div className="text-center text-sm text-gray-600 border-t pt-4">
                <p>Thank you for choosing Zapeera Pharmacy!</p>
                <p>For any queries, contact us at: +92-XXX-XXXXXXX</p>
                <p>Your Health, Our Priority</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refunds & Returns Dialog */}
      <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span>Refunds & Returns</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Invoice Lookup Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Invoice Lookup</h3>
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter invoice/receipt number"
                  value={refundReceiptNumber}
                  onChange={(e) => setRefundReceiptNumber(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={lookupInvoice}
                  variant="outline"
                  disabled={invoiceLookupLoading}
                >
                  {invoiceLookupLoading ? 'Loading...' : 'Show Invoice'}
                </Button>
              </div>
            </div>

            {/* Found Invoice Display */}
            {foundInvoice && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Found Invoice</h3>
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Invoice Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-semibold text-lg">Receipt: {foundInvoice.receipts[0]?.receiptNumber || 'N/A'}</h4>
                          <p className="text-sm text-muted-foreground">
                            Date: {new Date(foundInvoice.createdAt).toLocaleDateString()} {new Date(foundInvoice.createdAt).toLocaleTimeString()}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Cashier: {foundInvoice.user.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">
                            PKR {foundInvoice.totalAmount.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {foundInvoice.paymentMethod} • {foundInvoice.paymentStatus}
                          </p>
                        </div>
                      </div>

                      {/* Customer Info */}
                      {foundInvoice.customer && (
                        <div className="border-t pt-3">
                          <h5 className="font-medium text-sm mb-2">Customer Information</h5>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <p><strong>Name:</strong> {foundInvoice.customer.name}</p>
                            <p><strong>Phone:</strong> {foundInvoice.customer.phone}</p>
                            {foundInvoice.customer.email && (
                              <p><strong>Email:</strong> {foundInvoice.customer.email}</p>
                            )}
                            {foundInvoice.customer.address && (
                              <p><strong>Address:</strong> {foundInvoice.customer.address}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Items List */}
                      <div className="border-t pt-3">
                        <h5 className="font-medium text-sm mb-2">Items in Invoice</h5>
                        <div className="space-y-2">
                          {foundInvoice.items.map((item: any, index: number) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-white rounded border">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{item.product.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.quantity} {item.product.unitType} × PKR {item.unitPrice.toFixed(2)}
                                  {item.batchNumber && ` • Batch: ${item.batchNumber}`}
                                  {item.expiryDate && ` • Exp: ${new Date(item.expiryDate).toLocaleDateString()}`}
                                </p>
                              </div>
                              <p className="font-semibold text-sm">PKR {item.totalPrice.toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Invoice Summary */}
                      <div className="border-t pt-3">
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>PKR {foundInvoice.subtotal.toFixed(2)}</span>
                          </div>
                          {foundInvoice.discountAmount > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span>Discount:</span>
                              <span>-PKR {foundInvoice.discountAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-lg border-t pt-1">
                            <span>Total:</span>
                            <span>PKR {foundInvoice.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="border-t pt-3">
                        <Button
                          onClick={processRefund}
                          className="w-full text-white bg-red-600 hover:bg-red-700"
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Process Full Refund & Return Items to Stock
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Refund Reason */}
            {foundInvoice && (
              <div className="space-y-2">
                <Label htmlFor="refundReason">Refund Reason *</Label>
                <Input
                  id="refundReason"
                  placeholder="Enter reason for refund"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsRefundDialogOpen(false);
                  setRefundReceiptNumber("");
                  setRefundReason("");
                  setFoundInvoice(null);
                }}
              >
                Cancel
              </Button>
              {foundInvoice && (
                <Button
                  onClick={processRefund}
                  className="text-white bg-red-600 hover:bg-red-700"
                  disabled={!refundReason.trim()}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Process Refund
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreateInvoice;
