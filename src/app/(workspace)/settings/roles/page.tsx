import { RolesManagementPage } from './roles-management-page';
import { SettingsOrganizationTabs } from '@/app/(workspace)/settings/components/settings-organization-tabs';

export default function RolesSettingsPage() {
  return <div className="w-full space-y-5"><SettingsOrganizationTabs /><RolesManagementPage /></div>;
}
