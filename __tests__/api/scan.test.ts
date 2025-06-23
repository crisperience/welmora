import { POST } from '@/app/api/scan/route';
import * as wooClient from '@/lib/woocommerce/client';

// Mock WooCommerce client
jest.mock('@/lib/woocommerce/client', () => ({
  getOrdersByDateRange: jest.fn(),
}));

const mockWooClient = wooClient as jest.Mocked<typeof wooClient>;

const mockCompleteOrders = [
  {
    id: 123,
    number: '#123',
    date_created: '2024-12-30T10:00:00',
    status: 'processing',
    total: '39.98',
    shipping_total: '5.00',
    billing: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      company: 'Test Company',
      address_1: '123 Main St',
      address_2: 'Apt 1',
      city: 'Anytown',
      state: 'CA',
      postcode: '12345',
      country: 'US',
      phone: '555-1234',
    },
    shipping: {
      first_name: 'John',
      last_name: 'Doe',
      company: 'Test Company',
      address_1: '123 Main St',
      address_2: 'Apt 1',
      city: 'Anytown',
      state: 'CA',
      postcode: '12345',
      country: 'US',
      phone: '555-1234',
    },
    line_items: [
      {
        sku: 'TEST-SKU-001',
        name: 'Test Product',
        quantity: 2,
        price: '19.99',
        product_id: 456,
        image: { src: 'https://example.com/image.jpg' },
      },
    ],
    shipping_lines: [
      {
        method_title: 'Standard Shipping',
        method_id: 'flat_rate',
        total: '5.00',
      },
    ],
    customer_note: 'Handle with care',
  },
];

const mockCompleteOrdersForProductId = [
  {
    id: 123,
    number: '#123',
    date_created: '2024-12-30T10:00:00',
    status: 'processing',
    total: '39.98',
    shipping_total: '5.00',
    billing: {
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
      company: '',
      address_1: '456 Oak St',
      address_2: '',
      city: 'Another Town',
      state: 'NY',
      postcode: '67890',
      country: 'US',
      phone: '555-5678',
    },
    shipping: {
      first_name: 'Jane',
      last_name: 'Smith',
      company: '',
      address_1: '456 Oak St',
      address_2: '',
      city: 'Another Town',
      state: 'NY',
      postcode: '67890',
      country: 'US',
      phone: '555-5678',
    },
    line_items: [
      {
        sku: '',
        name: 'Another Product',
        quantity: 1,
        price: '29.99',
        product_id: 789,
        image: { src: 'https://example.com/image2.jpg' },
      },
    ],
    shipping_lines: [
      {
        method_title: 'Express Shipping',
        method_id: 'express',
        total: '10.00',
      },
    ],
    customer_note: '',
  },
];

describe('/api/scan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('successfully matches product by SKU', async () => {
    mockWooClient.getOrdersByDateRange.mockResolvedValue({
      success: true,
      data: mockCompleteOrders,
    });

    const request = new Request('http://localhost/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scannedCode: 'TEST-SKU-001',
        date: '2024-12-30',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.product).toBeDefined();
    expect(data.product.name).toBe('Test Product');
    expect(data.product.sku).toBe('TEST-SKU-001');
    expect(data.product.customerName).toBe('John Doe');
  });

  test('successfully matches product by ID', async () => {
    mockWooClient.getOrdersByDateRange.mockResolvedValue({
      success: true,
      data: mockCompleteOrdersForProductId,
    });

    const request = new Request('http://localhost/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scannedCode: '789',
        date: '2024-12-30',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.product.name).toBe('Another Product');
    expect(data.product.customerName).toBe('Jane Smith');
  });

  test('returns 404 for non-existent products', async () => {
    mockWooClient.getOrdersByDateRange.mockResolvedValue({
      success: true,
      data: [],
    });

    const request = new Request('http://localhost/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scannedCode: 'NON-EXISTENT',
        date: '2024-12-30',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.success).toBe(false);
    expect(data.error).toContain('not found');
  });

  test('handles invalid request parameters', async () => {
    const request = new Request('http://localhost/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scannedCode: '',
        date: '2024-12-30',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Missing scannedCode or date');
  });

  test('handles WooCommerce API errors', async () => {
    mockWooClient.getOrdersByDateRange.mockResolvedValue({
      success: false,
      error: 'WooCommerce API error',
    });

    const request = new Request('http://localhost/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scannedCode: 'TEST-SKU',
        date: '2024-12-30',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch orders for the specified date');
  });

  test('handles network timeouts', async () => {
    mockWooClient.getOrdersByDateRange.mockRejectedValue(new Error('Network timeout'));

    const request = new Request('http://localhost/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scannedCode: 'TEST-SKU',
        date: '2024-12-30',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Internal server error');
  });
});
