import { Card } from '../Card';
import { Users, Calendar, Settings } from 'lucide-react';
import type { Team } from '../../types';

interface TeamOverviewCardProps {
  team: Team;
  onSettingsClick: () => void;
}

export const TeamOverviewCard = ({ team, onSettingsClick }: TeamOverviewCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {team.avatarUrl ? (
            <img
              src={team.avatarUrl}
              alt={team.name}
              className="w-16 h-16 rounded-lg object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">
                {team.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {team.name}
            </h2>
            {team.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {team.description}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onSettingsClick}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <Settings size={20} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="text-primary" size={18} />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Members
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {team.memberCount}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="text-primary" size={18} />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Created
            </span>
          </div>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatDate(team.createdAt)}
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="text-primary" size={18} />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Status
            </span>
          </div>
          <p className="text-lg font-semibold text-green-600 dark:text-green-400">
            Active
          </p>
        </div>
      </div>
    </Card>
  );
};
