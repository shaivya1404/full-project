import { MoreVertical, Edit, Trash2, ChevronUp, ChevronDown, User, ExternalLink, Pause, Play } from 'lucide-react';
import { useState } from 'react';
import type { Agent } from '../../types';
import { Badge } from '../Badge';
import { useNavigate } from 'react-router-dom';

type AgentsTableProps = {
  agents: Agent[];
  loading?: boolean;
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
  onStatusChange: (agent: Agent, status: Agent['status']) => void;
};

type SortField = 'firstName' | 'status' | 'role' | 'department' | 'createdAt';
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

export const AgentsTable = ({
  agents,
  loading,
  page,
  limit,
  total,
  onPageChange,
  onEdit,
  onDelete,
  onStatusChange,
}: AgentsTableProps) => {
  const [sortField, setSortField] = useState<SortField>('firstName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedAgents = [...agents].sort((a, b) => {
    let comparison = 0;
    const aValue = a[sortField] || '';
    const bValue = b[sortField] || '';

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'neutral';
      case 'break': return 'warning';
      case 'away': return 'warning';
      case 'busy': return 'error';
      default: return 'neutral';
    }
  };

  const PaginationControls = () => (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} agents
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('firstName')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Agent Name
                  <span className="ml-1"><SortIcon field="firstName" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Status
                  <span className="ml-1"><SortIcon field="status" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('role')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Role
                  <span className="ml-1"><SortIcon field="role" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('department')}
                  className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                >
                  Department
                  <span className="ml-1"><SortIcon field="department" sortField={sortField} sortOrder={sortOrder} /></span>
                </button>
              </th>
              <th className="px-6 py-3 text-left">Skills</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="inline-flex items-center">
                    <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Loading agents...</span>
                  </div>
                </td>
              </tr>
            ) : sortedAgents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center">
                    <User size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      No agents found
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Try adjusting your filters or search query
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold mr-3">
                        {agent.firstName[0]}{agent.lastName[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{agent.firstName} {agent.lastName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{agent.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={getStatusColor(agent.status)}>
                      {(agent.status || 'unknown').charAt(0).toUpperCase() + (agent.status || 'unknown').slice(1)}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-900 dark:text-white capitalize">
                      {agent.role.replace('_', ' ')}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {agent.department || 'Unassigned'}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {agent.skills?.slice(0, 3).map((skill) => (
                        <span key={skill.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          {skill.skillName}
                        </span>
                      ))}
                      {(agent.skills?.length || 0) > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                          +{(agent.skills?.length || 0) - 3} more
                        </span>
                      )}
                      {(!agent.skills || agent.skills.length === 0) && (
                        <span className="text-xs text-gray-400">No skills assigned</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === agent.id ? null : agent.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {menuOpen === agent.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                          <div className="py-1">
                            <button
                              onClick={() => navigate(`/dashboard/agents/${agent.id}`)}
                              className="w-full flex items-center px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <ExternalLink size={16} className="mr-2" />
                              View Profile
                            </button>
                            <button
                              onClick={() => {
                                onEdit(agent);
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Edit size={16} className="mr-2" />
                              Edit Agent
                            </button>
                            {agent.status === 'online' ? (
                              <button
                                onClick={() => {
                                  onStatusChange(agent, 'away');
                                  setMenuOpen(null);
                                }}
                                className="w-full flex items-center px-4 py-2 text-left text-sm text-yellow-600 dark:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Pause size={16} className="mr-2" />
                                Set Away
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  onStatusChange(agent, 'online');
                                  setMenuOpen(null);
                                }}
                                className="w-full flex items-center px-4 py-2 text-left text-sm text-green-600 dark:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <Play size={16} className="mr-2" />
                                Set Online
                              </button>
                            )}
                            <button
                              onClick={() => {
                                onDelete(agent);
                                setMenuOpen(null);
                              }}
                              className="w-full flex items-center px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Trash2 size={16} className="mr-2" />
                              Terminate Agent
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && sortedAgents.length > 0 && <PaginationControls />}
    </div>
  );
};
