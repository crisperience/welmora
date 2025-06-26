import puppeteer, { ElementHandle, Page } from 'puppeteer-core';

export interface MetroBrightDataProductData {
  price?: number;
  productUrl?: string;
  productName?: string;
  available?: boolean;
  error?: string;
}

export interface BrightDataConfig {
  customerId: string;
  zoneName: string;
  password: string;
}

export class MetroBrightDataScraper {
  private brightDataConfig: BrightDataConfig;

  constructor(config: BrightDataConfig) {
    this.brightDataConfig = config;
  }

  private getBrightDataEndpoint(): string {
    const { customerId, zoneName, password } = this.brightDataConfig;
    return `wss://brd-customer-${customerId}-zone-${zoneName}:${password}@brd.superproxy.io:9222`;
  }

  public async scrapeProduct(gtin: string): Promise<MetroBrightDataProductData> {
    console.log(`Metro Bright Data Scraper: Starting search for GTIN: ${gtin}`);

    let browser;
    try {
      // Connect to Bright Data Scraping Browser
      console.log('Metro Bright Data Scraper: Connecting to Bright Data browser...');
      const endpoint = this.getBrightDataEndpoint();

      browser = await puppeteer.connect({
        browserWSEndpoint: endpoint,
      });

      const page = await browser.newPage();

      console.log('Metro Bright Data Scraper: Connected! Navigating to Metro search...');

      // Navigate directly to Metro search page
      const searchUrl = `https://produkte.metro.de/shop/search?q=${gtin}`;
      await page.goto(searchUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      console.log('Metro Bright Data Scraper: Page loaded, extracting data...');

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Debug: Check page content
      const pageTitle = await page.title();
      const currentUrl = page.url();
      console.log(`Metro Bright Data Scraper: Page title: "${pageTitle}"`);
      console.log(`Metro Bright Data Scraper: Current URL: ${currentUrl}`);

      // Check if page has content
      const bodyText = await page.evaluate(() => document.body?.innerText || '');
      console.log(`Metro Bright Data Scraper: Body text length: ${bodyText.length}`);

      if (bodyText.length > 0) {
        console.log(`Metro Bright Data Scraper: Body preview: ${bodyText.substring(0, 200)}...`);
      }

      // Look for search results
      const searchResults = await this.extractSearchResults(page);

      await page.close();

      return searchResults;
    } catch (error) {
      console.error('Metro Bright Data Scraper: Error:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private async extractSearchResults(page: Page): Promise<MetroBrightDataProductData> {
    try {
      // Check for no results first
      const noResultsSelectors = [
        '.no-results',
        '.search-no-results',
        '[data-testid="no-results"]',
        '.empty-state',
        '.no-search-results',
      ];

      for (const selector of noResultsSelectors) {
        const noResultsElement = await page.$(selector);
        if (noResultsElement) {
          console.log(`Metro Bright Data Scraper: No results found with selector: ${selector}`);
          return { error: 'No products found for this GTIN on Metro' };
        }
      }

      // Look for product links in Metro's structure
      const linkSelectors = [
        'a.title[href*="/shop/pv/"]', // Metro specific structure
        '.sd-articlecard a.title', // Article card title link
        '.sd-articlecard a.image', // Article card image link
        'a[href*="/shop/pv/"]', // Any link with Metro product path
        '.well a[href*="/shop/pv/"]', // Links within well containers
      ];

      let productLinks: ElementHandle[] = [];
      for (const selector of linkSelectors) {
        productLinks = await page.$$(selector);
        console.log(
          `Metro Bright Data Scraper: Found ${productLinks.length} product links with selector: ${selector}`
        );
        if (productLinks.length > 0) break;
      }

      if (productLinks.length === 0) {
        console.log('Metro Bright Data Scraper: No product links found');

        // Debug: Check for any Metro-specific elements
        const metroElements = await page.evaluate(() => {
          const elements = [];

          // Look for any div/span with Metro-specific classes
          const metroClasses = document.querySelectorAll(
            '[class*="metro"], [class*="sd-"], [class*="article"], [class*="product"]'
          );
          elements.push(`Metro-specific classes: ${metroClasses.length}`);

          // Look for price elements
          const priceElements = document.querySelectorAll('[class*="price"], [class*="Price"]');
          elements.push(`Price elements: ${priceElements.length}`);

          // Look for any links
          const links = document.querySelectorAll('a[href*="/shop/"]');
          elements.push(`Shop links: ${links.length}`);

          return elements;
        });

        metroElements.forEach((info: string) => console.log(`Metro Bright Data Scraper: ${info}`));

        return { error: 'No products found for this GTIN on Metro' };
      }

      // Get the first product link
      const firstProductLink = productLinks[0];

      // Extract product URL
      const href = await page.evaluate((el: Element) => el.getAttribute('href'), firstProductLink);
      let productUrl: string | undefined;
      if (href) {
        productUrl = href.startsWith('/') ? `https://produkte.metro.de${href}` : href;
        console.log(`Metro Bright Data Scraper: Found product URL: ${productUrl}`);
      }

      // Extract product name
      let productName: string | undefined;
      try {
        productName = await page.evaluate((el: Element) => {
          // Check if this is a title link with h4 inside
          const h4 = el.querySelector('h4');
          if (h4) return h4.textContent?.trim();

          // Check if this is an image link with description attribute
          const description = el.getAttribute('description');
          if (description) return description;

          // Fallback to text content
          return el.textContent?.trim();
        }, firstProductLink);

        if (productName) {
          console.log(`Metro Bright Data Scraper: Product name: "${productName}"`);
        }
      } catch (error) {
        console.log('Metro Bright Data Scraper: Error extracting product name:', error);
      }

      // Look for price in the search results
      let price: number | undefined;
      const priceSelectors = [
        '.price-display-main-row .primary span span', // Metro specific structure
        '.price-display .primary span span', // Alternative Metro structure
        '.price-display-main-row .primary', // Fallback without nested spans
        '.sd-articlecard .price-display-main-row span', // Article card price
        '[class*="price-display"] [class*="primary"]', // Generic price display
        '.price', // Generic price class
      ];

      for (const selector of priceSelectors) {
        try {
          const priceElement = await page.$(selector);
          if (priceElement) {
            const priceText = await page.evaluate(
              (el: Element) => el.textContent?.trim(),
              priceElement
            );
            console.log(
              `Metro Bright Data Scraper: Found price text with selector "${selector}": "${priceText}"`
            );

            if (priceText) {
              price = this.parsePrice(priceText);
              if (price) {
                console.log(`Metro Bright Data Scraper: Extracted price: €${price}`);
                break;
              }
            }
          }
        } catch (error) {
          console.log(`Metro Bright Data Scraper: Error with price selector "${selector}":`, error);
        }
      }

      // Return results
      const result: MetroBrightDataProductData = {
        productUrl,
        productName,
        price,
        available: !!productUrl,
      };

      console.log('Metro Bright Data Scraper: Final result:', result);
      return result;
    } catch (error) {
      console.error('Metro Bright Data Scraper: Error extracting search results:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error during extraction' };
    }
  }

  private parsePrice(priceText: string): number | undefined {
    try {
      // Remove currency symbols and non-numeric characters except decimal separators
      const cleanPrice = priceText
        .replace(/[€$£¥₹]/g, '') // Remove currency symbols
        .replace(/[^\d,.-]/g, '') // Keep only digits, commas, dots, and hyphens
        .replace(/,/g, '.') // Convert comma decimal separator to dot
        .trim();

      const price = parseFloat(cleanPrice);
      return isNaN(price) ? undefined : price;
    } catch (error) {
      console.log(`Metro Bright Data Scraper: Error parsing price "${priceText}":`, error);
      return undefined;
    }
  }

  public async getStats() {
    return {
      service: 'Bright Data Scraping Browser',
      status: 'Active',
    };
  }
}

// Factory function for creating Metro Bright Data scraper instances
export function createMetroBrightDataScraper(
  config?: Partial<BrightDataConfig>
): MetroBrightDataScraper {
  // Using the actual Bright Data credentials provided by the user
  const customerId = config?.customerId || 'hl_24448dfb';
  const zoneName = config?.zoneName || 'welmora';
  const password = config?.password || 'u76vogflsoq3';

  return new MetroBrightDataScraper({
    customerId,
    zoneName,
    password,
  });
}
