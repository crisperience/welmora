declare module 'woocommerce-api' {
    interface WooCommerceConfig {
        url: string
        consumerKey: string
        consumerSecret: string
        version?: string
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