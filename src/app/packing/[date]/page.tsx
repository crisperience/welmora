'use client';

import { useDateContext } from '@/components/DateContext';
import BarcodeScanner from '@/components/scanner/BarcodeScanner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { PackageItem, Package as PackageType, ScanFeedback } from '@/types/woocommerce-api';
import { CheckCircle, MapPin, Package, RotateCcw, Scan, User } from 'lucide-react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function PackingPage() {
  const params = useParams();
  const router = useRouter();
  const { selectedDate: globalDate, setSelectedDate: setGlobalDate } = useDateContext();
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback | null>(null);
  const [manualSku, setManualSku] = useState('');
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
      router.push(`/packing/${globalDate}`);
    }
  }, [globalDate, date, router]);

  const handleDateChange = (newDate: Date | undefined) => {
    if (newDate) {
      setSelectedDate(newDate);
      const formattedDate = formatDateForUrl(newDate);
      setGlobalDate(formattedDate);
      router.push(`/packing/${formattedDate}`);
    }
  };

  const fetchPackingData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/packing/${date}?t=${Date.now()}`);

      if (!response.ok) {
        throw new Error('Neuspješno dohvaćanje podataka za pakiranje');
      }

      const data = await response.json();
      // API directly returns array of packages
      setPackages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Dogodila se greška');
    } finally {
      setLoading(false);
    }
  }, [date]);

  // Load state from localStorage or fetch fresh data
  useEffect(() => {
    if (!date) return;
    fetchPackingData();
  }, [date, fetchPackingData]);

  // Save state to localStorage whenever packages change
  useEffect(() => {
    if (packages.length > 0) {
      localStorage.setItem(`packing-${date}`, JSON.stringify(packages));
    }
  }, [packages, date]);

  const dismissFeedback = () => {
    setScanFeedback(null);
  };

  const updateWooCommerceStatus = async (orderId: number, status: 'completed' | 'processing') => {
    try {
      const response = await fetch('/api/packing/update-order-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderId,
          status: status,
        }),
      });

      if (!response.ok) {
        console.error('Failed to update order status in WooCommerce');
      } else {
        console.log(`Order ${orderId} marked as ${status} in WooCommerce`);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

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
    if (!address || !address.address_1) {
      return 'Adresa nije dostupna';
    }
    const parts = [
      address.address_1,
      address.address_2,
      address.city,
      address.postcode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const calculatePackageWeight = (pkg: PackageType) => {
    // Calculate weight based on actual product weights
    const totalWeight = pkg.items.reduce((sum, item) => {
      // Use actual weight from WooCommerce or fallback to 0.5kg
      const itemWeight = item.weight || 0.5;
      return sum + itemWeight * item.needed;
    }, 0);
    return totalWeight;
  };

  const processProduct = (code: string) => {
    try {
      // Find ALL packages that contain this SKU and still need items
      const matchingPackages: Array<{ package: PackageType; item: PackageItem }> = [];

      for (const pkg of packages) {
        const item = pkg.items.find(
          item =>
            item.sku === code ||
            item.productId?.toString() === code ||
            item.name.toLowerCase().includes(code.toLowerCase())
        );
        if (item && item.scanned < item.needed) {
          matchingPackages.push({ package: pkg, item });
        }
      }

      if (matchingPackages.length === 0) {
        // Check if product exists but is already complete in all packages
        const anyMatch = packages.some(pkg =>
          pkg.items.some(
            item =>
              item.sku === code ||
              item.productId?.toString() === code ||
              item.name.toLowerCase().includes(code.toLowerCase())
          )
        );

        setScanFeedback({
          success: false,
          message: anyMatch
            ? `Proizvod "${code}" je već završen u svim paketima`
            : `Proizvod "${code}" nije pronađen ni u jednom paketu za ovaj datum`,
          urgency: 'medium',
          sound: 'error',
        });
        return;
      }

      // If multiple packages need this product, show selection dialog
      if (matchingPackages.length > 1) {
        setScanFeedback({
          success: false,
          message: `Više kupaca treba "${matchingPackages[0].item.name}" - Odaberi kupca:`,
          urgency: 'high',
          sound: 'warning',
          multiplePackages: matchingPackages.map(mp => ({
            packageId: mp.package.id,
            customerName: mp.package.customerName,
            orderNumber: mp.package.orderNumber,
            needed: mp.item.needed,
            scanned: mp.item.scanned,
            remaining: mp.item.needed - mp.item.scanned,
          })),
          productInfo: {
            name: matchingPackages[0].item.name,
            sku: matchingPackages[0].item.sku,
            needed: matchingPackages.reduce((sum, mp) => sum + mp.item.needed, 0),
            scanned: matchingPackages.reduce((sum, mp) => sum + mp.item.scanned, 0),
            remaining: matchingPackages.reduce(
              (sum, mp) => sum + (mp.item.needed - mp.item.scanned),
              0
            ),
          },
        });
        return;
      }

      // Single package found - proceed as normal
      const { package: foundPackage, item: foundItem } = matchingPackages[0];

      if (foundItem.scanned >= foundItem.needed) {
        setScanFeedback({
          success: false,
          message: `"${foundItem.name}" je već završen za ${foundPackage.customerName}`,
          packageInfo: {
            packageId: foundPackage.id,
            orderNumber: foundPackage.orderNumber,
            customerName: foundPackage.customerName,
            shippingAddress: formatAddress(foundPackage.shippingAddress),
            remainingItems: 0,
            totalItems: foundItem.needed,
            isComplete: true,
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

          // Check if all items in this package are complete
          const allComplete = updatedItems.every(item => item.scanned >= item.needed);

          const updatedPackage = {
            ...pkg,
            items: updatedItems,
            status: allComplete ? ('completed' as const) : ('in-progress' as const),
          };

          // Auto-update WooCommerce status if package is complete
          if (allComplete && pkg.status !== 'completed') {
            updateWooCommerceStatus(pkg.orderId, 'completed');
          }

          return updatedPackage;
        }
        return pkg;
      });

      setPackages(updatedPackages);

      // Show success feedback
      const remainingForThisItem = foundItem!.needed - (foundItem!.scanned + 1);
      const packageComplete = updatedPackages
        .find(p => p.id === foundPackage!.id)!
        .items.every(item => item.scanned >= item.needed);

      setScanFeedback({
        success: true,
        message: packageComplete
          ? `Paket završen za ${foundPackage!.customerName}!`
          : remainingForThisItem > 0
            ? `Stavka dodana! Još ${remainingForThisItem} "${foundItem!.name}" potrebno za ${foundPackage!.customerName}`
            : `"${foundItem!.name}" završen za ${foundPackage!.customerName}!`,
        packageInfo: {
          packageId: foundPackage!.id,
          orderNumber: foundPackage!.orderNumber,
          customerName: foundPackage!.customerName,
          shippingAddress: formatAddress(foundPackage!.shippingAddress),
          remainingItems: updatedPackages
            .find(p => p.id === foundPackage!.id)!
            .items.reduce((sum, item) => sum + Math.max(0, item.needed - item.scanned), 0),
          totalItems: foundPackage!.items.reduce((sum, item) => sum + item.needed, 0),
          isComplete: packageComplete,
        },
        urgency: packageComplete ? 'high' : 'low',
        sound: packageComplete ? 'success' : 'success',
      });
    } catch (error) {
      console.error('Error processing product:', error);
      setScanFeedback({
        success: false,
        message: `Greška pri obradi "${code}". Molimo pokušajte ponovo.`,
        urgency: 'high',
        sound: 'error',
      });
    }
  };

  const resetPackage = async (packageId: string) => {
    const updatedPackages = packages.map(pkg => {
      if (pkg.id === packageId) {
        // Reset all items to 0 scanned
        const resetItems = pkg.items.map(item => ({ ...item, scanned: 0 }));

        // Update WooCommerce status back to processing
        updateWooCommerceStatus(pkg.orderId, 'processing');

        return {
          ...pkg,
          status: 'in-progress' as const,
          items: resetItems,
        };
      }
      return pkg;
    });

    setPackages(updatedPackages);
  };

  const getPackageProgress = (pkg: PackageType) => {
    const totalItems = pkg.items.reduce((sum, item) => sum + item.needed, 0);
    const scannedItems = pkg.items.reduce((sum, item) => sum + item.scanned, 0);
    return {
      scanned: scannedItems,
      total: totalItems,
      percentage: totalItems > 0 ? (scannedItems / totalItems) * 100 : 0,
    };
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Učitavam podatke za pakiranje...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Greška: {error}</p>
          <Button onClick={() => window.location.reload()}>Pokušaj ponovo</Button>
        </div>
      </div>
    );
  }

  const completedPackages = packages.filter(pkg => pkg.status === 'completed').length;
  const totalPackages = packages.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex flex-col items-center mb-4">
          <div className="flex items-center gap-3">
            <Package className="h-6 w-6 text-amber-600" />
            <h1 className="text-2xl font-bold text-gray-900 text-center">Pakiranje</h1>
          </div>
        </div>
        {/* Calendar */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-center">Odaberi datum</CardTitle>
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
        {/* Scanner */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex justify-center mb-4">
              <Button
                onClick={() => setScannerActive(!scannerActive)}
                variant={scannerActive ? 'destructive' : 'default'}
                size="sm"
              >
                <Scan className="mr-2 h-4 w-4" />
                {scannerActive ? 'Zaustavi skeniranje' : 'Pokreni skeniranje'}
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
                placeholder="Upiši SKU ručno..."
                value={manualSku}
                onChange={e => setManualSku(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleManualEntry()}
                className="flex-1"
              />
              <Button onClick={handleManualEntry} disabled={!manualSku.trim()}>
                Dodaj
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
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p
                            className={`font-medium ${
                              scanFeedback.success ? 'text-green-800' : 'text-red-800'
                            }`}
                          >
                            {scanFeedback.message}
                          </p>

                          {scanFeedback.multiplePackages && (
                            <div className="mt-3">
                              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <Package className="h-4 w-4 text-yellow-600" />
                                  <span className="font-semibold text-yellow-800">
                                    Odaberi paket
                                  </span>
                                </div>
                                <p className="text-sm text-yellow-700 mb-3">
                                  Više kupaca je naručilo ovaj proizvod. Klikni na paket u koji ga
                                  želiš dodati:
                                </p>
                                <div className="space-y-2">
                                  {scanFeedback.multiplePackages.map(pkg => (
                                    <button
                                      key={pkg.packageId}
                                      onClick={() => {
                                        // Find the specific package and process the product for it
                                        const targetPackage = packages.find(
                                          p => p.id === pkg.packageId
                                        );
                                        if (targetPackage && scanFeedback.productInfo) {
                                          // Process for this specific package
                                          const item = targetPackage.items.find(
                                            item =>
                                              item.sku === scanFeedback.productInfo!.sku ||
                                              item.name === scanFeedback.productInfo!.name
                                          );
                                          if (item) {
                                            // Update only this package
                                            const updatedPackages = packages.map(p => {
                                              if (p.id === pkg.packageId) {
                                                const updatedItems = p.items.map(i => {
                                                  if (i.sku === item.sku) {
                                                    return {
                                                      ...i,
                                                      scanned: Math.min(i.scanned + 1, i.needed),
                                                    };
                                                  }
                                                  return i;
                                                });
                                                const allComplete = updatedItems.every(
                                                  i => i.scanned >= i.needed
                                                );

                                                const updatedPackage = {
                                                  ...p,
                                                  items: updatedItems,
                                                  status: allComplete
                                                    ? ('completed' as const)
                                                    : ('in-progress' as const),
                                                };

                                                // Auto-update WooCommerce status if package is complete
                                                if (allComplete && p.status !== 'completed') {
                                                  updateWooCommerceStatus(p.orderId, 'completed');
                                                }

                                                return updatedPackage;
                                              }
                                              return p;
                                            });
                                            setPackages(updatedPackages);

                                            // Check if the package is now complete for better feedback message
                                            const completedPackage = updatedPackages.find(
                                              p => p.id === pkg.packageId
                                            );
                                            const isPackageComplete =
                                              completedPackage?.status === 'completed';

                                            setScanFeedback({
                                              success: true,
                                              message: isPackageComplete
                                                ? `Package complete for ${pkg.customerName}!`
                                                : `Added to ${pkg.customerName}'s package`,
                                              urgency: isPackageComplete ? 'high' : 'low',
                                              sound: 'success',
                                            });
                                          }
                                        }
                                      }}
                                      className="w-full p-3 text-left bg-white border border-yellow-200 rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="font-medium">{pkg.customerName}</div>
                                          <div className="text-sm text-gray-600">
                                            Order #{pkg.orderNumber}
                                          </div>
                                        </div>
                                        <Badge variant="outline" className="text-xs">
                                          {pkg.remaining} needed
                                        </Badge>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {scanFeedback.packageInfo && !scanFeedback.multiplePackages && (
                            <div className="mt-3">
                              <div className="bg-white p-3 rounded-lg border">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Package className="h-4 w-4 text-amber-600" />
                                    <span className="font-semibold text-amber-800">
                                      <span className="font-semibold text-amber-800">#</span>
                                      {scanFeedback.packageInfo.orderNumber}
                                    </span>
                                  </div>
                                  <Badge
                                    variant={
                                      scanFeedback.packageInfo.isComplete ? 'default' : 'secondary'
                                    }
                                  >
                                    {scanFeedback.packageInfo.isComplete
                                      ? 'Complete'
                                      : 'In Progress'}
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
                                    <span className="text-xs text-gray-600 leading-tight">
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
                                        {scanFeedback.packageInfo.remainingItems} preostalo
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={dismissFeedback}
                            className="px-3 py-1 text-sm"
                          >
                            Zatvori
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Progress Overview */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Napredak paketa</span>
              <span className="text-sm text-gray-600">
                {completedPackages}/{totalPackages}
              </span>
            </div>
            <Progress
              value={totalPackages > 0 ? (completedPackages / totalPackages) * 100 : 0}
              className="h-3"
            />
            {completedPackages === totalPackages && totalPackages > 0 && (
              <div className="mt-3 text-center">
                <Badge className="bg-green-600">Svi paketi završeni!</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Packages List */}
        <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {packages.map(pkg => {
            const progress = getPackageProgress(pkg);
            const estimatedWeight = calculatePackageWeight(pkg);
            return (
              <Card
                key={pkg.id}
                className={`${
                  pkg.status === 'completed'
                    ? 'bg-green-50 border-green-200'
                    : 'bg-white border-gray-200'
                } transition-all duration-200`}
              >
                <CardContent className="p-4">
                  {/* Package Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-amber-600" />
                      <span className="font-semibold text-amber-800">#</span>
                      <span className="font-semibold text-amber-800">{pkg.orderNumber}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={pkg.status === 'completed' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {pkg.status === 'completed' ? 'Završeno' : 'U tijeku'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resetPackage(pkg.id)}
                        className="h-6 w-6 p-0"
                        title="Resetiraj paket"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-3 w-3 text-gray-500" />
                      <span className="font-medium text-sm">{pkg.customerName}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3 w-3 text-gray-500 mt-0.5" />
                      <span className="text-xs text-gray-600 leading-tight">
                        {formatAddress(pkg.shippingAddress)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Package className="h-3 w-3 text-gray-500" />
                      <span className="text-xs text-gray-600">
                        Procj. težina: {estimatedWeight.toFixed(1)}kg
                      </span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Napredak</span>
                      <span>
                        {progress.scanned}/{progress.total}
                      </span>
                    </div>
                    <Progress value={progress.percentage} className="h-2" />
                  </div>

                  {/* Items */}
                  <div className="space-y-2">
                    {pkg.items.map(item => (
                      <div
                        key={item.sku}
                        className={`flex items-center gap-3 p-2 rounded-lg ${
                          item.scanned >= item.needed
                            ? 'bg-green-100 border border-green-200'
                            : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        {/* Product Image - smaller on mobile, larger on desktop */}
                        <div className="w-8 h-8 md:w-12 md:h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <Package className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h4
                            className={`font-medium text-xs md:text-sm leading-tight mb-1 ${
                              item.scanned >= item.needed
                                ? 'text-green-800 line-through'
                                : 'text-gray-900'
                            }`}
                          >
                            {item.name}
                          </h4>
                          <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                        </div>

                        {/* Quantity Status */}
                        <div className="flex-shrink-0 text-right">
                          <Badge
                            variant={item.scanned >= item.needed ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {item.scanned}/{item.needed}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Empty State */}
        {packages.length === 0 && !loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-600 mb-4">Nema paketa za ovaj datum</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
