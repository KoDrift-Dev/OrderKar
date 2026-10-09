import { requireStaff } from '@/lib/staff-server';
import StaffShell from '@/components/StaffShell';
import PosTab from '@/components/PosTab';

export default async function PosPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await requireStaff(params.slug);

  return (
    <StaffShell role={profile.role} name={profile.name}>
      <div className="mx-auto max-w-7xl px-3 py-2 sm:px-6 h-[calc(100vh-70px)] flex flex-col overflow-hidden">
        <PosTab
          restaurantId={restaurant.id}
          restaurant={{
            name: restaurant.name,
            address: (restaurant.theme_config as Record<string, unknown> | null)?.address as string | undefined,
            phone: (restaurant.theme_config as Record<string, unknown> | null)?.phone as string | undefined,
            email: (restaurant.theme_config as Record<string, unknown> | null)?.email as string | undefined,
          }}
        />
      </div>
    </StaffShell>
  );
}
