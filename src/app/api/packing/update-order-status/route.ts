import { updateOrderStatus } from '@/lib/api/woocommerce/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    // Validate input
    if (!orderId || !status) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing orderId or status',
        },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['completed', 'processing', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Update order status in WooCommerce
    const result = await updateOrderStatus(orderId, status);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to update order status',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        newStatus: status,
        order: result.data,
      },
    });
  } catch (error) {
    console.error('Error in update-order-status API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    );
  }
}
