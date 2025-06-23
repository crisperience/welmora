import BarcodeScanner from '@/components/scanner/BarcodeScanner'
import { fireEvent, render, screen } from '@testing-library/react'

// Mock @zxing/library
jest.mock('@zxing/library', () => ({
    BrowserMultiFormatReader: jest.fn().mockImplementation(() => ({
        decodeFromVideoDevice: jest.fn(),
        reset: jest.fn(),
    })),
}))

describe('BarcodeScanner', () => {
    const mockOnScan = jest.fn()
    const mockOnToggle = jest.fn()

    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('renders scanner controls correctly', () => {
        const { container } = render(
            <BarcodeScanner
                onScan={mockOnScan}
                isActive={false}
                onToggle={mockOnToggle}
            />
        )

        expect(screen.getByText('Barcode Scanner')).toBeInTheDocument()
        expect(screen.getByText('Start Scanner')).toBeInTheDocument()
        expect(container).toBeInTheDocument()
    })

    test('shows stop button when scanner is active', () => {
        const { container } = render(
            <BarcodeScanner
                onScan={mockOnScan}
                isActive={true}
                onToggle={mockOnToggle}
            />
        )

        expect(screen.getByText('Stop Scanner')).toBeInTheDocument()
        expect(container.querySelector('video')).toBeInTheDocument()
    })

    test('calls onToggle when button is clicked', () => {
        render(
            <BarcodeScanner
                onScan={mockOnScan}
                isActive={false}
                onToggle={mockOnToggle}
            />
        )

        fireEvent.click(screen.getByText('Start Scanner'))
        expect(mockOnToggle).toHaveBeenCalledTimes(1)
    })

    test('displays scanning instructions when inactive', () => {
        render(
            <BarcodeScanner
                onScan={mockOnScan}
                isActive={false}
                onToggle={mockOnToggle}
            />
        )

        expect(screen.getByText('Instructions:')).toBeInTheDocument()
        expect(screen.getByText(/Click "Start Scanner" to activate/)).toBeInTheDocument()
    })

    test('displays scanning overlay when active', () => {
        render(
            <BarcodeScanner
                onScan={mockOnScan}
                isActive={true}
                onToggle={mockOnToggle}
            />
        )

        expect(screen.getByText('Position barcode here')).toBeInTheDocument()
    })
}) 