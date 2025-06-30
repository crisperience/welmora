# Cron Jobs - DM Scraper

## Overview

Automatski DM scraper koji se pokreće svaki četvrtak u 12:00 AM UTC (1:00 AM ili 2:00 AM u Hrvatskoj, ovisno o ljetnom/zimskom vremenu).

## Konfiguracija

### Cron Schedule

- **Izraz**: `0 0 * * 4`
- **Značenje**: Svaki četvrtak u ponoć (UTC)
- **Endpoint**: `/api/cron/dm-scraper`

### Vercel.json

```json
{
  "crons": [
    {
      "path": "/api/cron/dm-scraper",
      "schedule": "0 0 * * 4"
    }
  ]
}
```

## Funkcionalnost

Cron job automatski:

1. **Dohvaća sve WooCommerce proizvode** (paginirano)
2. **Ekstraktira GTIN-ove** iz SKU polja
3. **Pokreće DM scraper** za sve proizvode (batch processing)
4. **Ažurira WooCommerce meta podatke**:
   - `_dm_price` - cijena s DM-a
   - `_dm_url` - URL proizvoda na DM-u
   - `_dm_last_updated` - timestamp zadnjeg ažuriranja

## Praćenje i Logovi

### Gdje vidjeti logove

1. **Vercel Dashboard**:
   - Idite na https://vercel.com/dashboard
   - Odaberite projekt `welmora`
   - Kliknite na "Functions" tab
   - Odaberite `/api/cron/dm-scraper`
   - Vidjet ćete real-time logove

2. **Vercel CLI**:

   ```bash
   vercel logs
   ```

3. **Deployment Logs**:
   - Idite na "Deployments"
   - Kliknite na najnoviji deployment
   - "View Function Logs"

### Što logovi sadrže

```
🚀 DM Scraper Cron Job Started: 2024-01-25T00:00:00.000Z
📋 User Agent: vercel-cron/1.0
🔧 WooCommerce Config Check: { url: '...', hasKey: true, hasSecret: true }
📦 Step 1: Fetching all WooCommerce products...
📄 Fetching page 1 of products...
✅ Found 150 total products
🔍 Step 2: Processing 145 GTINs for DM scraping
📊 Products without SKU: 5
🕷️ Step 3: Starting DM scraper batch process...
✅ DM scraping completed. Got 145 results
📈 Scraping Stats: {
  "totalProcessed": 145,
  "foundPrices": 87,
  "foundUrls": 92,
  "errors": 53,
  "successRate": "60.0%"
}
💾 Step 4: Updating WooCommerce products with DM data...
🔄 Updating: Product Name (1234567890123) - €3.99
🎉 DM Scraper Cron Job Completed Successfully!
📊 Final Summary: {
  "success": true,
  "timestamp": "2024-01-25T00:00:00.000Z",
  "duration": "245s",
  "stats": {
    "totalProducts": 150,
    "processedGtins": 145,
    "scrapingResults": {
      "foundPrices": 87,
      "foundUrls": 92,
      "errors": 53,
      "successRate": "60.0%"
    },
    "wooCommerceUpdates": {
      "updated": 87,
      "skipped": 58,
      "errors": 0
    }
  }
}
```

## Sigurnost

- **User Agent provjera**: Endpoint prima samo zahtjeve s `vercel-cron/1.0` user agent
- **Unauthorized pristup**: Vraća 401 status za neovlaštene zahtjeve

## Testiranje

### Lokalno testiranje

```bash
# Pozovite endpoint direktno (neće proći user agent provjeru)
curl http://localhost:3000/api/cron/dm-scraper
```

### Produkcijski test

Nakon deploy-a možete testirati pozivom:

```bash
curl https://your-domain.vercel.app/api/cron/dm-scraper \
  -H "User-Agent: vercel-cron/1.0"
```

## Troubleshooting

### Česti problemi

1. **Timeout greška**:
   - Vercel funkcije imaju 10s timeout na Hobby planu
   - Na Pro planu mogu biti duže (do 5 min)

2. **Memory limit**:
   - Puppeteer može koristiti puno memorije
   - Batch processing je optimiziran za kontrolu memorije

3. **Rate limiting**:
   - DM može blokirati previše zahtjeva
   - Scraper ima ugrađene delay-ove između batch-ova

### Monitoring

Pratite:

- **Success rate**: Postotak uspješno scraped proizvoda
- **Duration**: Vrijeme izvršavanja
- **Errors**: Broj grešaka u scraping-u ili ažuriranju

## Deployment

Nakon promjena u kodu:

```bash
# Build i deploy
npm run build
git add .
git commit -m "feat: update dm scraper cron job"
git push origin main
```

Vercel će automatski deploy-ati i aktivirati cron job.
