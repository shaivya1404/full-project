import { DashboardLayout, Card } from '../components';
import { Users as UsersIcon } from 'lucide-react';

export const UsersPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Users
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and view all users in the system
          </p>
        </div>

        <Card className="flex flex-col items-center justify-center py-16">
          <UsersIcon size={48} className="text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Users Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center">
            This page is ready for user management features.
            <br />
            Connect the useFetchUsers hook to display real data.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  );
};
