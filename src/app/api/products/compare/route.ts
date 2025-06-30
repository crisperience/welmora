import { createDMScraper } from '@/lib/services/scrapers/dm-scraper';
import WooCommerce from '@/lib/api/woocommerce/client';
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
      hasKey: !!process.env.WOOCOMMERCE_CONSUMER_KEY,
      hasSecret: !!process.env.WOOCOMMERCE_CONSUMER_SECRET,
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
      queryParams.search = search;
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

    console.log(
      `WooCommerce API call successful - fetched ${allProducts.length} products from ${page - 1} pages`
    );
    console.log(`Total fetched: ${allProducts.length} products from WooCommerce`);

    // If search term is provided and WooCommerce search didn't find anything,
    // try to filter all products on backend side for exact SKU matches
    if (search && allProducts.length === 0) {
      console.log(`No results from WooCommerce search, trying backend filtering for: ${search}`);

      // Fetch all products without search filter
      let allProductsForFiltering: WooCommerceProduct[] = [];
      let filterPage = 1;
      let hasMoreFilterPages = true;

      while (hasMoreFilterPages) {
        console.log(`Fetching page ${filterPage} for backend filtering...`);
        const response = await api.get('products', {
          per_page: 100,
          status: 'publish',
          orderby: 'title',
          order: 'asc',
          page: filterPage,
        });
        const pageProducts = response.data as WooCommerceProduct[];

        if (pageProducts.length === 0) {
          hasMoreFilterPages = false;
        } else {
          allProductsForFiltering = [...allProductsForFiltering, ...pageProducts];
          filterPage++;

          if (pageProducts.length < 100) {
            hasMoreFilterPages = false;
          }
        }
      }

      // Filter products by name or SKU containing search term
      const searchLower = search.toLowerCase();
      console.log(`Searching for: "${searchLower}" in ${allProductsForFiltering.length} products`);

      // Debug: log first few products to see their structure
      console.log(
        'Sample products:',
        allProductsForFiltering.slice(0, 3).map(p => ({
          name: p.name,
          sku: p.sku,
          nameMatch: p.name.toLowerCase().includes(searchLower),
          skuMatch: p.sku.toLowerCase().includes(searchLower),
        }))
      );

      allProducts = allProductsForFiltering.filter(product => {
        const nameMatch = product.name.toLowerCase().includes(searchLower);
        const skuMatch = product.sku.toLowerCase().includes(searchLower);
        const matches = nameMatch || skuMatch;

        if (matches) {
          console.log(
            `✓ Match found: ${product.name} (${product.sku}) - nameMatch: ${nameMatch}, skuMatch: ${skuMatch}`
          );
        }

        return matches;
      });

      console.log(`Backend filtering found ${allProducts.length} products matching: ${search}`);
    }

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
        welmoraStock: product.stock_quantity ? parseInt(product.stock_quantity.toString()) : 0,
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

    if (action === 'update_dm_prices') {
      console.log('Starting DM price update for all products...');

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

      console.log(`Found ${allProducts.length} total products for DM price update`);

      // Extract GTINs from products (use SKU as GTIN)
      const gtins = allProducts.map(product => product.sku).filter(sku => sku && sku.length > 0);
      console.log(`Processing ${gtins.length} GTINs for DM scraping`);

      // Create DM scraper and scrape all products
      const dmScraper = createDMScraper();
      const dmResults = await dmScraper.scrapeProducts(gtins);

      console.log(`DM scraping completed. Processing ${Object.keys(dmResults).length} results`);

      let updated = 0;
      let skipped = 0;
      let errors = 0;

      // Update products with DM data
      for (const product of allProducts) {
        try {
          const gtin = product.sku;
          const dmData = dmResults[gtin];

          if (dmData && (dmData.price || dmData.productUrl)) {
            console.log(`Updating DM data for: ${product.name} (${gtin})`);

            const updateData = {
              meta_data: [
                { key: '_dm_price', value: dmData.price?.toString() || '' },
                { key: '_dm_url', value: dmData.productUrl || '' },
                { key: '_dm_last_updated', value: new Date().toISOString() },
              ],
            };

            await api.put(`products/${product.id}`, updateData);
            updated++;
            console.log(`✓ Updated DM data for ${product.name}: €${dmData.price}`);
          } else {
            skipped++;
            if (dmData?.error) {
              console.log(`⚠ Skipped ${product.name}: ${dmData.error}`);
            }
          }
        } catch (error) {
          console.error(`Failed to update DM data for ${product.name}:`, error);
          errors++;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'DM price update completed',
        stats: {
          total: allProducts.length,
          updated,
          skipped,
          errors,
        },
      });
    }

    if (action === 'clean_dm_data') {
      console.log('Starting to clean all DM data from WooCommerce...');

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

          // Check if product has any DM data (especially search URLs)
          const hasDMData = metaData.some(
            meta =>
              meta.key === '_dm_price' || meta.key === '_dm_url' || meta.key === '_dm_last_updated'
          );

          // Also check for search URLs specifically
          const dmUrl = metaData.find(meta => meta.key === '_dm_url')?.value;
          const hasSearchUrl = dmUrl && dmUrl.includes('search?query=');

          if (hasDMData || hasSearchUrl) {
            console.log(
              `Cleaning DM data for: ${product.name}${hasSearchUrl ? ' (had search URL)' : ''}`
            );

            // Remove DM meta data by setting them to empty
            const cleanMetaData = [
              { key: '_dm_price', value: '' },
              { key: '_dm_url', value: '' },
              { key: '_dm_last_updated', value: '' },
            ];

            const updateData = {
              meta_data: cleanMetaData,
            };

            await api.put(`products/${product.id}`, updateData);
            cleaned++;
            console.log(`✓ Cleaned DM data for ${product.name}`);
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`Failed to clean DM data for ${product.name}:`, error);
          errors++;
        }
      }

      return NextResponse.json({
        success: true,
        message: 'DM data cleaning completed',
        stats: {
          total: allProducts.length,
          cleaned,
          skipped,
          errors,
        },
      });
    }

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
          const hasMuellerData = metaData.some(
            meta =>
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

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
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
