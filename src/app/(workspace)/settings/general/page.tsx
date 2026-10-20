import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'تنظیمات عمومی | رهیار',
};

export default function GeneralSettingsPage() {
  redirect('/settings/company');
}

