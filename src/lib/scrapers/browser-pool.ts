import puppeteer, { Browser, Page } from 'puppeteer';

export interface BrowserPoolConfig {
  maxBrowsers: number;
  maxPagesPerBrowser: number;
  pageTimeout: number;
  browserTimeout: number;
  headless: boolean;
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  resourceThrottling: {
    maxMemoryMB: number;
    checkIntervalMs: number;
  };
}

export interface PageResource {
  page: Page;
  browser: Browser;
  inUse: boolean;
  lastUsed: Date;
  usageCount: number;
}

export interface BrowserResource {
  browser: Browser;
  pages: PageResource[];
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
}

export class BrowserPool {
  private static instance: BrowserPool;
  private browsers: Map<string, BrowserResource> = new Map();
  private config: BrowserPoolConfig;
  private isShuttingDown = false;
  private resourceMonitor: NodeJS.Timeout | null = null;

  private constructor(config?: Partial<BrowserPoolConfig>) {
    this.config = {
      maxBrowsers: 2,
      maxPagesPerBrowser: 5,
      pageTimeout: 120000,
      browserTimeout: 300000, // 5 minutes
      headless: true,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      resourceThrottling: {
        maxMemoryMB: 2048, // 2GB limit
        checkIntervalMs: 30000, // Check every 30 seconds
      },
      ...config,
    };

    this.startResourceMonitoring();
    this.setupCleanupHandlers();
  }

  public static getInstance(config?: Partial<BrowserPoolConfig>): BrowserPool {
    if (!BrowserPool.instance) {
      BrowserPool.instance = new BrowserPool(config);
    }
    return BrowserPool.instance;
  }

  private startResourceMonitoring(): void {
    this.resourceMonitor = setInterval(async () => {
      await this.checkResourceUsage();
      await this.cleanupIdleResources();
    }, this.config.resourceThrottling.checkIntervalMs);
  }

  private async checkResourceUsage(): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const memoryMB = memoryUsage.heapUsed / 1024 / 1024;

      console.log(`Browser Pool: Memory usage: ${memoryMB.toFixed(2)}MB`);

      if (memoryMB > this.config.resourceThrottling.maxMemoryMB) {
        console.warn(
          `Browser Pool: High memory usage detected (${memoryMB.toFixed(2)}MB), cleaning up resources...`
        );
        await this.forceCleanup();
      }
    } catch (error) {
      console.error('Browser Pool: Error checking resource usage:', error);
    }
  }

  private async cleanupIdleResources(): Promise<void> {
    const now = new Date();
    const idleThreshold = 5 * 60 * 1000; // 5 minutes

    for (const [poolKey, browserResource] of this.browsers.entries()) {
      const idleTime = now.getTime() - browserResource.lastUsed.getTime();

      if (idleTime > idleThreshold) {
        console.log(`Browser Pool: Cleaning up idle browser for ${poolKey}`);
        await this.closeBrowser(poolKey);
      } else {
        // Clean up idle pages within active browsers
        for (const pageResource of browserResource.pages) {
          const pageIdleTime = now.getTime() - pageResource.lastUsed.getTime();
          if (!pageResource.inUse && pageIdleTime > idleThreshold / 2) {
            await this.closePage(pageResource);
            browserResource.pages = browserResource.pages.filter(p => p !== pageResource);
          }
        }
      }
    }
  }

  private async forceCleanup(): Promise<void> {
    console.log('Browser Pool: Force cleanup initiated');

    // Close all idle pages first
    for (const browserResource of this.browsers.values()) {
      const idlePages = browserResource.pages.filter(p => !p.inUse);
      for (const pageResource of idlePages) {
        await this.closePage(pageResource);
      }
      browserResource.pages = browserResource.pages.filter(p => p.inUse);
    }

    // If still high memory usage, close least used browsers
    const sortedBrowsers = Array.from(this.browsers.entries()).sort(
      ([, a], [, b]) => a.lastUsed.getTime() - b.lastUsed.getTime()
    );

    const browsersToClose = Math.ceil(sortedBrowsers.length / 2);
    for (let i = 0; i < browsersToClose; i++) {
      const [poolKey] = sortedBrowsers[i];
      await this.closeBrowser(poolKey);
    }
  }

  public async getPage(poolKey: string): Promise<PageResource> {
    if (this.isShuttingDown) {
      throw new Error('Browser pool is shutting down');
    }

    let browserResource = this.browsers.get(poolKey);

    // Create browser if it doesn't exist
    if (!browserResource) {
      browserResource = await this.createBrowser(poolKey);
    }

    // Find available page or create new one (exclude closed pages)
    let pageResource = browserResource.pages.find(p => !p.inUse && !p.page.isClosed());

    // Clean up any closed pages
    const closedPages = browserResource.pages.filter(p => p.page.isClosed());
    for (const closedPage of closedPages) {
      await this.removePage(closedPage);
    }

    if (!pageResource && browserResource.pages.length < this.config.maxPagesPerBrowser) {
      pageResource = await this.createPage(browserResource);
    }

    if (!pageResource) {
      // Wait for a page to become available
      pageResource = await this.waitForAvailablePage(browserResource);
    }

    // Mark page as in use
    pageResource.inUse = true;
    pageResource.lastUsed = new Date();
    pageResource.usageCount++;
    browserResource.lastUsed = new Date();
    browserResource.usageCount++;

    return pageResource;
  }

  public async releasePage(pageResource: PageResource): Promise<void> {
    try {
      // Check if page is still accessible
      if (pageResource.page.isClosed()) {
        console.log('Browser Pool: Page already closed, removing from pool');
        await this.removePage(pageResource);
        return;
      }

      // Reset page state
      await pageResource.page.goto('about:blank');
      await pageResource.page.setRequestInterception(false);

      // Clear any existing handlers
      pageResource.page.removeAllListeners();

      // Mark as available
      pageResource.inUse = false;
      pageResource.lastUsed = new Date();

      console.log('Browser Pool: Page released and reset');
    } catch (error) {
      console.error('Browser Pool: Error releasing page:', error);
      // If we can't reset the page, close it and remove from pool
      await this.closePage(pageResource);
      await this.removePage(pageResource);
    }
  }

  private async createBrowser(poolKey: string): Promise<BrowserResource> {
    console.log(`Browser Pool: Creating new browser for ${poolKey}`);

    const browser = await puppeteer.launch({
      headless: this.config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--max_old_space_size=512',
        `--user-agent=${this.config.userAgent}`,
      ],
    });

    const browserResource: BrowserResource = {
      browser,
      pages: [],
      createdAt: new Date(),
      lastUsed: new Date(),
      usageCount: 0,
    };

    this.browsers.set(poolKey, browserResource);
    console.log(`Browser Pool: Browser created for ${poolKey}`);

    return browserResource;
  }

  private async createPage(browserResource: BrowserResource): Promise<PageResource> {
    const page = await browserResource.browser.newPage();

    // Configure page
    await page.setViewport(this.config.viewport);
    await page.setUserAgent(this.config.userAgent);

    // Set default headers
    await page.setExtraHTTPHeaders({
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      DNT: '1',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });

    const pageResource: PageResource = {
      page,
      browser: browserResource.browser,
      inUse: false,
      lastUsed: new Date(),
      usageCount: 0,
    };

    browserResource.pages.push(pageResource);
    console.log(
      `Browser Pool: New page created (${browserResource.pages.length}/${this.config.maxPagesPerBrowser})`
    );

    return pageResource;
  }

  private async waitForAvailablePage(browserResource: BrowserResource): Promise<PageResource> {
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const availablePage = browserResource.pages.find(p => !p.inUse);
      if (availablePage) {
        return availablePage;
      }

      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Timeout waiting for available page');
  }

  private async closePage(pageResource: PageResource): Promise<void> {
    try {
      if (!pageResource.page.isClosed()) {
        await pageResource.page.close();
      }
      console.log('Browser Pool: Page closed');
    } catch (error) {
      console.error('Browser Pool: Error closing page:', error);
    }
  }

  private async removePage(pageResource: PageResource): Promise<void> {
    // Find and remove the page from its browser's page array
    for (const browserResource of this.browsers.values()) {
      const pageIndex = browserResource.pages.indexOf(pageResource);
      if (pageIndex !== -1) {
        browserResource.pages.splice(pageIndex, 1);
        console.log(`Browser Pool: Page removed from pool (${browserResource.pages.length} remaining)`);
        break;
      }
    }
  }

  private async closeBrowser(poolKey: string): Promise<void> {
    const browserResource = this.browsers.get(poolKey);
    if (!browserResource) return;

    try {
      // Close all pages first
      for (const pageResource of browserResource.pages) {
        await this.closePage(pageResource);
      }

      // Close browser
      if (!browserResource.browser.process()?.killed) {
        await browserResource.browser.close();
      }

      this.browsers.delete(poolKey);
      console.log(`Browser Pool: Browser closed for ${poolKey}`);
    } catch (error) {
      console.error(`Browser Pool: Error closing browser for ${poolKey}:`, error);
    }
  }

  public async getStats(): Promise<{
    browsers: number;
    totalPages: number;
    activeBrowsers: string[];
    memoryUsage: NodeJS.MemoryUsage;
  }> {
    const stats = {
      browsers: this.browsers.size,
      totalPages: 0,
      activeBrowsers: Array.from(this.browsers.keys()),
      memoryUsage: process.memoryUsage(),
    };

    for (const browserResource of this.browsers.values()) {
      stats.totalPages += browserResource.pages.length;
    }

    return stats;
  }

  private setupCleanupHandlers(): void {
    const cleanup = async () => {
      console.log('Browser Pool: Shutdown initiated');
      this.isShuttingDown = true;

      if (this.resourceMonitor) {
        clearInterval(this.resourceMonitor);
        this.resourceMonitor = null;
      }

      // Close all browsers
      const closePromises = Array.from(this.browsers.keys()).map(poolKey =>
        this.closeBrowser(poolKey)
      );

      await Promise.all(closePromises);
      console.log('Browser Pool: Shutdown complete');
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    process.on('exit', cleanup);
  }

  public async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor);
      this.resourceMonitor = null;
    }

    const closePromises = Array.from(this.browsers.keys()).map(poolKey =>
      this.closeBrowser(poolKey)
    );

    await Promise.all(closePromises);
    console.log('Browser Pool: Manual shutdown complete');
  }
}

// Singleton instance getter
export function getBrowserPool(config?: Partial<BrowserPoolConfig>): BrowserPool {
  return BrowserPool.getInstance(config);
}
