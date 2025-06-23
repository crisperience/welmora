import {
  getWooCommerceCustomers,
  getWooCommerceOrders,
  getWooCommerceProducts,
  testWooCommerceConnection,
  testWooCommerceDateFiltering,
} from '@/lib/woocommerce/client';
import { NextResponse } from 'next/server';

export async function GET() {
  const results = {
    woocommerce: { success: false, message: '', data: false },
    products: { success: false, message: '', data: [] as unknown[] },
    orders: { success: false, message: '', data: [] as unknown[] },
    customers: { success: false, message: '', data: [] as unknown[] },
    dateFiltering: { success: false, message: '', data: null as unknown },
  };

  try {
    // Test WooCommerce connection
    const result = await testWooCommerceConnection();
    results.woocommerce = {
      success: result.success,
      message: result.success
        ? 'WooCommerce connection successful'
        : 'WooCommerce connection failed',
      data: result.data || false,
    };

    if (result.success) {
      // Test products
      const productsTest = await getWooCommerceProducts({ per_page: 5 });
      results.products = {
        success: productsTest.success,
        message: productsTest.success
          ? 'Products fetched successfully'
          : 'Failed to fetch products',
        data: productsTest.data || [],
      };

      // Test orders
      const ordersTest = await getWooCommerceOrders({ per_page: 5 });
      results.orders = {
        success: ordersTest.success,
        message: ordersTest.success ? 'Orders fetched successfully' : 'Failed to fetch orders',
        data: ordersTest.data || [],
      };

      // Test customers
      const customersTest = await getWooCommerceCustomers({ per_page: 5 });
      results.customers = {
        success: customersTest.success,
        message: customersTest.success
          ? 'Customers fetched successfully'
          : 'Failed to fetch customers',
        data: customersTest.data || [],
      };

      // Test date filtering
      const dateFilteringTest = await testWooCommerceDateFiltering();
      results.dateFiltering = {
        success: dateFilteringTest.success,
        message: dateFilteringTest.success
          ? 'Date filtering test successful'
          : 'Date filtering test failed',
        data: dateFilteringTest.data || null,
      };
    }

    // Debug environment variables (without exposing secrets)
    const envDebug = {
      woocommerceUrl: process.env.WOOCOMMERCE_URL || process.env.NEXT_PUBLIC_WOOCOMMERCE_URL,
      hasWooCommerceKey: !!(process.env.WOOCOMMERCE_CONSUMER_KEY || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_KEY),
      hasWooCommerceSecret: !!(process.env.WOOCOMMERCE_CONSUMER_SECRET || process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_SECRET),
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
    };

    return NextResponse.json({
      message: 'API is working!',
      timestamp: new Date().toISOString(),
      woocommerce: result,
      environment: envDebug,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'API test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
