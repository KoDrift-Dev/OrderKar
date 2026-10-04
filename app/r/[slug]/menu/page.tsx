import { requireStaff } from '@/lib/staff-server';
import StaffShell from '@/components/StaffShell';
import MenuManager from '@/components/MenuManager';

export default async function MenuPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await requireStaff(params.slug);
  return (
    <StaffShell role={profile.role} name={profile.name}>
      <MenuManager restaurantId={restaurant.id} />
    </StaffShell>
  );
}
