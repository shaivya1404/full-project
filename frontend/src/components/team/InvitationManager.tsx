import { Mail, Clock, Trash2, RefreshCw } from 'lucide-react';
import type { Invitation } from '../../types';
import { InviteBadge, RoleBadge } from '../Badge';
import { Button } from '../Button';

interface InvitationManagerProps {
  invitations: Invitation[];
  loading?: boolean;
  onResendInvite: (inviteId: string) => void;
  onRevokeInvite: (inviteId: string) => void;
}

export const InvitationManager = ({
  invitations,
  loading,
  onResendInvite,
  onRevokeInvite,
}: InvitationManagerProps) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `In ${diffDays} days`;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading invitations...</span>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <Mail size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
        <p>No pending invitations</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-primary/30 dark:hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center gap-4 flex-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Mail size={18} className="text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {invitation.email}
                </p>
                <RoleBadge role={invitation.role} />
                <InviteBadge status={invitation.status} />
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {formatDate(invitation.expiresAt)}
                </span>
                <span>
                  Invited by {invitation.invitedBy}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {invitation.status === 'pending' && !isExpired(invitation.expiresAt) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResendInvite(invitation.id)}
                title="Resend invitation"
              >
                <RefreshCw size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRevokeInvite(invitation.id)}
              title="Revoke invitation"
            >
              <Trash2 size={16} className="text-red-500" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
