import { createMetroScraper } from './src/lib/scrapers/metro-scraper';

async function testMetro() {
  console.log('=== METRO SCRAPER SIMPLE TEST ===');

  try {
    const scraper = createMetroScraper({
      email: 'info@welmora.com',
      password: '2pmLcOFF49z!8"',
    });

    console.log('Scraper created, starting test...');

    // Set shorter timeout for debugging
    const result = await Promise.race([
      scraper.scrapeProduct('7702018070794'),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Test timeout after 30 seconds')), 30000)
      ),
    ]);

    console.log('=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('=== ERROR ===');
    console.error(error);
  }

  process.exit(0);
}

testMetro();
