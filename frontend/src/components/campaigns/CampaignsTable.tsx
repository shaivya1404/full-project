import { MoreVertical, Edit, Trash2, ChevronUp, ChevronDown, Play, Pause, Eye, BarChart2 } from 'lucide-react';
import { useState } from 'react';
import type { Campaign } from '../../types';
import { Badge } from '../Badge';

type CampaignsTableProps = {
  campaigns: Campaign[];
  loading?: boolean;
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onEdit: (campaign: Campaign) => void;
  onViewDetails: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
  onPauseResume: (campaign: Campaign) => void;
};

type SortField = 'name' | 'type' | 'status' | 'contactsCount' | 'callsMade' | 'successRate' | 'createdAt';
type SortOrder = 'asc' | 'desc';

type SortIconProps = {
  field: SortField;
  sortField: SortField;
  sortOrder: SortOrder;
};

const SortIcon = ({ field, sortField, sortOrder }: SortIconProps) => {
  if (sortField !== field) return null;
  return sortOrder === 'asc' ? (
    <ChevronUp size={14} />
  ) : (
    <ChevronDown size={14} />
  );
};

const totalPages = (total: number, limit: number) => Math.ceil(total / limit);

export const CampaignsTable = ({
  campaigns,
  loading,
  page,
  limit,
  total,
  onPageChange,
  onEdit,
  onViewDetails,
  onDelete,
  onPauseResume,
}: CampaignsTableProps) => {
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedCampaigns = [...campaigns].sort((a, b) => {
    let comparison = 0;
    const aValue = a[sortField];
    const bValue = b[sortField];

    if (aValue === undefined || bValue === undefined) return 0;

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const PaginationControls = () => (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} campaigns
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Page {page} of {totalPages(total, limit)}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages(total, limit)}
          className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  );

  const getStatusBadge = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return <Badge variant="success">Active</Badge>;
      case 'paused':
        return <Badge variant="warning">Paused</Badge>;
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: Campaign['type']) => {
    switch (type) {
      case 'inbound':
        return <Badge variant="info">Inbound</Badge>;
      case 'outbound':
        return <Badge variant="primary">Outbound</Badge>;
      default:
        return <Badge variant="default">{type}</Badge>;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-3">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Campaign Name
                  <span className="ml-1"><SortIcon field="name" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3">
                <button
                  onClick={() => handleSort('type')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Type
                  <span className="ml-1"><SortIcon field="type" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Status
                  <span className="ml-1"><SortIcon field="status" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3">
                <button
                  onClick={() => handleSort('contactsCount')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Contacts
                  <span className="ml-1"><SortIcon field="contactsCount" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3">
                <button
                  onClick={() => handleSort('callsMade')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Calls Made
                  <span className="ml-1"><SortIcon field="callsMade" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3">
                <button
                  onClick={() => handleSort('successRate')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Success Rate
                  <span className="ml-1"><SortIcon field="successRate" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3">
                <button
                  onClick={() => handleSort('createdAt')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Created Date
                  <span className="ml-1"><SortIcon field="createdAt" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center">
                  <div className="inline-flex items-center">
                    <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Loading campaigns...</span>
                  </div>
                </td>
              </tr>
            ) : sortedCampaigns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center">
                    <BarChart2 size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      No campaigns found
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Create your first campaign to get started
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedCampaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]" title={campaign.name}>
                        {campaign.name}
                      </span>
                      {campaign.description && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                          {campaign.description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getTypeBadge(campaign.type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(campaign.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {campaign.type === 'outbound' ? campaign.contactsCount || 0 : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {campaign.callsMade || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900 dark:text-white mr-2">
                        {campaign.successRate ? `${campaign.successRate}%` : '0%'}
                      </span>
                      <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-green-500 h-1.5 rounded-full" 
                          style={{ width: `${campaign.successRate || 0}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onViewDetails(campaign)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      
                      <div className="relative group">
                        <button
                          onClick={() => setMenuOpen(menuOpen === campaign.id ? null : campaign.id)}
                          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {menuOpen === campaign.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-10" 
                              onClick={() => setMenuOpen(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 overflow-hidden">
                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    onEdit(campaign);
                                    setMenuOpen(null);
                                  }}
                                  className="w-full flex items-center px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Edit size={16} className="mr-2" />
                                  Edit Campaign
                                </button>
                                <button
                                  onClick={() => {
                                    onPauseResume(campaign);
                                    setMenuOpen(null);
                                  }}
                                  className="w-full flex items-center px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {campaign.status === 'active' ? (
                                    <>
                                      <Pause size={16} className="mr-2" />
                                      Pause Campaign
                                    </>
                                  ) : (
                                    <>
                                      <Play size={16} className="mr-2" />
                                      Resume Campaign
                                    </>
                                  )}
                                </button>
                                <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
                                <button
                                  onClick={() => {
                                    onDelete(campaign);
                                    setMenuOpen(null);
                                  }}
                                  className="w-full flex items-center px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  <Trash2 size={16} className="mr-2" />
                                  Delete Campaign
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && sortedCampaigns.length > 0 && <PaginationControls />}
    </div>
  );
};
