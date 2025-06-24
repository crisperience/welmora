import { getOrdersByDateRange } from '@/lib/woocommerce/client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get orders for the last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const response = await getOrdersByDateRange(startDateStr, endDateStr);

    if (!response.success || !response.data) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Count orders per day - handle timezone correctly
    const counts: Record<string, number> = {};

    response.data.forEach((order: { date_created: string }) => {
      // Parse the UTC date from WooCommerce and extract just the date part
      // WooCommerce date_created is in format: "2024-06-23T10:30:00"
      const dateOnly = order.date_created.split('T')[0];

      counts[dateOnly] = (counts[dateOnly] || 0) + 1;
    });

    console.log('Order counts by date:', counts);
    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error fetching order counts:', error);
    return NextResponse.json({ error: 'Failed to fetch order counts' }, { status: 500 });
  }
}
