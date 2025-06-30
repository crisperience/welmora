import AuthGuard from '@/components/auth/AuthGuard';
import { AuthProvider } from '@/components/auth/AuthProvider';
import BottomNavigation from '@/components/shared/BottomNavigation';
import { DateProvider } from '@/components/shared/DateContext';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import '@/styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Welmora',
  description: 'Welmora - Upravljanje zalihama, obradu narudžbi i usporedbu cijena',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Welmora',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Welmora',
    title: 'Welmora',
    description: 'Welmora - Upravljanje zalihama, obradu narudžbi i usporedbu cijena',
  },
  icons: {
    icon: '/Favicon Original.ico',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Welmora" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-touch-fullscreen" content="yes" />
        {/* Camera permissions for PWA */}
        <meta name="permissions-policy" content="camera=*, microphone=(), geolocation=()" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  // In development, disable service worker to avoid caching issues
                  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    console.log('Development mode: Service Worker disabled to prevent caching issues');
                    
                    // Clear all existing caches
                    caches.keys().then(function(cacheNames) {
                      return Promise.all(
                        cacheNames.map(function(cacheName) {
                          console.log('Clearing cache:', cacheName);
                          return caches.delete(cacheName);
                        })
                      );
                    }).then(function() {
                      console.log('All caches cleared for development');
                    });
                    
                    // Unregister any existing service workers
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      for (let registration of registrations) {
                        registration.unregister();
                        console.log('Unregistered service worker:', registration.scope);
                      }
                    });
                    
                    return; // Exit early in development
                  }
                  
                  // Only register service worker in production
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('ServiceWorker registration successful with scope: ', registration.scope);
                    })
                    .catch(function(err) {
                      console.log('ServiceWorker registration failed: ', err);
                    });
                });
              }
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased safe-area-insets`}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <AuthGuard>
              <div className="flex flex-col h-screen">
                <DateProvider>
                  <div className="absolute top-4 left-4 z-50 safe-area-top">
                    <LanguageSwitcher />
                  </div>
                  <main className="flex-1 pb-24 safe-area-bottom">{children}</main>
                  <BottomNavigation />
                </DateProvider>
              </div>
            </AuthGuard>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
