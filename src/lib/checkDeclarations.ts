import { getSupabaseServiceClient } from '@/lib/supabase/client';
import { getWooCommerceProducts } from '@/lib/woocommerce/client';

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

// Interface for Supabase storage file objects
interface StorageFile {
    name: string;
    id?: string;
    updated_at?: string;
    created_at?: string;
    last_accessed_at?: string;
    metadata?: Record<string, unknown>;
}

export interface DeclarationStatus {
    sku: string;
    name: string;
    hasDeclaration: boolean;
    declarationPath?: string;
    productId: number;
    price: string;
    stockStatus: string;
    lastModified: string;
    error?: string;
}

export interface DeclarationReport {
    totalProducts: number;
    withDeclarations: number;
    missingDeclarations: number;
    withDeclarationsPercentage: number;
    products: DeclarationStatus[];
    summary: {
        productsWithDeclarations: DeclarationStatus[];
        productsWithoutDeclarations: DeclarationStatus[];
    };
    lastChecked: string;
}

/**
 * Comprehensive check of all products and their declaration status
 * Fetches all products from WooCommerce and checks if they have PDF declarations in Supabase
 */
export async function checkAllProductDeclarations(): Promise<DeclarationReport> {
    console.log('Starting comprehensive product declaration check...');

    const report: DeclarationReport = {
        totalProducts: 0,
        withDeclarations: 0,
        missingDeclarations: 0,
        withDeclarationsPercentage: 0,
        products: [],
        summary: {
            productsWithDeclarations: [],
            productsWithoutDeclarations: []
        },
        lastChecked: new Date().toISOString()
    };

    try {
        // Step 1: Get all products from WooCommerce
        console.log('Fetching all products from WooCommerce...');
        const allProducts = await getAllWooCommerceProducts();

        if (allProducts.length === 0) {
            console.warn('No products found in WooCommerce');
            return report;
        }

        console.log(`Found ${allProducts.length} products in WooCommerce`);
        report.totalProducts = allProducts.length;

        // Step 2: Check each product for declarations
        console.log('Checking declaration status for each product...');

        for (let i = 0; i < allProducts.length; i++) {
            const product = allProducts[i];
            const progress = `${i + 1}/${allProducts.length}`;

            console.log(`[${progress}] Checking product: ${product.sku} - ${product.name}`);

            const declarationStatus: DeclarationStatus = {
                sku: product.sku,
                name: product.name,
                hasDeclaration: false,
                productId: product.id,
                price: product.price,
                stockStatus: product.stock_status || 'unknown',
                lastModified: product.date_modified || product.date_created || 'unknown'
            };

            try {
                // Check if PDF exists in Supabase storage
                const pdfPath = await findDeclarationPdf(product.sku);

                if (pdfPath) {
                    declarationStatus.hasDeclaration = true;
                    declarationStatus.declarationPath = pdfPath;
                    report.withDeclarations++;
                    report.summary.productsWithDeclarations.push(declarationStatus);
                    console.log(`  ✅ Declaration found: ${pdfPath}`);
                } else {
                    report.missingDeclarations++;
                    report.summary.productsWithoutDeclarations.push(declarationStatus);
                    console.log(`  ❌ No declaration found`);
                }
            } catch (error) {
                declarationStatus.error = error instanceof Error ? error.message : 'Unknown error';
                report.missingDeclarations++;
                report.summary.productsWithoutDeclarations.push(declarationStatus);
                console.error(`  ⚠️ Error checking declaration: ${declarationStatus.error}`);
            }

            report.products.push(declarationStatus);
        }

        // Step 3: Calculate statistics
        report.withDeclarationsPercentage = report.totalProducts > 0
            ? Math.round((report.withDeclarations / report.totalProducts) * 100)
            : 0;

        console.log('\n=== DECLARATION CHECK SUMMARY ===');
        console.log(`Total products: ${report.totalProducts}`);
        console.log(`With declarations: ${report.withDeclarations} (${report.withDeclarationsPercentage}%)`);
        console.log(`Missing declarations: ${report.missingDeclarations}`);
        console.log('================================\n');

        return report;

    } catch (error) {
        console.error('Error during declaration check:', error);
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
            status: 'publish'
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
 * Search for declaration PDF in Supabase storage
 * Uses the same logic as the ZIP generation function
 */
async function findDeclarationPdf(sku: string): Promise<string | null> {
    if (!sku) {
        return null;
    }

    try {
        // Use the same search logic as generateZipFromSkus
        const { data, error } = await getSupabaseServiceClient()
            .storage.from('stickers')
            .list('', {
                limit: 2000,
                search: sku,
                sortBy: { column: 'name', order: 'asc' },
            });

        if (error) {
            console.error(`Error searching for SKU ${sku}:`, error);
            return null;
        }

        if (!data || data.length === 0) {
            // Try recursive search as fallback
            return await searchRecursively('stickers', sku, '');
        }

        // Look for exact match first
        const exactMatch = data.find((file: StorageFile) => file.name === `${sku}.pdf`);
        if (exactMatch) {
            return exactMatch.name;
        }

        // Look for path match
        const pathMatch = data.find((file: StorageFile) => file.name.endsWith(`/${sku}.pdf`));
        if (pathMatch) {
            return pathMatch.name;
        }

        // Look for partial match
        const partialMatch = data.find((file: StorageFile) =>
            file.name.includes(sku) && file.name.endsWith('.pdf')
        );
        if (partialMatch) {
            return partialMatch.name;
        }

        return null;
    } catch (error) {
        console.error(`Exception searching for SKU ${sku}:`, error);
        return null;
    }
}

/**
 * Recursive search through folders
 */
async function searchRecursively(bucket: string, sku: string, folder: string = ''): Promise<string | null> {
    try {
        const { data, error } = await getSupabaseServiceClient()
            .storage.from(bucket)
            .list(folder, {
                limit: 1000,
                sortBy: { column: 'name', order: 'asc' },
            });

        if (error || !data) {
            return null;
        }

        // Check files in current folder
        const pdfFile = data.find((item: StorageFile) => item.name === `${sku}.pdf`);
        if (pdfFile) {
            return folder ? `${folder}/${pdfFile.name}` : pdfFile.name;
        }

        // Search subfolders
        const subFolders = data.filter((item: StorageFile) => !item.name.includes('.') && item.name !== '.');
        for (const subFolder of subFolders) {
            const subPath = folder ? `${folder}/${subFolder.name}` : subFolder.name;
            const found = await searchRecursively(bucket, sku, subPath);
            if (found) {
                return found;
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Export declaration report to CSV format
 */
export function exportDeclarationReportToCSV(report: DeclarationReport): string {
    const headers = [
        'SKU',
        'Product Name',
        'Has Declaration',
        'Declaration Path',
        'Product ID',
        'Price (CHF)',
        'Stock Status',
        'Last Modified',
        'Error'
    ];

    const rows = report.products.map(product => [
        product.sku,
        `"${product.name.replace(/"/g, '""')}"`, // Escape quotes in product names
        product.hasDeclaration ? 'YES' : 'NO',
        product.declarationPath || '',
        product.productId.toString(),
        product.price,
        product.stockStatus,
        product.lastModified,
        product.error || ''
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    return csvContent;
}

/**
 * Generate summary statistics
 */
export function generateDeclarationSummary(report: DeclarationReport) {
    const summary = {
        overview: {
            totalProducts: report.totalProducts,
            withDeclarations: report.withDeclarations,
            missingDeclarations: report.missingDeclarations,
            completionPercentage: report.withDeclarationsPercentage
        },
        missingDeclarations: {
            count: report.summary.productsWithoutDeclarations.length,
            products: report.summary.productsWithoutDeclarations.map(p => ({
                sku: p.sku,
                name: p.name,
                price: p.price,
                stockStatus: p.stockStatus
            }))
        },
        availableDeclarations: {
            count: report.summary.productsWithDeclarations.length,
            products: report.summary.productsWithDeclarations.map(p => ({
                sku: p.sku,
                name: p.name,
                path: p.declarationPath
            }))
        },
        lastChecked: report.lastChecked
    };

    return summary;
} 