import React from 'react';
import {
  CheckCircle,
  RotateCcw,
  Download,
  Send
} from 'lucide-react';

type BulkPaymentActionsProps = {
  selectedCount: number;
  onAction: (action: string) => void;
  onClearSelection: () => void;
};

export const BulkPaymentActions: React.FC<BulkPaymentActionsProps> = ({
  selectedCount,
  onAction,
  onClearSelection,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-8 duration-300">
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl shadow-blue-900/20 px-6 py-4 flex items-center space-x-6 border border-white/10 backdrop-blur-md bg-opacity-95">
        <div className="flex items-center border-r border-white/10 pr-6">
          <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3">
            {selectedCount}
          </div>
          <span className="text-sm font-bold whitespace-nowrap">Selected Payments</span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onAction('complete')}
            className="flex items-center px-3 py-2 text-sm font-bold hover:bg-white/10 rounded-xl transition-colors text-green-400"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Complete
          </button>
          <button
            onClick={() => onAction('refund')}
            className="flex items-center px-3 py-2 text-sm font-bold hover:bg-white/10 rounded-xl transition-colors text-purple-400"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Bulk Refund
          </button>
          <button
            onClick={() => onAction('export')}
            className="flex items-center px-3 py-2 text-sm font-bold hover:bg-white/10 rounded-xl transition-colors text-blue-400"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
          <button
            onClick={() => onAction('receipt')}
            className="flex items-center px-3 py-2 text-sm font-bold hover:bg-white/10 rounded-xl transition-colors text-gray-300"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Receipts
          </button>
        </div>

        <div className="flex items-center border-l border-white/10 pl-6 space-x-4">
          <button
            onClick={onClearSelection}
            className="text-sm font-bold text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
