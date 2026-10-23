import { redirect } from 'next/navigation';

export default function AccountSwitchingPage() {
  redirect('/settings/modules?tab=header');
}
