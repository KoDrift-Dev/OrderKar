import { requireStaff } from '@/lib/staff-server';
import OwnerApp from '@/components/OwnerApp';

// Owner console renders its own shell (sidebar + topbar), so no StaffShell here.

export default async function OwnerPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await requireStaff(params.slug);
  return (
    <OwnerApp
      restaurantId={restaurant.id}
      slug={restaurant.slug}
      restaurantName={restaurant.name}
      viewerId={profile.id}
      viewerRole={profile.role}
      viewerName={profile.name}
    />
  );
}
