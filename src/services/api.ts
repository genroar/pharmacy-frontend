


import { config } from '../lib/config';
import { waitForBackend, checkBackendHealth } from '../utils/backendHealthCheck';

const API_BASE_URL = config.api.baseUrl;
const API_TIMEOUT = config.api.timeout;
const DEBUG_MODE = config.debug.enabled;
const LOG_LEVEL = config.debug.logLevel;

// Track if backend is ready
let backendReady = false;
let backendCheckPromise: Promise<boolean> | null = null;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  accountDisabled?: boolean;
}

class ApiService {
  private baseURL: string;
  private token: string | null = null;
  private requestQueue: Map<string, Promise<any>> = new Map();
  private lastRequestTime: Map<string, number> = new Map();
  private getContext: (() => { companyId?: string; branchId?: string }) | null = null;

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

  // Method to set the context getter function
  setContextGetter(getContext: () => { companyId?: string; branchId?: string }) {
    this.getContext = getContext;
  }

  // Method to update the token
  setToken(token: string | null) {
    this.token = token;
  }

  // Method to reset backend ready state (useful after backend restart)
  resetBackendReady() {
    backendReady = false;
    backendCheckPromise = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Check if backend is ready (only for Electron, wait for backend to start)
    const isElectron = typeof window !== 'undefined' && typeof (window as any).electronAPI !== 'undefined';
    const isHealthEndpoint = endpoint.includes('/health');

    // For Electron, wait for backend to be ready (but not for health check itself)
    if (isElectron && !isHealthEndpoint && !backendReady) {
      if (!backendCheckPromise) {
        backendCheckPromise = waitForBackend(this.baseURL).then((ready) => {
          backendReady = ready;
          return ready;
        }).catch(() => {
          backendReady = false;
          return false;
        });
      }

      try {
        const ready = await backendCheckPromise;
        if (!ready) {
          // Double-check backend is actually ready with additional retries
          console.log(`[API] Backend check returned false, performing additional health checks...`);
          let isHealthy = false;
          let retries = 0;
          const maxRetries = 10; // Try 10 more times (20 seconds)

          while (!isHealthy && retries < maxRetries) {
            isHealthy = await checkBackendHealth(this.baseURL);
            if (isHealthy) {
              console.log(`[API] ✓ Backend health check passed after ${retries + 1} additional attempts`);
              break;
            }
            retries++;
            if (retries < maxRetries) {
              console.log(`[API] Backend not ready yet, retrying... (${retries}/${maxRetries})`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }

          if (!isHealthy) {
            const healthUrl = this.baseURL.replace('/api', '/health');
            console.error(`[API] Backend health check failed after all retries. Base URL: ${this.baseURL}`);
            console.error(`[API] Health check URL: ${healthUrl}`);
            console.error(`[API] 💡 Please check:`);
            console.error(`[API]    1. Is backend running? Test: curl ${healthUrl}`);
            console.error(`[API]    2. In dev mode, build backend: cd backend-pharmachy && npm run build`);
            console.error(`[API]    3. Or run backend separately: cd backend-pharmachy && npm run dev`);
            console.error(`[API]    4. Check Electron console for backend startup messages`);
            throw new Error('Cannot connect to server. Please ensure the backend is running on port 5001. In development mode, you may need to build the backend first (cd backend-pharmachy && npm run build) or run it separately (cd backend-pharmachy && npm run dev).');
          }
        }
        backendReady = true;
        console.log(`[API] ✓ Backend is ready at ${this.baseURL}`);
      } catch (error: any) {
        console.error(`[API] Backend connection failed:`, error.message);
        // Don't throw immediately - try one more health check
        const finalCheck = await checkBackendHealth(this.baseURL);
        if (!finalCheck) {
          throw new Error('Cannot connect to server. The backend may still be starting. Please wait a moment and try again.');
        }
        backendReady = true;
        console.log(`[API] ✓ Backend is ready after final check`);
      }
    }

    // Refresh token from localStorage in case it was updated
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }

    // Check if we have a token for protected endpoints
    const isProtectedEndpoint = !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register');
    if (isProtectedEndpoint && !this.token) {
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

    // Get current context (company/branch selection)
    const context = this.getContext ? this.getContext() : {};

    // Debug: Log context
    console.log('🔍 API Service - Context retrieved:', context);

    // Create abort controller for timeout (AbortSignal.timeout may not be available in all environments)
    let abortController: AbortController | undefined;
    let timeoutId: NodeJS.Timeout | undefined;

    if (!options.signal) {
      abortController = new AbortController();
      timeoutId = setTimeout(() => {
        abortController?.abort();
      }, API_TIMEOUT);
    }

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...(context.companyId && { 'X-Company-ID': context.companyId }),
        ...(context.branchId && { 'X-Branch-ID': context.branchId }),
        ...options.headers,
      },
      ...options,
      // Add signal for timeout
      signal: options.signal || abortController?.signal,
    };

    // Debug: Log final headers
    console.log('🔍 API Service - Final headers:', {
      'X-Company-ID': config.headers?.['X-Company-ID'],
      'X-Branch-ID': config.headers?.['X-Branch-ID']
    });

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
            } else if (data.code === 'SESSION_EXPIRED_ANOTHER_DEVICE') {
              // Handle session expired due to login from another device
              console.log('🔒 Session expired - logged in from another device');
              window.dispatchEvent(new CustomEvent('sessionExpiredAnotherDevice', {
                detail: { message: data.message }
              }));
            } else {
              // Dispatch event for general authentication failure
              window.dispatchEvent(new CustomEvent('authRequired', {
                detail: { message: 'Session expired. Please log in again.' }
              }));
            }
          }

          // Handle account deactivation (403 status) - don't throw error, return the response
          if (response.status === 403 && data.accountDisabled) {
            console.log('🔍 Account deactivated, returning response without throwing error');
            return data;
          }

          const error = new Error(data.message || 'An error occurred') as any;
          if (data.field) {
            error.field = data.field;
          }
          if (data.errors) {
            error.errors = data.errors;
          }
          error.response = data; // Preserve the full response
          throw error;
        }

        return data;
      } catch (error: any) {
        console.error('API Error:', error);

        // Clear timeout if request completes or errors
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Handle network/connection errors
        if (error.name === 'AbortError' || error.name === 'TimeoutError') {
          throw new Error('Request timeout. The server may be starting up. Please wait a moment and try again.');
        }

        if (error.name === 'TypeError' && (error.message.includes('fetch') || error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
          throw new Error('Cannot connect to server. The backend may still be starting. Please wait a moment and try again.');
        }

        throw error;
      } finally {
        // Clean up timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
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
        email?: string;
        profileImage?: string;
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
        companyId: string;
        isActive: boolean;
        createdAt: string;
        company?: {
          id: string;
          name: string;
        };
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
    categoryType?: string;
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
    formula?: string;
    categoryId: string;
    supplierId: string;
    branchId: string;
    barcode?: string;
    requiresPrescription: boolean;
    isActive?: boolean;
    // Temporary fields for backend compatibility
    costPrice?: number;
    sellingPrice?: number;
    stock?: number;
    minStock?: number;
    maxStock?: number;
    unitsPerPack?: number;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      formula?: string;
      category: { id: string; name: string };
      supplier: { id: string; name: string };
      branch: { id: string; name: string };
      barcode?: string;
      requiresPrescription: boolean;
      isActive: boolean;
      createdAt: string;
      // Temporary fields for backend compatibility
      costPrice?: number;
      sellingPrice?: number;
      stock?: number;
      minStock?: number;
      maxStock?: number;
      unitsPerPack?: number;
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
    createdByRole?: string;
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
    discountPercentage?: number;
    saleDate?: string;
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

  async updateSale(saleId: string, updateData: {
    discountPercentage?: number;
    saleDate?: string;
    notes?: string;
    paymentStatus?: string;
  }) {
    return this.request<{
      id: string;
      invoiceNumber: string;
      customerId?: string;
      userId: string;
      branchId: string;
      subtotal: number;
      taxAmount: number;
      discountAmount: number;
      discountPercentage?: number;
      totalAmount: number;
      paymentMethod: string;
      paymentStatus: string;
      status: string;
      saleDate?: string;
      createdAt: string;
      updatedAt: string;
      receiptNumber: string;
    }>(`/sales/${saleId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
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

  // Company API methods
  async getCompanies() {
    return this.request<Array<{
      id: string;
      name: string;
      description: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      createdBy: string | null;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      branches: Array<{
        id: string;
        name: string;
        address: string;
        phone: string;
        email: string;
      }>;
      _count: {
        users: number;
        employees: number;
        products: number;
      };
    }>>('/companies');
  }

  async getCompany(companyId: string) {
    return this.request<{
      id: string;
      name: string;
      description: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      website: string | null;
      createdBy: string | null;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      branches: Array<{
        id: string;
        name: string;
        address: string;
        phone: string;
        email: string;
        _count: {
          users: number;
          employees: number;
          products: number;
        };
      }>;
      _count: {
        users: number;
        employees: number;
        products: number;
      };
    }>(`/companies/${companyId}`);
  }

  async createCompany(companyData: {
    name: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      description: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      createdBy: string | null;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      branches: Array<any>;
      _count: {
        users: number;
        employees: number;
        products: number;
      };
    }>('/companies', {
      method: 'POST',
      body: JSON.stringify(companyData),
    });
  }

  async updateCompany(companyId: string, companyData: {
    name?: string;
    description?: string;
    address?: string;
    phone?: string;
    email?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      description: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      createdBy: string | null;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      branches: Array<any>;
      _count: {
        users: number;
        employees: number;
        products: number;
      };
    }>(`/companies/${companyId}`, {
      method: 'PUT',
      body: JSON.stringify(companyData),
    });
  }

  async updateCompanyBusinessType(companyId: string, businessTypeData: {
    businessType: 'PHARMACY' | 'STORE' | 'HOTEL' | 'CLINIC';
  }) {
    return this.request<{
      id: string;
      name: string;
      description: string | null;
      address: string | null;
      phone: string | null;
      email: string | null;
      businessType: string | null;
      createdBy: string | null;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      branches: Array<any>;
      _count: {
        users: number;
        employees: number;
        products: number;
      };
    }>(`/companies/${companyId}/business-type`, {
      method: 'PATCH',
      body: JSON.stringify(businessTypeData),
    });
  }

  async deleteCompany(companyId: string) {
    return this.request<{ message: string }>(`/companies/${companyId}`, {
      method: 'DELETE',
    });
  }

  async getCompanyStats(companyId: string) {
    return this.request<{
      id: string;
      name: string;
      _count: {
        branches: number;
        users: number;
        employees: number;
        products: number;
        customers: number;
        sales: number;
      };
    }>(`/companies/${companyId}/stats`);
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

  async getRecentActivities() {
    return this.request<Array<{
      id: string;
      type: 'admin_created' | 'subscription_updated' | 'payment_received' | 'user_registered' | 'system_alert' | 'branch_added';
      message: string;
      details: string;
      timestamp: string;
      adminId?: string;
      adminName?: string;
    }>>('/admin/activities');
  }

  // Scheduled Shift Management Methods
  async getScheduledShifts() {
    return this.request<Array<{
      id: string;
      name: string;
      startTime: string;
      endTime: string;
      date: string;
      branchId: string;
      branchName: string;
      assignedUsers: Array<{
        id: string;
        name: string;
        role: string;
      }>;
      maxUsers: number;
      status: 'scheduled' | 'active' | 'completed' | 'cancelled';
      notes?: string;
      createdAt: string;
      updatedAt: string;
    }>>('/scheduled-shifts');
  }

  async createShift(shiftData: {
    name: string;
    startTime: string;
    endTime: string;
    date: string;
    branchId: string;
    maxUsers: number;
    notes?: string;
    assignedUserIds: string[];
  }) {
    return this.request<{
      id: string;
      name: string;
      startTime: string;
      endTime: string;
      date: string;
      branchId: string;
      branchName: string;
      assignedUsers: Array<{
        id: string;
        name: string;
        role: string;
      }>;
      maxUsers: number;
      status: 'scheduled' | 'active' | 'completed' | 'cancelled';
      notes?: string;
      createdAt: string;
      updatedAt: string;
    }>('/scheduled-shifts', {
      method: 'POST',
      body: JSON.stringify(shiftData),
    });
  }

  async updateScheduledShift(shiftId: string, shiftData: {
    name: string;
    startTime: string;
    endTime: string;
    date: string;
    branchId: string;
    maxUsers: number;
    notes?: string;
    assignedUserIds: string[];
  }) {
    return this.request<{
      id: string;
      name: string;
      startTime: string;
      endTime: string;
      date: string;
      branchId: string;
      branchName: string;
      assignedUsers: Array<{
        id: string;
        name: string;
        role: string;
      }>;
      maxUsers: number;
      status: 'scheduled' | 'active' | 'completed' | 'cancelled';
      notes?: string;
      createdAt: string;
      updatedAt: string;
    }>(`/scheduled-shifts/${shiftId}`, {
      method: 'PUT',
      body: JSON.stringify(shiftData),
    });
  }

  async deleteShift(shiftId: string) {
    return this.request<{ success: boolean; message: string }>(`/scheduled-shifts/${shiftId}`, {
      method: 'DELETE',
    });
  }

  // User Management Methods (Basic - deprecated, use getUser instead)
  // Note: This method is kept for backward compatibility but getUser() below provides more details
  async getUserBasic(userId: string) {
    return this.request<{
      id: string;
      name: string;
      email: string;
      role: string;
      isActive: boolean;
      branchId?: string;
      createdAt: string;
    }>(`/users/${userId}`);
  }

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

  async activateUser(userId: string, isActive: boolean) {
    return this.request<{
      id: string;
      username: string;
      name: string;
      email: string;
      role: string;
      branchId: string;
      isActive: boolean;
      branch?: {
        id: string;
        name: string;
      };
    }>(`/users/${userId}/activate`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  }

  // Categories
  async getCategories(params?: {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
    type?: string;
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
      pagination?: {
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
      description: string;
      type: 'medical' | 'non-medical' | 'general';
      parentId?: string;
      isActive: boolean;
      productCount: number;
      color: string;
      icon: string;
      createdAt: string;
      updatedAt: string;
    }>(`/categories/${categoryId}`);
  }

  async createCategory(categoryData: {
    name: string;
    description?: string;
    type?: string;
    color?: string;
    branchId?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      type?: string;
      color?: string;
      createdAt: string;
    }>('/categories', {
      method: 'POST',
      body: JSON.stringify(categoryData),
    });
  }

  async updateCategory(categoryId: string, categoryData: {
    name?: string;
    description?: string;
    type?: 'MEDICAL' | 'NON_MEDICAL' | 'GENERAL';
    parentId?: string;
    color?: string;
    icon?: string;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      description: string;
      type: 'MEDICAL' | 'NON_MEDICAL' | 'GENERAL';
      parentId?: string;
      isActive: boolean;
      productCount: number;
      color: string;
      icon: string;
      updatedAt: string;
    }>(`/categories/${categoryId}`, {
      method: 'PUT',
      body: JSON.stringify(categoryData),
    });
  }

  async deleteCategory(categoryId: string) {
    return this.request<{ success: boolean; message: string }>(`/categories/${categoryId}`, {
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
    manufacturerId?: string;
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
    email?: string;
    address?: string;
    manufacturerId?: string;
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
    manufacturerId?: string;
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

  // Manufacturer APIs
  async getManufacturers(params?: {
    page?: number;
    limit?: number;
    search?: string;
    active?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.active !== undefined) queryParams.append('active', params.active.toString());

    const queryString = queryParams.toString();
    const url = queryString ? `/manufacturers?${queryString}` : '/manufacturers';

    return this.request<{
      manufacturers: Array<{
        id: string;
        name: string;
        description?: string;
        website?: string;
        country?: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        _count: {
          suppliers: number;
        };
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(url);
  }

  async getManufacturer(manufacturerId: string) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      website?: string;
      country?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      _count: {
        suppliers: number;
      };
      suppliers: Array<{
        id: string;
        name: string;
        contactPerson: string;
        phone: string;
        email: string;
        isActive: boolean;
      }>;
    }>(`/manufacturers/${manufacturerId}`);
  }

  async createManufacturer(manufacturerData: {
    name: string;
    description?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      website?: string;
      country?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>('/manufacturers', {
      method: 'POST',
      body: JSON.stringify(manufacturerData),
    });
  }

  async updateManufacturer(manufacturerId: string, manufacturerData: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      website?: string;
      country?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>(`/manufacturers/${manufacturerId}`, {
      method: 'PUT',
      body: JSON.stringify(manufacturerData),
    });
  }

  async deleteManufacturer(manufacturerId: string) {
    return this.request<{ message: string }>(`/manufacturers/${manufacturerId}`, {
      method: 'DELETE',
    });
  }

  // Shelf APIs
  async getShelves(params?: {
    page?: number;
    limit?: number;
    search?: string;
    active?: boolean;
  }) {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.search) queryParams.append('search', params.search);
    if (params?.active !== undefined) queryParams.append('active', params.active.toString());

    const queryString = queryParams.toString();
    const url = queryString ? `/shelves?${queryString}` : '/shelves';

    return this.request<{
      shelves: Array<{
        id: string;
        name: string;
        description?: string;
        location?: string;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        _count: {
          batches: number;
        };
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(url);
  }

  async getShelf(shelfId: string) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      location?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
      _count: {
        batches: number;
      };
      batches: Array<{
        id: string;
        batchNo: string;
        product: {
          id: string;
          name: string;
          sku: string;
        };
        quantity: number;
        expireDate?: string;
        isActive: boolean;
      }>;
    }>(`/shelves/${shelfId}`);
  }

  async createShelf(shelfData: {
    name: string;
    description?: string;
    location?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      location?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>('/shelves', {
      method: 'POST',
      body: JSON.stringify(shelfData),
    });
  }

  async updateShelf(shelfId: string, shelfData: {
    name?: string;
    description?: string;
    location?: string;
    isActive?: boolean;
  }) {
    return this.request<{
      id: string;
      name: string;
      description?: string;
      location?: string;
      isActive: boolean;
      createdAt: string;
      updatedAt: string;
    }>(`/shelves/${shelfId}`, {
      method: 'PUT',
      body: JSON.stringify(shelfData),
    });
  }

  async deleteShelf(shelfId: string) {
    return this.request<{ message: string }>(`/shelves/${shelfId}`, {
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

  async updateCashierShift(shiftId: string, shiftData: {
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
    companyId: string;
    managerId?: string;
  }) {
    return this.request<{
      id: string;
      name: string;
      address: string;
      phone: string;
      email: string;
      companyId: string;
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
      batchId?: string | null;
      saleItemId?: string | null;
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
          receipts?: Array<{
            id: string;
            receiptNumber: string;
            createdAt: string;
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

  // Batch Management Methods
  async getBatches(params: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
    isReported?: boolean;
    productId?: string;
  } = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.isActive !== undefined) queryParams.append('isActive', params.isActive.toString());
    if (params.isReported !== undefined) queryParams.append('isReported', params.isReported.toString());
    if (params.productId) queryParams.append('productId', params.productId);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/batches?${queryString}` : '/batches';

    return this.request<{
      batches: Array<{
        id: string;
        batchNo: string;
        productId: string;
        supplierId?: string;
        supplierName?: string;
        totalBoxes: number;
        unitsPerBox: number;
        totalStock: number;
        costPrice: number;
        sellingPrice: number;
        // New pricing and stock fields
        costPricePerUnit?: number;
        costPricePerBox?: number;
        sellingPricePerUnit?: number;
        sellingPricePerBox?: number;
        stockQuantity?: number;
        minStockLevel?: number;
        stockPurchasePrice: number;
        paidAmount: number;
        supplierOutstanding: number;
        supplierInvoiceNo?: string;
        purchasingMethod?: string;
        expireDate?: string;
        productionDate?: string;
        shelfId?: string;
        shelfName?: string;
        isActive: boolean;
        isReported: boolean;
        createdAt: string;
        updatedAt: string;
        product: {
          id: string;
          name: string;
          sku: string;
          barcode?: string;
        };
        supplier?: {
          id: string;
          name: string;
        };
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(endpoint);
  }

  async getBatchById(id: string) {
    return this.request<{
      id: string;
      batchNo: string;
      productId: string;
      supplierId?: string;
      supplierName?: string;
      totalBoxes: number;
      unitsPerBox: number;
      totalStock: number;
      costPrice: number;
      sellingPrice: number;
      stockPurchasePrice: number;
      paidAmount: number;
      supplierOutstanding: number;
      supplierInvoiceNo?: string;
      purchasingMethod?: string;
      expireDate?: string;
      productionDate?: string;
      shelfId?: string;
      shelfName?: string;
      isActive: boolean;
      isReported: boolean;
      createdAt: string;
      updatedAt: string;
      product: {
        id: string;
        name: string;
        sku: string;
        barcode?: string;
      };
      supplier?: {
        id: string;
        name: string;
        email: string;
        phone: string;
      };
    }>(`/batches/${id}`);
  }

  async createBatch(batchData: {
    batchNo: string;
    productId: string;
    supplierId?: string;
    supplierName?: string;
    totalBoxes?: number;
    unitsPerBox?: number;
    totalStock?: number;
    costPrice?: number;
    sellingPrice?: number;
    stockPurchasePrice?: number;
    paidAmount?: number;
    supplierOutstanding?: number;
    supplierInvoiceNo?: string;
    purchasingMethod?: string;
    expireDate?: string;
    productionDate?: string;
    shelfId?: string;
    shelfName?: string;
    // New pricing and stock fields
    costPricePerUnit?: number;
    costPricePerBox?: number;
    sellingPricePerUnit?: number;
    sellingPricePerBox?: number;
    stockQuantity?: number;
    minStockLevel?: number;
    maxStockLevel?: number;
  }) {
    return this.request<{
      id: string;
      batchNo: string;
      productId: string;
      supplierId?: string;
      supplierName?: string;
      totalBoxes: number;
      unitsPerBox: number;
      totalStock: number;
      costPrice: number;
      sellingPrice: number;
      stockPurchasePrice: number;
      paidAmount: number;
      supplierOutstanding: number;
      supplierInvoiceNo?: string;
      purchasingMethod?: string;
      expireDate?: string;
      productionDate?: string;
      shelfId?: string;
      shelfName?: string;
      isActive: boolean;
      isReported: boolean;
      createdAt: string;
      updatedAt: string;
      product: {
        id: string;
        name: string;
        sku: string;
        barcode?: string;
      };
      supplier?: {
        id: string;
        name: string;
      };
    }>('/batches', {
      method: 'POST',
      body: JSON.stringify(batchData),
    });
  }

  async updateBatch(id: string, batchData: {
    batchNo?: string;
    supplierId?: string;
    supplierName?: string;
    totalBoxes?: number;
    unitsPerBox?: number;
    totalStock?: number;
    costPrice?: number;
    sellingPrice?: number;
    stockPurchasePrice?: number;
    paidAmount?: number;
    supplierOutstanding?: number;
    supplierInvoiceNo?: string;
    purchasingMethod?: string;
    expireDate?: string;
    productionDate?: string;
    shelfId?: string;
    shelfName?: string;
    isActive?: boolean;
    isReported?: boolean;
    // New pricing and stock fields
    stockQuantity?: number;
    costPricePerUnit?: number;
    costPricePerBox?: number;
    sellingPricePerUnit?: number;
    sellingPricePerBox?: number;
    minStockLevel?: number;
  }) {
    return this.request<{
      id: string;
      batchNo: string;
      productId: string;
      supplierId?: string;
      supplierName?: string;
      totalBoxes: number;
      unitsPerBox: number;
      totalStock: number;
      costPrice: number;
      sellingPrice: number;
      stockPurchasePrice: number;
      paidAmount: number;
      supplierOutstanding: number;
      supplierInvoiceNo?: string;
      purchasingMethod?: string;
      expireDate?: string;
      productionDate?: string;
      shelfId?: string;
      shelfName?: string;
      isActive: boolean;
      isReported: boolean;
      createdAt: string;
      updatedAt: string;
      product: {
        id: string;
        name: string;
        sku: string;
        barcode?: string;
      };
      supplier?: {
        id: string;
        name: string;
      };
    }>(`/batches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(batchData),
    });
  }

  async deleteBatch(id: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>(`/batches/${id}`, {
      method: 'DELETE',
    });
  }

  async restockBatch(id: string, restockData: {
    quantity: number;
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      id: string;
      batchNo: string;
      stockQuantity: number;
      updatedAt: string;
    };
  }> {
    return this.request<{
      success: boolean;
      message: string;
      data: {
        id: string;
        batchNo: string;
        stockQuantity: number;
        updatedAt: string;
      };
    }>(`/batches/${id}/restock`, {
      method: 'POST',
      body: JSON.stringify(restockData),
    });
  }

  async getNearExpiryBatches(days: number = 30) {
    return this.request<Array<{
      id: string;
      batchNo: string;
      productId: string;
      totalStock: number;
      expireDate: string;
      product: {
        id: string;
        name: string;
        sku: string;
      };
    }>>(`/batches/near-expiry?days=${days}`);
  }

  async getLowStockBatches(params: {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
  } = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.branchId) queryParams.append('branchId', params.branchId);

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/batches/low-stock?${queryString}` : '/batches/low-stock';

    return this.request<{
      batches: Array<{
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
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(endpoint);
  }

  // Purchase Management Methods
  async getPurchases(params: {
    page?: number;
    limit?: number;
    status?: string;
    supplierId?: string;
  } = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.status) queryParams.append('status', params.status);
    if (params.supplierId) queryParams.append('supplierId', params.supplierId);

    return this.request<{
      data: Array<{
        id: string;
        supplierId: string;
        invoiceNo?: string;
        purchaseDate: string;
        totalAmount: number;
        paidAmount: number;
        outstanding: number;
        status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL';
        notes?: string;
        createdAt: string;
        updatedAt: string;
        supplier: {
          id: string;
          name: string;
          contactPerson: string;
          phone: string;
        };
        purchaseItems: Array<{
          id: string;
          productId: string;
          batchId?: string;
          quantity: number;
          unitPrice: number;
          totalPrice: number;
          product: {
            id: string;
            name: string;
            sku: string;
            barcode?: string;
          };
          batch?: {
            id: string;
            batchNo: string;
            quantity: number;
            expireDate?: string;
          };
        }>;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/purchases?${queryParams.toString()}`);
  }

  async getPurchaseById(id: string) {
    return this.request<{
      id: string;
      supplierId: string;
      invoiceNo?: string;
      purchaseDate: string;
      totalAmount: number;
      paidAmount: number;
      outstanding: number;
      status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL';
      notes?: string;
      createdAt: string;
      updatedAt: string;
      supplier: {
        id: string;
        name: string;
        contactPerson: string;
        phone: string;
        email: string;
        address: string;
      };
      purchaseItems: Array<{
        id: string;
        productId: string;
        batchId?: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        product: {
          id: string;
          name: string;
          sku: string;
          barcode?: string;
          unitType: string;
        };
        batch?: {
          id: string;
          batchNo: string;
          quantity: number;
          expireDate?: string;
          productionDate?: string;
        };
      }>;
    }>(`/purchases/${id}`);
  }

  async createPurchase(purchaseData: {
    supplierId: string;
    invoiceNo?: string;
    purchaseDate?: string;
    totalAmount?: number;
    paidAmount?: number;
    notes?: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: number;
      batchNo?: string;
      expireDate?: string;
      productionDate?: string;
    }>;
  }) {
    return this.request<{
      id: string;
      supplierId: string;
      invoiceNo?: string;
      purchaseDate: string;
      totalAmount: number;
      paidAmount: number;
      outstanding: number;
      status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL';
      notes?: string;
      createdAt: string;
      updatedAt: string;
      supplier: {
        id: string;
        name: string;
        contactPerson: string;
        phone: string;
      };
      purchaseItems: Array<{
        id: string;
        productId: string;
        batchId?: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        product: {
          id: string;
          name: string;
          sku: string;
          barcode?: string;
        };
        batch?: {
          id: string;
          batchNo: string;
          quantity: number;
          expireDate?: string;
        };
      }>;
    }>('/purchases', {
      method: 'POST',
      body: JSON.stringify(purchaseData),
    });
  }

  async updatePurchase(id: string, purchaseData: {
    supplierId?: string;
    invoiceNo?: string;
    purchaseDate?: string;
    totalAmount?: number;
    paidAmount?: number;
    status?: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL';
    notes?: string;
  }) {
    return this.request<{
      id: string;
      supplierId: string;
      invoiceNo?: string;
      purchaseDate: string;
      totalAmount: number;
      paidAmount: number;
      outstanding: number;
      status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'PARTIAL';
      notes?: string;
      createdAt: string;
      updatedAt: string;
      supplier: {
        id: string;
        name: string;
        contactPerson: string;
        phone: string;
      };
      purchaseItems: Array<{
        id: string;
        productId: string;
        batchId?: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        product: {
          id: string;
          name: string;
          sku: string;
          barcode?: string;
        };
        batch?: {
          id: string;
          batchNo: string;
          quantity: number;
          expireDate?: string;
        };
      }>;
    }>(`/purchases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(purchaseData),
    });
  }

  async deletePurchase(id: string) {
    return this.request<{
      success: boolean;
      message: string;
    }>(`/purchases/${id}`, {
      method: 'DELETE',
    });
  }

  // Inventory Management Methods
  async getInventorySummary(params: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: string;
    lowStock?: boolean;
  } = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params.lowStock) queryParams.append('lowStock', params.lowStock.toString());

    return this.request<{
      data: Array<{
        id: string;
        name: string;
        sku: string;
        barcode?: string;
        stock: number;
        minStock: number;
        costPrice: number;
        sellingPrice: number;
        unitType: string;
        category: {
          id: string;
          name: string;
          type: 'MEDICAL' | 'NON_MEDICAL' | 'GENERAL';
        };
        supplier: {
          id: string;
          name: string;
        };
        batches: Array<{
          id: string;
          batchNo: string;
          quantity: number;
          expireDate?: string;
          purchasePrice: number;
          sellingPrice: number;
        }>;
        totalBatchQuantity: number;
        nearExpiryBatches: number;
        expiredBatches: number;
        isLowStock: boolean;
        stockStatus: 'LOW' | 'MEDIUM' | 'GOOD';
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/inventory/summary?${queryParams.toString()}`);
  }

  async getInventoryByBatches(params: {
    page?: number;
    limit?: number;
    search?: string;
    productId?: string;
    nearExpiry?: boolean;
    expired?: boolean;
    branchId?: string;
  } = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.productId) queryParams.append('productId', params.productId);
    if (params.nearExpiry) queryParams.append('nearExpiry', params.nearExpiry.toString());
    if (params.expired) queryParams.append('expired', params.expired.toString());
    if (params.branchId) queryParams.append('branchId', params.branchId);

    return this.request<{
      data: Array<{
        id: string;
        batchNo: string;
        productId: string;
        quantity: number;
        purchasePrice: number;
        sellingPrice: number;
        expireDate?: string;
        productionDate?: string;
        product: {
          id: string;
          name: string;
          sku: string;
          barcode?: string;
          unitType: string;
          minStock: number;
        };
        supplier: {
          id: string;
          name: string;
        };
        expiryStatus: 'GOOD' | 'WARNING' | 'CRITICAL' | 'EXPIRED';
        daysUntilExpiry?: number;
      }>;
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
    }>(`/inventory/batches?${queryParams.toString()}`);
  }

  async getInventoryReports() {
    return this.request<{
      totalProducts: number;
      lowStockProducts: number;
      nearExpiryBatches: number;
      expiredBatches: number;
      totalStockValue: number;
      categoryStats: Array<{
        categoryId: string;
        categoryName: string;
        categoryType: 'MEDICAL' | 'NON_MEDICAL' | 'GENERAL';
        productCount: number;
        totalStock: number;
      }>;
    }>('/inventory/reports');
  }

}

export const apiService = new ApiService(API_BASE_URL);
export default apiService;