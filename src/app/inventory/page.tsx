'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  stock_quantity: number;
  stock_status: string;
  price: string;
  last_updated: string;
}

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadInventory = useCallback(
    async (search?: string, pageNum?: number) => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: (pageNum || page).toString(),
          per_page: '10',
        });

        if (search) {
          params.append('search', search);
        }

        const response = await fetch(`/api/inventory?${params}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load inventory');
        }

        setInventory(data.products || []);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load inventory');
        console.error('Load inventory error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [page]
  );

  const refreshInventory = async () => {
    setIsRefreshing(true);
    await loadInventory(searchTerm, page);
    setIsRefreshing(false);
  };

  const updateStock = async (sku: string, newQuantity: number) => {
    try {
      const response = await fetch('/api/products/update-stock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku,
          stock_quantity: newQuantity,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update stock');
      }

      // Refresh inventory after successful update
      await loadInventory(searchTerm, page);
    } catch (err) {
      setError('Failed to update stock');
      console.error('Update stock error:', err);
    }
  };

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const handleSearch = () => {
    setPage(1);
    loadInventory(searchTerm, 1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadInventory(searchTerm, newPage);
  };

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat('de-CH', {
      style: 'currency',
      currency: 'CHF',
    }).format(parseFloat(price));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-CH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStockStatusBadge = (status: string, quantity: number) => {
    if (status === 'outofstock' || quantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (quantity <= 5) {
      return <Badge variant="secondary">Low Stock</Badge>;
    } else {
      return <Badge variant="default">In Stock</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Inventory Management</h1>
          <p className="text-gray-600">Manage product stock and pricing</p>
        </div>

        {/* Search and Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search & Controls</CardTitle>
            <CardDescription>Search inventory or refresh data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="search-inventory">Search Products</Label>
                <Input
                  id="search-inventory"
                  placeholder="Search by name or SKU..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={handleSearch} disabled={isLoading}>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
                <Button variant="outline" onClick={refreshInventory} disabled={isRefreshing}>
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Message */}
        {error && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Inventory List */}
        {isLoading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2">Loading inventory...</span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {inventory.map(item => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      <CardDescription>SKU: {item.sku}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStockStatusBadge(item.stock_status, item.stock_quantity)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Stock Information */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-blue-600">Stock</h4>
                      <div className="text-sm">
                        <div>Quantity: {item.stock_quantity}</div>
                        <div>Status: {item.stock_status}</div>
                      </div>
                    </div>

                    {/* Price Information */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-green-600">Price</h4>
                      <div className="text-sm">
                        <div>{formatPrice(item.price)}</div>
                      </div>
                    </div>

                    {/* Last Updated */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-600">Last Updated</h4>
                      <div className="text-sm">
                        <div>{formatDate(item.last_updated)}</div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <h4 className="font-semibold text-gray-600">Actions</h4>
                      <div className="space-y-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStock(item.sku, item.stock_quantity + 1)}
                        >
                          +1 Stock
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStock(item.sku, Math.max(0, item.stock_quantity - 1))
                          }
                        >
                          -1 Stock
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {inventory.length === 0 && !isLoading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-gray-500">
                    No inventory items found. Try searching for a specific product or check your
                    connection.
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="px-4 py-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
