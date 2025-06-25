import { redirect } from 'next/navigation';

export default function PackingRedirectPage() {
    // Server-side redirect to today's date
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    redirect(`/packing/${today}`);
} 