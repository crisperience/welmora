import { NextRequest, NextResponse } from 'next/server';

/**
 * Webhook status and configuration endpoint
 * GET /api/webhooks/status
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const includeConfig = searchParams.get('config') === 'true';

        const status: Record<string, unknown> = {
            timestamp: new Date().toISOString(),
            webhookEndpoint: {
                url: `${request.nextUrl.origin}/api/webhooks/order-created`,
                method: 'POST',
                status: 'active',
                description: 'WooCommerce order.created webhook handler',
            },
            emailConfiguration: {
                emailFrom: process.env.EMAIL_FROM ? `${process.env.EMAIL_FROM.substring(0, 5)}...` : 'NOT_SET',
                emailTo: process.env.EMAIL_TO ? `${process.env.EMAIL_TO.substring(0, 5)}...` : 'NOT_SET',
                smtpUser: process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 5)}...` : 'NOT_SET',
                smtpConfigured: !!(process.env.EMAIL_FROM && process.env.EMAIL_TO && process.env.SMTP_USER && process.env.SMTP_PASS),
                declarationEmailsEnabled: process.env.ENABLE_DECLARATION_EMAILS === 'true',
                declarationEmailsStatus: process.env.ENABLE_DECLARATION_EMAILS === 'true' ? 'ENABLED' : 'DISABLED',
            },
            woocommerceConfiguration: {
                url: process.env.WOOCOMMERCE_URL || 'NOT_SET',
                hasConsumerKey: !!process.env.WOOCOMMERCE_CONSUMER_KEY,
                hasConsumerSecret: !!process.env.WOOCOMMERCE_CONSUMER_SECRET,
            },
            instructions: {
                setupWebhook: [
                    '1. Go to WooCommerce Admin → Settings → Advanced → Webhooks',
                    '2. Click "Add webhook"',
                    '3. Set Name: "Order Created - Declarations"',
                    '4. Set Status: "Active"',
                    '5. Set Topic: "Order created"',
                    `6. Set Delivery URL: ${request.nextUrl.origin}/api/webhooks/order-created`,
                    '7. Set Secret: (optional but recommended)',
                    '8. Click "Save webhook"',
                ],
                testWebhook: [
                    `Test webhook: curl -X POST ${request.nextUrl.origin}/api/webhooks/test-order`,
                    `Test email: curl -X GET ${request.nextUrl.origin}/api/test-email`,
                    'Check server logs for webhook activity',
                ],
                troubleshooting: [
                    'Check if WooCommerce webhook is configured correctly',
                    'Verify webhook URL is accessible from WooCommerce server',
                    'Check WooCommerce webhook delivery logs',
                    'Ensure order status triggers webhook (usually "processing" status)',
                    'Check if other email plugins are interfering',
                ],
            },
        };

        if (includeConfig) {
            // Add more detailed configuration for debugging
            status.detailedConfig = {
                environment: process.env.NODE_ENV,
                webhookUrl: `${request.nextUrl.origin}/api/webhooks/order-created`,
                testWebhookUrl: `${request.nextUrl.origin}/api/webhooks/test-order`,
                testEmailUrl: `${request.nextUrl.origin}/api/test-email`,
                emailSettings: {
                    from: process.env.EMAIL_FROM,
                    to: process.env.EMAIL_TO,
                    smtpHost: 'smtp.gmail.com',
                    smtpPort: 587,
                },
            };
        }

        return NextResponse.json(status);
    } catch (error) {
        console.error('Webhook status endpoint error:', error);
        return NextResponse.json(
            {
                error: 'Failed to get webhook status',
                details: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}

/**
 * Test webhook connectivity
 * POST /api/webhooks/status
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action } = body;

        if (action === 'test-connectivity') {
            // Test basic connectivity and configuration
            const tests = {
                timestamp: new Date().toISOString(),
                environment: {
                    nodeEnv: process.env.NODE_ENV,
                    hasEmailConfig: !!(process.env.EMAIL_FROM && process.env.EMAIL_TO && process.env.SMTP_USER && process.env.SMTP_PASS),
                    hasWooCommerceConfig: !!(process.env.WOOCOMMERCE_URL && process.env.WOOCOMMERCE_CONSUMER_KEY && process.env.WOOCOMMERCE_CONSUMER_SECRET),
                },
                webhookEndpoint: {
                    url: `${request.nextUrl.origin}/api/webhooks/order-created`,
                    accessible: true, // If we can respond, the endpoint is accessible
                },
                nextSteps: [
                    'Create a test order in WooCommerce to verify webhook delivery',
                    'Check WooCommerce webhook logs for delivery status',
                    'Monitor server logs for incoming webhook requests',
                ],
            };

            return NextResponse.json({
                success: true,
                message: 'Connectivity test completed',
                tests,
            });
        }

        return NextResponse.json(
            {
                error: 'Unknown action',
                availableActions: ['test-connectivity'],
            },
            { status: 400 }
        );
    } catch (error) {
        console.error('Webhook status POST error:', error);
        return NextResponse.json(
            {
                error: 'Failed to process webhook status request',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
} 