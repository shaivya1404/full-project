import { Link, useLocation } from 'react-router-dom';
import { Home, Settings, Users, BarChart3, Users as TeamUsers, User, ChevronDown, ChevronRight, BookOpen, Megaphone, PhoneCall, Headset } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  subItems?: { label: string; href: string }[];
};

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <Home size={20} /> },
  {
    label: 'Team',
    href: '/dashboard/team',
    icon: <TeamUsers size={20} />,
    subItems: [
      { label: 'Overview', href: '/dashboard/team' },
      { label: 'Members', href: '/dashboard/team/members' },
      { label: 'Settings', href: '/dashboard/team/settings' },
      { label: 'Audit Log', href: '/dashboard/team/audit' },
    ],
  },
  { label: 'Users', href: '/dashboard/users', icon: <Users size={20} /> },
  { label: 'Agents', href: '/dashboard/agents', icon: <Headset size={20} /> },
  { label: 'Campaigns', href: '/dashboard/campaigns', icon: <Megaphone size={20} /> },
  { label: 'Live Calls', href: '/dashboard/live-calls', icon: <PhoneCall size={20} /> },
  { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: <BookOpen size={20} /> },
  { label: 'Analytics', href: '/dashboard/analytics', icon: <BarChart3 size={20} /> },
  { label: 'Settings', href: '/dashboard/settings', icon: <Settings size={20} /> },
];

export const Sidebar = () => {
  const location = useLocation();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const isItemActive = (item: NavItem): boolean => {
    if (location.pathname === item.href) return true;
    if (item.subItems) {
      return item.subItems.some(sub => location.pathname === sub.href);
    }
    return false;
  };

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-screen overflow-y-auto">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      </div>

      <nav className="px-4 space-y-2">
        {navItems.map((item) => (
          <div key={item.href}>
            {item.subItems ? (
              <div>
                <button
                  onClick={() => setExpandedItem(expandedItem === item.href ? null : item.href)}
                  className={clsx(
                    'w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors',
                    isItemActive(item)
                      ? 'bg-primary text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <div className="flex items-center space-x-3">
                    {item.icon}
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {expandedItem === item.href ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>

                {expandedItem === item.href && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.subItems.map((subItem) => (
                      <Link
                        key={subItem.href}
                        to={subItem.href}
                        className={clsx(
                          'flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors text-sm',
                          location.pathname === subItem.href
                            ? 'bg-primary/20 text-primary font-medium'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        )}
                      >
                        <span>{subItem.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                to={item.href}
                className={clsx(
                  'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                  isItemActive(item)
                    ? 'bg-primary text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </Link>
            )}
          </div>
        ))}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <Link
          to="/dashboard/profile"
          className={clsx(
            'flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors',
            location.pathname === '/dashboard/profile'
              ? 'bg-primary text-white'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          <User size={20} />
          <span className="font-medium">Profile</span>
        </Link>
      </div>
    </aside>
  );
};
