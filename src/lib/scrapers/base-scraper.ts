import { Page } from 'puppeteer';
import { BrowserPoolConfig, getBrowserPool, PageResource } from './browser-pool';

export interface ScrapingResult<T = unknown> {
  data?: T;
  error?: string;
  cached?: boolean;
  timestamp: string;
  duration: number;
}

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
}

export interface BaseScraperConfig {
  poolKey: string;
  cacheEnabled: boolean;
  cacheTTL: number; // Time to live in milliseconds
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  browserPoolConfig?: Partial<BrowserPoolConfig>;
}

export abstract class BaseScraper<TResult = unknown> {
  protected config: BaseScraperConfig;
  private cache: Map<string, CacheEntry<TResult>> = new Map();
  private browserPool: ReturnType<typeof getBrowserPool>;

  constructor(config: Partial<BaseScraperConfig>) {
    this.config = {
      poolKey: 'default',
      cacheEnabled: true,
      cacheTTL: 30 * 60 * 1000, // 30 minutes default
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 120000,
      ...config,
    };
    this.browserPool = getBrowserPool(this.config.browserPoolConfig);
  }

  protected abstract performScraping(page: Page, identifier: string): Promise<TResult>;

  public async scrape(identifier: string): Promise<ScrapingResult<TResult>> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(identifier);

    try {
      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          console.log(`${this.config.poolKey}: Cache hit for ${identifier}`);
          return {
            data: cached,
            cached: true,
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
          };
        }
      }

      // Perform scraping with retries
      const result = await this.scrapeWithRetries(identifier);

      // Cache the result
      if (this.config.cacheEnabled && result) {
        this.setCache(cacheKey, result);
      }

      return {
        data: result,
        cached: false,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`${this.config.poolKey}: Scraping failed for ${identifier}:`, error);
      return {
        error: error instanceof Error ? error.message : 'Unknown scraping error',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };
    }
  }

  private async scrapeWithRetries(identifier: string): Promise<TResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      let pageResource: PageResource | null = null;

      try {
        console.log(
          `${this.config.poolKey}: Attempt ${attempt}/${this.config.maxRetries} for ${identifier}`
        );

        // Get page from pool
        pageResource = await this.browserPool.getPage(this.config.poolKey);
        const page = pageResource.page;

        // Set timeout for this scraping operation
        page.setDefaultTimeout(this.config.timeout);

        // Perform the actual scraping
        const result = await this.performScraping(page, identifier);

        // Release page back to pool
        await this.browserPool.releasePage(pageResource);

        console.log(`${this.config.poolKey}: Success on attempt ${attempt} for ${identifier}`);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(
          `${this.config.poolKey}: Attempt ${attempt} failed for ${identifier}:`,
          lastError.message
        );

        // Release page back to pool even on error
        if (pageResource) {
          try {
            await this.browserPool.releasePage(pageResource);
          } catch (releaseError) {
            console.error(`${this.config.poolKey}: Error releasing page:`, releaseError);
          }
        }

        // Wait before retry (except on last attempt)
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * attempt; // Exponential backoff
          console.log(`${this.config.poolKey}: Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  protected async setupPage(page: Page): Promise<void> {
    // Set request interception for resource optimization
    await page.setRequestInterception(true);
    page.on('request', req => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Handle cookie consent automatically
    page.on('response', async response => {
      if (response.url().includes('cookie') || response.url().includes('consent')) {
        try {
          await this.handleCookieConsent(page);
        } catch {
          console.log(`${this.config.poolKey}: Cookie consent handling failed`);
        }
      }
    });
  }

  protected async handleCookieConsent(page: Page): Promise<void> {
    const cookieSelectors = [
      '[data-testid="uc-accept-all-button"]',
      '.cookie-accept',
      '[id*="cookie"]',
      '[class*="cookie"]',
      'button[class*="accept"]',
      'button[class*="consent"]',
    ];

    for (const selector of cookieSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          console.log(`${this.config.poolKey}: Accepted cookies with selector: ${selector}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return;
        }
      } catch {
        // Continue to next selector
      }
    }
  }

  protected async waitForElement(page: Page, selector: string, timeout = 10000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      console.log(`${this.config.poolKey}: Element not found: ${selector}`);
      return false;
    }
  }

  protected async extractText(
    page: Page,
    element: Element,
    selector?: string
  ): Promise<string | null> {
    try {
      if (selector) {
        const targetElement = await element.querySelector(selector);
        if (!targetElement) return null;
        return await page.evaluate(el => el.textContent?.trim() || null, targetElement);
      } else {
        return await page.evaluate(el => el.textContent?.trim() || null, element);
      }
    } catch {
      return null;
    }
  }

  protected async extractAttribute(
    page: Page,
    element: Element,
    attribute: string
  ): Promise<string | null> {
    try {
      return await page.evaluate((el, attr) => el.getAttribute(attr), element, attribute);
    } catch {
      return null;
    }
  }

  protected parsePrice(priceText: string | null): number | undefined {
    if (!priceText) return undefined;

    // Extract numeric value from price text (e.g., "1,95 €" -> 1.95)
    const priceMatch = priceText.match(/(\d+[,.]?\d*)/);
    if (priceMatch) {
      const numericPrice = parseFloat(priceMatch[1].replace(',', '.'));
      if (!isNaN(numericPrice)) {
        return numericPrice;
      }
    }

    return undefined;
  }

  private getCacheKey(identifier: string): string {
    return `${this.config.poolKey}:${identifier}`;
  }

  private getFromCache(key: string): TResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt.getTime()) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: TResult): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.cacheTTL);

    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt,
    });

    // Cleanup expired entries periodically
    if (this.cache.size > 1000) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt.getTime()) {
        this.cache.delete(key);
      }
    }
    console.log(
      `${this.config.poolKey}: Cache cleanup completed, ${this.cache.size} entries remaining`
    );
  }

  public clearCache(): void {
    this.cache.clear();
    console.log(`${this.config.poolKey}: Cache cleared`);
  }

  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  public async getPoolStats() {
    return await this.browserPool.getStats();
  }
}
