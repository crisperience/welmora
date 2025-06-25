'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { formatPriceWithConversion, getChfToEurRate } from '@/lib/currency';
import { FileSpreadsheet, Search, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface ProductComparison {
  sku: string;
  gtin: string;
  name: string;
  welmoraPrice: number;
  welmoraStock: number;
  dmPrice?: number;
  dmStock?: number;
  dmProductUrl?: string;
  dmLastUpdated?: string;
  muellerPrice?: number;
  muellerStock?: number;
  needsUpdate: boolean;
  image?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductComparison[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [eurRate, setEurRate] = useState<number>(1.05); // Default fallback rate

  const loadProducts = useCallback(async (search?: string) => {
    setIsPageLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);

      const response = await fetch(`/api/products/compare?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setProducts(result.data);
      } else {
        console.error('Failed to load products:', result.error);
      }
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setIsPageLoading(false);
    }
  }, []);

  // Fetch EUR rate on component mount
  useEffect(() => {
    const fetchRate = async () => {
      try {
        const rate = await getChfToEurRate();
        setEurRate(rate);
      } catch (error) {
        console.error('Failed to fetch EUR rate:', error);
        // Keep default rate
      }
    };

    fetchRate();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Auto-search when searchTerm changes with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadProducts(searchTerm || undefined);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, loadProducts]);

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const formatPrice = (price: number, currency: 'CHF' | 'EUR' = 'CHF') => {
    return formatPriceWithConversion(price, currency, currency === 'CHF' ? eurRate : undefined);
  };

  const getStockColor = (stock?: number) => {
    if (stock === undefined) return 'bg-gray-100 text-gray-600';
    if (stock === 0) return 'bg-orange-100 text-orange-700';
    return 'bg-green-100 text-green-700';
  };

  const getStockStatus = (stock: number) => {
    return stock > 0 ? 'In Stock' : 'Out of Stock';
  };

  // Handle stock status change for individual products
  const handleStockChange = async (productSku: string, newStatus: 'instock' | 'outofstock') => {
    try {
      const response = await fetch('/api/products/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: productSku,
          stock_status: newStatus,
          // Don't set stock_quantity, just change the status
        }),
      });

      if (response.ok) {
        // Reload products to show updated data
        await loadProducts(searchTerm);
      } else {
        console.error('Failed to update stock status');
      }
    } catch (error) {
      console.error('Error updating stock status:', error);
    }
  };

  const exportToExcel = () => {
    const headers = [
      'SKU',
      'Name',
      'Welmora Price',
      'Welmora Stock Status',
      'DM Price',
      'DM Stock Status',
      'Mueller Price',
      'Mueller Stock Status',
    ];

    const csvContent = [
      headers.join(','),
      ...products.map(product =>
        [
          product.sku,
          `"${product.name}"`,
          product.welmoraPrice,
          getStockStatus(product.welmoraStock),
          product.dmPrice || '',
          product.dmStock !== undefined ? getStockStatus(product.dmStock) : '',
          product.muellerPrice || '',
          product.muellerStock !== undefined ? getStockStatus(product.muellerStock) : '',
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `welmora-products-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <h1 className="text-2xl font-bold text-gray-900 mb-4 text-center">Products</h1>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search products by name, SKU, or GTIN..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={exportToExcel}
              disabled={isPageLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto pb-20">
        {isPageLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Progress value={undefined} className="w-64 mb-4" />
              <p className="text-gray-600">Loading products...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4">
            {products.map(product => (
              <Card key={product.sku} className="overflow-hidden">
                <div className="aspect-square relative bg-gray-100">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                      No Image
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-gray-600 mb-2">SKU: {product.sku}</p>
                  {/* Welmora */}
                  <div className="mb-2">
                    <h4 className="font-medium text-gray-900 text-xs mb-1">Welmora.ch</h4>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <span className="text-sm font-semibold">
                          {formatPrice(product.welmoraPrice)}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <select
                          value={product.welmoraStock > 0 ? 'instock' : 'outofstock'}
                          onChange={e =>
                            handleStockChange(
                              product.sku,
                              e.target.value as 'instock' | 'outofstock'
                            )
                          }
                          className={`text-xs px-2 py-1 rounded border ${getStockColor(product.welmoraStock)} border-current`}
                        >
                          <option value="instock">In Stock</option>
                          <option value="outofstock">Out of Stock</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* DM */}
                  <div className="mb-2">
                    <h4 className="font-medium text-gray-900 text-xs mb-1">DM</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">
                        {product.dmPrice ? formatPrice(product.dmPrice, 'EUR') : 'N/A'}
                      </span>
                      {product.dmProductUrl && (
                        <a
                          href={product.dmProductUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200 transition-colors whitespace-nowrap"
                        >
                          Check Availability
                        </a>
                      )}
                    </div>
                  </div>
                  {/* Müller */}
                  <div className="mb-2">
                    <h4 className="font-medium text-gray-900 text-xs mb-1">Müller</h4>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold">
                        {product.muellerPrice ? formatPrice(product.muellerPrice, 'EUR') : 'N/A'}
                      </span>
                      {/* Future: Add Müller product URL when available */}
                      <span className="text-xs text-gray-400">Coming Soon</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
