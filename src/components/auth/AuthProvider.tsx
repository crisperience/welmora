'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// PWA-compatible storage functions
const getAuthStatus = (): boolean => {
  try {
    // Try sessionStorage first (better security)
    const sessionAuth = sessionStorage.getItem('welmora_auth');
    if (sessionAuth === 'authenticated') {
      return true;
    }

    // Fallback to localStorage for PWA persistence (iOS compatibility)
    const localAuth = localStorage.getItem('welmora_auth_persistent');
    if (localAuth === 'authenticated') {
      // Restore to sessionStorage for current session
      sessionStorage.setItem('welmora_auth', 'authenticated');
      return true;
    }

    return false;
  } catch (error) {
    console.warn('Storage access failed:', error);
    return false;
  }
};

const setAuthStatus = (authenticated: boolean) => {
  try {
    if (authenticated) {
      sessionStorage.setItem('welmora_auth', 'authenticated');
      // For PWA: also store in localStorage with expiration
      const expirationTime = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
      localStorage.setItem('welmora_auth_persistent', 'authenticated');
      localStorage.setItem('welmora_auth_expiry', expirationTime.toString());
    } else {
      sessionStorage.removeItem('welmora_auth');
      localStorage.removeItem('welmora_auth_persistent');
      localStorage.removeItem('welmora_auth_expiry');
    }
  } catch (error) {
    console.warn('Storage write failed:', error);
  }
};

const checkAuthExpiry = (): boolean => {
  try {
    const expiryTime = localStorage.getItem('welmora_auth_expiry');
    if (!expiryTime) return false;

    const expiry = parseInt(expiryTime, 10);
    if (Date.now() > expiry) {
      // Expired, clean up
      localStorage.removeItem('welmora_auth_persistent');
      localStorage.removeItem('welmora_auth_expiry');
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check authentication status with PWA compatibility
    const checkAuth = () => {
      // First check if persistent auth is expired
      if (!checkAuthExpiry()) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      // Check current auth status
      const authStatus = getAuthStatus();
      setIsAuthenticated(authStatus);
      setIsLoading(false);
    };

    checkAuth();

    // PWA visibility change handler (for iOS PWA background/foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // App became visible, recheck auth status
        if (!checkAuthExpiry()) {
          setIsAuthenticated(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const login = (username: string, password: string): boolean => {
    // Simple authentication check
    const validUser = process.env.NEXT_PUBLIC_AUTH_USER || 'admin';
    const validPassword = process.env.NEXT_PUBLIC_AUTH_PASSWORD || 'Welmora2025!?';

    if (username === validUser && password === validPassword) {
      setIsAuthenticated(true);
      setAuthStatus(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setAuthStatus(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
