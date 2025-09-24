import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ShoppingCart,
  Search,
  Scan,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  Smartphone,
  Receipt,
  Pill,
  Package,
  Droplets,
  Syringe,
  X,
  Printer,
  Download,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import React from "react"; // Added missing import
import { apiService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmin } from "@/contexts/AdminContext";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  unitType: string;
  unitPrice: number;
  totalPrice: number;
  batch: string;
  expiry: string;
  instructions?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  unitType: string;
  category: string;
  requiresPrescription: boolean;
  barcode?: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  lastVisit?: string;
  loyaltyPoints: number;
  isVIP: boolean;
}

interface Promotion {
  id: string;
  code: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  minAmount?: number;
  maxDiscount?: number;
  validUntil?: string;
  isActive: boolean;
}

interface SplitPayment {
  id: string;
  method: 'cash' | 'card' | 'mobile' | 'gift_card';
  amount: number;
  reference?: string;
}

interface RefundItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  reason: string;
}

interface GiftCard {
  id: string;
  number: string;
  balance: number;
  isActive: boolean;
  expiryDate?: string;
}

interface Receipt {
  id: string;
  customer: Customer | null;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  date: string;
  time: string;
  cashier: string;
  receiptNumber: string;
}

const POSInterface = () => {
  const { user } = useAuth();
  const { selectedBranchId, selectedBranch, allBranches } = useAdmin();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isReceiptDialogOpen, setIsReceiptDialogOpen] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<Receipt | null>(null);
  const [saleBranchId, setSaleBranchId] = useState<string | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [changeAmount, setChangeAmount] = useState(0);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'processing' | 'completed' | 'failed'>('pending');
  const [isNewCustomerDialogOpen, setIsNewCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: ""
  });
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoiceCustomer, setInvoiceCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: ""
  });
  const [invoiceItems, setInvoiceItems] = useState<CartItem[]>([]);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [appliedPromotions, setAppliedPromotions] = useState<Promotion[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [splitPayments, setSplitPayments] = useState<SplitPayment[]>([]);
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [refundReceiptNumber, setRefundReceiptNumber] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundItems, setRefundItems] = useState<RefundItem[]>([]);
  const [giftCardNumber, setGiftCardNumber] = useState("");
  const [giftCardBalance, setGiftCardBalance] = useState(0);
  const [giftCardAmount, setGiftCardAmount] = useState(0);
  const [foundInvoice, setFoundInvoice] = useState<any>(null);
  const [invoiceLookupLoading, setInvoiceLookupLoading] = useState(false);
  const [isRefundSearchOpen, setIsRefundSearchOpen] = useState(false);

  // Load selected customer from localStorage if coming from Customer Management
  React.useEffect(() => {
    const savedCustomer = localStorage.getItem('selectedCustomer');
    if (savedCustomer) {
      try {
        const customer = JSON.parse(savedCustomer);
        setSelectedCustomer(customer);
        localStorage.removeItem('selectedCustomer'); // Clear after loading
      } catch (error) {
        console.error('Error loading customer:', error);
      }
    }
  }, []);

  // Load products from API
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['all', 'General Medicine']);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    console.log('🔄 POS useEffect triggered');
    console.log('🔄 User in useEffect:', user);

    // Load products immediately with token from localStorage
    const loadProductsImmediately = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          console.log('🔄 Token found, loading products immediately');

          // Determine which branch to load products from
          let branchId: string | undefined;

          if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
            // Admin users can see products from selected branch or all branches
            if (selectedBranchId) {
              branchId = selectedBranchId;
              console.log('🔄 Admin selected specific branch (immediate):', selectedBranch?.name);
            } else {
              console.log('🔄 Admin viewing all branches - loading all products (immediate)');
            }
          } else {
            // Regular users see only their branch products
            branchId = user?.branchId || "cmfprkvh6000t7yyp8q2197xa";
            console.log('🔄 Regular user branch (immediate):', branchId);
          }

          const url = branchId
            ? `http://localhost:5001/api/products?limit=1000&branchId=${branchId}`
            : `http://localhost:5001/api/products?limit=1000`;

          const response = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          const data = await response.json();
          console.log('🔄 Immediate products response:', data);

          if (data.success && data.data && data.data.products) {
            const transformedProducts = data.data.products.map((product: any) => ({
              id: product.id,
              name: product.name,
              price: product.sellingPrice,
              stock: product.stock,
              unitType: product.unitType,
              category: product.category?.name || 'No Category',
              requiresPrescription: product.requiresPrescription,
              barcode: product.barcode
            }));
            console.log('🔄 Setting products immediately:', transformedProducts);
            setProducts(transformedProducts);
          }
        }
      } catch (error) {
        console.error('🔄 Error loading products immediately:', error);
      }
    };

    loadProductsImmediately();

    // Also load products when user is available
    if (user) {
      console.log('🔄 User available, calling loadProducts');
      loadProducts();
    } else {
      console.log('🔄 User not available yet');
    }

    // Load categories - only show categories that have products in current branch
    const loadCategoriesSimple = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5001/api/categories', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        const data = await response.json();
        if (data.success && data.data && data.data.categories) {
          // Determine which branch to load categories from
          let branchId: string | undefined;

          if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
            // Admin users can see categories from selected branch or all branches
            if (selectedBranchId) {
              branchId = selectedBranchId;
              console.log('🔄 Admin selected specific branch for categories (simple):', selectedBranch?.name);
            } else {
              console.log('🔄 Admin viewing all branches - loading all categories (simple)');
            }
          } else {
            // Regular users see only their branch categories
            branchId = user?.branchId || "cmfprkvh6000t7yyp8q2197xa";
            console.log('🔄 Regular user branch for categories (simple):', branchId);
          }

          // Get all products for current branch to filter categories
          const url = branchId
            ? `http://localhost:5001/api/products?branchId=${branchId}&limit=1000`
            : `http://localhost:5001/api/products?limit=1000`;

          const productsResponse = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          const productsData = await productsResponse.json();

          if (productsData.success && productsData.data && productsData.data.products) {
            // Get unique category IDs from products in current branch
            const branchCategoryIds = new Set(
              productsData.data.products.map((product: any) => product.categoryId)
            );

            // Filter categories to only include those with products in current branch
            const branchCategories = data.data.categories.filter((cat: any) =>
              branchCategoryIds.has(cat.id)
            );

            const categoryNames = branchCategories.map((cat: any) => cat.name) as string[];
            const uniqueCategories = ["all", ...Array.from(new Set(categoryNames))];
            setCategories(uniqueCategories);
          } else {
            // If no products found, show empty categories
            setCategories(['all']);
          }
        }
      } catch (error) {
        console.error('Error loading categories:', error);
        setCategories(['all']);
      }
    };

    loadCategoriesSimple();

    // Listen for product updates
    const handleProductUpdate = () => {
      loadProducts();
    };

    // Real-time data synchronization
    const handleProductChanged = (event: CustomEvent) => {
      console.log('🔄 POS Real-time product change received:', event.detail);
      const { action, product } = event.detail;

      if (action === 'created') {
        // Add new product to the list
        setProducts(prev => [product, ...prev]);
      } else if (action === 'updated') {
        // Update existing product
        setProducts(prev => prev.map(p => p.id === product.id ? product : p));
      } else if (action === 'deleted') {
        // Remove product from the list
        setProducts(prev => prev.filter(p => p.id !== product.id));
      }
    };

    const handleInventoryChanged = (event: CustomEvent) => {
      console.log('🔄 POS Real-time inventory change received:', event.detail);
      const { action, data } = event.detail;

      if (action === 'product_added') {
        // Add new product to the list
        setProducts(prev => [data, ...prev]);
      } else if (action === 'product_removed') {
        // Remove product from the list
        setProducts(prev => prev.filter(p => p.id !== data.id));
      } else if (action === 'stock_updated') {
        // Update product stock
        setProducts(prev => prev.map(p =>
          p.id === data.productId
            ? { ...p, stock: data.newStock }
            : p
        ));
      }
    };

    window.addEventListener('productCreated', handleProductUpdate);
    window.addEventListener('productUpdated', handleProductUpdate);
    window.addEventListener('productDeleted', handleProductUpdate);
    window.addEventListener('productChanged', handleProductChanged as EventListener);
    window.addEventListener('inventoryChanged', handleInventoryChanged as EventListener);

    return () => {
      window.removeEventListener('productCreated', handleProductUpdate);
      window.removeEventListener('productUpdated', handleProductUpdate);
      window.removeEventListener('productDeleted', handleProductUpdate);
      window.removeEventListener('productChanged', handleProductChanged as EventListener);
      window.removeEventListener('inventoryChanged', handleInventoryChanged as EventListener);
    };
  }, [user, selectedBranchId]); // Re-run when user or selected branch changes

  const loadProducts = async () => {
    try {
      console.log('🔄 POS loadProducts called');
      console.log('🔄 User context:', { id: user?.id, role: user?.role, branchId: user?.branchId, adminId: user?.adminId });
      console.log('🔄 Admin context:', { selectedBranchId, selectedBranch: selectedBranch?.name });
      setLoading(true);

      // Determine which branch to load products from
      let branchId: string | undefined;

      if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
        // Admin users can see products from selected branch or all branches
        if (selectedBranchId) {
          branchId = selectedBranchId;
          console.log('🔄 Admin selected specific branch:', selectedBranch?.name);
        } else {
          // Admin viewing all branches - don't filter by branch
          console.log('🔄 Admin viewing all branches - loading all products');
        }
      } else {
        // Regular users see only their branch products
        branchId = user?.branchId || "cmfprkvh6000t7yyp8q2197xa";
        console.log('🔄 Regular user branch:', branchId);
      }

      let response;
      try {
        const params: any = { limit: 1000 };
        if (branchId) {
          params.branchId = branchId;
        }

        response = await apiService.getProducts(params);
      } catch (apiError) {
        // Fallback to direct fetch
        const token = localStorage.getItem('token');
        const url = branchId
          ? `http://localhost:5001/api/products?limit=1000&branchId=${branchId}`
          : `http://localhost:5001/api/products?limit=1000`;

        const directResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        response = await directResponse.json();
      }

      console.log('🔄 API Response:', response);

      if (response.success && response.data) {
        // Check if products array exists
        const productsArray = response.data.products || response.data;
        console.log('🔄 Products array:', productsArray);
        console.log('🔄 Products array length:', productsArray?.length);

        if (Array.isArray(productsArray) && productsArray.length > 0) {
          // Transform API data to match Product interface
          const transformedProducts = productsArray.map(product => ({
            id: product.id,
            name: product.name,
            price: product.sellingPrice,
            stock: product.stock,
            unitType: product.unitType,
            category: product.category?.name || 'No Category',
            requiresPrescription: product.requiresPrescription,
            barcode: product.barcode
          }));
          console.log('🔄 Transformed products:', transformedProducts);
          setProducts(transformedProducts);
          console.log('🔄 Products set successfully');
        } else {
          console.log('🔄 No products found, setting empty array');
          setProducts([]);
        }
      } else {
        console.log('🔄 API response failed, setting empty array');
        setProducts([]);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiService.getCategories();
      if (response.success) {
        // Determine which branch to load categories from
        let branchId: string | undefined;

        if (user?.role === 'ADMIN' || user?.role === 'SUPERADMIN') {
          // Admin users can see categories from selected branch or all branches
          if (selectedBranchId) {
            branchId = selectedBranchId;
            console.log('🔄 Admin selected specific branch for categories:', selectedBranch?.name);
          } else {
            console.log('🔄 Admin viewing all branches - loading all categories');
          }
        } else {
          // Regular users see only their branch categories
          branchId = user?.branchId || "cmfprkvh6000t7yyp8q2197xa";
          console.log('🔄 Regular user branch for categories:', branchId);
        }

        // Get all products for current branch to filter categories
        const params: any = { limit: 1000 };
        if (branchId) {
          params.branchId = branchId;
        }

        const productsResponse = await apiService.getProducts(params);

        if (productsResponse.success && productsResponse.data && productsResponse.data.products) {
          // Get unique category IDs from products in current branch
          const branchCategoryIds = new Set(
            productsResponse.data.products.map((product: any) => product.categoryId)
          );

          // Filter categories to only include those with products in current branch
          const branchCategories = response.data.categories.filter((cat: any) =>
            branchCategoryIds.has(cat.id)
          );

          const categoryNames = branchCategories.map((cat: any) => cat.name);
          const uniqueCategories = ["all", ...Array.from(new Set(categoryNames))];
          setCategories(uniqueCategories);
        } else {
          // If no products found, show only "all" option
          setCategories(["all"]);
        }
      } else {
        console.error('Failed to load categories:', response.message);
        setCategories(["all"]);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setCategories(["all"]);
    }
  };

  // Load customers from API
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const loadCustomers = async () => {
    try {
      setCustomersLoading(true);
      const response = await apiService.getCustomers({
        branchId: user?.branchId || "",
        limit: 1000
      });
      if (response.success && response.data) {
        const customersArray = response.data.customers || response.data;
        if (Array.isArray(customersArray)) {
          const transformedCustomers = customersArray.map((customer: any) => ({
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            email: customer.email || "",
            address: customer.address || "",
            totalPurchases: customer.totalPurchases || 0,
            lastVisit: customer.lastVisit ? new Date(customer.lastVisit).toISOString().split('T')[0] : "",
            loyaltyPoints: customer.loyaltyPoints || 0,
            isVIP: customer.isVIP || false
          }));
          setCustomers(transformedCustomers);
        }
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setCustomersLoading(false);
    }
  };

  // Load customers when component mounts or when branchId changes
  React.useEffect(() => {
    loadCustomers();
  }, [user?.branchId]);

  // Listen for customer creation events to refresh customer list
  React.useEffect(() => {
    const handleCustomerCreated = () => {
      loadCustomers();
    };

    window.addEventListener('customerCreated', handleCustomerCreated);
    return () => {
      window.removeEventListener('customerCreated', handleCustomerCreated);
    };
  }, []);


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

  const addToCart = (product: Product, quantity: number, unitType: string) => {
    const existingItem = cart.find(item =>
      item.name === product.name && item.unitType === unitType
    );

    if (existingItem) {
      updateQuantity(existingItem.id, existingItem.quantity + quantity);
    } else {
      const unitPrice = product.price; // Price is already per unit
      const totalPrice = unitPrice * quantity;

      setCart([...cart, {
        id: product.id, // Use actual product ID from database
        name: product.name,
        price: product.price,
        quantity: quantity,
        unitType: unitType,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        batch: "BT" + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
        expiry: "Dec 2025",
        instructions: unitType === "pack" ? "Take as directed" : `Take ${quantity} ${unitType} as directed`
      }]);
    }
  };

  const updateQuantity = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.id !== id));
    } else {
      setCart(cart.map(item =>
        item.id === id ? {
          ...item,
          quantity: newQuantity,
          totalPrice: item.unitPrice * newQuantity
        } : item
      ));
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const tax = subtotal * 0.17; // 17% GST
  const total = subtotal + tax - discountAmount;

  const paymentMethods = [
    { id: 'cash', label: 'Cash', icon: Banknote },
    { id: 'card', label: 'Card', icon: CreditCard },
    { id: 'mobile', label: 'Mobile', icon: Smartphone },
    { id: 'gift_card', label: 'Gift Card', icon: CreditCard }
  ];

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Debug: Log products state
  console.log('🔄 Current products state:', products);
  console.log('🔄 Filtered products:', filteredProducts);

  const filteredInvoiceProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(invoiceSearchQuery.toLowerCase());
    return matchesSearch;
  });

  // Barcode scanning functionality
  const handleBarcodeScan = async () => {
    setIsScanning(true);
    try {
      // Check if browser supports camera access
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Camera access not supported in this browser');
        return;
      }

      // For now, we'll use a simple prompt for barcode input
      // In a real implementation, you would integrate with a barcode scanning library
      const barcode = prompt('Enter barcode or scan QR code:');
      if (barcode) {
        setScannedBarcode(barcode);
        await searchProductByBarcode(barcode);
      }
    } catch (error) {
      console.error('Barcode scanning error:', error);
      alert('Error accessing camera for barcode scanning');
    } finally {
      setIsScanning(false);
    }
  };

  const searchProductByBarcode = async (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      // Auto-add to cart
      addToCart(product, 1, "pack");
      setSearchQuery(product.name); // Update search to show the found product
    } else {
      alert(`Product with barcode ${barcode} not found`);
    }
  };

  // Sample promotions data
  const availablePromotions: Promotion[] = [
    {
      id: "1",
      code: "WELCOME10",
      name: "Welcome Discount",
      type: "percentage",
      value: 10,
      minAmount: 1000,
      maxDiscount: 500,
      validUntil: "2024-12-31",
      isActive: true
    },
    {
      id: "2",
      code: "SAVE50",
      name: "Fixed Discount",
      type: "fixed",
      value: 50,
      minAmount: 200,
      validUntil: "2024-12-31",
      isActive: true
    },
    {
      id: "3",
      code: "VIP20",
      name: "VIP Customer Discount",
      type: "percentage",
      value: 20,
      minAmount: 500,
      maxDiscount: 1000,
      validUntil: "2024-12-31",
      isActive: true
    }
  ];

  const applyPromotion = () => {
    if (!promoCode.trim()) {
      alert("Please enter a promotion code");
      return;
    }

    const promotion = availablePromotions.find(p =>
      p.code.toLowerCase() === promoCode.toLowerCase() && p.isActive
    );

    if (!promotion) {
      alert("Invalid or expired promotion code");
      return;
    }

    // Check if promotion is already applied
    if (appliedPromotions.find(p => p.id === promotion.id)) {
      alert("This promotion has already been applied");
      return;
    }

    // Check minimum amount requirement
    if (promotion.minAmount && subtotal < promotion.minAmount) {
      alert(`Minimum purchase amount of PKR ${promotion.minAmount} required for this promotion`);
      return;
    }

    // Check validity
    if (promotion.validUntil && new Date(promotion.validUntil) < new Date()) {
      alert("This promotion has expired");
      return;
    }

    // Calculate discount
    let discount = 0;
    if (promotion.type === 'percentage') {
      discount = (subtotal * promotion.value) / 100;
      if (promotion.maxDiscount) {
        discount = Math.min(discount, promotion.maxDiscount);
      }
    } else {
      discount = promotion.value;
    }

    // Apply discount
    setAppliedPromotions([...appliedPromotions, promotion]);
    setDiscountAmount(discountAmount + discount);
    setPromoCode("");
    alert(`Promotion "${promotion.name}" applied! Discount: PKR ${discount.toFixed(2)}`);
  };

  const removePromotion = (promotionId: string) => {
    const promotion = appliedPromotions.find(p => p.id === promotionId);
    if (promotion) {
      let discount = 0;
      if (promotion.type === 'percentage') {
        discount = (subtotal * promotion.value) / 100;
        if (promotion.maxDiscount) {
          discount = Math.min(discount, promotion.maxDiscount);
        }
      } else {
        discount = promotion.value;
      }

      setAppliedPromotions(appliedPromotions.filter(p => p.id !== promotionId));
      setDiscountAmount(Math.max(0, discountAmount - discount));
    }
  };

  // Split payment functionality
  const addSplitPayment = (method: 'cash' | 'card' | 'mobile' | 'gift_card', amount: number, reference?: string) => {
    const newPayment: SplitPayment = {
      id: String(Date.now()),
      method,
      amount,
      reference
    };
    setSplitPayments([...splitPayments, newPayment]);
  };

  const removeSplitPayment = (paymentId: string) => {
    setSplitPayments(splitPayments.filter(p => p.id !== paymentId));
  };

  const getTotalSplitAmount = () => {
    return splitPayments.reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getRemainingAmount = () => {
    return total - getTotalSplitAmount();
  };

  const isSplitPaymentComplete = () => {
    return Math.abs(getRemainingAmount()) < 0.01; // Allow for small floating point differences
  };

  const handleCashPayment = () => {
    const cash = parseFloat(cashAmount);
    if (cash >= total) {
      setChangeAmount(cash - total);
      setPaymentStatus('completed');
    } else {
      alert("Cash amount must be greater than or equal to total amount!");
    }
  };

  const handleCardPayment = () => {
    setPaymentStatus('processing');
    // Simulate card payment processing
    setTimeout(() => {
      setPaymentStatus('completed');
    }, 2000);
  };

  const handleMobilePayment = () => {
    setPaymentStatus('processing');
    // Simulate mobile payment processing
    setTimeout(() => {
      setPaymentStatus('completed');
    }, 2000);
  };

  const processPayment = () => {
    if (selectedPayment === 'cash') {
      handleCashPayment();
    } else if (selectedPayment === 'card') {
      handleCardPayment();
    } else if (selectedPayment === 'mobile') {
      handleMobilePayment();
    }
  };

  const generateReceipt = async () => {
    try {
      // First, create customer if selected and not already in database
      let customerId = null;
      if (selectedCustomer && !selectedCustomer.id.startsWith('temp_')) {
        // Customer is already in database
        customerId = selectedCustomer.id;
      } else if (selectedCustomer && selectedCustomer.id.startsWith('temp_')) {
        // Create new customer in database
        try {
          const customerResponse = await apiService.createCustomer({
            name: selectedCustomer.name,
            phone: selectedCustomer.phone,
            email: selectedCustomer.email || "",
            address: selectedCustomer.address || "",
            branchId: user?.branchId || ""
          });

          if (customerResponse.success) {
            customerId = customerResponse.data.id;
            console.log('Customer created successfully:', customerResponse.data);
          } else {
            console.warn('Customer creation failed:', customerResponse.message);
          }
        } catch (error) {
          console.error('Customer creation error:', error);
        }
      }

      // Prepare sale data for API
      const saleData = {
        customerId: customerId,
        branchId: user?.branchId || "",
        items: cart.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          batchNumber: item.batch || "",
          expiryDate: item.expiry || ""
        })),
        paymentMethod: selectedPayment.toUpperCase() as 'CASH' | 'CARD' | 'MOBILE' | 'BANK_TRANSFER',
        discountAmount: 0
      };

      console.log('Creating sale with data:', saleData);

      // Create sale via API (this will reduce stock in database)
      const saleResponse = await apiService.createSale(saleData);

      if (!saleResponse.success) {
        alert(saleResponse.message || "Failed to create sale. Please try again.");
        return;
      }

      const sale = saleResponse.data;
      console.log('Sale created successfully:', sale);

      // Create receipt for display using the actual sale data from API
      const now = new Date();

      // Create customer object if needed
      let customer: Customer | null = sale.customer;
      if (!customer && selectedCustomer) {
        customer = {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          phone: selectedCustomer.phone,
          email: selectedCustomer.email || "",
          address: selectedCustomer.address,
          totalPurchases: selectedCustomer.totalPurchases,
          lastVisit: selectedCustomer.lastVisit,
          loyaltyPoints: selectedCustomer.loyaltyPoints,
          isVIP: selectedCustomer.isVIP
        };
      }

      const receipt: Receipt = {
        id: sale.id,
        customer: customer,
        items: sale.items.map((item: any) => ({
          id: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          price: item.unitPrice, // Add required price field
          totalPrice: item.totalPrice,
          unitType: item.product.unitType,
          batch: item.batchNumber || "",
          expiry: item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : ""
        })),
        subtotal: sale.subtotal,
        tax: sale.taxAmount,
        total: sale.totalAmount,
        paymentMethod: sale.paymentMethod.toLowerCase() as 'cash' | 'card' | 'mobile',
        paymentStatus: sale.paymentStatus === 'COMPLETED' ? 'Paid' : 'Pending',
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
        cashier: user?.name || "Cashier",
        receiptNumber: sale.receiptNumber
      };

      setCurrentReceipt(receipt);
      setIsReceiptDialogOpen(true);

      // Reset cart and form
      setCart([]);
      setSelectedCustomer(null);
      setCashAmount("");
      setChangeAmount(0);
      setPaymentStatus('pending');

    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Error creating sale. Please try again.');
    }
  };

  const addNewCustomer = () => {
    if (!newCustomer.name || !newCustomer.phone) {
      alert("Please enter customer name and phone number!");
      return;
    }

    const customer: Customer = {
      id: `temp_${Date.now()}`, // Mark as temporary customer
      name: newCustomer.name,
      phone: newCustomer.phone,
      email: newCustomer.email || "",
      address: newCustomer.address || "",
      totalPurchases: 0,
      lastVisit: new Date().toISOString().split('T')[0],
      loyaltyPoints: 0,
      isVIP: false
    };

    // Add to customers list
    customers.push(customer);

    // Set as selected customer
    setSelectedCustomer(customer);

    // Reset form and close dialog
    setNewCustomer({
      name: "",
      phone: "",
      email: "",
      address: ""
    });
    setIsNewCustomerDialogOpen(false);
  };

  const addToInvoiceCart = (product: Product, quantity: number, unitType: string) => {
    console.log('🔍 DEBUG - Adding product to invoice cart:', product);
    console.log('🔍 DEBUG - Quantity received:', quantity);
    console.log('🔍 DEBUG - Unit type:', unitType);

    // Validate quantity
    if (quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    if (quantity > 1000) {
      alert('Quantity cannot exceed 1000 units. Please enter a smaller quantity.');
      return;
    }

    if (quantity > product.stock) {
      alert(`Insufficient stock! Available: ${product.stock}, Requested: ${quantity}`);
      return;
    }

    const existingItem = invoiceItems.find(item =>
      item.name === product.name && item.unitType === unitType
    );

    if (existingItem) {
      updateInvoiceQuantity(existingItem.id, existingItem.quantity + quantity);
    } else {
      const unitPrice = product.price; // Price is already per unit
      const totalPrice = unitPrice * quantity;

      const newItem = {
        id: product.id, // Use actual product ID from database
        name: product.name,
        price: product.price,
        quantity: quantity,
        unitType: unitType,
        unitPrice: unitPrice,
        totalPrice: totalPrice,
        batch: "BT" + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
        expiry: "Dec 2025",
        instructions: unitType === "pack" ? "Take as directed" : `Take ${quantity} ${unitType} as directed`
      };
      console.log('New invoice item:', newItem);
      setInvoiceItems([...invoiceItems, newItem]);
    }
  };

  const updateInvoiceQuantity = (id: string, newQuantity: number) => {
    console.log('🔍 DEBUG - updateInvoiceQuantity called with:', { id, newQuantity });

    if (newQuantity <= 0) {
      setInvoiceItems(invoiceItems.filter(item => item.id !== id));
    } else {
      // Validate quantity
      if (newQuantity > 1000) {
        alert('Quantity cannot exceed 1000 units. Please enter a smaller quantity.');
        return;
      }

      // Find the item to get product info for stock validation
      const item = invoiceItems.find(item => item.id === id);
      if (item) {
        // Find the original product to check stock
        const originalProduct = products.find(p => p.id === id);
        console.log('🔍 DEBUG - Found product:', originalProduct?.name, 'Stock:', originalProduct?.stock);
        if (originalProduct && newQuantity > originalProduct.stock) {
          console.log('🔍 DEBUG - Stock validation failed!');
          alert(`Insufficient stock! Available: ${originalProduct.stock}, Requested: ${newQuantity}`);
          return;
        }
      }

      setInvoiceItems(invoiceItems.map(item =>
        item.id === id ? {
          ...item,
          quantity: newQuantity,
          totalPrice: item.unitPrice * newQuantity
        } : item
      ));
    }
  };


  const createInvoice = async () => {
    if (invoiceItems.length === 0) {
      alert("Please add at least one item to the invoice!");
      return;
    }

    // Validate all items before creating invoice
    console.log('🔍 DEBUG - Validating invoice items before creation:');
    for (const item of invoiceItems) {
      const originalProduct = products.find(p => p.id === item.id);
      console.log(`🔍 DEBUG - Item: ${item.name}, Quantity: ${item.quantity}, Available Stock: ${originalProduct?.stock}`);
      if (originalProduct && item.quantity > originalProduct.stock) {
        alert(`Insufficient stock for ${item.name}! Available: ${originalProduct.stock}, Required: ${item.quantity}`);
        return;
      }
    }

    try {
      // Always create or find customer for every purchase
      let customerId = null;
      let customerName = "Walk-in Customer";
      let customerPhone = "";

      // Use provided customer details or create a walk-in customer
      if (invoiceCustomer.name && invoiceCustomer.phone) {
        customerName = invoiceCustomer.name;
        customerPhone = invoiceCustomer.phone;
      } else if (invoiceCustomer.phone) {
        customerName = `Customer-${invoiceCustomer.phone}`;
        customerPhone = invoiceCustomer.phone;
      } else {
        // Generate a unique walk-in customer identifier
        const timestamp = Date.now();
        customerName = `Walk-in-${timestamp}`;
        customerPhone = `000-${timestamp}`;
      }

      try {
        const customerResponse = await apiService.createCustomer({
          name: customerName,
          phone: customerPhone,
          email: invoiceCustomer.email || "",
          address: invoiceCustomer.address || "",
          branchId: user?.branchId || ""
        });

        if (customerResponse.success) {
          customerId = customerResponse.data.id;
          console.log('Customer created successfully:', customerResponse.data);

          // Dispatch event to refresh customer list
          window.dispatchEvent(new CustomEvent('customerCreated', {
            detail: customerResponse.data
          }));

          // Show success message for new customers
          if (customerResponse.message !== 'Customer already exists') {
            console.log(`✅ Customer "${customerName}" added to customer records`);
          }
        } else {
          console.warn('Customer creation failed:', customerResponse.message);
          // Continue with sale even if customer creation fails
        }
      } catch (error) {
        console.error('Customer creation error:', error);
        // Continue with sale even if customer creation fails
      }

      // Prepare sale data for API
      const saleData = {
        customerId: customerId,
        branchId: user?.branchId || "",
        items: invoiceItems.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          batchNumber: item.batch || "",
          expiryDate: item.expiry || ""
        })),
        paymentMethod: 'CASH' as const,
        discountAmount: discountAmount
      };

      console.log('Creating sale with data:', saleData);

      // Create sale via API (this will reduce stock in database)
      const saleResponse = await apiService.createSale(saleData);

      if (!saleResponse.success) {
        alert(saleResponse.message || "Failed to create invoice. Please try again.");
        return;
      }

      const sale = saleResponse.data;
      console.log('Sale created successfully:', sale);

      // Create receipt for display
      const receipt: Receipt = {
        id: sale.id,
        customer: {
          id: customerId || "",
          name: customerName,
          phone: customerPhone,
          email: invoiceCustomer.email || "",
          address: invoiceCustomer.address || "",
          totalPurchases: sale.totalAmount,
          loyaltyPoints: Math.floor(sale.totalAmount / 100),
          isVIP: false,
          lastVisit: new Date().toISOString().split('T')[0]
        },
        items: invoiceItems,
        subtotal: sale.subtotal,
        tax: sale.taxAmount,
        total: sale.totalAmount,
        paymentMethod: 'cash',
        paymentStatus: 'Paid',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        cashier: user?.name || "Cashier",
        receiptNumber: sale.receiptNumber
      };

      // Store the invoice in localStorage for the Invoices tab
      const existingInvoices = JSON.parse(localStorage.getItem('realInvoices') || '[]');
      existingInvoices.unshift(sale);
      localStorage.setItem('realInvoices', JSON.stringify(existingInvoices));

      setCurrentReceipt(receipt);
      setIsReceiptDialogOpen(true);
      setIsInvoiceDialogOpen(false);

      // Reset invoice form
      setInvoiceCustomer({
        name: "",
        phone: "",
        email: "",
        address: ""
      });
      setInvoiceItems([]);
      setInvoiceSearchQuery("");
      setAppliedPromotions([]);
      setPromoCode("");
      setDiscountAmount(0);

      // Reload products to update stock (this will show the reduced quantities)
      await loadProducts();

      // Notify other components about new invoice
      window.dispatchEvent(new CustomEvent('invoiceCreated', {
        detail: { invoice: sale }
      }));

      alert(`Invoice created successfully!\n\nInvoice Number: ${sale.id}\nReceipt Number: ${sale.receiptNumber}\nTotal Amount: PKR ${sale.totalAmount.toFixed(2)}`);

    } catch (error) {
      console.error('Error creating invoice:', error);
      alert("Error creating invoice. Please try again.");
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
            .receipt {
              max-width: 300px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
              margin-bottom: 15px;
            }
            .header h1 {
              font-size: 18px;
              margin: 0;
              font-weight: bold;
            }
            .header p {
              font-size: 10px;
              margin: 5px 0;
            }
            .receipt-info {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              margin-bottom: 15px;
            }
            .customer-info {
              border: 1px solid #000;
              padding: 8px;
              margin-bottom: 15px;
              font-size: 10px;
            }
            .customer-info h3 {
              margin: 0 0 5px 0;
              font-size: 11px;
              font-weight: bold;
            }
            .items {
              margin-bottom: 15px;
            }
            .item {
              display: flex;
              justify-content: space-between;
              padding: 3px 0;
              border-bottom: 1px dotted #ccc;
            }
            .item-name {
              flex: 1;
              font-weight: bold;
            }
            .item-details {
              font-size: 9px;
              color: #666;
            }
            .item-price {
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
              padding: 2px 0;
            }
            .total-final {
              font-weight: bold;
              font-size: 14px;
              border-top: 1px solid #000;
              padding-top: 5px;
              margin-top: 5px;
            }
            .payment-info {
              border: 1px solid #000;
              padding: 8px;
              margin: 15px 0;
              font-size: 10px;
            }
            .footer {
              text-align: center;
              font-size: 9px;
              margin-top: 20px;
              border-top: 1px solid #000;
              padding-top: 10px;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .receipt { max-width: none; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
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
              <div class="total-line">
                <span>GST (17%):</span>
                <span>PKR ${currentReceipt.tax.toFixed(2)}</span>
              </div>
              <div class="total-line total-final">
                <span>TOTAL:</span>
                <span>PKR ${currentReceipt.total.toFixed(2)}</span>
              </div>
            </div>

            <div class="payment-info">
              <strong>Payment Method:</strong> ${currentReceipt.paymentMethod.toUpperCase()}<br>
              <strong>Status:</strong> ${currentReceipt.paymentStatus}
              ${selectedPayment === 'cash' && changeAmount > 0 ? `
                <br><strong>Cash Received:</strong> PKR ${parseFloat(cashAmount).toFixed(2)}
                <br><strong>Change:</strong> PKR ${changeAmount.toFixed(2)}
              ` : ''}
            </div>

            <div class="footer">
              <p>Thank you for choosing MediBill Pulse Pharmacy!</p>
              <p>Please keep this receipt for your records</p>
              <p><strong>Important:</strong> Follow dosage instructions carefully.<br>
              Consult your doctor if you have any questions.</p>
            </div>
          </div>
        </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();

      // Wait for content to load then print
      setTimeout(() => {
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
    } catch (error) {
      console.error('Error downloading receipt:', error);
      alert('Error downloading receipt. Please try again.');
    }
  };

  const generateReceiptHTML = (receipt: any) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt ${receipt.receiptNumber}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
            color: black;
            max-width: 400px;
            margin: 0 auto;
          }
          .receipt-header {
            text-align: center;
            border-bottom: 2px solid #1C623C;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .receipt-header h1 {
            color: #1C623C;
            margin: 0;
            font-size: 24px;
          }
          .receipt-header p {
            color: #666;
            margin: 5px 0;
            font-size: 14px;
          }
          .receipt-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            font-size: 14px;
          }
          .customer-info {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 8px;
          }
          .customer-info h3 {
            color: #1C623C;
            margin-bottom: 10px;
            font-size: 16px;
          }
          .items {
            margin-bottom: 20px;
          }
          .item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .item-name {
            font-weight: bold;
          }
          .item-details {
            font-size: 12px;
            color: #666;
            margin-top: 2px;
          }
          .totals {
            border-top: 2px solid #1C623C;
            padding-top: 15px;
            margin-top: 20px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
          }
          .total-final {
            font-weight: bold;
            font-size: 18px;
            color: #1C623C;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            margin-top: 10px;
          }
          .payment-info {
            margin-top: 20px;
            padding: 15px;
            background-color: #f0f8f0;
            border-radius: 8px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            font-size: 12px;
            color: #666;
          }
          .important-note {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            padding: 10px;
            border-radius: 5px;
            margin-top: 15px;
            font-size: 12px;
          }
          @media print {
            body { margin: 0; padding: 10px; }
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
            <strong>Date:</strong> ${receipt.date}<br>
            <strong>Time:</strong> ${receipt.time}
          </div>
          <div>
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
          <h3>Items Purchased</h3>
          ${receipt.items.map(item => `
            <div class="item">
              <div>
                <div class="item-name">${item.name}</div>
                <div class="item-details">
                  ${item.quantity} ${item.unitType} × PKR ${item.unitPrice.toFixed(2)}<br>
                  ${item.instructions ? `Instructions: ${item.instructions}` : ''}
                </div>
              </div>
              <div style="text-align: right;">
                PKR ${item.totalPrice.toFixed(2)}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>PKR ${receipt.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>GST (17%):</span>
            <span>PKR ${receipt.tax.toFixed(2)}</span>
          </div>
          <div class="total-row total-final">
            <span>Total:</span>
            <span>PKR ${receipt.total.toFixed(2)}</span>
          </div>
        </div>

        <div class="payment-info">
          <strong>Payment Method:</strong> ${receipt.paymentMethod}<br>
          <strong>Status:</strong> ${receipt.status}
        </div>

        <div class="footer">
          <p>Thank you for choosing MediBill Pulse Pharmacy! Please keep this receipt for your records</p>
          <div class="important-note">
            <strong>Important:</strong> Follow dosage instructions carefully. Consult your doctor if you have any questions.
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const sendSMSReceipt = async () => {
    if (!currentReceipt?.customer?.phone) {
      alert("Customer phone number is required to send SMS receipt");
      return;
    }

    try {
      // Create a concise SMS message
      const smsMessage = `MediBill Pulse Pharmacy Receipt
Receipt: ${currentReceipt.receiptNumber}
Total: PKR ${currentReceipt.total.toFixed(2)}
Date: ${currentReceipt.date} ${currentReceipt.time}

Items: ${currentReceipt.items.map(item => `${item.name} (${item.quantity} ${item.unitType})`).join(', ')}

Thank you for choosing us!`;

      // In a real implementation, you would call an SMS API service here
      // For now, we'll simulate the SMS sending with a more realistic approach

      // Create a clickable SMS link
      const smsUrl = `sms:${currentReceipt.customer.phone}?body=${encodeURIComponent(smsMessage)}`;

      // Try to open SMS app
      if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
        // iOS devices
        window.location.href = smsUrl;
      } else if (navigator.userAgent.match(/Android/i)) {
        // Android devices
        window.location.href = smsUrl;
      } else {
        // Desktop/other devices - show the message for manual sending
        const smsWindow = window.open('', '_blank', 'width=500,height=400');
        if (smsWindow) {
          smsWindow.document.write(`
            <html>
              <head><title>SMS Receipt</title></head>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>SMS Receipt for ${currentReceipt.customer.phone}</h2>
                <p><strong>To:</strong> ${currentReceipt.customer.phone}</p>
                <p><strong>Message:</strong></p>
                <textarea readonly style="width: 100%; height: 200px; font-family: monospace; padding: 10px; border: 1px solid #ccc;">${smsMessage}</textarea>
                <p><em>Copy the message above and send it via your SMS app.</em></p>
                <button onclick="window.close()" style="padding: 10px 20px; background: #1C623C; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
              </body>
            </html>
          `);
        } else {
          alert(`SMS Receipt for ${currentReceipt.customer.phone}:\n\n${smsMessage}\n\nCopy this message and send it via your SMS app.`);
        }
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      alert('Error preparing SMS receipt. Please try again.');
    }
  };

  const sendEmailReceipt = async () => {
    if (!currentReceipt?.customer?.email) {
      alert("Customer email address is required to send email receipt");
      return;
    }

    try {
      // In a real implementation, you would call an email API service
      const emailSubject = `Receipt from MediBill Pulse Pharmacy - ${currentReceipt.receiptNumber}`;

      const emailBody = `
Dear ${currentReceipt.customer.name},

Thank you for your purchase at MediBill Pulse Pharmacy!

Receipt Details:
- Receipt Number: ${currentReceipt.receiptNumber}
- Date: ${currentReceipt.date}
- Time: ${currentReceipt.time}
- Cashier: ${currentReceipt.cashier}

Items Purchased:
${currentReceipt.items.map(item => `
• ${item.name}
  Quantity: ${item.quantity} ${item.unitType}
  Unit Price: PKR ${item.unitPrice.toFixed(2)}
  Total: PKR ${item.totalPrice.toFixed(2)}
`).join('')}

Summary:
- Subtotal: PKR ${currentReceipt.subtotal.toFixed(2)}
- GST (17%): PKR ${currentReceipt.tax.toFixed(2)}
- Total: PKR ${currentReceipt.total.toFixed(2)}
- Payment Method: ${currentReceipt.paymentMethod.toUpperCase()}

Please keep this receipt for your records.

Important: Follow dosage instructions carefully. Consult your doctor if you have any questions.

Thank you for choosing MediBill Pulse Pharmacy!
Your Health, Our Priority

Best regards,
MediBill Pulse Pharmacy Team
      `;

      // Create a mailto link with the email content
      const mailtoUrl = `mailto:${currentReceipt.customer.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

      // Try to open email client
      const emailWindow = window.open(mailtoUrl, '_blank');

      if (!emailWindow) {
        // If popup blocked, show the email content in a new window
        const emailWindow = window.open('', '_blank', 'width=600,height=500');
        if (emailWindow) {
          emailWindow.document.write(`
            <html>
              <head>
                <title>Email Receipt</title>
                <style>
                  body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
                  .header { background: #1C623C; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                  .content { background: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
                  .items { margin: 15px 0; }
                  .item { margin: 10px 0; padding: 10px; background: white; border-radius: 3px; }
                  .totals { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0; }
                  .footer { text-align: center; color: #666; font-size: 12px; }
                  button { padding: 10px 20px; background: #1C623C; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
                </style>
              </head>
              <body>
                <div class="header">
                  <h2>Email Receipt for ${currentReceipt.customer.email}</h2>
                </div>
                <div class="content">
                  <p><strong>To:</strong> ${currentReceipt.customer.email}</p>
                  <p><strong>Subject:</strong> ${emailSubject}</p>
                  <p><strong>Message:</strong></p>
                  <div style="background: white; padding: 15px; border-radius: 5px; white-space: pre-wrap; font-family: monospace; max-height: 300px; overflow-y: auto;">${emailBody}</div>
                </div>
                <div style="text-align: center;">
                  <button onclick="window.close()">Close</button>
                  <button onclick="navigator.clipboard.writeText('${emailBody.replace(/'/g, "\\'")}').then(() => alert('Email content copied to clipboard!'))">Copy Content</button>
                </div>
                <div class="footer">
                  <p>Copy the content above and send it via your email client.</p>
                </div>
              </body>
            </html>
          `);
        } else {
          alert(`Email Receipt for ${currentReceipt.customer.email}:\n\nSubject: ${emailSubject}\n\n${emailBody}\n\nCopy this content and send it via your email client.`);
        }
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Error preparing email receipt. Please try again.');
    }
  };

  // No mock data - only use real data from API

  // Invoice lookup functionality
  const lookupInvoice = async () => {
    if (!refundReceiptNumber.trim()) {
      alert("Please enter a receipt number");
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
          setIsRefundDialogOpen(true);
        } else {
          alert(`Invoice with receipt number "${refundReceiptNumber}" not found.`);
        }
      } else {
        alert('Failed to load invoices. Please try again.');
      }
    } catch (error: any) {
      console.error('Error looking up invoice:', error);
      alert('Error looking up invoice. Please try again.');
    } finally {
      setInvoiceLookupLoading(false);
    }
  };


  // Refund and return functionality
  const processRefund = async () => {
    if (!refundReceiptNumber.trim()) {
      alert("Please enter a receipt number");
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
        alert("Sale not found with the given receipt number");
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
        alert(`Receipt number ${refundReceiptNumber} not found`);
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
        alert(`Refund processed successfully!

Receipt Number: ${refundReceiptNumber}
Refund Amount: PKR ${totalRefundAmount.toFixed(2)}
Reason: ${refundReason || "Customer requested refund"}

Items Refunded:
${originalSale.items.map((item: any) => `• ${item.product?.name || 'Unknown Product'} - ${item.quantity} units - PKR ${(item.quantity * item.unitPrice).toFixed(2)}`).join('\n')}

Stock has been updated and items are back in inventory.
Sale amount has been deducted from reports.`);

        // Reset refund form
        setRefundReceiptNumber("");
        setRefundReason("");
        setRefundItems([]);
        setIsRefundDialogOpen(false);

        // Refresh products to show updated stock
        loadProducts();

        // Trigger refresh of refunds list by dispatching a custom event
        window.dispatchEvent(new CustomEvent('refundCreated', {
          detail: { refund: refundResponse.data.refund }
        }));
      } else {
        alert(refundResponse.message || "Failed to process refund. Please try again.");
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      alert('Error processing refund. Please try again.');
    }
  };

  const addRefundItem = (item: CartItem, quantity: number, reason: string) => {
    if (quantity <= 0) return;

    const refundItem: RefundItem = {
      id: item.id,
      name: item.name,
      quantity: quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.unitPrice * quantity,
      reason: reason
    };

    setRefundItems([...refundItems, refundItem]);
  };

  const removeRefundItem = (itemId: string) => {
    setRefundItems(refundItems.filter(item => item.id !== itemId));
  };

  // Gift card functionality
  const validateGiftCard = async (cardNumber: string) => {
    // In a real implementation, you would call the backend API to validate the gift card
    // For demo purposes, we'll simulate some gift cards
    const sampleGiftCards: GiftCard[] = [
      { id: "1", number: "1234567890123456", balance: 500, isActive: true, expiryDate: "2025-12-31" },
      { id: "2", number: "2345678901234567", balance: 1000, isActive: true, expiryDate: "2025-06-30" },
      { id: "3", number: "3456789012345678", balance: 250, isActive: true, expiryDate: "2024-12-31" },
      { id: "4", number: "4567890123456789", balance: 0, isActive: false, expiryDate: "2023-12-31" }
    ];

    const giftCard = sampleGiftCards.find(card => card.number === cardNumber);

    if (!giftCard) {
      alert("Gift card not found");
      return false;
    }

    if (!giftCard.isActive) {
      alert("Gift card is inactive");
      return false;
    }

    if (giftCard.expiryDate && new Date(giftCard.expiryDate) < new Date()) {
      alert("Gift card has expired");
      return false;
    }

    setGiftCardBalance(giftCard.balance);
    return true;
  };

  const applyGiftCard = () => {
    if (!giftCardNumber.trim()) {
      alert("Please enter a gift card number");
      return;
    }

    if (giftCardAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (giftCardAmount > giftCardBalance) {
      alert(`Insufficient balance. Available: PKR ${giftCardBalance.toFixed(2)}`);
      return;
    }

    if (giftCardAmount > total) {
      alert(`Amount cannot exceed total. Total: PKR ${total.toFixed(2)}`);
      return;
    }

    // Add gift card payment to split payments
    addSplitPayment('gift_card', giftCardAmount, giftCardNumber);

    // Reset gift card form
    setGiftCardNumber("");
    setGiftCardAmount(0);
    setGiftCardBalance(0);

    alert(`Gift card applied successfully! Amount: PKR ${giftCardAmount.toFixed(2)}`);
  };

  const searchReceiptForRefund = async () => {
    if (!refundReceiptNumber.trim()) {
      alert("Please enter a receipt number");
      return;
    }

    try {
      // Search for the receipt in the sales API
      const response = await apiService.getSales({
        limit: 1000 // Get more results to search through
      });

      if (response.success && response.data) {
        // Find the specific receipt
        const sales = response.data.sales;
        const foundSale = sales.find((sale: any) =>
          sale.receipts?.some((receipt: any) =>
            receipt.receiptNumber === refundReceiptNumber
          )
        );

        if (foundSale) {
          // Set the found invoice and open refund dialog
          setFoundInvoice(foundSale);
          setRefundReason("Customer requested refund");

          // Automatically populate refund items from the found sale
          const itemsToRefund = foundSale.items.map((item: any) => ({
            id: item.productId,
            name: item.product?.name || 'Unknown Product',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            reason: "Customer requested refund"
          }));
          setRefundItems(itemsToRefund);

          // Open the refund dialog
          setIsRefundDialogOpen(true);

          // Reset the search
          setRefundReceiptNumber("");
          setIsRefundSearchOpen(false);

          alert(`Receipt ${refundReceiptNumber} found! All items are ready for refund. Click "Process Refund" to complete the refund.`);
        } else {
          alert(`Receipt number ${refundReceiptNumber} not found`);
        }
      } else {
        alert("Error searching for receipt");
      }
    } catch (error) {
      console.error('Error searching receipt:', error);
      alert('Error searching for receipt. Please try again.');
    }
  };

  return (
    <div className="p-6 bg-background min-h-screen">
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">

        {/* Product Search & Selection */}
        <Card className="lg:col-span-2 shadow-soft border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Search className="w-5 h-5 text-primary" />
              <span>Pharmacy Product Search</span>
            </CardTitle>
              <div className="flex space-x-2">
                <Button
                  onClick={() => setIsInvoiceDialogOpen(true)}
                  className="text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Create Invoice for New Customer
                </Button>
                <Button
                  onClick={() => setIsRefundDialogOpen(true)}
                  variant="outline"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Refunds & Returns
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Bar */}
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by medicine name, barcode, or batch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  console.log('🔄 Manual refresh clicked');
                  loadProducts();
                }}
                disabled={loading}
                className="h-12 px-3"
                title="Refresh Products"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  console.log('🚀 Loading products directly...');
                  try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`http://localhost:5001/api/products?limit=1000&branchId=${user?.branchId || 'cmfprkvh6000t7yyp8q2197xa'}`, {
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                      }
                    });
                    const data = await response.json();
                    console.log('🚀 Direct response:', data);

                    if (data.success && data.data && data.data.products) {
                      const products = data.data.products.map((product: any) => ({
                        id: product.id,
                        name: product.name,
                        price: product.sellingPrice,
                        stock: product.stock,
                        unitType: product.unitType,
                        category: product.category?.name || 'No Category',
                        requiresPrescription: product.requiresPrescription,
                        barcode: product.barcode
                      }));
                      console.log('🚀 Setting products:', products.length);
                      setProducts(products);
                    }
                  } catch (error) {
                    console.error('🚀 Error:', error);
                  }
                }}
                className="h-12 px-3 text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90"
                title="Load Products"
              >
                Load Products
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="px-4"
                onClick={handleBarcodeScan}
                disabled={isScanning}
              >
                <Scan className="w-5 h-5" />
                {isScanning ? 'Scanning...' : 'Scan'}
              </Button>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category, index) => (
                <Button
                  key={`${category}-${index}`}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className={`capitalize ${selectedCategory === category
                      ? "text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)]"
                      : ""
                    }`}
                >
                  {category}
                </Button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-8">
                  <div className="text-muted-foreground">
                    {products.length === 0 ? 'No products found. Please check your inventory.' : 'No products match your search criteria.'}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">
                    Total products: {products.length} | Filtered: {filteredProducts.length}
                  </div>
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <Card key={product.id} className="cursor-pointer hover:shadow-medium transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Product Name */}
                        <div className="text-center">
                          <h4 className="font-medium text-sm text-foreground mb-2">{product.name}</h4>
                        </div>

                        {/* Price and Stock */}
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-primary">PKR {product.price}</span>
                          <Badge variant="outline" className="text-xs">
                            {product.stock} left
                          </Badge>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Receipt Search for Refund */}
        {/* <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <span>Search Receipt for Refund</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter receipt number (e.g., RCP-20250913-961)"
                  value={refundReceiptNumber}
                  onChange={(e) => setRefundReceiptNumber(e.target.value)}
                  className="pl-10"
                  onKeyPress={(e) => e.key === 'Enter' && searchReceiptForRefund()}
                />
              </div>
              <Button
                onClick={searchReceiptForRefund}
                disabled={!refundReceiptNumber.trim()}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Search className="w-4 h-4 mr-2" />
                Find Receipt
              </Button>
            </div>
            <p className="text-sm text-orange-700">
              Enter a receipt number to search for it and process refunds. The receipt will be found and you can go to the Refunds & Returns tab to complete the refund process.
            </p>
          </CardContent>
        </Card> */}
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
                  <Button variant="outline" size="sm" onClick={sendSMSReceipt}>
                    <Phone className="w-4 h-4 mr-2" />
                    SMS
                  </Button>
                )}
                {currentReceipt?.customer?.email && (
                  <Button variant="outline" size="sm" onClick={sendEmailReceipt}>
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
                <h2 className="text-2xl font-bold text-primary">MediBill Pulse Pharmacy</h2>
                <p className="text-muted-foreground">Your Health, Our Priority</p>
                <div className="flex justify-between text-sm mt-4">
                  <div>
                    <p><strong>Receipt:</strong> {currentReceipt.receiptNumber}</p>
                    <p><strong>Date:</strong> {currentReceipt.date}</p>
                  </div>
                  <div>
                    <p><strong>Time:</strong> {currentReceipt.time}</p>
                    <p><strong>Cashier:</strong> {currentReceipt.cashier}</p>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              {currentReceipt.customer && (
                <div className="border-b pb-4">
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Name:</strong> {currentReceipt.customer.name}</p>
                      <p><strong>Phone:</strong> {currentReceipt.customer.phone}</p>
                    </div>
                    <div>
                      <p><strong>Email:</strong> {currentReceipt.customer.email}</p>
                      <p><strong>Address:</strong> {currentReceipt.customer.address}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="space-y-3">
                <h3 className="font-semibold">Items Purchased</h3>
                {currentReceipt.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-dashed">
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} {item.unitType} × PKR {item.unitPrice.toFixed(2)}
                      </p>
                      {item.instructions && (
                        <p className="text-xs text-blue-600 mt-1">{item.instructions}</p>
                      )}
                    </div>
                    <p className="font-semibold">PKR {item.totalPrice.toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>PKR {currentReceipt.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST (17%):</span>
                  <span>PKR {currentReceipt.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span className="text-primary">PKR {currentReceipt.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Payment Method:</strong> {currentReceipt.paymentMethod.toUpperCase()}</p>
                    <p><strong>Status:</strong> {currentReceipt.paymentStatus}</p>
                  </div>
                  {selectedPayment === 'cash' && changeAmount > 0 && (
                    <div>
                      <p><strong>Cash Received:</strong> PKR {parseFloat(cashAmount).toFixed(2)}</p>
                      <p><strong>Change:</strong> PKR {changeAmount.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="text-center text-sm text-muted-foreground border-t pt-4">
                <p>Thank you for choosing MediBill Pulse Pharmacy!</p>
                <p>Please keep this receipt for your records</p>
                <p className="mt-2">
                  <strong>Important:</strong> Follow dosage instructions carefully.
                  Consult your doctor if you have any questions.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={isNewCustomerDialogOpen} onOpenChange={setIsNewCustomerDialogOpen}>
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
              <Input
                id="customerAddress"
                placeholder="Enter address"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setIsNewCustomerDialogOpen(false)}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={addNewCustomer}
              className="text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Creation Dialog */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={(open) => {
        setIsInvoiceDialogOpen(open);
        if (!open) {
          // Reset promotions when dialog is closed
          setAppliedPromotions([]);
          setPromoCode("");
          setDiscountAmount(0);
        }
      }}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-primary" />
              <span>Create Invoice for New Customer</span>
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer Details Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Customer Details</h3>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="invoiceCustomerName">Customer Name (Optional)</Label>
                  <Input
                    id="invoiceCustomerName"
                    placeholder="Enter customer name"
                    value={invoiceCustomer.name}
                    onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceCustomerPhone">Phone Number (Optional)</Label>
                  <Input
                    id="invoiceCustomerPhone"
                    placeholder="Enter phone number"
                    value={invoiceCustomer.phone}
                    onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceCustomerEmail">Email (Optional)</Label>
                  <Input
                    id="invoiceCustomerEmail"
                    type="email"
                    placeholder="Enter email address"
                    value={invoiceCustomer.email}
                    onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceCustomerAddress">Address (Optional)</Label>
                  <Input
                    id="invoiceCustomerAddress"
                    placeholder="Enter address"
                    value={invoiceCustomer.address}
                    onChange={(e) => setInvoiceCustomer({ ...invoiceCustomer, address: e.target.value })}
                  />
                </div>
              </div>

              {/* Medicine Search */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Search Medicines</h3>

                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by medicine name..."
                    value={invoiceSearchQuery}
                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>


                {/* Products List */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredInvoiceProducts.map((product) => (
                    <div key={product.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{product.name}</h4>
                          <div className="flex items-center space-x-2 mt-1">
                            {getUnitIcon(product.unitType)}
                            <span className="text-xs text-muted-foreground">
                              Item
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-primary">PKR {product.price}</span>
                      </div>

                      <div className="flex space-x-2">
                        <Input
                          type="number"
                          min="0"
                          max="1000"
                          placeholder="0"
                          className="flex-1 h-8 text-sm"
                          id={`invoice-pack-${product.id}`}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="px-3"
                          onClick={() => {
                            const input = document.getElementById(`invoice-pack-${product.id}`) as HTMLInputElement;
                            const quantity = parseInt(input.value) || 0;
                            console.log('🔍 DEBUG - Pack quantity input value:', input.value);
                            console.log('🔍 DEBUG - Parsed quantity:', quantity);
                            if (quantity > 0) {
                              addToInvoiceCart(product, quantity, "pack");
                              input.value = "";
                            }
                          }}
                        >
                          <Package className="w-4 h-4 mr-1" />
                          Add Pack
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="px-3"
                          onClick={() => {
                            const input = document.getElementById(`invoice-pack-${product.id}`) as HTMLInputElement;
                            const quantity = parseInt(input.value) || 0;
                            console.log('🔍 DEBUG - Unit quantity input value:', input.value);
                            console.log('🔍 DEBUG - Parsed quantity:', quantity);
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
                  ))}
                </div>
              </div>
            </div>

            {/* Selected Items & Totals */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Selected Items</h3>

              {/* Selected Items List */}
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {invoiceItems.map((item) => (
                  <div key={item.id} className="p-3 bg-gradient-surface rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-foreground">{item.name}</h4>
                        <div className="flex items-center space-x-2 mt-1">
                          {getUnitIcon(item.unitType)}
                          <span className="text-xs text-muted-foreground">
                            {item.quantity} {item.unitType} • PKR {item.unitPrice.toFixed(2)} each
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Batch: {item.batch} • Exp: {item.expiry}
                        </p>
                        {item.instructions && (
                          <p className="text-xs text-blue-600 mt-1 font-medium">
                            💊 {item.instructions}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => updateInvoiceQuantity(item.id, 0)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            console.log('🔍 DEBUG - Decreasing quantity for:', item.name, 'from', item.quantity, 'to', item.quantity - 1);
                            updateInvoiceQuantity(item.id, item.quantity - 1);
                          }}
                          className="w-8 h-8 p-0"
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            console.log('🔍 DEBUG - Increasing quantity for:', item.name, 'from', item.quantity, 'to', item.quantity + 1);
                            updateInvoiceQuantity(item.id, item.quantity + 1);
                          }}
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

              {/* Promotions & Discounts Section */}
              {invoiceItems.length > 0 && (
                <div className="space-y-3 border-t pt-4">
                  <h4 className="font-medium text-sm">Promotions & Discounts</h4>

                  {/* Applied Promotions */}
                  {appliedPromotions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Applied Promotions:</p>
                      {appliedPromotions.map((promotion) => (
                        <div key={promotion.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-green-800">{promotion.name}</p>
                            <p className="text-xs text-green-600">Code: {promotion.code}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removePromotion(promotion.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Apply Promotion */}
                  <div className="flex space-x-2">
                    <Input
                      placeholder="Enter promotion code"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={applyPromotion}
                      variant="outline"
                      size="sm"
                      disabled={!promoCode.trim()}
                    >
                      Apply
                    </Button>
                  </div>

                  {/* Discount Amount Display */}
                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center p-2 bg-green-50 rounded-lg">
                      <span className="text-sm font-medium text-green-800">Discount Applied</span>
                      <span className="text-sm font-bold text-green-800">-PKR {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Totals */}
              {invoiceItems.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">PKR {invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST (17%)</span>
                    <span className="font-medium">PKR {(invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0) * 0.17).toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount</span>
                      <span>-PKR {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">PKR {((invoiceItems.reduce((sum, item) => sum + item.totalPrice, 0) * 1.17) - discountAmount).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsInvoiceDialogOpen(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={createInvoice}
                  className="text-white bg-[linear-gradient(135deg,#1C623C_0%,#247449_50%,#6EB469_100%)] hover:opacity-90"
                  disabled={invoiceItems.length === 0}
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Create Invoice & Print Receipt
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Refunds & Returns Dialog */}
      <Dialog open={isRefundDialogOpen} onOpenChange={(open) => {
        setIsRefundDialogOpen(open);
        if (!open) {
          // Reset form when dialog is closed
          setRefundReceiptNumber("");
          setRefundReason("");
          setFoundInvoice(null);
          setRefundItems([]);
        }
      }}>
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
                  {invoiceLookupLoading ? 'Looking up...' : 'Lookup Invoice'}
                </Button>
                <Button
                  onClick={async () => {
                    try {
                      // Make API call to get sales data
                      const response = await apiService.getSales({
                        limit: 1000,
                        startDate: undefined,
                        endDate: undefined,
                        branchId: undefined
                      });

                      if (response.success && response.data?.sales) {
                        const receiptNumbers = response.data.sales
                          .map((sale: any) => sale.receipts?.[0]?.receiptNumber)
                          .filter(Boolean)
                          .join('\n');
                        alert(`Available Receipt Numbers:\n\n${receiptNumbers || 'None'}\n\nTry entering one of these receipt numbers to test the refund functionality.`);
                      } else {
                        alert('Failed to load invoices. Please try again.');
                      }
                    } catch (error) {
                      console.error('Error loading receipts:', error);
                      alert('Error loading receipts. Please try again.');
                    }
                  }}
                  variant="outline"
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  Show Available
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
                          <div className="flex justify-between">
                            <span>GST (17%):</span>
                            <span>PKR {foundInvoice.taxAmount.toFixed(2)}</span>
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
                onClick={() => setIsRefundDialogOpen(false)}
              >
                <X className="w-4 h-4 mr-2" />
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

      {/* Customer Selection Dialog */}
      <Dialog open={isCustomerDialogOpen} onOpenChange={setIsCustomerDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <User className="w-5 h-5 text-primary" />
              <span>Select Customer</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search customers by name or phone..."
                className="pl-10"
                onChange={(e) => {
                  const query = e.target.value.toLowerCase();
                  // Filter customers based on search query
                }}
              />
            </div>

            {/* Customer List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {customersLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin" />
                  <p>Loading customers...</p>
                </div>
              ) : customers.length > 0 ? (
                customers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setIsCustomerDialogOpen(false);
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{customer.name}</p>
                        <p className="text-sm text-muted-foreground">{customer.phone}</p>
                        {customer.email && (
                          <p className="text-sm text-muted-foreground">{customer.email}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">PKR {customer.totalPurchases.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{customer.loyaltyPoints} points</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No customers found</p>
                  <p className="text-sm">Add a new customer to get started</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSInterface;