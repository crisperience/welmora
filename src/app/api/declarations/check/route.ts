import { getSupabaseServiceClient } from '@/lib/api/supabase/client';
import {
  checkAllProductDeclarations,
  exportDeclarationReportToCSV,
  generateDeclarationSummary,
} from '@/lib/services/checkDeclarations';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/declarations/check
 *
 * Comprehensive check of all products and their declaration status
 * Returns detailed report with statistics and missing declarations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json'; // json, csv, summary, debug
    const debug = searchParams.get('debug') === 'true';

    console.log('Starting declaration check API...');

    // Debug mode - list all files in stickers bucket
    if (format === 'debug' || debug) {
      console.log('Debug mode: Listing all files in stickers bucket...');

      try {
        // Get folder parameter for recursive exploration
        const folder = searchParams.get('folder') || '';

        const { data, error } = await getSupabaseServiceClient()
          .storage.from('stickers')
          .list(folder, {
            limit: 1000,
            sortBy: { column: 'name', order: 'asc' },
          });

        if (error) {
          console.error('Error listing stickers bucket:', error);
          return NextResponse.json({
            success: false,
            error: 'Failed to list stickers bucket',
            details: error,
          }, { status: 500 });
        }

        console.log(`Found ${data?.length || 0} items in stickers bucket${folder ? ` (folder: ${folder})` : ''}`);

        // Separate folders and files
        const folders = data?.filter(item => !item.name.includes('.') && item.name !== '.') || [];
        const files = data?.filter(item => item.name.includes('.')) || [];

        return NextResponse.json({
          success: true,
          debug: true,
          bucket: 'stickers',
          currentFolder: folder,
          totalItems: data?.length || 0,
          folders: folders.map(folder => folder.name),
          files: files.map(file => ({
            name: file.name,
            id: file.id,
            updated_at: file.updated_at,
            created_at: file.created_at,
            metadata: file.metadata,
          })),
          // Show first 20 files for readability
          sampleFiles: files.slice(0, 20).map(file => file.name),
        });
      } catch (debugError) {
        console.error('Debug error:', debugError);
        return NextResponse.json({
          success: false,
          error: 'Debug mode failed',
          details: debugError instanceof Error ? debugError.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    // Run comprehensive check
    const report = await checkAllProductDeclarations();

    // Return different formats based on request
    switch (format) {
      case 'csv':
        const csvContent = exportDeclarationReportToCSV(report);
        return new NextResponse(csvContent, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="declaration-report-${new Date().toISOString().split('T')[0]}.csv"`,
          },
        });

      case 'summary':
        const summary = generateDeclarationSummary(report);
        return NextResponse.json({
          success: true,
          data: summary,
        });

      case 'json':
      default:
        return NextResponse.json({
          success: true,
          data: report,
        });
    }
  } catch (error) {
    console.error('Error in declaration check API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/declarations/check
 *
 * Check specific products by SKU list
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skus } = body;

    if (!Array.isArray(skus) || skus.length === 0) {
      return NextResponse.json(
        { success: false, error: 'SKUs array is required' },
        { status: 400 }
      );
    }

    console.log(`Checking declarations for ${skus.length} specific SKUs...`);

    // For now, redirect to full check - could be optimized later
    const report = await checkAllProductDeclarations();

    // Filter results to only requested SKUs
    const filteredProducts = report.products.filter(product => skus.includes(product.sku));

    const filteredReport = {
      ...report,
      totalProducts: filteredProducts.length,
      withDeclarations: filteredProducts.filter(p => p.hasDeclaration).length,
      missingDeclarations: filteredProducts.filter(p => !p.hasDeclaration).length,
      products: filteredProducts,
      summary: {
        productsWithDeclarations: filteredProducts.filter(p => p.hasDeclaration),
        productsWithoutDeclarations: filteredProducts.filter(p => !p.hasDeclaration),
      },
    };

    filteredReport.withDeclarationsPercentage =
      filteredReport.totalProducts > 0
        ? Math.round((filteredReport.withDeclarations / filteredReport.totalProducts) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      data: filteredReport,
    });
  } catch (error) {
    console.error('Error in specific declaration check:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
