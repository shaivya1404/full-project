import { DashboardLayout } from '../components/DashboardLayout';
import { LiveCallsList } from '../components/live-calls/LiveCallsList';

export const LiveCalls = () => {
  return (
    <DashboardLayout>
      <LiveCallsList />
    </DashboardLayout>
  );
};