import React from 'react';
import type { BotImprovementInsight } from '../../types';
import { Card } from '../Card';
import { Sparkles, MessageSquare, AlertCircle, TrendingDown } from 'lucide-react';

interface BotImprovementRecommendationsProps {
  insights: BotImprovementInsight[];
  isLoading: boolean;
}

export const BotImprovementRecommendations: React.FC<BotImprovementRecommendationsProps> = ({
  insights,
  isLoading,
}) => {
  if (isLoading) {
    return <Card className="animate-pulse h-96" />;
  }

  return (
    <Card className="h-full">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-purple-500" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bot Improvement Insights</h3>
      </div>

      <div className="space-y-6">
        {insights.map((insight) => (
          <div key={insight.id} className="relative pl-6 border-l-2 border-purple-100 dark:border-purple-900/30">
            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
            </div>
            
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{insight.scenario}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">{insight.suggestion}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <div>
                  <p className="text-[10px] text-red-600 dark:text-red-400 font-medium uppercase">Frustration</p>
                  <p className="text-sm font-bold text-red-700 dark:text-red-300">{(insight.frustrationLevel * 100).toFixed(0)}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20">
                <TrendingDown className="w-4 h-4 text-orange-500" />
                <div>
                  <p className="text-[10px] text-orange-600 dark:text-orange-400 font-medium uppercase">Escalation</p>
                  <p className="text-sm font-bold text-orange-700 dark:text-orange-300">{(insight.escalationRate * 100).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {insights.length === 0 && (
          <div className="py-12 text-center text-gray-500 dark:text-gray-400">
            No specific improvement insights available for this period.
          </div>
        )}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-100 dark:border-purple-800/30">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <p className="text-sm font-bold text-purple-900 dark:text-purple-100">Pro-tip for Prompting</p>
        </div>
        <p className="text-xs text-purple-700 dark:text-purple-300 leading-relaxed">
          Try adding specific context about your pricing tiers to the system prompt to reduce escalations regarding subscription details.
        </p>
      </div>
    </Card>
  );
};
