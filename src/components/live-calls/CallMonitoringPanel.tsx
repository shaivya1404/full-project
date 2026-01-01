import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  User,
  Clock,
  Activity,
  Pause,
  Play,
  Square,
  MessageSquare,
  Users,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import type { LiveCall, TranscriptLine, CallMetrics, CallQualityMetrics } from '../../types';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Card } from '../Card';
import {
  getLiveCallDetails,
  getCallMetrics,
  getCallTranscript,
  getCallQuality,
  endCall,
  joinCall,
  whisperToAgent,
  pauseRecording,
  resumeRecording
} from '../../services/api';
import { formatDuration } from '../../utils/formatters';
import { TranscriptViewer } from './TranscriptViewer';
import { AudioPlayer } from './AudioPlayer';
import { MetricsDisplay } from './MetricsDisplay';
import { CallQualityIndicator } from './CallQualityIndicator';
import { SentimentIndicator } from './SentimentIndicator';
import { InterventionPanel } from './InterventionPanel';
import { CallTransferDialog } from './CallTransferDialog';
import { CallHistoryPanel } from './CallHistoryPanel';

export const CallMonitoringPanel = () => {
  const { callId } = useParams<{ callId: string }>();
  const [call, setCall] = useState<LiveCall | null>(null);
  const [metrics, setMetrics] = useState<CallMetrics | null>(null);
  const [quality, setQuality] = useState<CallQualityMetrics | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showInterventionPanel, setShowInterventionPanel] = useState(false);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!callId) return;

    const fetchCallData = async () => {
      try {
        const [callData, metricsData, qualityData, transcriptData] = await Promise.all([
          getLiveCallDetails(callId),
          getCallMetrics(callId),
          getCallQuality(callId),
          getCallTranscript(callId)
        ]);

        setCall(callData);
        setMetrics(metricsData);
        setQuality(qualityData);
        setTranscript(transcriptData);
        setIsRecording(callData.isRecording || false);
        setError(null);
      } catch (err) {
        setError('Failed to fetch call details');
        console.error('Error fetching call data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchCallData();

    // Set up real-time updates every 2 seconds
    intervalRef.current = setInterval(fetchCallData, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [callId]);

  const handleEndCall = async () => {
    if (!callId || !window.confirm('Are you sure you want to end this call?')) return;

    try {
      await endCall(callId);
      // Navigate back to live calls list
      window.location.href = '/dashboard/live-calls';
    } catch (error) {
      console.error('Error ending call:', error);
      alert('Failed to end call');
    }
  };

  const handleJoinCall = async () => {
    if (!callId) return;

    try {
      const response = await joinCall(callId);
      // Open join URL in new tab
      window.open(response.joinUrl, '_blank');
    } catch (error) {
      console.error('Error joining call:', error);
      alert('Failed to join call');
    }
  };

  const handleWhisperToAgent = async (message: string) => {
    if (!callId) return;

    try {
      await whisperToAgent(callId, message);
      alert('Message sent to agent');
    } catch (error) {
      console.error('Error sending whisper:', error);
      alert('Failed to send message');
    }
  };

  const handleToggleRecording = async () => {
    if (!callId) return;

    try {
      if (isRecording) {
        await pauseRecording(callId);
      } else {
        await resumeRecording(callId);
      }
      setIsRecording(!isRecording);
    } catch (error) {
      console.error('Error toggling recording:', error);
      alert('Failed to toggle recording');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'on-hold': return 'text-yellow-600 bg-yellow-50';
      case 'transferring': return 'text-blue-600 bg-blue-50';
      case 'recording': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCurrentSpeaker = () => {
    if (transcript.length === 0) return null;
    const latest = transcript[transcript.length - 1];
    return latest.speaker;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          {error || 'Call not found'}
        </h3>
        <div className="mt-6">
          <Link to="/dashboard/live-calls">
            <Button>
              <ArrowLeft size={16} className="mr-2" />
              Back to Live Calls
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link to="/dashboard/live-calls">
            <Button variant="outline" size="sm">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Call Monitoring
            </h1>
            <div className="flex items-center space-x-4 mt-1">
              <span className="text-gray-600 dark:text-gray-400">
                Call ID: {call.callId.slice(-8)}
              </span>
              <Badge className={getStatusColor(call.status)}>
                {call.status.replace('-', ' ')}
              </Badge>
              {isRecording && (
                <Badge variant="destructive">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></div>
                  Recording
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RotateCcw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Call Overview */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Caller Info */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Phone className="h-8 w-8 text-blue-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {call.callerName}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {call.callerPhone}
              </div>
            </div>
          </div>

          {/* Agent Info */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <User className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {call.agentName || 'Unassigned'}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Agent
              </div>
            </div>
          </div>

          {/* Duration */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-purple-500" />
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatDuration(call.duration)}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Duration
              </div>
            </div>
          </div>

          {/* Current Speaker */}
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Activity className="h-8 w-8 text-orange-500" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {getCurrentSpeaker() ? getCurrentSpeaker()?.replace('_', ' ')?.toUpperCase() : 'Unknown'}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Current Speaker
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Controls & Metrics */}
        <div className="space-y-6">
          {/* Audio Controls */}
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Audio Controls
            </h3>
            
            <AudioPlayer 
              callId={callId!}
              playing={audioPlaying}
              muted={muted}
              onPlay={() => setAudioPlaying(true)}
              onPause={() => setAudioPlaying(false)}
              onMute={() => setMuted(!muted)}
            />

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                size="sm"
                onClick={handleJoinCall}
              >
                <Users size={16} className="mr-2" />
                Join Call
              </Button>

              <Button
                variant={isRecording ? "destructive" : "outline"}
                size="sm"
                onClick={handleToggleRecording}
              >
                {isRecording ? <Pause size={16} className="mr-2" /> : <Play size={16} className="mr-2" />}
                {isRecording ? 'Pause Recording' : 'Resume Recording'}
              </Button>
            </div>
          </Card>

          {/* Call Metrics */}
          {metrics && (
            <MetricsDisplay metrics={metrics} />
          )}

          {/* Call Quality */}
          {quality && (
            <CallQualityIndicator quality={quality} />
          )}

          {/* Sentiment */}
          {call.sentiment && (
            <SentimentIndicator 
              sentiment={call.sentiment} 
              score={call.sentimentScore || 0} 
            />
          )}
        </div>

        {/* Middle Column - Transcript */}
        <div className="lg:col-span-2">
          <Card className="h-96">
            <TranscriptViewer 
              transcript={transcript}
              callId={callId!}
            />
          </Card>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-center space-x-4 pt-6 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="outline"
          onClick={() => setShowInterventionPanel(true)}
        >
          <MessageSquare size={16} className="mr-2" />
          Intervention
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowTransferDialog(true)}
        >
          <Users size={16} className="mr-2" />
          Transfer Call
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowCallHistory(!showCallHistory)}
        >
          <Clock size={16} className="mr-2" />
          Call History
        </Button>

        <Button
          variant="destructive"
          onClick={handleEndCall}
        >
          <Square size={16} className="mr-2" />
          End Call
        </Button>
      </div>

      {/* Call History Panel */}
      {showCallHistory && (
        <CallHistoryPanel 
          customerId={call.callerId}
          onClose={() => setShowCallHistory(false)}
        />
      )}

      {/* Transfer Dialog */}
      {showTransferDialog && (
        <CallTransferDialog
          callId={callId!}
          onClose={() => setShowTransferDialog(false)}
        />
      )}

      {/* Intervention Panel */}
      {showInterventionPanel && (
        <InterventionPanel
          callId={callId!}
          agentId={call.agentId}
          onClose={() => setShowInterventionPanel(false)}
          onWhisper={handleWhisperToAgent}
        />
      )}
    </div>
  );
};