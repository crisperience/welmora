import WooCommerce from '@/lib/woocommerce/client';
import { NextRequest, NextResponse } from 'next/server';

interface WooCommerceProduct {
  id: number;
  sku: string;
  name: string;
  stock_quantity: string;
  stock_status: string;
  price: string;
  date_modified: string;
  date_created: string;
}

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  stock_quantity: number;
  stock_status: string;
  price: string;
  last_updated: string;
}

interface InventoryUpdate {
  sku: string;
  stock_quantity: number;
  stock_status: string;
  price?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const per_page = parseInt(searchParams.get('per_page') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'publish';

    const response = await WooCommerce.get('products', {
      page,
      per_page,
      search,
      status,
    });

    if (!response.data || !Array.isArray(response.data)) {
      return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
    }

    const inventory: InventoryItem[] = response.data.map((product: WooCommerceProduct) => ({
      id: product.id,
      sku: product.sku || '',
      name: product.name,
      stock_quantity: parseInt(product.stock_quantity || '0'),
      stock_status: product.stock_status || 'instock',
      price: product.price || '0',
      last_updated: product.date_modified || product.date_created,
    }));

    return NextResponse.json({
      success: true,
      data: inventory,
      pagination: {
        page,
        per_page,
        total: response.headers['x-wp-total']
          ? parseInt(response.headers['x-wp-total'] as string)
          : 0,
        totalPages: response.headers['x-wp-totalpages']
          ? parseInt(response.headers['x-wp-totalpages'] as string)
          : 0,
      },
    });
  } catch (error) {
    console.error('Inventory fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: InventoryUpdate = await request.json();
    const { sku, stock_quantity, stock_status, price } = body;

    if (!sku) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 });
    }

    // Find product by SKU
    const searchResponse = await WooCommerce.get(`products?sku=${sku}`);

    if (
      !searchResponse.data ||
      !Array.isArray(searchResponse.data) ||
      searchResponse.data.length === 0
    ) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = searchResponse.data[0] as WooCommerceProduct;
    const updateData: Record<string, unknown> = {
      stock_quantity,
      stock_status,
    };

    if (price) {
      updateData.price = price;
    }

    const response = await WooCommerce.put(`products/${product.id}`, updateData);

    return NextResponse.json({
      success: true,
      message: 'Inventory updated successfully',
      data: response.data,
    });
  } catch (error) {
    console.error('Inventory update error:', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { updates } = body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'Updates array is required' }, { status: 400 });
    }

    const results = [];
    const errors = [];

    for (const update of updates) {
      try {
        const { sku, stock_quantity, stock_status, price } = update;

        // Find product by SKU
        const searchResponse = await WooCommerce.get(`products?sku=${sku}`);

        if (
          !searchResponse.data ||
          !Array.isArray(searchResponse.data) ||
          searchResponse.data.length === 0
        ) {
          errors.push({ sku, error: 'Product not found' });
          continue;
        }

        const product = searchResponse.data[0] as WooCommerceProduct;
        const updateData: Record<string, unknown> = {
          stock_quantity,
          stock_status,
        };

        if (price) {
          updateData.price = price;
        }

        const response = await WooCommerce.put(`products/${product.id}`, updateData);
        results.push({ sku, success: true, data: response.data });
      } catch (error) {
        errors.push({
          sku: update.sku,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.length} products, ${errors.length} errors`,
      results,
      errors,
    });
  } catch (error) {
    console.error('Bulk inventory update error:', error);
    return NextResponse.json({ error: 'Failed to update inventory' }, { status: 500 });
  }
}
