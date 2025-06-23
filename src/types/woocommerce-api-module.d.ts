declare module '@woocommerce/woocommerce-rest-api' {
    interface WooCommerceConfig {
        url: string
        consumerKey: string
        consumerSecret: string
        version?: string
        queryStringAuth?: boolean
    }

    interface WooCommerceResponse {
        data: unknown
        headers: Record<string, string>
    }

    class WooCommerceRestApi {
        constructor(config: WooCommerceConfig)
        get(endpoint: string, params?: Record<string, unknown>): Promise<WooCommerceResponse>
        post(endpoint: string, data?: Record<string, unknown>): Promise<WooCommerceResponse>
        put(endpoint: string, data?: Record<string, unknown>): Promise<WooCommerceResponse>
        delete(endpoint: string): Promise<WooCommerceResponse>
    }

    export = WooCommerceRestApi
}

declare module 'woocommerce-api' {
    interface WooCommerceConfig {
        url: string
        consumerKey: string
        consumerSecret: string
        version?: string
        queryStringAuth?: boolean
    }

    interface WooCommerceResponse {
        data: unknown
        headers: Record<string, string>
    }

    class WooCommerceAPI {
        constructor(config: WooCommerceConfig)
        get(endpoint: string, params?: Record<string, unknown>): Promise<WooCommerceResponse>
        post(endpoint: string, data?: Record<string, unknown>): Promise<WooCommerceResponse>
        put(endpoint: string, data?: Record<string, unknown>): Promise<WooCommerceResponse>
        delete(endpoint: string): Promise<WooCommerceResponse>
    }

    export = WooCommerceAPI
} 