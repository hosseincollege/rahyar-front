import { AccountProfilePage } from '@/app/(workspace)/dashboard/profile/account-center';
import { redirect } from 'next/navigation';

type ProfilePageProps = { searchParams: Promise<{ tab?: string; person?: string }> };

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const query = await searchParams;
  if (query.tab === 'organization') {
    redirect('/settings/organization');
  }
  if (query.person) {
    redirect(`/dashboard/organization${query.person ? `?person=${encodeURIComponent(query.person)}` : ''}`);
  }
  return <AccountProfilePage />;
}
