'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { DailySnapshot, ShoppingItem as WooShoppingItem } from '@/types/woocommerce-api';
import { ArrowLeft, CheckCircle, Search } from 'lucide-react';
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
}

export default function ShoppingPage() {
  const params = useParams();
  const router = useRouter();
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [filteredList, setFilteredList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      }));

      setShoppingList(items);
      setFilteredList(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [date]);

  // Load state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(`shopping-${date}`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setShoppingList(parsed);
        setFilteredList(parsed);
        setLoading(false);
        return;
      } catch (e) {
        console.error('Failed to parse saved state:', e);
      }
    }

    if (date) {
      fetchShoppingData();
    }
  }, [date, fetchShoppingData]);

  // Save state to localStorage whenever shoppingList changes
  useEffect(() => {
    if (shoppingList.length > 0) {
      localStorage.setItem(`shopping-${date}`, JSON.stringify(shoppingList));
    }
  }, [shoppingList, date]);

  // Filter list based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredList(shoppingList);
    } else {
      const filtered = shoppingList.filter(
        item =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.sku.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredList(filtered);
    }
  }, [searchTerm, shoppingList]);

  const toggleItemCompleted = (sku: string) => {
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
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center py-8">
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
    <div className="container mx-auto p-4 max-w-2xl">
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
          {completedItems === totalItems && totalItems > 0 && (
            <div className="mt-3 text-center">
              <Badge className="bg-green-600">🎉 Shopping Complete!</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-gray-600" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Shopping List */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {filteredList.map(item => (
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
                  <div className="flex items-center gap-2">
                    <Badge variant={item.completed ? 'default' : 'secondary'} className="text-sm">
                      Qty: {item.totalNeeded}
                    </Badge>
                    {item.completed && <Badge className="bg-green-600 text-xs">✓ Done</Badge>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredList.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? 'No products found matching your search'
                : 'No products found for this date'}
            </p>
            {searchTerm && (
              <Button onClick={() => setSearchTerm('')} variant="outline">
                Clear Search
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {totalItems > 0 && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">Shopping Summary</p>
              <div className="flex justify-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">{totalItems}</div>
                  <div className="text-xs text-gray-500">Total Items</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{completedItems}</div>
                  <div className="text-xs text-gray-500">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {totalItems - completedItems}
                  </div>
                  <div className="text-xs text-gray-500">Remaining</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
