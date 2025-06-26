import { createMetroScraper } from './src/lib/scrapers/metro-scraper';

async function testMetroMainPage() {
  console.log('=== TESTING METRO MAIN PAGE ===');

  try {
    const scraper = createMetroScraper({
      email: 'info@welmora.com',
      password: '2pmLcOFF49z!8"',
    });

    // Access the scraper's browser pool to get a page directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (scraper as any).getBrowserPage();

    console.log('Got browser page, navigating to Metro main page...');

    await page.goto('https://produkte.metro.de/shop', {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    console.log('Page loaded, checking content...');

    const title = await page.title();
    const url = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText || 'NO BODY');
    const htmlLength = await page.evaluate(() => document.documentElement.outerHTML.length);

    console.log(`Title: "${title}"`);
    console.log(`URL: ${url}`);
    console.log(`HTML length: ${htmlLength}`);
    console.log(`Body text length: ${bodyText.length}`);
    console.log(`Body text preview: ${bodyText.substring(0, 200)}...`);

    // Check for specific elements
    const hasElements = await page.evaluate(() => {
      return {
        divs: document.querySelectorAll('div').length,
        spans: document.querySelectorAll('span').length,
        links: document.querySelectorAll('a').length,
        scripts: document.querySelectorAll('script').length,
      };
    });

    console.log('Element counts:', hasElements);

    await page.close();
  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

testMetroMainPage();
