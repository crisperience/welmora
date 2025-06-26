import { redirect } from 'next/navigation';

export default function PackingRedirectPage() {
  const today = new Date().toISOString().split('T')[0];
  redirect(`/packing/${today}`);
}
