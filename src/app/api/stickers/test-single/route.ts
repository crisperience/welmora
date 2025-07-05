import { getSupabaseServiceClient } from '@/lib/api/supabase/client';
import { NextRequest, NextResponse } from 'next/server';



/**
 * GET /api/stickers/test-single?sku=8006540944417
 *
 * Test endpoint to debug a single SKU search
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sku = searchParams.get('sku');

        if (!sku) {
            return NextResponse.json({ error: 'SKU parameter is required' }, { status: 400 });
        }

        console.log(`Testing search for SKU: ${sku}`);

        const results = {
            sku,
            searches: [] as Array<{
                method: string;
                success: boolean;
                results: unknown[];
                error?: string;
            }>,
        };

        // Test 1: Direct search
        try {
            const { data, error } = await getSupabaseServiceClient()
                .storage.from('stickers')
                .list('', {
                    limit: 2000,
                    search: sku,
                    sortBy: { column: 'name', order: 'asc' },
                });

            results.searches.push({
                method: 'Direct search',
                success: !error,
                results: data || [],
                error: error?.message,
            });
        } catch (error) {
            results.searches.push({
                method: 'Direct search',
                success: false,
                results: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        // Test 2: Search in HR folder
        try {
            const { data, error } = await getSupabaseServiceClient()
                .storage.from('stickers')
                .list('HR', {
                    limit: 1000,
                    sortBy: { column: 'name', order: 'asc' },
                });

            results.searches.push({
                method: 'List HR folder',
                success: !error,
                results: data || [],
                error: error?.message,
            });
        } catch (error) {
            results.searches.push({
                method: 'List HR folder',
                success: false,
                results: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        // Test 3: Search in HR/Mr.Proper folder - with detailed file listing
        try {
            const { data, error } = await getSupabaseServiceClient()
                .storage.from('stickers')
                .list('HR/Mr.Proper', {
                    limit: 1000,
                    sortBy: { column: 'name', order: 'asc' },
                });

            // Show all files in detail
            const detailedResults = data?.map(file => ({
                name: file.name,
                isTargetFile: file.name === `${sku}.pdf`,
                matchesPattern: file.name.includes(sku),
                isPdf: file.name.endsWith('.pdf'),
            })) || [];

            results.searches.push({
                method: 'List HR/Mr.Proper folder (detailed)',
                success: !error,
                results: detailedResults,
                error: error?.message,
            });
        } catch (error) {
            results.searches.push({
                method: 'List HR/Mr.Proper folder (detailed)',
                success: false,
                results: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        // Test 4: Check if exact file exists
        try {
            const { data, error } = await getSupabaseServiceClient()
                .storage.from('stickers')
                .download(`HR/Mr.Proper/${sku}.pdf`);

            results.searches.push({
                method: 'Direct file download test',
                success: !error && !!data,
                results: data ? ['File exists'] : [],
                error: error?.message,
            });
        } catch (error) {
            results.searches.push({
                method: 'Direct file download test',
                success: false,
                results: [],
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }

        // Test 5: Try other possible brand folders
        const possibleBrands = ['Ariel', 'Pampers', 'Fairy', 'Lenor', 'Persil', 'Finish', 'Calgon', 'Somat', 'Pril'];

        for (const brand of possibleBrands) {
            try {
                const { data, error } = await getSupabaseServiceClient()
                    .storage.from('stickers')
                    .download(`HR/${brand}/${sku}.pdf`);

                if (!error && data) {
                    results.searches.push({
                        method: `Found in HR/${brand}`,
                        success: true,
                        results: ['File exists'],
                        error: undefined,
                    });
                    break; // Stop searching once found
                }
            } catch {
                // Ignore errors for this test - we're just checking different locations
            }
        }

        return NextResponse.json({
            success: true,
            ...results,
        });
    } catch (error) {
        console.error('Error in test single SKU API:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to test SKU',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
} 