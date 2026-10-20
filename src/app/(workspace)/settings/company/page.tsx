import type { Metadata } from 'next';
import { GeneralAppearanceSettings } from './general-appearance-settings';

export const metadata: Metadata = { title: 'تنظیمات عمومی | رهیار' };

export default function CompanySettingsPage() {
  return <GeneralAppearanceSettings />;
}
