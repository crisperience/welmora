import { createDMScraper } from '@/lib/scrapers/dm-scraper';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        console.log('DM Scraper test endpoint called');

        const { searchParams } = new URL(request.url);
        const gtin = searchParams.get('gtin') || '4005808730735'; // Default test GTIN for a DM product

        console.log(`Testing DM scraper with GTIN: ${gtin}`);

        const scraper = createDMScraper();
        const result = await scraper.scrapeProduct(gtin);

        console.log('DM scraper result:', result);

        return NextResponse.json({
            success: true,
            gtin,
            result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('DM scraper test error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        console.log('DM Scraper batch test endpoint called');

        const body = await request.json();
        const gtins = body.gtins || ['4005808730735', '4058172628511']; // Default test GTINs

        console.log(`Testing DM scraper with GTINs: ${gtins.join(', ')}`);

        const scraper = createDMScraper();
        const results = await scraper.scrapeProducts(gtins);

        console.log('DM scraper batch results:', results);

        return NextResponse.json({
            success: true,
            gtins,
            results,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('DM scraper batch test error:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
} 