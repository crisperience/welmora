import { createDMScraper } from '@/lib/scrapers/dm-scraper';
import WooCommerce from '@/lib/woocommerce/client';
import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { NextRequest, NextResponse } from 'next/server';

interface WooCommerceProduct {
  id: number;
  name: string;
  sku: string;
  price: string;
  stock_quantity: number | null;
  stock_status: string;
  images: Array<{ src: string }>;
  meta_data?: Array<{ key: string; value: string }>;
}

// Mock data for Mueller - in production, this would be replaced with actual scraping
const mockMuellerData: Record<string, { price: number; stock: number }> = {
  'MUELLER-001': { price: 13.5, stock: 12 },
  'MUELLER-002': { price: 8.99, stock: 5 },
  'MUELLER-003': { price: 25.5, stock: 3 },
};

// Real DM scraping function using GTIN/EAN
async function scrapeDM(
  gtin: string
): Promise<{ price?: number; stock?: number; productUrl?: string; availability?: string }> {
  try {
    console.log(`Scraping DM for GTIN: ${gtin}`);
    const scraper = createDMScraper();
    const result = await scraper.scrapeProduct(gtin);

    if (result.error) {
      console.error(`DM scraping error for ${gtin}:`, result.error);
      return { price: undefined, stock: undefined };
    }

    console.log(`DM scraping result for ${gtin}:`, result);
    return {
      price: result.price,
      stock: result.stock,
      productUrl: result.productUrl,
      availability: result.availability,
    };
  } catch (error) {
    console.error(`DM scraping failed for ${gtin}:`, error);
    return { price: undefined, stock: undefined };
  }
}

async function scrapeMueller(sku: string): Promise<{ price?: number; stock?: number }> {
  // Reduced delay for better performance
  await new Promise(resolve => setTimeout(resolve, 100));

  // Mock mapping - in reality, you'd need to map SKUs to Mueller product URLs
  const muellerSku = `MUELLER-${sku}`;
  return mockMuellerData[muellerSku] || { price: undefined, stock: undefined };
}

// Initialize WooCommerce API
const api = new WooCommerceRestApi({
  url: process.env.WOOCOMMERCE_URL || '',
  consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
  consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || '',
  version: 'wc/v3',
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const sort = searchParams.get('sort') || 'title'; // Changed from 'name' to 'title'
    const order = searchParams.get('order') || 'asc';
    const minPrice = searchParams.get('min_price');

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

      return {
        sku: product.sku || '',
        gtin: gtin || '',
        name: product.name || '',
        welmoraPrice: parseFloat(product.price) || 0,
        welmoraStock: product.stock_status === 'instock' ? product.stock_quantity || 999 : 0,
        dmPrice: dmPrice ? parseFloat(dmPrice) : undefined,
        dmStock: undefined, // Not storing stock data yet
        dmProductUrl: dmUrl || undefined,
        dmLastUpdated: dmLastUpdated || undefined,
        muellerPrice: undefined, // Will be populated by scraper later
        muellerStock: undefined, // Will be populated by scraper later
        needsUpdate: false, // Will be set when scraping is done
        image: product.images?.[0]?.src || undefined,
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
    const { sku, gtin, action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action field' }, { status: 400 });
    }

    if (action === 'scrape_dm') {
      if (!gtin) {
        return NextResponse.json({ error: 'GTIN is required for DM scraping' }, { status: 400 });
      }

      console.log(`Scraping DM for GTIN: ${gtin}`);
      const dmData = await scrapeDM(gtin);

      return NextResponse.json({
        success: true,
        gtin,
        data: {
          price: dmData.price,
          stock: dmData.stock,
          productUrl: dmData.productUrl,
          availability: dmData.stock
            ? `${dmData.stock} items available`
            : 'Check manually on product page',
        },
      });
    }

    if (action === 'scrape_and_save_dm') {
      if (!gtin) {
        return NextResponse.json({ error: 'GTIN is required for DM scraping' }, { status: 400 });
      }

      console.log(`Scraping and saving DM data for GTIN: ${gtin}`);

      try {
        // First find the product by SKU
        const productResponse = await api.get('products', { sku: gtin, per_page: 1 });
        const products = productResponse.data as WooCommerceProduct[];

        if (products.length === 0) {
          return NextResponse.json({ error: 'Product not found with this GTIN' }, { status: 404 });
        }

        const product = products[0];

        // Scrape DM data
        const dmData = await scrapeDM(gtin);

        if (!dmData.price && !dmData.productUrl) {
          return NextResponse.json(
            {
              success: false,
              error: 'No DM data found for this product',
            },
            { status: 404 }
          );
        }

        // Prepare meta data to save
        const metaData = [];

        if (dmData.price) {
          metaData.push({ key: '_dm_price', value: dmData.price.toString() });
        }

        // Only save actual product URLs, not search URLs
        if (dmData.productUrl && !dmData.productUrl.includes('search?query=')) {
          metaData.push({ key: '_dm_url', value: dmData.productUrl });
        }

        if (dmData.availability) {
          metaData.push({ key: '_dm_availability', value: dmData.availability });
        }

        // Always save last updated timestamp
        metaData.push({ key: '_dm_last_updated', value: new Date().toISOString() });

        // Update product with meta data
        const updateData = {
          meta_data: metaData,
        };

        console.log(`Updating product ${product.id} with DM meta data:`, metaData);
        await api.put(`products/${product.id}`, updateData);

        return NextResponse.json({
          success: true,
          message: 'DM data scraped and saved successfully',
          gtin,
          productId: product.id,
          productName: product.name,
          data: {
            price: dmData.price,
            productUrl: dmData.productUrl,
            lastUpdated: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Error in scrape_and_save_dm:', error);
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to scrape and save DM data',
            details: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        );
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
          page: page
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
              dmStock: dmData.stock,
              dmProductUrl: dmData.productUrl,
              found: !!dmData.price,
              saved: false,
            };

            // If we found DM data, save it to WooCommerce metadata
            if (dmData.price || (dmData.productUrl && !dmData.productUrl.includes('search?query='))) {
              try {
                console.log(`Saving DM data to WooCommerce for ${product.name}...`);

                // Prepare meta data to save
                const metaData = [];

                if (dmData.price) {
                  metaData.push({ key: '_dm_price', value: dmData.price.toString() });
                }

                // Only save actual product URLs, not search URLs
                if (dmData.productUrl && !dmData.productUrl.includes('search?query=')) {
                  metaData.push({ key: '_dm_url', value: dmData.productUrl });
                }

                if (dmData.availability) {
                  metaData.push({ key: '_dm_availability', value: dmData.availability });
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
            await new Promise(resolve => setTimeout(resolve, 1000));
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

    if (action === 'update_stock') {
      if (!sku) {
        return NextResponse.json({ error: 'SKU is required for stock update' }, { status: 400 });
      }

      // For stock update, we need GTIN to scrape DM
      // This assumes GTIN is stored in product meta or provided
      const gtin = body.gtin; // Should be provided or fetched from product

      if (!gtin) {
        return NextResponse.json({ error: 'GTIN is required for DM scraping' }, { status: 400 });
      }

      // Update product stock in WooCommerce based on external data
      const [dmData, muellerData] = await Promise.all([scrapeDM(gtin), scrapeMueller(sku)]);

      // Determine if stock should be updated
      const shouldUpdateStock =
        (dmData.stock !== undefined && dmData.stock === 0) ||
        (muellerData.stock !== undefined && muellerData.stock === 0);

      if (shouldUpdateStock) {
        // Update product stock to 0 if both DM and Mueller are out of stock
        const updateData = {
          stock_quantity: 0,
          stock_status: 'outofstock',
        };

        const response = await WooCommerce.put(`products?sku=${sku}`, updateData);

        return NextResponse.json({
          success: true,
          message: 'Product stock updated',
          data: response.data,
          dmData,
          muellerData,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'No stock update needed',
        dmData,
        muellerData,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
