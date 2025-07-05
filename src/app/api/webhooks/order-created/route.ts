import { generateZipFromSkus } from '@/lib/services/generateZipFromSkus';
import { sendEmailWithAttachment } from '@/lib/services/sendEmailWithAttachment';
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
 * Uses SKU-only search across entire bucket (ignores folder structure)
 */
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  const requestId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`=== WooCommerce Order Created Webhook [${requestId}] ===`);
    console.log(`Timestamp: ${timestamp}`);
    console.log(`Request URL: ${request.url}`);
    console.log(`Request method: ${request.method}`);
    console.log(`Request headers:`, Object.fromEntries(request.headers.entries()));

    // Check if declaration emails are enabled
    const declarationEmailsEnabled = process.env.ENABLE_DECLARATION_EMAILS === 'true';
    console.log(`[${requestId}] Declaration emails enabled: ${declarationEmailsEnabled}`);

    // Parse webhook payload
    const webhookData = await request.json();

    // Log the full webhook data for debugging
    console.log(`[${requestId}] Full webhook payload:`, JSON.stringify(webhookData, null, 2));

    console.log(`[${requestId}] Webhook received:`, {
      id: webhookData.id,
      status: webhookData.status,
      total: webhookData.total,
      line_items_count: webhookData.line_items?.length || 0,
      customer_email: webhookData.billing?.email,
      date_created: webhookData.date_created,
    });

    const order = webhookData as WooCommerceWebhookOrder;

    // Validate required data
    if (!order.id || !order.line_items || order.line_items.length === 0) {
      console.error(`[${requestId}] Invalid webhook data: missing order ID or line items`);
      return NextResponse.json({ error: 'Invalid webhook data', requestId }, { status: 400 });
    }

    // Extract order details for email
    const orderDetails = {
      customerName: `${order.billing.first_name} ${order.billing.last_name}`,
      customerEmail: order.billing.email,
      totalValue: order.total,
      itemCount: order.line_items.length,
    };

    console.log(`[${requestId}] Processing order for customer: ${orderDetails.customerName} (${orderDetails.customerEmail})`);

    // If declaration emails are disabled, log and return success without sending emails
    if (!declarationEmailsEnabled) {
      console.log(`[${requestId}] ⏸️ Declaration emails are DISABLED - webhook processed but no email sent`);
      console.log(`[${requestId}] Order details:`, orderDetails);
      console.log(`[${requestId}] SKUs that would be processed:`, order.line_items.map(item => item.sku || `product-${item.product_id}`));

      return NextResponse.json({
        success: true,
        message: 'Webhook processed successfully - declaration emails disabled',
        orderId: order.id,
        declarationEmailsEnabled: false,
        customerName: orderDetails.customerName,
        customerEmail: orderDetails.customerEmail,
        totalValue: orderDetails.totalValue,
        itemCount: orderDetails.itemCount,
        requestId,
        timestamp,
        note: 'Declaration emails are currently disabled via ENABLE_DECLARATION_EMAILS environment variable',
      });
    }

    // Continue with normal processing if emails are enabled
    console.log(`[${requestId}] ✅ Declaration emails are ENABLED - proceeding with email generation`);

    // Step 1: Extract SKUs from line items (super simple!)
    console.log(`[${requestId}] Step 1: Extracting SKUs from line items...`);
    const skuItems = order.line_items.map(item => ({
      sku: item.sku || `product-${item.product_id}`,
    }));

    console.log(
      `[${requestId}] Extracted SKUs:`,
      skuItems.map(item => item.sku)
    );

    // Filter out items without valid SKUs
    const validSkus = skuItems.filter(item => item.sku && !item.sku.startsWith('product-'));

    if (validSkus.length === 0) {
      console.warn(`[${requestId}] No valid SKUs found, sending email without attachments`);

      // Still send notification email but without ZIP
      const emptyBuffer = Buffer.from('No valid SKUs found for this order');
      const emailResult = await sendEmailWithAttachment(emptyBuffer, order.id, orderDetails);

      if (!emailResult.success) {
        console.error(`[${requestId}] Failed to send notification email:`, emailResult.error);
        console.error(`[${requestId}] Email debug info:`, emailResult.debug);
      } else {
        console.log(`[${requestId}] Notification email sent successfully with messageId:`, emailResult.messageId);
        console.log(`[${requestId}] Email debug info:`, emailResult.debug);
      }

      return NextResponse.json({
        success: true,
        message: 'Webhook processed but no valid SKUs found',
        orderId: order.id,
        validSkus: 0,
        declarationEmailsEnabled: true,
        emailSent: emailResult.success,
        emailError: emailResult.error,
        emailMessageId: emailResult.messageId,
        emailDebug: emailResult.debug,
        requestId,
        timestamp,
      });
    }

    console.log(`[${requestId}] Found ${validSkus.length} valid SKUs out of ${skuItems.length} items`);

    // Step 2: Generate ZIP with PDFs (bucket-wide SKU search)
    console.log(`[${requestId}] Step 2: Generating ZIP file using bucket-wide SKU search...`);
    const zipBuffer = await generateZipFromSkus(validSkus, order.id);

    console.log(`[${requestId}] ZIP generated: ${zipBuffer.length} bytes`);

    // Step 3: Send email with attachment
    console.log(`[${requestId}] Step 3: Sending email...`);
    const emailResult = await sendEmailWithAttachment(zipBuffer, order.id, orderDetails);

    if (!emailResult.success) {
      console.error(`[${requestId}] Failed to send email:`, emailResult.error);
      console.error(`[${requestId}] Email debug info:`, emailResult.debug);
      return NextResponse.json(
        {
          error: 'Failed to send email',
          details: emailResult.error,
          debug: emailResult.debug,
          orderId: order.id,
          requestId,
          timestamp,
        },
        { status: 500 }
      );
    }

    console.log(`[${requestId}] Email sent successfully with messageId:`, emailResult.messageId);
    console.log(`[${requestId}] Email debug info:`, emailResult.debug);
    console.log(`[${requestId}] Webhook processing completed successfully`);

    return NextResponse.json({
      success: true,
      message: 'Order processed and email sent successfully',
      orderId: order.id,
      validSkus: validSkus.length,
      zipSize: zipBuffer.length,
      declarationEmailsEnabled: true,
      emailSent: true,
      emailMessageId: emailResult.messageId,
      emailDebug: emailResult.debug,
      requestId,
      timestamp,
    });
  } catch (error) {
    console.error(`[${requestId}] Error processing webhook:`, error);
    console.error(`[${requestId}] Error stack:`, error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        requestId,
        timestamp,
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
