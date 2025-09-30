


import { config } from '../lib/config';

const API_BASE_URL = config.api.baseUrl;
const API_TIMEOUT = config.api.timeout;
const DEBUG_MODE = config.debug.enabled;
const LOG_LEVEL = config.debug.logLevel;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

class ApiService {
  private baseURL: string;
  private token: string | null = null;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private lastRequestTime: Map<string, number> = new Map();

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('token');

    // Listen for storage changes to update token when user logs in from another tab
    window.addEventListener('storage', (e) => {
      if (e.key === 'token') {
        this.token = e.newValue;
      }
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Refresh token from localStorage in case it was updated
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }

    // Check if we have a token for protected endpoints
    const isProtectedEndpoint = !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register');
    if (isProtectedEndpoint && !this.token) {
      console.error('No token available for protected endpoint:', endpoint);
      // Clear any stale user data
      localStorage.removeItem('medibill_user');
      localStorage.removeItem('token');

      // Dispatch event to notify components that user needs to login
      window.dispatchEvent(new CustomEvent('authRequired', {
        detail: { message: 'Please log in to continue' }
      }));

      throw new Error('Authentication required. Please log in.');
    }

    const url = `${this.baseURL}${endpoint}`;

    // Throttling: prevent too many requests to the same endpoint
    const now = Date.now();
    const lastRequest = this.lastRequestTime.get(endpoint) || 0;
    const timeSinceLastRequest = now - lastRequest;

    // Minimum 1 second between requests to the same endpoint
    if (timeSinceLastRequest < 1000) {
      console.log(`Throttling request to ${endpoint}, waiting ${1000 - timeSinceLastRequest}ms`);
      await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
    }

    // Check if there's already a pending request for this endpoint
    if (this.requestQueue.has(endpoint)) {
      console.log(`Reusing pending request for ${endpoint}`);
      return this.requestQueue.get(endpoint)!;
    }

    if (DEBUG_MODE) {
      console.log('API Request:', { url, options, token: this.token ? 'Present' : 'Missing' });
    }

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    if (DEBUG_MODE) {
      console.log('API Request:', {url, options, token: this.token ? 'Present' : 'Missing'});
    }

    // Create a promise for this request
    const requestPromise = (async () => {
      try {
        const response = await fetch(url, config);
        if (DEBUG_MODE) {
          console.log('API Response status:', response.status);
        }

        // Handle rate limiting (429) and other non-JSON responses
        if (response.status === 429) {
          console.warn('Rate limited - too many requests');
          throw new Error('Too many requests. Please wait a moment and try again.');
        }

        let data;
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          if (DEBUG_MODE) {
            console.log('API Response text:', text);
          }
          throw new Error(text || 'An error occurred');
        }

        if (DEBUG_MODE) {
          console.log('API Response data:', data);
        }

        if (!response.ok) {
          console.error('API Error response:', data);

          // Handle authentication errors
          if (response.status === 401) {
            // Clear token and user data
            localStorage.removeItem('token');
            localStorage.removeItem('medibill_user');
            this.token = null;

            // Handle account deactivation specifically
            if (data.code === 'ACCOUNT_DEACTIVATED') {
              // Dispatch custom event for account deactivation
              window.dispatchEvent(new CustomEvent('accountDeactivated', {
                detail: { message: data.message }
              }));
            } else {
              // Dispatch event for general authentication failure
              window.dispatchEvent(new CustomEvent('authRequired', {
                detail: { message: 'Session expired. Please log in again.' }
              }));
            }
          }

          throw new Error(data.message || 'An error occurred');
        }

        return data;
      } catch (error) {
        console.error('API Error:', error);
        throw error;
      } finally {
        // Clean up request queue and update last request time
        this.requestQueue.delete(endpoint);
        this.lastRequestTime.set(endpoint, Date.now());
      }
    })();

    // Store the promise in the queue
    this.requestQueue.set(endpoint, requestPromise);

    return requestPromise;
  }

  // Authentication
  async login(credentials: { usernameOrEmail: string; password: string }) {
    console.log('🔍 API Service: Starting login request with credentials:', { usernameOrEmail: credentials.usernameOrEmail });

    const response = await this.request<{
      user: {
        id: string;
        username: string;
        name: string;
        role: string;
        branchId: string;
        adminId?: string;
      };
      token: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    console.log('🔍 API Service: Login response received:', response);

    if (response.success && response.data) {
      console.log('✅ API Service: Login successful, storing token and user data');
      this.token = response.data.token;
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('medibill_user', JSON.stringify(response.data.user));
    } else {
      console.log('❌ API Service: Login failed:', response.message);
    }

    return response;
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
    name: string;
    role: string;
    branchId: string;
    branchData?: {
      name: string;
      address: string;
      phone: string;
    };
  }) {
    const response = await this.request<{
      user: {
        id: string;
        username: string;
        name: string;
        role: string;
        branchId: string;
        adminId?: string;
      };
      token: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.success && response.data) {
      this.token = response.data.token;
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('medibill_user', JSON.stringify(response.data.user));
    }

    return response;
  }

  async getProfile() {
    return this.request<{
      id: string;
      username: string;
      name: string;
      role: string;
      email: string;
      branchId: string;
      branch?: {
        id: string;
        name: string;
      };
    }>('/auth/profile');
  }

  async changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }) {
    return this.request<{
      success: boolean;
      message: string;
    }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwordData),
    });
  }

  async updateProfile(profileData: {
    name?: string;
    username?: string;
    email?: string;
  }) {
    return this.request<{
      id: string;
      username: string;
      name: string;
      email: string;
      role: string;
      branchId: string;
      updatedAt: string;
    }>('/auth/update-profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // Branches
  async getBranches() {
    return this.request<{
      branches: Array<{
        id: string;
        name: string;
        address: string;
        phone: string;
        email: string;
        managerId?: string;
        isActive: boolean;
        createdAt: string;
        _count?: {
          users: number;
          products: number;
          customers: number;
        };
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>('/branches');
  }

  // Products
  async getProducts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    branchId?: string;
    lowStock?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      products: Array<{
        id: string;
        name: string;
        description?: string;
        category: { id: string; name: string };
        supplier: { id: string; name: string };
        branch: { id: string; name: string };
        costPrice: number;
        sellingPrice: number;
        stock: number;
        minStock: number;
        maxStock?: number;
        unitType: string;
        unitsPerPack: number;
        barcode?: string;
        requiresPrescription: boolean;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/products${query ? `?${query}` : ''}`);
  }

  async getProduct(productId: string) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      category: { id: string; name: string };
      supplier: { id: string; name: string };
      branch: { id: string; name: string };
      costPrice: number;
      sellingPrice: number;
      stock: number;
      minStock: number;
      maxStock?: number;
      unitType: string;
      unitsPerPack: number;
      barcode?: string;
      requiresPrescription: boolean;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      stockMovements: Array<{
        id: string;
        type: string;
        quantity: number;
        reason?: string;
        reference?: string;
        createdAt: string;
      }>;
    }>(`/products/${productId}`);
  }

  async getStockMovements(params?: {
    page?: number;
    limit?: number;
    productId?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    branchId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      stockMovements: Array<{
        id: string;
        type: string;
        quantity: number;
        reason?: string;
        reference?: string;
        createdAt: string;
        product: {
          id: string;
          name: string;
          sku?: string;
          unitType: string;
          branch: {
            id: string;
            name: string;
          };
        };
        createdBy?: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/products/stock-movements${query ? `?${query}` : ''}`);
  }

  async createProduct(productData: {
    name: string;
    description?: string;
    categoryId: string;
    supplierId: string;
    branchId: string;
    costPrice: number;
    sellingPrice: number;
    stock: number;
    minStock: number;
    maxStock?: number;
    unitType: string;
    unitsPerPack: number;
    barcode?: string;
    requiresPrescription: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      category: { id: string; name: string };
      supplier: { id: string; name: string };
      branch: { id: string; name: string };
      costPrice: number;
      sellingPrice: number;
      stock: number;
      minStock: number;
      maxStock?: number;
      unitType: string;
      unitsPerPack: number;
      barcode?: string;
      requiresPrescription: boolean;
      isActive: boolean;
      createdAt: string;
    }>('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  }

  async bulkImportProducts(products: Array<{
    name: string;
    description?: string;
    categoryId: string;
    categoryName?: string; // For auto-creating categories
    supplierId: string;
    branchId: string;
    costPrice: number;
    sellingPrice: number;
    stock: number;
    minStock?: number;
    maxStock?: number;
    unitType: string;
    unitsPerPack: number;
    barcode?: string;
    requiresPrescription?: boolean;
  }>) {
    return this.request<{
      successful: Array<{
        id: string;
        name: string;
        description?: string;
        category: { id: string; name: string };
        supplier: { id: string; name: string };
        branch: { id: string; name: string };
        costPrice: number;
        sellingPrice: number;
        stock: number;
        minStock: number;
        maxStock?: number;
        unitType: string;
        unitsPerPack: number;
        barcode?: string;
        requiresPrescription: boolean;
        isActive: boolean;
        createdAt: string;
      }>;
      failed: Array<{
        product: any;
        error: string;
      }>;
      total: number;
      successCount: number;
      failureCount: number;
    }>('/products/bulk-import', {
      method: 'POST',
      body: JSON.stringify({ products }),
    });
  }

  async updateProduct(productId: string, productData: {
    name?: string;
    description?: string;
    categoryId?: string;
    supplierId?: string;
    costPrice?: number;
    sellingPrice?: number;
    stock?: number;
    minStock?: number;
    maxStock?: number;
    unitType?: string;
    unitsPerPack?: number;
    barcode?: string;
    requiresPrescription?: boolean;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      category: { id: string; name: string };
      supplier: { id: string; name: string };
      branch: { id: string; name: string };
      costPrice: number;
      sellingPrice: number;
      stock: number;
      minStock: number;
      maxStock?: number;
      unitType: string;
      unitsPerPack: number;
      barcode?: string;
      requiresPrescription: boolean;
      isActive: boolean;
      updatedAt: string;
    }>(`/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  }

  async deleteProduct(productId: string) {
    return this.request<{ message: string }>(`/products/${productId}`, {
      method: 'DELETE',
    });
  }

  async bulkDeleteProducts(productIds: string[]) {
    return this.request<{
      message: string;
      data: {
        deletedCount: number;
        deletedProducts: Array<{ id: string; name: string }>
      }
    }>('/products/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ productIds }),
    });
  }

  async updateStock(productId: string, stockData: {
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
    quantity: number;
    reason?: string;
    reference?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      stock: number;
      category: { id: string; name: string };
      supplier: { id: string; name: string };
      branch: { id: string; name: string };
    }>(`/products/${productId}/stock`, {
      method: 'PATCH',
      body: JSON.stringify(stockData),
    });
  }

  // Customers
  async getCustomers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
    vip?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    const url = query ? `/customers?${query}` : '/customers';
    return this.request<{
      customers: Array<{
        id: string;
        name: string;
        phone: string;
        email?: string;
        address?: string;
        branch: { id: string; name: string };
        totalPurchases: number;
        loyaltyPoints: number;
        isVIP: boolean;
        lastVisit?: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(url);
  }

  async createCustomer(customerData: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    branchId: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      phone: string;
      email?: string;
      address?: string;
      branch: { id: string; name: string };
      totalPurchases: number;
      loyaltyPoints: number;
      isVIP: boolean;
      lastVisit?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>('/customers', {
      method: 'POST',
      body: JSON.stringify(customerData),
    });
  }

  // Sales
  async createSale(saleData: {
    customerId?: string;
    branchId: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      batchNumber?: string;
      expiryDate?: string;
    }>;
    paymentMethod: 'CASH' | 'CARD' | 'MOBILE' | 'BANK_TRANSFER';
    discountAmount?: number;
  }) {
    return this.request<{
      id: string;
      customer?: {
        id: string;
        name: string;
        phone: string;
        email?: string;
        address?: string;
        totalPurchases: number;
        loyaltyPoints: number;
        isVIP: boolean;
        lastVisit?: string;
      };
      items: Array<{
        id: string;
        product: {
          id: string;
          name: string;
          unitType: string;
          barcode?: string;
        };
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        batchNumber?: string;
        expiryDate?: string;
      }>;
      subtotal: number;
      taxAmount: number;
      discountAmount: number;
      totalAmount: number;
      paymentMethod: string;
      paymentStatus: string;
      status: string;
      createdAt: string;
      receiptNumber: string;
    }>('/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
  }

  async getSales(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    branchId?: string;
    customerId?: string;
    paymentMethod?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      sales: Array<{
        id: string;
        customerId?: string;
        userId: string;
        branchId: string;
        subtotal: number;
        taxAmount: number;
        discountAmount: number;
        totalAmount: number;
        paymentMethod: string;
        paymentStatus: string;
        status: string;
        createdAt: string;
        customer?: {
          id: string;
          name: string;
          phone: string;
        };
        user: {
          id: string;
          name: string;
          username: string;
        };
        branch: {
          id: string;
          name: string;
        };
        items: Array<{
          id: string;
          productId: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          product: {
            id: string;
            name: string;
            unitType: string;
          };
        }>;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/sales${query ? `?${query}` : ''}`);
  }

  async getSale(id: string) {
    return this.request<{
      id: string;
      customerId?: string;
      userId: string;
      branchId: string;
      subtotal: number;
      taxAmount: number;
      discountAmount: number;
      totalAmount: number;
      paymentMethod: string;
      paymentStatus: string;
      status: string;
      createdAt: string;
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
      items: Array<{
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
      }>;
      receipts: Array<{
        id: string;
        receiptNumber: string;
        printedAt?: string;
      }>;
    }>(`/sales/${id}`);
  }

  async getSaleByReceiptNumber(receiptNumber: string) {
    return this.request<{
      id: string;
      customerId?: string;
      userId: string;
      branchId: string;
      subtotal: number;
      taxAmount: number;
      discountAmount: number;
      totalAmount: number;
      paymentMethod: string;
      paymentStatus: string;
      status: string;
      createdAt: string;
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
      items: Array<{
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
      }>;
      receipts: Array<{
        id: string;
        receiptNumber: string;
        printedAt?: string;
      }>;
    }>(`/sales/receipt/${receiptNumber}`);
  }

  async getAvailableReceiptNumbers() {
    return this.request<{
      receipts: Array<{
        id: string;
        receiptNumber: string;
        saleId: string;
        printedAt: string;
      }>;
    }>('/sales/receipts');
  }

  // Customer Purchase History
  async getCustomerPurchaseHistory(customerId: string, params?: {
    page?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      customer: {
        id: string;
        name: string;
        phone: string;
      };
      sales: Array<{
        id: string;
        totalAmount: number;
        subtotal: number;
        taxAmount: number;
        paymentMethod: string;
        createdAt: string;
        items: Array<{
          id: string;
          product: {
            id: string;
            name: string;
            unitType: string;
          };
          quantity: number;
          unitPrice: number;
          totalPrice: number;
        }>;
        user: {
          name: string;
          username: string;
        };
        branch: {
          name: string;
        };
      }>;
      stats: {
        totalPurchases: number;
        totalSpent: number;
        averageOrder: number;
      };
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/customers/${customerId}/purchase-history${query ? `?${query}` : ''}`);
  }

  // Reports
  async getSalesReport(params?: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
    groupBy?: 'day' | 'week' | 'month' | 'year';
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      summary: {
        totalSales: number;
        totalRevenue: number;
        totalSubtotal: number;
        totalTax: number;
        totalDiscount: number;
      };
      salesByPaymentMethod: Array<{
        paymentMethod: string;
        _sum: { totalAmount: number };
        _count: { id: number };
      }>;
      topProducts: Array<{
        productId: string;
        _sum: { quantity: number; totalPrice: number };
        product: {
          id: string;
          name: string;
          unitType: string;
          category: { name: string };
        };
      }>;
      salesTrend: Array<{
        createdAt: Date;
        _sum: { totalAmount: number };
        _count: { id: number };
      }>;
    }>(`/reports/sales${query ? `?${query}` : ''}`);
  }

  async getInventoryReport(params?: {
    branchId?: string;
    lowStock?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      summary: {
        totalProducts: number;
        totalStock: number;
        lowStockCount: number;
      };
      productsByCategory: Array<{
        categoryId: string;
        _sum: { stock: number };
        _count: { id: number };
        category: {
          id: string;
          name: string;
        };
      }>;
      lowStockProducts: Array<{
        id: string;
        name: string;
        stock: number;
        minStock: number;
        category: { name: string };
        supplier: { name: string };
      }>;
    }>(`/reports/inventory${query ? `?${query}` : ''}`);
  }

  async getCustomerReport(params?: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
    vip?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      summary: {
        totalCustomers: number;
        totalSpent: number;
        totalLoyaltyPoints: number;
        averageSpent: number;
      };
      customersByVIP: Array<{
        isVIP: boolean;
        _count: { id: number };
        _sum: { totalPurchases: number; loyaltyPoints: number };
      }>;
      topCustomers: Array<{
        id: string;
        name: string;
        phone: string;
        totalPurchases: number;
        loyaltyPoints: number;
        lastVisit: string;
        isVIP: boolean;
        _count: { sales: number };
      }>;
      recentCustomers: Array<{
        id: string;
        name: string;
        phone: string;
        createdAt: string;
        totalPurchases: number;
      }>;
    }>(`/reports/customers${query ? `?${query}` : ''}`);
  }

  async getProductPerformanceReport(params?: {
    startDate?: string;
    endDate?: string;
    branchId?: string;
    categoryId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      topProducts: Array<{
        productId: string;
        _sum: { quantity: number; totalPrice: number };
        _count: { id: number };
        product: {
          id: string;
          name: string;
          unitType: string;
          sellingPrice: number;
          stock: number;
          category: { name: string };
          supplier: { name: string };
        };
      }>;
      categoryPerformance: Array<{
        category: string;
        quantity: number;
        revenue: number;
        count: number;
      }>;
    }>(`/reports/products${query ? `?${query}` : ''}`);
  }

  // Admin Management (SuperAdmin only)
  async getAdmins(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      admins: Array<{
        id: string;
        name: string;
        email: string;
        phone: string;
        company: string;
        address: string;
        userCount: number;
        managerCount: number;
        totalSales: number;
        lastActive: string;
        status: 'active' | 'inactive';
        plan: 'basic' | 'premium' | 'enterprise';
        createdAt: string;
        subscriptionEnd: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/admin${query ? `?${query}` : ''}`);
  }

  async getAdmin(adminId: string) {
    return this.request<{
      id: string;
      name: string;
      email: string;
      phone: string;
      company: string;
      address: string;
      userCount: number;
      managerCount: number;
      totalSales: number;
      lastActive: string;
      status: 'active' | 'inactive';
      plan: 'basic' | 'premium' | 'enterprise';
      createdAt: string;
      subscriptionEnd: string;
    }>(`/admin/${adminId}`);
  }

  async createAdmin(adminData: {
    name: string;
    email: string;
    phone: string;
    company: string;
    plan: 'basic' | 'premium' | 'enterprise';
    branchId: string | null;
    password: string;
  }) {
    console.log('API createAdmin called with data:', adminData);
    return this.request<{
      id: string;
      name: string;
      email: string;
      phone: string;
      company: string;
      address: string;
      userCount: number;
      managerCount: number;
      totalSales: number;
      lastActive: string;
      status: 'active' | 'inactive';
      plan: 'basic' | 'premium' | 'enterprise';
      createdAt: string;
      subscriptionEnd: string;
    }>('/admin', {
      method: 'POST',
      body: JSON.stringify(adminData),
    });
  }

  async updateAdmin(adminId: string, adminData: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    plan?: 'basic' | 'premium' | 'enterprise';
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      email: string;
      phone: string;
      company: string;
      address: string;
      userCount: number;
      managerCount: number;
      totalSales: number;
      lastActive: string;
      status: 'active' | 'inactive';
      plan: 'basic' | 'premium' | 'enterprise';
      createdAt: string;
      subscriptionEnd: string;
    }>(`/admin/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify(adminData),
    });
  }

  async deleteAdmin(adminId: string) {
    return this.request<{ message: string }>(`/admin/${adminId}`, {
      method: 'DELETE',
    });
  }

  async getAdminUsers(adminId: string) {
    return this.request<Array<{
      id: string;
      name: string;
      email: string;
      adminId: string;
      lastActive: string;
      status: 'active' | 'inactive';
      role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER';
      createdAt: string;
    }>>(`/admin/${adminId}/users`);
  }

  async getSuperAdminStats() {
    return this.request<{
      totalAdmins: number;
      totalUsers: number;
      totalSales: number;
      activeAdmins: number;
      recentAdmins: Array<{
        id: string;
        name: string;
        company: string;
        userCount: number;
        totalSales: number;
      }>;
    }>('/admin/stats');
  }

  // User Management Methods
  async getUsers(params?: { page?: number; limit?: number; role?: string; branchId?: string }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.role) queryParams.append('role', params.role);
    if (params?.branchId) queryParams.append('branchId', params.branchId);

    const queryString = queryParams.toString();
    const url = queryString ? `/users?${queryString}` : '/users';

    return this.request<{
      users: Array<{
        id: string;
        username: string;
        name: string;
        email: string;
        role: string;
        branchId: string;
        branch: {
          id: string;
          name: string;
        };
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(url);
  }

  async getUser(userId: string) {
    return this.request<{
      id: string;
      username: string;
      name: string;
      email: string;
      role: string;
      branchId: string;
      branch: {
        id: string;
        name: string;
      };
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>(`/users/${userId}`);
  }

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    name: string;
    role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'CASHIER';
    branchId: string | null;
  }) {
    return this.request<{
      id: string;
      username: string;
      name: string;
      email: string;
      role: string;
      branchId: string;
      branch: {
        id: string;
        name: string;
      };
      isActive: boolean;
      createdAt: string;
    }>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(userId: string, userData: {
    username?: string;
    email?: string;
    password?: string;
    name?: string;
    role?: 'MANAGER' | 'CASHIER';
    branchId?: string;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      username: string;
      name: string;
      email: string;
      role: string;
      branchId: string;
      branch: {
        id: string;
        name: string;
      };
      isActive: boolean;
      updatedAt: string;
    }>(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(userId: string) {
    return this.request<{ message: string }>(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Categories
  async getCategories(params?: {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      categories: Array<{
        id: string;
        name: string;
        description?: string;
        createdAt: string;
        updatedAt: string;
        _count: {
          products: number;
        };
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/categories${query ? `?${query}` : ''}`);
  }

  async getCategory(categoryId: string) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      createdAt: string;
      updatedAt: string;
      _count: {
        products: number;
      };
    }>(`/categories/${categoryId}`);
  }

  async createCategory(categoryData: {
    name: string;
    description?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      createdAt: string;
    }>('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  }

  async updateCategory(categoryId: string, categoryData: {
    name?: string;
    description?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      updatedAt: string;
    }>(`/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  }

  async deleteCategory(categoryId: string) {
    return this.request<{ message: string }>(`/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  // Suppliers
  async getSuppliers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    active?: boolean;
    branchId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    const query = queryParams.toString();
    return this.request<{
      suppliers: Array<{
        id: string;
        name: string;
        contactPerson: string;
        phone: string;
        email: string;
        address: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        _count: {
          products: number;
        };
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/suppliers${query ? `?${query}` : ''}`);
  }

  async getSupplier(supplierId: string) {
    return this.request<{
      id: string;
      name: string;
      contactPerson: string;
      phone: string;
      email: string;
      address: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      _count: {
        products: number;
      };
    }>(`/suppliers/${supplierId}`);
  }

  async createSupplier(supplierData: {
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      contactPerson: string;
      phone: string;
      email: string;
      address: string;
      isActive: boolean;
      createdAt: string;
    }>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(supplierData),
    });
  }

  async updateSupplier(supplierId: string, supplierData: {
    name?: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
    address?: string;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      contactPerson: string;
      phone: string;
      email: string;
      address: string;
      isActive: boolean;
      updatedAt: string;
    }>(`/suppliers/${supplierId}`, {
      method: 'PUT',
      body: JSON.stringify(supplierData),
    });
  }

  async deleteSupplier(supplierId: string) {
    return this.request<{ message: string }>(`/suppliers/${supplierId}`, {
      method: 'DELETE',
    });
  }

  // Dashboard APIs
  async getDashboardStats(branchId?: string) {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);

    return this.request<{
      todayStats: {
        sales: number;
        revenue: number;
        subtotal: number;
        tax: number;
      };
      totalStats: {
        sales: number;
        revenue: number;
        subtotal: number;
        tax: number;
      };
      inventory: {
        totalProducts: number;
        lowStockProducts: number;
      };
      customers: {
        total: number;
      };
      recentSales: Array<{
        id: string;
        totalAmount: number;
        createdAt: string;
        customer: {
          id: string;
          name: string;
          phone: string;
        };
        user: {
          id: string;
          name: string;
          username: string;
        };
      }>;
    }>(`/dashboard/stats?${params.toString()}`);
  }

  async getSalesChart(branchId?: string, period: string = '7d', groupBy: string = 'day') {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);
    params.append('period', period);
    params.append('groupBy', groupBy);

    return this.request<{
      period: string;
      groupBy: string;
      chartData: Array<{
        date?: string;
        week?: string;
        month?: string;
        revenue: number;
        sales: number;
      }>;
    }>(`/dashboard/chart?${params.toString()}`);
  }

  async getLowStockProducts(branchId?: string) {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);

    return this.request<{
      products: Array<{
        id: string;
        name: string;
        stock: number;
        minStock: number;
        unitType: string;
        expiryDate?: string;
      }>;
    }>(`/products/low-stock?${params.toString()}`);
  }

  // Admin Dashboard APIs
  async getAdminDashboardStats() {
    return this.request<{
      totalRevenue: number;
      totalSales: number;
      totalUsers: number;
      totalBranches: number;
      recentSales: Array<{
        id: string;
        totalAmount: number;
        createdAt: string;
        customer: {
          id: string;
          name: string;
          phone: string;
        };
        user: {
          id: string;
          name: string;
          username: string;
        };
        branch: {
          id: string;
          name: string;
        };
      }>;
      lowStockProducts: Array<{
        id: string;
        name: string;
        stock: number;
        minStock: number;
        unitType: string;
        expiryDate?: string;
        branch: {
          name: string;
        };
      }>;
      branchPerformance: Array<{
        id: string;
        name: string;
        users: number;
        sales: number;
        revenue: number;
      }>;
      recentUsers: Array<{
        id: string;
        name: string;
        username: string;
        branch: string;
        lastPurchase: string;
        lastPurchaseAmount: number;
      }>;
    }>('/dashboard/admin-stats');
  }

  async getTopSellingProducts(branchId?: string, limit: number = 10) {
    const params = new URLSearchParams();
    if (branchId && branchId !== '') params.append('branchId', branchId);
    params.append('limit', limit.toString());

    return this.request<Array<{
      productId: string;
      product: {
        id: string;
        name: string;
        unitType: string;
        category: {
          name: string;
        };
      };
      totalQuantity: number;
      totalRevenue: number;
      totalSales: number;
    }>>(`/reports/top-products?${params.toString()}`);
  }

  async getSalesByPaymentMethod(branchId?: string) {
    const params = new URLSearchParams();
    if (branchId && branchId !== '') params.append('branchId', branchId);

    return this.request<Array<{
      paymentMethod: string;
      _sum: {
        totalAmount: number;
      };
      _count: {
        id: number;
      };
    }>>(`/reports/payment-methods?${params.toString()}`);
  }

  async getDashboardData(branchId?: string) {
    const params = new URLSearchParams();
    if (branchId && branchId !== '') params.append('branchId', branchId);

    return this.request<{
      today: {
        revenue: number;
        profit: number;
        transactions: number;
        growth: number;
      };
      month: {
        revenue: number;
        profit: number;
        transactions: number;
        growth: number;
      };
      recentSales: Array<{
        id: string;
        totalAmount: number;
        createdAt: string;
        customer: {
          name: string;
          phone: string;
        } | null;
        items: Array<{
          product: {
            name: string;
          };
          quantity: number;
          totalPrice: number;
        }>;
      }>;
    }>(`/reports/dashboard?${params.toString()}`);
  }

  // Employee Management
  async getEmployees(params?: { page?: number; limit?: number; search?: string; status?: string; branchId?: string; isActive?: boolean }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.branchId) queryParams.append('branchId', params.branchId);
    if (params?.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());

    return this.request<{
      employees: Array<{
        id: string;
        employeeId: string;
        name: string;
        email: string;
        phone?: string;
        address?: string;
        position: string;
        department?: string;
        salary?: number;
        hireDate: string;
        status: string;
        branchId: string;
        branch: {
          id: string;
          name: string;
        };
        emergencyContactName?: string;
        emergencyContactPhone?: string;
        emergencyContactRelation?: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/employees?${queryParams.toString()}`);
  }

  async getEmployee(id: string) {
    return this.request<{
      id: string;
      employeeId: string;
      name: string;
      email: string;
      phone?: string;
      address?: string;
      position: string;
      department?: string;
      salary?: number;
      hireDate: string;
      status: string;
      branchId: string;
      branch: {
        id: string;
        name: string;
      };
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      emergencyContactRelation?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>(`/employees/${id}`);
  }

  async createEmployee(employeeData: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
    position: string;
    department?: string;
    salary?: number;
    hireDate: string;
    status?: string;
    branchId: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;
  }) {
    return this.request<{
      id: string;
      employeeId: string;
      name: string;
      email: string;
      phone?: string;
      address?: string;
      position: string;
      department?: string;
      salary?: number;
      hireDate: string;
      status: string;
      branchId: string;
      branch: {
        id: string;
        name: string;
      };
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      emergencyContactRelation?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
  }

  async updateEmployee(id: string, employeeData: {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    position?: string;
    department?: string;
    salary?: number;
    hireDate?: string;
    status?: string;
    branchId?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      employeeId: string;
      name: string;
      email: string;
      phone?: string;
      address?: string;
      position: string;
      department?: string;
      salary?: number;
      hireDate: string;
      status: string;
      branchId: string;
      branch: {
        id: string;
        name: string;
      };
      emergencyContactName?: string;
      emergencyContactPhone?: string;
      emergencyContactRelation?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData)
    });
  }

  async deleteEmployee(id: string) {
    return this.request<{ message: string }>(`/employees/${id}`, {
      method: 'DELETE'
    });
  }

  async getEmployeeStats(branchId?: string) {
    const params = new URLSearchParams();
    if (branchId) params.append('branchId', branchId);

    return this.request<{
      totalEmployees: number;
      activeEmployees: number;
      inactiveEmployees: number;
      terminatedEmployees: number;
      onLeaveEmployees: number;
    }>(`/employees/stats?${params.toString()}`);
  }

  // Attendance Management
  async checkIn(attendanceData: {
    employeeId: string;
    branchId: string;
    notes?: string;
  }) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      checkIn: string;
      checkOut?: string;
      totalHours?: number;
      status: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(attendanceData)
    });
  }

  async checkOut(attendanceData: {
    attendanceId: string;
    notes?: string;
  }) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      checkIn: string;
      checkOut: string;
      totalHours: number;
      status: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(attendanceData)
    });
  }

  async getAttendance(params?: {
    page?: number;
    limit?: number;
    employeeId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return this.request<{
      attendance: Array<{
        id: string;
        employeeId: string;
        branchId: string;
        checkIn: string;
        checkOut?: string;
        totalHours?: number;
        status: string;
        notes?: string;
        employee: {
          id: string;
          name: string;
          employeeId: string;
          position: string;
        };
        branch: {
          id: string;
          name: string;
        };
        createdAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/attendance?${queryParams.toString()}`);
  }

  async getTodayAttendance(employeeId: string) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      checkIn: string;
      checkOut?: string;
      totalHours?: number;
      status: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>(`/attendance/today/${employeeId}`);
  }

  async getAttendanceStats(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return this.request<{
      totalRecords: number;
      presentCount: number;
      absentCount: number;
      lateCount: number;
      halfDayCount: number;
      leaveCount: number;
    }>(`/attendance/stats?${queryParams.toString()}`);
  }

  // Shift Management
  async startShift(shiftData: {
    employeeId: string;
    branchId: string;
    shiftDate: string;
    startTime: string;
    openingBalance?: number;
    notes?: string;
  }) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      shiftDate: string;
      startTime: string;
      endTime?: string;
      openingBalance: number;
      cashIn: number;
      cashOut: number;
      expectedBalance?: number;
      actualBalance?: number;
      difference?: number;
      status: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>('/shifts/start', {
      method: 'POST',
      body: JSON.stringify(shiftData)
    });
  }

  async endShift(shiftData: {
    shiftId: string;
    endTime: string;
    actualBalance: number;
    notes?: string;
  }) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      shiftDate: string;
      startTime: string;
      endTime: string;
      openingBalance: number;
      cashIn: number;
      cashOut: number;
      expectedBalance: number;
      actualBalance: number;
      difference: number;
      status: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>('/shifts/end', {
      method: 'POST',
      body: JSON.stringify(shiftData)
    });
  }

  async getShifts(params?: {
    page?: number;
    limit?: number;
    employeeId?: string;
    branchId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return this.request<{
      shifts: Array<{
        id: string;
        employeeId: string;
        branchId: string;
        shiftDate: string;
        startTime: string;
        endTime?: string;
        openingBalance: number;
        cashIn: number;
        cashOut: number;
        expectedBalance?: number;
        actualBalance?: number;
        difference?: number;
        status: string;
        notes?: string;
        employee: {
          id: string;
          name: string;
          employeeId: string;
          position: string;
        };
        branch: {
          id: string;
          name: string;
        };
        createdAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/shifts?${queryParams.toString()}`);
  }

  async getActiveShift(employeeId: string) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      shiftDate: string;
      startTime: string;
      endTime?: string;
      openingBalance: number;
      cashIn: number;
      cashOut: number;
      expectedBalance?: number;
      actualBalance?: number;
      difference?: number;
      status: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>(`/shifts/active/${employeeId}`);
  }

  async updateShift(shiftId: string, shiftData: {
    cashIn?: number;
    cashOut?: number;
    notes?: string;
  }) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      shiftDate: string;
      startTime: string;
      endTime?: string;
      openingBalance: number;
      cashIn: number;
      cashOut: number;
      expectedBalance?: number;
      actualBalance?: number;
      difference?: number;
      status: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>(`/shifts/${shiftId}`, {
      method: 'PUT',
      body: JSON.stringify(shiftData)
    });
  }

  async getShiftStats(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return this.request<{
      totalShifts: number;
      activeShifts: number;
      completedShifts: number;
      cancelledShifts: number;
      totalCashIn: number;
      totalCashOut: number;
      totalDifference: number;
    }>(`/shifts/stats?${queryParams.toString()}`);
  }

  // Commission Management
  async calculateCommission(commissionData: {
    employeeId: string;
    branchId: string;
    period: string;
    periodType?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
    baseRate?: number;
    bonusRate?: number;
    notes?: string;
  }) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      period: string;
      periodType: string;
      totalSales: number;
      totalTransactions: number;
      averageSale: number;
      baseRate: number;
      bonusRate: number;
      totalCommission: number;
      bonusAmount: number;
      totalAmount: number;
      status: string;
      paidAt?: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>('/commissions/calculate', {
      method: 'POST',
      body: JSON.stringify(commissionData)
    });
  }

  async getCommissions(params?: {
    page?: number;
    limit?: number;
    employeeId?: string;
    branchId?: string;
    status?: string;
    periodType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return this.request<{
      commissions: Array<{
        id: string;
        employeeId: string;
        branchId: string;
        period: string;
        periodType: string;
        totalSales: number;
        totalTransactions: number;
        averageSale: number;
        baseRate: number;
        bonusRate: number;
        totalCommission: number;
        bonusAmount: number;
        totalAmount: number;
        status: string;
        paidAt?: string;
        notes?: string;
        employee: {
          id: string;
          name: string;
          employeeId: string;
          position: string;
        };
        branch: {
          id: string;
          name: string;
        };
        createdAt: string;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/commissions?${queryParams.toString()}`);
  }

  async getCommission(commissionId: string) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      period: string;
      periodType: string;
      totalSales: number;
      totalTransactions: number;
      averageSale: number;
      baseRate: number;
      bonusRate: number;
      totalCommission: number;
      bonusAmount: number;
      totalAmount: number;
      status: string;
      paidAt?: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>(`/commissions/${commissionId}`);
  }

  async updateCommission(commissionId: string, commissionData: {
    status?: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED';
    notes?: string;
  }) {
    return this.request<{
      id: string;
      employeeId: string;
      branchId: string;
      period: string;
      periodType: string;
      totalSales: number;
      totalTransactions: number;
      averageSale: number;
      baseRate: number;
      bonusRate: number;
      totalCommission: number;
      bonusAmount: number;
      totalAmount: number;
      status: string;
      paidAt?: string;
      notes?: string;
      employee: {
        id: string;
        name: string;
        employeeId: string;
        position: string;
      };
      branch: {
        id: string;
        name: string;
      };
      createdAt: string;
    }>(`/commissions/${commissionId}`, {
      method: 'PUT',
      body: JSON.stringify(commissionData)
    });
  }

  async getCommissionStats(params?: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return this.request<{
      totalCommissions: number;
      pendingCommissions: number;
      approvedCommissions: number;
      paidCommissions: number;
      cancelledCommissions: number;
      totalAmount: number;
      totalPaidAmount: number;
    }>(`/commissions/stats?${queryParams.toString()}`);
  }

  async getEmployeePerformance(employeeId: string, params?: {
    startDate?: string;
    endDate?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          queryParams.append(key, value.toString());
        }
      });
    }

    return this.request<{
      sales: {
        totalSales: number;
        totalTransactions: number;
        averageSale: number;
      };
      commissions: {
        totalCommissions: number;
        totalAmount: number;
        totalCommission: number;
        totalBonus: number;
      };
      recentCommissions: Array<{
        id: string;
        period: string;
        periodType: string;
        totalAmount: number;
        status: string;
        createdAt: string;
        branch: {
          id: string;
          name: string;
        };
      }>;
    }>(`/commissions/performance/${employeeId}?${queryParams.toString()}`);
  }

  // Branch Management

  async getBranch(id: string) {
    return this.request<{
      id: string;
      name: string;
      address: string;
      phone: string;
      email: string;
      managerId?: string;
      isActive: boolean;
      createdAt: string;
      _count: {
        users: number;
        products: number;
        customers: number;
      };
    }>(`/branches/${id}`);
  }

  async createBranch(branchData: {
    name: string;
    address: string;
    phone: string;
    email: string;
    managerId?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      address: string;
      phone: string;
      email: string;
      managerId?: string;
      isActive: boolean;
      createdAt: string;
    }>('/branches', {
      method: 'POST',
      body: JSON.stringify(branchData),
    });
  }

  async updateBranch(id: string, branchData: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    managerId?: string;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      address: string;
      phone: string;
      email: string;
      managerId?: string;
      isActive: boolean;
      createdAt: string;
    }>(`/branches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(branchData),
    });
  }

  async deleteBranch(id: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>(`/branches/${id}`, {
      method: 'DELETE',
    });
  }

  // Subscription Management
  async getSubscription() {
    return this.request<{
      id: string;
      plan: 'basic' | 'premium' | 'enterprise';
      status: 'active' | 'expired' | 'cancelled' | 'pending';
      startDate: string;
      endDate: string;
      amount: number;
      billingCycle: 'monthly' | 'yearly';
      autoRenew: boolean;
      remainingDays: number;
      features: string[];
    }>('/subscription');
  }

  async updateSubscription(subscriptionData: {
    plan?: 'basic' | 'premium' | 'enterprise';
    autoRenew?: boolean;
  }) {
    return this.request<{
      plan: string;
      autoRenew: boolean;
      updatedAt: string;
    }>('/subscription', {
      method: 'PUT',
      body: JSON.stringify(subscriptionData),
    });
  }

  async getPaymentMethods() {
    return this.request<Array<{
      id: string;
      type: 'card' | 'bank' | 'mobile';
      last4: string;
      brand: string;
      expiryMonth: number;
      expiryYear: number;
      isDefault: boolean;
      holderName: string;
    }>>('/subscription/payment-methods');
  }

  async addPaymentMethod(paymentMethodData: {
    type: 'card' | 'bank' | 'mobile';
    last4: string;
    brand: string;
    expiryMonth: number;
    expiryYear: number;
    holderName: string;
    isDefault?: boolean;
  }) {
    return this.request<{
      id: string;
      type: string;
      last4: string;
      brand: string;
      expiryMonth: number;
      expiryYear: number;
      isDefault: boolean;
      holderName: string;
      createdAt: string;
    }>('/subscription/payment-methods', {
      method: 'POST',
      body: JSON.stringify(paymentMethodData),
    });
  }

  async setDefaultPaymentMethod(methodId: string) {
    return this.request<{ message: string }>(`/subscription/payment-methods/${methodId}/default`, {
      method: 'PUT',
    });
  }

  async deletePaymentMethod(methodId: string) {
    return this.request<{ message: string }>(`/subscription/payment-methods/${methodId}`, {
      method: 'DELETE',
    });
  }

  async getBillingHistory() {
    return this.request<Array<{
      id: string;
      amount: number;
      status: 'success' | 'failed' | 'pending';
      method: string;
      date: string;
      invoiceNumber: string;
      description: string;
    }>>('/subscription/billing-history');
  }

  async downloadInvoice(invoiceId: string) {
    return this.request<{
      invoiceId: string;
      downloadUrl: string;
    }>(`/subscription/invoices/${invoiceId}/download`);
  }

  // Logout
  logout() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  // Refunds
  async createRefund(refundData: {
    originalSaleId: string;
    refundReason: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      reason: string;
    }>;
    refundedBy: string;
  }) {
    return this.request<{
      refund: {
        id: string;
        originalSaleId: string;
        refundReason: string;
        refundAmount: string | number;
        refundedBy: string;
        status: string;
        processedAt?: string;
        createdAt: string;
        updatedAt: string;
      };
      items: Array<{
        id: string;
        refundId: string;
        productId: string;
        quantity: number;
        unitPrice: number;
        reason: string;
      }>;
    }>('/refunds', {
      method: 'POST',
      body: JSON.stringify(refundData),
    });
  }

  async getRefunds(params?: {
    page?: number;
    limit?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    branchId?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.branchId) queryParams.append('branchId', params.branchId);

    return this.request<{
      refunds: Array<{
        id: string;
        originalSaleId: string;
        refundReason: string;
        refundAmount: string | number;
        refundedBy: string;
        status: string;
        processedAt?: string;
        createdAt: string;
        updatedAt: string;
        originalSale: {
          id: string;
          receiptNumber?: string;
          totalAmount: number;
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
        };
        items: Array<{
          id: string;
          productId: string;
          quantity: number;
          unitPrice: number;
          reason: string;
          product: {
            id: string;
            name: string;
            description?: string;
          };
        }>;
        refundedByUser: {
          id: string;
          name: string;
          username: string;
        };
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/refunds?${queryParams.toString()}`);
  }

  async getRefundById(id: string) {
    return this.request<{
      id: string;
      originalSaleId: string;
      refundReason: string;
      refundAmount: string | number;
      refundedBy: string;
      status: string;
      processedAt?: string;
      createdAt: string;
      updatedAt: string;
      originalSale: {
        id: string;
        receiptNumber?: string;
        totalAmount: number;
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
        items: Array<{
          id: string;
          productId: string;
          quantity: number;
          unitPrice: number;
          product: {
            id: string;
            name: string;
            description?: string;
          };
        }>;
      };
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        unitPrice: number;
        reason: string;
        product: {
          id: string;
          name: string;
          description?: string;
        };
      }>;
      refundedByUser: {
        id: string;
        name: string;
        username: string;
      };
    }>(`/refunds/${id}`);
  }

}

export const apiService = new ApiService(API_BASE_URL);
export default apiService;