export type Role = 'admin' | 'manager' | 'agent' | 'viewer';

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'manage')[];
}

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    { resource: 'team', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'members', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'calls', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'recordings', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'transcripts', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'analytics', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'campaigns', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'contacts', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'api_keys', actions: ['create', 'read', 'delete', 'manage'] },
    { resource: 'audit_logs', actions: ['read', 'manage'] },
    { resource: 'settings', actions: ['read', 'update', 'manage'] },
  ],
  manager: [
    { resource: 'team', actions: ['read'] },
    { resource: 'members', actions: ['read', 'create', 'update'] },
    { resource: 'calls', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'recordings', actions: ['read'] },
    { resource: 'transcripts', actions: ['read'] },
    { resource: 'analytics', actions: ['read'] },
    { resource: 'campaigns', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'contacts', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'api_keys', actions: ['read', 'create'] },
    { resource: 'audit_logs', actions: ['read'] },
    { resource: 'settings', actions: ['read'] },
  ],
  agent: [
    { resource: 'team', actions: ['read'] },
    { resource: 'members', actions: ['read'] },
    { resource: 'calls', actions: ['create', 'read'] },
    { resource: 'recordings', actions: ['read'] },
    { resource: 'transcripts', actions: ['create', 'read'] },
    { resource: 'analytics', actions: ['read'] },
    { resource: 'campaigns', actions: ['read'] },
    { resource: 'contacts', actions: ['read', 'create'] },
    { resource: 'api_keys', actions: [] },
    { resource: 'audit_logs', actions: [] },
    { resource: 'settings', actions: [] },
  ],
  viewer: [
    { resource: 'team', actions: ['read'] },
    { resource: 'members', actions: ['read'] },
    { resource: 'calls', actions: ['read'] },
    { resource: 'recordings', actions: ['read'] },
    { resource: 'transcripts', actions: ['read'] },
    { resource: 'analytics', actions: ['read'] },
    { resource: 'campaigns', actions: ['read'] },
    { resource: 'contacts', actions: ['read'] },
    { resource: 'api_keys', actions: [] },
    { resource: 'audit_logs', actions: [] },
    { resource: 'settings', actions: [] },
  ],
};

export const hasPermission = (
  userRole: Role | null,
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete' | 'manage',
): boolean => {
  if (!userRole) return false;

  const permissions = ROLE_PERMISSIONS[userRole];
  if (!permissions) return false;

  const resourcePermission = permissions.find((p) => p.resource === resource);
  if (!resourcePermission) return false;

  return resourcePermission.actions.includes(action) || resourcePermission.actions.includes('manage');
};

export const getRoleHierarchy = (role: Role): number => {
  const hierarchy: Record<Role, number> = {
    admin: 4,
    manager: 3,
    agent: 2,
    viewer: 1,
  };
  return hierarchy[role];
};

export const canManageRole = (managerRole: Role, targetRole: Role): boolean => {
  return getRoleHierarchy(managerRole) > getRoleHierarchy(targetRole);
};
