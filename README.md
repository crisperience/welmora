# 🚀 Welmora Scanner v2

Advanced WooCommerce Inventory Management System built with Next.js, Supabase, and WooCommerce REST API.

## 📋 Project Overview

Welmora Scanner v2 je moderna aplikacija za upravljanje inventarom koja integrira WooCommerce s Supabase bazom podataka za poboljšano praćenje zaliha, analitiku kupaca i real-time sinkronizaciju.

## 🏗️ Tech Stack

- **Frontend**: Next.js 15 with App Router, React 19, TypeScript
- **Backend**: Next.js API Routes + Supabase Edge Functions
- **Database**: Supabase (PostgreSQL) with complete schema
- **E-commerce**: WooCommerce REST API integration
- **UI**: Tailwind CSS + Radix UI components
- **State Management**: Zustand
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime subscriptions

## 🎯 Core Features

### ✅ Currently Implemented

- [x] Supabase project setup with complete database schema
- [x] WooCommerce API client integration
- [x] Modern dashboard UI with Tailwind CSS
- [x] Connection testing page
- [x] TypeScript types for all entities
- [x] Environment configuration
- [x] Vercel deployment setup

### 🚧 In Development

- [ ] Product synchronization (WooCommerce ↔ Supabase)
- [ ] Order management system
- [ ] Customer analytics dashboard
- [ ] Barcode/QR scanner functionality
- [ ] Inventory tracking and alerts
- [ ] Real-time notifications

### 📅 Planned Features

- [ ] Mobile PWA support
- [ ] Advanced reporting and analytics
- [ ] Multi-user role management
- [ ] Automated sync scheduling
- [ ] API webhooks for real-time updates

## 🗂️ Database Schema

Complete database schema je implementirana u Supabase s sljedećim tablicama:

### Core Tables

- **products** - Proizvodi sinkronizirani s WooCommerce
- **customers** - Kupci s proširenim profilima
- **orders** - Narudžbe s detaljnim praćenjem
- **order_items** - Stavke narudžbi
- **categories** - Kategorije proizvoda

### Scanner & Inventory

- **scanner_sessions** - Sesije skeniranja
- **scanned_items** - Skenirani proizvodi
- **inventory_transactions** - Log svih promjena zaliha

### System

- **user_profiles** - Prošireni korisnički profili
- **sync_logs** - Logovi sinkronizacije
- **categories** - Kategorije proizvoda

### Functions & Triggers

- `get_low_stock_products()` - Dohvaćanje proizvoda s niskim zalihama
- `update_product_stock()` - Ažuriranje zaliha s logiranjem
- Automatski triggeri za `updated_at` polja
- Row Level Security (RLS) politike

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm (preporučeno)
- Supabase account
- WooCommerce store s REST API pristupom

### Installation

1. **Clone repository**

```bash
git clone <repository-url>
cd welmora-scanner-v2
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Environment setup**
   Kopiraj `.env.local.example` u `.env.local` i popuni:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# WooCommerce Configuration
WOOCOMMERCE_URL=https://your-store.com/
WOOCOMMERCE_CONSUMER_KEY=your-consumer-key
WOOCOMMERCE_CONSUMER_SECRET=your-consumer-secret

# Next.js Configuration
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
```

4. **Database setup**
   Baza je već kreirana i deployirana na Supabase. Schema uključuje sve potrebne tablice, funkcije i sigurnosne politike.

5. **Start development server**

```bash
pnpm run dev
```

6. **Test connections**
   Idi na `http://localhost:3000/test` za testiranje konekcija.

## 📁 Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── test/          # Connection testing endpoint
│   ├── test/              # Connection testing page
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx           # Main dashboard
├── components/
│   └── ui/                # Radix UI components
├── lib/
│   ├── supabase/          # Supabase client & utilities
│   ├── woocommerce/       # WooCommerce API client
│   └── utils.ts
├── types/
│   ├── supabase.ts        # Database types
│   └── woocommerce-api.d.ts # WooCommerce API types
└── constants/
```

## 🔧 API Endpoints

### Current Endpoints

- `GET /api/test` - Test Supabase and WooCommerce connections

### Planned Endpoints

- `GET /api/products` - Fetch products from WooCommerce/Supabase
- `POST /api/sync/products` - Sync products between systems
- `GET /api/orders` - Fetch orders
- `POST /api/scanner/session` - Create scanning session
- `POST /api/inventory/update` - Update inventory levels

## 🌐 Deployment

### Vercel (Current)

Aplikacija je deployirana na Vercel s automatskim CI/CD:

- Production: `https://welmora-scanner-v2.vercel.app`
- Environment varijable konfigurirane
- Automatic deployments iz main branch

### Environment Variables

Sve potrebne environment varijable su konfigurirane:

- Supabase connection strings
- WooCommerce API credentials
- Next.js configuration

## 🔐 Security Features

- **Row Level Security (RLS)** na svim Supabase tablicama
- **API Key Management** za WooCommerce integraciju
- **Input Validation** koristeći Zod schemas
- **HTTPS Enforcement** za sve komunikacije
- **Role-based Access Control** za korisničke dozvole

## 📊 Database Features

### Implemented

- Complete schema s indeksima za performanse
- Automatski timestamping s triggerima
- Foreign key constraints za integritet podataka
- JSON polja za fleksibilne WooCommerce podatke
- Custom functions za business logiku

### Row Level Security Policies

- Users can only access their own scanner sessions
- Products, orders, customers accessible to authenticated users
- Admin-only access za sync logs
- User profiles self-managed

## 🔄 Sync Strategy

### Planned Implementation

1. **Initial Sync** - Bulk import postojećih podataka
2. **Incremental Sync** - Redovito ažuriranje promjena
3. **Real-time Webhooks** - Instant updates za kritične promjene
4. **Conflict Resolution** - Handling competing updates
5. **Sync Monitoring** - Logging i error handling

## 🧪 Testing

### Current

- Connection testing page (`/test`)
- Build verification
- TypeScript type checking

### Planned

- Unit tests za business logiku
- Integration tests za API endpoints
- E2E tests za user workflows
- Performance testing za sync operations

## 📈 Performance Optimizations

- Database indexing na često korištenim poljima
- Next.js Image optimization
- Code splitting za bolje bundle sizes
- Caching strategije za API responses
- CDN integration za statičke resurse

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 Development Roadmap

### Phase 1: Foundation ✅

- [x] Project setup i konfiguracija
- [x] Database schema implementacija
- [x] Basic UI komponente
- [x] Connection testing

### Phase 2: Core Features (Current)

- [ ] Product sync implementacija
- [ ] Order management
- [ ] Basic scanner functionality
- [ ] User authentication

### Phase 3: Advanced Features

- [ ] Real-time sync
- [ ] Advanced analytics
- [ ] Mobile PWA
- [ ] Multi-location support

### Phase 4: Production

- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation
- [ ] User training

## 📞 Support

Za pitanja i podršku:

- Email: martin@crisp.hr
- GitHub Issues: [Create Issue]

## 📄 License

Private project - Welmora © 2024

---

**Welmora Scanner v2** - Napredni sustav za upravljanje inventarom s WooCommerce integrацијом.
