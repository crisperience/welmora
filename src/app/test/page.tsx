'use client'

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import { useState } from 'react'

interface TestResult {
    success: boolean
    message: string
    data?: boolean
    error?: string
}

interface TestResults {
    supabase: TestResult
    woocommerce: TestResult
}

export default function TestPage() {
    const [results, setResults] = useState<TestResults | null>(null)
    const [loading, setLoading] = useState(false)

    const runTests = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/test')
            const data = await response.json()

            if (data.services) {
                setResults(data.services)
            } else {
                setResults({
                    supabase: { success: false, message: 'Failed to get response' },
                    woocommerce: { success: false, message: 'Failed to get response' }
                })
            }
        } catch (error) {
            setResults({
                supabase: { success: false, message: 'Connection test failed', error: error instanceof Error ? error.message : 'Unknown error' },
                woocommerce: { success: false, message: 'Connection test failed', error: error instanceof Error ? error.message : 'Unknown error' }
            })
        } finally {
            setLoading(false)
        }
    }

    const StatusIcon = ({ success }: { success: boolean }) => {
        return success ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
            <XCircle className="h-5 w-5 text-red-600" />
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
            <div className="container mx-auto px-4 py-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                        Connection Tests
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">
                        Test connections to Supabase and WooCommerce
                    </p>

                    <Button
                        onClick={runTests}
                        disabled={loading}
                        className="mb-6"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Testing Connections...
                            </>
                        ) : (
                            'Run Connection Tests'
                        )}
                    </Button>
                </div>

                {results && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        {/* Supabase Test Results */}
                        <Card className={`${results.supabase.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} dark:bg-opacity-20`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <StatusIcon success={results.supabase.success} />
                                    Supabase Connection
                                    <Badge variant={results.supabase.success ? 'default' : 'destructive'}>
                                        {results.supabase.success ? 'Connected' : 'Failed'}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    Database connection and authentication status
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="text-sm">
                                        <strong>Status:</strong> {results.supabase.message}
                                    </p>
                                    {results.supabase.error && (
                                        <p className="text-sm text-red-600">
                                            <strong>Error:</strong> {results.supabase.error}
                                        </p>
                                    )}
                                    {results.supabase.data && (
                                        <div className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                            <strong>Data:</strong> Connection successful
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* WooCommerce Test Results */}
                        <Card className={`${results.woocommerce.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'} dark:bg-opacity-20`}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <StatusIcon success={results.woocommerce.success} />
                                    WooCommerce Connection
                                    <Badge variant={results.woocommerce.success ? 'default' : 'destructive'}>
                                        {results.woocommerce.success ? 'Connected' : 'Failed'}
                                    </Badge>
                                </CardTitle>
                                <CardDescription>
                                    WooCommerce REST API connection status
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="text-sm">
                                        <strong>Status:</strong> {results.woocommerce.message}
                                    </p>
                                    {results.woocommerce.error && (
                                        <p className="text-sm text-red-600">
                                            <strong>Error:</strong> {results.woocommerce.error}
                                        </p>
                                    )}
                                    {results.woocommerce.data && (
                                        <div className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                            <strong>Sample Data:</strong> Connection successful
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Environment Info */}
                <Card className="mt-8 max-w-4xl mx-auto">
                    <CardHeader>
                        <CardTitle>Environment Configuration</CardTitle>
                        <CardDescription>Current environment settings</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <strong>Supabase URL:</strong><br />
                                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                    {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configured ✓' : 'Missing ✗'}
                                </code>
                            </div>
                            <div>
                                <strong>WooCommerce URL:</strong><br />
                                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                    {process.env.NEXT_PUBLIC_WOOCOMMERCE_URL || 'https://welmora.ch/'}
                                </code>
                            </div>
                            <div>
                                <strong>Supabase Anon Key:</strong><br />
                                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                    {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configured ✓' : 'Missing ✗'}
                                </code>
                            </div>
                            <div>
                                <strong>WooCommerce Auth:</strong><br />
                                <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                    API Keys {process.env.WOOCOMMERCE_CONSUMER_KEY ? 'Configured ✓' : 'Missing ✗'}
                                </code>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="text-center mt-8">
                    <Button variant="outline" onClick={() => window.location.href = '/'}>
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        </div>
    )
} 