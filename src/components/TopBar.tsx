import { useAuthStore } from '../store/authStore';
import { useLogout } from '../api/hooks';
import { Bell, LogOut, User } from 'lucide-react';
import { useState } from 'react';

export const TopBar = () => {
  const { user } = useAuthStore();
  const { mutate: performLogout } = useLogout();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = () => {
    performLogout();
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-gray-900 dark:text-white font-semibold">Welcome back!</h2>
        </div>

        <div className="flex items-center space-x-4">
          {/* Notification Bell - Placeholder for real-time indicators */}
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors relative">
            <Bell size={20} className="text-gray-600 dark:text-gray-400" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center space-x-2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white">
                <User size={16} />
              </div>
              <span className="text-gray-900 dark:text-white font-medium text-sm hidden sm:block">
                {user?.username}
              </span>
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.username}</p>
                  {user?.email && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">{user.email}</p>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center space-x-2"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
