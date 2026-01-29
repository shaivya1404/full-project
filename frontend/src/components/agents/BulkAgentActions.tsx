import { ChevronDown, Shield, Trash2, MessageSquare, Briefcase, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../Button';

type BulkAgentActionsProps = {
  selectedCount: number;
  onAction: (action: string) => void;
  onClear: () => void;
};

export const BulkAgentActions = ({ selectedCount, onAction, onClear }: BulkAgentActionsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  if (selectedCount === 0) return null;

  const actions = [
    { id: 'status', label: 'Change Status', icon: RefreshCw },
    { id: 'team', label: 'Assign Team', icon: Shield },
    { id: 'skills', label: 'Assign Skills', icon: Briefcase },
    { id: 'message', label: 'Send Announcement', icon: MessageSquare },
    { id: 'delete', label: 'Terminate Selected', icon: Trash2, danger: true },
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center bg-primary text-white text-xs font-bold rounded-full h-6 w-6">
          {selectedCount}
        </span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Agents selected</span>
      </div>

      <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-full"
            onClick={() => setIsOpen(!isOpen)}
          >
            Bulk Actions <ChevronDown size={16} className="ml-1" />
          </Button>

          {isOpen && (
            <>
              <div className="fixed inset-0 z-[-1]" onClick={() => setIsOpen(false)}></div>
              <div className="absolute bottom-full mb-2 left-0 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="py-1">
                  {actions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => {
                        onAction(action.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        action.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <action.icon size={16} className="mr-3" />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        
        <Button
          size="sm"
          variant="secondary"
          className="rounded-full !text-gray-500 hover:!text-gray-700"
          onClick={onClear}
        >
          Clear
        </Button>
      </div>
    </div>
  );
};
