import { createMetroBrightDataScraper } from '@/lib/scrapers/metro-scraper-brightdata';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { gtin } = await request.json();

    if (!gtin) {
      return NextResponse.json({ error: 'GTIN is required' }, { status: 400 });
    }

    console.log(`Testing Metro Bright Data scraper for GTIN: ${gtin}`);

    const scraper = createMetroBrightDataScraper();
    const result = await scraper.scrapeProduct(gtin);

    console.log(`Metro Bright Data test result for ${gtin}:`, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Metro Bright Data test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    console.log('Testing Metro Bright Data scraper with default GTIN: 7702018070794');

    const scraper = createMetroBrightDataScraper();
    const result = await scraper.scrapeProduct('7702018070794');

    console.log('Metro Bright Data test result for 7702018070794:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Metro Bright Data test error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
