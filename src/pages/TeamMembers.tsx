import { DashboardLayout } from '../components';
import { MembersTable } from '../components/team/MembersTable';
import { AddMemberModal } from '../components/team/AddMemberModal';
import { EditMemberModal } from '../components/team/EditMemberModal';
import { RemoveMemberDialog } from '../components/team/RemoveMemberDialog';
import { useQuery } from '@tanstack/react-query';
import { getTeamMembers } from '../services/api';
import { useState } from 'react';
import type { TeamMember, Role } from '../types';
import toast from 'react-hot-toast';
import { Button } from '../components/Button';
import { Plus, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeamMembersPage = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => getTeamMembers(1, 100),
  });

  const handleAddMember = async (email: string, role: Role) => {
    setIsAddingMember(true);
    try {
      const { addMember } = await import('../services/api');
      await addMember(email, role);
      toast.success('Member invited successfully');
      setIsAddModalOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error('Failed to invite member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleBulkInvite = async (emails: string[], role: Role) => {
    setIsAddingMember(true);
    try {
      const { bulkInviteMembers } = await import('../services/api');
      const result = await bulkInviteMembers(emails, role);
      if (result.failed.length > 0) {
        toast.error(`${result.failed.length} invitations failed`);
      } else {
        toast.success(`${result.invited.length} invitations sent`);
      }
      setIsAddModalOpen(false);
      window.location.reload();
    } catch (error) {
      toast.error('Failed to send invitations');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleUpdateRole = async (memberId: string, role: Role) => {
    setIsUpdatingMember(true);
    try {
      const { updateMemberRole } = await import('../services/api');
      await updateMemberRole(memberId, role);
      toast.success('Role updated successfully');
      window.location.reload();
    } catch (error) {
      toast.error('Failed to update role');
    } finally {
      setIsUpdatingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setIsRemovingMember(true);
    try {
      const { removeMember } = await import('../services/api');
      await removeMember(memberId);
      toast.success('Member removed successfully');
      window.location.reload();
    } catch (error) {
      toast.error('Failed to remove member');
    } finally {
      setIsRemovingMember(false);
    }
  };

  const handleResendInvite = async (member: TeamMember) => {
    try {
      const { resendInvite } = await import('../services/api');
      await resendInvite(member.email);
      toast.success('Invitation resent successfully');
    } catch (error) {
      toast.error('Failed to resend invitation');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard/team">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={18} className="mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Team Members
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage team members, roles, and permissions
              </p>
            </div>
          </div>
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} className="mr-2" />
            Add Member
          </Button>
        </div>

        <MembersTable
          members={membersData?.data || []}
          loading={membersLoading}
          onEdit={(member) => {
            setSelectedMember(member);
            setIsEditModalOpen(true);
          }}
          onRemove={(member) => {
            setSelectedMember(member);
            setIsRemoveDialogOpen(true);
          }}
          onResendInvite={handleResendInvite}
        />
      </div>

      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddMember={handleAddMember}
        onBulkInvite={handleBulkInvite}
        loading={isAddingMember}
      />

      <EditMemberModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        member={selectedMember}
        onUpdateRole={handleUpdateRole}
        loading={isUpdatingMember}
      />

      <RemoveMemberDialog
        isOpen={isRemoveDialogOpen}
        onClose={() => setIsRemoveDialogOpen(false)}
        member={selectedMember}
        onRemove={handleRemoveMember}
        loading={isRemovingMember}
      />
    </DashboardLayout>
  );
};
