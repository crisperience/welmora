import ShoppingPage from '@/app/shopping/[date]/page'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useParams, useRouter } from 'next/navigation'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useParams: jest.fn(),
}))

// Mock fetch
global.fetch = jest.fn()

const mockRouter = {
  push: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  replace: jest.fn(),
}

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
}

describe('ShoppingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
      ; (useRouter as jest.Mock).mockReturnValue(mockRouter)
      ; (useParams as jest.Mock).mockReturnValue({ date: '2024-12-30' })
      ; (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockShoppingData,
      })
  })

  test('renders shopping page with products', async () => {
    render(<ShoppingPage />)

    await waitFor(() => {
      expect(screen.getByText('Shopping List')).toBeTruthy()
      expect(screen.getByText('Test Product 1')).toBeTruthy()
      expect(screen.getByText('Test Product 2')).toBeTruthy()
    })
  })

  test('shows progress correctly', async () => {
    render(<ShoppingPage />)

    await waitFor(() => {
      expect(screen.getByText('0/2')).toBeTruthy() // 0 completed out of 2 total
    })
  })

  test('toggles item completion when clicked', async () => {
    render(<ShoppingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeTruthy()
    })

    // Click on first product to mark as completed
    const productCard = screen.getByText('Test Product 1').closest('[data-slot="card"]')
    fireEvent.click(productCard!)

    await waitFor(() => {
      expect(screen.getByText('1/2')).toBeTruthy() // 1 completed out of 2 total
    })
  })

  test('filters products by search term', async () => {
    render(<ShoppingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeTruthy()
      expect(screen.getByText('Test Product 2')).toBeTruthy()
    })

    // Search for specific product
    const searchInput = screen.getByPlaceholderText('Search products...')
    fireEvent.change(searchInput, { target: { value: 'Product 1' } })

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeTruthy()
      expect(screen.queryByText('Test Product 2')).toBeFalsy()
    })
  })

  test('shows completion message when all products are done', async () => {
    render(<ShoppingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeTruthy()
      expect(screen.getByText('Test Product 2')).toBeTruthy()
    })

    // Mark both products as completed
    const product1Card = screen.getByText('Test Product 1').closest('[data-slot="card"]')
    const product2Card = screen.getByText('Test Product 2').closest('[data-slot="card"]')

    fireEvent.click(product1Card!)
    fireEvent.click(product2Card!)

    await waitFor(() => {
      expect(screen.getByText('🎉 Shopping Complete!')).toBeTruthy()
    })
  })

  test('displays product images', async () => {
    render(<ShoppingPage />)

    await waitFor(() => {
      const images = screen.getAllByRole('img')
      expect(images.length).toBeGreaterThan(0)
    })
  })

  test('handles API errors gracefully', async () => {
    ; (global.fetch as jest.Mock).mockRejectedValue(new Error('API Error'))

    render(<ShoppingPage />)

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeTruthy()
    })
  })

  test('saves and loads state from localStorage', async () => {
    const mockLocalStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    }

    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
    })

    render(<ShoppingPage />)

    await waitFor(() => {
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('shopping-2024-12-30')
    })
  })

  test('clears search when search term is empty', async () => {
    render(<ShoppingPage />)

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeTruthy()
      expect(screen.getByText('Test Product 2')).toBeTruthy()
    })

    const searchInput = screen.getByPlaceholderText('Search products...')

    // Search for something
    fireEvent.change(searchInput, { target: { value: 'Product 1' } })

    await waitFor(() => {
      expect(screen.queryByText('Test Product 2')).toBeFalsy()
    })

    // Clear search
    fireEvent.change(searchInput, { target: { value: '' } })

    await waitFor(() => {
      expect(screen.getByText('Test Product 1')).toBeTruthy()
      expect(screen.getByText('Test Product 2')).toBeTruthy()
    })
  })

  test('navigates back when back button is clicked', async () => {
    render(<ShoppingPage />)

    await waitFor(() => {
      expect(screen.getByText('Shopping List')).toBeTruthy()
    })

    const backButton = screen.getByRole('button', { name: '' })
    fireEvent.click(backButton)

    expect(mockRouter.push).toHaveBeenCalledWith('/')
  })

  test('handles empty product list', async () => {
    ; (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockShoppingData,
        products: [],
      }),
    })

    render(<ShoppingPage />)

    await waitFor(() => {
      expect(screen.getByText('Shopping List')).toBeTruthy()
      expect(screen.getByText('0/0')).toBeTruthy()
    })
  })
})
