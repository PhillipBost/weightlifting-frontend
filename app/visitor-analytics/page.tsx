import { getVisitorStats } from '@/lib/analytics/visitorStats';
import { VisitorAnalyticsDashboard } from './VisitorAnalyticsDashboard';

export const dynamic = 'force-dynamic';

export default async function VisitorAnalyticsPage() {
  const initialData = await getVisitorStats('30d');

  return (
    <VisitorAnalyticsDashboard
      initialData={initialData}
      initialRange="30d"
    />
  );
}
