import { requireStaff } from '@/lib/staff-server';
import StaffShell from '@/components/StaffShell';
import WaiterApp from '@/components/WaiterApp';

export default async function WaiterPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await requireStaff(params.slug);
  return (
    <StaffShell role={profile.role} name={profile.name}>
      <WaiterApp restaurantId={restaurant.id} waiterId={profile.id} />
    </StaffShell>
  );
}
