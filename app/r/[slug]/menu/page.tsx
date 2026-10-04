import { requireStaff } from '@/lib/staff-server';
import StaffShell from '@/components/StaffShell';
import MenuSection from '@/components/MenuSection';

export default async function MenuPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await requireStaff(params.slug);
  return (
    <StaffShell role={profile.role} name={profile.name}>
      <MenuSection restaurantId={restaurant.id} />
    </StaffShell>
  );
}
