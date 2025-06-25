import { Page } from 'puppeteer';
import { BaseScraper } from './base-scraper';

interface DMScraperConfig {
  email: string;
  password: string;
}

export interface DMProductData {
  price?: number;
  productUrl?: string;
  error?: string;
}

export class DMScraper extends BaseScraper<DMProductData> {
  private dmConfig: DMScraperConfig;

  constructor(config: DMScraperConfig) {
    super({
      poolKey: 'dm-scraper',
      cacheEnabled: true,
      cacheTTL: 30 * 60 * 1000, // 30 minutes
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
    });
    this.dmConfig = config;
  }

  protected async performScraping(page: Page, gtin: string): Promise<DMProductData> {
    console.log(`Searching DM for GTIN: ${gtin}`);

    // Setup page optimizations
    await this.setupPage(page);

    // Set realistic user agent and headers
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.setViewport({ width: 1366, height: 768 });

    await page.setExtraHTTPHeaders({
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

    // Navigate to DM search page
    await page.goto(`https://www.dm.de/search?query=${gtin}`, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log('Search page loaded, extracting product data...');

    // Extract product data from search results
    return await this.extractProductData(page, gtin);
  }

  private async extractProductData(page: Page, gtin: string): Promise<DMProductData> {
    try {
      let price: number | undefined;
      let productUrl: string | undefined;

      // Wait for search results to load
      await page.waitForSelector('body', { timeout: 10000 });
      console.log('Page loaded, looking for product cards...');

      // Look for product cards in search results
      const productCards = await page.$$('[data-dmid="product-card"]');
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
          const altCards = await page.$$(selector);
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
              const href = await page.evaluate(el => el.getAttribute('href'), linkElement);
              const linkText = await page.evaluate(el => el.textContent?.trim(), linkElement);
              const className = await page.evaluate(el => el.className, linkElement);
              console.log(`Checking href: ${href} (text: "${linkText}", class: "${className}")`);

              // DM product URLs: /product-name-p{GTIN}.html
              if (
                href &&
                (href.includes('.html') ||
                  (href.startsWith('/') && href.includes('-p' + gtin)) ||
                  href.includes('p' + gtin + '.html'))
              ) {
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
              const href = await page.evaluate(el => el.getAttribute('href'), link);
              const linkText = await page.evaluate(el => el.textContent?.trim(), link);
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
            await page.goto(productUrl, {
              waitUntil: 'networkidle2',
              timeout: 10000,
            });
            console.log(`✓ Successfully navigated to product page: ${page.url()}`);

            // Extract price from product page
            const priceElement = await page.$('[data-dmid="price-localized"]');
            if (priceElement) {
              const priceText = await page.evaluate(el => el.textContent, priceElement);
              if (priceText) {
                const priceMatch = priceText.match(/(\d+[,.]?\d*)/);
                if (priceMatch) {
                  price = parseFloat(priceMatch[1].replace(',', '.'));
                  console.log(`✓ Extracted price from product page: €${price}`);
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
            await page.waitForNavigation({
              waitUntil: 'networkidle2',
              timeout: 10000,
            });

            // Capture the product URL after navigation
            const currentUrl = page.url();
            if (
              currentUrl &&
              currentUrl !== `https://www.dm.de/search?query=${gtin}` &&
              !currentUrl.includes('search?query=')
            ) {
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
        const priceElement = await page.$('[data-dmid="price-localized"]');
        if (priceElement) {
          const priceText = await page.evaluate(el => el.textContent, priceElement);
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
        productUrl: productUrl || page.url(),
      };

      // Only log successful extractions briefly
      if (price) {
        const urlType =
          productUrl && !productUrl.includes('search?query=') ? 'product page' : 'search page';
        console.log(`✓ Found product: €${price} - URL: ${urlType}`);
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

  async scrapeProduct(gtin: string): Promise<DMProductData> {
    try {
      console.log(`Starting DM scraper for GTIN: ${gtin} (no login required)`);
      const result = await this.scrape(gtin);

      if (result.error) {
        return { error: result.error };
      }

      return result.data || { error: 'No data returned' };
    } catch (error) {
      console.error('Scraper error:', error);
      return { error: error instanceof Error ? error.message : 'Scraping failed' };
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
