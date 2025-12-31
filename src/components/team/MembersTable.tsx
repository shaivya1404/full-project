import { MoreVertical, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { TeamMember, Role, MemberStatus } from '../../types';
import { RoleBadge, StatusBadge } from '../Badge';

interface MembersTableProps {
  members: TeamMember[];
  loading?: boolean;
  onEdit: (member: TeamMember) => void;
  onRemove: (member: TeamMember) => void;
  onResendInvite: (member: TeamMember) => void;
}

type SortField = 'name' | 'email' | 'role' | 'status' | 'joinedAt';
type SortOrder = 'asc' | 'desc';

interface SortIconProps {
  field: SortField;
  sortField: SortField;
  sortOrder: SortOrder;
}

const SortIcon = ({ field, sortField, sortOrder }: SortIconProps) => {
  if (sortField !== field) return null;
  return sortOrder === 'asc' ? (
    <ChevronUp size={14} />
  ) : (
    <ChevronDown size={14} />
  );
};

export const MembersTable = ({
  members,
  loading,
  onEdit,
  onRemove,
  onResendInvite,
}: MembersTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const roleOptions: { value: Role | 'all'; label: string }[] = [
    { value: 'all', label: 'All Roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'agent', label: 'Agent' },
    { value: 'viewer', label: 'Viewer' },
  ];

  const statusOptions: { value: MemberStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'inactive', label: 'Inactive' },
  ];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedMembers = members
    .filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'all' || member.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || member.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else {
        comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="flex gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | 'all')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MemberStatus | 'all')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                  >
                    Name
                    <span className="ml-1"><SortIcon field="name" sortField={sortField} sortOrder={sortOrder} /></span>
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('email')}
                    className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                  >
                    Email
                    <span className="ml-1"><SortIcon field="email" sortField={sortField} sortOrder={sortOrder} /></span>
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
                    onClick={() => handleSort('status')}
                    className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                  >
                    Status
                    <span className="ml-1"><SortIcon field="status" sortField={sortField} sortOrder={sortOrder} /></span>
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button
                    onClick={() => handleSort('joinedAt')}
                    className="flex items-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
                  >
                    Joined
                    <span className="ml-1"><SortIcon field="joinedAt" sortField={sortField} sortOrder={sortOrder} /></span>
                  </button>
                </th>
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
                      <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No members found
                  </td>
                </tr>
              ) : (
                filteredAndSortedMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.avatarUrl ? (
                          <img
                            src={member.avatarUrl}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                            <span className="text-sm font-semibold text-white">
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                          {member.lastActive && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Last active {new Date(member.lastActive).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-gray-600 dark:text-gray-400">{member.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <RoleBadge role={member.role} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {menuOpen === member.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  onEdit(member);
                                  setMenuOpen(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Edit Role
                              </button>
                              {member.status === 'pending' && (
                                <button
                                  onClick={() => {
                                    onResendInvite(member);
                                    setMenuOpen(null);
                                  }}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  Resend Invite
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  onRemove(member);
                                  setMenuOpen(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                Remove Member
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
      </div>
    </div>
  );
};
