import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { 
  ChevronLeft, 
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  ShieldCheck,
  CreditCard,
  Smartphone,
  Banknote,
  Link as LinkIcon
} from 'lucide-react';
import { getPaymentById, getRefundHistory, getFraudScore } from '../services/api';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';
import { PaymentStatusTracker } from '../components/payments/PaymentStatusTracker';
import { FraudDetectionPanel } from '../components/payments/FraudDetectionPanel';
import { PaymentMethodSelector } from '../components/payments/PaymentMethodSelector';
import toast from 'react-hot-toast';

export const PaymentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: payment, isLoading: isPaymentLoading } = useQuery({
    queryKey: ['payment', id],
    queryFn: () => getPaymentById(id!),
    enabled: !!id
  });

  const { data: refunds } = useQuery({
    queryKey: ['payment-refunds', id],
    queryFn: () => getRefundHistory(id!),
    enabled: !!id
  });

  const { data: fraudCheck } = useQuery({
    queryKey: ['payment-fraud', id],
    queryFn: () => getFraudScore(id!),
    enabled: !!id
  });

  if (isPaymentLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="p-12 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Payment not found</h2>
        <button 
          onClick={() => navigate('/dashboard/payments')}
          className="mt-4 text-blue-600 font-bold flex items-center justify-center mx-auto hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Payments
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-[1200px] mx-auto pb-24">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black text-gray-900">Transaction #{payment.transactionId}</h1>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                payment.status === 'completed' ? 'bg-green-100 text-green-700' : 
                payment.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {payment.status}
              </span>
            </div>
            <p className="text-gray-500 font-medium text-sm mt-1">
              Order #{payment.orderId} • Customer {payment.customerId}
            </p>
          </div>
        </div>
        <div className="flex space-x-3">
          <button className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 shadow-sm transition-all text-sm">
            Download Receipt
          </button>
          <button className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all text-sm">
            Process Action
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Status Tracker */}
          <PaymentStatusTracker payment={payment} />

          {/* Detailed Info */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Payment Information</h3>
              <div className="text-xs text-gray-400 font-bold">{payment.id}</div>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-y-8 gap-x-12">
              <div className="space-y-1">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Amount</div>
                <div className="text-3xl font-black text-gray-900">{formatCurrency(payment.amount, payment.currency)}</div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Date & Time</div>
                <div className="text-base font-bold text-gray-900">{new Date(payment.createdAt).toLocaleString()}</div>
                <div className="text-xs text-gray-500">{formatRelativeTime(payment.createdAt)}</div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-50">
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Payment Method</div>
                  <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                    {payment.method === 'card' ? <CreditCard className="w-5 h-5 text-blue-600 mr-3" /> :
                     payment.method === 'upi' ? <Smartphone className="w-5 h-5 text-green-600 mr-3" /> :
                     payment.method === 'cod' ? <Banknote className="w-5 h-5 text-amber-600 mr-3" /> :
                     <LinkIcon className="w-5 h-5 text-blue-600 mr-3" />}
                    <span className="font-bold text-gray-900 capitalize">{payment.method.replace('_', ' ')}</span>
                  </div>
                </div>
                {payment.cardLast4 && (
                  <div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Card Details</div>
                    <div className="text-sm font-medium text-gray-700">
                      {payment.cardBrand} •••• {payment.cardLast4}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-50">
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Customer Details</div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                    <span className="font-bold text-gray-900">{payment.customerId}</span>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Billing Address</div>
                  <div className="text-sm font-medium text-gray-700 leading-relaxed">
                    123 Park Avenue, Suite 4B<br />
                    New York, NY 10001
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs mb-8">Transaction Timeline</h3>
            <div className="space-y-8">
              {[
                { time: payment.createdAt, label: 'Transaction Initiated', status: 'done' },
                payment.status === 'processing' && { time: payment.updatedAt, label: 'Gateway Processing', status: 'current' },
                payment.completedAt && { time: payment.completedAt, label: 'Payment Authorized & Captured', status: 'done' },
                payment.status === 'failed' && { time: payment.updatedAt, label: 'Payment Rejected by Gateway', status: 'failed' },
                ...(refunds || []).map(r => ({ time: r.createdAt, label: `Refund ${r.status}: ${formatCurrency(r.amount, payment.currency)}`, status: 'refund' }))
              ].filter(Boolean).sort((a, b) => new Date(b!.time).getTime() - new Date(a!.time).getTime()).map((event, i) => (
                <div key={i} className="flex items-start">
                  <div className="min-w-[140px] pt-1">
                    <div className="text-sm font-bold text-gray-900">{new Date(event!.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    <div className="text-xs text-gray-400">{new Date(event!.time).toLocaleDateString()}</div>
                  </div>
                  <div className="relative mx-6">
                    <div className={`w-3 h-3 rounded-full ${
                      event!.status === 'done' ? 'bg-green-500' :
                      event!.status === 'current' ? 'bg-blue-500 ring-4 ring-blue-100' :
                      event!.status === 'failed' ? 'bg-red-500' : 'bg-purple-500'
                    }`}></div>
                    {i !== 0 && <div className="absolute top-0 left-1.5 w-0.5 h-full -translate-y-full bg-gray-100"></div>}
                  </div>
                  <div className="pt-0.5">
                    <div className="text-sm font-bold text-gray-900">{event!.label}</div>
                    <div className="text-xs text-gray-400 mt-1">Transaction verified through secured gateway protocol.</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Fraud Analysis */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Fraud Analysis</h3>
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <FraudDetectionPanel 
              fraudCheck={fraudCheck}
              onReportFraud={() => toast.success('Payment reported to security team')}
              onWhitelist={() => toast.success('Customer whitelisted')}
              onBlacklist={() => toast.success('Customer added to blacklist')}
            />
          </div>

          {/* Refund History Quick View */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs mb-6">Refund History</h3>
            {refunds && refunds.length > 0 ? (
              <div className="space-y-4">
                {refunds.map(refund => (
                  <div key={refund.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(refund.amount, payment.currency)}</span>
                      <span className={`text-[10px] font-black uppercase ${
                        refund.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                      }`}>{refund.status}</span>
                    </div>
                    <div className="text-[10px] text-gray-500">{new Date(refund.createdAt).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-gray-400 font-medium italic">No refund history found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailPage;
