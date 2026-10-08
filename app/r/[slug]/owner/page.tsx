import { requireStaff } from '@/lib/staff-server';
import StaffShell from '@/components/StaffShell';
import OwnerApp from '@/components/OwnerApp';

export default async function OwnerPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await requireStaff(params.slug);
  return (
    <StaffShell role={profile.role} name={profile.name}>
      <OwnerApp
        restaurantId={restaurant.id}
        slug={restaurant.slug}
        restaurantName={restaurant.name}
        viewerId={profile.id}
        viewerRole={profile.role}
        viewerName={profile.name}
      />
    </StaffShell>
  );
}
