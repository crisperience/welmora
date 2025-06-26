'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { formatPriceWithConversion, getChfToEurRate } from '@/lib/currency';
import { FileSpreadsheet, Scale, Search, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface ProductComparison {
  sku: string;
  gtin: string;
  name: string;
  welmoraPrice: number;
  welmoraStock: number;
  welmoraBackorders?: string;
  dmPrice?: number;
  dmStock?: number;
  dmProductUrl?: string;
  dmLastUpdated?: string;
  muellerPrice?: number;
  muellerStock?: number;
  muellerProductUrl?: string;
  muellerLastUpdated?: string;
  needsUpdate: boolean;
  image?: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductComparison[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [eurRate, setEurRate] = useState<number>(1.05);
  const [loadingItems, setLoadingItems] = useState<Set<string>>(new Set());

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
      }
    };

    fetchRate();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadProducts(searchTerm || undefined);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, loadProducts]);

  const handleClearSearch = () => {
    setSearchTerm('');
  };

  const formatPrice = (price: number, currency: 'CHF' | 'EUR' = 'CHF') => {
    return formatPriceWithConversion(price, currency, currency === 'CHF' ? eurRate : undefined);
  };

  const getStockColor = (status: 'instock' | 'outofstock' | 'backorder') => {
    switch (status) {
      case 'instock':
        return 'bg-green-100 text-green-700 border-green-300';
      case 'outofstock':
        return 'bg-red-100 text-red-700 border-red-300';
      case 'backorder':
        return 'bg-orange-100 text-orange-700 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  };

  const getStockStatus = (stock: number) => {
    return stock > 0 ? 'Dostupno' : 'Nedostupno';
  };

  const getStockStatusForExport = (stock: number, backorders?: string) => {
    const status = getStatusFromStock(stock, backorders);
    switch (status) {
      case 'instock':
        return 'Dostupno';
      case 'backorder':
        return 'Po narudžbi';
      case 'outofstock':
      default:
        return 'Nedostupno';
    }
  };

  const getCheapestSource = (dmPrice?: number, muellerPrice?: number) => {
    if (!dmPrice && !muellerPrice) return null;
    if (!dmPrice) return 'mueller';
    if (!muellerPrice) return 'dm';
    if (dmPrice === muellerPrice) return null;
    return dmPrice < muellerPrice ? 'dm' : 'mueller';
  };

  const getPriceColorClass = (source: 'dm' | 'mueller', cheapestSource: string | null) => {
    if (cheapestSource === source) {
      return 'text-green-600 font-bold';
    }
    return 'text-gray-900';
  };

  const getStockFromStatus = (status: 'instock' | 'outofstock' | 'backorder'): number => {
    return status === 'instock' ? 1 : 0;
  };

  const getStatusFromStock = (
    stock: number,
    backorders?: string
  ): 'instock' | 'outofstock' | 'backorder' => {
    if (stock > 0) return 'instock';
    if (backorders === 'yes') return 'backorder';
    return 'outofstock';
  };
  const handleStockChange = async (
    productSku: string,
    newStatus: 'instock' | 'outofstock' | 'backorder'
  ) => {
    const originalProduct = products.find(p => p.sku === productSku);
    if (!originalProduct) return;

    const originalStock = originalProduct.welmoraStock;

    setProducts(prev =>
      prev.map(product =>
        product.sku === productSku
          ? {
            ...product,
            welmoraStock: getStockFromStatus(newStatus),
            welmoraBackorders: newStatus === 'backorder' ? 'yes' : 'no',
          }
          : product
      )
    );

    setLoadingItems(prev => new Set(prev).add(productSku));

    try {
      const response = await fetch('/api/products/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: productSku,
          stock_status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update stock status');
      }

      console.log(`✅ Stock status updated successfully for ${productSku}: ${newStatus}`);
    } catch (error) {
      console.error('Error updating stock status:', error);

      setProducts(prev =>
        prev.map(product =>
          product.sku === productSku ? { ...product, welmoraStock: originalStock } : product
        )
      );

      alert('Greška pri ažuriranju statusa zaliha. Pokušajte ponovo.');
    } finally {
      setLoadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(productSku);
        return newSet;
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      'SKU',
      'Naziv',
      'Welmora Cijena',
      'Welmora Status',
      'DM Cijena',
      'DM Status',
      'Müller Cijena',
      'Müller Status',
    ];

    const csvContent = [
      headers.join(','),
      ...products.map(product =>
        [
          product.sku,
          `"${product.name}"`,
          product.welmoraPrice,
          getStockStatusForExport(product.welmoraStock, product.welmoraBackorders),
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
    a.download = `welmora-proizvodi-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Scale className="h-6 w-6 text-amber-600" />
          <h1 className="text-2xl font-bold text-gray-900">Proizvodi</h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Pretraži proizvode po nazivu, SKU ili GTIN..."
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
              onClick={exportToCSV}
              disabled={isPageLoading}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              CSV
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
              <p className="text-gray-600">Učitavam proizvode...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
            {products.map(product => (
              <Card key={product.sku} className="overflow-hidden">
                <div className="aspect-square relative bg-gray-100">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                      Nema slike
                    </div>
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.name}</h3>
                  <p className="text-xs text-gray-600 mb-2">SKU: {product.sku}</p>

                  {/* Calculate cheapest source for this product */}
                  {(() => {
                    const cheapestSource = getCheapestSource(product.dmPrice, product.muellerPrice);

                    return (
                      <>
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
                              <div className="relative">
                                <select
                                  value={getStatusFromStock(
                                    product.welmoraStock,
                                    product.welmoraBackorders
                                  )}
                                  onChange={e =>
                                    handleStockChange(
                                      product.sku,
                                      e.target.value as 'instock' | 'outofstock' | 'backorder'
                                    )
                                  }
                                  disabled={loadingItems.has(product.sku)}
                                  className={`text-xs px-2 py-1 rounded border text-center ${getStockColor(getStatusFromStock(product.welmoraStock, product.welmoraBackorders))} ${loadingItems.has(product.sku)
                                    ? 'opacity-50 cursor-not-allowed'
                                    : ''
                                    }`}
                                >
                                  <option value="instock">Dostupno</option>
                                  <option value="outofstock">Nedostupno</option>
                                  <option value="backorder">Po narudžbi</option>
                                </select>
                                {loadingItems.has(product.sku) && (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-amber-500"></div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        {/* DM */}
                        <div className="mb-2">
                          <h4 className="font-medium text-gray-900 text-xs mb-1">DM</h4>
                          <div className="flex justify-between items-center">
                            <span
                              className={`text-sm font-semibold ${getPriceColorClass('dm', cheapestSource)}`}
                            >
                              {product.dmPrice ? formatPrice(product.dmPrice, 'EUR') : 'N/A'}
                            </span>
                            {product.dmProductUrl && (
                              <a
                                href={product.dmProductUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded border border-amber-200 transition-colors whitespace-nowrap flex items-center gap-1"
                              >
                                <Image
                                  src="/logo_dm.png"
                                  alt="DM"
                                  width={16}
                                  height={16}
                                  className="object-contain"
                                />
                                Provjeri zalihe
                              </a>
                            )}
                          </div>
                        </div>
                        {/* Müller */}
                        <div className="mb-2">
                          <h4 className="font-medium text-gray-900 text-xs mb-1">Müller</h4>
                          <div className="flex justify-between items-center">
                            <span
                              className={`text-sm font-semibold ${getPriceColorClass('mueller', cheapestSource)}`}
                            >
                              {product.muellerPrice
                                ? formatPrice(product.muellerPrice, 'EUR')
                                : 'N/A'}
                            </span>
                            {product.muellerProductUrl ? (
                              <a
                                href={product.muellerProductUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded border border-amber-200 transition-colors whitespace-nowrap flex items-center gap-1"
                              >
                                <Image
                                  src="/logo_mueller.png"
                                  alt="Müller"
                                  width={16}
                                  height={16}
                                  className="object-contain"
                                />
                                Provjeri zalihe
                              </a>
                            ) : (
                              <span className="text-xs text-gray-400">N/A</span>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
