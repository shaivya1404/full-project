import { DashboardLayout, Card, Button } from '../components';
import { AuditLogTable } from '../components/team/AuditLogTable';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs, exportAuditLogs } from '../services/api';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, FileText } from 'lucide-react';

export const TeamAuditPage = () => {
  const [filters, setFilters] = useState<{ actionType?: string; userId?: string; startDate?: string; endDate?: string }>({});
  const [isExporting, setIsExporting] = useState(false);

  const { data: auditLogsData, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => getAuditLogs(1, 100, filters),
  });

  const handleFilterChange = (newFilters: { actionType?: string; userId?: string }) => {
    setFilters({ ...filters, ...newFilters });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await exportAuditLogs(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Audit logs exported successfully');
    } catch {
      toast.error('Failed to export audit logs');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Audit Logs
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track all team activities and changes
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <FileText className="text-blue-600 dark:text-blue-400" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Activity History
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {auditLogsData?.total || 0} total events
                </p>
              </div>
            </div>
            <Button onClick={handleExport} isLoading={isExporting}>
              <Download size={18} className="mr-2" />
              Export
            </Button>
          </div>

          <AuditLogTable
            auditLogs={auditLogsData?.data || []}
            loading={isLoading}
            onExport={handleExport}
            onFilterChange={handleFilterChange}
          />
        </Card>
      </div>
    </DashboardLayout>
  );
};
