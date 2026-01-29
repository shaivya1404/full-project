import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Smile, Frown, Meh } from 'lucide-react';
import type { Sentiment } from '../../types';
import { Card } from '../Card';

interface SentimentIndicatorProps {
  sentiment: Sentiment;
  score: number;
  trend?: 'up' | 'down' | 'stable';
}

export const SentimentIndicator = ({ sentiment, score, trend = 'stable' }: SentimentIndicatorProps) => {
  const [animatedScore, setAnimatedScore] = useState(0);

  // Animate score when it changes
  useEffect(() => {
    const animateValue = (start: number, end: number, duration: number) => {
      const startTime = performance.now();
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = start + (end - start) * progress;
        
        setAnimatedScore(current);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    };

    animateValue(animatedScore, score, 500);
  }, [score]);

  const getSentimentConfig = (sentiment: Sentiment) => {
    switch (sentiment) {
      case 'positive':
        return {
          color: 'text-green-600 bg-green-50 border-green-200',
          icon: Smile,
          label: 'Positive',
          bgColor: 'bg-green-500'
        };
      case 'negative':
        return {
          color: 'text-red-600 bg-red-50 border-red-200',
          icon: Frown,
          label: 'Negative',
          bgColor: 'bg-red-500'
        };
      default:
        return {
          color: 'text-gray-600 bg-gray-50 border-gray-200',
          icon: Meh,
          label: 'Neutral',
          bgColor: 'bg-gray-500'
        };
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getTrendColor = () => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const config = getSentimentConfig(sentiment);
  const Icon = config.icon;

  return (
    <Card className="p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Icon className={`h-5 w-5 ${config.color.split(' ')[0]}`} />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Sentiment Analysis
        </h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${config.color}`}>
          {config.label}
        </div>
      </div>

      <div className="space-y-4">
        {/* Current Score */}
        <div className="text-center">
          <div className={`text-3xl font-bold mb-1 ${getScoreColor(animatedScore)}`}>
            {Math.round(animatedScore)}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Sentiment Score
          </div>
        </div>

        {/* Score Gauge */}
        <div className="relative">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
              className={`h-4 rounded-full transition-all duration-500 ${config.bgColor}`}
              style={{ width: `${animatedScore}%` }}
            />
          </div>
          
          {/* Score markers */}
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Negative</span>
            <span>Neutral</span>
            <span>Positive</span>
          </div>
        </div>

        {/* Trend */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Trend
          </span>
          <div className="flex items-center space-x-2">
            {getTrendIcon()}
            <span className={`text-sm font-medium capitalize ${getTrendColor()}`}>
              {trend}
            </span>
          </div>
        </div>

        {/* Insights */}
        <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Insights
          </div>
          
          {sentiment === 'positive' && (
            <div className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 p-2 rounded">
              Customer seems satisfied with the conversation. Continue current approach.
            </div>
          )}
          
          {sentiment === 'negative' && (
            <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              Customer sentiment is declining. Consider intervention or de-escalation techniques.
            </div>
          )}
          
          {sentiment === 'neutral' && (
            <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/20 p-2 rounded">
              Customer sentiment is neutral. Monitor for changes and engage positively.
            </div>
          )}

          {/* Satisfaction Likelihood */}
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            <div className="flex items-center justify-between mb-1">
              <span>Customer Satisfaction Likelihood</span>
              <span className={getScoreColor(animatedScore)}>
                {Math.round(animatedScore)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all duration-500 ${config.bgColor}`}
                style={{ width: `${animatedScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};