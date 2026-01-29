import { useEffect, useState } from 'react';
import { Activity, Clock, MessageSquare, Wifi, Mic } from 'lucide-react';
import type { CallMetrics } from '../../types';
import { Card } from '../Card';
import { formatDuration } from '../../utils/formatters';

interface MetricsDisplayProps {
  metrics: CallMetrics;
}

export const MetricsDisplay = ({ metrics }: MetricsDisplayProps) => {
  const [animatedValues, setAnimatedValues] = useState({
    duration: 0,
    talkTime: 0,
    silenceTime: 0,
    interruptions: 0,
    averageLatency: 0,
    audioQuality: 0,
    networkQuality: 0,
    sentimentScore: 0
  });

  // Animate values when metrics change
  useEffect(() => {
    const animateValue = (start: number, end: number, duration: number, key: keyof typeof animatedValues) => {
      const startTime = performance.now();
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = start + (end - start) * progress;

        setAnimatedValues(prev => ({
          ...prev,
          [key]: current
        }));

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    };

    animateValue(animatedValues.duration, metrics.duration, 500, 'duration');
    animateValue(animatedValues.talkTime, metrics.talkTime, 500, 'talkTime');
    animateValue(animatedValues.silenceTime, metrics.silenceTime, 500, 'silenceTime');
    animateValue(animatedValues.interruptions, metrics.interruptions, 500, 'interruptions');
    animateValue(animatedValues.averageLatency, metrics.averageLatency, 500, 'averageLatency');
    animateValue(animatedValues.audioQuality, metrics.audioQuality, 500, 'audioQuality');
    animateValue(animatedValues.networkQuality, metrics.networkQuality, 500, 'networkQuality');
    animateValue(animatedValues.sentimentScore, metrics.sentimentScore, 500, 'sentimentScore');
  }, [metrics]);

  const getTalkRatio = () => {
    const total = animatedValues.talkTime + animatedValues.silenceTime;
    return total > 0 ? (animatedValues.talkTime / total) * 100 : 0;
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 80) return 'text-green-600 bg-green-50';
    if (quality >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-600';
    if (latency < 200) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSentimentColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <Card className="p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Activity className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Live Metrics
        </h3>
        <div className="flex-1 h-px bg-gradient-to-r from-blue-500 to-transparent"></div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Duration & Current Speaker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Duration</span>
            </div>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatDuration(animatedValues.duration)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sentiment Score</span>
            <span className={`text-sm font-semibold ${getSentimentColor(animatedValues.sentimentScore)}`}>
              {Math.round(animatedValues.sentimentScore)}%
            </span>
          </div>
        </div>

        {/* Talk vs Silence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Talk vs Silence</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {Math.round(getTalkRatio())}% talk
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${getTalkRatio()}%` }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Talk: {formatDuration(animatedValues.talkTime)}</span>
            <span>Silence: {formatDuration(animatedValues.silenceTime)}</span>
          </div>
        </div>

        {/* Interruptions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Interruptions</span>
          </div>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {Math.round(animatedValues.interruptions)}
          </span>
        </div>

        {/* Network Quality */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wifi className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Network</span>
            </div>
            <span className={`text-sm font-semibold ${getQualityColor(animatedValues.networkQuality)}`}>
              {Math.round(animatedValues.networkQuality)}%
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${animatedValues.networkQuality >= 80 ? 'bg-green-500' :
                  animatedValues.networkQuality >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              style={{ width: `${animatedValues.networkQuality}%` }}
            />
          </div>
        </div>

        {/* Audio Quality */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mic className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Audio Quality</span>
            </div>
            <span className={`text-sm font-semibold ${getQualityColor(animatedValues.audioQuality)}`}>
              {Math.round(animatedValues.audioQuality)}%
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${animatedValues.audioQuality >= 80 ? 'bg-green-500' :
                  animatedValues.audioQuality >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              style={{ width: `${animatedValues.audioQuality}%` }}
            />
          </div>
        </div>

        {/* Latency */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Latency</span>
          <span className={`text-sm font-semibold ${getLatencyColor(animatedValues.averageLatency)}`}>
            {Math.round(animatedValues.averageLatency)}ms
          </span>
        </div>
      </div>

      {/* Quality Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Overall Quality</span>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${(animatedValues.audioQuality + animatedValues.networkQuality) / 2 >= 80 ? 'bg-green-500' :
                (animatedValues.audioQuality + animatedValues.networkQuality) / 2 >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              } animate-pulse`}></div>
            <span className="font-medium text-gray-900 dark:text-white">
              {Math.round((animatedValues.audioQuality + animatedValues.networkQuality) / 2)}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};