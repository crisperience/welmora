'use client'

import BarcodeScanner from '@/components/scanner/BarcodeScanner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, CheckCircle, Package, Scan, User } from 'lucide-react'
import Image from 'next/image'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

interface PackageItem {
    sku: string
    name: string
    needed: number
    scanned: number
    image?: string
}

interface PackageType {
    id: string
    customerName: string
    customerEmail: string
    items: PackageItem[]
    status: 'pending' | 'in-progress' | 'completed'
}

export default function PackingPage() {
    const params = useParams()
    const router = useRouter()
    const [packages, setPackages] = useState<PackageType[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [scannerActive, setScannerActive] = useState(false)
    const [scanMessage, setScanMessage] = useState<string>('')
    const [manualSku, setManualSku] = useState('')

    const date = Array.isArray(params.date) ? params.date[0] : params.date

    const fetchPackingData = useCallback(async () => {
        try {
            setLoading(true)
            const response = await fetch(`/api/packing/${date}`)

            if (!response.ok) {
                throw new Error('Failed to fetch packing data')
            }

            const data = await response.json()
            // API directly returns array of packages
            setPackages(Array.isArray(data) ? data : [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setLoading(false)
        }
    }, [date])

    // Load state from localStorage
    useEffect(() => {
        const savedState = localStorage.getItem(`packing-${date}`)
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState)
                setPackages(parsed)
                setLoading(false)
                return
            } catch (e) {
                console.error('Failed to parse saved state:', e)
            }
        }

        if (date) {
            fetchPackingData()
        }
    }, [date, fetchPackingData])

    // Save state to localStorage whenever packages change
    useEffect(() => {
        if (packages.length > 0) {
            localStorage.setItem(`packing-${date}`, JSON.stringify(packages))
        }
    }, [packages, date])

    const handleScan = async (scannedCode: string) => {
        processProduct(scannedCode)
    }

    const handleManualEntry = () => {
        if (manualSku.trim()) {
            processProduct(manualSku.trim())
            setManualSku('')
        }
    }

    const processProduct = (code: string) => {
        try {
            setScanMessage('Processing...')

            // Find which package contains this SKU
            let foundPackage: PackageType | null = null
            let foundItem: PackageItem | null = null

            for (const pkg of packages) {
                const item = pkg.items.find(item => item.sku === code)
                if (item) {
                    foundPackage = pkg
                    foundItem = item
                    break
                }
            }

            if (!foundPackage || !foundItem) {
                setScanMessage(`❌ Product ${code} not found in any package`)
                return
            }

            if (foundItem.scanned >= foundItem.needed) {
                setScanMessage(`✅ ${foundItem.name} - Already complete!`)
                return
            }

            // Update the item
            const updatedPackages = packages.map(pkg => {
                if (pkg.id === foundPackage!.id) {
                    const updatedItems = pkg.items.map(item => {
                        if (item.sku === code) {
                            return {
                                ...item,
                                scanned: Math.min(item.scanned + 1, item.needed)
                            }
                        }
                        return item
                    })

                    // Check if package is complete
                    const allComplete = updatedItems.every(item => item.scanned >= item.needed)

                    return {
                        ...pkg,
                        items: updatedItems,
                        status: allComplete ? 'completed' as const : 'in-progress' as const
                    }
                }
                return pkg
            })

            setPackages(updatedPackages)

            const remaining = foundItem.needed - (foundItem.scanned + 1)
            if (remaining <= 0) {
                setScanMessage(`✅ ${foundItem.name} - DONE for ${foundPackage.customerName}!`)
            } else {
                setScanMessage(`📦 ${foundItem.name} - Need ${remaining} more for ${foundPackage.customerName}`)
            }

        } catch {
            setScanMessage('❌ Processing failed')
        }
    }

    const togglePackageStatus = (packageId: string) => {
        setPackages(prev => prev.map(pkg => {
            if (pkg.id === packageId) {
                const newStatus = pkg.status === 'completed' ? 'pending' : 'completed'
                // If marking as completed, mark all items as scanned
                if (newStatus === 'completed') {
                    const updatedItems = pkg.items.map(item => ({
                        ...item,
                        scanned: item.needed
                    }))
                    return { ...pkg, status: newStatus, items: updatedItems }
                } else {
                    // If marking as pending, reset all items
                    const updatedItems = pkg.items.map(item => ({
                        ...item,
                        scanned: 0
                    }))
                    return { ...pkg, status: newStatus, items: updatedItems }
                }
            }
            return pkg
        }))
    }

    const getPackageProgress = (pkg: PackageType) => {
        const totalNeeded = pkg.items.reduce((sum, item) => sum + item.needed, 0)
        const totalScanned = pkg.items.reduce((sum, item) => sum + item.scanned, 0)
        return {
            totalNeeded,
            totalScanned,
            percentage: totalNeeded > 0 ? (totalScanned / totalNeeded) * 100 : 0
        }
    }

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading...</p>
                </div>
            </div>
        )
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
        )
    }

    const completedPackages = packages.filter(pkg => pkg.status === 'completed').length
    const totalPackages = packages.length

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <Button
                    variant="ghost"
                    onClick={() => router.push('/')}
                    className="p-2"
                >
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
                            variant={scannerActive ? "destructive" : "default"}
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
                            onChange={(e) => setManualSku(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleManualEntry()}
                            className="flex-1"
                        />
                        <Button onClick={handleManualEntry} disabled={!manualSku.trim()}>
                            Add
                        </Button>
                    </div>

                    {scanMessage && (
                        <div className="p-3 bg-gray-50 rounded-lg text-sm">
                            {scanMessage}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Packages */}
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {packages.map((pkg) => {
                    const progress = getPackageProgress(pkg)

                    return (
                        <Card
                            key={pkg.id}
                            className={`${pkg.status === 'completed'
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
                                        <User className="h-5 w-5 text-gray-600" />
                                        <div>
                                            <h3 className="font-semibold">{pkg.customerName}</h3>
                                            <p className="text-sm text-gray-600">{pkg.customerEmail}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Badge
                                            variant={
                                                pkg.status === 'completed' ? 'default' : 'secondary'
                                            }
                                        >
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

                                {/* Progress Bar */}
                                <div className="mb-4">
                                    <Progress value={progress.percentage} className="h-2" />
                                </div>

                                {/* Package Items */}
                                <div className="space-y-2">
                                    {pkg.items.map((item) => (
                                        <div
                                            key={item.sku}
                                            className={`flex items-center gap-3 p-2 rounded-lg ${item.scanned >= item.needed
                                                ? 'bg-green-100'
                                                : 'bg-gray-50'
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
                                                            e.currentTarget.style.display = 'none'
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
                                                    <span className={`font-medium text-sm truncate ${item.scanned >= item.needed
                                                        ? 'text-green-800 line-through'
                                                        : 'text-gray-900'
                                                        }`}>
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-gray-500 ml-6">
                                                    SKU: {item.sku}
                                                </div>
                                            </div>
                                            <Badge
                                                variant={item.scanned >= item.needed ? "default" : "secondary"}
                                                className="ml-2"
                                            >
                                                {item.scanned}/{item.needed}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )
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
                                <Badge className="bg-green-600">
                                    🎉 All Packages Done!
                                </Badge>
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
                        <Button
                            onClick={() => router.push('/')}
                            className="mt-4"
                            variant="outline"
                        >
                            Back to Home
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
} 