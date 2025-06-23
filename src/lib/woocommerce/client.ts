import WooCommerceRestApi from 'woocommerce-api'

const WooCommerce = new WooCommerceRestApi({
    url: process.env.WOOCOMMERCE_URL!,
    consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY!,
    consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET!,
    version: 'wc/v3',
    queryStringAuth: true
})

export default WooCommerce

// Test connection function
export async function testWooCommerceConnection() {
    try {
        const response = await WooCommerce.get('products', { per_page: 1 })
        return {
            success: true,
            message: 'WooCommerce connection successful',
            data: response.data
        }
    } catch (error) {
        return {
            success: false,
            message: 'WooCommerce connection failed',
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
}) {
    try {
        const response = await WooCommerce.get('products', {
            page: params?.page || 1,
            per_page: params?.per_page || 20,
            search: params?.search || '',
            status: params?.status || 'publish'
        })

        return {
            success: true,
            data: response.data,
            headers: response.headers
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
}) {
    try {
        const response = await WooCommerce.get('orders', {
            page: params?.page || 1,
            per_page: params?.per_page || 20,
            status: params?.status || 'any'
        })

        return {
            success: true,
            data: response.data,
            headers: response.headers
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
}) {
    try {
        const response = await WooCommerce.get('customers', {
            page: params?.page || 1,
            per_page: params?.per_page || 20,
            search: params?.search || ''
        })

        return {
            success: true,
            data: response.data,
            headers: response.headers
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }
    }
} 