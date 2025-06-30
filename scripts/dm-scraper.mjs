#!/usr/bin/env node

/**
 * DM Scraper Script for GitHub Actions
 *
 * This script runs the DM scraper independently of Next.js
 * and is designed to be executed in GitHub Actions environment.
 */

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Setup logging
const logFile = path.join(logsDir, `dm-scraper-${new Date().toISOString().split('T')[0]}.log`);
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function logWithTimestamp(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${level}: ${args.join(' ')}`;

  // Write to console
  if (level === 'ERROR') {
    originalConsoleError(message);
  } else {
    originalConsoleLog(message);
  }

  // Write to file
  fs.appendFileSync(logFile, message + '\n');
}

console.log = (...args) => logWithTimestamp('INFO', ...args);
console.error = (...args) => logWithTimestamp('ERROR', ...args);

async function main() {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('🚀 DM Scraper GitHub Actions Job Started:', timestamp);
  console.log('📋 Environment:', {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    hasWooCommerceUrl: !!process.env.WOOCOMMERCE_URL,
    hasWooCommerceKey: !!process.env.WOOCOMMERCE_CONSUMER_KEY,
    hasWooCommerceSecret: !!process.env.WOOCOMMERCE_CONSUMER_SECRET,
  });

  try {
    // Import standalone JavaScript scraper
    const { createDMScraper } = await import('./dm-scraper-standalone.mjs');
    const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;

    // Initialize WooCommerce client
    const WooCommerce = new WooCommerceRestApi({
      url: process.env.WOOCOMMERCE_URL || 'https://welmora.ch',
      consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || '',
      consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || '',
      version: 'wc/v3',
    });

    console.log('🔧 WooCommerce Config Check:', {
      url: process.env.WOOCOMMERCE_URL,
      hasKey: !!process.env.WOOCOMMERCE_CONSUMER_KEY,
      hasSecret: !!process.env.WOOCOMMERCE_CONSUMER_SECRET,
    });

    // Step 1: Fetch all products
    console.log('📦 Step 1: Fetching all WooCommerce products...');
    let allProducts = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      console.log(`📄 Fetching page ${page} of products...`);
      const response = await WooCommerce.get('products', {
        per_page: 100,
        status: 'publish',
        page: page,
      });
      const pageProducts = response.data;

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

          await WooCommerce.put(`products/${product.id}`, updateData);
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

    console.log('🎉 DM Scraper GitHub Actions Job Completed Successfully!');
    console.log('📊 Final Summary:', JSON.stringify(summary, null, 2));

    // Write summary to file
    const summaryFile = path.join(
      logsDir,
      `dm-scraper-summary-${new Date().toISOString().split('T')[0]}.json`
    );
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));

    // Cleanup browser instances
    if (typeof dmScraper.cleanup === 'function') {
      await dmScraper.cleanup();
    }

    console.log('🧹 Cleanup completed');
    process.exit(0);
  } catch (error) {
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.error('💥 DM Scraper GitHub Actions Job Failed:', error);

    const errorResponse = {
      success: false,
      timestamp,
      duration: `${duration}s`,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    };

    console.log('❌ Error Summary:', JSON.stringify(errorResponse, null, 2));

    // Write error to file
    const errorFile = path.join(
      logsDir,
      `dm-scraper-error-${new Date().toISOString().split('T')[0]}.json`
    );
    fs.writeFileSync(errorFile, JSON.stringify(errorResponse, null, 2));

    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.error('Main function failed:', error);
  process.exit(1);
});
