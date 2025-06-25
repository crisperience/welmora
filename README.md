# Welmora

A comprehensive logistics management system featuring inventory management, order processing, and automated price comparison with major retailers.

## 🚀 Features

- **📦 Inventory Management** - Track product stock levels and locations
- **🛒 Order Management** - Shopping and packing workflows with date-based organization
- **📊 Price Comparison** - Automated scraping from DM and Müller retailers
- **📱 PWA Support** - Install as mobile app with camera scanning
- **🔄 Automated Updates** - Weekly price and stock updates via cron jobs
- **📈 Export Capabilities** - CSV and CSV export for data analysis

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, Radix UI Components
- **E-commerce**: WooCommerce REST API
- **Scraping**: Puppeteer with BrightData integration
- **Deployment**: Vercel-ready configuration

## 📋 Prerequisites

- Node.js 18+
- npm or pnpm
- WooCommerce store with REST API access
- DM and Müller account credentials for scraping

## 🔧 Environment Variables

Create a `.env.local` file with the following variables:

```bash
# WooCommerce Configuration
WOOCOMMERCE_URL=https://your-store.com
WOOCOMMERCE_CONSUMER_KEY=your_consumer_key
WOOCOMMERCE_CONSUMER_SECRET=your_consumer_secret

# DM Scraper Configuration
DM_EMAIL=your_dm_email@example.com
DM_PASSWORD=your_dm_password
DM_STORE_ADDRESS=your_store_address

# BrightData Configuration (Optional)
BRIGHTDATA_USERNAME=your_brightdata_username
BRIGHTDATA_PASSWORD=your_brightdata_password
```

## 🚀 Installation & Setup

1. **Clone and Install**

   ```bash
   git clone <repository-url>
   cd welmora
   npm install
   ```

2. **Configure Environment**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

3. **Run Development Server**

   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## ⏰ Weekly Scraper Setup

The system includes an automated weekly scraper that runs every Thursday at midnight (00:00) to update product prices and stock levels.

### Manual Setup

1. **Create Logs Directory**

   ```bash
   mkdir -p logs
   ```

2. **Set Up Cron Job**

   ```bash
   # Edit your crontab
   crontab -e

   # Add this line for Thursday midnight updates:
   0 0 * * 4 cd /path/to/welmora && npm run weekly-update >> /path/to/welmora/logs/weekly-update.log 2>&1
   ```

3. **Test the Scraper**
   - Go to Products page
   - Click "Test Scraper" to verify configuration
   - Click "Run Update" for manual execution

### Automated Setup Script

```bash
# Make the setup script executable
chmod +x setup-cron.sh

# Run the setup
./setup-cron.sh
```

## 📱 PWA Installation

1. Open the app in Chrome/Safari
2. Click "Add to Home Screen" or "Install App"
3. The app will work offline and have native app-like features

## 🔍 API Endpoints

### Scraper Management

- `GET /api/scrapers/test` - Test scraper configuration
- `POST /api/scrapers/weekly-update` - Trigger manual weekly update

### Order Management

- `GET /api/orders/counts` - Get order counts by date
- `GET /api/shopping/[date]` - Get shopping orders for date
- `GET /api/packing/[date]` - Get packing orders for date

### Product Management

- `GET /api/products/compare` - Get product comparison data
- `GET /api/inventory` - Get inventory data

## 📊 Data Flow

1. **Weekly Update Process** (Thursday 00:00):
   - Scrapes DM and Müller for all products
   - Updates WooCommerce meta fields with scraped data
   - Logs results to `logs/weekly-update.log`

2. **Real-time Data**:
   - Products page shows live comparison
   - Shopping/Packing pages show current orders
   - Inventory reflects real-time stock levels

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch
```

## 📦 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Manual Deployment

```bash
npm run build
npm start
```

## 🔧 Development

### Code Quality

```bash
# Format code
npm run format

# Lint code
npm run lint

# Type check
npm run type-check
```

### Adding New Features

1. Create feature branch
2. Implement changes
3. Add tests
4. Update documentation
5. Submit pull request

## 📈 Monitoring

### Log Files

- `logs/weekly-update.log` - Weekly scraper execution logs
- `logs/error.log` - Error logs (if configured)

### Health Checks

- Visit `/api/scrapers/test` to check scraper health
- Monitor WooCommerce API connectivity
- Check BrightData quota usage

## 🚨 Troubleshooting

### Common Issues

1. **Scraper Fails to Login**
   - Verify DM credentials in `.env.local`
   - Check if DM has changed their login process
   - Try manual login test

2. **WooCommerce API Errors**
   - Verify API credentials
   - Check API permissions
   - Ensure store is accessible

3. **Cron Job Not Running**
   - Check crontab syntax
   - Verify file paths
   - Check system timezone

### Debug Mode

```bash
# Enable debug logging
DEBUG=welmora:* npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## 📄 License

This project is proprietary software for Welmora. All rights reserved.

## 📞 Support

For technical support or questions:

- Check the troubleshooting section
- Review logs in `logs/` directory
- Contact the development team

---

**Last Updated**: December 2024  
**Version**: 0.1.0  
**Status**: Production Ready
