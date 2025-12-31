import { DashboardLayout, Card, Button, Input } from '../components';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCurrentUser, updateProfile, changePassword, getApiKeys, createApiKey, deleteApiKey, getSessions, revokeSession, revokeAllOtherSessions } from '../services/api';
import { useState, useEffect } from 'react';
import type { UserProfile } from '../types';
import toast from 'react-hot-toast';
import { Save, Key, LogOut, Trash2, Copy, Plus, User, Shield, Globe, RefreshCw, Camera } from 'lucide-react';

export const UserProfilePage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'api-keys' | 'sessions'>('profile');
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [apiKeyName, setApiKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
  });

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name,
        email: user.email,
        phone: user.phone,
        bio: user.bio,
        timezone: user.timezone,
        language: user.language,
      });
    }
  }, [user]);

  const { data: apiKeys } = useQuery({
    queryKey: ['user-api-keys'],
    queryFn: getApiKeys,
  });

  const { data: sessions } = useQuery({
    queryKey: ['user-sessions'],
    queryFn: getSessions,
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-user'] });
      toast.success('Profile updated successfully');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: () => {
      toast.error('Failed to change password');
    },
  });

  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      await updateProfileMutation.mutateAsync(profile);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsChangingPassword(true);
    try {
      await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleCreateApiKey = async () => {
    if (!apiKeyName.trim()) {
      toast.error('Please enter a name for the API key');
      return;
    }
    setIsCreatingKey(true);
    try {
      await createApiKey(apiKeyName, ['read', 'write']);
      queryClient.invalidateQueries({ queryKey: ['user-api-keys'] });
      toast.success('API key created successfully');
      setApiKeyName('');
    } catch {
      toast.error('Failed to create API key');
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    try {
      await deleteApiKey(keyId);
      queryClient.invalidateQueries({ queryKey: ['user-api-keys'] });
      toast.success('API key deleted');
    } catch {
      toast.error('Failed to delete API key');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await revokeSession(sessionId);
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      toast.success('Session revoked');
    } catch {
      toast.error('Failed to revoke session');
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    try {
      await revokeAllOtherSessions();
      queryClient.invalidateQueries({ queryKey: ['user-sessions'] });
      toast.success('All other sessions revoked');
    } catch {
      toast.error('Failed to revoke sessions');
    }
  };

  const copyToClipboard = (key: string, keyId: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(keyId);
    toast.success('API key copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('File size must be less than 2MB');
      return;
    }

    try {
      const { uploadAvatar } = await import('../services/api');
      const { avatarUrl } = await uploadAvatar(file);
      setProfile({ ...profile, avatarUrl });
      toast.success('Avatar uploaded successfully');
    } catch {
      toast.error('Failed to upload avatar');
    }
  };

  if (userLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </DashboardLayout>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'password', label: 'Security', icon: Shield },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'sessions', label: 'Sessions', icon: Globe },
  ] as const;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            User Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'profile' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Personal Information
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt="Profile Avatar"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
                      <span className="text-3xl font-bold text-white">
                        {profile.name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  )}
                  <label className="absolute bottom-0 right-0 p-1 bg-white dark:bg-gray-800 rounded-full shadow-md cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                    <Camera size={16} className="text-gray-600 dark:text-gray-400" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Upload a profile picture. Recommended size: 200x200px, max 2MB.
                  </p>
                </div>
              </div>

              <Input
                label="Full Name"
                value={profile.name || ''}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Enter your full name"
              />

              <Input
                label="Email"
                type="email"
                value={profile.email || ''}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                placeholder="Enter your email"
              />

              <Input
                label="Phone"
                type="tel"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="Enter your phone number"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bio
                </label>
                <textarea
                  value={profile.bio || ''}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                  placeholder="Tell us about yourself"
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Timezone"
                  value={profile.timezone || ''}
                  onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                  placeholder="e.g., UTC-5"
                />
                <Input
                  label="Language"
                  value={profile.language || ''}
                  onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                  placeholder="e.g., en-US"
                />
              </div>

              <div className="pt-4">
                <Button onClick={handleSaveProfile} isLoading={isSavingProfile}>
                  <Save size={18} className="mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'password' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Change Password
            </h2>
            <div className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
              <div className="pt-4">
                <Button onClick={handleChangePassword} isLoading={isChangingPassword}>
                  <Save size={18} className="mr-2" />
                  Change Password
                </Button>
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'api-keys' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Key size={20} />
              API Keys
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Generate API keys for accessing your personal data. Keep these keys secure and never share them publicly.
            </p>

            <div className="flex gap-3 mb-6">
              <Input
                placeholder="API key name"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleCreateApiKey} isLoading={isCreatingKey}>
                <Plus size={18} className="mr-2" />
                Create Key
              </Button>
            </div>

            <div className="space-y-3">
              {apiKeys?.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{key.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                        {key.key.slice(0, 8)}...{key.key.slice(-4)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(key.key, key.id)}
                        className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        {copiedKey === key.id ? (
                          <span className="text-xs text-green-600">Copied!</span>
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Created {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsed && ` • Last used ${new Date(key.lastUsed).toLocaleDateString()}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteApiKey(key.id)}
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </div>
              ))}

              {(!apiKeys || apiKeys.length === 0) && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No API keys created yet
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'sessions' && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Globe size={20} />
              Active Sessions
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Manage your active sessions across different devices.
            </p>

            <Button
              variant="secondary"
              onClick={handleRevokeAllOtherSessions}
              className="mb-6"
            >
              <RefreshCw size={18} className="mr-2" />
              Sign Out All Other Devices
            </Button>

            <div className="space-y-3">
              {sessions?.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    session.current
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <Globe size={20} className="text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {session.device}
                        {session.current && (
                          <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {session.browser} on {session.os}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {session.ipAddress} • Last active {new Date(session.lastActive).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!session.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      <LogOut size={16} className="text-red-500" />
                    </Button>
                  )}
                </div>
              ))}

              {(!sessions || sessions.length === 0) && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No active sessions
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};
