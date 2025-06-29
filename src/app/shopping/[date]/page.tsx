'use client';

import { useDateContext } from '@/components/DateContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DailySnapshot, ShoppingItem as WooShoppingItem } from '@/types/woocommerce-api';
import { CheckCircle, ShoppingCart } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

interface ShoppingItem {
  sku: string;
  name: string;
  totalNeeded: number;
  purchased: number;
  completed: boolean;
  image?: string;
  category?: string;
  weight?: number;
}

export default function ShoppingPage() {
  const params = useParams();
  const router = useRouter();
  const { selectedDate: globalDate, setSelectedDate: setGlobalDate } = useDateContext();
  const t = useTranslations();
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

  const date = Array.isArray(params.date) ? params.date[0] : params.date;

  const formatDateForUrl = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Sync context <-> local state <-> URL
  useEffect(() => {
    if (date) {
      setGlobalDate(date);
      const [year, month, day] = date.split('-').map(Number);
      setSelectedDate(new Date(year, month - 1, day));
    }
  }, [date, setGlobalDate]);

  useEffect(() => {
    if (globalDate && globalDate !== date) {
      router.push(`/shopping/${globalDate}`);
    }
  }, [globalDate, date, router]);

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      setSelectedDate(newDate);
      const formattedDate = formatDateForUrl(newDate);
      setGlobalDate(formattedDate);
      router.push(`/shopping/${formattedDate}`);
    }
  };

  const fetchShoppingData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/shopping/${date}?t=${Date.now()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch shopping data');
      }

      const data: DailySnapshot = await response.json();

      // Convert to shopping list format
      const items: ShoppingItem[] = data.products.map((item: WooShoppingItem) => ({
        sku: item.sku,
        name: item.name,
        totalNeeded: item.quantity,
        purchased: 0,
        completed: false,
        image: item.image,
        category: item.category || 'Uncategorized',
        weight: item.weight || 0,
      }));

      setShoppingList(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [date]);

  // Load state from localStorage or fetch fresh data
  useEffect(() => {
    if (!date) return;
    fetchShoppingData();
  }, [date, fetchShoppingData]);

  // Save state to localStorage whenever shoppingList changes
  useEffect(() => {
    if (shoppingList.length > 0) {
      localStorage.setItem(`shopping-${date}`, JSON.stringify(shoppingList));
    }
  }, [shoppingList, date]);

  const triggerHapticFeedback = (type: 'light' | 'medium' = 'light') => {
    if ('vibrator' in navigator || 'vibrate' in navigator) {
      const duration = type === 'light' ? 10 : 25;
      navigator.vibrate?.(duration);
    }
  };

  const toggleItemCompleted = (sku: string) => {
    triggerHapticFeedback('medium');
    setShoppingList(prev =>
      prev.map(item =>
        item.sku === sku
          ? {
              ...item,
              completed: !item.completed,
              purchased: !item.completed ? item.totalNeeded : 0,
            }
          : item
      )
    );
  };

  const completedItems = shoppingList.filter(item => item.completed).length;
  const totalItems = shoppingList.length;
  const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('shopping.loadingData')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            {t('common.error')}: {error}
          </p>
          <Button onClick={() => window.location.reload()}>{t('common.tryAgain')}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex flex-col items-center mb-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="h-6 w-6 text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900 text-center">{t('shopping.title')}</h1>
          </div>
        </div>
        {/* Calendar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-center">{t('shopping.selectDate')}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateChange}
              className="rounded-md border"
            />
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 pb-20">
        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{t('shopping.progress')}</span>
              <span className="text-sm text-gray-600">
                {completedItems}/{totalItems}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />

            {/* Weight Info */}
            {/* Weight removed from shopping - only needed for packing */}

            {completedItems === totalItems && totalItems > 0 && (
              <div className="mt-3 text-center">
                <Badge className="bg-green-600">Kupnja završena!</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shopping List - Grouped by Category */}
        <div className="space-y-4">
          {(() => {
            // Group items by category
            const groupedItems = shoppingList.reduce(
              (groups, item) => {
                const category = item.category || 'Bez kategorije';
                if (!groups[category]) {
                  groups[category] = [];
                }
                groups[category].push(item);
                return groups;
              },
              {} as Record<string, ShoppingItem[]>
            );

            // Sort categories and items within each category
            const sortedCategories = Object.keys(groupedItems).sort();

            return sortedCategories.map(category => (
              <div key={category} className="space-y-2">
                {/* Category Header */}
                <div className="sticky top-0 bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 z-10 shadow-sm">
                  <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wide">
                    {category}
                  </h3>
                </div>

                {/* Items in this category */}
                <div className="space-y-2">
                  {groupedItems[category].map((item: ShoppingItem) => (
                    <Card
                      key={item.sku}
                      className={`cursor-pointer transition-all duration-200 ${
                        item.completed
                          ? 'bg-green-50 border-green-200 shadow-sm'
                          : 'bg-white hover:shadow-md hover:scale-[1.02]'
                      }`}
                      onClick={() => toggleItemCompleted(item.sku)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Checkbox */}
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                              item.completed
                                ? 'bg-green-600 border-green-600'
                                : 'border-gray-300 hover:border-green-400'
                            }`}
                          >
                            {item.completed && <CheckCircle className="h-4 w-4 text-white" />}
                          </div>

                          {/* Product Image */}
                          {item.image && (
                            <div className="w-12 h-12 relative flex-shrink-0">
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                className="object-cover rounded-md"
                                sizes="48px"
                              />
                            </div>
                          )}

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <h3
                              className={`font-medium text-sm leading-tight ${
                                item.completed ? 'text-green-800 line-through' : 'text-gray-900'
                              }`}
                            >
                              {item.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {item.totalNeeded}x
                              </Badge>
                              <span className="text-xs text-gray-500">SKU: {item.sku}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
    </div>
  );
}
