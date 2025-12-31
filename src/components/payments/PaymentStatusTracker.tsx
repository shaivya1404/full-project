import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle,
  CreditCard,
  ShieldCheck,
  Package,
  ArrowRight
} from 'lucide-react';
import type { Payment } from '../../types';

type PaymentStatusTrackerProps = {
  payment: Payment;
};

export const PaymentStatusTracker: React.FC<PaymentStatusTrackerProps> = ({ payment }) => {
  const steps = [
    { id: 'created', label: 'Order Placed', icon: <Package className="w-5 h-5" /> },
    { id: 'processing', label: 'Payment Processing', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'fraud_check', label: 'Security Verification', icon: <ShieldCheck className="w-5 h-5" /> },
    { id: 'completed', label: 'Payment Successful', icon: <CheckCircle2 className="w-5 h-5" /> },
  ];

  const getCurrentStepIndex = () => {
    if (payment.status === 'completed') return 3;
    if (payment.status === 'failed' || payment.status === 'cancelled') return 1;
    if (payment.status === 'processing') return 2;
    return 0;
  };

  const currentStep = getCurrentStepIndex();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
      <div className="flex items-center justify-between mb-12">
        <h3 className="text-lg font-black text-gray-900 flex items-center">
          <Clock className="w-5 h-5 mr-2 text-blue-600" />
          Live Payment Status
        </h3>
        <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
          payment.status === 'completed' ? 'bg-green-100 text-green-700' :
          payment.status === 'failed' ? 'bg-red-100 text-red-700' :
          'bg-blue-100 text-blue-700 animate-pulse'
        }`}>
          {payment.status}
        </span>
      </div>

      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ease-out ${
              payment.status === 'failed' ? 'bg-red-500' : 'bg-blue-600'
            }`}
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          ></div>
        </div>

        <div className="relative flex justify-between items-center">
          {steps.map((step, index) => {
            const isCompleted = index < currentStep || (index === currentStep && payment.status === 'completed');
            const isCurrent = index === currentStep && payment.status !== 'completed' && payment.status !== 'failed' && payment.status !== 'cancelled';
            const isFailed = index === currentStep && (payment.status === 'failed' || payment.status === 'cancelled');

            return (
              <div key={step.id} className="flex flex-col items-center relative z-10 group">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 border-4 ${
                  isCompleted ? 'bg-blue-600 border-white text-white shadow-lg shadow-blue-200' :
                  isCurrent ? 'bg-white border-blue-600 text-blue-600 animate-bounce' :
                  isFailed ? 'bg-red-600 border-white text-white shadow-lg shadow-red-200' :
                  'bg-white border-gray-100 text-gray-400'
                }`}>
                  {isCompleted ? <CheckCircle2 className="w-6 h-6" /> : 
                   isFailed ? <AlertCircle className="w-6 h-6" /> :
                   step.icon}
                </div>
                <div className="absolute top-16 whitespace-nowrap text-center">
                  <div className={`text-xs font-black uppercase tracking-wider transition-colors duration-500 ${
                    isCompleted || isCurrent ? 'text-gray-900' : isFailed ? 'text-red-600' : 'text-gray-400'
                  }`}>
                    {step.label}
                  </div>
                  {isCurrent && (
                    <div className="text-[10px] text-blue-500 font-bold mt-1">Processing...</div>
                  )}
                  {isFailed && (
                    <div className="text-[10px] text-red-500 font-bold mt-1">Terminated</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-24 bg-gray-50 rounded-xl p-6 border border-gray-100">
        <div className="flex items-start">
          <div className="p-3 bg-white rounded-lg border border-gray-200 mr-4 shadow-sm">
            <Info className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">Current Status Detail</h4>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {payment.status === 'completed' 
                ? 'Payment has been successfully authorized and funds have been captured. A confirmation email has been sent to the customer.'
                : payment.status === 'failed'
                ? `Transaction failed: ${payment.failureReason || 'General gateway error'}. The customer may need to retry with a different payment method.`
                : 'The transaction is currently being processed by the payment gateway. We are waiting for final authorization.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
