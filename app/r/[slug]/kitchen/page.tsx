import { requireStaff } from '@/lib/staff-server';
import StaffShell from '@/components/StaffShell';
import KitchenApp from '@/components/KitchenApp';

export default async function KitchenPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await requireStaff(params.slug);
  return (
    <StaffShell role={profile.role} name={profile.name}>
      <KitchenApp restaurantId={restaurant.id} />
    </StaffShell>
  );
}
