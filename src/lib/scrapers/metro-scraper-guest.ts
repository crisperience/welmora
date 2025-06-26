import { Page } from 'puppeteer';
import { BaseScraper } from './base-scraper';

export interface MetroGuestProductData {
  productUrl?: string;
  productName?: string;
  available?: boolean;
  error?: string;
}

export class MetroGuestScraper extends BaseScraper<MetroGuestProductData> {
  constructor() {
    super({
      poolKey: 'metro-guest-scraper',
      cacheEnabled: true,
      cacheTTL: 30 * 60 * 1000, // 30 minutes
      maxRetries: 2,
      retryDelay: 2000,
      timeout: 30000, // 30 seconds
    });
  }

  protected async performScraping(page: Page, gtin: string): Promise<MetroGuestProductData> {
    console.log(`Metro Guest Scraper: Starting search for GTIN: ${gtin}`);

    // Setup page optimizations
    await this.setupPage(page);

    // Set realistic user agent and headers
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0'
    );

    await page.setViewport({ width: 1366, height: 768 });

    await page.setExtraHTTPHeaders({
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      DNT: '1',
      'Sec-GPC': '1',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    });

    // Navigate directly to search page as guest
    const searchUrl = `https://produkte.metro.de/shop/search?q=${gtin}`;
    console.log(`Metro Guest Scraper: Navigating to ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: this.config.timeout,
    });

    // Handle cookie consent if needed
    await this.handleCookieConsent(page);

    // Wait for page to be fully loaded
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Debug: Quick check for key elements
    await this.quickDebug(page);

    return await this.extractProductData(page);
  }

  private async quickDebug(page: Page): Promise<void> {
    try {
      console.log('=== METRO GUEST QUICK DEBUG ===');

      const pageTitle = await page.title();
      const currentUrl = page.url();
      console.log(`Title: "${pageTitle}"`);
      console.log(`URL: ${currentUrl}`);

      // Check for key selectors
      const articleCards = await page.$$('.sd-articlecard');
      const wells = await page.$$('.well');
      const searchResults = await page.$$('.search-results');

      console.log(`Article cards: ${articleCards.length}`);
      console.log(`Wells: ${wells.length}`);
      console.log(`Search results: ${searchResults.length}`);

      // Check for product indicators
      const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
      const hasContent = bodyText.length > 0;

      console.log(`Body has content: ${hasContent}`);
      console.log(`Body text length: ${bodyText.length}`);

      if (hasContent) {
        // Show first 300 chars of body text
        const bodySnippet = bodyText.substring(0, 300);
        console.log(`Body text snippet: ${bodySnippet}...`);
      } else {
        console.log('WARNING: Page body is empty!');

        // Get HTML source to see if page loaded at all
        const htmlSource = await page.evaluate(() => document.documentElement.outerHTML);
        console.log(`HTML source length: ${htmlSource.length}`);
        console.log(`HTML source snippet: ${htmlSource.substring(0, 500)}...`);
      }

      console.log('=== END GUEST DEBUG ===');
    } catch (error) {
      console.log('Guest debug error:', error);
    }
  }

  private async extractProductData(page: Page): Promise<MetroGuestProductData> {
    console.log('=== METRO GUEST EXTRACT PRODUCT DATA START ===');
    try {
      let productUrl: string | undefined;
      let productName: string | undefined;
      let available = false;

      // Additional wait for any remaining dynamic content
      await new Promise(resolve => setTimeout(resolve, 1000));

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
          console.log(`Metro Guest Scraper: No results found with selector: ${selector}`);
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

      let productLinks: Awaited<ReturnType<Page['$$']>> = [];
      for (const selector of linkSelectors) {
        productLinks = await page.$$(selector);
        console.log(
          `Metro Guest Scraper: Found ${productLinks.length} product links with selector: ${selector}`
        );
        if (productLinks.length > 0) break;
      }

      if (productLinks.length === 0) {
        console.log('Metro Guest Scraper: No product links found with any selector');

        // Debug: Check what's actually on the page
        const pageContent = await page.evaluate(() => {
          const body = document.body;
          return body ? body.innerText.substring(0, 500) : 'No body found';
        });
        console.log(`Metro Guest Scraper Debug: Page content: ${pageContent}`);

        return { error: 'No products found for this GTIN on Metro' };
      }

      // Get the first product link
      const firstProductLink = productLinks[0];

      // Extract product URL
      const href = await page.evaluate(el => el.getAttribute('href'), firstProductLink);
      if (href) {
        productUrl = href.startsWith('/') ? `https://produkte.metro.de${href}` : href;
        console.log(`Metro Guest Scraper: Found product URL: ${productUrl}`);
        available = true;
      }

      // Extract product name
      try {
        productName = await page.evaluate(el => {
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
          console.log(`Metro Guest Scraper: Product name: "${productName}"`);
        }
      } catch (error) {
        console.log('Metro Guest Scraper: Error extracting product name:', error);
      }

      // Return results
      const result: MetroGuestProductData = {
        productUrl,
        productName,
        available,
      };

      console.log('Metro Guest Scraper: Final result:', result);
      return result;
    } catch (error) {
      console.error('Metro Guest Scraper: Error extracting product data:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error during extraction' };
    }
  }

  protected async handleCookieConsent(page: Page): Promise<void> {
    const metroSpecificSelectors = [
      '[data-testid="uc-accept-all-button"]',
      'button[id*="cookie"]',
      'button[class*="cookie"]',
      'button[class*="accept"]',
      'button[class*="consent"]',
      '.cookie-accept',
      '[id*="accept"]',
      '#onetrust-accept-btn-handler',
      '.ot-sdk-show-settings',
    ];

    for (const selector of metroSpecificSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          console.log(`Metro Guest Scraper: Accepted cookies with selector: ${selector}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return;
        }
      } catch {
        // Continue to next selector
      }
    }

    // Call parent method as fallback
    await super.handleCookieConsent(page);
  }

  // Legacy compatibility method
  public async scrapeProduct(gtin: string): Promise<MetroGuestProductData> {
    const result = await this.scrape(gtin);

    if (result.error) {
      return { error: result.error };
    }

    return result.data || { error: 'No data returned' };
  }

  public async getStats() {
    const poolStats = await this.getPoolStats();
    const cacheStats = this.getCacheStats();

    return {
      pool: poolStats,
      cache: cacheStats,
    };
  }

  protected async setupPage(page: Page): Promise<void> {
    // Enhanced stealth setup for Akamai bypass
    await page.evaluateOnNewDocument(() => {
      // Hide webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Hide Chrome runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).chrome;
    });

    // Set realistic viewport and screen properties
    await page.setViewport({
      width: 1366,
      height: 768,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false,
    });

    await super.setupPage(page);
  }
}

// Factory function for creating Metro guest scraper instances
export function createMetroGuestScraper(): MetroGuestScraper {
  return new MetroGuestScraper();
}
