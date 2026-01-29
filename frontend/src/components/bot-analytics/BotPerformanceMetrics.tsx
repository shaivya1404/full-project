import React from 'react';
import type { BotPerformanceMetrics as MetricsType } from '../../types';
import { Card } from '../Card';
import { 
  CheckCircle, 
  Target, 
  Users, 
  BookOpen, 
  ThumbsUp, 
  AlertTriangle 
} from 'lucide-react';

interface BotPerformanceMetricsProps {
  metrics?: MetricsType;
  isLoading: boolean;
}

export const BotPerformanceMetrics: React.FC<BotPerformanceMetricsProps> = ({
  metrics,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="animate-pulse h-32" />
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  const cards = [
    {
      label: 'Answering Rate',
      value: `${(metrics.questionAnsweringRate * 100).toFixed(1)}%`,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      description: 'Percentage of questions handled by AI'
    },
    {
      label: 'Avg Confidence',
      value: '78%', // Mocked for now as it's not directly in metrics but should be
      icon: Target,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      description: 'Average AI confidence score'
    },
    {
      label: 'Human Transfers',
      value: metrics.humanTransfers.toString(),
      icon: Users,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      description: 'Calls escalated to human agents'
    },
    {
      label: 'KB Usage',
      value: `${(metrics.knowledgeBaseUsage * 100).toFixed(1)}%`,
      icon: BookOpen,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      description: 'Knowledge base hit rate'
    },
    {
      label: 'Response Quality',
      value: `${(metrics.responseQuality * 100).toFixed(1)}/100`,
      icon: ThumbsUp,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
      description: 'Based on customer feedback/sentiment'
    },
    {
      label: 'Failure Scenarios',
      value: '12', // Mocked
      icon: AlertTriangle,
      color: 'text-red-500',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      description: 'Common bot failure patterns'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <Card key={i} className="flex items-start gap-4 p-5 hover:shadow-md transition-shadow">
          <div className={`p-3 rounded-lg ${card.bgColor}`}>
            <card.icon className={`w-6 h-6 ${card.color}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{card.label}</p>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{card.description}</p>
          </div>
        </Card>
      ))}
    </div>
  );
};
