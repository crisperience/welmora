import { sendEmailWithAttachment } from '@/lib/services/sendEmailWithAttachment';
import JSZip from 'jszip';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to verify email delivery
 * GET /api/test-email
 */
export async function GET() {
    try {
        console.log('=== EMAIL TEST ENDPOINT ===');

        // Create a proper ZIP file with test content
        const zip = new JSZip();
        const testContent = `Test Email from Welmora System
        
Test performed at: ${new Date().toISOString()}
Order ID: 99999
Customer: Test Customer
Total: 99.99 CHF
Items: 2

This is a test email to verify the email delivery system is working correctly.
`;

        // Add test file to ZIP
        zip.file('test-declaration.txt', testContent);

        // Generate ZIP buffer
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // Mock order details for testing
        const testOrderDetails = {
            customerName: 'Test Customer',
            customerEmail: 'test@example.com',
            totalValue: '99.99 CHF',
            itemCount: 2,
        };

        // Send test email
        const emailResult = await sendEmailWithAttachment(zipBuffer, 99999, testOrderDetails);

        if (!emailResult.success) {
            console.error('Test email failed:', emailResult.error);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Test email failed',
                    details: emailResult.error,
                    debug: emailResult.debug,
                },
                { status: 500 }
            );
        }

        console.log('Test email sent successfully');
        console.log('=== EMAIL TEST ENDPOINT END ===');

        return NextResponse.json({
            success: true,
            message: 'Test email sent successfully',
            messageId: emailResult.messageId,
            debug: emailResult.debug,
            instructions: [
                'Check your spam/junk folder in info@welmora.ch',
                'Verify email filters are not blocking emails',
                'Check if email client is syncing properly',
                'Look for emails with subject: "Nova narudžba #99999 - Deklaracije"',
                'The email should contain a ZIP file with test-declaration.txt',
            ],
        });
    } catch (error) {
        console.error('Test email endpoint error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Test email endpoint failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { customMessage, orderId } = body;

        console.log('=== CUSTOM EMAIL TEST ===');

        // Create custom test content
        const testContent = Buffer.from(customMessage || 'Custom test email from Welmora system\n\nTest performed at: ' + new Date().toISOString());

        // Mock order details for testing
        const testOrderDetails = {
            customerName: 'Custom Test Customer',
            customerEmail: 'custom-test@example.com',
            totalValue: '149.99 CHF',
            itemCount: 3,
        };

        // Send custom test email
        const emailResult = await sendEmailWithAttachment(testContent, orderId || 88888, testOrderDetails);

        if (!emailResult.success) {
            console.error('Custom test email failed:', emailResult.error);
            return NextResponse.json(
                {
                    success: false,
                    error: 'Custom test email failed',
                    details: emailResult.error,
                    debug: emailResult.debug,
                },
                { status: 500 }
            );
        }

        console.log('Custom test email sent successfully');
        console.log('=== CUSTOM EMAIL TEST END ===');

        return NextResponse.json({
            success: true,
            message: 'Custom test email sent successfully',
            messageId: emailResult.messageId,
            debug: emailResult.debug,
            customMessage: customMessage || 'Default custom message',
        });
    } catch (error) {
        console.error('Custom test email endpoint error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Custom test email endpoint failed',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
} 