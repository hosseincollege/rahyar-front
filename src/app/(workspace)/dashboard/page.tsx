import { AuthenticatedHome } from '@/app/(workspace)/dashboard/authenticated-home';

export const metadata = {
  title: 'داشبورد | سامانه یکپارچه',
};

export default function DashboardPage() {
  return <AuthenticatedHome />;
}
