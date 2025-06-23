import {
    getWooCommerceCustomers,
    getWooCommerceOrders,
    getWooCommerceProducts,
    testWooCommerceConnection,
    testWooCommerceDateFiltering
} from '@/lib/woocommerce/client'
import { NextResponse } from 'next/server'

export async function GET() {
    const results = {
        woocommerce: { success: false, message: '', data: false },
        products: { success: false, message: '', data: [] as unknown[] },
        orders: { success: false, message: '', data: [] as unknown[] },
        customers: { success: false, message: '', data: [] as unknown[] },
        dateFiltering: { success: false, message: '', data: null as unknown }
    }

    try {
        // Test WooCommerce connection
        const wooCommerceTest = await testWooCommerceConnection()
        results.woocommerce = {
            success: wooCommerceTest.success,
            message: wooCommerceTest.success ? 'WooCommerce connection successful' : 'WooCommerce connection failed',
            data: wooCommerceTest.data || false
        }

        if (wooCommerceTest.success) {
            // Test products
            const productsTest = await getWooCommerceProducts({ per_page: 5 })
            results.products = {
                success: productsTest.success,
                message: productsTest.success ? 'Products fetched successfully' : 'Failed to fetch products',
                data: productsTest.data || []
            }

            // Test orders
            const ordersTest = await getWooCommerceOrders({ per_page: 5 })
            results.orders = {
                success: ordersTest.success,
                message: ordersTest.success ? 'Orders fetched successfully' : 'Failed to fetch orders',
                data: ordersTest.data || []
            }

            // Test customers
            const customersTest = await getWooCommerceCustomers({ per_page: 5 })
            results.customers = {
                success: customersTest.success,
                message: customersTest.success ? 'Customers fetched successfully' : 'Failed to fetch customers',
                data: customersTest.data || []
            }

            // Test date filtering
            const dateFilteringTest = await testWooCommerceDateFiltering()
            results.dateFiltering = {
                success: dateFilteringTest.success,
                message: dateFilteringTest.success ? 'Date filtering test successful' : 'Date filtering test failed',
                data: dateFilteringTest.data || null
            }
        }

        return NextResponse.json(results)
    } catch (error) {
        return NextResponse.json({
            error: 'Test failed',
            message: error instanceof Error ? error.message : 'Unknown error',
            results
        }, { status: 500 })
    }
} 