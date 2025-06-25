import { generateZipFromSkus } from '@/lib/generateZipFromSkus';
import { sendEmailWithAttachment } from '@/lib/sendEmailWithAttachment';
import { NextRequest, NextResponse } from 'next/server';

interface WooCommerceWebhookOrder {
  id: number;
  number?: string;
  date_created: string;
  status: string;
  total: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    company?: string;
    address_1: string;
    address_2?: string;
    city: string;
    state?: string;
    postcode: string;
    country: string;
    phone?: string;
  };
  line_items: WooCommerceLineItem[];
}

interface WooCommerceLineItem {
  sku?: string;
  name: string;
  quantity: number;
  price: string;
  product_id: number;
  meta_data?: Array<{
    key: string;
    value: string;
  }>;
}

/**
 * Handle WooCommerce order.created webhook
 * Generates ZIP with sticker PDFs and sends email
 * Uses SKU-only search since SKUs are unique identifiers
 */
export async function POST(request: NextRequest) {
  try {
    console.log('=== WooCommerce Order Created Webhook ===');

    // Parse webhook payload
    const webhookData = await request.json();
    console.log('Webhook received:', {
      id: webhookData.id,
      status: webhookData.status,
      total: webhookData.total,
      line_items_count: webhookData.line_items?.length || 0,
    });

    const order = webhookData as WooCommerceWebhookOrder;

    // Validate required data
    if (!order.id || !order.line_items || order.line_items.length === 0) {
      console.error('Invalid webhook data: missing order ID or line items');
      return NextResponse.json({ error: 'Invalid webhook data' }, { status: 400 });
    }

    // Extract order details for email
    const orderDetails = {
      customerName: `${order.billing.first_name} ${order.billing.last_name}`,
      customerEmail: order.billing.email,
      totalValue: order.total,
      itemCount: order.line_items.length,
    };

    // Step 1: Extract SKUs from line items (no brand needed!)
    console.log('Step 1: Extracting SKUs from line items...');
    const skuItems = order.line_items.map(item => ({
      sku: item.sku || `product-${item.product_id}`,
    }));

    console.log('Extracted SKUs:', skuItems.map(item => item.sku));

    // Filter out items without valid SKUs
    const validSkus = skuItems.filter(item => item.sku && !item.sku.startsWith('product-'));

    if (validSkus.length === 0) {
      console.warn('No valid SKUs found, sending email without attachments');

      // Still send notification email but without ZIP
      const emptyBuffer = Buffer.from('No valid SKUs found for this order');
      const emailResult = await sendEmailWithAttachment(emptyBuffer, order.id, orderDetails);

      return NextResponse.json({
        success: true,
        message: 'Webhook processed but no valid SKUs found',
        orderId: order.id,
        validSkus: 0,
        emailSent: emailResult.success,
        emailError: emailResult.error,
      });
    }

    console.log(`Found ${validSkus.length} valid SKUs out of ${skuItems.length} items`);

    // Step 2: Generate ZIP with PDFs (SKU-only search)
    console.log('Step 2: Generating ZIP file using SKU-only search...');
    const zipBuffer = await generateZipFromSkus(validSkus, order.id);

    console.log(`ZIP generated: ${zipBuffer.length} bytes`);

    // Step 3: Send email with attachment
    console.log('Step 3: Sending email...');
    const emailResult = await sendEmailWithAttachment(zipBuffer, order.id, orderDetails);

    if (!emailResult.success) {
      console.error('Failed to send email:', emailResult.error);
      return NextResponse.json(
        {
          error: 'Failed to send email',
          details: emailResult.error,
          orderId: order.id,
        },
        { status: 500 }
      );
    }

    console.log('Webhook processing completed successfully');

    return NextResponse.json({
      success: true,
      message: 'Order processed and email sent successfully',
      orderId: order.id,
      validSkus: validSkus.length,
      zipSize: zipBuffer.length,
      emailSent: true,
    });
  } catch (error) {
    console.error('Error processing webhook:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle GET requests for testing
 */
export async function GET() {
  return NextResponse.json({
    message: 'WooCommerce Order Created Webhook Endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
  });
}
