import { requireStaff } from '@/lib/staff-server';
import StaffShell from '@/components/StaffShell';
import TeamManager from '@/components/TeamManager';

export default async function TeamPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await requireStaff(params.slug);
  return (
    <StaffShell role={profile.role} name={profile.name}>
      <TeamManager restaurantId={restaurant.id} meId={profile.id} />
    </StaffShell>
  );
}
