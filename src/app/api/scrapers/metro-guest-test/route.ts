import { createMetroGuestScraper } from '@/lib/scrapers/metro-scraper-guest';
import { NextRequest, NextResponse } from 'next/server';

// Capture console logs
const capturedLogs: string[] = [];
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

function startLogCapture() {
  capturedLogs.length = 0; // Clear previous logs

  console.log = (...args) => {
    const message = args
      .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
      .join(' ');
    capturedLogs.push(`LOG: ${message}`);
    originalConsoleLog(...args);
  };

  console.error = (...args) => {
    const message = args
      .map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
      .join(' ');
    capturedLogs.push(`ERROR: ${message}`);
    originalConsoleError(...args);
  };
}

function stopLogCapture() {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
}

export async function POST(request: NextRequest) {
  startLogCapture();

  try {
    const body = await request.json();
    const { gtin } = body;

    if (!gtin) {
      return NextResponse.json({ error: 'GTIN is required' }, { status: 400 });
    }

    console.log(`Testing Metro Guest scraper for GTIN: ${gtin}`);

    const scraper = createMetroGuestScraper();
    const result = await scraper.scrapeProduct(gtin);

    console.log(`Metro Guest test result for ${gtin}:`, result);

    stopLogCapture();

    return NextResponse.json({
      success: true,
      gtin,
      result,
      debugLogs: capturedLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Metro Guest test error:', error);
    stopLogCapture();

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        debugLogs: capturedLogs,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Add a GET endpoint for manual testing
export async function GET(request: NextRequest) {
  startLogCapture();

  try {
    const { searchParams } = new URL(request.url);
    const gtin = searchParams.get('gtin') || '7702018070794'; // Test with the original GTIN

    console.log(`GET Metro Guest test for GTIN: ${gtin}`);

    const scraper = createMetroGuestScraper();
    const result = await scraper.scrapeProduct(gtin);

    console.log(`Metro Guest GET test result for ${gtin}:`, result);

    stopLogCapture();

    return NextResponse.json({
      success: true,
      gtin,
      result,
      debugLogs: capturedLogs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Metro Guest GET test error:', error);
    stopLogCapture();

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        debugLogs: capturedLogs,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
