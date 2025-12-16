import React from 'react';
import { Card } from '../Card';
import { CallStats } from '../../types';
import { Phone, Clock, Smile, Activity } from 'lucide-react';
import clsx from 'clsx';

interface AnalyticsCardsProps {
  stats?: CallStats;
  isLoading: boolean;
}

const StatCard = ({ icon: Icon, label, value, color }: any) => {
  const colorStyles = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <Card className="flex items-center p-6">
      <div className={clsx("p-3 rounded-xl mr-4", colorStyles[color as keyof typeof colorStyles])}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
    </Card>
  );
};

export const AnalyticsCards: React.FC<AnalyticsCardsProps> = ({ stats, isLoading }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
         {[1,2,3,4].map(i => (
           <Card key={i} className="h-32 animate-pulse bg-gray-100 dark:bg-gray-800" />
         ))}
      </div>
    );
  }
  
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard 
        label="Total Calls" 
        value={stats.totalCalls.toLocaleString()} 
        icon={Phone} 
        color="blue"
      />
      <StatCard 
        label="Avg Duration" 
        value={`${Math.floor(stats.avgDuration / 60)}m ${stats.avgDuration % 60}s`} 
        icon={Clock} 
        color="orange"
      />
      <StatCard 
        label="Sentiment Score" 
        value={`${stats.sentimentScore}/100`} 
        icon={Smile} 
        color="green"
      />
      <StatCard 
        label="Active Calls" 
        value={stats.activeCalls} 
        icon={Activity} 
        color="purple"
      />
    </div>
  );
};
