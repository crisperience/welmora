import { Page } from 'puppeteer';
import { BaseScraper } from './base-scraper';

interface MetroScraperConfig {
    searchTimeout?: number;
}

export interface MetroProductData {
    price?: number;
    productUrl?: string;
    error?: string;
}

export class MetroScraper extends BaseScraper<MetroProductData> {
    constructor(config?: MetroScraperConfig) {
        super({
            poolKey: 'metro-scraper',
            cacheEnabled: true,
            cacheTTL: 30 * 60 * 1000, // 30 minutes
            maxRetries: 3,
            retryDelay: 2000,
            timeout: 60000,
            ...config,
        });
    }

    protected async performScraping(page: Page, gtin: string): Promise<MetroProductData> {
        console.log(`Metro Scraper: Starting search for GTIN: ${gtin}`);

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

        // Navigate to Metro search page using the GTIN/SKU search URL
        const searchUrl = `https://produkte.metro.de/shop/search?q=${gtin}`;
        console.log(`Metro Scraper: Navigating to ${searchUrl}`);

        await page.goto(searchUrl, {
            waitUntil: 'networkidle2',
            timeout: this.config.timeout,
        });

        // Handle cookie consent
        await this.handleCookieConsent(page);

        // Wait for search results to load
        await page.waitForSelector('body', { timeout: 10000 });
        console.log('Metro Scraper: Page loaded, extracting product data...');

        // Debug: Log page title and URL
        const pageTitle = await page.title();
        const currentUrl = page.url();
        console.log(`Metro Scraper: Page title: "${pageTitle}"`);
        console.log(`Metro Scraper: Current URL: ${currentUrl}`);

        // Debug: Check for different possible elements on the page
        await this.debugPageElements(page);

        return await this.extractProductData(page);
    }

    private async debugPageElements(page: Page): Promise<void> {
        try {
            // Check for various possible selectors
            const selectors = [
                'a.title',
                'a[href*="/shop/pv/"]',
                '.product-tile',
                '.search-result',
                '.product-card',
                '[data-testid*="product"]',
                '.price-display-main-row',
                '.no-results',
                '.search-no-results',
            ];

            for (const selector of selectors) {
                const elements = await page.$$(selector);
                console.log(`Metro Scraper Debug: Found ${elements.length} elements with selector: ${selector}`);
            }

            // Get page content snippet for debugging
            const bodyText = await page.evaluate(() => {
                const body = document.body;
                return body ? body.innerText.substring(0, 500) : 'No body found';
            });
            console.log(`Metro Scraper Debug: Page content snippet: ${bodyText.substring(0, 200)}...`);
        } catch (error) {
            console.log('Metro Scraper Debug: Error during debugging:', error);
        }
    }

    private async extractProductData(page: Page): Promise<MetroProductData> {
        try {
            let price: number | undefined;
            let productUrl: string | undefined;

            // Check for no results first
            const noResultsSelectors = [
                '.no-results',
                '.search-no-results',
                '[data-testid="no-results"]',
                '.empty-state',
            ];

            for (const selector of noResultsSelectors) {
                const noResultsElement = await page.$(selector);
                if (noResultsElement) {
                    console.log(`Metro Scraper: No results found with selector: ${selector}`);
                    return { error: 'No products found for this GTIN on Metro' };
                }
            }

            // Look for product links in search results with multiple strategies
            const linkSelectors = [
                'a.title[href*="/shop/pv/"]',
                'a[href*="/shop/pv/"]',
                '.product-tile a[href*="/shop/pv/"]',
                '.search-result a[href*="/shop/pv/"]',
                'a[class*="title"]',
                'a[class*="product"]',
            ];

            let productLinks: Awaited<ReturnType<Page['$$']>> = [];
            for (const selector of linkSelectors) {
                productLinks = await page.$$(selector);
                console.log(`Metro Scraper: Found ${productLinks.length} product links with selector: ${selector}`);
                if (productLinks.length > 0) break;
            }

            if (productLinks.length === 0) {
                console.log('Metro Scraper: No product links found with any selector');
                return { error: 'No products found for this GTIN on Metro' };
            }

            // Get the first product link
            const firstProductLink = productLinks[0];

            // Extract product URL
            const href = await page.evaluate(el => el.getAttribute('href'), firstProductLink);
            if (href) {
                productUrl = href.startsWith('/') ? `https://produkte.metro.de${href}` : href;
                console.log(`Metro Scraper: Found product URL: ${productUrl}`);
            }

            // Extract product name for logging
            try {
                const productName = await page.evaluate(el => {
                    // Try multiple ways to get the product name
                    const titleWrapper = el.querySelector('.title-wrapper h4');
                    if (titleWrapper) return titleWrapper.textContent?.trim();

                    const h4 = el.querySelector('h4');
                    if (h4) return h4.textContent?.trim();

                    const title = el.querySelector('[class*="title"]');
                    if (title) return title.textContent?.trim();

                    return el.textContent?.trim();
                }, firstProductLink);
                if (productName) {
                    console.log(`Metro Scraper: Product name: "${productName}"`);
                }
            } catch (error) {
                console.log('Metro Scraper: Error extracting product name:', error);
            }

            // Look for price in the search results first with multiple strategies
            const priceSelectors = [
                '.price-display-main-row .primary span span',
                '.price-display-main-row .primary',
                '[class*="price-display"] [class*="primary"]',
                '[class*="price"]',
                '.price',
                '[data-testid*="price"]',
                '.product-price',
            ];

            // Try to find price in the search results with global selectors
            for (const selector of priceSelectors) {
                try {
                    const priceElement = await page.$(selector);
                    if (priceElement) {
                        const priceText = await page.evaluate(el => el.textContent?.trim(), priceElement);
                        console.log(`Metro Scraper: Found price text with selector "${selector}": "${priceText}"`);

                        if (priceText) {
                            price = this.parsePrice(priceText);
                            if (price) {
                                console.log(`Metro Scraper: Extracted price from search results: €${price}`);
                                break;
                            }
                        }
                    }
                } catch (error) {
                    console.log(`Metro Scraper: Error with price selector "${selector}":`, error);
                }
            }

            // If no price found in search results and we have a product URL, navigate to product page
            if (!price && productUrl) {
                try {
                    console.log(`Metro Scraper: No price found in search results, navigating to product page: ${productUrl}`);
                    await page.goto(productUrl, {
                        waitUntil: 'networkidle2',
                        timeout: 30000,
                    });

                    // Wait for product page to load
                    await page.waitForSelector('body', { timeout: 10000 });

                    // Try to extract price from product page
                    const productPagePriceSelectors = [
                        '.price-display-main-row .primary span span',
                        '.price-display-main-row .primary',
                        '[class*="price-display"] [class*="primary"]',
                        '[data-testid="price"]',
                        '[class*="price"][class*="main"]',
                        '.product-price',
                        '.price',
                    ];

                    for (const selector of productPagePriceSelectors) {
                        try {
                            const priceElement = await page.$(selector);
                            if (priceElement) {
                                const priceText = await page.evaluate(el => el.textContent?.trim(), priceElement);
                                console.log(`Metro Scraper: Found price text on product page with selector "${selector}": "${priceText}"`);

                                if (priceText) {
                                    price = this.parsePrice(priceText);
                                    if (price) {
                                        console.log(`Metro Scraper: Extracted price from product page: €${price}`);
                                        break;
                                    }
                                }
                            }
                        } catch (error) {
                            console.log(`Metro Scraper: Error with product page price selector "${selector}":`, error);
                        }
                    }
                } catch (error) {
                    console.log(`Metro Scraper: Error navigating to product page: ${error}`);
                }
            }

            // Return results
            const result: MetroProductData = {
                price,
                productUrl,
            };

            console.log('Metro Scraper: Final result:', result);
            return result;
        } catch (error) {
            console.error('Metro Scraper: Error extracting product data:', error);
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
                    console.log(`Metro Scraper: Accepted cookies with selector: ${selector}`);
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
    public async scrapeProduct(gtin: string): Promise<MetroProductData> {
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
}

// Factory function for creating Metro scraper instances
export function createMetroScraper(config?: MetroScraperConfig): MetroScraper {
    return new MetroScraper(config);
} 