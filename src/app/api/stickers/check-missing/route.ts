import { checkMissingStickers } from '@/lib/services/checkMissingStickers';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/stickers/check-missing
 *
 * Check all WooCommerce products for missing stickers in Supabase storage
 * Returns a list of products that don't have corresponding PDF files
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get('format') || 'json'; // json, list
        const quick = searchParams.get('quick') === 'true';

        console.log('🔍 Starting missing stickers check...');

        // Run the missing stickers check
        const report = await checkMissingStickers(quick);

        // Return different formats based on request
        if (format === 'list') {
            // Return just the list of missing SKUs
            const missingSkus = report.missingStickers.map(product => product.sku);

            return NextResponse.json({
                success: true,
                totalProducts: report.totalProducts,
                productsWithStickers: report.productsWithStickers,
                productsWithoutStickers: report.productsWithoutStickers,
                withStickersPercentage: report.withStickersPercentage,
                missingSkus: missingSkus,
                lastChecked: report.lastChecked,
            });
        }

        // Return full report
        return NextResponse.json({
            success: true,
            ...report,
        });
    } catch (error) {
        console.error('❌ Error in missing stickers check:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
} 