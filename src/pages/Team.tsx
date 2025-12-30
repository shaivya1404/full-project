import { DashboardLayout, Card } from '../components';
import { TeamOverviewCard } from '../components/team/TeamOverviewCard';
import { useQuery } from '@tanstack/react-query';
import { getTeam } from '../services/api';
import { useState } from 'react';
import { AddMemberModal } from '../components/team/AddMemberModal';
import { EditMemberModal } from '../components/team/EditMemberModal';
import { RemoveMemberDialog } from '../components/team/RemoveMemberDialog';
import { InvitationManager } from '../components/team/InvitationManager';
import { getInvitations } from '../services/api';
import type { TeamMember, Role } from '../types';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { Button } from '../components/Button';

export const TeamPage = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [selectedMember] = useState<TeamMember | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  const { data: team } = useQuery({
    queryKey: ['team'],
    queryFn: getTeam,
  });

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => getTeamMembers(1, 100),
  });

  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => getInvitations(1, 50),
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

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const { revokeInvite } = await import('../services/api');
      await revokeInvite(inviteId);
      toast.success('Invitation revoked');
      window.location.reload();
    } catch (error) {
      toast.error('Failed to revoke invitation');
    }
  };

  const handleResendInviteFromList = async (inviteId: string) => {
    try {
      const { resendInvite } = await import('../services/api');
      const invitation = invitationsData?.data.find(inv => inv.id === inviteId);
      if (invitation) {
        await resendInvite(invitation.email);
        toast.success('Invitation resent successfully');
      }
    } catch (error) {
      toast.error('Failed to resend invitation');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Team Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your team members, roles, and permissions
          </p>
        </div>

        {team && (
          <TeamOverviewCard
            team={team}
            onSettingsClick={() => window.location.href = '/dashboard/team/settings'}
          />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Team Members
              </h2>
              <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
                <Plus size={18} className="mr-2" />
                Add Member
              </Button>
            </div>
            <div className="space-y-3">
              {membersData?.data.slice(0, 5).map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
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
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {member.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {member.email}
                    </p>
                  </div>
                </div>
              ))}
              {membersLoading && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                  Loading members...
                </div>
              )}
            </div>
            <button
              onClick={() => window.location.href = '/dashboard/team/members'}
              className="mt-4 w-full text-center text-sm text-primary hover:text-primary/80 font-medium"
            >
              View All Members →
            </button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pending Invitations
              </h2>
            </div>
            <InvitationManager
              invitations={invitationsData?.data || []}
              loading={invitationsLoading}
              onResendInvite={handleResendInviteFromList}
              onRevokeInvite={handleRevokeInvite}
            />
          </Card>
        </div>
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
