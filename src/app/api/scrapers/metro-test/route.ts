import { createMetroScraper } from '@/lib/scrapers/metro-scraper';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { gtin, testUrl } = body;

        if (!gtin && !testUrl) {
            return NextResponse.json({ error: 'GTIN or testUrl is required' }, { status: 400 });
        }

        console.log(`Testing Metro scraper for GTIN: ${gtin} or URL: ${testUrl}`);

        const scraper = createMetroScraper();

        let result;
        if (testUrl) {
            // Test with a specific URL
            result = await scraper.scrapeProduct('test');
        } else {
            result = await scraper.scrapeProduct(gtin);
        }

        console.log(`Metro test result for ${gtin || testUrl}:`, result);

        return NextResponse.json({
            success: true,
            gtin: gtin || 'test',
            testUrl,
            result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Metro test error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}

// Add a GET endpoint for manual testing
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const gtin = searchParams.get('gtin') || '4005900123456'; // Test with a common German product GTIN

        console.log(`GET Metro test for GTIN: ${gtin}`);

        const scraper = createMetroScraper();
        const result = await scraper.scrapeProduct(gtin);

        console.log(`Metro GET test result for ${gtin}:`, result);

        return NextResponse.json({
            success: true,
            gtin,
            result,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Metro GET test error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
} 