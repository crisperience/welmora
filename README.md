# Welmora Scanner

WooCommerce inventory management system for scanning and packing orders.

## Quick Setup

1. **Install dependencies**

```bash
pnpm install
```

2. **Environment setup**
   Create `.env.local`:

```env
# WooCommerce Configuration
WOOCOMMERCE_URL=https://your-store.com/
WOOCOMMERCE_CONSUMER_KEY=your-consumer-key
WOOCOMMERCE_CONSUMER_SECRET=your-consumer-secret
```

3. **Start development**

```bash
pnpm dev
```

4. **Build for production**

```bash
pnpm build
pnpm start
```

## Usage

- **Shopping**: Scan/check products needed for orders
- **Packing**: Scan products into packages and mark orders complete
- **Date Selection**: Pick date to load orders from that specific day

## Scripts

- `pnpm dev` - Development server
- `pnpm build` - Production build
- `pnpm test` - Run tests
- `pnpm lint` - Lint code
- `pnpm format` - Format code
