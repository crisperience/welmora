import { DailySnapshot, Package, ShoppingItem } from '@/types/woocommerce-api'
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api'

// Debug environment variables
console.log('WooCommerce Config:', {
    url: process.env.WOOCOMMERCE_URL || process.env.NEXT_PUBLIC_WOOCOMMERCE_URL,
    hasKey: !!(process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_KEY),
    hasSecret: !!(process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_SECRET)
})

const WooCommerce = new WooCommerceRestApi({
    url: process.env.WOOCOMMERCE_URL || process.env.NEXT_PUBLIC_WOOCOMMERCE_URL || 'https://welmora.ch',
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_KEY || '',
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_SECRET || '',
    version: 'wc/v3'
})

export default WooCommerce

// Interfaces for WooCommerce data structures
interface WooCommerceOrder {
    id: number
    date_created: string
    billing: {
        first_name: string
        last_name: string
        email: string
    }
    line_items: WooCommerceLineItem[]
}

interface WooCommerceLineItem {
    sku: string
    name: string
    quantity: number
    price: string
    product_id: number
    image?: {
        src: string
    }
}

interface WooCommerceProduct {
    id: number
    name: string
    sku: string
    price: string
    images: Array<{ src: string }>
}

interface WooCommerceCustomer {
    id: number
    email: string
    first_name: string
    last_name: string
}

interface WooCommerceApiResponse<T> {
    success: boolean
    data?: T
    error?: string
    headers?: Record<string, string>
}

// Helper function to safely access array data
function isArrayData(data: unknown): data is unknown[] {
    return Array.isArray(data)
}

// Test connection function
export async function testWooCommerceConnection(): Promise<WooCommerceApiResponse<boolean>> {
    try {
        console.log('Testing WooCommerce connection with config:', {
            url: process.env.WOOCOMMERCE_URL || process.env.NEXT_PUBLIC_WOOCOMMERCE_URL,
            hasKey: !!(process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_KEY),
            hasSecret: !!(process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_SECRET),
            version: 'wc/v3'
        })

        const response = await WooCommerce.get('products', { per_page: 1 })

        console.log('WooCommerce test response:', {
            success: true,
            dataLength: isArrayData(response.data) ? response.data.length : 0,
            headers: Object.keys(response.headers || {})
        })

        return {
            success: true,
            data: true
        }
    } catch (error) {
        console.error('WooCommerce connection error:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// Get products from WooCommerce
export async function getWooCommerceProducts(params?: {
    page?: number
    per_page?: number
    search?: string
    status?: string
}): Promise<WooCommerceApiResponse<WooCommerceProduct[]>> {
    try {
        const response = await WooCommerce.get('products', {
            page: params?.page || 1,
            per_page: params?.per_page || 20,
            search: params?.search || '',
            status: params?.status || 'publish'
        })

        return {
            success: true,
            data: isArrayData(response.data) ? response.data as WooCommerceProduct[] : [],
            headers: response.headers as Record<string, string>
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// Get orders from WooCommerce
export async function getWooCommerceOrders(params?: {
    page?: number
    per_page?: number
    status?: string
}): Promise<WooCommerceApiResponse<WooCommerceOrder[]>> {
    try {
        const response = await WooCommerce.get('orders', {
            page: params?.page || 1,
            per_page: params?.per_page || 20,
            status: params?.status || 'any'
        })

        return {
            success: true,
            data: isArrayData(response.data) ? response.data as WooCommerceOrder[] : [],
            headers: response.headers as Record<string, string>
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// Get customers from WooCommerce
export async function getWooCommerceCustomers(params?: {
    page?: number
    per_page?: number
    search?: string
}): Promise<WooCommerceApiResponse<WooCommerceCustomer[]>> {
    try {
        const response = await WooCommerce.get('customers', {
            page: params?.page || 1,
            per_page: params?.per_page || 20,
            search: params?.search || ''
        })

        return {
            success: true,
            data: isArrayData(response.data) ? response.data as WooCommerceCustomer[] : [],
            headers: response.headers as Record<string, string>
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// Get orders for a specific date range (for daily snapshot)
export async function getOrdersByDateRange(startDate: string, endDate: string): Promise<WooCommerceApiResponse<WooCommerceOrder[]>> {
    try {
        const startDateTime = `${startDate}T00:00:00`
        const endDateTime = `${endDate}T23:59:59`

        console.log('Fetching orders from WooCommerce:', {
            after: startDateTime,
            before: endDateTime
        })

        const response = await WooCommerce.get('orders', {
            after: startDateTime,
            before: endDateTime,
            status: 'processing,completed',
            per_page: 100
        })

        console.log('WooCommerce orders response:', {
            count: isArrayData(response.data) ? response.data.length : 0,
            headers: response.headers
        })

        return {
            success: true,
            data: isArrayData(response.data) ? response.data as WooCommerceOrder[] : [],
            headers: response.headers as Record<string, string>
        }
    } catch (error) {
        console.error('Error fetching orders by date range:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// Generate daily snapshot for shopping
export async function generateDailySnapshot(date: string): Promise<{ success: boolean; data?: DailySnapshot; error?: string }> {
    try {
        const yesterday = new Date(date)
        yesterday.setDate(yesterday.getDate() - 1)

        const startDate = yesterday.toISOString().split('T')[0]
        const endDate = date

        const ordersResult = await getOrdersByDateRange(startDate, endDate)

        if (!ordersResult.success || !ordersResult.data) {
            return {
                success: false,
                error: 'Failed to fetch orders'
            }
        }

        // Aggregate products from all orders
        const productMap = new Map<string, ShoppingItem>()

        ordersResult.data.forEach((order: WooCommerceOrder) => {
            order.line_items.forEach((item: WooCommerceLineItem) => {
                const sku = item.sku || `product-${item.product_id}`

                if (productMap.has(sku)) {
                    const existing = productMap.get(sku)!
                    existing.quantity += item.quantity
                } else {
                    productMap.set(sku, {
                        sku,
                        name: item.name,
                        quantity: item.quantity,
                        price: parseFloat(item.price),
                        image: item.image?.src
                    })
                }
            })
        })

        const snapshot: DailySnapshot = {
            date,
            products: Array.from(productMap.values()),
            totalOrders: ordersResult.data.length,
            generatedAt: new Date().toISOString()
        }

        return {
            success: true,
            data: snapshot
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// Get packages for packing (orders as individual packages)
export async function getPackagesForDate(date: string): Promise<{ success: boolean; data?: Package[]; error?: string }> {
    try {
        const yesterday = new Date(date)
        yesterday.setDate(yesterday.getDate() - 1)

        const startDate = yesterday.toISOString().split('T')[0]
        const endDate = date

        const ordersResult = await getOrdersByDateRange(startDate, endDate)

        if (!ordersResult.success || !ordersResult.data) {
            return {
                success: false,
                error: 'Failed to fetch orders'
            }
        }

        const packages: Package[] = ordersResult.data.map((order: WooCommerceOrder) => ({
            id: `package-${order.id}`,
            orderId: order.id,
            customerName: `${order.billing.first_name} ${order.billing.last_name}`,
            customerEmail: order.billing.email,
            orderDate: order.date_created,
            status: 'pending' as const,
            items: order.line_items.map((item: WooCommerceLineItem) => ({
                sku: item.sku || `product-${item.product_id}`,
                name: item.name,
                needed: item.quantity,
                scanned: 0,
                price: parseFloat(item.price),
                image: item.image?.src
            }))
        }))

        return {
            success: true,
            data: packages
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// Test WooCommerce date filtering
export async function testWooCommerceDateFiltering(): Promise<WooCommerceApiResponse<{
    recentOrdersCount: number
    todayOrdersCount: number
    recentOrders: WooCommerceOrder[]
    todayOrders: WooCommerceOrder[]
}>> {
    try {
        console.log('Testing WooCommerce date filtering...')

        // Test 1: Get all recent orders (last 30 days)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

        const recentOrders = await WooCommerce.get('orders', {
            after: `${thirtyDaysAgoStr}T00:00:00`,
            per_page: 10,
            status: 'any'
        })

        const recentOrdersData = isArrayData(recentOrders.data) ? recentOrders.data as WooCommerceOrder[] : []

        console.log('Recent orders (last 30 days):', {
            count: recentOrdersData.length,
            orders: recentOrdersData.map((order: WooCommerceOrder) => ({
                id: order.id,
                date_created: order.date_created,
                billing: order.billing
            }))
        })

        // Test 2: Get orders from today
        const today = new Date().toISOString().split('T')[0]
        const todayOrders = await WooCommerce.get('orders', {
            after: `${today}T00:00:00`,
            before: `${today}T23:59:59`,
            per_page: 10,
            status: 'any'
        })

        const todayOrdersData = isArrayData(todayOrders.data) ? todayOrders.data as WooCommerceOrder[] : []

        console.log('Today\'s orders:', {
            count: todayOrdersData.length,
            orders: todayOrdersData.map((order: WooCommerceOrder) => ({
                id: order.id,
                date_created: order.date_created,
                billing: order.billing
            }))
        })

        return {
            success: true,
            data: {
                recentOrdersCount: recentOrdersData.length,
                todayOrdersCount: todayOrdersData.length,
                recentOrders: recentOrdersData,
                todayOrders: todayOrdersData
            }
        }
    } catch (error) {
        console.error('Error testing WooCommerce date filtering:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
}

// Barcode mapping for DM products to Welmora SKUs
interface BarcodeMapping {
    dmBarcode: string
    welmoraSku: string
    productName: string
}

// This would typically come from a database or CSV import
// For now, we'll create a sample mapping based on the CSV data
const BARCODE_MAPPINGS: BarcodeMapping[] = [
    // Example mappings from CSV - these would be imported from your product database
    { dmBarcode: '4251758427366', welmoraSku: '4251758427366', productName: 'Kapsule za perilicu posuđa Ultimate Plus Citrus' },
    { dmBarcode: '4251758427403', welmoraSku: '4251758427403', productName: 'All-in-1 tablete za pranje posuđa Ultimate Fresh' },
    { dmBarcode: '8700216088602', welmoraSku: '8700216088602', productName: 'Sredstvo za pranje rublja Standard' },
    // Add more mappings as needed...
]

// Function to find Welmora SKU from DM barcode
function findWelmoraSkuFromBarcode(dmBarcode: string): string | null {
    const mapping = BARCODE_MAPPINGS.find(m => m.dmBarcode === dmBarcode)
    return mapping ? mapping.welmoraSku : null
}

// Enhanced search function for scanning
export async function findProductByBarcode(scannedCode: string, date: string): Promise<{
    success: boolean
    product?: {
        name: string
        sku: string
        packageId: string
        orderId: number
        customerName: string
        needed: number
        scanned: number
        message: string
    }
    error?: string
}> {
    try {
        // First, try to find Welmora SKU from DM barcode
        const welmoraSku = findWelmoraSkuFromBarcode(scannedCode)
        const searchSku = welmoraSku || scannedCode

        // Get orders for the specified date
        const yesterday = new Date(date)
        yesterday.setDate(yesterday.getDate() - 1)
        const startDate = yesterday.toISOString().split('T')[0]
        const endDate = date

        const ordersResult = await getOrdersByDateRange(startDate, endDate)

        if (!ordersResult.success || !ordersResult.data) {
            return {
                success: false,
                error: 'Failed to fetch orders for the specified date'
            }
        }

        // Search for the product in all orders
        for (const order of ordersResult.data) {
            for (const item of order.line_items) {
                // Try to match by SKU, product_id, or name
                const matchesSku = item.sku === searchSku || item.sku === scannedCode
                const matchesProductId = item.product_id.toString() === searchSku || item.product_id.toString() === scannedCode
                const matchesName = item.name.toLowerCase().includes(scannedCode.toLowerCase())

                if (matchesSku || matchesProductId || matchesName) {
                    // Found the product! Return package information
                    const customerName = `${order.billing.first_name} ${order.billing.last_name}`

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
                            message: `✅ FOUND: ${item.name} → PACKAGE #${order.id} (${customerName}) - ${item.quantity}x needed`
                        }
                    }
                }
            }
        }

        // Product not found
        return {
            success: false,
            error: `Product with barcode "${scannedCode}" not found in orders for ${date}. ${welmoraSku ? `Mapped to SKU: ${welmoraSku}` : 'No mapping found.'}`
        }

    } catch (error) {
        console.error('Error in barcode search:', error)
        return {
            success: false,
            error: 'Internal server error'
        }
    }
} 