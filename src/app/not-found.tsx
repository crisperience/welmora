import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-gray-600 mb-4">Page not found</p>
        <Link href="/" className="text-amber-600 hover:text-amber-700 underline">
          Go back home
        </Link>
      </div>
    </div>
  );
}
