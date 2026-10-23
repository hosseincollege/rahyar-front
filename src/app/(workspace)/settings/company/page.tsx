import { CompanyInformationPage } from './company-information-page';
import { SettingsOrganizationTabs } from '@/app/(workspace)/settings/components/settings-organization-tabs';

export default function CompanySettingsPage() {
  return <div className="w-full space-y-5"><SettingsOrganizationTabs /><CompanyInformationPage /></div>;
}
