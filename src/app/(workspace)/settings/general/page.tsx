import type { Metadata } from 'next';
import { GeneralSettingsContent } from './general-settings-content';

export const metadata: Metadata = {
  title: 'تنظیمات عمومی | رهیار',
};

export default function GeneralSettingsPage() {
  return <GeneralSettingsContent />;
}
