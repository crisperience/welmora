import { BatchProcessor } from '@/lib/scrapers/batch-processor';
import { createMuellerScraper } from '@/lib/scrapers/mueller-scraper';
import WooCommerce from '@/lib/woocommerce/client';
import { NextRequest, NextResponse } from 'next/server';

interface WooCommerceProduct {
    id: number;
    name: string;
    sku: string;
    meta_data?: Array<{ key: string; value: string }>;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'scrape_ultra_conservative') {
            console.log('Starting ULTRA-CONSERVATIVE Mueller scraping...');

            // Fetch ALL products
            let allProducts: WooCommerceProduct[] = [];
            let page = 1;
            let hasMorePages = true;

            while (hasMorePages) {
                console.log(`Fetching page ${page} of products...`);
                const response = await WooCommerce.get('products', {
                    per_page: 100,
                    status: 'publish',
                    page: page,
                    orderby: 'title',
                    order: 'asc',
                });

                const products = response.data as WooCommerceProduct[];
                allProducts = allProducts.concat(products);

                hasMorePages = products.length === 100;
                page++;
            }

            console.log(`Found ${allProducts.length} total products to scrape`);

            // Filter products that need scraping (have GTIN but no recent Mueller data)
            const productsToScrape = allProducts.filter(product => {
                const gtin = product.meta_data?.find(meta => meta.key === '_gtin')?.value;
                const lastUpdated = product.meta_data?.find(meta => meta.key === '_mueller_last_updated')?.value;

                if (!gtin) return false;

                // Only scrape if never updated or updated more than 24 hours ago
                if (!lastUpdated) return true;

                const lastUpdateTime = new Date(lastUpdated).getTime();
                const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);

                return lastUpdateTime < twentyFourHoursAgo;
            });

            console.log(`${productsToScrape.length} products need scraping`);

            // Prepare batch items
            const batchItems = productsToScrape.map(product => {
                const gtin = product.meta_data?.find(meta => meta.key === '_gtin')?.value || '';
                return {
                    id: product.id.toString(),
                    gtin: gtin,
                    name: product.name,
                };
            });

            // Create ULTRA-CONSERVATIVE scraper and batch processor
            const scraper = createMuellerScraper();
            const batchProcessor = new BatchProcessor({
                batchSize: 1, // ONE AT A TIME
                concurrency: 1, // NO PARALLELIZATION
                delayBetweenBatches: 5000, // 5 seconds between batches
                delayBetweenItems: 10000, // 10 seconds between items
                maxRetries: 3,
                onProgress: progress => {
                    console.log(
                        `🐌 ULTRA-CONSERVATIVE Progress: ${progress.completed}/${progress.total} (${Math.round((progress.completed / progress.total) * 100)}%) - Success: ${progress.successful}, Failed: ${progress.failed}`
                    );
                },
            });

            // Process all items using ultra-conservative approach
            const batchResults = await batchProcessor.processBatch(batchItems, scraper);

            // Save results to WooCommerce
            let saved = 0;
            let errors = 0;

            for (const batchResult of batchResults) {
                const product = allProducts.find(p => p.id.toString() === batchResult.id);
                if (!product || !batchResult.success || !batchResult.data) continue;

                const muellerData = batchResult.data as { price?: number; productUrl?: string };

                // Only save if we have valid data
                if (muellerData.price || (muellerData.productUrl && muellerData.productUrl.includes('/p/'))) {
                    try {
                        console.log(`💾 Saving ultra-conservative data for ${product.name}...`);

                        const metaData = [];

                        if (muellerData.price) {
                            metaData.push({ key: '_mueller_price', value: muellerData.price.toString() });
                        }

                        if (muellerData.productUrl && muellerData.productUrl.includes('/p/')) {
                            metaData.push({ key: '_mueller_url', value: muellerData.productUrl });
                        }

                        metaData.push({ key: '_mueller_last_updated', value: new Date().toISOString() });

                        await WooCommerce.put(`products/${product.id}`, {
                            meta_data: metaData,
                        });

                        saved++;
                        console.log(`✅ Saved ultra-conservative data for ${product.name}`);
                    } catch (saveError) {
                        console.error(`❌ Failed to save data for ${product.name}:`, saveError);
                        errors++;
                    }
                }
            }

            return NextResponse.json({
                success: true,
                message: '🐌 Ultra-conservative Mueller scraping completed',
                stats: {
                    total: allProducts.length,
                    needingScraping: productsToScrape.length,
                    processed: batchResults.length,
                    successful: batchResults.filter(r => r.success).length,
                    failed: batchResults.filter(r => !r.success).length,
                    saved,
                    saveErrors: errors,
                },
                approach: 'ULTRA-CONSERVATIVE',
                settings: {
                    batchSize: 1,
                    concurrency: 1,
                    delayBetweenBatches: '5 seconds',
                    delayBetweenItems: '10 seconds',
                },
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: unknown) {
        const err = error as { message?: string };
        console.error('Error in ultra-conservative scraping:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Ultra-conservative scraping failed',
                details: err.message || 'Unknown error',
            },
            { status: 500 }
        );
    }
} 