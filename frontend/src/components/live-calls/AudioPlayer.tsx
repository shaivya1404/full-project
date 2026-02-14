import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, RotateCcw } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../Input';
import { streamCallAudio } from '../../services/api';

interface AudioPlayerProps {
  callId: string;
  playing: boolean;
  muted: boolean;
  onPlay: () => void;
  onPause: () => void;
  onMute: () => void;
  volume?: number;
  onVolumeChange?: (volume: number) => void;
}

export const AudioPlayer = ({
  callId,
  playing,
  muted,
  onPlay,
  onPause,
  onMute,
  volume = 80,
  onVolumeChange
}: AudioPlayerProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'poor'>('good');
  const [latency, setLatency] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const streamUrlRef = useRef<string>('');

  useEffect(() => {
    const initializeAudio = async () => {
      setIsLoading(true);
      try {
        const streamUrl = await streamCallAudio(callId);
        streamUrlRef.current = streamUrl;
        setConnectionStatus('connecting');
        
        if (audioRef.current) {
          audioRef.current.src = streamUrl;
          audioRef.current.volume = volume / 100;
        }
      } catch (error) {
        console.error('Error initializing audio:', error);
        setConnectionStatus('disconnected');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAudio();

    // Simulate network quality updates
    const qualityInterval = setInterval(() => {
      // Simulate network quality changes
      const qualities: ('excellent' | 'good' | 'poor')[] = ['excellent', 'good', 'poor'];
      const randomQuality = qualities[Math.floor(Math.random() * qualities.length)];
      setNetworkQuality(randomQuality);
      
      // Simulate latency
      const randomLatency = Math.floor(Math.random() * 200) + 50;
      setLatency(randomLatency);
    }, 3000);

    return () => {
      clearInterval(qualityInterval);
      if (audioRef.current) {
        audioRef.current.src = '';
      }
    };
  }, [callId, volume]);

  const handlePlay = () => {
    if (audioRef.current && !isLoading) {
      if (playing) {
        audioRef.current.pause();
        onPause();
      } else {
        audioRef.current.play().then(() => {
          onPlay();
          setConnectionStatus('connected');
        }).catch((error) => {
          console.error('Error playing audio:', error);
          setConnectionStatus('disconnected');
        });
      }
    }
  };

  const handleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !muted;
      onMute();
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (audioRef.current && onVolumeChange) {
      audioRef.current.volume = newVolume / 100;
      onVolumeChange(newVolume);
    }
  };

  const handleSeek = (newTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleDownloadRecording = () => {
    // Implementation would depend on backend API
    console.log('Download recording for call:', callId);
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-500';
      case 'connecting': return 'text-yellow-500';
      case 'disconnected': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Audio Element */}
      <audio
        ref={audioRef}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => onPause()}
        onError={() => setConnectionStatus('disconnected')}
      />

      {/* Connection Status */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className={getConnectionStatusColor(connectionStatus)}>
            {connectionStatus === 'connected' ? 'Live Audio' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>

        <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Latency: {latency}ms</span>
          <span className={getQualityColor(networkQuality)}>
            {networkQuality}
          </span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePlay}
          disabled={isLoading || connectionStatus === 'disconnected'}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          ) : playing ? (
            <Pause size={16} />
          ) : (
            <Play size={16} />
          )}
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleMute}
          disabled={connectionStatus === 'disconnected'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </Button>

        <div className="flex-1">
          <Input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => handleSeek(Number(e.target.value))}
            className="w-full"
            disabled={connectionStatus === 'disconnected'}
          />
        </div>

        <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[60px]">
          {formatTime(currentTime)}
        </span>
      </div>

      {/* Volume Control */}
      <div className="flex items-center space-x-3">
        <VolumeX size={16} className="text-gray-400" />
        <Input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => handleVolumeChange(Number(e.target.value))}
          className="flex-1"
        />
        <Volume2 size={16} className="text-gray-400" />
      </div>

      {/* Additional Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">Speed:</span>
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700"
          >
            <option value={0.5}>0.5x</option>
            <option value={0.75}>0.75x</option>
            <option value={1}>1x</option>
            <option value={1.25}>1.25x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadRecording}
            disabled={connectionStatus === 'disconnected'}
          >
            <Download size={14} className="mr-1" />
            Download
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={14} className="mr-1" />
            Reconnect
          </Button>
        </div>
      </div>

      {/* Quality Indicator */}
      <div className="flex items-center justify-center space-x-2 pt-2 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs text-gray-500 dark:text-gray-400">Audio Quality:</span>
        <div className="flex space-x-1">
          {[1, 2, 3, 4, 5].map((bar) => (
            <div
              key={bar}
              className={`w-1 h-3 rounded-full ${
                bar <= (networkQuality === 'excellent' ? 5 : networkQuality === 'good' ? 3 : 1)
                  ? getQualityColor(networkQuality).replace('text-', 'bg-')
                  : 'bg-gray-200 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>
        <span className={`text-xs font-medium ${getQualityColor(networkQuality)}`}>
          {(networkQuality || 'unknown').charAt(0).toUpperCase() + (networkQuality || 'unknown').slice(1)}
        </span>
      </div>
    </div>
  );
};