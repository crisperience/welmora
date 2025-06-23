// Core types for Welmora Scanner application
export interface Product {
    id: string
    wc_product_id?: number
    name: string
    slug?: string
    sku?: string
    description?: string
    short_description?: string
    price?: number
    regular_price?: number
    sale_price?: number
    stock_quantity: number
    manage_stock: boolean
    stock_status: string
    status: 'draft' | 'pending' | 'private' | 'publish'
    weight?: number
    barcode?: string
    created_at: string
    updated_at: string
    synced_at?: string
}

export interface Customer {
    id: string
    wc_customer_id?: number
    email?: string
    username?: string
    first_name?: string
    last_name?: string
    display_name?: string
    phone?: string
    date_of_birth?: string
    avatar_url?: string
    is_paying_customer: boolean
    orders_count: number
    total_spent: number
    created_at: string
    updated_at: string
    synced_at?: string
}

export interface Order {
    id: string
    wc_order_id?: number
    order_number?: string
    customer_id?: string
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
    currency: string
    total: number
    subtotal?: number
    tax_total: number
    shipping_total: number
    discount_total: number
    payment_method?: string
    payment_method_title?: string
    transaction_id?: string
    date_created?: string
    date_modified?: string
    date_completed?: string
    date_paid?: string
    created_at: string
    updated_at: string
    synced_at?: string
}

export interface ScannerSession {
    id: string
    user_id: string
    session_name?: string
    started_at: string
    ended_at?: string
    items_scanned: number
    location?: string
    notes?: string
}

export interface ScannedItem {
    id: string
    session_id: string
    product_id?: string
    barcode: string
    quantity: number
    action: 'inventory_check' | 'stock_update' | 'sale' | 'price_check'
    expected_quantity?: number
    actual_quantity?: number
    notes?: string
    location?: string
    scanned_at: string
}

export interface UserProfile {
    id: string
    first_name?: string
    last_name?: string
    avatar_url?: string
    role: string
    last_login?: string
    created_at: string
    updated_at: string
}

export interface InventoryTransaction {
    id: string
    product_id: string
    type: 'sale' | 'restock' | 'adjustment' | 'return' | 'damaged'
    quantity: number
    previous_stock?: number
    new_stock?: number
    reason?: string
    notes?: string
    reference_id?: string
    user_id?: string
    created_at: string
}

export interface Category {
    id: string
    wc_category_id?: number
    name: string
    slug: string
    description?: string
    parent_id?: string
    image_url?: string
    display_order: number
    created_at: string
    updated_at: string
    synced_at?: string
}

export interface SyncLog {
    id: string
    sync_type: string
    direction: string
    status: string
    records_processed: number
    records_success: number
    records_error: number
    started_at: string
    completed_at?: string
    duration_ms?: number
}

// Enums
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type ProductStatus = 'draft' | 'pending' | 'private' | 'publish'
export type InventoryTransactionType = 'sale' | 'restock' | 'adjustment' | 'return' | 'damaged'
export type ScannerAction = 'inventory_check' | 'stock_update' | 'sale' | 'price_check'

// API Response types
export interface ApiResponse<T> {
    data?: T
    error?: string
    message?: string
}

export interface PaginatedResponse<T> {
    data: T[]
    total: number
    page: number
    per_page: number
    total_pages: number
} 