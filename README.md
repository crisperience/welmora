# Welmora

Private logistics management system with automated DM price scraping.

## Tech Stack

- Next.js 15, React 19, TypeScript
- Tailwind CSS, Radix UI
- WooCommerce REST API
- Puppeteer scraping
- GitHub Actions cron

## Setup

```bash
npm install
cp .env.example .env.local
# Configure WooCommerce credentials in .env.local
npm run dev
```

## Environment Variables

```bash
WOOCOMMERCE_URL=https://welmora.ch
WOOCOMMERCE_CONSUMER_KEY=ck_xxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxx
WOOCOMMERCE_HR_URL=https://welmora.hr
WOOCOMMERCE_HR_CONSUMER_KEY=ck_xxx
WOOCOMMERCE_HR_CONSUMER_SECRET=cs_xxx
```

## Features

- **Inventory** - Stock tracking
- **Orders** - Shopping/packing workflows
- **Price Scraping** - Automated DM price updates (Thursdays 00:00 UTC)
- **PWA** - Mobile app with camera scanning

## Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run lint         # Code linting
npm run test         # Run tests
```

## DM Scraper

Automated weekly scraper runs via GitHub Actions:

- **Schedule**: Every Thursday at 00:00 UTC
- **Workflow**: `.github/workflows/dm-scraper.yml`
- **Manual trigger**: GitHub Actions tab
- **Test endpoint**: `/api/test-dm-scraper`

## Deployment

Vercel auto-deploys from `main` branch with environment variables configured in dashboard.
