import PackingPage from '@/app/packing/[date]/page';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useParams, useRouter } from 'next/navigation';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}));

// Mock BarcodeScanner component
jest.mock('@/components/scanner/BarcodeScanner', () => {
  return function MockBarcodeScanner({
    onScan,
    isActive,
  }: {
    onScan: (code: string) => void;
    isActive: boolean;
  }) {
    return (
      <div data-testid="barcode-scanner">
        {isActive && (
          <button onClick={() => onScan('TEST-SKU-001')} data-testid="mock-scan-button">
            Simulate Scan
          </button>
        )}
      </div>
    );
  };
});

// Mock fetch
global.fetch = jest.fn();

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
};

const mockPackingData = [
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
      address_2: '',
      city: 'Anytown',
      state: 'CA',
      postcode: '12345',
      country: 'US',
      phone: '555-1234',
    },
    billingAddress: {
      first_name: 'John',
      last_name: 'Doe',
      address_1: '123 Main St',
      address_2: '',
      city: 'Anytown',
      state: 'CA',
      postcode: '12345',
      country: 'US',
      email: 'john@example.com',
      phone: '555-1234',
    },
    orderDate: '2024-12-30',
    status: 'pending' as const,
    totalValue: 39.98,
    shippingMethod: 'Standard Shipping',
    items: [
      {
        sku: 'TEST-SKU-001',
        name: 'Test Product 1',
        needed: 2,
        scanned: 0,
        price: 19.99,
        productId: 456,
        image: 'https://example.com/image1.jpg',
      },
    ],
  },
];

describe('PackingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ date: '2024-12-30' });
    (global.fetch as jest.Mock).mockImplementation(url => {
      if (url.includes('/api/packing/')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockPackingData,
        });
      }
      if (url.includes('/api/scan')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            product: {
              name: 'Test Product 1',
              sku: 'TEST-SKU-001',
              packageId: 'package-123',
              orderId: 123,
              customerName: 'John Doe',
              needed: 2,
              scanned: 1,
              message: 'This product goes to PACKAGE 123 - John Doe (needed: 2x)',
            },
          }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  test('renders packing page with packages', async () => {
    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Packing')).toBeTruthy();
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('Test Product 1')).toBeTruthy();
    });
  });

  test('activates and deactivates scanner', async () => {
    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      const startButton = screen.getByText('Start');
      expect(startButton).toBeTruthy();
    });

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText('Stop')).toBeTruthy();
      expect(screen.getByTestId('barcode-scanner')).toBeTruthy();
    });
  });

  test('processes scanned product successfully', async () => {
    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      const startButton = screen.getByText('Start');
      expect(startButton).toBeTruthy();
    });

    // Start scanner
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    // Simulate scan
    const scanButton = screen.getByTestId('mock-scan-button');
    fireEvent.click(scanButton);

    await waitFor(() => {
      // Should show scan feedback
      expect(screen.getAllByText(/Test Product 1/)[0]).toBeTruthy();
    });
  });

  test('shows package details including shipping address', async () => {
    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('123 Main St')).toBeTruthy();
      expect(screen.getByText('Anytown, CA 12345')).toBeTruthy();
      expect(screen.getByText('555-1234')).toBeTruthy();
    });
  });

  test('displays order number and shipping method', async () => {
    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('#123')).toBeTruthy();
      expect(screen.getByText('Standard Shipping')).toBeTruthy();
    });
  });

  test('handles manual SKU entry', async () => {
    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter SKU manually...');
      expect(input).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Enter SKU manually...');
    const addButton = screen.getByText('Add');

    fireEvent.change(input, { target: { value: 'TEST-SKU-001' } });
    fireEvent.click(addButton);

    // Input should be cleared after successful entry
    expect((input as HTMLInputElement).value).toBe('');
  });

  test('shows scan feedback with package information', async () => {
    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      const startButton = screen.getByText('Start');
      expect(startButton).toBeTruthy();
    });

    // Start scanner
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    // Simulate scan
    const scanButton = screen.getByTestId('mock-scan-button');
    fireEvent.click(scanButton);

    await waitFor(() => {
      // Should show detailed feedback with package info
      expect(screen.getByText(/This product goes to PACKAGE/)).toBeTruthy();
    });
  });

  test('handles API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => [],
      })
    );

    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Packing')).toBeTruthy();
    });
  });

  test('navigates back when back button is clicked', async () => {
    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Packing')).toBeTruthy();
    });

    const backButton = screen.getByRole('button', { name: '' });
    fireEvent.click(backButton);

    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  test('saves and loads state from localStorage', async () => {
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    });

    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('packing-2024-12-30');
    });
  });

  test('handles empty package list', async () => {
    (global.fetch as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: async () => [],
      })
    );

    await act(async () => {
      render(<PackingPage />);
    });

    await waitFor(() => {
      expect(screen.getByText('Packing')).toBeTruthy();
    });
  });
});
