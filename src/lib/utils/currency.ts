// Currency conversion utility using exchangerate-api.com (free tier)
let cachedRate: { rate: number; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export async function getChfToEurRate(): Promise<number> {
  // Return cached rate if still valid
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
    return cachedRate.rate;
  }

  try {
    // Using exchangerate-api.com free tier (1500 requests/month)
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/CHF');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const rate = data.rates.EUR;

    if (!rate || typeof rate !== 'number') {
      throw new Error('Invalid rate data received');
    }

    // Cache the rate
    cachedRate = {
      rate,
      timestamp: Date.now(),
    };

    return rate;
  } catch (error) {
    console.error('Failed to fetch CHF to EUR rate:', error);

    // Fallback to approximate rate if API fails
    return 1.05;
  }
}

export function formatPriceWithConversion(
  price: number,
  currency: 'CHF' | 'EUR' = 'CHF',
  eurRate?: number
): string {
  // Manual European formatting with comma as decimal separator
  const formatCurrency = (amount: number, currencyCode: string) => {
    const rounded = Math.round(amount * 100) / 100;
    const formatted = rounded.toFixed(2).replace('.', ',');
    const symbol = currencyCode === 'EUR' ? '€' : 'CHF';
    return `${formatted} ${symbol}`;
  };

  // If CHF and we have EUR rate, show EUR first with CHF in parentheses
  if (currency === 'CHF' && eurRate) {
    const eurPrice = price * eurRate;
    const eurFormatted = formatCurrency(eurPrice, 'EUR');
    const chfFormatted = formatCurrency(price, 'CHF');
    return `${eurFormatted} (${chfFormatted})`;
  }

  // If EUR, just show EUR with comma decimal separator
  return formatCurrency(price, currency);
}
