import { DailySnapshot, Package, ShoppingItem } from '@/types/woocommerce-api';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';

// Debug environment variables
console.log('WooCommerce Config:', {
  url: process.env.WOOCOMMERCE_URL || process.env.NEXT_PUBLIC_WOOCOMMERCE_URL,
  hasKey: !!(
    process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_KEY
  ),
  hasSecret: !!(
    process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_SECRET
  ),
});

const WooCommerce = new WooCommerceRestApi({
  url:
    process.env.WOOCOMMERCE_URL || process.env.NEXT_PUBLIC_WOOCOMMERCE_URL || 'https://welmora.ch',
  consumerKey:
    process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_KEY || '',
  consumerSecret:
    process.env.WOOCOMMERCE_CONSUMER_SECRET ||
    process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_SECRET ||
    '',
  version: 'wc/v3',
});

export default WooCommerce;

// Interfaces for WooCommerce data structures
interface WooCommerceOrder {
  id: number;
  number?: string;
  date_created: string;
  status: string;
  total: string;
  shipping_total: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    company?: string;
    address_1: string;
    address_2?: string;
    city: string;
    state?: string;
    postcode: string;
    country: string;
    phone?: string;
  };
  shipping?: {
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
  };
  line_items: WooCommerceLineItem[];
  shipping_lines?: Array<{
    method_title: string;
    method_id: string;
    total: string;
  }>;
  customer_note?: string;
}

interface WooCommerceLineItem {
  sku?: string;
  name: string;
  quantity: number;
  price: string;
  product_id: number;
  weight?: string;
  image?: {
    src: string;
  };
}

interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  weight?: string;
  images: Array<{ src: string }>;
  categories?: Array<{ name: string }>;
}

interface WooCommerceCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
}

interface WooCommerceApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  headers?: Record<string, string>;
}

// Helper function to safely access array data
function isArrayData(data: unknown): data is unknown[] {
  return Array.isArray(data);
}

// Test connection function
export async function testWooCommerceConnection(): Promise<WooCommerceApiResponse<boolean>> {
  try {
    console.log('Testing WooCommerce connection with config:', {
      url: process.env.WOOCOMMERCE_URL || process.env.NEXT_PUBLIC_WOOCOMMERCE_URL,
      hasKey: !!(
        process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_KEY
      ),
      hasSecret: !!(
        process.env.WOOCOMMERCE_CONSUMER_SECRET ||
        process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_SECRET
      ),
      version: 'wc/v3',
    });

    const response = await WooCommerce.get('products', { per_page: 1 });

    console.log('WooCommerce test response:', {
      success: true,
      dataLength: isArrayData(response.data) ? response.data.length : 0,
      headers: Object.keys(response.headers || {}),
    });

    return {
      success: true,
      data: true,
    };
  } catch (error) {
    console.error('WooCommerce connection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get products from WooCommerce
export async function getWooCommerceProducts(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
}): Promise<WooCommerceApiResponse<WooCommerceProduct[]>> {
  try {
    const response = await WooCommerce.get('products', {
      page: params?.page || 1,
      per_page: params?.per_page || 20,
      search: params?.search || '',
      status: params?.status || 'publish',
    });

    return {
      success: true,
      data: isArrayData(response.data) ? (response.data as WooCommerceProduct[]) : [],
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get orders from WooCommerce
export async function getWooCommerceOrders(params?: {
  page?: number;
  per_page?: number;
  status?: string;
}): Promise<WooCommerceApiResponse<WooCommerceOrder[]>> {
  try {
    const response = await WooCommerce.get('orders', {
      page: params?.page || 1,
      per_page: params?.per_page || 20,
      status: params?.status || 'any',
    });

    return {
      success: true,
      data: isArrayData(response.data) ? (response.data as WooCommerceOrder[]) : [],
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get customers from WooCommerce
export async function getWooCommerceCustomers(params?: {
  page?: number;
  per_page?: number;
  search?: string;
}): Promise<WooCommerceApiResponse<WooCommerceCustomer[]>> {
  try {
    const response = await WooCommerce.get('customers', {
      page: params?.page || 1,
      per_page: params?.per_page || 20,
      search: params?.search || '',
    });

    return {
      success: true,
      data: isArrayData(response.data) ? (response.data as WooCommerceCustomer[]) : [],
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get orders for a specific date range (for daily snapshot)
export async function getOrdersByDateRange(
  startDate: string,
  endDate: string
): Promise<WooCommerceApiResponse<WooCommerceOrder[]>> {
  try {
    console.log('Fetching orders from WooCommerce for date range:', {
      startDate,
      endDate,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    // Use WooCommerce's date parameter to get orders in the date range
    const response = await WooCommerce.get('orders', {
      after: `${startDate}T00:00:00`,
      before: `${endDate}T23:59:59`,
      status: 'pending,processing,on-hold,completed',
      per_page: 100,
    });

    const ordersData = isArrayData(response.data) ? (response.data as WooCommerceOrder[]) : [];

    // If startDate equals endDate, filter to exact date (for single day requests)
    // Otherwise return all orders in range (for calendar counts)
    const filteredOrders =
      startDate === endDate
        ? ordersData.filter((order: WooCommerceOrder) => {
            const orderDateOnly = order.date_created.split('T')[0];
            return orderDateOnly === startDate;
          })
        : ordersData;

    console.log('WooCommerce orders response:', {
      totalFetched: ordersData.length,
      afterDateFilter: filteredOrders.length,
      isRangeQuery: startDate !== endDate,
      startDate,
      endDate,
      sampleDates: ordersData.slice(0, 5).map(o => ({
        id: o.id,
        date_created: o.date_created,
        date_only: o.date_created.split('T')[0],
      })),
    });

    return {
      success: true,
      data: filteredOrders,
      headers: response.headers as Record<string, string>,
    };
  } catch (error) {
    console.error('Error fetching orders by date range:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Generate daily snapshot for shopping
export async function generateDailySnapshot(
  date: string
): Promise<{ success: boolean; data?: DailySnapshot; error?: string }> {
  try {
    // Use the exact date selected by the user
    const selectedDate = date;

    // Get orders from the selected date only (00:00 to 23:59)
    const ordersResult = await getOrdersByDateRange(selectedDate, selectedDate);

    if (!ordersResult.success || !ordersResult.data) {
      return {
        success: false,
        error: 'Failed to fetch orders',
      };
    }

    // Aggregate products from all orders and collect product IDs
    const productMap = new Map<string, ShoppingItem>();
    const productIds = new Set<number>();

    ordersResult.data.forEach((order: WooCommerceOrder) => {
      order.line_items.forEach((item: WooCommerceLineItem) => {
        const sku = item.sku || `product-${item.product_id}`;
        productIds.add(item.product_id);

        if (productMap.has(sku)) {
          const existing = productMap.get(sku)!;
          existing.quantity += item.quantity;
        } else {
          productMap.set(sku, {
            sku,
            name: item.name,
            quantity: item.quantity,
            price: parseFloat(item.price),
            image: item.image?.src,
            category: 'Loading...', // Will be updated below
            weight: 0, // Will be updated below
          });
        }
      });
    });

    // Fetch product details to get categories and weights
    const productDetails = new Map<number, { category?: string; weight?: number }>();

    if (productIds.size > 0) {
      try {
        // Fetch products in batches to get category and weight info
        const productIdsArray = Array.from(productIds);
        const batchSize = 20;

        for (let i = 0; i < productIdsArray.length; i += batchSize) {
          const batch = productIdsArray.slice(i, i + batchSize);
          const response = await WooCommerce.get('products', {
            include: batch.join(','),
            per_page: batchSize,
          });

          if (isArrayData(response.data)) {
            response.data.forEach((product: unknown) => {
              const prod = product as {
                id: number;
                categories?: Array<{ name: string }>;
                weight?: string;
              };
              const primaryCategory = prod.categories?.[0]?.name || 'Uncategorized';
              const weight = parseFloat(prod.weight || '0') || 0;

              productDetails.set(prod.id, {
                category: primaryCategory,
                weight: weight,
              });
            });
          }
        }
      } catch (error) {
        console.warn('Failed to fetch product details:', error);
      }
    }

    // Update products with category and weight information
    const productsArray = Array.from(productMap.values());

    ordersResult.data.forEach((order: WooCommerceOrder) => {
      order.line_items.forEach((item: WooCommerceLineItem) => {
        const sku = item.sku || `product-${item.product_id}`;
        const product = productMap.get(sku);
        const details = productDetails.get(item.product_id);

        if (product && details) {
          product.category = details.category || 'Uncategorized';
          product.weight = details.weight || 0;
        }
      });
    });

    const snapshot: DailySnapshot = {
      date,
      products: productsArray,
      totalOrders: ordersResult.data.length,
      generatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      data: snapshot,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get packages for packing (orders as individual packages)
export async function getPackagesForDate(
  date: string
): Promise<{ success: boolean; data?: Package[]; error?: string }> {
  try {
    // Use the exact date selected by the user
    const selectedDate = date;

    console.log('Getting packages for date:', selectedDate);

    // Get orders from the selected date
    const ordersResult = await getOrdersByDateRange(selectedDate, selectedDate);

    if (!ordersResult.success || !ordersResult.data) {
      return {
        success: false,
        error: 'Failed to fetch orders',
      };
    }

    console.log(
      'Found orders:',
      ordersResult.data.map(o => ({
        id: o.id,
        date_created: o.date_created,
        billing_name: `${o.billing.first_name} ${o.billing.last_name}`,
        items_count: o.line_items.length,
      }))
    );

    // Collect all product IDs to fetch weights
    const productIds = new Set<number>();
    ordersResult.data.forEach((order: WooCommerceOrder) => {
      order.line_items.forEach((item: WooCommerceLineItem) => {
        productIds.add(item.product_id);
      });
    });

    // Fetch product details to get weights
    const productWeights = new Map<number, number>();
    if (productIds.size > 0) {
      try {
        const productIdsArray = Array.from(productIds);
        const batchSize = 20;

        for (let i = 0; i < productIdsArray.length; i += batchSize) {
          const batch = productIdsArray.slice(i, i + batchSize);
          const response = await WooCommerce.get('products', {
            include: batch.join(','),
            per_page: batchSize,
          });

          if (isArrayData(response.data)) {
            response.data.forEach((product: unknown) => {
              const prod = product as WooCommerceProduct;
              const weight = parseFloat(prod.weight || '0') || 0;
              productWeights.set(prod.id, weight);
            });
          }
        }
        console.log('Fetched product weights:', Object.fromEntries(productWeights));
      } catch (error) {
        console.warn('Failed to fetch product weights:', error);
      }
    }

    const packages: Package[] = ordersResult.data.map((order: WooCommerceOrder) => {
      // Calculate total package value
      const totalValue = order.line_items.reduce(
        (sum: number, item: WooCommerceLineItem) => sum + parseFloat(item.price) * item.quantity,
        0
      );

      // Determine which address to use - prefer shipping if it has a real address
      const hasShippingAddress =
        order.shipping?.address_1 &&
        order.shipping.address_1.trim() !== '' &&
        order.shipping.address_1.trim() !== order.billing.address_1.trim();

      const shippingAddress = {
        first_name: hasShippingAddress
          ? order.shipping?.first_name || order.billing.first_name
          : order.billing.first_name,
        last_name: hasShippingAddress
          ? order.shipping?.last_name || order.billing.last_name
          : order.billing.last_name,
        company: hasShippingAddress ? order.shipping?.company : order.billing.company,
        address_1: hasShippingAddress ? order.shipping?.address_1 : order.billing.address_1,
        address_2: hasShippingAddress ? order.shipping?.address_2 : order.billing.address_2,
        city: hasShippingAddress ? order.shipping?.city || order.billing.city : order.billing.city,
        state: hasShippingAddress ? order.shipping?.state : order.billing.state,
        postcode: hasShippingAddress
          ? order.shipping?.postcode || order.billing.postcode
          : order.billing.postcode,
        country: hasShippingAddress
          ? order.shipping?.country || order.billing.country
          : order.billing.country,
        phone: hasShippingAddress ? order.shipping?.phone : order.billing.phone,
      };

      console.log(`Order ${order.id} address logic:`, {
        hasShippingAddress,
        shipping_address_1: order.shipping?.address_1,
        billing_address_1: order.billing.address_1,
        final_address: shippingAddress.address_1,
        shipping_city: order.shipping?.city,
        billing_city: order.billing.city,
        final_city: shippingAddress.city,
      });

      return {
        id: `package-${order.id}`,
        orderId: order.id,
        orderNumber: order.number || `${order.id}`,
        customerName: `${order.billing.first_name} ${order.billing.last_name}`,
        customerEmail: order.billing.email,
        shippingAddress,
        billingAddress: {
          first_name: order.billing.first_name,
          last_name: order.billing.last_name,
          company: order.billing.company,
          address_1: order.billing.address_1,
          address_2: order.billing.address_2,
          city: order.billing.city,
          state: order.billing.state,
          postcode: order.billing.postcode,
          country: order.billing.country,
          email: order.billing.email,
          phone: order.billing.phone,
        },
        orderDate: order.date_created,
        status: 'pending' as const,
        totalValue,
        shippingMethod: order.shipping_lines?.[0]?.method_title || 'Standard',
        orderNotes: order.customer_note,
        items: order.line_items.map((item: WooCommerceLineItem) => ({
          sku: item.sku || `product-${item.product_id}`,
          name: item.name,
          needed: item.quantity,
          scanned: 0,
          price: parseFloat(item.price),
          image: item.image?.src,
          productId: item.product_id,
          weight: productWeights.get(item.product_id) || 0, // Add actual weight
        })),
      };
    });

    console.log(
      'Created packages:',
      packages.map(p => ({
        id: p.id,
        orderNumber: p.orderNumber,
        customerName: p.customerName,
        address: p.shippingAddress.address_1,
        totalWeight: p.items.reduce((sum, item) => sum + (item.weight || 0) * item.needed, 0),
      }))
    );

    return {
      success: true,
      data: packages,
    };
  } catch (error) {
    console.error('Error in getPackagesForDate:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Test WooCommerce date filtering
export async function testWooCommerceDateFiltering(): Promise<
  WooCommerceApiResponse<{
    recentOrdersCount: number;
    todayOrdersCount: number;
    recentOrders: WooCommerceOrder[];
    todayOrders: WooCommerceOrder[];
  }>
> {
  try {
    console.log('Testing WooCommerce date filtering...');

    // Test 1: Get all recent orders (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const recentOrders = await WooCommerce.get('orders', {
      after: `${thirtyDaysAgoStr}T00:00:00`,
      per_page: 10,
      status: 'any',
    });

    const recentOrdersData = isArrayData(recentOrders.data)
      ? (recentOrders.data as WooCommerceOrder[])
      : [];

    console.log('Recent orders (last 30 days):', {
      count: recentOrdersData.length,
      orders: recentOrdersData.map((order: WooCommerceOrder) => ({
        id: order.id,
        date_created: order.date_created,
        billing: order.billing,
      })),
    });

    // Test 2: Get orders from today
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = await WooCommerce.get('orders', {
      after: `${today}T00:00:00`,
      before: `${today}T23:59:59`,
      per_page: 10,
      status: 'any',
    });

    const todayOrdersData = isArrayData(todayOrders.data)
      ? (todayOrders.data as WooCommerceOrder[])
      : [];

    console.log("Today's orders:", {
      count: todayOrdersData.length,
      orders: todayOrdersData.map((order: WooCommerceOrder) => ({
        id: order.id,
        date_created: order.date_created,
        billing: order.billing,
      })),
    });

    return {
      success: true,
      data: {
        recentOrdersCount: recentOrdersData.length,
        todayOrdersCount: todayOrdersData.length,
        recentOrders: recentOrdersData,
        todayOrders: todayOrdersData,
      },
    };
  } catch (error) {
    console.error('Error testing WooCommerce date filtering:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Update order status to completed
export async function updateOrderStatus(
  orderId: number,
  status: 'completed' | 'processing' | 'cancelled' | 'refunded'
): Promise<WooCommerceApiResponse<WooCommerceOrder>> {
  try {
    console.log(`Updating order ${orderId} status to ${status}`);

    const response = await WooCommerce.put(`orders/${orderId}`, {
      status: status,
    });

    const updatedOrder = response.data as WooCommerceOrder;

    console.log('Order status updated successfully:', {
      orderId,
      newStatus: status,
      responseStatus: updatedOrder.status,
    });

    return {
      success: true,
      data: updatedOrder,
    };
  } catch (error) {
    console.error('Error updating order status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Barcode mapping for DM products to Welmora SKUs
interface BarcodeMapping {
  dmBarcode: string;
  welmoraSku: string;
  productName: string;
}

// This would typically come from a database or CSV import
// For now, we'll create a sample mapping based on the CSV data
const BARCODE_MAPPINGS: BarcodeMapping[] = [
  // Example mappings from CSV - these would be imported from your product database
  {
    dmBarcode: '4251758427366',
    welmoraSku: '4251758427366',
    productName: 'Kapsule za perilicu posuđa Ultimate Plus Citrus',
  },
  {
    dmBarcode: '4251758427403',
    welmoraSku: '4251758427403',
    productName: 'All-in-1 tablete za pranje posuđa Ultimate Fresh',
  },
  {
    dmBarcode: '8700216088602',
    welmoraSku: '8700216088602',
    productName: 'Sredstvo za pranje rublja Standard',
  },
  // Add more mappings as needed...
];

// Function to find Welmora SKU from DM barcode
function findWelmoraSkuFromBarcode(dmBarcode: string): string | null {
  const mapping = BARCODE_MAPPINGS.find(m => m.dmBarcode === dmBarcode);
  return mapping ? mapping.welmoraSku : null;
}

// Enhanced search function for scanning
export async function findProductByBarcode(
  scannedCode: string,
  date: string
): Promise<{
  success: boolean;
  product?: {
    name: string;
    sku: string;
    packageId: string;
    orderId: number;
    customerName: string;
    needed: number;
    scanned: number;
    message: string;
  };
  error?: string;
}> {
  try {
    // First, try to find Welmora SKU from DM barcode
    const welmoraSku = findWelmoraSkuFromBarcode(scannedCode);
    const searchSku = welmoraSku || scannedCode;

    // Get orders for the specified date
    const selectedDate = date;
    const startDate = selectedDate;
    const endDate = selectedDate;

    const ordersResult = await getOrdersByDateRange(startDate, endDate);

    if (!ordersResult.success || !ordersResult.data) {
      return {
        success: false,
        error: 'Failed to fetch orders for the specified date',
      };
    }

    // Search for the product in all orders
    for (const order of ordersResult.data) {
      for (const item of order.line_items) {
        // Try to match by SKU, product_id, or name
        const matchesSku = item.sku === searchSku || item.sku === scannedCode;
        const matchesProductId =
          item.product_id.toString() === searchSku || item.product_id.toString() === scannedCode;
        const matchesName = item.name.toLowerCase().includes(scannedCode.toLowerCase());

        if (matchesSku || matchesProductId || matchesName) {
          // Found the product! Return package information
          const customerName = `${order.billing.first_name} ${order.billing.last_name}`;

          return {
            success: true,
            product: {
              name: item.name,
              sku: item.sku || `product-${item.product_id}`,
              packageId: `package-${order.id}`,
              orderId: order.id,
              customerName: customerName,
              needed: item.quantity,
              scanned: 0,
              message: `✅ FOUND: ${item.name} → PACKAGE #${order.id} (${customerName}) - ${item.quantity}x needed`,
            },
          };
        }
      }
    }

    // Product not found
    return {
      success: false,
      error: `Product with barcode "${scannedCode}" not found in orders for ${date}. ${welmoraSku ? `Mapped to SKU: ${welmoraSku}` : 'No mapping found.'}`,
    };
  } catch (error) {
    console.error('Error in barcode search:', error);
    return {
      success: false,
      error: 'Internal server error',
    };
  }
}
