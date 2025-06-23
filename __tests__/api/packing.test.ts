import { GET } from '@/app/api/packing/[date]/route';
import * as wooClient from '@/lib/woocommerce/client';

// Mock WooCommerce client
jest.mock('@/lib/woocommerce/client', () => ({
  getPackagesForDate: jest.fn(),
}));

const mockWooClient = wooClient as jest.Mocked<typeof wooClient>;

describe('/api/packing/[date]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('successfully returns packages for valid date', async () => {
    const mockPackages = [
      {
        id: 'package-123',
        orderId: 123,
        orderNumber: '#123',
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        shippingAddress: {
          first_name: 'John',
          last_name: 'Doe',
          address_1: '123 Main St',
          city: 'Anytown',
          postcode: '12345',
          country: 'US',
        },
        billingAddress: {
          first_name: 'John',
          last_name: 'Doe',
          address_1: '123 Main St',
          city: 'Anytown',
          postcode: '12345',
          country: 'US',
          email: 'john@example.com',
        },
        orderDate: '2024-12-30',
        status: 'pending' as const,
        items: [
          {
            sku: 'TEST-SKU-001',
            name: 'Test Product',
            needed: 2,
            scanned: 0,
            price: 19.99,
            productId: 456,
          },
        ],
      },
    ];

    mockWooClient.getPackagesForDate.mockResolvedValue({
      success: true,
      data: mockPackages,
    });

    const request = new Request('http://localhost/api/packing/2024-12-30');
    const params = Promise.resolve({ date: '2024-12-30' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(1);
    expect(data[0].orderNumber).toBe('#123');
    expect(data[0].customerName).toBe('John Doe');
    expect(data[0].shippingAddress.address_1).toBe('123 Main St');
  });

  test('returns 400 for invalid date format', async () => {
    const request = new Request('http://localhost/api/packing/invalid-date');
    const params = Promise.resolve({ date: 'invalid-date' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid date format. Use YYYY-MM-DD');
  });

  test('returns 500 when WooCommerce API fails', async () => {
    mockWooClient.getPackagesForDate.mockResolvedValue({
      success: false,
      error: 'API connection failed',
    });

    const request = new Request('http://localhost/api/packing/2024-12-30');
    const params = Promise.resolve({ date: '2024-12-30' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('API connection failed');
  });

  test('handles empty packages array', async () => {
    mockWooClient.getPackagesForDate.mockResolvedValue({
      success: true,
      data: [],
    });

    const request = new Request('http://localhost/api/packing/2024-12-30');
    const params = Promise.resolve({ date: '2024-12-30' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveLength(0);
  });

  test('handles network errors gracefully', async () => {
    mockWooClient.getPackagesForDate.mockRejectedValue(new Error('Network error'));

    const request = new Request('http://localhost/api/packing/2024-12-30');
    const params = Promise.resolve({ date: '2024-12-30' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to get packages');
    expect(data.message).toBe('Network error');
  });
});
