'use client'

import BarcodeScanner from '@/components/scanner/BarcodeScanner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function TestScanPage() {
    const router = useRouter()
    const [scannerActive, setScannerActive] = useState(false)
    const [manualCode, setManualCode] = useState('')
    const [testDate, setTestDate] = useState('2024-12-30')
    const [scanResult, setScanResult] = useState<string | null>(null)
    const [scanLoading, setScanLoading] = useState(false)

    const handleScan = async (scannedCode: string) => {
        await testScan(scannedCode)
    }

    const handleManualScan = async () => {
        if (manualCode.trim()) {
            await testScan(manualCode.trim())
        }
    }

    const testScan = async (code: string) => {
        try {
            setScanLoading(true)
            setScanResult(null)

            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scannedCode: code,
                    date: testDate
                })
            })

            const result = await response.json()

            if (result.success && result.product) {
                setScanResult(`✅ FOUND: ${result.product.message}`)
            } else {
                setScanResult(`❌ NOT FOUND: ${result.error || 'Product not found'}`)
            }
        } catch (err) {
            setScanResult(`❌ ERROR: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
            setScanLoading(false)
        }
    }

    // Test codes based on real WooCommerce data
    const testCodes = [
        { code: '4251758424389', description: 'Calgon gel SKU' },
        { code: '3282', description: 'Order ID' },
        { code: 'calgon', description: 'Product name search' },
        { code: 'detergent', description: 'Product name search' },
        { code: 'invalid123', description: 'Invalid code (should fail)' }
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Button variant="outline" onClick={() => router.push('/')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Button>
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900">Scanner Test</h1>
                        <p className="text-gray-600">Test barcode/QR scanning functionality</p>
                    </div>
                    <div className="w-20"></div>
                </div>

                {/* Test Date Selection */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Test Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label htmlFor="testDate">Test Date (YYYY-MM-DD)</Label>
                            <Input
                                id="testDate"
                                type="date"
                                value={testDate}
                                onChange={(e) => setTestDate(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Scanner Section */}
                <div className="mb-6">
                    <BarcodeScanner
                        onScan={handleScan}
                        isActive={scannerActive}
                        onToggle={() => setScannerActive(!scannerActive)}
                    />
                </div>

                {/* Manual Code Input */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Manual Code Entry</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input
                                placeholder="Enter barcode or product code"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleManualScan()}
                            />
                            <Button onClick={handleManualScan} disabled={!manualCode.trim()}>
                                Test Scan
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Test Codes */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Quick Test Codes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p className="text-sm text-gray-600 mb-4">
                            Click any button to test with predefined codes from Order #3282:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {testCodes.map((test, index) => (
                                <Button
                                    key={index}
                                    variant="outline"
                                    onClick={() => testScan(test.code)}
                                    className="justify-start text-left"
                                >
                                    <div>
                                        <div className="font-mono text-sm">{test.code}</div>
                                        <div className="text-xs text-gray-500">{test.description}</div>
                                    </div>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Scan Loading State */}
                {scanLoading && (
                    <Card className="mb-6">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                <span className="text-sm text-gray-600">Processing scan...</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Scan Result */}
                {scanResult && !scanLoading && (
                    <Card className="mb-6">
                        <CardContent className="p-4">
                            <h3 className="font-medium mb-2">Scan Result:</h3>
                            <p className={`text-sm font-medium ${scanResult.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>
                                {scanResult}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Instructions */}
                <Card>
                    <CardHeader>
                        <CardTitle>How to Test</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="text-sm text-gray-600 space-y-2">
                            <p><strong>Camera Scanner:</strong> Click &quot;Start Scanner&quot; to use your device camera to scan QR codes or barcodes.</p>
                            <p><strong>Manual Entry:</strong> Type or paste a code in the manual input field and click &quot;Test Scan&quot;.</p>
                            <p><strong>Quick Test:</strong> Use the predefined test codes to verify API functionality.</p>
                            <p><strong>Date Selection:</strong> Change the test date to match when orders were placed.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
} 