#!/usr/bin/env node

/**
 * Standalone DM Scraper for GitHub Actions
 *
 * This is a JavaScript version of the DM scraper that can run independently
 * without requiring TypeScript compilation.
 */

import puppeteer from 'puppeteer';

class DMScraper {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes
    this.browserInstance = null;
    this.browserPromise = null;
  }

  async scrapeProduct(gtin) {
    try {
      console.log(`Starting DM scraper for GTIN: ${gtin} (guest mode)`);

      // Check cache first
      const cached = this.getFromCache(gtin);
      if (cached) {
        console.log(`Cache hit for GTIN: ${gtin}`);
        return cached;
      }

      // Get shared browser instance
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      try {
        // Set realistic user agent
        await page.setUserAgent(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        await page.setViewport({ width: 1366, height: 768 });

        // Setup page optimizations
        await this.setupPage(page);

        // Navigate to DM search page
        await page.goto(`https://www.dm.de/search?query=${gtin}`, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });

        console.log('Search page loaded, extracting product data...');

        // Extract product data
        const result = await this.extractProductData(page);

        // Cache successful results (only if we found actual product data)
        if (result.price || result.productUrl) {
          this.setCache(gtin, result);
        }

        return result;
      } finally {
        // Close page but keep browser alive
        await page.close();
      }
    } catch (error) {
      console.error('DM scraper error:', error);
      return { error: error instanceof Error ? error.message : 'Scraping failed' };
    }
  }

  async getBrowser() {
    // Return existing browser if available
    if (this.browserInstance && this.browserInstance.connected) {
      return this.browserInstance;
    }

    // If browser is already being launched, wait for it
    if (this.browserPromise) {
      return this.browserPromise;
    }

    // Launch new browser
    this.browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });

    this.browserInstance = await this.browserPromise;
    this.browserPromise = null;

    console.log('✓ Browser instance created and ready for reuse');
    return this.browserInstance;
  }

  async setupPage(page) {
    // Block only heavy resources, keep CSS for proper DOM rendering
    await page.setRequestInterception(true);
    page.on('request', req => {
      const resourceType = req.resourceType();
      // Only block images and media, keep CSS and fonts for proper rendering
      if (['image', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  async extractProductData(page) {
    try {
      let price;
      let productUrl;

      // Wait for search results to load
      await page.waitForSelector('body', { timeout: 10000 });
      console.log('Page loaded, looking for product cards...');

      // Look for product cards in search results - try multiple selectors
      let productCards = await page.$$('[data-dmid="product-card"]');
      console.log(`Found ${productCards.length} product cards with [data-dmid="product-card"]`);

      // If no cards found, try alternative selectors
      if (productCards.length === 0) {
        productCards = await page.$$('[data-dmid="product-tile"]');
        console.log(`Found ${productCards.length} product tiles with [data-dmid="product-tile"]`);
      }

      // If still no cards, try class-based selectors
      if (productCards.length === 0) {
        productCards = await page.$$('[class*="product"]');
        console.log(`Found ${productCards.length} elements with class containing "product"`);
      }

      // If still no cards, try pdd_ class elements with links
      if (productCards.length === 0) {
        // Try to find elements with data-dmid="product-tile" directly
        const productTiles = await page.$$('[data-dmid="product-tile"]');
        console.log(`Found ${productTiles.length} elements with data-dmid="product-tile"`);

        if (productTiles.length > 0) {
          productCards = productTiles;
        } else {
          // Fallback to pdd elements
          const pddElements = await page.$$('[class*="pdd_"]');
          console.log(`Found ${pddElements.length} pdd elements`);

          // Filter to only those that contain product links
          const productElements = [];
          for (const element of pddElements) {
            const hasProductLink = await element.$('a[href*=".html"]');
            if (hasProductLink) {
              productElements.push(element);
            }
          }
          productCards = productElements;
          console.log(`Found ${productCards.length} pdd elements with product links`);
        }
      }

      if (productCards.length > 0) {
        // Get the current URL to extract the searched GTIN
        const currentUrl = page.url();
        const gtinMatch = currentUrl.match(/query=(\d+)/);
        const searchedGtin = gtinMatch ? gtinMatch[1] : null;

        let validProduct = null;

        // Check each product card for GTIN match
        for (const card of productCards) {
          const linkElement = await card.$('a[href*=".html"]');
          if (linkElement) {
            const href = await page.evaluate(el => el.getAttribute('href'), linkElement);
            if (href) {
              const fullUrl = href.startsWith('/') ? `https://www.dm.de${href}` : href;

              // GTIN validation: check if URL contains the searched GTIN
              if (searchedGtin && fullUrl.includes(searchedGtin)) {
                console.log(`✓ Found GTIN match in URL: ${fullUrl}`);
                validProduct = { card, url: fullUrl };
                break;
              } else if (searchedGtin) {
                console.log(
                  `⚠ Skipping product - GTIN ${searchedGtin} not found in URL: ${fullUrl}`
                );
              }
            }
          }
        }

        // If no GTIN match found, fall back to first result (with warning)
        if (!validProduct && productCards.length > 0) {
          console.log(`⚠ No GTIN match found, returning empty result to avoid false matches`);
          return { error: 'No matching product found' };
        }

        if (validProduct) {
          productUrl = validProduct.url;

          // Try to extract price from the search results page first
          const priceSelectors = [
            '[data-dmid="price-localized"]',
            '.price',
            '[class*="price"]',
            '.product-price',
            '[class*="Price"]',
          ];

          for (const selector of priceSelectors) {
            const priceElement = await validProduct.card.$(selector);
            if (priceElement) {
              const priceText = await page.evaluate(el => el.textContent, priceElement);
              if (priceText) {
                const priceMatch = priceText.match(/(\d+[,.]?\d*)/);
                if (priceMatch) {
                  price = parseFloat(priceMatch[1].replace(',', '.'));
                  console.log(`✓ Extracted price from search results (${selector}): €${price}`);
                  break;
                }
              }
            }
          }

          // If no price found in search results, try to navigate to product page
          if (!price && productUrl) {
            try {
              console.log('Navigating to product page for price...');
              await page.goto(productUrl, {
                waitUntil: 'networkidle2',
                timeout: 10000,
              });

              // Try multiple price selectors on product page
              for (const selector of priceSelectors) {
                const priceElement = await page.$(selector);
                if (priceElement) {
                  const priceText = await page.evaluate(el => el.textContent, priceElement);
                  if (priceText) {
                    const productPagePriceMatch = priceText.match(/(\d+[,.]?\d*)/);
                    if (productPagePriceMatch) {
                      price = parseFloat(productPagePriceMatch[1].replace(',', '.'));
                      console.log(`✓ Extracted price from product page (${selector}): €${price}`);
                      break;
                    }
                  }
                }
              }
            } catch (error) {
              console.log('Failed to navigate to product page:', error);
            }
          }
        }
      }

      const result = {
        price,
        productUrl: productUrl, // Only return URL if we actually found a product
      };

      if (price || productUrl) {
        console.log(`✓ Found product: €${price || 'N/A'} at ${productUrl || 'N/A'}`);
      } else {
        console.log('✗ Product not found on DM');
      }

      return result;
    } catch (error) {
      console.error('Data extraction error:', error);
      return {
        error: error instanceof Error ? error.message : 'Data extraction failed',
      };
    }
  }

  getFromCache(gtin) {
    const cached = this.cache.get(gtin);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(gtin); // Remove expired cache
    }
    return null;
  }

  setCache(gtin, data) {
    this.cache.set(gtin, { data, timestamp: Date.now() });
  }

  clearCache() {
    this.cache.clear();
  }

  async scrapeProducts(gtins) {
    console.log(`🕷️ Starting batch scraping of ${gtins.length} GTINs...`);
    const results = {};

    // Process in batches to avoid overwhelming the server
    const concurrency = 3; // Process 3 at a time

    for (let i = 0; i < gtins.length; i += concurrency) {
      const batch = gtins.slice(i, i + concurrency);
      console.log(
        `📦 Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(gtins.length / concurrency)}: ${batch.join(', ')}`
      );

      const batchPromises = batch.map(async gtin => {
        const browser = await this.getBrowser();
        const page = await browser.newPage();

        try {
          // Set realistic user agent
          await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          );

          await page.setViewport({ width: 1366, height: 768 });

          // Setup page optimizations
          await this.setupPage(page);

          await page.goto(`https://www.dm.de/search?query=${gtin}`, {
            waitUntil: 'networkidle2',
            timeout: 30000,
          });

          const result = await this.extractProductData(page);

          // Cache successful results
          if (result.price || result.productUrl) {
            this.setCache(gtin, result);
          }

          return { gtin, result };
        } catch (error) {
          console.error(`Error scraping ${gtin}:`, error);
          return {
            gtin,
            result: { error: error instanceof Error ? error.message : 'Scraping failed' },
          };
        } finally {
          await page.close();
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Add results to final object
      batchResults.forEach(({ gtin, result }) => {
        results[gtin] = result;
      });

      // Small delay between batches to be respectful
      if (i + concurrency < gtins.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`✓ Batch scraping completed: ${Object.keys(results).length} products processed`);
    return results;
  }

  async cleanup() {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }
}

export function createDMScraper() {
  return new DMScraper();
}

export { DMScraper };

// Test functionality when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🧪 Testing DM Scraper standalone...');

  const scraper = createDMScraper();
  const testGtin = '4005808730735'; // Test GTIN

  console.log(`Testing with GTIN: ${testGtin}`);

  scraper
    .scrapeProduct(testGtin)
    .then(result => {
      console.log('✅ Test result:', result);
      return scraper.cleanup();
    })
    .then(() => {
      console.log('🧹 Cleanup completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}
