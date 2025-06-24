'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DailySnapshot, ShoppingItem as WooShoppingItem } from '@/types/woocommerce-api';
import { ArrowLeft, CheckCircle } from 'lucide-react';
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
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const date = Array.isArray(params.date) ? params.date[0] : params.date;

  const fetchShoppingData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/shopping/${date}`);

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

    const savedState = localStorage.getItem(`shopping-${date}`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Check if saved data is from the same date
        if (parsed.length > 0) {
          setShoppingList(parsed);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error('Failed to parse saved state:', e);
        // Clear invalid saved state
        localStorage.removeItem(`shopping-${date}`);
      }
    }

    // Always fetch fresh data if no valid saved state
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
  const totalWeight = shoppingList.reduce(
    (sum, item) => sum + (item.weight || 0) * item.totalNeeded,
    0
  );
  const completedWeight = shoppingList
    .filter(item => item.completed)
    .reduce((sum, item) => sum + (item.weight || 0) * item.totalNeeded, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <Button onClick={() => router.push('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => router.push('/')} className="p-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Shopping List</h1>
          <div className="w-10" />
        </div>

        {/* Progress */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm text-gray-600">
                {completedItems}/{totalItems}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />

            {/* Weight Info */}
            {totalWeight > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                <span>
                  Weight: {completedWeight.toFixed(1)}kg / {totalWeight.toFixed(1)}kg
                </span>
              </div>
            )}

            {completedItems === totalItems && totalItems > 0 && (
              <div className="mt-3 text-center">
                <Badge className="bg-green-600">🎉 Shopping Complete!</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Shopping List */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {shoppingList.map((item: ShoppingItem) => (
            <Card
              key={item.sku}
              className={`cursor-pointer transition-all duration-200 ${
                item.completed
                  ? 'bg-green-50 border-green-200 shadow-sm'
                  : 'hover:bg-gray-50 hover:shadow-md'
              }`}
              onClick={() => toggleItemCompleted(item.sku)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Checkbox */}
                  <div className="flex-shrink-0">
                    {item.completed ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <div className="h-6 w-6 border-2 border-gray-300 rounded-full hover:border-green-400 transition-colors" />
                    )}
                  </div>

                  {/* Product Image */}
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="w-full h-full object-cover"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                        No img
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-medium text-lg leading-tight mb-1 ${
                        item.completed ? 'text-green-800 line-through' : 'text-gray-900'
                      }`}
                    >
                      {item.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2">SKU: {item.sku}</p>
                    {item.category && (
                      <p className="text-xs text-blue-600 mb-2">📦 {item.category}</p>
                    )}
                    <div className="flex items-center gap-2">
                      <Badge variant={item.completed ? 'default' : 'secondary'} className="text-sm">
                        Qty: {item.totalNeeded}
                      </Badge>
                      {item.weight && item.weight > 0 && (
                        <Badge variant="outline" className="text-xs text-gray-600">
                          {(item.weight * item.totalNeeded).toFixed(1)}kg
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
