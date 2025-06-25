import api from '@/lib/woocommerce/client';
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

    // Update product stock status only, don't change quantity
    const updateData = {
      stock_status,
      manage_stock: false, // Don't manage stock quantity, just status
    };

    await api.put(`products/${product.id}`, updateData);

    return NextResponse.json({
      success: true,
      message: 'Stock status updated successfully',
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      newStatus: stock_status,
    });
  } catch (error) {
    console.error('Stock update error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update stock status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
