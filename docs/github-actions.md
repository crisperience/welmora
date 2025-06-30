# GitHub Actions - DM Scraper

## Overview

Automatski DM scraper koji se pokreće svaki četvrtak u 12:00 AM UTC (1:00 AM ili 2:00 AM u Hrvatskoj, ovisno o ljetnom/zimskom vremenu) putem GitHub Actions.

## Zašto GitHub Actions umjesto Vercel Cron Jobs?

**Vercel Hobby Plan ograničenja:**

- ⏰ **10s timeout** - DM scraper s Puppeteer-om treba 3-5 minuta
- 💾 **1024MB memory** - Puppeteer može koristiti više
- 🚫 **Nema dugotrajan proces** za batch scraping

**GitHub Actions prednosti:**

- ⏰ **6 sati timeout** po job-u
- 💾 **7GB RAM** dostupno
- 🆓 **2000 minuta mjesečno** besplatno
- 📅 **Isti cron syntax** kao Vercel

## Konfiguracija

### GitHub Actions Workflow

- **Datoteka**: `.github/workflows/dm-scraper.yml`
- **Cron izraz**: `0 0 * * 4` (svaki četvrtak u ponoć UTC)
- **Script**: `scripts/dm-scraper.mjs`

### Workflow Schedule

```yaml
on:
  schedule:
    - cron: '0 0 * * 4' # Every Thursday at 00:00 UTC
  workflow_dispatch: # Allow manual trigger
```

## Funkcionalnost

GitHub Actions job automatski:

1. **Checkout koda** iz glavne grane
2. **Postavlja Node.js 20** okruženje
3. **Instalira dependencies** (`npm ci`)
4. **Instalira Chrome dependencies** za Puppeteer
5. **Pokreće DM scraper script** s environment varijablama
6. **Uploadira logove** kao artifacts

## Environment Variables (GitHub Secrets)

Trebate postaviti sljedeće secrets u GitHub repository:

### WooCommerce Configuration

```
WOOCOMMERCE_URL=https://welmora.ch
WOOCOMMERCE_CONSUMER_KEY=your_consumer_key
WOOCOMMERCE_CONSUMER_SECRET=your_consumer_secret
```

### WooCommerce HR Configuration (opcionalno)

```
WOOCOMMERCE_HR_URL=https://welmora.hr
WOOCOMMERCE_HR_CONSUMER_KEY=your_hr_consumer_key
WOOCOMMERCE_HR_CONSUMER_SECRET=your_hr_consumer_secret
```

### DM Scraper Configuration (opcionalno)

```
DM_EMAIL=your_dm_email@example.com
DM_PASSWORD=your_dm_password
DM_STORE_ADDRESS=your_store_address
```

### BrightData Configuration (opcionalno)

```
BRIGHTDATA_USERNAME=your_brightdata_username
BRIGHTDATA_PASSWORD=your_brightdata_password
```

## Postavljanje GitHub Secrets

1. Idite na vaš GitHub repository
2. Kliknite na **Settings** tab
3. U lijevom meniju kliknite **Secrets and variables** → **Actions**
4. Kliknite **New repository secret**
5. Dodajte svaki secret pojedinačno

## Praćenje i Logovi

### Gdje vidjeti logove

1. **GitHub Actions Tab**:
   - Idite na vaš repository na GitHub
   - Kliknite na "Actions" tab
   - Odaberite "Weekly DM Scraper" workflow
   - Kliknite na najnoviji run

2. **Job Logs**:
   - Kliknite na "scrape-dm-prices" job
   - Vidjet ćete step-by-step logove

3. **Artifacts**:
   - Na dnu job page-a vidjet ćete "Artifacts" sekciju
   - Downloadajte `dm-scraper-logs-{run_number}.zip`

### Što logovi sadrže

```
🚀 DM Scraper GitHub Actions Job Started: 2024-01-25T00:00:00.000Z
📋 Environment: {
  "nodeVersion": "v20.x.x",
  "platform": "linux",
  "arch": "x64",
  "hasWooCommerceUrl": true,
  "hasWooCommerceKey": true,
  "hasWooCommerceSecret": true
}
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
🎉 DM Scraper GitHub Actions Job Completed Successfully!
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
🧹 Cleanup completed
```

## Testiranje

### Manualno pokretanje

1. Idite na GitHub repository
2. Kliknite na "Actions" tab
3. Odaberite "Weekly DM Scraper" workflow
4. Kliknite "Run workflow" button
5. Odaberite branch (obično `main`)
6. Kliknite "Run workflow"

### Lokalno testiranje

```bash
# Postavite environment varijable u .env.local
node scripts/dm-scraper.mjs
```

## Troubleshooting

### Česti problemi

1. **Missing secrets**:
   - Provjerite jesu li svi potrebni secrets postavljeni
   - Imena secrets moraju biti točno kao u workflow datoteci

2. **Puppeteer greške**:
   - Chrome dependencies se automatski instaliraju
   - Linux okruženje podržava headless Chrome

3. **WooCommerce API greške**:
   - Provjerite API credentials
   - Provjerite API permissions

4. **Timeout greške**:
   - Job ima 6 sati timeout
   - Ako se dogodi timeout, možda imate previše proizvoda

### Debug informacije

Logovi sadrže detaljne debug informacije:

- Environment provjere
- WooCommerce konfiguraciju
- Broj proizvoda po stranici
- Scraping statistike
- Update rezultate

## Monitoring

### Što pratiti

- **Success rate**: Postotak uspješno scraped proizvoda
- **Duration**: Vrijeme izvršavanja (obično 3-5 minuta)
- **Errors**: Broj grešaka u scraping-u ili ažuriranju
- **Updated products**: Broj ažuriranih proizvoda

### Notifikacije

GitHub Actions može poslati email notifikacije:

1. Idite na GitHub Settings → Notifications
2. Omogućite "Actions" notifikacije
3. Dobit ćete email ako job ne uspije

## Deployment

Workflow se automatski aktivira kada push-ate kod na `main` branch:

```bash
git add .
git commit -m "feat: update dm scraper configuration"
git push origin main
```

## Maintenance

### Ažuriranje schedule-a

Promijenite cron izraz u `.github/workflows/dm-scraper.yml`:

```yaml
schedule:
  - cron: '0 2 * * 1' # Ponedjeljak u 2:00 AM UTC
```

### Dodavanje novih features

1. Ažurirajte `scripts/dm-scraper.mjs`
2. Testirajte lokalno
3. Push na main branch
4. Workflow će se automatski ažurirati

## Costs

GitHub Actions je besplatan za javne repository-je i ima 2000 minuta mjesečno za privatne. DM scraper troši ~5 minuta po run-u, što znači 400 run-ova mjesečno (više nego dovoljno za weekly schedule).
