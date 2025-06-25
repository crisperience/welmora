'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ShoppingRedirectPage() {
    const router = useRouter();

    useEffect(() => {
        // Redirect to today's date
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        router.replace(`/shopping/${today}`);
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Redirecting to today&apos;s shopping list...</p>
            </div>
        </div>
    );
} 