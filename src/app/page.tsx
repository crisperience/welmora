'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function OrdersPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to today's shopping page
    const today = new Date().toISOString().split('T')[0];
    router.push(`/shopping/${today}`);
  }, [router]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to shopping...</p>
      </div>
    </div>
  );
}
