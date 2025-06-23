'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

  const setToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welmora Scanner</h1>
        </div>

        {/* Date Selection */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-gray-600" />
                <span className="font-medium">Select Date</span>
                {isToday && (
                  <Badge variant="default" className="bg-green-600">
                    Today
                  </Badge>
                )}
              </div>

              <div className="flex gap-3 items-center">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Button
                  onClick={setToday}
                  variant={isToday ? 'default' : 'outline'}
                  className="px-4 py-2"
                >
                  Today
                </Button>
              </div>

              <p className="text-sm text-gray-600">{formatDateForDisplay(selectedDate)}</p>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
