import React, { useState } from 'react';
import { 
  X, 
  RotateCcw, 
  AlertCircle, 
  ChevronDown,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Payment } from '../../types';

type RefundDialogProps = {
  payment: Payment;
  onClose: () => void;
  onConfirm: (data: { amount: number; reason: string; notes?: string }) => void;
};

export const RefundDialog: React.FC<RefundDialogProps> = ({
  payment,
  onClose,
  onConfirm,
}) => {
  const [amount, setAmount] = useState<number>(payment.amount - (payment.refundAmount || 0));
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const maxRefundable = payment.amount - (payment.refundAmount || 0);

  const handleStartConfirm = () => {
    if (amount <= 0 || amount > maxRefundable || !reason) return;
    setIsConfirming(true);
    let timer = 3;
    const interval = setInterval(() => {
      timer -= 1;
      setCountdown(timer);
      if (timer === 0) {
        clearInterval(interval);
      }
    }, 1000);
  };

  const handleFinalConfirm = () => {
    onConfirm({ amount, reason, notes });
  };

  const reasons = [
    'Customer Requested',
    'Duplicate Payment',
    'Fraudulent Transaction',
    'Order Cancelled',
    'Partial Return',
    'Product Not Received',
    'Wrong Product Delivered',
    'Other'
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-purple-50">
          <div className="flex items-center text-purple-800">
            <RotateCcw className="w-5 h-5 mr-2" />
            <h2 className="text-lg font-bold">Initiate Refund</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-purple-100 rounded-full text-purple-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-xl p-4 flex justify-between items-center border border-gray-100">
            <div>
              <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Transaction</div>
              <div className="text-sm font-medium text-gray-900">{payment.transactionId}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase font-bold tracking-wider">Original Amount</div>
              <div className="text-sm font-bold text-gray-900">{formatCurrency(payment.amount, payment.currency)}</div>
            </div>
          </div>

          {!isConfirming ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Refund Amount ({payment.currency})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                    {payment.currency === 'INR' ? '₹' : '$'}
                  </span>
                  <input
                    type="number"
                    max={maxRefundable}
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">Max refundable: {formatCurrency(maxRefundable, payment.currency)}</span>
                  <button 
                    onClick={() => setAmount(maxRefundable)}
                    className="text-xs text-purple-600 font-bold hover:underline"
                  >
                    Full Refund
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Reason for Refund</label>
                <div className="relative">
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-white border border-gray-200 rounded-xl appearance-none focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  >
                    <option value="">Select a reason</option>
                    {reasons.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Additional Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Internal notes about this refund..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-bold text-yellow-800">Important Note</div>
                  <p className="text-xs text-yellow-700 mt-1">
                    Refunds are typically processed back to the original payment method. Estimated processing time: 5-7 business days.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <ShieldCheck className="w-10 h-10 text-purple-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Are you sure?</h3>
                <p className="text-gray-500 mt-2">
                  You are about to refund <span className="font-bold text-gray-900">{formatCurrency(amount, payment.currency)}</span> to the customer. This action cannot be undone.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl inline-flex items-center text-sm font-medium text-gray-600">
                <Clock className="w-4 h-4 mr-2" />
                Processing through: {(payment.method || 'unknown').toUpperCase()}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex space-x-3">
          <button
            onClick={isConfirming ? () => setIsConfirming(false) : onClose}
            className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            {isConfirming ? 'Go Back' : 'Cancel'}
          </button>
          <button
            onClick={isConfirming ? handleFinalConfirm : handleStartConfirm}
            disabled={!isConfirming && (amount <= 0 || amount > maxRefundable || !reason)}
            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white transition-all shadow-lg ${
              isConfirming 
                ? countdown > 0 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700 shadow-purple-200'
                : 'bg-purple-600 hover:bg-purple-700 shadow-purple-200 disabled:opacity-50 disabled:shadow-none'
            }`}
          >
            {isConfirming 
              ? countdown > 0 
                ? `Confirm Refund (${countdown}s)` 
                : 'Confirm Refund Now'
              : 'Process Refund'}
          </button>
        </div>
      </div>
    </div>
  );
};
