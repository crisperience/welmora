# Vercel Deployment Configuration

## ✅ Build Issue Fixed

The Supabase build issue has been resolved with lazy client initialization. The application now builds successfully with the correct project configuration.

## 🔧 Environment Variables Required in Vercel

You need to set these environment variables in your Vercel project dashboard:

### ✅ Supabase Configuration (Already Set)

```
NEXT_PUBLIC_SUPABASE_URL=https://rsivfiahmmtujwdgsxzs.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaXZmaWFobW10dWp3ZGdzeHpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NjUzODEsImV4cCI6MjA2NjQ0MTM4MX0.JmKiX5qucJeTDB6X7GbdUGmw8TC1meDmZ1WpghnEFGs
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzaXZmaWFobW10dWp3ZGdzeHpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg2NTM4MSwiZXhwIjoyMDY2NDQxMzgxfQ.XpJg2pVg0_0juvwganuQXFv5gY7PxHJOawZ0pRUKFNg
```

### ✅ WooCommerce Configuration (Already Set)

```
WOOCOMMERCE_URL=https://welmora.ch
WOOCOMMERCE_CONSUMER_KEY=ck_6e1dee8290eebd95b2aa0c9bbccfb85795f44acd
WOOCOMMERCE_CONSUMER_SECRET=cs_2533616877753ac4cc89ab948af2faae20233635
```

### ❌ Email Configuration (NEEDS TO BE SET)

```
EMAIL_FROM=info@welmora.ch
EMAIL_TO=info@welmora.ch
SMTP_USER=info@welmora.ch
SMTP_PASS=YOUR_GMAIL_APP_PASSWORD_HERE
```

**Important:** You need to generate a Gmail App Password for `SMTP_PASS`:

1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Security → 2-Step Verification (must be enabled)
3. App passwords → Generate app password for "Mail"
4. Copy the generated password (format: `abcd efgh ijkl mnop`)
5. Use this as the `SMTP_PASS` value

### ✅ DM Scraper Configuration (Already Set)

```
DM_EMAIL=ivanmatanic7@gmail.com
DM_PASSWORD=Martin2025welmora
```

### ✅ App Configuration (Already Set)

```
APP_NAME=Welmora Scanner
APP_VERSION=2.0.0
NODE_ENV=production
NEXTAUTH_SECRET=welmora-scanner-secret-2024-production
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
```

## 🚀 How to Set Environment Variables in Vercel

1. **Go to your Vercel Dashboard**
2. **Select your project**
3. **Go to Settings → Environment Variables**
4. **Add each variable:**
   - Name: `VARIABLE_NAME`
   - Value: `variable_value`
   - Environment: `Production`, `Preview`, and `Development`

## 🔧 Changes Made

### Fixed Build Issues:

- ✅ Implemented lazy Supabase client initialization
- ✅ Updated to correct Supabase project ID (`rsivfiahmmtujwdgsxzs`)
- ✅ Added real API keys for Supabase
- ✅ Fixed React Hook dependency warning in inventory page
- ✅ Build now completes successfully

### Key Files Modified:

- `src/lib/supabase/client.ts` - Lazy initialization
- `.env.local` - Updated with correct Supabase config
- `.env.production` - Updated with correct Supabase config
- `src/app/inventory/page.tsx` - Fixed useEffect dependency

## 🧪 Verification

The build has been tested locally and passes successfully:

```bash
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages (20/20)
✓ Finalizing page optimization
```

## 🔗 Next Steps

1. **Set the missing email environment variables in Vercel**
2. **Generate Gmail App Password for SMTP_PASS**
3. **Update NEXTAUTH_URL to your actual Vercel domain**
4. **Deploy and test the webhook functionality**

## 🐛 Troubleshooting

If you encounter issues:

1. **Check Vercel Function Logs** for detailed error messages
2. **Verify all environment variables are set correctly**
3. **Test webhook endpoint:** `https://your-domain.vercel.app/api/webhooks/order-created`
4. **Test email functionality:** `https://your-domain.vercel.app/api/webhooks/test-order`

The application should now deploy successfully on Vercel! 🎉
