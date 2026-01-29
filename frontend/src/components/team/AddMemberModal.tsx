import { Modal, Button, Input, Select } from '../index';
import type { Role } from '../../types';
import { useState } from 'react';
import { Plus, Upload } from 'lucide-react';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddMember: (email: string, role: Role) => void;
  onBulkInvite: (emails: string[], role: Role) => void;
  loading?: boolean;
}

const roleOptions = [
  { value: 'viewer' as Role, label: 'Viewer' },
  { value: 'agent' as Role, label: 'Agent' },
  { value: 'manager' as Role, label: 'Manager' },
  { value: 'admin' as Role, label: 'Admin' },
];

export const AddMemberModal = ({
  isOpen,
  onClose,
  onAddMember,
  onBulkInvite,
  loading,
}: AddMemberModalProps) => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [bulkEmails, setBulkEmails] = useState('');
  const [emailError, setEmailError] = useState('');

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSingleAdd = () => {
    if (!email.trim()) {
      setEmailError('Email is required');
      return;
    }
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailError('');
    onAddMember(email.trim(), role);
    setEmail('');
    setRole('viewer');
  };

  const handleBulkAdd = () => {
    const emails = bulkEmails
      .split('\n')
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emails.length === 0) {
      setEmailError('Please add at least one email address');
      return;
    }

    const invalidEmails = emails.filter(e => !validateEmail(e));
    if (invalidEmails.length > 0) {
      setEmailError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      return;
    }

    setEmailError('');
    onBulkInvite(emails, role);
    setBulkEmails('');
    setRole('viewer');
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const emails = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && validateEmail(line));
      setBulkEmails(emails.join('\n'));
    };
    reader.readAsText(file);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Team Member"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={mode === 'single' ? handleSingleAdd : handleBulkAdd}
            isLoading={loading}
          >
            <Plus size={18} className="mr-2" />
            {mode === 'single' ? 'Add Member' : 'Send Invites'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode('single')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'single'
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Single Invite
          </button>
          <button
            onClick={() => setMode('bulk')}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
              mode === 'bulk'
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Bulk Invite
          </button>
        </div>

        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          options={roleOptions}
        />

        {mode === 'single' ? (
          <Input
            label="Email Address"
            type="email"
            placeholder="Enter email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            onKeyPress={(e) => e.key === 'Enter' && handleSingleAdd()}
          />
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Addresses (one per line)
              </label>
              <textarea
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com"
                rows={6}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <Upload size={18} className="text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Upload CSV</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Supports .csv and .txt files with one email per line
              </span>
            </div>

            {emailError && (
              <p className="text-sm text-red-600 dark:text-red-400">{emailError}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
