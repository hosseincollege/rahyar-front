import { RolesManagementPage } from './roles-management-page';
import { SettingsAccessTabs } from '@/app/(workspace)/settings/components/settings-access-tabs';

export default function RolesSettingsPage() {
  return <div className="w-full space-y-5"><SettingsAccessTabs /><RolesManagementPage /></div>;
}
