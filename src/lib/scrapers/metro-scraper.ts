import { Page } from 'puppeteer';
import { BaseScraper } from './base-scraper';

interface MetroScraperConfig {
  email: string;
  password: string;
  searchTimeout?: number;
}

export interface MetroProductData {
  price?: number;
  productUrl?: string;
  error?: string;
}

export class MetroScraper extends BaseScraper<MetroProductData> {
  private metroConfig: MetroScraperConfig;

  constructor(config: MetroScraperConfig) {
    super({
      poolKey: 'metro-scraper',
      cacheEnabled: true,
      cacheTTL: 30 * 60 * 1000, // 30 minutes
      maxRetries: 2,
      retryDelay: 2000,
      timeout: 45000, // 45 seconds - shorter for debugging
    });
    this.metroConfig = config;
  }

  protected async performScraping(page: Page, gtin: string): Promise<MetroProductData> {
    console.log(`Metro Scraper: Starting search for GTIN: ${gtin}`);

    // Setup page optimizations
    await this.setupPage(page);

    // Set realistic user agent and headers to match the working request
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

    // First, login to Metro
    await this.loginToMetro(page);

    // Wait a bit after login to let cookies settle and simulate human behavior
    const randomWait = 2000 + Math.random() * 3000; // 2-5 seconds
    await new Promise(resolve => setTimeout(resolve, randomWait));
    console.log('Metro Scraper: Post-login wait completed');

    // First navigate to the main products page to establish session
    console.log('Metro Scraper: Navigating to main products page first...');
    await page.goto('https://produkte.metro.de/shop', {
      waitUntil: 'networkidle2',
      timeout: this.config.timeout,
    });

    // Wait a bit and handle any consent
    await this.handleCookieConsent(page);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Now navigate to search page using the GTIN/SKU search URL
    const searchUrl = `https://produkte.metro.de/shop/search?q=${gtin}`;
    console.log(`Metro Scraper: Navigating to ${searchUrl}`);

    await page.goto(searchUrl, {
      waitUntil: 'networkidle2',
      timeout: this.config.timeout,
    });

    // Check for JavaScript errors
    await page.evaluate(() => {
      const errors: string[] = [];
      window.addEventListener('error', e => {
        errors.push(`JS Error: ${e.message} at ${e.filename}:${e.lineno}`);
      });
      return errors;
    });

    // Handle cookie consent if needed
    await this.handleCookieConsent(page);

    // Wait for page to be fully loaded
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });

    // Wait for any potential JavaScript to load content
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Simulate user interaction to trigger JavaScript
    console.log('Metro Scraper: Simulating user interactions...');
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);
    await page.keyboard.press('Tab');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Wait for search results to load - try multiple strategies
    console.log('Metro Scraper: Waiting for search results to load...');

    // Strategy 1: Wait for specific elements
    try {
      await page.waitForSelector('.sd-articlecard, .well, .search-results, .product-list', {
        timeout: 8000,
      });
      console.log('Metro Scraper: Search results container found');
    } catch {
      console.log(
        'Metro Scraper: Search results container not found, trying alternative approach...'
      );
    }

    // Strategy 2: Wait for any content to appear in body
    try {
      await page.waitForFunction(
        () => {
          const body = document.body;
          return body && body.innerText.trim().length > 0;
        },
        { timeout: 10000 }
      );
      console.log('Metro Scraper: Body content appeared');
    } catch {
      console.log('Metro Scraper: Body content never appeared');
    }

    // Strategy 3: Wait for specific Metro JavaScript to load
    try {
      await page.waitForFunction(
        () => {
          // Check if Metro-specific JavaScript objects exist
          return (
            window.hasOwnProperty('Metro') ||
            window.hasOwnProperty('angular') ||
            document.querySelector('[data-ng-app]') !== null
          );
        },
        { timeout: 5000 }
      );
      console.log('Metro Scraper: Metro JavaScript detected');
    } catch {
      console.log('Metro Scraper: Metro JavaScript not detected');
    }

    // Additional wait for dynamic content
    const additionalWait = 3000 + Math.random() * 2000; // 3-5 seconds
    await new Promise(resolve => setTimeout(resolve, additionalWait));
    console.log('Metro Scraper: Additional wait completed');

    // Wait for search results to load
    await page.waitForSelector('body', { timeout: 10000 });
    console.log('Metro Scraper: Page loaded, extracting product data...');

    // Debug: Log page title and URL
    const pageTitle = await page.title();
    const currentUrl = page.url();
    console.log(`Metro Scraper: Page title: "${pageTitle}"`);
    console.log(`Metro Scraper: Current URL: ${currentUrl}`);

    // Check if we got redirected or blocked
    if (
      currentUrl.includes('blocked') ||
      currentUrl.includes('captcha') ||
      currentUrl.includes('access-denied')
    ) {
      console.log('Metro Scraper: Detected potential blocking or captcha');
      return { error: 'Access blocked by Metro anti-bot protection' };
    }

    // Debug: Quick check for key elements
    await this.quickDebug(page);

    // Full debug if needed
    // await this.debugPageElements(page);

    return await this.extractProductData(page);
  }

  private async loginToMetro(page: Page): Promise<void> {
    try {
      console.log('Metro Scraper: Starting login process...');

      // Try different Metro login URLs
      const loginUrls = [
        'https://www.metro.de/metro/services/idamstream/login',
        'https://www.metro.de/mein-markt',
        'https://www.metro.de/login',
        'https://produkte.metro.de/login',
        'https://produkte.metro.de/shop/login',
      ];

      let loginPageFound = false;
      for (const loginUrl of loginUrls) {
        try {
          console.log(`Metro Scraper: Trying login URL: ${loginUrl}`);
          await page.goto(loginUrl, {
            waitUntil: 'networkidle2',
            timeout: this.config.timeout,
          });

          // Handle cookie consent first
          await this.handleCookieConsent(page);

          // Debug: Log page content
          const pageTitle = await page.title();
          const currentUrl = page.url();
          console.log(`Metro Scraper: Page title: "${pageTitle}"`);
          console.log(`Metro Scraper: Current URL: ${currentUrl}`);

          // Wait for login form to load if we're on the login page
          if (currentUrl.includes('/login') || currentUrl.includes('idamstream')) {
            console.log('Metro Scraper: Waiting for login form to load...');
            try {
              await page.waitForSelector('#authForm, input#user_id, .loginFields', {
                timeout: 10000,
              });
              console.log('Metro Scraper: Login form elements detected');
            } catch {
              console.log('Metro Scraper: Login form wait timeout, continuing...');
            }
          }

          // Check if we can find login elements
          const hasEmailField = await page.$(
            'input[type="email"], input#user_id, input[name="user_id"], input[name="email"]'
          );
          const hasPasswordField = await page.$(
            'input[type="password"], input#password, input[name="password"]'
          );

          console.log(`Metro Scraper: Found email field: ${!!hasEmailField}`);
          console.log(`Metro Scraper: Found password field: ${!!hasPasswordField}`);

          if (hasEmailField && hasPasswordField) {
            loginPageFound = true;
            break;
          }

          // If not found, try clicking login button first using XPath and evaluate
          const loginButtonSelectors = [
            'a[href="/metro/services/idamstream/login"]',
            'a.btn-primary.back-after-login',
            'button.btn-primary.btn.btn-default',
            'a[href*="login"]',
            '.btn-primary',
            '[data-testid="login-button"]',
            '.login-button',
          ];

          // Also try finding buttons by text content using evaluate
          const loginButtonByText = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, a'));
            return buttons.find(button => {
              const text = button.textContent?.toLowerCase() || '';
              return (
                text.includes('login') ||
                text.includes('anmelden') ||
                text.includes('einloggen') ||
                text.includes('registrieren')
              );
            });
          });

          if (loginButtonByText) {
            console.log('Metro Scraper: Found login button by text content');
            try {
              await page.evaluate(button => {
                (button as HTMLElement).click();
              }, loginButtonByText);
              console.log('Metro Scraper: Clicked login button via evaluate');
              await page
                .waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
                .catch(() => {});

              // Check again for login form
              const emailFieldAfterClick = await page.$(
                'input[type="email"], input#user_id, input[name="user_id"], input[name="email"]'
              );
              const passwordFieldAfterClick = await page.$(
                'input[type="password"], input#password, input[name="password"]'
              );

              if (emailFieldAfterClick && passwordFieldAfterClick) {
                loginPageFound = true;
                break;
              }
            } catch (error) {
              console.log('Metro Scraper: Error clicking login button by text:', error);
            }
          }

          // Try regular selectors
          for (const selector of loginButtonSelectors) {
            try {
              const loginButton = await page.$(selector);
              if (loginButton) {
                const buttonText = await page.evaluate(el => el.textContent?.trim(), loginButton);
                console.log(
                  `Metro Scraper: Found potential login button with text: "${buttonText}"`
                );

                if (buttonText?.toLowerCase().match(/(login|anmelden|einloggen|registrieren)/)) {
                  console.log('Metro Scraper: Clicking login button...');

                  // Try different click methods
                  try {
                    await loginButton.click();
                  } catch {
                    console.log('Metro Scraper: Regular click failed, trying evaluate click');
                    await page.evaluate(el => (el as HTMLElement).click(), loginButton);
                  }

                  await page
                    .waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
                    .catch(() => {});

                  // Check again for login form
                  const emailFieldAfterClick = await page.$(
                    'input[type="email"], input#user_id, input[name="user_id"], input[name="email"]'
                  );
                  const passwordFieldAfterClick = await page.$(
                    'input[type="password"], input#password, input[name="password"]'
                  );

                  if (emailFieldAfterClick && passwordFieldAfterClick) {
                    loginPageFound = true;
                    break;
                  }
                }
              }
            } catch (error) {
              console.log(`Metro Scraper: Error with login button selector "${selector}":`, error);
            }
          }

          if (loginPageFound) break;
        } catch (error) {
          console.log(`Metro Scraper: Error with login URL "${loginUrl}":`, error);
        }
      }

      if (!loginPageFound) {
        // Debug: Get page content to understand what's available
        const bodyText = await page.evaluate(() => {
          const body = document.body;
          return body ? body.innerText.substring(0, 1000) : 'No body found';
        });
        console.log(`Metro Scraper Debug: Page content: ${bodyText}`);

        // Try to find any form elements
        const allInputs = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          return inputs.map(input => ({
            type: input.type,
            name: input.name,
            id: input.id,
            placeholder: input.placeholder,
          }));
        });
        console.log('Metro Scraper Debug: Found inputs:', allInputs);

        // Try to find any buttons
        const allButtons = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, a'));
          return buttons
            .map(button => ({
              tagName: button.tagName,
              text: button.textContent?.trim(),
              href: button.getAttribute('href'),
              className: button.className,
            }))
            .slice(0, 10); // Limit to first 10
        });
        console.log('Metro Scraper Debug: Found buttons:', allButtons);

        throw new Error('Could not find Metro login form on any of the attempted URLs');
      }

      console.log('Metro Scraper: Login form found, proceeding with authentication...');

      // Fill email field
      const emailSelectors = [
        'input#user_id',
        'input[type="email"]',
        'input[name="user_id"]',
        'input[name="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="E-Mail" i]',
      ];

      let emailFilled = false;
      for (const selector of emailSelectors) {
        try {
          const emailField = await page.$(selector);
          if (emailField) {
            console.log(`Metro Scraper: Found email field with selector: ${selector}`);
            await emailField.click();
            await page.evaluate(el => ((el as HTMLInputElement).value = ''), emailField);
            // Type with human-like delays
            await emailField.type(this.metroConfig.email, { delay: 50 + Math.random() * 100 });
            console.log('Metro Scraper: Email filled');
            emailFilled = true;
            break;
          }
        } catch (error) {
          console.log(`Metro Scraper: Error with email selector "${selector}":`, error);
        }
      }

      if (!emailFilled) {
        throw new Error('Could not find or fill email input field');
      }

      // Fill password field
      const passwordSelectors = [
        'input#password',
        'input[type="password"]',
        'input[name="password"]',
        'input[placeholder*="password" i]',
        'input[placeholder*="Passwort" i]',
      ];

      let passwordFilled = false;
      for (const selector of passwordSelectors) {
        try {
          const passwordField = await page.$(selector);
          if (passwordField) {
            console.log(`Metro Scraper: Found password field with selector: ${selector}`);
            await passwordField.click();
            await page.evaluate(el => ((el as HTMLInputElement).value = ''), passwordField);
            // Type with human-like delays
            await passwordField.type(this.metroConfig.password, {
              delay: 50 + Math.random() * 100,
            });
            console.log('Metro Scraper: Password filled');
            passwordFilled = true;
            break;
          }
        } catch (error) {
          console.log(`Metro Scraper: Error with password selector "${selector}":`, error);
        }
      }

      if (!passwordFilled) {
        throw new Error('Could not find or fill password input field');
      }

      // Submit the form
      const submitSelectors = [
        'button#submit',
        'button.m-button.m-button-primaryRaised.primary-button',
        'button[type="submit"]',
        'button.m-button.m-button-primaryRaised',
        '.primary-button',
        'input[type="submit"]',
        '.login-submit',
        '.submit-button',
      ];

      let formSubmitted = false;

      // First try to find submit button by text content
      const submitButtonByText = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        return buttons.find(button => {
          const text = button.textContent?.toLowerCase() || '';
          const value = (button as HTMLInputElement).value?.toLowerCase() || '';
          return (
            text.match(/(login|anmelden|register|submit|einloggen|weiter)/) ||
            value.match(/(login|anmelden|register|submit|einloggen|weiter)/)
          );
        });
      });

      if (submitButtonByText) {
        console.log('Metro Scraper: Found submit button by text content');
        try {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
            page.evaluate(button => (button as HTMLElement).click(), submitButtonByText),
          ]);
          console.log('Metro Scraper: Form submitted via text-based button');
          formSubmitted = true;
        } catch (error) {
          console.log('Metro Scraper: Error submitting via text-based button:', error);
        }
      }

      // If text-based submit didn't work, try regular selectors
      if (!formSubmitted) {
        for (const selector of submitSelectors) {
          try {
            const submitButton = await page.$(selector);
            if (submitButton) {
              const buttonText = await page.evaluate(el => el.textContent?.trim(), submitButton);
              console.log(
                `Metro Scraper: Found submit button with text: "${buttonText}" and selector: "${selector}"`
              );

              // Look for submit-like text
              if (
                buttonText?.toLowerCase().match(/(login|anmelden|register|submit|einloggen|weiter)/)
              ) {
                console.log('Metro Scraper: Submitting form...');
                await Promise.all([
                  page
                    .waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 })
                    .catch(() => {}),
                  submitButton.click(),
                ]);
                console.log('Metro Scraper: Form submitted');
                formSubmitted = true;
                break;
              }
            }
          } catch (error) {
            console.log(`Metro Scraper: Error with submit selector "${selector}":`, error);
          }
        }
      }

      if (!formSubmitted) {
        // Try pressing Enter as fallback
        console.log('Metro Scraper: Trying Enter key as fallback...');
        await page.keyboard.press('Enter');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
        console.log('Metro Scraper: Form submitted via Enter key');
      }

      // Check if login was successful
      const currentUrl = page.url();
      const pageTitle = await page.title();
      console.log(`Metro Scraper: After login attempt - URL: ${currentUrl}, Title: "${pageTitle}"`);

      // Wait a bit for any redirects
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for login success indicators
      const finalUrl = page.url();
      const finalTitle = await page.title();
      console.log(`Metro Scraper: Final after login - URL: ${finalUrl}, Title: "${finalTitle}"`);

      // Look for signs that we're logged in
      const loggedInIndicators = [
        '.user-menu',
        '.logout',
        '[href*="logout"]',
        '.my-account',
        '.user-profile',
      ];

      let isLoggedIn = false;
      for (const indicator of loggedInIndicators) {
        const element = await page.$(indicator);
        if (element) {
          console.log(`Metro Scraper: Found logged-in indicator: ${indicator}`);
          isLoggedIn = true;
          break;
        }
      }

      if (!isLoggedIn && !finalUrl.includes('dashboard') && !finalUrl.includes('account')) {
        console.log('Metro Scraper: Warning - Login success not confirmed, but proceeding...');
      }

      console.log('Metro Scraper: Login process completed');
    } catch (error) {
      console.error('Metro Scraper: Login failed:', error);
      throw new Error(
        `Metro login failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async quickDebug(page: Page): Promise<void> {
    try {
      console.log('=== METRO QUICK DEBUG ===');

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
      const hasGillette = bodyText.includes('gillette');
      const hasVenus = bodyText.includes('venus');
      const hasEinwegrasierer = bodyText.includes('einwegrasierer');

      console.log(`Contains 'gillette': ${hasGillette}`);
      console.log(`Contains 'venus': ${hasVenus}`);
      console.log(`Contains 'einwegrasierer': ${hasEinwegrasierer}`);

      // Show first 300 chars of body text
      const bodySnippet = bodyText.substring(0, 300);
      console.log(`Body text snippet: ${bodySnippet}...`);

      // Check if body is empty or just whitespace
      if (!bodyText || bodyText.trim().length === 0) {
        console.log('WARNING: Page body is empty or contains only whitespace!');

        // Get HTML source to see if page loaded at all
        const htmlSource = await page.evaluate(() => document.documentElement.outerHTML);
        console.log(`HTML source length: ${htmlSource.length}`);
        console.log(`HTML source snippet: ${htmlSource.substring(0, 500)}...`);
      }

      // Check for specific Metro elements
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

      metroElements.forEach(info => console.log(info));

      console.log('=== END QUICK DEBUG ===');
    } catch (error) {
      console.log('Quick debug error:', error);
    }
  }

  private async debugPageElements(page: Page): Promise<void> {
    try {
      console.log('=== METRO SCRAPER DEBUG START ===');

      // Get full page HTML (first 2000 chars)
      const fullHtml = await page.evaluate(() => document.documentElement.outerHTML);
      console.log(
        `Metro Scraper Debug: Full HTML (first 2000 chars):\n${fullHtml.substring(0, 2000)}...`
      );

      // Check for Metro-specific selectors
      const selectors = [
        '.sd-articlecard',
        '.well',
        'a.title',
        'a[href*="/shop/pv/"]',
        '.sd-articlecard a.title',
        '.sd-articlecard a.image',
        '.price-display-main-row',
        '.price-display-main-row .primary',
        '.no-results',
        '.search-no-results',
        '.search-results',
        '.product-list',
      ];

      for (const selector of selectors) {
        const elements = await page.$$(selector);
        console.log(
          `Metro Scraper Debug: Found ${elements.length} elements with selector: ${selector}`
        );

        if (elements.length > 0) {
          // Get details from first few elements
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            const element = elements[i];
            const html = await page.evaluate(el => el.outerHTML, element);
            const text = await page.evaluate(el => el.textContent?.trim(), element);
            console.log(`Metro Scraper Debug: Element ${i + 1} with selector "${selector}":`);
            console.log(`  HTML: ${html.substring(0, 300)}...`);
            console.log(`  Text: ${text?.substring(0, 200)}...`);
          }
        }
      }

      // Check for specific Metro search result structure
      const articleCards = await page.$$('.sd-articlecard');
      console.log(`Metro Scraper Debug: Found ${articleCards.length} article cards`);

      if (articleCards.length > 0) {
        // Get full details from first article card
        const firstCard = articleCards[0];
        const cardHtml = await page.evaluate(el => el.outerHTML, firstCard);
        console.log(`Metro Scraper Debug: First article card FULL HTML:\n${cardHtml}`);
      }

      // Check for Wells (search result containers)
      const wells = await page.$$('.well');
      console.log(`Metro Scraper Debug: Found ${wells.length} wells`);

      if (wells.length > 0) {
        const firstWell = wells[0];
        const wellHtml = await page.evaluate(el => el.outerHTML, firstWell);
        console.log(`Metro Scraper Debug: First well FULL HTML:\n${wellHtml}`);
      }

      // Get page content snippet for debugging
      const bodyText = await page.evaluate(() => {
        const body = document.body;
        return body ? body.innerText : 'No body found';
      });
      console.log(
        `Metro Scraper Debug: Full page text (first 1000 chars):\n${bodyText.substring(0, 1000)}...`
      );

      // Look for any text that might indicate search results
      const searchIndicators = await page.evaluate(() => {
        const text = document.body.innerText.toLowerCase();
        const indicators = [
          'gillette',
          'venus',
          'einwegrasierer',
          'artikel',
          'produkt',
          'ergebnis',
          'suchergebnis',
          'treffer',
        ];
        return indicators.filter(indicator => text.includes(indicator));
      });
      console.log(`Metro Scraper Debug: Found search indicators: ${searchIndicators.join(', ')}`);

      // Check for any divs or spans that might contain products
      const allDivs = await page.$$('div');
      const allSpans = await page.$$('span');
      console.log(
        `Metro Scraper Debug: Found ${allDivs.length} divs and ${allSpans.length} spans on page`
      );

      // Look for any elements with "gillette" in text content
      const gilletteElements = await page.evaluate(() => {
        const allElements = Array.from(document.querySelectorAll('*'));
        return allElements
          .filter(
            el =>
              el.textContent?.toLowerCase().includes('gillette') ||
              el.textContent?.toLowerCase().includes('venus')
          )
          .map(el => ({
            tagName: el.tagName,
            className: el.className,
            textContent: el.textContent?.substring(0, 100),
            outerHTML: el.outerHTML.substring(0, 200),
          }));
      });
      console.log(
        `Metro Scraper Debug: Found ${gilletteElements.length} elements containing 'gillette' or 'venus':`
      );
      gilletteElements.forEach((el, i) => {
        console.log(
          `  Element ${i + 1}: ${el.tagName}.${el.className} - "${el.textContent}" - HTML: ${el.outerHTML}...`
        );
      });

      console.log('=== METRO SCRAPER DEBUG END ===');
    } catch (error) {
      console.log('Metro Scraper Debug: Error during debugging:', error);
    }
  }

  private async extractProductData(page: Page): Promise<MetroProductData> {
    console.log('=== METRO EXTRACT PRODUCT DATA START ===');
    try {
      let price: number | undefined;
      let productUrl: string | undefined;

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
          console.log(`Metro Scraper: No results found with selector: ${selector}`);
          return { error: 'No products found for this GTIN on Metro' };
        }
      }

      // Look for product links in Metro's actual structure
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
          `Metro Scraper: Found ${productLinks.length} product links with selector: ${selector}`
        );
        if (productLinks.length > 0) break;
      }

      if (productLinks.length === 0) {
        console.log('Metro Scraper: No product links found with any selector');

        // Debug: Check what's actually on the page
        const pageContent = await page.evaluate(() => {
          const body = document.body;
          return body ? body.innerText.substring(0, 500) : 'No body found';
        });
        console.log(`Metro Scraper Debug: Page content: ${pageContent}`);

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
          console.log(`Metro Scraper: Product name: "${productName}"`);
        }
      } catch (error) {
        console.log('Metro Scraper: Error extracting product name:', error);
      }

      // Look for price in the search results with Metro-specific selectors
      const priceSelectors = [
        '.price-display-main-row .primary span span', // Metro specific structure
        '.price-display .primary span span', // Alternative Metro structure
        '.price-display-main-row .primary', // Fallback without nested spans
        '.sd-articlecard .price-display-main-row span', // Article card price
        '[class*="price-display"] [class*="primary"]', // Generic price display
        '.price', // Generic price class
      ];

      // Try to find price in the search results
      for (const selector of priceSelectors) {
        try {
          const priceElement = await page.$(selector);
          if (priceElement) {
            const priceText = await page.evaluate(el => el.textContent?.trim(), priceElement);
            console.log(
              `Metro Scraper: Found price text with selector "${selector}": "${priceText}"`
            );

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
          console.log(
            `Metro Scraper: No price found in search results, navigating to product page: ${productUrl}`
          );
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
                console.log(
                  `Metro Scraper: Found price text on product page with selector "${selector}": "${priceText}"`
                );

                if (priceText) {
                  price = this.parsePrice(priceText);
                  if (price) {
                    console.log(`Metro Scraper: Extracted price from product page: €${price}`);
                    break;
                  }
                }
              }
            } catch (error) {
              console.log(
                `Metro Scraper: Error with product page price selector "${selector}":`,
                error
              );
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

    // Request interception is already handled by base scraper
    // Additional Metro-specific optimizations will be handled there

    // Add realistic human-like behavior - simplified to avoid TypeScript issues
    await page.evaluateOnNewDocument(() => {
      // Add some randomness to timing
      console.log('Metro Scraper: Enhanced stealth mode activated');
    });

    await super.setupPage(page);
  }
}

// Factory function for creating Metro scraper instances
export function createMetroScraper(config?: Partial<MetroScraperConfig>): MetroScraper {
  const email = config?.email || process.env.METRO_EMAIL;
  const password = config?.password || process.env.METRO_PASSWORD;

  if (!email || !password) {
    throw new Error('METRO_EMAIL and METRO_PASSWORD environment variables are required');
  }

  return new MetroScraper({
    email,
    password,
    ...config,
  });
}
