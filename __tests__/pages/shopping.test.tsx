import ShoppingPage from '@/app/shopping/[date]/page';
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

const mockShoppingData = {
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

describe('ShoppingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useParams as jest.Mock).mockReturnValue({ date: '2024-12-30' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockShoppingData,
    });
  });

  test('renders shopping page with products', async () => {
    render(<ShoppingPage />);

    await waitFor(() => {
      expect(screen.getByText('Shopping')).toBeTruthy();
      expect(screen.getByText('Test Product 1')).toBeTruthy();
      expect(screen.getByText('Test Product 2')).toBeTruthy();
      expect(screen.getByText('Total: 8 items')).toBeTruthy();
    });
  });

  test('activates and deactivates scanner', async () => {
    render(<ShoppingPage />);

    await waitFor(() => {
      expect(screen.getByText('Start')).toBeTruthy();
    });

    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    expect(screen.getByText('Stop')).toBeTruthy();
    expect(screen.getByTestId('barcode-scanner')).toBeTruthy();
  });

  test('processes scanned product successfully', async () => {
    render(<ShoppingPage />);

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
      // Product should be marked as found
      expect(screen.getByText(/Found/)).toBeTruthy();
    });
  });

  test('handles manual SKU entry', async () => {
    render(<ShoppingPage />);

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
    render(<ShoppingPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter SKU manually...')).toBeTruthy();
    });

    const input = screen.getByPlaceholderText('Enter SKU manually...');
    const addButton = screen.getByText('Add');

    fireEvent.change(input, { target: { value: 'NON-EXISTENT-SKU' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText(/not found/)).toBeTruthy();
    });
  });

  test('tracks shopping progress correctly', async () => {
    render(<ShoppingPage />);

    await waitFor(() => {
      expect(screen.getByText('0/8')).toBeTruthy(); // 0 found out of 8 total
    });

    // Start scanner and scan a product
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    const scanButton = screen.getByTestId('mock-scan-button');
    fireEvent.click(scanButton);

    await waitFor(() => {
      expect(screen.getByText('5/8')).toBeTruthy(); // 5 found (quantity of TEST-SKU-001)
    });
  });

  test('displays product images', async () => {
    render(<ShoppingPage />);

    await waitFor(() => {
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThan(0);
    });
  });

  test('shows completion message when all products found', async () => {
    render(<ShoppingPage />);

    await waitFor(() => {
      expect(screen.getByText('Start')).toBeTruthy();
    });

    // Start scanner
    const startButton = screen.getByText('Start');
    fireEvent.click(startButton);

    // Scan first product (TEST-SKU-001, quantity 5)
    const scanButton = screen.getByTestId('mock-scan-button');
    fireEvent.click(scanButton);

    // Manually add second product
    const input = screen.getByPlaceholderText('Enter SKU manually...');
    const addButton = screen.getByText('Add');

    fireEvent.change(input, { target: { value: 'TEST-SKU-002' } });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText(/All items found/)).toBeTruthy();
    });
  });

  test('handles API errors gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'));

    render(<ShoppingPage />);

    await waitFor(() => {
      expect(screen.getByText('No products found for this date')).toBeTruthy();
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

    render(<ShoppingPage />);

    await waitFor(() => {
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('shopping-2024-12-30');
    });
  });

  test('filters products by search term', async () => {
    render(<ShoppingPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeTruthy();
      expect(screen.getByText('Test Product 2')).toBeTruthy();
    });

    // Search for specific product
    const searchInput = screen.getByPlaceholderText('Search products...');
    fireEvent.change(searchInput, { target: { value: 'Product 1' } });

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeTruthy();
      expect(screen.queryByText('Test Product 2')).toBeFalsy();
    });
  });

  test('navigates back when back button is clicked', async () => {
    render(<ShoppingPage />);

    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);

    expect(mockRouter.back).toHaveBeenCalled();
  });
});
