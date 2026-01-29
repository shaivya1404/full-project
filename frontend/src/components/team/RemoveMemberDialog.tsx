import { Modal, Button } from '../index';
import type { TeamMember } from '../../types';
import { AlertTriangle } from 'lucide-react';

interface RemoveMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  onRemove: (memberId: string) => void;
  loading?: boolean;
}

export const RemoveMemberDialog = ({
  isOpen,
  onClose,
  member,
  onRemove,
  loading,
}: RemoveMemberDialogProps) => {
  if (!member) return null;

  const handleRemove = () => {
    onRemove(member.id);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove Team Member"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleRemove} isLoading={loading}>
            Remove Member
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <AlertTriangle className="text-red-600 dark:text-red-400 mt-0.5" size={20} />
          <div>
            <p className="font-medium text-red-900 dark:text-red-300">
              This action cannot be undone
            </p>
            <p className="text-sm text-red-800 dark:text-red-400 mt-1">
              The member will lose access to the team immediately.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          {member.avatarUrl ? (
            <img
              src={member.avatarUrl}
              alt={member.name}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
              <span className="text-lg font-semibold text-white">
                {member.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{member.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{member.email}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
