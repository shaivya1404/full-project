import type { RolePermissions } from '../../types';
import { Check, X } from 'lucide-react';

interface PermissionMatrixProps {
  rolePermissions: RolePermissions[];
  currentRole?: string;
}

export const PermissionMatrix = ({ rolePermissions, currentRole }: PermissionMatrixProps) => {
  if (rolePermissions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No permissions data available
      </div>
    );
  }

  const allPermissions = Array.from(
    new Set(rolePermissions.flatMap((rp) => rp.permissions.map((p) => p.key)))
  );

  const hasPermission = (role: string, permissionKey: string): boolean => {
    const rp = rolePermissions.find((r) => r.role === role);
    return rp?.permissions.some((p) => p.key === permissionKey) ?? false;
  };

  const getPermissionLabel = (key: string): string => {
    for (const rp of rolePermissions) {
      const perm = rp.permissions.find((p) => p.key === key);
      if (perm) return perm.label;
    }
    return key;
  };

  const roleOrder: string[] = ['admin', 'manager', 'agent', 'viewer'];

  const sortedRolePermissions = [...rolePermissions].sort((a, b) =>
    roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role)
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider min-w-[200px]">
                Permission
              </th>
              {sortedRolePermissions.map((rp) => (
                <th
                  key={rp.role}
                  className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider ${
                    rp.role === currentRole ? 'bg-primary/10 text-primary' : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {rp.role.charAt(0).toUpperCase() + rp.role.slice(1)}
                  {rp.role === currentRole && (
                    <span className="ml-2 text-xs">(Current)</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {allPermissions.map((permissionKey) => (
              <tr key={permissionKey} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {getPermissionLabel(permissionKey)}
                </td>
                {sortedRolePermissions.map((rp) => (
                  <td
                    key={rp.role}
                    className={`px-4 py-3 text-center ${
                      rp.role === currentRole ? 'bg-primary/5' : ''
                    }`}
                  >
                    {hasPermission(rp.role, permissionKey) ? (
                      <Check className="mx-auto text-green-600 dark:text-green-400" size={18} />
                    ) : (
                      <X className="mx-auto text-gray-400 dark:text-gray-600" size={18} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
