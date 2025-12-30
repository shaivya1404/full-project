import type { Role, MemberStatus, InviteStatus } from '../types';
import { ShieldCheck, Users, Eye, Crown } from 'lucide-react';
import clsx from 'clsx';

const roleConfig = {
  admin: {
    label: 'Admin',
    icon: Crown,
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-800 dark:text-purple-300',
  },
  manager: {
    label: 'Manager',
    icon: ShieldCheck,
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-300',
  },
  agent: {
    label: 'Agent',
    icon: Users,
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-300',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    bg: 'bg-gray-100 dark:bg-gray-700/30',
    text: 'text-gray-800 dark:text-gray-300',
  },
};

const statusConfig = {
  active: {
    label: 'Active',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-300',
  },
  pending: {
    label: 'Pending',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-300',
  },
  inactive: {
    label: 'Inactive',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
  },
};

const inviteConfig = {
  pending: {
    label: 'Pending',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-300',
  },
  accepted: {
    label: 'Accepted',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-300',
  },
  expired: {
    label: 'Expired',
    bg: 'bg-red-100 dark:bg-red-900/30',
    text: 'text-red-800 dark:text-red-300',
  },
  revoked: {
    label: 'Revoked',
    bg: 'bg-gray-100 dark:bg-gray-700/30',
    text: 'text-gray-800 dark:text-gray-300',
  },
};

export const RoleBadge = ({ role, className }: { role: Role; className?: string }) => {
  const config = roleConfig[role];
  const Icon = config.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
};

export const StatusBadge = ({ status, className }: { status: MemberStatus; className?: string }) => {
  const config = statusConfig[status];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {config.label}
    </span>
  );
};

export const InviteBadge = ({ status, className }: { status: InviteStatus; className?: string }) => {
  const config = inviteConfig[status as keyof typeof inviteConfig];

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
};
