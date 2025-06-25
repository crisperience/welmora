import { createMuellerScraper } from '@/lib/scrapers/mueller-scraper';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gtin } = body;

    if (!gtin) {
      return NextResponse.json({ error: 'GTIN is required' }, { status: 400 });
    }

    console.log(`Testing Mueller scraper for GTIN: ${gtin}`);

    const scraper = createMuellerScraper();
    const result = await scraper.scrapeProduct(gtin);

    console.log(`Mueller test result for ${gtin}:`, result);

    return NextResponse.json({
      success: true,
      gtin,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Mueller test error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
