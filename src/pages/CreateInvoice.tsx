import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  AlertCircle
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
  instructions?: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<Receipt | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundReceiptNumber, setRefundReceiptNumber] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [foundInvoice, setFoundInvoice] = useState<any>(null);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);

  // Load products on component mount
  useEffect(() => {
    loadProducts();
  }, []);

  // Filter products based on search query
  useEffect(() => {
    console.log('Search query changed:', searchQuery);
    console.log('Products available:', products.length);

    if (searchQuery.trim() && Array.isArray(products)) {
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      console.log('Filtered products:', filtered.length, 'matches for:', searchQuery);
      setFilteredProducts(filtered);
    } else {
      setFilteredProducts([]);
    }
  }, [searchQuery, products]);

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
          expiry: product.currentBatch?.expireDate ? new Date(product.currentBatch.expireDate).toLocaleDateString() : 'Dec 2025'
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
    const existingItem = invoiceItems.find(item =>
      item.name === product.name && item.unitType === unitType
    );

    if (existingItem) {
      updateInvoiceQuantity(existingItem.id, existingItem.quantity + quantity);
    } else {
      const newItem: CartItem = {
        id: `${product.id}-${unitType}-${Date.now()}`,
        name: product.name,
        quantity,
        unitPrice: product.price,
        totalPrice: product.price * quantity,
        unitType,
        batch: product.batch || "BATCH001",
        expiry: product.expiry || null,
        instructions: unitType === "pack" ? "Take as directed" : `Take ${quantity} ${unitType} as directed`
      };
      setInvoiceItems([...invoiceItems, newItem]);
    }
  };

  const updateInvoiceQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setInvoiceItems(invoiceItems.filter(item => item.id !== itemId));
    } else {
      setInvoiceItems(invoiceItems.map(item =>
        item.id === itemId
          ? { ...item, quantity: newQuantity, totalPrice: item.unitPrice * newQuantity }
          : item
      ));
    }
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
          batchNumber: item.batch,
          expiryDate: item.expiry
        })),
        customerId: customerId || undefined, // API expects undefined, not null
        branchId: branchId,
        paymentMethod: 'CASH' as const, // API expects uppercase
        discountAmount: discountAmount,
        discountPercentage: discountPercentage || 0,
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
        paymentMethod: 'CASH',
        paymentStatus: 'Completed'
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

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Pharmacy Receipt - ${currentReceipt.receiptNumber}</title>
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
            @media print {
              body { margin: 0; padding: 10px; }
              .receipt-header { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <h1>MediBill Pulse Pharmacy</h1>
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
            <p>Thank you for choosing MediBill Pulse Pharmacy!</p>
            <p>For any queries, contact us at: +92-XXX-XXXXXXX</p>
            <p>Your Health, Our Priority</p>
          </div>
        </body>
      </html>
      `);

      printWindow.document.close();

      // Wait for content to load, then print
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const downloadReceipt = () => {
    if (!currentReceipt) return;

    try {
      // Generate HTML content for the receipt
      const receiptHTML = generateReceiptHTML(currentReceipt);

      // Create a blob with the HTML content
      const blob = new Blob([receiptHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // Create a temporary link element and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `receipt-${currentReceipt.receiptNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object
      URL.revokeObjectURL(url);

      toast({
        title: "Receipt Downloaded",
        description: "Receipt has been downloaded successfully!",
      });
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
          <h1>MediBill Pulse Pharmacy</h1>
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
          <p>Thank you for choosing MediBill Pulse Pharmacy!</p>
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
        reason: refundReason || "Customer requested refund"
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
                    placeholder="Search by medicine name, barcode, or SKU..."
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
                    filteredProducts.map((product) => (
                      <div key={product.id} className="p-3 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
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
                            PKR {product.price}
                          </span>

                          {/* Quantity Input */}
                          <Input
                            type="number"
                            min="0"
                            max="1000"
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
                            >
                              {getUnitIcon(product.unitType)}
                              <span className="ml-1">Add</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
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
                  {invoiceItems.map((item) => (
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

                      <div className="flex items-center justify-between">
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
                          <p className="font-semibold text-primary">PKR {item.totalPrice.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))}

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
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">PKR {invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}</span>
                    </div>
                    {discountPercentage > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount ({discountPercentage}%)</span>
                        <span className="font-medium text-green-600">-PKR {((invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0) * discountPercentage) / 100).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>Total</span>
                      <span className="text-primary">PKR {(invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0) * (1 - discountPercentage / 100)).toFixed(2)}</span>
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
                    const smsUrl = `sms:${currentReceipt.customer.phone}?body=${encodeURIComponent(`MediBill Pulse Pharmacy Receipt\nReceipt: ${currentReceipt.receiptNumber}\nTotal: PKR ${currentReceipt.total.toFixed(2)}\nDate: ${currentReceipt.date} ${currentReceipt.time}\n\nThank you for choosing us!`)}`;
                    window.location.href = smsUrl;
                  }}>
                    <Phone className="w-4 h-4 mr-2" />
                    SMS
                  </Button>
                )}
                {currentReceipt?.customer?.email && (
                  <Button variant="outline" size="sm" onClick={() => {
                    const emailSubject = `Receipt from MediBill Pulse Pharmacy - ${currentReceipt.receiptNumber}`;
                    const emailBody = `Dear ${currentReceipt.customer.name},\n\nThank you for your purchase at MediBill Pulse Pharmacy!\n\nReceipt Details:\n- Receipt Number: ${currentReceipt.receiptNumber}\n- Date: ${currentReceipt.date}\n- Time: ${currentReceipt.time}\n- Total: PKR ${currentReceipt.total.toFixed(2)}\n\nThank you for choosing us!`;
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
              {/* Receipt Header */}
              <div className="text-center border-b pb-4">
                <h1 className="text-2xl font-bold text-gray-900">MediBill Pulse Pharmacy</h1>
                <p className="text-sm text-gray-600">Your Health, Our Priority</p>
              </div>

              {/* Receipt Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Receipt:</strong> {currentReceipt.receiptNumber}</p>
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
                <p>Thank you for choosing MediBill Pulse Pharmacy!</p>
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
