import { redirect } from 'next/navigation';

export default function ShoppingRedirectPage() {
  // Server-side redirect to today's date
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  redirect(`/shopping/${today}`);
}
