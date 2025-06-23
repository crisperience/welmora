import { GET } from '@/app/api/shopping/[date]/route';
import * as wooClient from '@/lib/woocommerce/client';

// Mock WooCommerce client
jest.mock('@/lib/woocommerce/client', () => ({
  generateDailySnapshot: jest.fn(),
}));

const mockWooClient = wooClient as jest.Mocked<typeof wooClient>;

describe('/api/shopping/[date]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('successfully returns shopping snapshot for valid date', async () => {
    const mockSnapshot = {
      date: '2024-12-30',
      products: [
        {
          sku: 'TEST-SKU-001',
          name: 'Test Product 1',
          quantity: 5,
          price: 19.99,
          image: 'https://example.com/image1.jpg',
        },
        {
          sku: 'TEST-SKU-002',
          name: 'Test Product 2',
          quantity: 3,
          price: 29.99,
          image: 'https://example.com/image2.jpg',
        },
      ],
      totalOrders: 2,
      generatedAt: '2024-12-30T10:00:00.000Z',
    };

    mockWooClient.generateDailySnapshot.mockResolvedValue({
      success: true,
      data: mockSnapshot,
    });

    const request = new Request('http://localhost/api/shopping/2024-12-30');
    const params = Promise.resolve({ date: '2024-12-30' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.date).toBe('2024-12-30');
    expect(data.products).toHaveLength(2);
    expect(data.totalOrders).toBe(2);
    expect(data.products[0].sku).toBe('TEST-SKU-001');
    expect(data.products[0].quantity).toBe(5);
  });

  test('returns 400 for invalid date format', async () => {
    const request = new Request('http://localhost/api/shopping/invalid-date');
    const params = Promise.resolve({ date: 'invalid-date' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid date format. Use YYYY-MM-DD');
  });

  test('returns 500 when WooCommerce API fails', async () => {
    mockWooClient.generateDailySnapshot.mockResolvedValue({
      success: false,
      error: 'Failed to generate snapshot',
    });

    const request = new Request('http://localhost/api/shopping/2024-12-30');
    const params = Promise.resolve({ date: '2024-12-30' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate snapshot');
  });

  test('handles empty product list', async () => {
    const mockSnapshot = {
      date: '2024-12-30',
      products: [],
      totalOrders: 0,
      generatedAt: '2024-12-30T10:00:00.000Z',
    };

    mockWooClient.generateDailySnapshot.mockResolvedValue({
      success: true,
      data: mockSnapshot,
    });

    const request = new Request('http://localhost/api/shopping/2024-12-30');
    const params = Promise.resolve({ date: '2024-12-30' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.products).toHaveLength(0);
    expect(data.totalOrders).toBe(0);
  });

  test('handles network errors gracefully', async () => {
    mockWooClient.generateDailySnapshot.mockRejectedValue(new Error('Network timeout'));

    const request = new Request('http://localhost/api/shopping/2024-12-30');
    const params = Promise.resolve({ date: '2024-12-30' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to generate snapshot');
    expect(data.message).toBe('Network timeout');
  });

  test('handles large product lists efficiently', async () => {
    const largeProductList = Array.from({ length: 100 }, (_, i) => ({
      sku: `TEST-SKU-${String(i + 1).padStart(3, '0')}`,
      name: `Test Product ${i + 1}`,
      quantity: Math.floor(Math.random() * 10) + 1,
      price: Math.round((Math.random() * 50 + 10) * 100) / 100,
      image: `https://example.com/image${i + 1}.jpg`,
    }));

    const mockSnapshot = {
      date: '2024-12-30',
      products: largeProductList,
      totalOrders: 50,
      generatedAt: '2024-12-30T10:00:00.000Z',
    };

    mockWooClient.generateDailySnapshot.mockResolvedValue({
      success: true,
      data: mockSnapshot,
    });

    const request = new Request('http://localhost/api/shopping/2024-12-30');
    const params = Promise.resolve({ date: '2024-12-30' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.products).toHaveLength(100);
    expect(data.totalOrders).toBe(50);
  });
});
