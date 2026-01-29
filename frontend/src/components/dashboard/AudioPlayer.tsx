import React from 'react';
import { Button } from '../Button';
import { Download } from 'lucide-react';

interface AudioPlayerProps {
  src?: string;
  onDownload: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, onDownload }) => {
  if (!src) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center text-gray-500 text-sm">
        No recording available for this call.
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
      <audio key={src} controls className="flex-1 w-full h-10 outline-none focus:ring-2 focus:ring-primary rounded">
        <source src={src} type="audio/mpeg" />
        <source src={src} type="audio/wav" />
        Your browser does not support the audio element.
      </audio>
      <Button 
        size="sm" 
        variant="secondary" 
        onClick={onDownload}
        title="Download Recording"
        className="shrink-0 w-full sm:w-auto"
      >
        <Download size={16} className="mr-2" />
        Download
      </Button>
    </div>
  );
};
