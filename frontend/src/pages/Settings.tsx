import { DashboardLayout, Card, Button } from '../components';
import { Settings as SettingsIcon } from 'lucide-react';

export const SettingsPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure your account and application preferences
          </p>
        </div>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
              <SettingsIcon size={20} />
              <span>General Settings</span>
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Enable dark theme</p>
                </div>
                <input type="checkbox" className="w-4 h-4 rounded" />
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Notifications</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Enable notifications</p>
                </div>
                <input type="checkbox" className="w-4 h-4 rounded" defaultChecked />
              </div>
              <div className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Email Alerts</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Receive email alerts</p>
                </div>
                <input type="checkbox" className="w-4 h-4 rounded" defaultChecked />
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Account
            </h3>
            <div className="space-y-4">
              <Button variant="secondary">Change Password</Button>
              <Button variant="secondary">Enable Two-Factor Authentication</Button>
              <Button variant="danger">Delete Account</Button>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};
