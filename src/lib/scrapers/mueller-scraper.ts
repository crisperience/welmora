import WooCommerce from '@/lib/woocommerce/client';
import { ElementHandle, Page } from 'puppeteer';
import { BaseScraper, BaseScraperConfig } from './base-scraper';

export interface MuellerProductData {
  price?: number;
  productUrl?: string;
  error?: string;
}

export interface MuellerScraperConfig extends Partial<BaseScraperConfig> {
  searchTimeout?: number;
}

interface WooCommerceBrand {
  id: number;
  name: string;
  slug: string;
}

interface WooCommerceProduct {
  id: number;
  name: string;
  brands: WooCommerceBrand[];
  sku: string;
  meta_data: Array<{
    key: string;
    value: string;
  }>;
}

export class MuellerScraper extends BaseScraper<MuellerProductData> {
  private brands: WooCommerceBrand[] = [];
  private productBrandMap: Map<string, string> = new Map();

  constructor(config?: MuellerScraperConfig) {
    super({
      poolKey: 'mueller',
      cacheEnabled: true,
      cacheTTL: 30 * 60 * 1000, // 30 minutes
      maxRetries: 3,
      retryDelay: 2000,
      timeout: 120000,
      ...config,
    });
  }

  async initialize(): Promise<void> {
    await this.loadBrands();
    await this.loadProductBrandMappings();
  }

  private async loadBrands(): Promise<void> {
    try {
      const response = await WooCommerce.get('products/brands');
      this.brands = response.data as WooCommerceBrand[];
      console.log(`Loaded ${this.brands.length} brands from WooCommerce`);
    } catch (error) {
      console.error('Failed to load brands from WooCommerce:', error);
      this.brands = [];
    }
  }

  private async loadProductBrandMappings(): Promise<void> {
    try {
      // Get all products with their brands and GTINs
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await WooCommerce.get('products', {
          per_page: perPage,
          page: page,
          status: 'publish',
        });

        const products = response.data as WooCommerceProduct[];

        for (const product of products) {
          // Extract GTIN from meta_data or sku
          let gtin = product.sku;

          // Check meta_data for GTIN
          const gtinMeta = product.meta_data?.find(
            meta => meta.key === 'gtin' || meta.key === '_gtin' || meta.key === 'barcode'
          );
          if (gtinMeta) {
            gtin = gtinMeta.value;
          }

          // Map GTIN to brand name
          if (gtin && product.brands && product.brands.length > 0) {
            const brandName = product.brands[0].name.toLowerCase();
            this.productBrandMap.set(gtin, brandName);
          }
        }

        hasMore = products.length === perPage;
        page++;
      }

      console.log(`Loaded ${this.productBrandMap.size} product-brand mappings`);
    } catch (error) {
      console.error('Failed to load product-brand mappings:', error);
    }
  }

  private getBrandForGtin(gtin: string): string | null {
    return this.productBrandMap.get(gtin) || null;
  }

  protected async performScraping(page: Page, gtin: string): Promise<MuellerProductData> {
    // Initialize brand mappings if not done yet
    if (this.brands.length === 0) {
      await this.initialize();
    }

    const searchUrl = `https://www.mueller.de/search/?q=${gtin}`;

    console.log(`Mueller Scraper: Navigating to ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.timeout,
    });

    // Handle cookie consent
    await this.handleCookieConsent(page);

    // Check for no-results page
    const pageTitle = await page.title();
    const currentUrl = page.url();

    console.log(`Mueller Scraper: Page title: "${pageTitle}"`);
    console.log(`Mueller Scraper: Current URL: ${currentUrl}`);

    const isNoResultsPage =
      currentUrl.includes('/no-results/') ||
      pageTitle.includes('Keine Ergebnisse') ||
      pageTitle === 'MÜLLER - Auch online mehr als eine Drogerie';

    if (isNoResultsPage) {
      console.log('Mueller Scraper: No results page detected');
      return {
        price: undefined,
        productUrl: undefined,
        error: 'Product not found on Mueller',
      };
    }

    // Wait for product tiles to load
    const tilesLoaded = await this.waitForElement(
      page,
      '.product-tile_component_product-tile__20XP8',
      10000
    );

    if (!tilesLoaded) {
      console.log('Mueller Scraper: No product tiles found');
      return { error: 'No products found for this GTIN' };
    }

    // Get all product tiles
    const productTiles = await page.$$('.product-tile_component_product-tile__20XP8');
    console.log(`Mueller Scraper: Found ${productTiles.length} product tiles`);

    if (productTiles.length === 0) {
      return { error: 'No products found for this GTIN' };
    }

    // Find the first real search result (not sponsored)
    const realProduct = await this.findRealSearchResult(page, productTiles, gtin);

    if (!realProduct) {
      console.log('Mueller Scraper: No real search results found');
      return {
        price: undefined,
        productUrl: undefined,
        error: 'No real search results found on Mueller',
      };
    }

    // Extract product data from the real result
    const productData = await this.extractProductData(page, realProduct);

    console.log('Mueller Scraper: Final result:', productData);
    return productData;
  }

  private async findRealSearchResult(
    page: Page,
    productTiles: ElementHandle<Element>[],
    gtin?: string
  ): Promise<ElementHandle<Element> | null> {
    const realResults: {
      tile: ElementHandle<Element>;
      index: number;
      productUrl: string;
      productName?: string;
    }[] = [];

    // First, collect all real search results (not sponsored)
    for (let i = 0; i < productTiles.length; i++) {
      try {
        const tile = productTiles[i];

        // Get URL to check pattern
        const linkElement = await tile.$('a[href^="/p/"]');
        const productUrl = linkElement
          ? await page.evaluate(el => el.getAttribute('href'), linkElement)
          : '';

        // Extract product name for better debugging
        let productName = '';
        try {
          const nameElement = await tile.$(
            '.product-tile_component_product-tile__product-name__xG25c'
          );
          if (nameElement) {
            productName = await page.evaluate(el => el.textContent?.trim() || '', nameElement);
          }
        } catch {
          // Continue without name
        }

        // Check parent container to distinguish real vs recommended
        const parentElement = await page.evaluateHandle(el => el.parentElement, tile);
        const parentHTML = await page.evaluate(el => el?.className || '', parentElement);

        // Exclude sponsored/promotional items
        const isSponsored =
          parentHTML.includes('nav-flyout-promotion') ||
          parentHTML.includes('promotion') ||
          (productUrl && productUrl.includes('itemId='));

        // Include only real search results
        const isRealResult =
          !isSponsored &&
          parentHTML.includes('product-list') &&
          productUrl &&
          productUrl.endsWith('/');

        if (isRealResult) {
          console.log(
            `Mueller Scraper: Found real search result at position ${i + 1}: "${productName}" - ${productUrl}`
          );
          realResults.push({ tile, index: i, productUrl, productName });
        } else {
          console.log(
            `Mueller Scraper: Skipped product at position ${i + 1}: "${productName}" - ${productUrl} (sponsored: ${isSponsored}, parent: ${parentHTML.substring(0, 100)})`
          );
        }
      } catch (error) {
        console.log(`Mueller Scraper: Error checking product ${i + 1}:`, error);
      }
    }

    if (realResults.length === 0) {
      console.log('Mueller Scraper: No real search results found');
      return null;
    }

    console.log(`Mueller Scraper: Found ${realResults.length} real search results total`);

    // If we have a GTIN, try to find the product URL that contains the GTIN
    if (gtin && realResults.length > 1) {
      console.log(
        `Mueller Scraper: Multiple products found (${realResults.length}), searching for GTIN match: ${gtin}`
      );

      // First try: Look for GTIN directly in the product URL
      for (const result of realResults) {
        if (result.productUrl.includes(gtin)) {
          console.log(`Mueller Scraper: Found GTIN ${gtin} in product URL: ${result.productUrl}`);
          return result.tile;
        }
      }

      // Second try: Look for brand/product name match based on known GTIN patterns
      const brandMatches = this.getBrandMatchesForGtin(gtin);
      if (brandMatches.length > 0) {
        console.log(`Mueller Scraper: Looking for brand matches: ${brandMatches.join(', ')}`);
        for (const result of realResults) {
          for (const brand of brandMatches) {
            // More strict brand matching - brand should be a word boundary
            const brandRegex = new RegExp(`\\b${brand}\\b`, 'i');
            if (brandRegex.test(result.productUrl)) {
              console.log(
                `Mueller Scraper: Found brand match "${brand}" in URL: ${result.productUrl}`
              );
              return result.tile;
            }
          }
        }
        console.log(
          `Mueller Scraper: No brand matches found in URLs for: ${brandMatches.join(', ')}`
        );
      }

      // Second try: Check the HTML content of each product tile for GTIN
      console.log(`Mueller Scraper: Checking HTML content of each tile for GTIN ${gtin}...`);
      for (const result of realResults) {
        try {
          const tileHTML = await page.evaluate(el => el.outerHTML, result.tile);
          if (tileHTML.includes(gtin)) {
            console.log(
              `Mueller Scraper: Found GTIN ${gtin} in product tile HTML at position ${result.index + 1}: "${result.productName}"`
            );
            return result.tile;
          }
        } catch (error) {
          console.log(
            `Mueller Scraper: Error checking tile HTML for product ${result.index + 1}:`,
            error
          );
        }
      }

      // Third try: For known problematic GTINs, use product name matching
      // Since Mueller search returns fuzzy results, we need to identify the correct product by name
      const knownProductMappings: Record<string, string[]> = {
        '8700216678384': ['ariel', 'colorwaschmittel', 'pods'], // Ariel Colorwaschmittel Pods
      };

      if (knownProductMappings[gtin]) {
        console.log(`Mueller Scraper: Using product name matching for GTIN ${gtin}...`);
        const searchTerms = knownProductMappings[gtin];

        for (const result of realResults) {
          try {
            // Extract product name from tile
            const nameElements = await result.tile.$$(
              '.product-tile_component_product-tile__product-name__xG25c, [class*="product-name"], h3, h4'
            );
            let productName = result.productName || '';

            for (const nameElement of nameElements) {
              try {
                const name = await page.evaluate(el => el.textContent?.trim() || '', nameElement);
                if (name && name.length > productName.length) {
                  productName = name;
                }
              } catch {
                // Continue to next element
              }
            }

            console.log(
              `Mueller Scraper: Checking product name: "${productName}" at position ${result.index + 1}`
            );

            // Check if product name contains all required search terms
            const nameWords = productName.toLowerCase();
            const matchesAllTerms = searchTerms.every(term =>
              nameWords.includes(term.toLowerCase())
            );

            if (matchesAllTerms) {
              console.log(
                `Mueller Scraper: Found matching product by name for GTIN ${gtin} at position ${result.index + 1}`
              );
              return result.tile;
            }
          } catch (error) {
            console.log(
              `Mueller Scraper: Error checking product name for ${result.index + 1}:`,
              error
            );
          }
        }
      }

      console.log(
        `Mueller Scraper: No exact GTIN match found in URLs or HTML, using first real result: "${realResults[0].productName}"`
      );
    }

    // Return first real result as fallback
    console.log(
      `Mueller Scraper: Using first real search result at position ${realResults[0].index + 1}: "${realResults[0].productName}"`
    );
    return realResults[0].tile;
  }

  private async extractProductData(
    page: Page,
    tile: ElementHandle<Element>
  ): Promise<MuellerProductData> {
    let price: number | undefined;
    let productUrl: string | undefined;

    // Extract product name for logging
    try {
      const nameElement = await tile.$('.product-tile_component_product-tile__product-name__xG25c');
      if (nameElement) {
        const productName = await page.evaluate(el => el.textContent?.trim(), nameElement);
        console.log(`Mueller Scraper: Product name: "${productName}"`);
      }
    } catch (error) {
      console.log('Mueller Scraper: Error extracting product name:', error);
    }

    // Extract product URL first
    try {
      const linkElement = await tile.$('a[href^="/p/"]');
      if (linkElement) {
        const href = await page.evaluate(el => el.getAttribute('href'), linkElement);
        if (
          href &&
          href.startsWith('/p/') &&
          href.endsWith('/') &&
          !href.includes('itemId=') &&
          !href.includes('/search/')
        ) {
          productUrl = `https://www.mueller.de${href}`;
          console.log(`Mueller Scraper: Product URL: ${productUrl}`);
        } else {
          console.log(
            `Mueller Scraper: Invalid product URL pattern: ${href} - must start with /p/ and end with /`
          );
          return { error: 'Invalid product URL pattern' };
        }
      } else {
        console.log('Mueller Scraper: No product URL found');
        return { error: 'No product URL found' };
      }
    } catch (error) {
      console.log('Mueller Scraper: Error extracting product URL:', error);
      return { error: 'Error extracting product URL' };
    }

    // Now navigate to the actual product page to get the real price
    if (productUrl) {
      try {
        console.log(`Mueller Scraper: Navigating to product page: ${productUrl}`);
        await page.goto(productUrl, {
          waitUntil: 'domcontentloaded',
          timeout: this.config.timeout,
        });

        // Wait for price element to load
        await this.waitForElement(page, '[class*="product-price"]', 5000);

        // Extract price from product page with updated selectors
        const productPagePriceSelectors = [
          'span.h1.h2-desktop-only', // Main price selector based on actual HTML structure
          '.product-price_component_product-price__main-price-accent__zHz13',
          '[class*="main-price-accent"]',
          '[class*="product-price__main-price"]',
          '[class*="product-price"]',
          '.h1', // Fallback to just h1 class
        ];

        for (const selector of productPagePriceSelectors) {
          try {
            const priceElement = await page.$(selector);
            if (priceElement) {
              const priceText = await page.evaluate(el => el.textContent?.trim(), priceElement);
              console.log(
                `Mueller Scraper: Found price text with selector "${selector}": "${priceText}"`
              );

              if (priceText) {
                const parsedPrice = this.parsePrice(priceText);
                if (parsedPrice) {
                  price = parsedPrice;
                  console.log(`Mueller Scraper: Extracted price from product page: €${price}`);
                  break;
                }
              }
            }
          } catch (error) {
            console.log(
              `Mueller Scraper: Error with product page price selector "${selector}":`,
              error
            );
          }
        }

        if (!price) {
          console.log(
            'Mueller Scraper: No price found on product page, trying fallback extraction from search result'
          );
          // Fallback to search result price if product page fails
          const priceSelectors = [
            'span.h1.h2-desktop-only', // Main price selector
            '.product-price_component_product-price__main-price-accent__zHz13',
            '.h4.bold',
            '[class*="main-price"]',
            '[class*="product-price"]',
            '.h1', // Fallback to just h1 class
          ];

          // Go back to search results
          await page.goBack();
          await this.waitForElement(page, '.product-tile_component_product-tile__20XP8', 5000);

          for (const selector of priceSelectors) {
            try {
              const priceElement = await tile.$(selector);
              if (priceElement) {
                const priceText = await page.evaluate(el => el.textContent?.trim(), priceElement);
                console.log(
                  `Mueller Scraper: Fallback price text with selector "${selector}": "${priceText}"`
                );

                if (priceText) {
                  price = this.parsePrice(priceText);
                  if (price) {
                    console.log(`Mueller Scraper: Extracted fallback price: €${price}`);
                    break;
                  }
                }
              }
            } catch (error) {
              console.log(
                `Mueller Scraper: Error with fallback price selector "${selector}":`,
                error
              );
            }
          }
        }
      } catch (error) {
        console.log(`Mueller Scraper: Error navigating to product page: ${error}`);
        // If navigation fails, try to extract price from search result as fallback
        const priceSelectors = [
          'span.h1.h2-desktop-only', // Main price selector
          '.product-price_component_product-price__main-price-accent__zHz13',
          '.h4.bold',
          '[class*="main-price"]',
          '[class*="product-price"]',
          '.h1', // Fallback to just h1 class
        ];

        for (const selector of priceSelectors) {
          try {
            const priceElement = await tile.$(selector);
            if (priceElement) {
              const priceText = await page.evaluate(el => el.textContent?.trim(), priceElement);
              console.log(
                `Mueller Scraper: Fallback price text with selector "${selector}": "${priceText}"`
              );

              if (priceText) {
                price = this.parsePrice(priceText);
                if (price) {
                  console.log(`Mueller Scraper: Extracted fallback price: €${price}`);
                  break;
                }
              }
            }
          } catch (error) {
            console.log(
              `Mueller Scraper: Error with fallback price selector "${selector}":`,
              error
            );
          }
        }
      }
    }

    // Final validation: Ensure we don't return search URLs
    if (productUrl && (productUrl.includes('/search/') || productUrl.includes('?q='))) {
      console.log(`Mueller Scraper: Rejecting search URL: ${productUrl}`);
      return { error: 'Invalid product URL - search URL detected' };
    }

    // Final validation: Ensure we have valid product URL format
    if (productUrl && !productUrl.includes('/p/')) {
      console.log(`Mueller Scraper: Rejecting invalid product URL: ${productUrl}`);
      return { error: 'Invalid product URL - does not contain /p/' };
    }

    return {
      price,
      productUrl,
    };
  }

  // Legacy compatibility method
  public async scrapeProduct(gtin: string): Promise<MuellerProductData> {
    const result = await this.scrape(gtin);

    if (result.error) {
      return { error: result.error };
    }

    return result.data || { error: 'No data returned' };
  }

  // Additional utility methods
  public async clearCache(): Promise<void> {
    super.clearCache();
    // Also clear the brand mappings to force reload
    this.brands = [];
    this.productBrandMap.clear();
    console.log('Mueller scraper cache and brand mappings cleared');
  }

  private getBrandMatchesForGtin(gtin: string): string[] {
    // First try to get brand from WooCommerce mapping
    const brand = this.getBrandForGtin(gtin);
    if (brand) {
      return [brand];
    }

    // Fallback: Map known GTINs to brand/product keywords for Mueller search matching
    const gtinToBrandMap: Record<string, string[]> = {
      '8700216678384': ['ariel', 'colorwaschmittel'], // Ariel Color detergent
      // Add more GTIN mappings as needed
    };

    return gtinToBrandMap[gtin] || [];
  }

  public async getStats() {
    const poolStats = await this.getPoolStats();
    const cacheStats = this.getCacheStats();

    return {
      pool: poolStats,
      cache: cacheStats,
      brandsLoaded: this.brands.length,
      productBrandMappings: this.productBrandMap.size,
    };
  }

  public getBrandForGtinPublic(gtin: string): string | null {
    return this.getBrandForGtin(gtin);
  }

  public getBrandMatchesForGtinPublic(gtin: string): string[] {
    return this.getBrandMatchesForGtin(gtin);
  }
}

// Factory function for backward compatibility
export function createMuellerScraper(config?: MuellerScraperConfig): MuellerScraper {
  return new MuellerScraper(config);
}

// Default export
export default MuellerScraper;
