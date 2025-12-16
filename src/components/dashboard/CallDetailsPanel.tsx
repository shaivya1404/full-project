import React from 'react';
import { Call } from '../../types';
import { Button } from '../Button';
import { X, User, Phone, Clock, Activity, Calendar } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { downloadRecording } from '../../api/calls';
import clsx from 'clsx';

interface CallDetailsPanelProps {
  call: Call | null;
  onClose: () => void;
}

export const CallDetailsPanel: React.FC<CallDetailsPanelProps> = ({ call, onClose }) => {
  if (!call) return null;

  const handleDownload = () => {
    if (call.id) {
        downloadRecording(call.id);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" 
        onClick={onClose}
      />
      <div className="fixed inset-y-0 right-0 w-full md:w-[600px] bg-white dark:bg-gray-900 shadow-2xl transform transition-transform duration-300 ease-in-out border-l dark:border-gray-700 z-50 overflow-y-auto">
        <div className="p-6 space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between border-b dark:border-gray-700 pb-4">
            <div>
               <h2 className="text-xl font-bold text-gray-900 dark:text-white">Call Details</h2>
               <p className="text-sm text-gray-500 dark:text-gray-400">ID: {call.id}</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-6">
             <div className="flex items-start gap-3">
               <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 dark:text-blue-400">
                 <User size={20} />
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Agent</p>
                 <p className="font-medium text-gray-900 dark:text-white">{call.agent}</p>
               </div>
             </div>
             
             <div className="flex items-start gap-3">
               <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-purple-600 dark:text-purple-400">
                 <Phone size={20} />
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Caller</p>
                 <p className="font-medium text-gray-900 dark:text-white">{call.caller}</p>
               </div>
             </div>

             <div className="flex items-start gap-3">
               <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-600 dark:text-orange-400">
                 <Clock size={20} />
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</p>
                 <p className="font-medium text-gray-900 dark:text-white">{formatDuration(call.duration)}</p>
               </div>
             </div>

             <div className="flex items-start gap-3">
               <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400">
                 <Activity size={20} />
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sentiment</p>
                 <p className={clsx("font-medium capitalize", {
                    'text-green-600': call.sentiment === 'positive',
                    'text-gray-600 dark:text-gray-300': call.sentiment === 'neutral',
                    'text-red-600': call.sentiment === 'negative'
                 })}>{call.sentiment}</p>
               </div>
             </div>
             
             <div className="flex items-start gap-3 col-span-2">
                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-400">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Date & Time</p>
                  <p className="font-medium text-gray-900 dark:text-white">{new Date(call.startTime).toLocaleString()}</p>
                </div>
             </div>
          </div>

          {/* Recording */}
          <div className="space-y-3">
             <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recording</h3>
             <AudioPlayer src={call.recordingUrl} onDownload={handleDownload} />
          </div>

          {/* Transcript */}
          <div className="space-y-3 flex-1 flex flex-col min-h-0">
             <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Transcript</h3>
             <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed border border-gray-100 dark:border-gray-700">
               {call.transcript || <span className="text-gray-400 italic">No transcript available for this call.</span>}
             </div>
          </div>
          
          <div className="pt-4 border-t dark:border-gray-700">
            <Button variant="ghost" fullWidth onClick={onClose}>Close Panel</Button>
          </div>
        </div>
      </div>
    </>
  );
};
