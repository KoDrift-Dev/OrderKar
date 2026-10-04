import Link from 'next/link';
import { Card } from '@/components/ui';

export default function UnknownTenant() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <Card deep className="p-10">
        <p className="text-5xl">🍽️</p>
        <h1 className="mt-4 font-display text-2xl font-extrabold text-ink">Restaurant not found</h1>
        <p className="mt-2 text-muted">
          This OrderKar link doesn&apos;t match any restaurant. Check the QR code or URL.
        </p>
        <Link href="/" className="btn-3d mt-6 inline-block rounded-btn px-6 py-3 font-display font-bold text-white">
          Go to OrderKar home
        </Link>
      </Card>
    </div>
  );
}
