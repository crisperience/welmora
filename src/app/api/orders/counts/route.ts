import { getOrdersByDateRange } from '@/lib/woocommerce/client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Get orders for the last 30 days to show counts on calendar
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log('ORDER COUNTS DEBUG - Date range:', {
      startDateStr,
      endDateStr,
      currentTime: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      note: 'Fetching PROCESSING orders only for calendar'
    });

    const response = await getOrdersByDateRange(startDateStr, endDateStr);

    if (!response.success || !response.data) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Count orders per day - use ALL orders from the date range, not filtered ones
    const counts: Record<string, number> = {};

    response.data.forEach((order: { date_created: string; id?: number }) => {
      // Parse the UTC date from WooCommerce and extract just the date part
      const dateOnly = order.date_created.split('T')[0];

      console.log('ORDER COUNTS DEBUG - Processing order:', {
        orderId: order.id,
        date_created_full: order.date_created,
        date_only: dateOnly,
        time_part: order.date_created.split('T')[1],
      });

      counts[dateOnly] = (counts[dateOnly] || 0) + 1;
    });

    console.log('ORDER COUNTS DEBUG - Final counts:', counts);
    console.log(
      'ORDER COUNTS DEBUG - Sample order dates:',
      response.data.slice(0, 3).map(o => ({
        id: o.id,
        date_created: o.date_created,
        extracted_date: o.date_created.split('T')[0],
      }))
    );

    return NextResponse.json(counts);
  } catch (error) {
    console.error('Error fetching order counts:', error);
    return NextResponse.json({ error: 'Failed to fetch order counts' }, { status: 500 });
  }
}
