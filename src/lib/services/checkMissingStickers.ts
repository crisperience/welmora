import { getSupabaseServiceClient } from '@/lib/api/supabase/client';
import { getWooCommerceProducts } from '@/lib/api/woocommerce/client';

// Extended interface for WooCommerce products with additional fields
interface ExtendedWooCommerceProduct {
    id: number;
    name: string;
    sku: string;
    price: string;
    weight?: string;
    images: Array<{ src: string }>;
    categories?: Array<{ name: string }>;
    stock_status?: string;
    date_modified?: string;
    date_created?: string;
}

export interface MissingStickerProduct {
    sku: string;
    name: string;
    productId: number;
    price: string;
    stockStatus: string;
    lastModified: string;
}

export interface MissingStickersReport {
    totalProducts: number;
    productsWithStickers: number;
    productsWithoutStickers: number;
    withStickersPercentage: number;
    missingStickers: MissingStickerProduct[];
    lastChecked: string;
}

/**
 * Check all WooCommerce products for missing stickers in Supabase storage
 * Returns a list of products that don't have corresponding PDF files in the stickers bucket
 */
export async function checkMissingStickers(quick: boolean = false): Promise<MissingStickersReport> {
    console.log('Starting missing stickers check...');

    const report: MissingStickersReport = {
        totalProducts: 0,
        productsWithStickers: 0,
        productsWithoutStickers: 0,
        withStickersPercentage: 0,
        missingStickers: [],
        lastChecked: new Date().toISOString(),
    };

    try {
        // Step 1: Get all products from WooCommerce
        console.log('Fetching all products from WooCommerce...');
        const allProducts = await getAllWooCommerceProducts();

        if (allProducts.length === 0) {
            console.warn('No products found in WooCommerce');
            return report;
        }

        // For quick test, only check first 10 products
        const productsToCheck = quick ? allProducts.slice(0, 10) : allProducts;

        console.log(`Found ${allProducts.length} products in WooCommerce${quick ? ' (testing first 10)' : ''}`);
        report.totalProducts = productsToCheck.length;

        // Step 2: Check each product for stickers
        console.log('Checking sticker availability for each product...');

        for (let i = 0; i < productsToCheck.length; i++) {
            const product = productsToCheck[i];
            const progress = `${i + 1}/${productsToCheck.length}`;

            console.log(`[${progress}] Checking product: ${product.sku} - ${product.name}`);

            try {
                // Check if PDF exists in Supabase storage
                const pdfPath = await findStickerInStorage(product.sku);

                if (pdfPath) {
                    report.productsWithStickers++;
                    console.log(`  ✅ Sticker found: ${pdfPath}`);
                } else {
                    report.productsWithoutStickers++;
                    const missingProduct: MissingStickerProduct = {
                        sku: product.sku,
                        name: product.name,
                        productId: product.id,
                        price: product.price,
                        stockStatus: product.stock_status || 'unknown',
                        lastModified: product.date_modified || product.date_created || 'unknown',
                    };
                    report.missingStickers.push(missingProduct);
                    console.log(`  ❌ No sticker found`);
                }
            } catch {
                report.productsWithoutStickers++;
                const missingProduct: MissingStickerProduct = {
                    sku: product.sku,
                    name: product.name,
                    productId: product.id,
                    price: product.price,
                    stockStatus: product.stock_status || 'unknown',
                    lastModified: product.date_modified || product.date_created || 'unknown',
                };
                report.missingStickers.push(missingProduct);
                console.error(`  ⚠️ Error checking sticker: Unknown error`);
            }
        }

        // Step 3: Calculate statistics
        report.withStickersPercentage =
            report.totalProducts > 0
                ? Math.round((report.productsWithStickers / report.totalProducts) * 100)
                : 0;

        console.log('\n=== MISSING STICKERS SUMMARY ===');
        console.log(`Total products: ${report.totalProducts}`);
        console.log(`Products with stickers: ${report.productsWithStickers}`);
        console.log(`Products without stickers: ${report.productsWithoutStickers}`);
        console.log(`Coverage: ${report.withStickersPercentage}%`);
        console.log(`Missing stickers: ${report.missingStickers.length}`);

        return report;
    } catch (error) {
        console.error('Error in missing stickers check:', error);
        throw error;
    }
}

/**
 * Get all products from WooCommerce (handles pagination)
 */
async function getAllWooCommerceProducts(): Promise<ExtendedWooCommerceProduct[]> {
    const allProducts: ExtendedWooCommerceProduct[] = [];
    let page = 1;
    const perPage = 100; // Maximum allowed by WooCommerce API

    while (true) {
        console.log(`Fetching products page ${page}...`);

        const response = await getWooCommerceProducts({
            page,
            per_page: perPage,
            status: 'publish',
        });

        if (!response.success || !response.data) {
            console.error(`Failed to fetch products page ${page}:`, response.error);
            break;
        }

        // Cast to extended interface to access additional properties
        const products = response.data as ExtendedWooCommerceProduct[];
        allProducts.push(...products);

        console.log(`  Retrieved ${products.length} products from page ${page}`);

        // If we got fewer products than requested, we've reached the end
        if (products.length < perPage) {
            break;
        }

        page++;
    }

    return allProducts;
}

/**
 * Search for sticker PDF in Supabase storage
 * Enhanced version that relies on comprehensive recursive search since Supabase search API is unreliable
 */
async function findStickerInStorage(sku: string): Promise<string | null> {
    try {
        // Use comprehensive recursive search as primary method
        const recursiveResult = await comprehensiveRecursiveSearch(sku);
        if (recursiveResult) {
            return recursiveResult;
        }

        // Fallback to direct search API (though it's less reliable)
        const { data: searchResults, error: searchError } = await getSupabaseServiceClient()
            .storage.from('stickers')
            .list('', {
                limit: 1000,
                search: sku
            });

        if (searchError) {
            console.error(`❌ Search error for ${sku}: ${searchError.message}`);
            return null;
        }

        const pdfFile = searchResults?.find(file =>
            file.name.toLowerCase().includes(sku.toLowerCase()) &&
            file.name.toLowerCase().endsWith('.pdf')
        );

        if (pdfFile) {
            return pdfFile.name;
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Comprehensive search that checks all known brand folders and their subfolders
 */
async function comprehensiveRecursiveSearch(sku: string): Promise<string | null> {
    const targetFileName = `${sku}.pdf`;

    try {
        // Get all top-level folders
        const { data: topFolders, error: topError } = await getSupabaseServiceClient()
            .storage.from('stickers')
            .list('', { limit: 100 });

        if (topError) {
            console.error(`❌ Error listing top folders: ${topError.message}`);
            return null;
        }

        // Filter to get only folders (not files) - folders don't end with file extensions
        const folders = topFolders?.filter(item =>
            !item.name.endsWith('.pdf') &&
            !item.name.endsWith('.jpg') &&
            !item.name.endsWith('.png') &&
            !item.name.endsWith('.txt') &&
            item.name !== '.'
        ) || [];

        for (const folder of folders) {
            const result = await searchInFolder(folder.name, targetFileName);
            if (result) {
                return result;
            }
        }

        return null;
    } catch (error) {
        console.error(`❌ Error in comprehensive search:`, error);
        return null;
    }
}

/**
 * Recursive search through folders - enhanced version with detailed logging
 */
async function searchInFolder(folderPath: string, targetFileName: string): Promise<string | null> {
    try {
        const { data: items, error } = await getSupabaseServiceClient()
            .storage.from('stickers')
            .list(folderPath, { limit: 1000 });

        if (error) {
            return null;
        }

        if (!items) return null;

        // Check for the target file in current folder
        const targetFile = items.find(item =>
            item.name.toLowerCase() === targetFileName.toLowerCase()
        );

        if (targetFile) {
            const fullPath = `${folderPath}/${targetFile.name}`;
            return fullPath;
        }

        // Recursively search subfolders - fix folder filtering logic
        const subFolders = items.filter(item =>
            !item.name.endsWith('.pdf') &&
            !item.name.endsWith('.jpg') &&
            !item.name.endsWith('.png') &&
            !item.name.endsWith('.txt') &&
            item.name !== '.'
        );

        for (const subFolder of subFolders) {
            const subPath = `${folderPath}/${subFolder.name}`;
            const result = await searchInFolder(subPath, targetFileName);
            if (result) {
                return result;
            }
        }

        return null;
    } catch {
        return null;
    }
} 