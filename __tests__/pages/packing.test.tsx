import PackingPage from '@/app/packing/[date]/page';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const mockPackagesData = [
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
    shippingMethod: 'Standard',
    items: [
      {
        sku: 'TEST-SKU-001',
        name: 'Test Product 1',
        needed: 2,
        scanned: 0,
        price: 19.99,
        productId: 456,
      },
      {
        sku: 'TEST-SKU-002',
        name: 'Test Product 2',
        needed: 1,
        scanned: 1,
        price: 19.99,
        productId: 789,
      },
    ],
  },
];

describe('PackingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ date: '2024-12-30' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockPackagesData,
    });
  });

  test('renders packing page with packages', async () => {
    render(<PackingPage />);

    await waitFor(() => {
      expect(screen.getByText('Packing')).toBeTruthy();
      expect(screen.getByText('John Doe')).toBeTruthy();
      expect(screen.getByText('#123')).toBeTruthy();
      expect(screen.getByText('123 Main St, Anytown, 12345, US')).toBeTruthy();
    });
  });

  test('activates and deactivates scanner', async () => {
    render(<PackingPage />);

    await waitFor(() => {
      expect(screen.getByText('Start')).toBeTruthy();
    });

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    expect(screen.getByText('Stop')).toBeTruthy();
    expect(screen.getByTestId('barcode-scanner')).toBeTruthy();
  });

  test('processes scanned product successfully', async () => {
    render(<PackingPage />);

    await waitFor(() => {
      expect(screen.getByText('Start')).toBeTruthy();
    });

    // Start scanner
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    // Simulate scan
    const scanButton = screen.getByTestId('mock-scan-button');
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText(/Test Product 1/)).toBeTruthy();
    });
  });

  test('handles manual SKU entry', async () => {
    render(<PackingPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter SKU manually...')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Enter SKU manually...');
    const addButton = screen.getByText('Add');

    fireEvent.change(input, { target: { value: 'TEST-SKU-001' } });
    fireEvent.click(addButton);

    // Input should be cleared after successful entry
    expect((input as HTMLInputElement).value).toBe('');
  });

  test('shows error for non-existent products', async () => {
    render(<PackingPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter SKU manually...')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Enter SKU manually...');
    const addButton = screen.getByText('Add');

    fireEvent.change(input, { target: { value: 'NON-EXISTENT-SKU' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText(/not found in any package/)).toBeTruthy();
    });
  });

  test('toggles package completion status', async () => {
    render(<PackingPage />);

    await waitFor(() => {
      expect(screen.getByText('Complete')).toBeTruthy();
    });

    const completeButton = screen.getByText('Complete');
    fireEvent.click(completeButton);

    await waitFor(() => {
      expect(screen.getByText('Reset')).toBeTruthy();
    });
  });

  test('displays shipping address information', async () => {
    render(<PackingPage />);

    await waitFor(() => {
      expect(screen.getByText('Shipping Address')).toBeTruthy();
      expect(screen.getByText('123 Main St, Anytown, 12345, US')).toBeTruthy();
      expect(screen.getByText('📞 555-1234')).toBeTruthy();
    });
  });

  test('shows progress for each package', async () => {
    render(<PackingPage />);

    await waitFor(() => {
      // Package has 3 total items, 1 already scanned
      expect(screen.getByText('1/3')).toBeTruthy();
    });
  });

  test('handles API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<PackingPage />);

    await waitFor(() => {
      expect(screen.getByText('No packages found for this date')).toBeTruthy();
    });
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

    render(<PackingPage />);

    await waitFor(() => {
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('packing-2024-12-30');
    });
  });

  test('navigates back when back button is clicked', async () => {
    render(<PackingPage />);

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockRouter.back).toHaveBeenCalled();
  });
});
