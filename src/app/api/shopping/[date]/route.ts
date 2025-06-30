import { generateDailySnapshot } from '@/lib/api/woocommerce/client';
import { NextResponse } from 'next/server';

// TODO: Add HR integration
// - Create /api/shopping-hr/[date] endpoint using generateDailySnapshotHr()
// - Add webshop selector dropdown in frontend
// - Support unified view of both .ch and .hr orders

export async function GET(request: Request, { params }: { params: Promise<{ date: string }> }) {
  try {
    const { date } = await params;

    console.log('Shopping API called for date:', date);

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD' }, { status: 400 });
    }

    // Debug environment variables
    const envDebug = {
      woocommerceUrl: process.env.WOOCOMMERCE_URL,
      hasWooCommerceKey: !!process.env.WOOCOMMERCE_CONSUMER_KEY,
      hasWooCommerceSecret: !!process.env.WOOCOMMERCE_CONSUMER_SECRET,
    };

    console.log('Environment debug:', envDebug);

    const result = await generateDailySnapshot(date);

    console.log('Shopping snapshot result:', { success: result.success, error: result.error });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
          debug: envDebug,
          date,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error('Shopping API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate shopping snapshot',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
