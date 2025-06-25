import puppeteer, { Browser, Page } from 'puppeteer';

interface DMScraperConfig {
  email: string;
  password: string;
}

interface DMProductData {
  price?: number;
  stock?: number;
  availability?: string;
  productUrl?: string;
  error?: string;
}

export class DMScraper {
  private config: DMScraperConfig;
  private browser: Browser | null = null;
  private page: Page | null = null;

  constructor(config: DMScraperConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log('Initializing DM scraper with Puppeteer...');

    // Launch local browser with anti-detection measures
    this.browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ],
    });

    this.page = await this.browser.newPage();

    // Advanced anti-detection measures
    await this.page.evaluateOnNewDocument(() => {
      // Remove webdriver property completely
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock chrome object
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).chrome = {
        runtime: {},
        loadTimes: function () { },
        csi: function () { },
        app: {},
      };

      // Mock plugins with realistic data
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: {
              type: 'application/x-google-chrome-pdf',
              suffixes: 'pdf',
              description: 'Portable Document Format',
              enabledPlugin: Plugin,
            },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin',
          },
        ],
      });

      // Mock languages realistically
      Object.defineProperty(navigator, 'languages', {
        get: () => ['de-DE', 'de', 'en-US', 'en'],
      });

      // Mock platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'MacIntel',
      });

      // Mock hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      // Mock device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });
    });

    // Set realistic user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set realistic viewport
    await this.page.setViewport({ width: 1366, height: 768 });

    // Set realistic headers
    await this.page.setExtraHTTPHeaders({
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      DNT: '1',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    });

    console.log('Puppeteer browser initialized successfully');
  }

  async searchProduct(gtin: string): Promise<DMProductData> {
    try {
      if (!this.page) {
        throw new Error('Scraper not initialized');
      }

      console.log(`Searching DM for GTIN: ${gtin}`);

      // Navigate to DM search page
      await this.page.goto(`https://www.dm.de/search?query=${gtin}`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      console.log('Search page loaded, extracting product data...');

      // Extract product data from search results
      return await this.extractProductData(gtin);
    } catch (error) {
      console.error(`Search failed for GTIN ${gtin}:`, error);
      return { error: error instanceof Error ? error.message : 'Search failed' };
    }
  }

  private async extractProductData(gtin: string): Promise<DMProductData> {
    try {
      if (!this.page) {
        throw new Error('Page not initialized');
      }

      let price: number | undefined;
      let stock: number | undefined;
      let availability: string | undefined;
      let productUrl: string | undefined;

      // Wait for search results to load
      await this.page.waitForSelector('body', { timeout: 10000 });
      console.log('Page loaded, looking for product cards...');

      // Look for product cards in search results
      const productCards = await this.page.$$('[data-dmid="product-card"]');
      console.log(`Found ${productCards.length} product cards with [data-dmid="product-card"]`);

      // If no cards found, try alternative selectors
      if (productCards.length === 0) {
        console.log('No product cards found with data-dmid, trying alternative selectors...');
        const altSelectors = [
          '.product-card',
          '[class*="product"]',
          '[class*="pdd_"]',
          'article',
          '.search-result-item',
        ];

        for (const selector of altSelectors) {
          const altCards = await this.page.$$(selector);
          console.log(`Found ${altCards.length} elements with selector: ${selector}`);
          if (altCards.length > 0) {
            productCards.push(...altCards);
            break;
          }
        }
      }

      if (productCards.length > 0) {
        console.log(`Found ${productCards.length} product cards`);
        const firstCard = productCards[0];

        // Extract product URL from first card
        try {
          console.log('Attempting to extract product URL from card...');

          // First, let's see the HTML structure of the card
          const cardHTML = await this.page.evaluate(el => el.outerHTML, firstCard);
          console.log('Card HTML structure:', cardHTML.substring(0, 1000) + '...');

          const linkSelectors = [
            'a[href*=".html"]', // This should catch the main product link
            'a.pdd_nxqq5ub', // Specific DM product link class
            'a[class*="pdd_nxqq5ub"]', // Alternative way to target the class
            'a[href*="/ariel-"]', // Specific to this product type
            'a[href*="-p' + gtin + '.html"]', // Very specific: contains -p{GTIN}.html
            'a[class*="pdd_"]', // DM uses pdd_ classes for product links
            'a[href*="/p"]',
            'a[href*="product"]',
            '.product-title a',
            '.product-link a',
            '[data-dmid="product-card"] a',
            'a[data-dmid="product-link"]',
          ];

          for (const selector of linkSelectors) {
            const linkElements = await firstCard.$$(selector);
            console.log(`Found ${linkElements.length} links with selector: ${selector}`);

            for (const linkElement of linkElements) {
              const href = await this.page.evaluate(el => el.getAttribute('href'), linkElement);
              const linkText = await this.page.evaluate(el => el.textContent?.trim(), linkElement);
              const className = await this.page.evaluate(el => el.className, linkElement);
              console.log(`Checking href: ${href} (text: "${linkText}", class: "${className}")`);

              // DM product URLs: /product-name-p{GTIN}.html
              if (href && (
                href.includes('.html') ||
                (href.startsWith('/') && href.includes('-p' + gtin)) ||
                href.includes('p' + gtin + '.html')
              )) {
                productUrl = href.startsWith('/') ? `https://www.dm.de${href}` : href;
                console.log(`✓ Found product URL in HTML: ${productUrl}`);
                break;
              }
            }

            if (productUrl) break;
          }

          // If still no URL found, try any link that contains the GTIN
          if (!productUrl) {
            console.log('Trying to find any link containing GTIN...');
            const allLinks = await firstCard.$$('a[href]');
            console.log(`Found ${allLinks.length} total links in card`);

            for (const link of allLinks) {
              const href = await this.page.evaluate(el => el.getAttribute('href'), link);
              const linkText = await this.page.evaluate(el => el.textContent?.trim(), link);
              console.log(`All links check - href: ${href} (text: "${linkText}")`);

              if (href && (href.includes(gtin) || href.includes('.html'))) {
                productUrl = href.startsWith('/') ? `https://www.dm.de${href}` : href;
                console.log(`✓ Found product URL by GTIN/HTML: ${productUrl}`);
                break;
              }
            }
          }

          if (!productUrl) {
            console.log('No product URL found in card, will try clicking...');
          }
        } catch (error) {
          console.log('Product URL extraction failed:', error);
        }

        // If we found a product URL in the HTML, navigate directly to it
        if (productUrl && productUrl.includes('.html')) {
          try {
            console.log(`Navigating directly to product URL: ${productUrl}`);
            await this.page.goto(productUrl, {
              waitUntil: 'networkidle2',
              timeout: 10000,
            });
            console.log(`✓ Successfully navigated to product page: ${this.page.url()}`);

            // Extract price from product page
            const priceElement = await this.page.$('[data-dmid="price-localized"]');
            if (priceElement) {
              const priceText = await this.page.evaluate(el => el.textContent, priceElement);
              if (priceText) {
                const priceMatch = priceText.match(/(\d+[,.]?\d*)/);
                if (priceMatch) {
                  price = parseFloat(priceMatch[1].replace(',', '.'));
                  console.log(`✓ Extracted price from product page: €${price}`);
                }
              }
            }

            // Extract stock from product page
            const stockSelectors = [
              '[data-dmid="availability"]',
              '.availability',
              '.stock-info',
              '.product-availability',
              '[data-dmid="overview-availability-container"]',
            ];

            for (const selector of stockSelectors) {
              const stockElement = await this.page.$(selector);
              if (stockElement) {
                const stockText = await this.page.evaluate(el => el.textContent, stockElement);
                if (stockText) {
                  console.log(`Stock text from ${selector}: ${stockText}`);
                  // Look for numbers in parentheses like (101)
                  const stockMatch = stockText.match(/\((\d+)\)/);
                  if (stockMatch) {
                    stock = parseInt(stockMatch[1]);
                    availability = `${stock} items available`;
                    console.log(`✓ Extracted stock from product page: ${stock}`);
                    break;
                  }

                  // Check for availability status
                  if (stockText.includes('Lieferbar') || stockText.includes('Verfügbar')) {
                    availability = 'Available';
                  } else if (stockText.includes('Nicht verfügbar') || stockText.includes('Ausverkauft')) {
                    availability = 'Out of stock';
                  } else {
                    availability = stockText.trim();
                  }
                }
              }
            }

          } catch (error) {
            console.log('Failed to navigate directly to product URL:', error);
          }
        } else {
          // Always try clicking to get the actual product page URL
          try {
            console.log('Clicking on product card to get actual product URL...');
            await firstCard.click();

            // Wait for product page to load with shorter timeout
            await this.page.waitForNavigation({
              waitUntil: 'networkidle2',
              timeout: 10000,
            });

            // Capture the product URL after navigation
            const currentUrl = this.page.url();
            if (currentUrl && currentUrl !== `https://www.dm.de/search?query=${gtin}` && !currentUrl.includes('search?query=')) {
              productUrl = currentUrl;
              console.log(`✓ Captured actual product URL after navigation: ${productUrl}`);
            } else {
              console.log(`Navigation didn't change URL or went to search page: ${currentUrl}`);
            }
          } catch (error) {
            console.log('Failed to navigate to product page:', error);
            // Continue with data we have from the card
          }
        }
      } else {
        // Try to extract directly from current page if it's already a product page
        const priceElement = await this.page.$('[data-dmid="price-localized"]');
        if (priceElement) {
          const priceText = await this.page.evaluate(el => el.textContent, priceElement);
          if (priceText) {
            const priceMatch = priceText.match(/(\d+[,.]?\d*)/);
            if (priceMatch) {
              price = parseFloat(priceMatch[1].replace(',', '.'));
            }
          }
        }
      }

      const result: DMProductData = {
        price,
        availability,
        productUrl: productUrl || this.page.url(),
        stock,
      };

      // Only log successful extractions briefly
      if (price) {
        const urlType = productUrl && !productUrl.includes('search?query=') ? 'product page' : 'search page';
        console.log(`✓ Found product: €${price}${stock ? ` (${stock} in stock)` : ''} - URL: ${urlType}`);
      } else {
        console.log('✗ Product not found on DM');
      }

      return result;
    } catch (error) {
      console.error('Data extraction error:', error);
      return {
        error: error instanceof Error ? error.message : 'Data extraction failed',
        productUrl: this.page?.url() || '',
      };
    }
  }

  async scrapeProduct(gtin: string): Promise<DMProductData> {
    try {
      console.log(`Starting DM scraper for GTIN: ${gtin} (no login required)`);

      await this.initialize();
      const result = await this.searchProduct(gtin);

      return result;
    } catch (error) {
      console.error('Scraper error:', error);
      return { error: error instanceof Error ? error.message : 'Scraping failed' };
    } finally {
      await this.cleanup();
    }
  }

  async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export function createDMScraper(): DMScraper {
  const email = process.env.DM_EMAIL;
  const password = process.env.DM_PASSWORD;

  if (!email || !password) {
    throw new Error('DM_EMAIL and DM_PASSWORD environment variables are required');
  }

  return new DMScraper({ email, password });
}
