import '@testing-library/jest-dom';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
  })),
  useParams: jest.fn(() => ({})),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  usePathname: jest.fn(() => '/'),
}));

// Mock environment variables
process.env.NEXT_PUBLIC_WOOCOMMERCE_URL = 'https://test.welmora.ch';
process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_KEY = 'test_key';
process.env.NEXT_PUBLIC_WOOCOMMERCE_CONSUMER_SECRET = 'test_secret';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = jest.fn();

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock Web APIs for Next.js route handlers
global.Request = jest.fn().mockImplementation((url, options = {}) => ({
  url,
  method: options.method || 'GET',
  headers: new Map(Object.entries(options.headers || {})),
  json: jest.fn().mockResolvedValue(options.body ? JSON.parse(options.body) : {}),
  text: jest.fn().mockResolvedValue(options.body || ''),
  clone: jest.fn(),
}));

global.Response = jest.fn().mockImplementation((body, options = {}) => ({
  ok: options.status ? options.status < 400 : true,
  status: options.status || 200,
  statusText: options.statusText || 'OK',
  headers: new Map(Object.entries(options.headers || {})),
  json: jest.fn().mockResolvedValue(body ? JSON.parse(body) : {}),
  text: jest.fn().mockResolvedValue(body || ''),
  clone: jest.fn(),
}));

// Mock Headers
global.Headers = jest.fn().mockImplementation(init => {
  const headers = new Map();
  if (init) {
    if (Array.isArray(init)) {
      init.forEach(([key, value]) => headers.set(key.toLowerCase(), value));
    } else if (typeof init === 'object') {
      Object.entries(init).forEach(([key, value]) => headers.set(key.toLowerCase(), value));
    }
  }
  return {
    get: key => headers.get(key.toLowerCase()),
    set: (key, value) => headers.set(key.toLowerCase(), value),
    has: key => headers.has(key.toLowerCase()),
    delete: key => headers.delete(key.toLowerCase()),
    entries: () => headers.entries(),
    keys: () => headers.keys(),
    values: () => headers.values(),
    forEach: callback => headers.forEach(callback),
  };
});

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, options) => ({
      ok: options?.status ? options.status < 400 : true,
      status: options?.status || 200,
      statusText: options?.statusText || 'OK',
      headers: new Map(Object.entries(options?.headers || {})),
      json: jest.fn().mockResolvedValue(data),
      text: jest.fn().mockResolvedValue(JSON.stringify(data)),
      clone: jest.fn(),
    })),
  },
}));

// Mock URL and URLSearchParams
global.URL = URL;
global.URLSearchParams = URLSearchParams;
