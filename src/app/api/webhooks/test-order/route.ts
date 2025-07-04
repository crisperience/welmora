import { NextRequest, NextResponse } from 'next/server';

/**
 * Test endpoint to simulate WooCommerce order.created webhook
 * Use this to test the workflow without needing actual WooCommerce webhook
 */
export async function POST(request: NextRequest) {
  try {
    // Mock WooCommerce order data (simplified - no brand metadata needed)
    const mockOrder = {
      id: 12345,
      number: '12345',
      date_created: new Date().toISOString(),
      status: 'processing',
      total: '89.99',
      billing: {
        first_name: 'Test',
        last_name: 'Customer',
        email: 'info@welmora.ch',
        company: 'Test Company',
        address_1: '123 Test Street',
        address_2: '',
        city: 'Test City',
        state: 'TC',
        postcode: '12345',
        country: 'CH',
        phone: '+41123456789',
      },
      line_items: [
        {
          sku: 'TEST-SKU-001',
          name: 'Test Product 1',
          quantity: 2,
          price: '29.99',
          product_id: 101,
        },
        {
          sku: 'TEST-SKU-002',
          name: 'Test Product 2',
          quantity: 1,
          price: '29.99',
          product_id: 102,
        },
        {
          sku: '4058172628800', // Real SKU example
          name: 'Real Product Example',
          quantity: 1,
          price: '15.99',
          product_id: 103,
        },
      ],
    };

    console.log('=== TEST WEBHOOK ===');
    console.log('Forwarding mock order to actual webhook handler...');

    // Forward to actual webhook handler
    const webhookUrl = new URL('/api/webhooks/order-created', request.url);

    const response = await fetch(webhookUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mockOrder),
    });

    const result = await response.json();

    return NextResponse.json({
      message: 'Test webhook completed',
      mockOrder: {
        id: mockOrder.id,
        customer: `${mockOrder.billing.first_name} ${mockOrder.billing.last_name}`,
        items: mockOrder.line_items.length,
        skus: mockOrder.line_items.map(item => item.sku),
        total: mockOrder.total,
      },
      webhookResult: result,
      webhookStatus: response.status,
    });
  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json(
      {
        error: 'Test webhook failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test WooCommerce Webhook Endpoint',
    description: 'POST to this endpoint to simulate a WooCommerce order.created webhook',
    usage: 'POST /api/webhooks/test-order',
    note: 'Uses SKU-only search - no brand detection needed',
    timestamp: new Date().toISOString(),
  });
}
