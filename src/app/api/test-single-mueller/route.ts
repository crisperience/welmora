import { createMuellerScraper } from '@/lib/scrapers/mueller-scraper';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const gtin = searchParams.get('gtin') || '8720181204081'; // Axe Epic Fresh

        console.log(`Testing improved Mueller scraper for GTIN: ${gtin}`);

        const scraper = createMuellerScraper();

        // Clear cache to ensure fresh data
        await scraper.clearCache();

        // Test the scraper
        const result = await scraper.scrapeProduct(gtin);

        return NextResponse.json({
            success: true,
            gtin: gtin,
            result: result,
            timestamp: new Date().toISOString(),
            improvements: [
                'Added strict URL validation (/p/ requirement)',
                'Improved brand matching with word boundaries',
                'Added final validation to reject search URLs',
                'Enhanced product URL pattern checking'
            ]
        });
    } catch (error) {
        console.error('Test error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                gtin: new URL(request.url).searchParams.get('gtin') || '8720181204081'
            },
            { status: 500 }
        );
    }
} 