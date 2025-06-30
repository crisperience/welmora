import api from '@/lib/api/woocommerce/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sku, stock_status } = body;

    if (!sku || !stock_status) {
      return NextResponse.json(
        {
          error: 'SKU and stock_status are required',
        },
        { status: 400 }
      );
    }

    // Validate stock_status
    const validStatuses = ['instock', 'outofstock', 'backorder'];
    if (!validStatuses.includes(stock_status)) {
      return NextResponse.json(
        {
          error: `Invalid stock_status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    console.log(`Updating stock for SKU ${sku}: ${stock_status}`);

    // First find the product by SKU
    const productResponse = await api.get('products', { sku, per_page: 1 });
    const products = productResponse.data as Array<{ id: number; name: string; sku: string }>;

    if (products.length === 0) {
      return NextResponse.json(
        {
          error: 'Product not found with this SKU',
        },
        { status: 404 }
      );
    }

    const product = products[0];

    // Handle different stock statuses for WooCommerce
    let updateData: {
      stock_status: string;
      manage_stock: boolean;
      stock_quantity?: number;
      backorders: string;
    };

    if (stock_status === 'backorder') {
      // For backorder: set stock to outofstock but enable backorders
      updateData = {
        stock_status: 'outofstock',
        manage_stock: true,
        stock_quantity: 0,
        backorders: 'yes', // Allow backorders
      };
    } else {
      // For instock/outofstock: standard behavior
      updateData = {
        stock_status: stock_status,
        manage_stock: false,
        backorders: 'no', // Disable backorders
      };
    }

    console.log(`WooCommerce update data for ${sku}:`, updateData);

    await api.put(`products/${product.id}`, updateData);

    return NextResponse.json({
      success: true,
      message: 'Stock status updated successfully',
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      newStatus: stock_status,
      wooCommerceData: updateData,
    });
  } catch (error) {
    console.error('Stock update error:', error);

    // Log more details about the error
    if (error && typeof error === 'object' && 'response' in error) {
      const axiosError = error as {
        response?: { status?: number; statusText?: string; data?: unknown };
      };
      console.error('WooCommerce API Error Details:', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
      });
    }

    return NextResponse.json(
      {
        error: 'Failed to update stock status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
