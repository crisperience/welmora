import puppeteer, { Browser, Page } from 'puppeteer';

export interface DMProductData {
  price?: number;
  productUrl?: string;
  error?: string;
}

export class DMScraper {
  private cache: Map<string, { data: DMProductData; timestamp: number }> = new Map();
  private readonly cacheTTL = 30 * 60 * 1000; // 30 minutes

  // Singleton browser instance
  private static browserInstance: Browser | null = null;
  private static browserPromise: Promise<Browser> | null = null;

  async scrapeProduct(gtin: string): Promise<DMProductData> {
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

        // Re-enable optimized page setup (blocks only images/media, keeps CSS)
        await this.setupPage(page);

        // Navigate to DM search page
        await page.goto(`https://www.dm.de/search?query=${gtin}`, {
          waitUntil: 'networkidle2',
          timeout: 30000,
        });

        console.log('Search page loaded, extracting product data...');

        // Extract product data
        const result = await this.extractProductData(page);

        // Cache successful results
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

  private async getBrowser(): Promise<Browser> {
    // Return existing browser if available
    if (DMScraper.browserInstance && DMScraper.browserInstance.connected) {
      return DMScraper.browserInstance;
    }

    // If browser is already being launched, wait for it
    if (DMScraper.browserPromise) {
      return DMScraper.browserPromise;
    }

    // Launch new browser
    DMScraper.browserPromise = puppeteer.launch({
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

    DMScraper.browserInstance = await DMScraper.browserPromise;
    DMScraper.browserPromise = null;

    console.log('✓ Browser instance created and ready for reuse');
    return DMScraper.browserInstance;
  }

  // Temporarily removed setupPage function to test without resource blocking

  private async setupPage(page: Page): Promise<void> {
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

  private async extractProductData(page: Page): Promise<DMProductData> {
    try {
      let price: number | undefined;
      let productUrl: string | undefined;

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
        const firstCard = productCards[0];

        // Try to extract product URL from the card
        const linkElement = await firstCard.$('a[href*=".html"]');
        if (linkElement) {
          const href = await page.evaluate(el => el.getAttribute('href'), linkElement);
          if (href) {
            productUrl = href.startsWith('/') ? `https://www.dm.de${href}` : href;
            console.log(`✓ Found product URL: ${productUrl}`);
          }
        }

        // Try to extract price directly from the card text
        const cardText = await page.evaluate(el => el.textContent || '', firstCard);
        console.log(`Card text: ${cardText.substring(0, 100)}`);

        // Look for price pattern in the card text (e.g., "3,55 €")
        const priceMatch = cardText.match(/(\d+[,.]?\d*)\s*€/);
        if (priceMatch) {
          price = parseFloat(priceMatch[1].replace(',', '.'));
          console.log(`✓ Extracted price from card: €${price}`);
        }

        // If we couldn't get price from card, try navigating to product page
        if (!price && productUrl) {
          try {
            console.log('Navigating to product page for price...');
            await page.goto(productUrl, {
              waitUntil: 'networkidle2',
              timeout: 10000,
            });

            // Try multiple price selectors on product page
            const priceSelectors = [
              '[data-dmid="price-localized"]',
              '.price',
              '[class*="price"]',
              '.product-price',
            ];

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

      const result: DMProductData = {
        price,
        productUrl: productUrl || page.url(),
      };

      if (price) {
        console.log(`✓ Found product: €${price}`);
      } else {
        console.log('✗ Product not found on DM');
      }

      return result;
    } catch (error) {
      console.error('Data extraction error:', error);
      return {
        error: error instanceof Error ? error.message : 'Data extraction failed',
        productUrl: page?.url() || '',
      };
    }
  }

  private getFromCache(gtin: string): DMProductData | null {
    const cached = this.cache.get(gtin);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(gtin); // Remove expired cache
    }
    return null;
  }

  private setCache(gtin: string, data: DMProductData): void {
    this.cache.set(gtin, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
    console.log('DM scraper cache cleared');
  }

  // Batch processing for multiple products
  async scrapeProducts(gtins: string[]): Promise<Record<string, DMProductData>> {
    console.log(`Starting batch DM scraper for ${gtins.length} products`);

    const results: Record<string, DMProductData> = {};
    const browser = await this.getBrowser();

    // Process products with controlled concurrency
    const concurrency = 3; // Max 3 parallel pages

    for (let i = 0; i < gtins.length; i += concurrency) {
      const batch = gtins.slice(i, i + concurrency);
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(gtins.length / concurrency)}`);

      const batchPromises = batch.map(async (gtin) => {
        // Check cache first
        const cached = this.getFromCache(gtin);
        if (cached) {
          console.log(`Cache hit for GTIN: ${gtin}`);
          return { gtin, result: cached };
        }

        const page = await browser.newPage();
        try {
          // Set realistic user agent
          await page.setUserAgent(
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          );

          await page.setViewport({ width: 1366, height: 768 });

          // Re-enable optimized page setup (blocks only images/media, keeps CSS)
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
            result: { error: error instanceof Error ? error.message : 'Scraping failed' }
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

  // Cleanup method for graceful shutdown
  static async cleanup(): Promise<void> {
    if (DMScraper.browserInstance) {
      await DMScraper.browserInstance.close();
      DMScraper.browserInstance = null;
      console.log('✓ Browser instance closed');
    }
  }
}

export function createDMScraper(): DMScraper {
  return new DMScraper();
}
