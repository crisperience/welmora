import {
  generateDailySnapshot,
  getOrdersByDateRange,
  getPackagesForDate,
  testWooCommerceConnection,
} from '@/lib/woocommerce/client';

// Mock WooCommerce API
const mockWooCommerceApi = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

// Mock the WooCommerce module
jest.mock(
  'woocommerce-api',
  () => {
    return jest.fn().mockImplementation(() => mockWooCommerceApi);
  },
  { virtual: true }
);

const mockOrdersData = [
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
        name: 'Test Product 1',
        quantity: 2,
        price: '19.99',
        product_id: 456,
        image: { src: 'https://example.com/image1.jpg' },
      },
    ],
    shipping_lines: [
      {
        method_title: 'Standard Shipping',
        method_id: 'flat_rate',
        total: '5.00',
      },
    ],
    customer_note: 'Please handle with care',
  },
];

describe('WooCommerce Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('testWooCommerceConnection', () => {
    test('successfully connects to WooCommerce API', async () => {
      mockWooCommerceApi.get.mockResolvedValue({
        data: { version: '8.0.0' },
        status: 200,
      });

      const result = await testWooCommerceConnection();

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
      expect(mockWooCommerceApi.get).toHaveBeenCalledWith('');
    });

    test('handles connection failures', async () => {
      mockWooCommerceApi.get.mockRejectedValue(new Error('Connection failed'));

      const result = await testWooCommerceConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });
  });

  describe('getOrdersByDateRange', () => {
    test('successfully fetches orders by date range', async () => {
      mockWooCommerceApi.get.mockResolvedValue({
        data: mockOrdersData,
        status: 200,
      });

      const result = await getOrdersByDateRange('2024-12-29', '2024-12-30');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].id).toBe(123);
      expect(mockWooCommerceApi.get).toHaveBeenCalledWith('orders', {
        after: '2024-12-29T00:00:00',
        before: '2024-12-30T23:59:59',
        per_page: 100,
        status: 'any',
      });
    });

    test('handles API errors gracefully', async () => {
      mockWooCommerceApi.get.mockRejectedValue(new Error('API Error'));

      const result = await getOrdersByDateRange('2024-12-29', '2024-12-30');

      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
    });

    test('handles empty response', async () => {
      mockWooCommerceApi.get.mockResolvedValue({
        data: [],
        status: 200,
      });

      const result = await getOrdersByDateRange('2024-12-29', '2024-12-30');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('generateDailySnapshot', () => {
    test('successfully generates daily snapshot', async () => {
      mockWooCommerceApi.get.mockResolvedValue({
        data: mockOrdersData,
        status: 200,
      });

      const result = await generateDailySnapshot('2024-12-30');

      expect(result.success).toBe(true);
      expect(result.data?.date).toBe('2024-12-30');
      expect(result.data?.products).toHaveLength(1);
      expect(result.data?.products[0].sku).toBe('TEST-SKU-001');
      expect(result.data?.products[0].quantity).toBe(2);
      expect(result.data?.totalOrders).toBe(1);
    });

    test('aggregates products correctly', async () => {
      const duplicateOrdersData = [
        ...mockOrdersData,
        {
          ...mockOrdersData[0],
          id: 124,
          line_items: [
            {
              sku: 'TEST-SKU-001',
              name: 'Test Product 1',
              quantity: 3,
              price: '19.99',
              product_id: 456,
              image: { src: 'https://example.com/image1.jpg' },
            },
          ],
        },
      ];

      mockWooCommerceApi.get.mockResolvedValue({
        data: duplicateOrdersData,
        status: 200,
      });

      const result = await generateDailySnapshot('2024-12-30');

      expect(result.success).toBe(true);
      expect(result.data?.products).toHaveLength(1);
      expect(result.data?.products[0].quantity).toBe(5); // 2 + 3 aggregated
    });

    test('handles orders without line items', async () => {
      const emptyOrdersData = [
        {
          ...mockOrdersData[0],
          line_items: [],
        },
      ];

      mockWooCommerceApi.get.mockResolvedValue({
        data: emptyOrdersData,
        status: 200,
      });

      const result = await generateDailySnapshot('2024-12-30');

      expect(result.success).toBe(true);
      expect(result.data?.products).toHaveLength(0);
      expect(result.data?.totalOrders).toBe(1);
    });
  });

  describe('getPackagesForDate', () => {
    test('successfully generates packages from orders', async () => {
      mockWooCommerceApi.get.mockResolvedValue({
        data: mockOrdersData,
        status: 200,
      });

      const result = await getPackagesForDate('2024-12-30');

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);

      const pkg = result.data?.[0];
      expect(pkg?.id).toBe('package-123');
      expect(pkg?.orderId).toBe(123);
      expect(pkg?.orderNumber).toBe('#123');
      expect(pkg?.customerName).toBe('John Doe');
      expect(pkg?.customerEmail).toBe('john@example.com');
      expect(pkg?.shippingAddress.address_1).toBe('123 Main St');
      expect(pkg?.billingAddress.email).toBe('john@example.com');
      expect(pkg?.totalValue).toBe(39.98);
      expect(pkg?.shippingMethod).toBe('Standard Shipping');
      expect(pkg?.orderNotes).toBe('Please handle with care');
      expect(pkg?.items).toHaveLength(1);
      expect(pkg?.items[0].sku).toBe('TEST-SKU-001');
      expect(pkg?.items[0].productId).toBe(456);
    });

    test('handles orders with missing shipping address', async () => {
      const orderWithoutShipping = [
        {
          ...mockOrdersData[0],
          shipping: {
            first_name: '',
            last_name: '',
            address_1: '',
            city: '',
            postcode: '',
            country: '',
          },
        },
      ];

      mockWooCommerceApi.get.mockResolvedValue({
        data: orderWithoutShipping,
        status: 200,
      });

      const result = await getPackagesForDate('2024-12-30');

      expect(result.success).toBe(true);
      const pkg = result.data?.[0];
      // Should fall back to billing address
      expect(pkg?.shippingAddress.address_1).toBe('123 Main St');
      expect(pkg?.shippingAddress.city).toBe('Anytown');
    });

    test('calculates package total value correctly', async () => {
      const multiItemOrder = [
        {
          ...mockOrdersData[0],
          line_items: [
            {
              sku: 'TEST-SKU-001',
              name: 'Test Product 1',
              quantity: 2,
              price: '19.99',
              product_id: 456,
            },
            {
              sku: 'TEST-SKU-002',
              name: 'Test Product 2',
              quantity: 1,
              price: '29.99',
              product_id: 789,
            },
          ],
        },
      ];

      mockWooCommerceApi.get.mockResolvedValue({
        data: multiItemOrder,
        status: 200,
      });

      const result = await getPackagesForDate('2024-12-30');

      expect(result.success).toBe(true);
      const pkg = result.data?.[0];
      expect(pkg?.totalValue).toBe(69.97); // (2 * 19.99) + (1 * 29.99)
      expect(pkg?.items).toHaveLength(2);
    });

    test('handles missing order number gracefully', async () => {
      const orderWithoutNumber = [
        {
          ...mockOrdersData[0],
          number: undefined,
        },
      ];

      mockWooCommerceApi.get.mockResolvedValue({
        data: orderWithoutNumber,
        status: 200,
      });

      const result = await getPackagesForDate('2024-12-30');

      expect(result.success).toBe(true);
      const pkg = result.data?.[0];
      expect(pkg?.orderNumber).toBe('#123'); // Falls back to #id
    });
  });
});
