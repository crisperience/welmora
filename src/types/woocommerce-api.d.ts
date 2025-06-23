declare module 'woocommerce-api' {
    interface WooCommerceConfig {
        url: string
        consumerKey: string
        consumerSecret: string
        version: string
        queryStringAuth?: boolean
        timeout?: number
    }

    interface WooCommerceResponse<T = unknown> {
        data: T
        headers: Record<string, string>
        status: number
        statusText: string
    }

    class WooCommerceRestApi {
        constructor(config: WooCommerceConfig)

        get<T = unknown>(endpoint: string, params?: Record<string, unknown>): Promise<WooCommerceResponse<T>>
        post<T = unknown>(endpoint: string, data: Record<string, unknown>, params?: Record<string, unknown>): Promise<WooCommerceResponse<T>>
        put<T = unknown>(endpoint: string, data: Record<string, unknown>, params?: Record<string, unknown>): Promise<WooCommerceResponse<T>>
        delete<T = unknown>(endpoint: string, params?: Record<string, unknown>): Promise<WooCommerceResponse<T>>
        options<T = unknown>(endpoint: string, params?: Record<string, unknown>): Promise<WooCommerceResponse<T>>
    }

    export = WooCommerceRestApi
}

// Daily snapshot types for shopping workflow
export interface DailySnapshot {
    date: string // YYYY-MM-DD format
    products: ShoppingItem[]
    totalOrders: number
    generatedAt: string
}

export interface ShoppingItem {
    sku: string
    name: string
    quantity: number
    price?: number
    image?: string
}

// Package types for packing workflow
export interface Package {
    id: string
    orderId: number
    customerName: string
    customerEmail?: string
    orderDate: string
    items: PackageItem[]
    status: 'pending' | 'in-progress' | 'completed'
    qrCode?: string
}

export interface PackageItem {
    sku: string
    name: string
    needed: number
    scanned: number
    price?: number
    image?: string
}

// Scanner types
export interface ScanResult {
    type: 'qr' | 'barcode'
    data: string
    timestamp: string
}

export interface ValidationResult {
    valid: boolean
    message: string
    item?: PackageItem
    package?: Package
} 