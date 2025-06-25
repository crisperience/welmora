import { getBrowserPool } from './browser-pool';

export interface BatchItem {
  id: string;
  gtin: string;
  name?: string;
}

export interface BatchResult {
  id: string;
  gtin: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  cached?: boolean;
}

export interface BatchProgress {
  total: number;
  completed: number;
  successful: number;
  failed: number;
  cached: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  estimatedTimeRemaining?: number;
}

export interface BatchProcessorConfig {
  batchSize: number;
  concurrency: number;
  delayBetweenBatches: number;
  delayBetweenItems: number;
  maxRetries: number;
  onProgress?: (progress: BatchProgress) => void;
  onItemComplete?: (result: BatchResult) => void;
  onBatchComplete?: (batchResults: BatchResult[]) => void;
}

export interface ScraperInterface {
  scrape(identifier: string): Promise<{
    data?: unknown;
    error?: string;
    cached?: boolean;
    timestamp: string;
    duration: number;
  }>;
}

export class BatchProcessor {
  private config: BatchProcessorConfig;
  private isProcessing = false;
  private shouldStop = false;

  constructor(config: Partial<BatchProcessorConfig> = {}) {
    this.config = {
      batchSize: 10,
      concurrency: 3,
      delayBetweenBatches: 2000, // 2 seconds
      delayBetweenItems: 500, // 0.5 seconds
      maxRetries: 2,
      ...config,
    };
  }

  public async processBatch(items: BatchItem[], scraper: ScraperInterface): Promise<BatchResult[]> {
    if (this.isProcessing) {
      throw new Error('Batch processor is already running');
    }

    this.isProcessing = true;
    this.shouldStop = false;

    const startTime = new Date();
    const results: BatchResult[] = [];
    const totalBatches = Math.ceil(items.length / this.config.batchSize);

    console.log(
      `Batch Processor: Starting batch processing of ${items.length} items in ${totalBatches} batches`
    );

    try {
      // Process items in batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        if (this.shouldStop) {
          console.log('Batch Processor: Stopping due to user request');
          break;
        }

        const batchStart = batchIndex * this.config.batchSize;
        const batchEnd = Math.min(batchStart + this.config.batchSize, items.length);
        const batchItems = items.slice(batchStart, batchEnd);

        console.log(
          `Batch Processor: Processing batch ${batchIndex + 1}/${totalBatches} (${batchItems.length} items)`
        );

        // Process batch with controlled concurrency
        const batchResults = await this.processBatchConcurrently(batchItems, scraper);
        results.push(...batchResults);

        // Update progress
        const progress = this.calculateProgress(
          results,
          items.length,
          batchIndex + 1,
          totalBatches,
          startTime
        );
        this.config.onProgress?.(progress);

        // Callback for batch completion
        this.config.onBatchComplete?.(batchResults);

        // Delay between batches (except for the last batch)
        if (batchIndex < totalBatches - 1 && !this.shouldStop) {
          console.log(
            `Batch Processor: Waiting ${this.config.delayBetweenBatches}ms before next batch...`
          );
          await this.delay(this.config.delayBetweenBatches);
        }
      }

      const finalProgress = this.calculateProgress(
        results,
        items.length,
        totalBatches,
        totalBatches,
        startTime
      );
      this.config.onProgress?.(finalProgress);

      console.log(`Batch Processor: Completed processing ${results.length} items`);
      console.log(
        `Batch Processor: Success: ${results.filter(r => r.success).length}, Failed: ${results.filter(r => !r.success).length}, Cached: ${results.filter(r => r.cached).length}`
      );

      return results;
    } finally {
      this.isProcessing = false;
    }
  }

  private async processBatchConcurrently(
    batchItems: BatchItem[],
    scraper: ScraperInterface
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const semaphore = new Semaphore(this.config.concurrency);

    // Create promises for all items in the batch
    const promises = batchItems.map(async (item, index) => {
      return semaphore.acquire(async () => {
        if (this.shouldStop) {
          return null;
        }

        // Add delay between items within the same batch
        if (index > 0) {
          await this.delay(this.config.delayBetweenItems);
        }

        return await this.processItem(item, scraper);
      });
    });

    // Wait for all promises to complete
    const batchResults = await Promise.all(promises);

    // Filter out null results (from stopped processing)
    for (const result of batchResults) {
      if (result) {
        results.push(result);
        this.config.onItemComplete?.(result);
      }
    }

    return results;
  }

  private async processItem(item: BatchItem, scraper: ScraperInterface): Promise<BatchResult> {
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.maxRetries + 1; attempt++) {
      try {
        console.log(
          `Batch Processor: Processing ${item.name || item.gtin} (attempt ${attempt}/${this.config.maxRetries + 1})`
        );

        const result = await scraper.scrape(item.gtin);

        return {
          id: item.id,
          gtin: item.gtin,
          success: !result.error,
          data: result.data,
          error: result.error,
          duration: Date.now() - startTime,
          cached: result.cached,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Batch Processor: Attempt ${attempt} failed for ${item.gtin}:`, errorMessage);

        // If this was the last attempt, return the error
        if (attempt === this.config.maxRetries + 1) {
          return {
            id: item.id,
            gtin: item.gtin,
            success: false,
            error: errorMessage,
            duration: Date.now() - startTime,
          };
        }

        // Wait before retry
        await this.delay(1000 * attempt);
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      id: item.id,
      gtin: item.gtin,
      success: false,
      error: 'Unexpected error',
      duration: Date.now() - startTime,
    };
  }

  private calculateProgress(
    results: BatchResult[],
    totalItems: number,
    currentBatch: number,
    totalBatches: number,
    startTime: Date
  ): BatchProgress {
    const completed = results.length;
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const cached = results.filter(r => r.cached).length;

    const elapsedTime = Date.now() - startTime.getTime();
    const avgTimePerItem = completed > 0 ? elapsedTime / completed : 0;
    const remainingItems = totalItems - completed;
    const estimatedTimeRemaining = remainingItems > 0 ? avgTimePerItem * remainingItems : 0;

    return {
      total: totalItems,
      completed,
      successful,
      failed,
      cached,
      currentBatch,
      totalBatches,
      startTime,
      estimatedTimeRemaining,
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public stop(): void {
    console.log('Batch Processor: Stop requested');
    this.shouldStop = true;
  }

  public get isRunning(): boolean {
    return this.isProcessing;
  }

  public async getResourceStats() {
    const browserPool = getBrowserPool();
    return await browserPool.getStats();
  }
}

// Semaphore class for controlling concurrency
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.permits > 0) {
        this.permits--;
        this.executeTask(task, resolve, reject);
      } else {
        this.waiting.push(() => {
          this.permits--;
          this.executeTask(task, resolve, reject);
        });
      }
    });
  }

  private async executeTask<T>(
    task: () => Promise<T>,
    resolve: (value: T) => void,
    reject: (reason?: unknown) => void
  ): Promise<void> {
    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.permits++;
      if (this.waiting.length > 0) {
        const next = this.waiting.shift();
        next?.();
      }
    }
  }
}

export default BatchProcessor;
