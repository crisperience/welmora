'use client';

import { PackageOpen, Scale, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useDateContext } from './DateContext';

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedDate } = useDateContext();
  const t = useTranslations('navigation');

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const handleNavigation = (path: string) => {
    if (path === '/shopping') {
      router.push(`/shopping/${selectedDate}`);
    } else if (path === '/packing') {
      router.push(`/packing/${selectedDate}`);
    } else {
      router.push(path);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      {/* Main navigation content */}
      <div className="flex h-16">
        {/* Shopping Button - 33% */}
        <button
          onClick={() => handleNavigation('/shopping')}
          className={`flex-1 flex flex-col items-center justify-center transition-colors cursor-pointer active:scale-95 py-3 ${
            isActive('/shopping')
              ? 'bg-amber-50 text-amber-600 border-t-2 border-amber-600'
              : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'
          }`}
        >
          <ShoppingCart className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">{t('shopping')}</span>
        </button>

        {/* Packing Button - 33% */}
        <button
          onClick={() => handleNavigation('/packing')}
          className={`flex-1 flex flex-col items-center justify-center transition-colors cursor-pointer active:scale-95 py-3 ${
            isActive('/packing')
              ? 'bg-amber-50 text-amber-600 border-t-2 border-amber-600'
              : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'
          }`}
        >
          <PackageOpen className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">{t('packing')}</span>
        </button>

        {/* Products Button - 33% */}
        <button
          onClick={() => handleNavigation('/products')}
          className={`flex-1 flex flex-col items-center justify-center transition-colors cursor-pointer active:scale-95 py-3 ${
            isActive('/products')
              ? 'bg-amber-50 text-amber-600 border-t-2 border-amber-600'
              : 'text-gray-600 hover:bg-gray-50 active:bg-gray-100'
          }`}
        >
          <Scale className="h-5 w-5 mb-1" />
          <span className="text-xs font-medium">{t('products')}</span>
        </button>
      </div>

      {/* iOS Safe Area Bottom Padding */}
      <div className="h-safe-bottom bg-white"></div>
    </div>
  );
}
