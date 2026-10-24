import { UserAccountsPage } from './user-accounts-page';
import { SettingsOrganizationTabs } from '@/app/(workspace)/settings/components/settings-organization-tabs';

export default function AccountsSettingsPage() {
  return <div dir="rtl" className="w-full space-y-5"><SettingsOrganizationTabs /><UserAccountsPage /></div>;
}
