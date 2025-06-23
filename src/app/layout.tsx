import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Welmora Scanner',
  description: 'WooCommerce inventory scanner for efficient warehouse management',
  icons: {
    icon: '/Favicon Original.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-gray-50 py-4 mt-8">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-gray-600">
              Developed by{' '}
              <a
                href="https://crisp.hr"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                CRISP
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
