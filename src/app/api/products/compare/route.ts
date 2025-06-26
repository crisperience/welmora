import { BatchItem, BatchProcessor } from '@/lib/scrapers/batch-processor';
import { createDMScraper } from '@/lib/scrapers/dm-scraper';
import { createMuellerScraper } from '@/lib/scrapers/mueller-scraper';
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

// Real DM scraping function using GTIN/EAN
async function scrapeDM(gtin: string): Promise<{ price?: number; productUrl?: string }> {
  try {
    console.log(`Scraping DM for GTIN: ${gtin}`);
    const scraper = createDMScraper();
    const result = await scraper.scrapeProduct(gtin);

    if (result.error) {
      console.error(`DM scraping error for ${gtin}:`, result.error);
      return { price: undefined };
    }

    console.log(`DM scraping result for ${gtin}:`, result);
    return {
      price: result.price,
      productUrl: result.productUrl,
    };
  } catch (error) {
    console.error(`DM scraping failed for ${gtin}:`, error);
    return { price: undefined };
  }
}

// Legacy function kept for backward compatibility if needed
// async function scrapeMueller(
//   gtin: string
// ): Promise<{ price?: number; productUrl?: string }> {
//   try {
//     console.log(`Scraping Mueller for GTIN: ${gtin}`);
//     const scraper = createMuellerScraperOptimized();
//     const result = await scraper.scrapeProduct(gtin);

//     if (result.error) {
//       console.error(`Mueller scraping error for ${gtin}:`, result.error);
//       return { price: undefined };
//     }

//     console.log(`Mueller scraping result for ${gtin}:`, result);
//     return {
//       price: result.price,
//       productUrl: result.productUrl,
//     };
//   } catch (error) {
//     console.error(`Mueller scraping failed for ${gtin}:`, error);
//     return { price: undefined };
//   }
// }

// Initialize WooCommerce API
const api = WooCommerce;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'title'; // Changed from 'name' to 'title'
    const order = searchParams.get('order') || 'asc';
    const minPrice = searchParams.get('min_price');
    const action = searchParams.get('action');

    console.log('WooCommerce Config:', {
      url: process.env.WOOCOMMERCE_URL,
      hasKey: !!process.env.WOOCOMMERCE_CONSUMER_KEY,
      hasSecret: !!process.env.WOOCOMMERCE_CONSUMER_SECRET,
    });

    // Build query parameters
    const params: Record<string, string | number> = {
      per_page: 100, // WooCommerce limit is 100 per request
      status: 'publish',
      orderby: sort,
      order: order,
    };

    // Try to search by SKU first if search looks like a GTIN/barcode
    let searchBySku = false;
    if (search) {
      // If search term is numeric and 8+ digits, try SKU search first
      if (/^\d{8,}$/.test(search)) {
        params.sku = search;
        searchBySku = true;
      } else {
        params.search = search;
      }
    }

    if (minPrice) {
      params.min_price = minPrice;
    }

    console.log('Fetching products with params:', params);

    // Fetch ALL products from WooCommerce with pagination
    let allProducts: WooCommerceProduct[] = [];
    let page = 1;
    let hasMorePages = true;

    try {
      while (hasMorePages) {
        const pageParams = { ...params, page };
        console.log(`Fetching page ${page}...`);

        const response = await api.get('products', pageParams);
        const pageProducts = response.data as WooCommerceProduct[];

        if (pageProducts.length === 0) {
          hasMorePages = false;
        } else {
          allProducts = [...allProducts, ...pageProducts];
          page++;

          // Stop if we got less than per_page (last page)
          if (pageProducts.length < (params.per_page as number)) {
            hasMorePages = false;
          }
        }
      }

      // If SKU search returned no results, try general search as fallback
      if (searchBySku && allProducts.length === 0 && search) {
        console.log('SKU search returned no results, trying general search...');
        delete params.sku;
        params.search = search;

        page = 1;
        hasMorePages = true;

        while (hasMorePages) {
          const pageParams = { ...params, page };
          console.log(`Fallback search - fetching page ${page}...`);

          const response = await api.get('products', pageParams);
          const pageProducts = response.data as WooCommerceProduct[];

          if (pageProducts.length === 0) {
            hasMorePages = false;
          } else {
            allProducts = [...allProducts, ...pageProducts];
            page++;

            // Stop if we got less than per_page (last page)
            if (pageProducts.length < (params.per_page as number)) {
              hasMorePages = false;
            }
          }
        }
      }

      console.log(
        `WooCommerce API call successful - fetched ${allProducts.length} products from ${page - 1} pages`
      );
    } catch (wooError: unknown) {
      const error = wooError as {
        message?: string;
        response?: { data?: unknown; status?: number; statusText?: string };
      };
      console.error('WooCommerce API Error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });

      return NextResponse.json(
        {
          success: false,
          error: `WooCommerce API Error: ${error.message || 'Unknown error'}`,
          details: error.response?.data || 'No additional details',
        },
        { status: 500 }
      );
    }

    const products = allProducts;
    console.log(`Total fetched: ${products.length} products from WooCommerce`);

    // Transform products to comparison format (reading meta fields)
    const comparisonProducts = products.map((product: WooCommerceProduct) => {
      const gtin = product.sku; // SKU is the GTIN/EAN

      // Extract DM data from meta fields
      const metaData = product.meta_data || [];
      const dmPrice = metaData.find(meta => meta.key === '_dm_price')?.value;
      const dmUrl = metaData.find(meta => meta.key === '_dm_url')?.value;
      const dmLastUpdated = metaData.find(meta => meta.key === '_dm_last_updated')?.value;

      // Extract Mueller data from meta fields
      const muellerPrice = metaData.find(meta => meta.key === '_mueller_price')?.value;
      const muellerUrl = metaData.find(meta => meta.key === '_mueller_url')?.value;
      const muellerLastUpdated = metaData.find(meta => meta.key === '_mueller_last_updated')?.value;

      return {
        sku: product.sku || '',
        gtin: gtin || '',
        name: product.name || '',
        welmoraPrice: parseFloat(product.price) || 0,
        welmoraStock: product.stock_status === 'instock' ? product.stock_quantity || 999 : 0,
        welmoraBackorders: product.backorders || 'no',
        dmPrice: dmPrice ? parseFloat(dmPrice) : undefined,
        dmStock: undefined, // Not storing stock data yet
        dmProductUrl: dmUrl || undefined,
        dmLastUpdated: dmLastUpdated || undefined,
        muellerPrice: muellerPrice ? parseFloat(muellerPrice) : undefined,
        muellerStock: undefined, // Not storing stock data yet
        muellerProductUrl: muellerUrl || undefined,
        muellerLastUpdated: muellerLastUpdated || undefined,
        needsUpdate: false, // Will be set when scraping is done
        image: product.images?.[0]?.src || undefined,
      };
    });

    if (action === 'clear_cache') {
      try {
        // Clear caches for both scrapers
        const dmScraper = createDMScraper();
        const muellerScraper = createMuellerScraper();

        if (typeof dmScraper.clearCache === 'function') {
          await dmScraper.clearCache();
        }
        if (typeof muellerScraper.clearCache === 'function') {
          await muellerScraper.clearCache();
        }

        console.log('Cache cleared for both DM and Mueller scrapers');

        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully for both scrapers',
        });
      } catch (error) {
        console.error('Error clearing cache:', error);
        return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
      }
    }

    if (action === 'scrape_all_dm') {
      console.log('Starting manual DM scraping for all products...');

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

      const results = [];
      let scraped = 0;
      let skipped = 0;
      let errors = 0;
      let saved = 0;

      // Process products one by one to avoid overwhelming the system
      for (const product of allProducts) {
        const gtin = product.sku;

        // Only scrape if we have a valid GTIN (13 digits)
        if (gtin && gtin.length === 13 && /^\d+$/.test(gtin)) {
          try {
            console.log(`Scraping ${scraped + 1}/${allProducts.length}: ${product.name} (${gtin})`);
            const dmData = await scrapeDM(gtin);

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
            } = {
              sku: product.sku,
              gtin,
              name: product.name,
              dmPrice: dmData.price,
              dmStock: undefined,
              dmProductUrl: dmData.productUrl,
              found: !!dmData.price,
              saved: false,
            };

            // If we found DM data, save it to WooCommerce metadata
            // Only save if we have valid data (price and/or real product URL)
            if (
              dmData.price ||
              (dmData.productUrl &&
                !dmData.productUrl.includes('search?') &&
                !dmData.productUrl.includes('no-results') &&
                dmData.productUrl.includes('/p/'))
            ) {
              try {
                console.log(`Saving DM data to WooCommerce for ${product.name}...`);

                // Prepare meta data to save
                const metaData = [];

                if (dmData.price) {
                  metaData.push({ key: '_dm_price', value: dmData.price.toString() });
                }

                // Only save actual product URLs, not search URLs or no-results pages
                if (
                  dmData.productUrl &&
                  !dmData.productUrl.includes('search?') &&
                  !dmData.productUrl.includes('no-results') &&
                  dmData.productUrl.includes('/p/')
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
              }
            }

            results.push(result);
            scraped++;

            // Add small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Failed to scrape ${gtin}:`, error);
            results.push({
              sku: product.sku,
              gtin,
              name: product.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              found: false,
              saved: false,
            });
            errors++;
          }
        } else {
          console.log(`Skipping ${product.name} - invalid GTIN: ${gtin}`);
          skipped++;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'DM scraping completed',
        stats: {
          total: allProducts.length,
          scraped,
          skipped,
          errors,
          found: results.filter(r => r.found).length,
          saved,
        },
        results,
      });
    }

    if (action === 'scrape_all_mueller') {
      console.log('Starting optimized Mueller scraping for all products...');

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
      const scraper = createMuellerScraper();
      const batchProcessor = new BatchProcessor({
        batchSize: 5, // Reduced to avoid browser pool overload
        concurrency: 1, // Reduced to 1 to avoid page conflicts
        delayBetweenBatches: 2000, // Increased to 2 seconds
        delayBetweenItems: 1000, // Increased to 1 second
        maxRetries: 2,
        onProgress: progress => {
          console.log(
            `Mueller Batch Progress: ${progress.completed}/${progress.total} (${Math.round((progress.completed / progress.total) * 100)}%) - Success: ${progress.successful}, Failed: ${progress.failed}, Cached: ${progress.cached}`
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
          muellerPrice?: number;
          muellerStock?: number;
          muellerProductUrl?: string;
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

        // Extract Mueller data from batch result
        if (batchResult.success && batchResult.data) {
          const muellerData = batchResult.data as { price?: number; productUrl?: string };
          result.muellerPrice = muellerData.price;
          result.muellerProductUrl = muellerData.productUrl;

          // Save to WooCommerce if we have valid data
          if (
            muellerData.price ||
            (muellerData.productUrl &&
              !muellerData.productUrl.includes('search?') &&
              !muellerData.productUrl.includes('no-results') &&
              muellerData.productUrl.includes('/p/'))
          ) {
            try {
              console.log(`Saving Mueller data to WooCommerce for ${product.name}...`);

              // Prepare meta data to save
              const metaData = [];

              if (muellerData.price) {
                metaData.push({ key: '_mueller_price', value: muellerData.price.toString() });
              }

              // Only save actual product URLs
              if (
                muellerData.productUrl &&
                !muellerData.productUrl.includes('search?') &&
                !muellerData.productUrl.includes('no-results') &&
                muellerData.productUrl.includes('/p/')
              ) {
                metaData.push({ key: '_mueller_url', value: muellerData.productUrl });
              }

              // Always save last updated timestamp
              metaData.push({ key: '_mueller_last_updated', value: new Date().toISOString() });

              // Update product with meta data
              const updateData = {
                meta_data: metaData,
              };

              await api.put(`products/${product.id}`, updateData);
              result.saved = true;
              saved++;
              console.log(`✓ Saved Mueller data for ${product.name}`);
            } catch (saveError) {
              console.error(`Failed to save Mueller data for ${product.name}:`, saveError);
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
        message: 'Optimized Mueller scraping completed',
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

    if (!action) {
      return NextResponse.json({ error: 'Missing action field' }, { status: 400 });
    }

    if (action === 'clear_cache') {
      try {
        // Clear caches for both scrapers
        const dmScraper = createDMScraper();
        const muellerScraper = createMuellerScraper();

        if (typeof dmScraper.clearCache === 'function') {
          await dmScraper.clearCache();
        }
        if (typeof muellerScraper.clearCache === 'function') {
          await muellerScraper.clearCache();
        }

        console.log('Cache cleared for both DM and Mueller scrapers');

        return NextResponse.json({
          success: true,
          message: 'Cache cleared successfully for both scrapers',
        });
      } catch (error) {
        console.error('Error clearing cache:', error);
        return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
      }
    }

    if (action === 'scrape_all_dm') {
      console.log('Starting manual DM scraping for all products...');

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

      const results = [];
      let scraped = 0;
      let skipped = 0;
      let errors = 0;
      let saved = 0;

      // Process products one by one to avoid overwhelming the system
      for (const product of allProducts) {
        const gtin = product.sku;

        // Only scrape if we have a valid GTIN (13 digits)
        if (gtin && gtin.length === 13 && /^\d+$/.test(gtin)) {
          try {
            console.log(`Scraping ${scraped + 1}/${allProducts.length}: ${product.name} (${gtin})`);
            const dmData = await scrapeDM(gtin);

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
            } = {
              sku: product.sku,
              gtin,
              name: product.name,
              dmPrice: dmData.price,
              dmStock: undefined,
              dmProductUrl: dmData.productUrl,
              found: !!dmData.price,
              saved: false,
            };

            // If we found DM data, save it to WooCommerce metadata
            // Only save if we have valid data (price and/or real product URL)
            if (
              dmData.price ||
              (dmData.productUrl &&
                !dmData.productUrl.includes('search?') &&
                !dmData.productUrl.includes('no-results') &&
                dmData.productUrl.includes('/p/'))
            ) {
              try {
                console.log(`Saving DM data to WooCommerce for ${product.name}...`);

                // Prepare meta data to save
                const metaData = [];

                if (dmData.price) {
                  metaData.push({ key: '_dm_price', value: dmData.price.toString() });
                }

                // Only save actual product URLs, not search URLs or no-results pages
                if (
                  dmData.productUrl &&
                  !dmData.productUrl.includes('search?') &&
                  !dmData.productUrl.includes('no-results') &&
                  dmData.productUrl.includes('/p/')
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
              }
            }

            results.push(result);
            scraped++;

            // Add small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Failed to scrape ${gtin}:`, error);
            results.push({
              sku: product.sku,
              gtin,
              name: product.name,
              error: error instanceof Error ? error.message : 'Unknown error',
              found: false,
              saved: false,
            });
            errors++;
          }
        } else {
          console.log(`Skipping ${product.name} - invalid GTIN: ${gtin}`);
          skipped++;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'DM scraping completed',
        stats: {
          total: allProducts.length,
          scraped,
          skipped,
          errors,
          found: results.filter(r => r.found).length,
          saved,
        },
        results,
      });
    }

    if (action === 'scrape_all_mueller') {
      console.log('Starting optimized Mueller scraping for all products...');

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
      const scraper = createMuellerScraper();
      const batchProcessor = new BatchProcessor({
        batchSize: 5, // Reduced to avoid browser pool overload
        concurrency: 1, // Reduced to 1 to avoid page conflicts
        delayBetweenBatches: 2000, // Increased to 2 seconds
        delayBetweenItems: 1000, // Increased to 1 second
        maxRetries: 2,
        onProgress: progress => {
          console.log(
            `Mueller Batch Progress: ${progress.completed}/${progress.total} (${Math.round((progress.completed / progress.total) * 100)}%) - Success: ${progress.successful}, Failed: ${progress.failed}, Cached: ${progress.cached}`
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
          muellerPrice?: number;
          muellerStock?: number;
          muellerProductUrl?: string;
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

        // Extract Mueller data from batch result
        if (batchResult.success && batchResult.data) {
          const muellerData = batchResult.data as { price?: number; productUrl?: string };
          result.muellerPrice = muellerData.price;
          result.muellerProductUrl = muellerData.productUrl;

          // Save to WooCommerce if we have valid data
          if (
            muellerData.price ||
            (muellerData.productUrl &&
              !muellerData.productUrl.includes('search?') &&
              !muellerData.productUrl.includes('no-results') &&
              muellerData.productUrl.includes('/p/'))
          ) {
            try {
              console.log(`Saving Mueller data to WooCommerce for ${product.name}...`);

              // Prepare meta data to save
              const metaData = [];

              if (muellerData.price) {
                metaData.push({ key: '_mueller_price', value: muellerData.price.toString() });
              }

              // Only save actual product URLs
              if (
                muellerData.productUrl &&
                !muellerData.productUrl.includes('search?') &&
                !muellerData.productUrl.includes('no-results') &&
                muellerData.productUrl.includes('/p/')
              ) {
                metaData.push({ key: '_mueller_url', value: muellerData.productUrl });
              }

              // Always save last updated timestamp
              metaData.push({ key: '_mueller_last_updated', value: new Date().toISOString() });

              // Update product with meta data
              const updateData = {
                meta_data: metaData,
              };

              await api.put(`products/${product.id}`, updateData);
              result.saved = true;
              saved++;
              console.log(`✓ Saved Mueller data for ${product.name}`);
            } catch (saveError) {
              console.error(`Failed to save Mueller data for ${product.name}:`, saveError);
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
        message: 'Optimized Mueller scraping completed',
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

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
