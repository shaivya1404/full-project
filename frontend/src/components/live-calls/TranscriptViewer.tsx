import { useState, useEffect, useRef } from 'react';
import { Search, Copy, Download, ChevronDown, ChevronUp, User, Bot, Clock } from 'lucide-react';
import type { TranscriptLine } from '../../types';
import { Button } from '../Button';
import { Input } from '../Input';
import { formatDuration } from '../../utils/formatters';

interface TranscriptViewerProps {
  transcript: TranscriptLine[];
  callId: string;
  autoScroll?: boolean;
}

export const TranscriptViewer = ({
  transcript,
  callId,
  autoScroll = true
}: TranscriptViewerProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(autoScroll);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcript lines are added
  useEffect(() => {
    if (autoScrollEnabled && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, autoScrollEnabled]);

  // Handle manual scroll
  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;

    setAutoScrollEnabled(isNearBottom);
  };

  const getSpeakerIcon = (speaker: TranscriptLine['speaker']) => {
    switch (speaker) {
      case 'customer':
        return <User className="h-4 w-4" />;
      case 'agent':
        return <User className="h-4 w-4" />;
      case 'ai':
        return <Bot className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getSpeakerColor = (speaker: TranscriptLine['speaker']) => {
    switch (speaker) {
      case 'customer':
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'agent':
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700';
      case 'ai':
        return 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700';
      default:
        return 'bg-gray-50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  const getSentimentColor = (sentiment?: TranscriptLine['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const handleCopyTranscript = async () => {
    const transcriptText = transcript
      .map(line => `[${formatDuration(line.timestamp)}] ${line.speaker.toUpperCase()}: ${line.text}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(transcriptText);
      // Could show a toast notification here
    } catch (error) {
      console.error('Failed to copy transcript:', error);
    }
  };

  const handleDownloadTranscript = () => {
    const transcriptText = transcript
      .map(line => `[${formatDuration(line.timestamp)}] ${line.speaker.toUpperCase()}: ${line.text}`)
      .join('\n');

    const blob = new Blob([transcriptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcript-${callId.slice(-8)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredTranscript = transcript.filter(line =>
    line.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    line.speaker.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const highlightSearchTerm = (text: string, term: string) => {
    if (!term) return text;

    const regex = new RegExp(`(${term})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Live Transcript
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {transcript.length} message{transcript.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAutoScrollEnabled(!autoScrollEnabled)}
          >
            {autoScrollEnabled ? (
              <ChevronDown size={16} className="mr-1" />
            ) : (
              <ChevronUp size={16} className="mr-1" />
            )}
            Auto-scroll
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyTranscript}
          >
            <Copy size={16} className="mr-1" />
            Copy
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownloadTranscript}
          >
            <Download size={16} className="mr-1" />
            Download
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder="Search transcript..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Transcript Container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        onScroll={handleScroll}
      >
        {filteredTranscript.length === 0 ? (
          <div className="text-center py-8">
            <Bot className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No messages match your search.' : 'No transcript available yet.'}
            </p>
          </div>
        ) : (
          filteredTranscript.map((line, index) => (
            <div
              key={line.id || index}
              className={`p-3 rounded-lg border ${getSpeakerColor(line.speaker)} transition-all duration-200 hover:shadow-sm`}
            >
              {/* Message Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {getSpeakerIcon(line.speaker)}
                    <span className="font-medium text-sm capitalize">
                      {line.speaker}
                    </span>
                  </div>

                  {line.confidence && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {Math.round(line.confidence * 100)}% confidence
                    </span>
                  )}

                  {line.sentiment && (
                    <span className={`text-xs ${getSentimentColor(line.sentiment)}`}>
                      {line.sentiment}
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                  <Clock size={12} />
                  <span>{formatDuration(line.timestamp)}</span>
                </div>
              </div>

              {/* Message Content */}
              <div className="text-sm leading-relaxed">
                {searchTerm ? (
                  highlightSearchTerm(line.text, searchTerm)
                ) : (
                  line.text
                )}
              </div>
            </div>
          ))
        )}

        {/* Auto-scroll indicator */}
        {!autoScrollEnabled && (
          <div className="text-center py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAutoScrollEnabled(true)}
              className="text-xs"
            >
              <ChevronDown size={14} className="mr-1" />
              Jump to latest
            </Button>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400">
        {autoScrollEnabled ? (
          'Auto-scrolling enabled'
        ) : (
          'Auto-scrolling disabled - scroll to bottom to re-enable'
        )}
        {searchTerm && (
          <span className="ml-2">
            • Showing {filteredTranscript.length} of {transcript.length} messages
          </span>
        )}
      </div>
    </div>
  );
};