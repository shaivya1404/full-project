import { useState } from 'react';
import { DashboardLayout, Card } from '../components';
import { useLeadsByTier, useLeadAnalytics, useRecalculateLeadScore, type Contact } from '../api/leads';
import { Users, TrendingUp, Flame, ThermometerSun, Snowflake, RefreshCw, Search } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

type LeadTier = 'hot' | 'warm' | 'cold' | 'unknown';

const tierConfig = {
  hot: { label: 'Hot', color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/20', icon: Flame },
  warm: { label: 'Warm', color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/20', icon: ThermometerSun },
  cold: { label: 'Cold', color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/20', icon: Snowflake },
  unknown: { label: 'Unknown', color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-900/20', icon: Users },
};

export const LeadsPage = () => {
  const { user } = useAuthStore();
  const teamId = user?.id || '';

  const [activeTier, setActiveTier] = useState<LeadTier>('hot');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 20;

  const { data: analytics, isLoading: analyticsLoading } = useLeadAnalytics(teamId);
  const { data: leadsData, isLoading: leadsLoading } = useLeadsByTier(activeTier, undefined, page, limit);
  const recalculateMutation = useRecalculateLeadScore();

  const handleRecalculate = async (contactId: string) => {
    try {
      await recalculateMutation.mutateAsync(contactId);
      toast.success('Lead score recalculated');
    } catch {
      toast.error('Failed to recalculate score');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Lead Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Track and manage lead scores, tiers, and buying signals
            </p>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Leads</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {analyticsLoading ? '...' : analytics?.totalLeads || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-gray-400" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Hot Leads</p>
                <p className="text-2xl font-bold text-red-600">
                  {analyticsLoading ? '...' : analytics?.hotLeads || 0}
                </p>
              </div>
              <Flame className="h-8 w-8 text-red-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-orange-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Warm Leads</p>
                <p className="text-2xl font-bold text-orange-600">
                  {analyticsLoading ? '...' : analytics?.warmLeads || 0}
                </p>
              </div>
              <ThermometerSun className="h-8 w-8 text-orange-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Cold Leads</p>
                <p className="text-2xl font-bold text-blue-600">
                  {analyticsLoading ? '...' : analytics?.coldLeads || 0}
                </p>
              </div>
              <Snowflake className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Score</p>
                <p className="text-2xl font-bold text-green-600">
                  {analyticsLoading ? '...' : analytics?.averageScore?.toFixed(1) || 0}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </Card>
        </div>

        {/* Tier Tabs */}
        <div className="flex gap-2 flex-wrap">
          {(['hot', 'warm', 'cold', 'unknown'] as LeadTier[]).map((tier) => {
            const config = tierConfig[tier];
            const Icon = config.icon;
            return (
              <button
                key={tier}
                onClick={() => { setActiveTier(tier); setPage(1); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTier === tier
                    ? `${config.bgColor} ${config.color}`
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {config.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <Card className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </Card>

        {/* Leads Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Calls
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {leadsLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : leadsData?.data?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      No leads found in this tier
                    </td>
                  </tr>
                ) : (
                  (leadsData?.data ?? [])
                    .filter((lead: Contact) =>
                      !search ||
                      lead.name?.toLowerCase().includes(search.toLowerCase()) ||
                      lead.phone.includes(search) ||
                      lead.email?.toLowerCase().includes(search.toLowerCase())
                    )
                    .map((lead: Contact) => {
                      const tier = lead.leadTier as LeadTier;
                      const config = tierConfig[tier] || tierConfig.unknown;
                      const Icon = config.icon;

                      return (
                        <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">
                                {lead.name || 'Unknown'}
                              </div>
                              <div className="text-sm text-gray-500">{lead.phone}</div>
                              {lead.email && (
                                <div className="text-sm text-gray-400">{lead.email}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-lg font-bold ${getScoreColor(lead.leadScore)}`}>
                              {lead.leadScore}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
                              <Icon className="h-3 w-3" />
                              {config.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {lead.successfulCalls}/{lead.totalCalls}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {lead.lastContactedAt
                              ? new Date(lead.lastContactedAt).toLocaleDateString()
                              : 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleRecalculate(lead.id)}
                              disabled={recalculateMutation.isPending}
                              className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
                            >
                              <RefreshCw className={`h-4 w-4 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
                              Recalculate
                            </button>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {leadsData && leadsData.total > limit && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, leadsData.total)} of {leadsData.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= leadsData.total}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Top Buying Signals */}
        {analytics?.topSignals && analytics.topSignals.length > 0 && (
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top Buying Signals
            </h3>
            <div className="flex flex-wrap gap-2">
              {analytics.topSignals.map((signal, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-sm"
                >
                  {signal.signal}
                  <span className="bg-green-200 dark:bg-green-800 px-1.5 py-0.5 rounded-full text-xs">
                    {signal.count}
                  </span>
                </span>
              ))}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};
