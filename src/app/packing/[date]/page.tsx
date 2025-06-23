'use client';

import BarcodeScanner from '@/components/scanner/BarcodeScanner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { PackageItem, Package as PackageType, ScanFeedback } from '@/types/woocommerce-api';
import { ArrowLeft, CheckCircle, MapPin, Package, Scan, User } from 'lucide-react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function PackingPage() {
  const params = useParams();
  const router = useRouter();
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const [manualSku, setManualSku] = useState('');

  const date = Array.isArray(params.date) ? params.date[0] : params.date;

  const fetchPackingData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/packing/${date}`);

      if (!response.ok) {
        throw new Error('Failed to fetch packing data');
      }

      const data = await response.json();
      // API directly returns array of packages
      setPackages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [date]);

  // Load state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(`packing-${date}`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        setPackages(parsed);
        setLoading(false);
        return;
      } catch (e) {
        console.error('Failed to parse saved state:', e);
      }
    }

    if (date) {
      fetchPackingData();
    }
  }, [date, fetchPackingData]);

  // Save state to localStorage whenever packages change
  useEffect(() => {
    if (packages.length > 0) {
      localStorage.setItem(`packing-${date}`, JSON.stringify(packages));
    }
  }, [packages, date]);

  // Clear feedback after 5 seconds
  useEffect(() => {
    if (scanFeedback) {
      const timer = setTimeout(() => {
        setScanFeedback(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [scanFeedback]);

  const handleScan = async (scannedCode: string) => {
    processProduct(scannedCode);
  };

  const handleManualEntry = () => {
    if (manualSku.trim()) {
      processProduct(manualSku.trim());
      setManualSku('');
    }
  };

  const formatAddress = (address: PackageType['shippingAddress']) => {
    const parts = [
      address.address_1,
      address.address_2,
      address.city,
      address.postcode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const processProduct = (code: string) => {
    try {
      // Find which package contains this SKU
      let foundPackage: PackageType | null = null;
      let foundItem: PackageItem | null = null;

      for (const pkg of packages) {
        const item = pkg.items.find(
          item =>
            item.sku === code ||
            item.productId?.toString() === code ||
            item.name.toLowerCase().includes(code.toLowerCase())
        );
        if (item) {
          foundPackage = pkg;
          foundItem = item;
          break;
        }
      }

      if (!foundPackage || !foundItem) {
        setScanFeedback({
          success: false,
          message: `❌ Product "${code}" not found in any package for this date`,
          urgency: 'medium',
          sound: 'error',
        });
        return;
      }

      if (foundItem.scanned >= foundItem.needed) {
        setScanFeedback({
          success: false,
          message: `⚠️ "${foundItem.name}" already complete for ${foundPackage.customerName}`,
          packageInfo: {
            packageId: foundPackage.id,
            orderNumber: foundPackage.orderNumber,
            customerName: foundPackage.customerName,
            shippingAddress: formatAddress(foundPackage.shippingAddress),
            remainingItems: 0,
            totalItems: foundItem.needed,
            isComplete: true,
          },
          productInfo: {
            name: foundItem.name,
            sku: foundItem.sku,
            needed: foundItem.needed,
            scanned: foundItem.scanned,
            remaining: 0,
          },
          urgency: 'low',
          sound: 'warning',
        });
        return;
      }

      // Update the item
      const updatedPackages = packages.map(pkg => {
        if (pkg.id === foundPackage!.id) {
          const updatedItems = pkg.items.map(item => {
            if (item.sku === foundItem!.sku) {
              return {
                ...item,
                scanned: Math.min(item.scanned + 1, item.needed),
              };
            }
            return item;
          });

          // Check if package is complete
          const allComplete = updatedItems.every(item => item.scanned >= item.needed);

          return {
            ...pkg,
            items: updatedItems,
            status: allComplete ? ('completed' as const) : ('in-progress' as const),
          };
        }
        return pkg;
      });

      setPackages(updatedPackages);

      const remaining = foundItem.needed - (foundItem.scanned + 1);
      const packageTotalItems = foundPackage.items.reduce((sum, item) => sum + item.needed, 0);
      const packageScannedItems = foundPackage.items.reduce(
        (sum, item) =>
          sum + Math.min(item.scanned + (item.sku === foundItem!.sku ? 1 : 0), item.needed),
        0
      );
      const packageComplete = remaining <= 0 && packageScannedItems === packageTotalItems;

      setScanFeedback({
        success: true,
        message:
          remaining <= 0
            ? `✅ "${foundItem.name}" COMPLETE!`
            : `📦 "${foundItem.name}" - ${remaining} more needed`,
        packageInfo: {
          packageId: foundPackage.id,
          orderNumber: foundPackage.orderNumber,
          customerName: foundPackage.customerName,
          shippingAddress: formatAddress(foundPackage.shippingAddress),
          remainingItems: packageTotalItems - packageScannedItems,
          totalItems: packageTotalItems,
          isComplete: packageComplete,
        },
        productInfo: {
          name: foundItem.name,
          sku: foundItem.sku,
          needed: foundItem.needed,
          scanned: foundItem.scanned + 1,
          remaining: remaining,
        },
        urgency: remaining <= 0 ? 'low' : packageComplete ? 'high' : 'medium',
        sound: remaining <= 0 ? 'success' : 'success',
      });
    } catch {
      setScanFeedback({
        success: false,
        message: '❌ Processing failed - please try again',
        urgency: 'high',
        sound: 'error',
      });
    }
  };

  const togglePackageStatus = (packageId: string) => {
    setPackages(prev =>
      prev.map(pkg => {
        if (pkg.id === packageId) {
          const newStatus = pkg.status === 'completed' ? 'pending' : 'completed';
          // If marking as completed, mark all items as scanned
          if (newStatus === 'completed') {
            const updatedItems = pkg.items.map(item => ({
              ...item,
              scanned: item.needed,
            }));
            return { ...pkg, status: newStatus, items: updatedItems };
          } else {
            // If marking as pending, reset all items
            const updatedItems = pkg.items.map(item => ({
              ...item,
              scanned: 0,
            }));
            return { ...pkg, status: newStatus, items: updatedItems };
          }
        }
        return pkg;
      })
    );
  };

  const getPackageProgress = (pkg: PackageType) => {
    const totalNeeded = pkg.items.reduce((sum, item) => sum + item.needed, 0);
    const totalScanned = pkg.items.reduce((sum, item) => sum + item.scanned, 0);
    return {
      totalNeeded,
      totalScanned,
      percentage: totalNeeded > 0 ? (totalScanned / totalNeeded) * 100 : 0,
    };
  };

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

  const completedPackages = packages.filter(pkg => pkg.status === 'completed').length;
  const totalPackages = packages.length;

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => router.push('/')} className="p-2">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Packing</h1>
        <div className="w-10" />
      </div>

      {/* Scanner */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Scanner</h2>
            <Button
              onClick={() => setScannerActive(!scannerActive)}
              variant={scannerActive ? 'destructive' : 'default'}
              size="sm"
            >
              <Scan className="mr-2 h-4 w-4" />
              {scannerActive ? 'Stop' : 'Start'}
            </Button>
          </div>

          {scannerActive && (
            <div className="mb-4">
              <BarcodeScanner
                onScan={handleScan}
                isActive={scannerActive}
                onToggle={() => setScannerActive(!scannerActive)}
              />
            </div>
          )}

          {/* Manual SKU Entry */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Enter SKU manually..."
              value={manualSku}
              onChange={e => setManualSku(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleManualEntry()}
              className="flex-1"
            />
            <Button onClick={handleManualEntry} disabled={!manualSku.trim()}>
              Add
            </Button>
          </div>

          {scanFeedback && (
            <Card
              className={`border-l-4 ${
                scanFeedback.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      scanFeedback.success ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    {scanFeedback.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <Package className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${
                        scanFeedback.success ? 'text-green-800' : 'text-red-800'
                      }`}
                    >
                      {scanFeedback.message}
                    </p>

                    {scanFeedback.packageInfo && (
                      <div className="mt-3 space-y-2">
                        <div className="bg-white p-3 rounded-lg border">
                          <div className="flex items-center gap-2 mb-2">
                            <Package className="h-4 w-4 text-blue-600" />
                            <span className="font-semibold text-blue-800">
                              Package {scanFeedback.packageInfo.orderNumber}
                            </span>
                            <Badge
                              variant={
                                scanFeedback.packageInfo.isComplete ? 'default' : 'secondary'
                              }
                            >
                              {scanFeedback.packageInfo.isComplete ? 'Complete' : 'In Progress'}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-gray-500" />
                              <span className="font-medium">
                                {scanFeedback.packageInfo.customerName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3 w-3 text-gray-500" />
                              <span className="text-gray-600 text-xs">
                                {scanFeedback.packageInfo.shippingAddress}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">
                                Items:{' '}
                                {scanFeedback.packageInfo.totalItems -
                                  scanFeedback.packageInfo.remainingItems}
                                /{scanFeedback.packageInfo.totalItems}
                              </span>
                              {scanFeedback.packageInfo.remainingItems > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {scanFeedback.packageInfo.remainingItems} remaining
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {scanFeedback.productInfo && (
                          <div className="bg-white p-3 rounded-lg border">
                            <div className="flex items-center gap-2 mb-2">
                              <Scan className="h-4 w-4 text-purple-600" />
                              <span className="font-semibold text-purple-800">Product Details</span>
                            </div>
                            <div className="text-sm space-y-1">
                              <div className="font-medium">{scanFeedback.productInfo.name}</div>
                              <div className="text-gray-600">
                                SKU: {scanFeedback.productInfo.sku}
                              </div>
                              <div className="flex justify-between items-center">
                                <span>
                                  Scanned: {scanFeedback.productInfo.scanned}/
                                  {scanFeedback.productInfo.needed}
                                </span>
                                {scanFeedback.productInfo.remaining > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {scanFeedback.productInfo.remaining} more needed
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Packages */}
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {packages.map(pkg => {
          const progress = getPackageProgress(pkg);

          return (
            <Card
              key={pkg.id}
              className={`${
                pkg.status === 'completed'
                  ? 'bg-green-50 border-green-200'
                  : pkg.status === 'in-progress'
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white'
              }`}
            >
              <CardContent className="p-4">
                {/* Package Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{pkg.customerName}</h3>
                        <Badge variant="outline" className="text-xs">
                          {pkg.orderNumber}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{pkg.customerEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={pkg.status === 'completed' ? 'default' : 'secondary'}>
                      {progress.totalScanned}/{progress.totalNeeded}
                    </Badge>
                    <Button
                      size="sm"
                      variant={pkg.status === 'completed' ? 'destructive' : 'default'}
                      onClick={() => togglePackageStatus(pkg.id)}
                    >
                      {pkg.status === 'completed' ? 'Reset' : 'Complete'}
                    </Button>
                  </div>
                </div>

                {/* Shipping Address */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-800">Shipping Address</span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {formatAddress(pkg.shippingAddress)}
                  </p>
                  {pkg.shippingAddress.phone && (
                    <p className="text-xs text-gray-500 mt-1">📞 {pkg.shippingAddress.phone}</p>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <Progress value={progress.percentage} className="h-2" />
                </div>

                {/* Package Items */}
                <div className="space-y-2">
                  {pkg.items.map(item => (
                    <div
                      key={item.sku}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        item.scanned >= item.needed ? 'bg-green-100' : 'bg-gray-50'
                      }`}
                    >
                      {/* Product Image */}
                      <div className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <Image
                            src={item.image}
                            alt={item.name}
                            width={40}
                            height={40}
                            className="w-full h-full object-cover"
                            onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {item.scanned >= item.needed ? (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          ) : (
                            <div className="h-4 w-4 border-2 border-gray-300 rounded-full flex-shrink-0" />
                          )}
                          <span
                            className={`font-medium text-sm truncate ${
                              item.scanned >= item.needed
                                ? 'text-green-800 line-through'
                                : 'text-gray-900'
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 ml-6">SKU: {item.sku}</div>
                      </div>
                      <Badge
                        variant={item.scanned >= item.needed ? 'default' : 'secondary'}
                        className="ml-2"
                      >
                        {item.scanned}/{item.needed}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      {totalPackages > 0 && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-sm">
              <span>Total Packages: {totalPackages}</span>
              <span className="text-green-600">Completed: {completedPackages}</span>
            </div>
            {completedPackages === totalPackages && (
              <div className="mt-2 text-center">
                <Badge className="bg-green-600">🎉 All Packages Done!</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {packages.length === 0 && !loading && (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No packages found for this date</p>
            <Button onClick={() => router.push('/')} className="mt-4" variant="outline">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
