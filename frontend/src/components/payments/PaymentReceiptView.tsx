import React from 'react';
import {
  X,
  Download,
  Printer,
  Mail,
  CheckCircle2
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Payment } from '../../types';

type PaymentReceiptViewProps = {
  payment: Payment;
  onClose: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onEmail: () => void;
};

export const PaymentReceiptView: React.FC<PaymentReceiptViewProps> = ({
  payment,
  onClose,
  onDownload,
  onPrint,
  onEmail,
}) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 text-center bg-gradient-to-br from-green-500 to-emerald-600 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>

          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4 backdrop-blur-md">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-black mb-1">Payment Successful!</h2>
          <p className="text-white/80 font-medium">Receipt #REC-{payment.id.slice(-6).toUpperCase()}</p>
        </div>

        <div className="p-8 space-y-8 relative">
          {/* Decorative cut-outs for receipt effect */}
          <div className="absolute top-0 left-0 right-0 h-4 bg-white -mt-2 flex justify-between px-2 overflow-hidden">
            {[...Array(15)].map((_, i) => (
              <div key={i} className="w-4 h-4 bg-gray-100 rounded-full -mt-2 shrink-0"></div>
            ))}
          </div>

          <div className="flex justify-between items-center pb-6 border-b border-dashed border-gray-200">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Amount Paid</div>
              <div className="text-4xl font-black text-gray-900">{formatCurrency(payment.amount, payment.currency)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Date</div>
              <div className="text-sm font-bold text-gray-900">{new Date(payment.createdAt).toLocaleDateString()}</div>
              <div className="text-xs text-gray-500">{new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Transaction ID</span>
              <span className="text-gray-900 font-bold font-mono">{payment.transactionId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Payment Method</span>
              <span className="text-gray-900 font-bold capitalize">{payment.method.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Order ID</span>
              <span className="text-gray-900 font-bold">#{payment.orderId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 font-medium">Customer</span>
              <span className="text-gray-900 font-bold">{payment.customerId}</span>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex flex-wrap gap-2">
            <button
              onClick={onDownload}
              className="flex-1 flex items-center justify-center py-3 px-4 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </button>
            <button
              onClick={onPrint}
              className="p-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              title="Print Receipt"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              onClick={onEmail}
              className="p-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors"
              title="Email Receipt"
            >
              <Mail className="w-5 h-5" />
            </button>
          </div>

          <div className="text-center">
            <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
              This is a computer-generated receipt and does not require a physical signature.<br />
              Thank you for choosing <strong>Twilio REALTIME Dashboard</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
