'use client';

import { PackageOpen, Scale, ShoppingCart } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useDateContext } from './DateContext';

export default function BottomNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const { selectedDate } = useDateContext();

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  const handleNavigation = (path: string) => {
    if (path === '/shopping') {
      // Navigate to the currently selected date's shopping page
      router.push(`/shopping/${selectedDate}`);
    } else if (path === '/packing') {
      // Navigate to the currently selected date's packing page
      router.push(`/packing/${selectedDate}`);
    } else {
      router.push(path);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex h-16">
        {/* Shopping Button - 33% */}
        <button
          onClick={() => handleNavigation('/shopping')}
          className={`flex-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isActive('/shopping')
              ? 'bg-blue-50 text-blue-600 border-t-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <ShoppingCart className="h-6 w-6 mb-1" />
          <span className="text-xs font-medium">Shopping</span>
        </button>

        {/* Packing Button - 33% */}
        <button
          onClick={() => handleNavigation('/packing')}
          className={`flex-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isActive('/packing')
              ? 'bg-blue-50 text-blue-600 border-t-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <PackageOpen className="h-6 w-6 mb-1" />
          <span className="text-xs font-medium">Packing</span>
        </button>

        {/* Products Button - 33% */}
        <button
          onClick={() => handleNavigation('/products')}
          className={`flex-1 flex flex-col items-center justify-center transition-colors cursor-pointer ${
            isActive('/products')
              ? 'bg-blue-50 text-blue-600 border-t-2 border-blue-600'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Scale className="h-6 w-6 mb-1" />
          <span className="text-xs font-medium">Products</span>
        </button>
      </div>
    </div>
  );
}
