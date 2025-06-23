'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Calendar, PackageOpen, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const formatDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getShoppingOrdersDate = (selectedDate: string) => {
    // Shopping shows orders from the previous day
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getPackingOrdersDate = (selectedDate: string) => {
    // Packing shows orders from the previous day
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        <div className="max-w-2xl w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welmora Scanner</h1>
            <p className="text-gray-600">Barcode scanning for shopping and packing</p>
          </div>

          {/* Date Selection */}
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-6 w-6 text-gray-600" />
                  <span className="text-lg font-medium">Select Order Date</span>
                </div>

                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full px-6 py-4 text-xl border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm"
                />

                <p className="text-center text-gray-600 mt-4 text-lg">{formatDateForDisplay(selectedDate)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Main Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Shopping */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent
                className="p-8 text-center"
                onClick={() => router.push(`/shopping/${selectedDate}`)}
              >
                <div className="mb-4 flex justify-center">
                  <ShoppingCart className="h-16 w-16 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">SHOPPING</h2>
                <p className="text-sm text-gray-600">
                  Orders from {getShoppingOrdersDate(selectedDate)}
                </p>
              </CardContent>
            </Card>

            {/* Packing */}
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent
                className="p-8 text-center"
                onClick={() => router.push(`/packing/${selectedDate}`)}
              >
                <div className="mb-4 flex justify-center">
                  <PackageOpen className="h-16 w-16 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">PACKING</h2>
                <p className="text-sm text-gray-600">
                  Orders from {getPackingOrdersDate(selectedDate)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer - fixed at bottom */}
      <footer className="flex-shrink-0 p-4 text-center">
        <p className="text-xs text-gray-400">
          Developed by{' '}
          <a
            href="https://crisp.hr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            CRISP
          </a>
        </p>
      </footer>
    </div>
  );
}
