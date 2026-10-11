import { redirect } from 'next/navigation';

// Owner and Manager share one unified console with full access.
// The old /manager route redirects here so bookmarks and deep links keep working.
export default async function ManagerPage({ params }: { params: { slug: string } }) {
  redirect(`/r/${params.slug}/owner`);
}
