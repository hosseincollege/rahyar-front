import { UserAccountsPage } from './user-accounts-page';
import { SettingsAccessTabs } from '@/app/(workspace)/settings/components/settings-access-tabs';

export default function AccountsSettingsPage() {
  return <div dir="rtl" className="w-full space-y-5"><SettingsAccessTabs /><UserAccountsPage /></div>;
}
