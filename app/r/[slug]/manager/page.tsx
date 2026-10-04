import { requireStaff } from '@/lib/staff-server';
import StaffShell from '@/components/StaffShell';
import ManagerApp from '@/components/ManagerApp';

export default async function ManagerPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await requireStaff(params.slug);
  return (
    <StaffShell role={profile.role} name={profile.name}>
      <ManagerApp restaurantId={restaurant.id} slug={restaurant.slug} restaurantName={restaurant.name} />
    </StaffShell>
  );
}
