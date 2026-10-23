import { redirect } from 'next/navigation';

export default function PlanningPage() {
  redirect('/dashboard/conversations?tab=planning');
}
