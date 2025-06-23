import { getOrdersByDateRange } from '@/lib/woocommerce/client'
import { NextResponse } from 'next/server'

interface ScanRequest {
    scannedCode: string
    date: string
}

interface ScanResponse {
    success: boolean
    product?: {
        name: string
        sku: string
        packageId: string
        orderId: number
        customerName: string
        needed: number
        scanned: number
        message: string
    }
    error?: string
}

export async function POST(request: Request): Promise<NextResponse<ScanResponse>> {
    try {
        const body: ScanRequest = await request.json()
        const { scannedCode, date } = body

        if (!scannedCode || !date) {
            return NextResponse.json({
                success: false,
                error: 'Missing scannedCode or date'
            }, { status: 400 })
        }

        // Get orders for the specified date
        const yesterday = new Date(date)
        yesterday.setDate(yesterday.getDate() - 1)
        const startDate = yesterday.toISOString().split('T')[0]
        const endDate = date

        const ordersResult = await getOrdersByDateRange(startDate, endDate)

        if (!ordersResult.success || !ordersResult.data) {
            return NextResponse.json({
                success: false,
                error: 'Failed to fetch orders for the specified date'
            }, { status: 500 })
        }

        // Search for the scanned product in all orders
        for (const order of ordersResult.data) {
            for (const item of order.line_items) {
                // Try to match by SKU, product_id, or name
                const matchesSku = item.sku === scannedCode
                const matchesProductId = item.product_id.toString() === scannedCode
                const matchesName = item.name.toLowerCase().includes(scannedCode.toLowerCase())

                if (matchesSku || matchesProductId || matchesName) {
                    // Found the product! Return package information
                    const customerName = `${order.billing.first_name} ${order.billing.last_name}`

                    return NextResponse.json({
                        success: true,
                        product: {
                            name: item.name,
                            sku: item.sku || `product-${item.product_id}`,
                            packageId: `package-${order.id}`,
                            orderId: order.id,
                            customerName: customerName,
                            needed: item.quantity,
                            scanned: 0, // This would be updated in a real implementation with state management
                            message: `This product goes to PACKAGE ${order.id} - ${customerName} (needed: ${item.quantity}x)`
                        }
                    })
                }
            }
        }

        // Product not found in any order
        return NextResponse.json({
            success: false,
            error: `Product with code "${scannedCode}" not found in orders for ${date}`
        }, { status: 404 })

    } catch (error) {
        console.error('Error in scan API:', error)
        return NextResponse.json({
            success: false,
            error: 'Internal server error'
        }, { status: 500 })
    }
} 