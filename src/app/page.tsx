'use client';

import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PackageOpen, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [orderCounts, setOrderCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  const formatDateForUrl = (date: Date) => {
    // Use local date without timezone conversion to match API expectations
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString('hr-HR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Load order counts for calendar
  const loadOrderCounts = async () => {
    try {
      // Add cache busting parameter
      const response = await fetch(`/api/orders/counts?t=${Date.now()}`);
      if (response.ok) {
        const counts = await response.json();
        setOrderCounts(counts);
      }
    } catch (error) {
      console.error('Failed to load order counts:', error);
    }
  };

  // Load saved selected date and order counts
  useEffect(() => {
    // Load saved date from localStorage
    const savedDate = localStorage.getItem('welmora-selected-date');
    if (savedDate) {
      try {
        setSelectedDate(new Date(savedDate));
      } catch (e) {
        console.error('Invalid saved date:', e);
        localStorage.removeItem('welmora-selected-date');
      }
    }

    loadOrderCounts();
  }, []);

  // Reload order counts when component mounts or date changes
  useEffect(() => {
    loadOrderCounts();
  }, [selectedDate]);

  // Save selected date to localStorage whenever it changes
  useEffect(() => {
    if (selectedDate) {
      localStorage.setItem('welmora-selected-date', selectedDate.toISOString());
    }
  }, [selectedDate]);

  const triggerHapticFeedback = (type: 'light' | 'medium' = 'light') => {
    // Web Vibration API for haptic feedback
    if ('vibrator' in navigator || 'vibrate' in navigator) {
      const duration = type === 'light' ? 10 : 25;
      navigator.vibrate?.(duration);
    }
  };

  const handleShopping = () => {
    if (!selectedDate) return;
    triggerHapticFeedback('medium');
    setIsLoading(true);
    setTimeout(() => {
      router.push(`/shopping/${formatDateForUrl(selectedDate)}`);
    }, 100);
  };

  const handlePacking = () => {
    if (!selectedDate) return;
    triggerHapticFeedback('medium');
    setIsLoading(true);
    setTimeout(() => {
      router.push(`/packing/${formatDateForUrl(selectedDate)}`);
    }, 100);
  };

  const getDayOrderCount = (date: Date) => {
    const dateStr = formatDateForUrl(date);
    return orderCounts[dateStr] || 0;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welmora Scanner</h1>
          </div>

          {/* Date Selection */}
          <Card className="card mb-8">
            <CardHeader className="text-center pb-3">
              <CardTitle className="text-xl text-gray-800">Select Date</CardTitle>
              <CardDescription>Choose date for orders</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center pb-4">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={date => {
                  if (date) {
                    setSelectedDate(date);
                    triggerHapticFeedback('light');
                  }
                }}
                className="rounded-md border"
              />
            </CardContent>
          </Card>

          {/* Main Actions */}
          <div className="space-y-6">
            {/* Shopping */}
            <Card className="card hover:shadow-lg transition-all duration-200">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                  <ShoppingCart className="w-8 h-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl text-blue-800">Shopping</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  onClick={handleShopping}
                  className="btn-primary w-full mobile-touch h-12 text-lg"
                  disabled={isLoading || !selectedDate}
                >
                  {isLoading ? 'Loading...' : selectedDate ? 'Start Shopping' : 'Select Date First'}
                </Button>
                {selectedDate && (
                  <div className="text-center text-sm text-gray-600 mt-3">
                    <div>{formatDisplayDate(selectedDate)}</div>
                    {getDayOrderCount(selectedDate) > 0 && (
                      <div className="mt-2">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          {getDayOrderCount(selectedDate)} orders
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Packing */}
            <Card className="card hover:shadow-lg transition-all duration-200">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-3">
                  <PackageOpen className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl text-green-800">Packing</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Button
                  onClick={handlePacking}
                  className="btn-success w-full mobile-touch h-12 text-lg"
                  disabled={isLoading || !selectedDate}
                >
                  {isLoading ? 'Loading...' : selectedDate ? 'Start Packing' : 'Select Date First'}
                </Button>
                {selectedDate && (
                  <div className="text-center text-sm text-gray-600 mt-3">
                    <div>{formatDisplayDate(selectedDate)}</div>
                    {getDayOrderCount(selectedDate) > 0 && (
                      <div className="mt-2">
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                          {getDayOrderCount(selectedDate)} orders
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-6 text-center">
        <p className="text-sm text-gray-500">
          Developed by{' '}
          <a
            href="https://crisp.hr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-800 font-medium transition-colors"
          >
            CRISP
          </a>
        </p>
      </footer>
    </div>
  );
}
