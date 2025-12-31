import { useEffect, useState } from 'react';
import { Wifi, Signal, Activity, AlertTriangle } from 'lucide-react';
import type { CallQualityMetrics } from '../../types';
import { Card } from '../Card';
import { formatPercentage } from '../../utils/formatters';

interface CallQualityIndicatorProps {
  quality: CallQualityMetrics;
}

export const CallQualityIndicator = ({ quality }: CallQualityIndicatorProps) => {
  const [animatedQuality, setAnimatedQuality] = useState({
    audioQuality: 0,
    networkQuality: 0,
    latency: 0,
    packetLoss: 0,
    jitter: 0,
    bandwidth: 0
  });

  // Animate values when quality metrics change
  useEffect(() => {
    const animateValue = (start: number, end: number, duration: number, key: keyof typeof animatedQuality) => {
      const startTime = performance.now();
      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const current = start + (end - start) * progress;
        
        setAnimatedQuality(prev => ({
          ...prev,
          [key]: current
        }));
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      requestAnimationFrame(animate);
    };

    animateValue(animatedQuality.audioQuality, quality.audioQuality, 500, 'audioQuality');
    animateValue(animatedQuality.networkQuality, quality.networkQuality, 500, 'networkQuality');
    animateValue(animatedQuality.latency, quality.latency, 500, 'latency');
    animateValue(animatedQuality.packetLoss, quality.packetLoss, 500, 'packetLoss');
    animateValue(animatedQuality.jitter, quality.jitter, 500, 'jitter');
    animateValue(animatedQuality.bandwidth, quality.bandwidth, 500, 'bandwidth');
  }, [quality]);

  const getStatusColor = (status: CallQualityMetrics['status']) => {
    switch (status) {
      case 'excellent': return 'text-green-600 bg-green-50 border-green-200';
      case 'good': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'fair': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getQualityBarColor = (value: number, max: number = 100) => {
    const percentage = (value / max) * 100;
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    if (percentage >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 100) return 'text-green-600';
    if (latency < 200) return 'text-yellow-600';
    if (latency < 300) return 'text-orange-600';
    return 'text-red-600';
  };

  const getPacketLossColor = (packetLoss: number) => {
    if (packetLoss < 1) return 'text-green-600';
    if (packetLoss < 3) return 'text-yellow-600';
    if (packetLoss < 5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getJitterColor = (jitter: number) => {
    if (jitter < 20) return 'text-green-600';
    if (jitter < 50) return 'text-yellow-600';
    if (jitter < 100) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBandwidthColor = (bandwidth: number) => {
    if (bandwidth >= 1000) return 'text-green-600';
    if (bandwidth >= 500) return 'text-yellow-600';
    if (bandwidth >= 200) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatBandwidth = (bw: number) => {
    if (bw >= 1000) return `${(bw / 1000).toFixed(1)} Mbps`;
    return `${bw} kbps`;
  };

  return (
    <Card className="p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Signal className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Call Quality
        </h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(quality.status)}`}>
          {quality.status.charAt(0).toUpperCase() + quality.status.slice(1)}
        </div>
      </div>

      <div className="space-y-4">
        {/* Overall Quality Score */}
        <div className="text-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
            {Math.round((animatedQuality.audioQuality + animatedQuality.networkQuality) / 2)}%
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Overall Quality</div>
        </div>

        {/* Quality Breakdown */}
        <div className="space-y-3">
          {/* Audio Quality */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Audio</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {Math.round(animatedQuality.audioQuality)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getQualityBarColor(animatedQuality.audioQuality)}`}
                style={{ width: `${animatedQuality.audioQuality}%` }}
              />
            </div>
          </div>

          {/* Network Quality */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <Wifi className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Network</span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {Math.round(animatedQuality.networkQuality)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${getQualityBarColor(animatedQuality.networkQuality)}`}
                style={{ width: `${animatedQuality.networkQuality}%` }}
              />
            </div>
          </div>
        </div>

        {/* Network Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Latency</div>
            <div className={`text-sm font-semibold ${getLatencyColor(animatedQuality.latency)}`}>
              {Math.round(animatedQuality.latency)}ms
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Packet Loss</div>
            <div className={`text-sm font-semibold ${getPacketLossColor(animatedQuality.packetLoss)}`}>
              {animatedQuality.packetLoss.toFixed(1)}%
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Jitter</div>
            <div className={`text-sm font-semibold ${getJitterColor(animatedQuality.jitter)}`}>
              {Math.round(animatedQuality.jitter)}ms
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Bandwidth</div>
            <div className={`text-sm font-semibold ${getBandwidthColor(animatedQuality.bandwidth)}`}>
              {formatBandwidth(animatedQuality.bandwidth)}
            </div>
          </div>
        </div>

        {/* Quality Alerts */}
        {quality.status === 'poor' && (
          <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-300">
              Poor call quality detected. Consider intervention or transfer.
            </span>
          </div>
        )}

        {(quality.latency > 200 || quality.packetLoss > 3) && (
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              Network issues detected. Monitoring closely.
            </span>
          </div>
        )}
      </div>
    </Card>
  );
};