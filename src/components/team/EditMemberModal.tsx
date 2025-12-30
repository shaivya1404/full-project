import { Modal, Button, Select } from '../index';
import type { TeamMember, Role } from '../../types';
import { useState, useEffect } from 'react';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: TeamMember | null;
  onUpdateRole: (memberId: string, role: Role) => void;
  loading?: boolean;
}

const roleOptions = [
  { value: 'viewer' as Role, label: 'Viewer - Read-only access' },
  { value: 'agent' as Role, label: 'Agent - Can manage calls' },
  { value: 'manager' as Role, label: 'Manager - Can manage team' },
  { value: 'admin' as Role, label: 'Admin - Full access' },
];

export const EditMemberModal = ({
  isOpen,
  onClose,
  member,
  onUpdateRole,
  loading,
}: EditMemberModalProps) => {
  const [role, setRole] = useState<Role>(member?.role || 'viewer');

  useEffect(() => {
    if (member) {
      setRole(member.role);
    }
  }, [member]);

  if (!member) return null;

  const handleUpdate = () => {
    onUpdateRole(member.id, role);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Member Role"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleUpdate} isLoading={loading}>
            Update Role
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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

        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          options={roleOptions}
        />

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">Role Permissions</h4>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>• <strong>Viewer:</strong> Can view calls and analytics</li>
            <li>• <strong>Agent:</strong> Can manage calls and add notes</li>
            <li>• <strong>Manager:</strong> Can manage team members</li>
            <li>• <strong>Admin:</strong> Full access to all features</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
};
