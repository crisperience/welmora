import { redirect } from 'next/navigation';

export default function ShoppingRedirectPage() {
  const today = new Date().toISOString().split('T')[0];
  redirect(`/shopping/${today}`);
}
