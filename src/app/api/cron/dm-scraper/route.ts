import WooCommerce from '@/lib/api/woocommerce/client';
import { createDMScraper } from '@/lib/services/scrapers/dm-scraper';
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
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('🚀 DM Scraper Cron Job Started:', timestamp);
  console.log('📋 User Agent:', request.headers.get('user-agent'));

  // Verify this is a legitimate cron request
  const userAgent = request.headers.get('user-agent');
  if (!userAgent?.includes('vercel-cron')) {
    console.log('❌ Unauthorized: Not a Vercel cron request');
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized - Not a cron request',
        timestamp,
      },
      { status: 401 }
    );
  }

  try {
    const api = WooCommerce;

    console.log('🔧 WooCommerce Config Check:', {
      url: process.env.WOOCOMMERCE_URL,
      hasKey: !!process.env.WOOCOMMERCE_CONSUMER_KEY,
      hasSecret: !!process.env.WOOCOMMERCE_CONSUMER_SECRET,
    });

    // Step 1: Fetch all products
    console.log('📦 Step 1: Fetching all WooCommerce products...');
    let allProducts: WooCommerceProduct[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`📄 Fetching page ${page} of products...`);
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

        if (pageProducts.length < 100) {
          hasMorePages = false;
        }
      }
    }

    console.log(`✅ Found ${allProducts.length} total products`);

    // Step 2: Extract GTINs and prepare for scraping
    const gtins = allProducts.map(product => product.sku).filter(sku => sku && sku.length > 0);

    console.log(`🔍 Step 2: Processing ${gtins.length} GTINs for DM scraping`);
    console.log(`📊 Products without SKU: ${allProducts.length - gtins.length}`);

    // Step 3: Run DM scraper
    console.log('🕷️ Step 3: Starting DM scraper batch process...');
    const dmScraper = createDMScraper();
    const dmResults = await dmScraper.scrapeProducts(gtins);

    console.log(`✅ DM scraping completed. Got ${Object.keys(dmResults).length} results`);

    // Analyze scraping results
    let foundPrices = 0;
    let foundUrls = 0;
    let errors = 0;

    Object.values(dmResults).forEach(result => {
      if (result.price) foundPrices++;
      if (result.productUrl) foundUrls++;
      if (result.error) errors++;
    });

    console.log(`📈 Scraping Stats:`, {
      totalProcessed: Object.keys(dmResults).length,
      foundPrices,
      foundUrls,
      errors,
      successRate: `${((foundPrices / Object.keys(dmResults).length) * 100).toFixed(1)}%`,
    });

    // Step 4: Update WooCommerce products
    console.log('💾 Step 4: Updating WooCommerce products with DM data...');
    let updated = 0;
    let skipped = 0;
    let updateErrors = 0;

    for (const product of allProducts) {
      try {
        const gtin = product.sku;
        const dmData = dmResults[gtin];

        if (dmData && (dmData.price || dmData.productUrl)) {
          console.log(`🔄 Updating: ${product.name} (${gtin}) - €${dmData.price || 'N/A'}`);

          const updateData = {
            meta_data: [
              { key: '_dm_price', value: dmData.price?.toString() || '' },
              { key: '_dm_url', value: dmData.productUrl || '' },
              { key: '_dm_last_updated', value: timestamp },
            ],
          };

          await api.put(`products/${product.id}`, updateData);
          updated++;
        } else {
          skipped++;
          if (dmData?.error) {
            console.log(`⚠️ Skipped ${product.name}: ${dmData.error}`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to update ${product.name}:`, error);
        updateErrors++;
      }
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    // Final summary
    const summary = {
      success: true,
      timestamp,
      duration: `${duration}s`,
      stats: {
        totalProducts: allProducts.length,
        processedGtins: gtins.length,
        scrapingResults: {
          foundPrices,
          foundUrls,
          errors,
          successRate: `${((foundPrices / Object.keys(dmResults).length) * 100).toFixed(1)}%`,
        },
        wooCommerceUpdates: {
          updated,
          skipped,
          errors: updateErrors,
        },
      },
    };

    console.log('🎉 DM Scraper Cron Job Completed Successfully!');
    console.log('📊 Final Summary:', JSON.stringify(summary, null, 2));

    return NextResponse.json(summary);
  } catch (error) {
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.error('💥 DM Scraper Cron Job Failed:', error);

    const errorResponse = {
      success: false,
      timestamp,
      duration: `${duration}s`,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    };

    console.log('❌ Error Summary:', JSON.stringify(errorResponse, null, 2));

    return NextResponse.json(errorResponse, { status: 500 });
  }
}
