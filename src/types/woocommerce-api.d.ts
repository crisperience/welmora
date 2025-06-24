declare module 'woocommerce-api' {
  interface WooCommerceConfig {
    url: string;
    consumerKey: string;
    consumerSecret: string;
    version: string;
    queryStringAuth?: boolean;
    timeout?: number;
  }

  interface WooCommerceResponse<T = unknown> {
    data: T;
    headers: Record<string, string>;
    status: number;
    statusText: string;
  }

  class WooCommerceRestApi {
    constructor(config: WooCommerceConfig);

    get<T = unknown>(
      endpoint: string,
      params?: Record<string, unknown>
    ): Promise<WooCommerceResponse<T>>;
    post<T = unknown>(
      endpoint: string,
      data: Record<string, unknown>,
      params?: Record<string, unknown>
    ): Promise<WooCommerceResponse<T>>;
    put<T = unknown>(
      endpoint: string,
      data: Record<string, unknown>,
      params?: Record<string, unknown>
    ): Promise<WooCommerceResponse<T>>;
    delete<T = unknown>(
      endpoint: string,
      params?: Record<string, unknown>
    ): Promise<WooCommerceResponse<T>>;
    options<T = unknown>(
      endpoint: string,
      params?: Record<string, unknown>
    ): Promise<WooCommerceResponse<T>>;
  }

  export = WooCommerceRestApi;
}

// Daily snapshot types for shopping workflow
export interface DailySnapshot {
  date: string; // YYYY-MM-DD format
  products: ShoppingItem[];
  totalOrders: number;
  generatedAt: string;
}

export interface ShoppingItem {
  sku: string;
  name: string;
  quantity: number;
  price?: number;
  image?: string;
  category?: string;
  weight?: number;
}

// Enhanced package types for packing workflow with shipping information
export interface Package {
  id: string;
  orderId: number;
  orderNumber: string; // WooCommerce order number for easy reference
  customerName: string;
  customerEmail?: string;
  shippingAddress: ShippingAddress;
  billingAddress: BillingAddress;
  orderDate: string;
  items: PackageItem[];
  status: 'pending' | 'in-progress' | 'completed';
  qrCode?: string;
  totalValue?: number;
  shippingMethod?: string;
  orderNotes?: string;
}

export interface ShippingAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  phone?: string;
}

export interface BillingAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface PackageItem {
  sku: string;
  name: string;
  needed: number;
  scanned: number;
  price?: number;
  image?: string;
  productId?: number;
  variation?: string;
}

// Enhanced scan feedback types
export interface ScanFeedback {
  success: boolean;
  message: string;
  packageInfo?: {
    packageId: string;
    orderNumber: string;
    customerName: string;
    shippingAddress: string;
    remainingItems: number;
    totalItems: number;
    isComplete: boolean;
  };
  productInfo?: {
    name: string;
    sku: string;
    needed: number;
    scanned: number;
    remaining: number;
  };
  urgency: 'low' | 'medium' | 'high'; // For prioritizing packages
  sound?: 'success' | 'warning' | 'error'; // Audio feedback
  multiplePackages?: Array<{
    packageId: string;
    customerName: string;
    orderNumber: string;
    needed: number;
    scanned: number;
    remaining: number;
  }>; // For handling same product in multiple packages
}

// Scanner types
export interface ScanResult {
  type: 'qr' | 'barcode';
  data: string;
  timestamp: string;
}

export interface ValidationResult {
  valid: boolean;
  message: string;
  item?: PackageItem;
  package?: Package;
  feedback?: ScanFeedback;
}
