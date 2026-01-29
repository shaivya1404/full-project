import { DashboardLayout } from '../components/DashboardLayout';
import { CallMonitoringPanel } from '../components/live-calls/CallMonitoringPanel';

export const CallMonitor = () => {
  return (
    <DashboardLayout>
      <CallMonitoringPanel />
    </DashboardLayout>
  );
};