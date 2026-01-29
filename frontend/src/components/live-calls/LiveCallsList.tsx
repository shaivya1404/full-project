import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Filter,
  RotateCcw,
  Phone,
  User,
  Clock,
  Activity,
  Headphones,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import type { LiveCall } from '../../types';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { useAuthStore } from '../../store/authStore';
import { getLiveCalls } from '../../services/api';
import { formatDuration } from '../../utils/formatters';
import { LiveCallFilters } from './LiveCallFilters';
import { CallAlertNotifications } from './CallAlertNotifications';

type SortField = 'duration' | 'sentiment' | 'quality' | 'startTime';
type SortDirection = 'asc' | 'desc';

interface FilterState {
  status?: string;
  agent?: string;
  campaign?: string;
  sentiment?: string;
  duration?: string;
  quality?: string;
  search?: string;
}

export const LiveCallsList = () => {
  const [calls, setCalls] = useState<LiveCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('duration');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filters, setFilters] = useState<FilterState>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  const { user } = useAuthStore();
  const teamId = user?.id || '';

  // Auto-refresh calls every 3 seconds
  useEffect(() => {
    if (!teamId) return;

    const fetchCalls = async () => {
      try {
        const response = await getLiveCalls(teamId);
        setCalls(response.data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch live calls');
        console.error('Error fetching live calls:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCalls();
    const interval = setInterval(fetchCalls, 3000);

    return () => clearInterval(interval);
  }, [teamId]);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and sort calls
  const filteredAndSortedCalls = calls
    .filter(call => {
      if (filters.status && call.status !== filters.status) return false;
      if (filters.agent && call.agentName?.toLowerCase().includes(filters.agent.toLowerCase()) === false) return false;
      if (filters.campaign && call.campaign?.toLowerCase().includes(filters.campaign.toLowerCase()) === false) return false;
      if (filters.sentiment && call.sentiment !== filters.sentiment) return false;
      if (filters.quality) {
        const quality = call.callQuality;
        switch (filters.quality) {
          case 'excellent': if (quality < 90) return false; break;
          case 'good': if (quality < 70 || quality >= 90) return false; break;
          case 'poor': if (quality >= 70) return false; break;
        }
      }
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        return (
          call.callerName.toLowerCase().includes(searchTerm) ||
          call.callerPhone.includes(searchTerm) ||
          call.agentName?.toLowerCase().includes(searchTerm) ||
          call.campaign?.toLowerCase().includes(searchTerm)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortField) {
        case 'duration':
          aValue = a.duration;
          bValue = b.duration;
          break;
        case 'sentiment':
          const sentimentOrder = { positive: 3, neutral: 2, negative: 1 };
          aValue = sentimentOrder[a.sentiment || 'neutral'];
          bValue = sentimentOrder[b.sentiment || 'neutral'];
          break;
        case 'quality':
          aValue = a.callQuality;
          bValue = b.callQuality;
          break;
        case 'startTime':
          aValue = new Date(a.startTime);
          bValue = new Date(b.startTime);
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'on-hold': return 'bg-yellow-500';
      case 'transferring': return 'bg-blue-500';
      case 'recording': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50';
      case 'negative': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 90) return 'text-green-600';
    if (quality >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Live Calls</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {calls.length} active call{calls.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2"
          >
            <Filter size={16} />
            <span>Filters</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="flex items-center space-x-2"
          >
            <RotateCcw size={16} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <LiveCallFilters
          filters={filters}
          onFiltersChange={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* Alerts */}
      <CallAlertNotifications teamId={teamId} />

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
          <AlertTriangle className="text-red-500" size={20} />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Calls Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('startTime')}
                    className="flex items-center space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>Call</span>
                    {sortField === 'startTime' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('duration')}
                    className="flex items-center space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>Duration</span>
                    {sortField === 'duration' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('sentiment')}
                    className="flex items-center space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>Sentiment</span>
                    {sortField === 'sentiment' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('quality')}
                    className="flex items-center space-x-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <span>Quality</span>
                    {sortField === 'quality' && (
                      <span className="text-primary">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredAndSortedCalls.map((call) => (
                <tr
                  key={call.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${selectedCallId === call.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  onClick={() => setSelectedCallId(call.id)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <Phone className="h-5 w-5 text-gray-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {call.callerName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {call.callerPhone}
                        </div>
                        {call.campaign && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {call.campaign}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {call.agentName || 'Unassigned'}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDuration(call.duration)}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(call.status)}`}></div>
                      <span className="text-sm text-gray-900 dark:text-white capitalize">
                        {call.status.replace('-', ' ')}
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    {call.sentiment && (
                      <Badge
                        variant="secondary"
                        className={getSentimentColor(call.sentiment)}
                      >
                        {call.sentiment}
                      </Badge>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Activity className={`h-4 w-4 ${getQualityColor(call.callQuality)}`} />
                      <span className={`text-sm font-medium ${getQualityColor(call.callQuality)}`}>
                        {call.callQuality}%
                      </span>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <Link to={`/dashboard/calls/${call.callId}/monitor`}>
                        <Button size="sm" variant="outline">
                          <Headphones size={16} className="mr-1" />
                          Monitor
                        </Button>
                      </Link>

                      <Link to={`/dashboard/calls/${call.callId}/monitor`}>
                        <Button size="sm" variant="outline">
                          <ArrowRight size={16} className="mr-1" />
                          Details
                        </Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAndSortedCalls.length === 0 && (
            <div className="text-center py-12">
              <Phone className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                No active calls
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {Object.keys(filters).length > 0
                  ? 'No calls match your current filters.'
                  : 'All agents are currently idle.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};