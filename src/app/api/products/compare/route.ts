import { BatchItem, BatchProcessor } from '@/lib/scrapers/batch-processor';
import { createDMScraper } from '@/lib/scrapers/dm-scraper';
import WooCommerce from '@/lib/woocommerce/client';
import { NextRequest, NextResponse } from 'next/server';

interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  stock_quantity: number | null;
  stock_status: string;
  backorders: string;
  manage_stock: boolean;
  images: Array<{ src: string }>;
  meta_data?: Array<{ key: string; value: string }>;
}



export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const search = searchParams.get('search');

    const api = WooCommerce;

    console.log('WooCommerce Config:', {
      url: process.env.WOOCOMMERCE_URL,
      hasKey: !!process.env.WOOCOMMERCE_KEY,
      hasSecret: !!process.env.WOOCOMMERCE_SECRET,
    });

    // Handle cache clearing action
    if (action === 'clear_cache') {
      try {
        // Clear caches for all scrapers
        const dmScraper = createDMScraper();

        if (typeof dmScraper.clearCache === 'function') {
          await dmScraper.clearCache();
        }
        console.log('Cache cleared for DM scraper');

        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully',
        });
      } catch (error) {
        console.error('Cache clearing error:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to clear cache',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
      }
    }

    // Prepare query parameters for WooCommerce
    const queryParams: Record<string, unknown> = {
      per_page: 100,
      status: 'publish',
      orderby: 'title',
      order: 'asc',
    };

    // Add search parameter if provided
    if (search) {
      queryParams.sku = search;
    }

    console.log('Fetching products with params:', queryParams);

    // Fetch products using pagination
    let allProducts: WooCommerceProduct[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`Fetching page ${page}...`);
      const response = await api.get('products', {
        ...queryParams,
        page: page,
      });
      const pageProducts = response.data as WooCommerceProduct[];

      if (pageProducts.length === 0) {
        hasMorePages = false;
      } else {
        allProducts = [...allProducts, ...pageProducts];
        page++;

        // Stop if we got less than per_page (last page)
        if (pageProducts.length < 100) {
          hasMorePages = false;
        }
      }
    }

    console.log(`WooCommerce API call successful - fetched ${allProducts.length} products from ${page - 1} pages`);
    console.log(`Total fetched: ${allProducts.length} products from WooCommerce`);

    // Transform products for comparison
    const comparisonProducts = allProducts.map(product => {
      // Extract metadata
      const dmPrice = product.meta_data?.find(meta => meta.key === '_dm_price')?.value;
      const dmUrl = product.meta_data?.find(meta => meta.key === '_dm_url')?.value;
      const dmLastUpdated = product.meta_data?.find(meta => meta.key === '_dm_last_updated')?.value;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        welmoraPrice: parseFloat(product.price) || 0,
        welmoraStock: product.stock_quantity,
        welmoraBackorders: product.backorders,
        welmoraStockStatus: product.stock_status,
        welmoraManageStock: product.manage_stock,
        welmoraImage: product.images?.[0]?.src || null,

        // DM data
        dmPrice: dmPrice ? parseFloat(dmPrice) : undefined,
        dmProductUrl: dmUrl || undefined,
        dmLastUpdated: dmLastUpdated || undefined,
      };
    });

    return NextResponse.json({
      success: true,
      data: comparisonProducts,
      total: comparisonProducts.length,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error in products/compare GET:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch products',
        details: err.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    const api = WooCommerce;

    if (action === 'clean_mueller_data') {
      console.log('Starting to clean all Mueller data from WooCommerce...');

      // Fetch ALL products using pagination
      let allProducts: WooCommerceProduct[] = [];
      let page = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        console.log(`Fetching page ${page} of products...`);
        const response = await api.get('products', {
          per_page: 100,
          status: 'publish',
          page: page,
        });
        const pageProducts = response.data as WooCommerceProduct[];

        if (pageProducts.length === 0) {
          hasMorePages = false;
        } else {
          allProducts = [...allProducts, ...pageProducts];
          page++;

          // Stop if we got less than per_page (last page)
          if (pageProducts.length < 100) {
            hasMorePages = false;
          }
        }
      }

      console.log(`Found ${allProducts.length} total products to clean`);

      let cleaned = 0;
      let skipped = 0;
      let errors = 0;

      for (const product of allProducts) {
        try {
          const metaData = product.meta_data || [];

          // Check if product has any Mueller data
          const hasMuellerData = metaData.some(meta =>
            meta.key === '_mueller_price' ||
            meta.key === '_mueller_url' ||
            meta.key === '_mueller_last_updated'
          );

          if (hasMuellerData) {
            console.log(`Cleaning Mueller data for: ${product.name}`);

            // Remove Mueller meta data by setting them to empty
            const cleanMetaData = [
              { key: '_mueller_price', value: '' },
              { key: '_mueller_url', value: '' },
              { key: '_mueller_last_updated', value: '' },
            ];

            const updateData = {
              meta_data: cleanMetaData,
            };

            await api.put(`products/${product.id}`, updateData);
            cleaned++;
            console.log(`✓ Cleaned Mueller data for ${product.name}`);
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`Failed to clean Mueller data for ${product.name}:`, error);
          errors++;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Mueller data cleaning completed',
        stats: {
          total: allProducts.length,
          cleaned,
          skipped,
          errors,
        },
      });
    }

    if (action === 'scrape_all_dm') {
      console.log('Starting optimized DM scraping for all products...');

      // Fetch ALL products using pagination
      let allProducts: WooCommerceProduct[] = [];
      let page = 1;
      let hasMorePages = true;

      while (hasMorePages) {
        console.log(`Fetching page ${page} of products...`);
        const response = await api.get('products', {
          per_page: 100,
          status: 'publish',
          page: page,
        });
        const pageProducts = response.data as WooCommerceProduct[];

        if (pageProducts.length === 0) {
          hasMorePages = false;
        } else {
          allProducts = [...allProducts, ...pageProducts];
          page++;

          // Stop if we got less than per_page (last page)
          if (pageProducts.length < 100) {
            hasMorePages = false;
          }
        }
      }

      console.log(`Found ${allProducts.length} total products to scrape`);

      // Filter products with valid GTINs and prepare batch items
      const batchItems: BatchItem[] = allProducts
        .filter(product => {
          const gtin = product.sku;
          return gtin && gtin.length === 13 && /^\d+$/.test(gtin);
        })
        .map(product => ({
          id: product.id.toString(),
          gtin: product.sku,
          name: product.name,
        }));

      console.log(`Prepared ${batchItems.length} valid products for batch processing`);

      // Create optimized scraper and batch processor
      const scraper = createDMScraper();
      const batchProcessor = new BatchProcessor({
        batchSize: 5, // Reduced to avoid browser pool overload
        concurrency: 1, // Reduced to 1 to avoid page conflicts
        delayBetweenBatches: 2000, // Increased to 2 seconds
        delayBetweenItems: 1000, // Increased to 1 second
        maxRetries: 2,
        onProgress: progress => {
          console.log(
            `DM Batch Progress: ${progress.completed}/${progress.total} (${Math.round((progress.completed / progress.total) * 100)}%) - Success: ${progress.successful}, Failed: ${progress.failed}, Cached: ${progress.cached}`
          );
        },
      });

      // Process all items using the batch processor
      const batchResults = await batchProcessor.processBatch(batchItems, scraper);

      // Process results and save to WooCommerce
      const results = [];
      let saved = 0;
      let errors = 0;

      for (const batchResult of batchResults) {
        const product = allProducts.find(p => p.id.toString() === batchResult.id);
        if (!product) continue;

        const result: {
          sku: string;
          gtin: string;
          name: string;
          dmPrice?: number;
          dmStock?: number;
          dmProductUrl?: string;
          found: boolean;
          saved: boolean;
          error?: string;
          cached?: boolean;
          duration: number;
        } = {
          sku: product.sku,
          gtin: batchResult.gtin,
          name: product.name,
          found: batchResult.success,
          saved: false,
          error: batchResult.error,
          cached: batchResult.cached,
          duration: batchResult.duration,
        };

        // Extract DM data from batch result
        if (batchResult.success && batchResult.data) {
          const dmData = batchResult.data as { price?: number; productUrl?: string };
          result.dmPrice = dmData.price;
          result.dmProductUrl = dmData.productUrl;

          // Save to WooCommerce if we have valid data
          if (
            dmData.price ||
            (dmData.productUrl &&
              !dmData.productUrl.includes('search?') &&
              !dmData.productUrl.includes('no-results') &&
              dmData.productUrl.includes('/product/'))
          ) {
            try {
              console.log(`Saving DM data to WooCommerce for ${product.name}...`);

              // Prepare meta data to save
              const metaData = [];

              if (dmData.price) {
                metaData.push({ key: '_dm_price', value: dmData.price.toString() });
              }

              // Only save actual product URLs
              if (
                dmData.productUrl &&
                !dmData.productUrl.includes('search?') &&
                !dmData.productUrl.includes('no-results') &&
                dmData.productUrl.includes('/product/')
              ) {
                metaData.push({ key: '_dm_url', value: dmData.productUrl });
              }

              // Always save last updated timestamp
              metaData.push({ key: '_dm_last_updated', value: new Date().toISOString() });

              // Update product with meta data
              const updateData = {
                meta_data: metaData,
              };

              await api.put(`products/${product.id}`, updateData);
              result.saved = true;
              saved++;
              console.log(`✓ Saved DM data for ${product.name}`);
            } catch (saveError) {
              console.error(`Failed to save DM data for ${product.name}:`, saveError);
              result.error = saveError instanceof Error ? saveError.message : 'Save failed';
              errors++;
            }
          }
        }

        results.push(result);
      }

      // Get final stats
      const stats = await batchProcessor.getResourceStats();

      return NextResponse.json({
        success: true,
        message: 'Optimized DM scraping completed',
        stats: {
          total: allProducts.length,
          processed: batchResults.length,
          skipped: allProducts.length - batchItems.length,
          successful: batchResults.filter(r => r.success).length,
          failed: batchResults.filter(r => !r.success).length,
          cached: batchResults.filter(r => r.cached).length,
          saved,
          saveErrors: errors,
        },
        resourceStats: stats,
        results,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('Error in products/compare POST:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process request',
        details: err.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
