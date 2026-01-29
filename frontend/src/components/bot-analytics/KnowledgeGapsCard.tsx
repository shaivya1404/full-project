import React from 'react';
import type { KnowledgeGap } from '../../types';
import { Card } from '../Card';
import { Lightbulb, ArrowRight, TrendingUp } from 'lucide-react';

interface KnowledgeGapsCardProps {
  gaps: KnowledgeGap[];
  isLoading: boolean;
}

export const KnowledgeGapsCard: React.FC<KnowledgeGapsCardProps> = ({
  gaps,
  isLoading,
}) => {
  if (isLoading) {
    return <Card className="animate-pulse h-96" />;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
      case 'medium': return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'low': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Knowledge Base Gaps</h3>
        </div>
        <button className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1">
          View all <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        {gaps.map((gap) => (
          <div 
            key={gap.id} 
            className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 hover:border-blue-200 dark:hover:border-blue-900 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">{gap.topic}</h4>
              <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${getPriorityColor(gap.priority)}`}>
                {gap.priority} Priority
              </span>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{gap.recommendation}</p>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Asked {gap.frequency} times</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Impact Score: {gap.impactScore}/100</span>
              </div>
            </div>
          </div>
        ))}

        {gaps.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-500 dark:text-gray-400">No knowledge gaps identified</p>
          </div>
        )}
      </div>
    </Card>
  );
};
