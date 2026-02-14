import React, { useState } from 'react';
import {
  X,
  RotateCcw,
  Send,
  Shield,
  Clock,
  FileText,
  Info,
  CreditCard,
  Smartphone,
  Link as LinkIcon,
  Banknote,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Receipt
} from 'lucide-react';
import { formatCurrency, formatRelativeTime } from '../../utils/formatters';
import type { Payment, Refund } from '../../types';

type PaymentDetailPanelProps = {
  payment: Payment;
  onClose: () => void;
  onRefund: (payment: Payment) => void;
  onDownloadReceipt: (payment: Payment) => void;
  onGenerateInvoice: (payment: Payment) => void;
  onResendLink: (payment: Payment) => void;
  refunds?: Refund[];
};

export const PaymentDetailPanel: React.FC<PaymentDetailPanelProps> = ({
  payment,
  onClose,
  onRefund,
  onDownloadReceipt,
  onGenerateInvoice,
  onResendLink,
  refunds = [],
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'timeline' | 'fraud' | 'refund'>('details');

  const getMethodDetails = () => {
    switch (payment.method) {
      case 'card':
        return (
          <div className="flex items-center">
            <CreditCard className="w-5 h-5 text-gray-400 mr-2" />
            <span>
              {payment.cardBrand} ending in •••• {payment.cardLast4}
            </span>
          </div>
        );
      case 'upi':
        return (
          <div className="flex items-center">
            <Smartphone className="w-5 h-5 text-gray-400 mr-2" />
            <span>UPI ID: {payment.upiId}</span>
          </div>
        );
      case 'link':
        return (
          <div className="flex items-center">
            <LinkIcon className="w-5 h-5 text-gray-400 mr-2" />
            <span>Payment Link</span>
          </div>
        );
      case 'cod':
        return (
          <div className="flex items-center">
            <Banknote className="w-5 h-5 text-gray-400 mr-2" />
            <span>Cash on Delivery</span>
          </div>
        );
      default:
        return <span>{payment.method}</span>;
    }
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return 'text-green-600';
    if (score < 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskBg = (score: number) => {
    if (score < 30) return 'bg-green-100';
    if (score < 70) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-xl bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Payment Details</h2>
          <p className="text-sm text-gray-500">Transaction ID: {payment.transactionId}</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
          <X className="w-6 h-6 text-gray-500" />
        </button>
      </div>

      {/* Quick Stats */}
      <div className="px-6 py-6 bg-gray-50 flex justify-between items-center">
        <div>
          <div className="text-sm text-gray-500 mb-1">Total Amount</div>
          <div className="text-3xl font-bold text-gray-900">
            {formatCurrency(payment.amount, payment.currency)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 mb-1">Status</div>
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${payment.status === 'completed' ? 'bg-green-100 text-green-800' :
            payment.status === 'failed' ? 'bg-red-100 text-red-800' :
              'bg-blue-100 text-blue-800'
            }`}>
            {(payment.status || 'unknown').toUpperCase()}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px px-6 space-x-8">
          {(['details', 'timeline', 'fraud', 'refund'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'details' && (
          <div className="space-y-8">
            <section>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Order Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Order ID</div>
                  <div className="text-sm font-medium text-blue-600 flex items-center">
                    #{payment.orderId}
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Customer</div>
                  <div className="text-sm font-medium text-gray-900">{payment.customerId}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Created At</div>
                  <div className="text-sm font-medium text-gray-900">{new Date(payment.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Completed At</div>
                  <div className="text-sm font-medium text-gray-900">
                    {payment.completedAt ? new Date(payment.completedAt).toLocaleString() : 'N/A'}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Payment Method</h3>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                {getMethodDetails()}
                {payment.gatewayId && (
                  <div className="mt-2 text-xs text-gray-500">
                    Gateway ID: {payment.gatewayId}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onDownloadReceipt(payment)}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Receipt
                </button>
                <button
                  onClick={() => onGenerateInvoice(payment)}
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Invoice
                </button>
                {payment.method === 'link' && payment.status === 'pending' && (
                  <button
                    onClick={() => onResendLink(payment)}
                    className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 col-span-2"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Resend Payment Link
                  </button>
                )}
                {payment.status === 'completed' && payment.refundStatus !== 'completed' && (
                  <button
                    onClick={() => onRefund(payment)}
                    className="flex items-center justify-center px-4 py-2 border border-purple-200 rounded-lg text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 col-span-2"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Initiate Refund
                  </button>
                )}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="flow-root">
            <ul className="-mb-8">
              {(() => {
                interface TimelineEvent {
                  status: string;
                  time: string;
                  title: string;
                  desc: string;
                }

                const events: (TimelineEvent | false | undefined | "")[] = [
                  { status: 'created', time: payment.createdAt, title: 'Payment Created', desc: 'Transaction initiated by customer' },
                  payment.status === 'processing' && { status: 'processing', time: new Date().toISOString(), title: 'Processing', desc: 'Waiting for gateway confirmation' },
                  payment.completedAt && { status: 'completed', time: payment.completedAt, title: 'Payment Successful', desc: 'Funds received successfully' },
                  payment.status === 'failed' && { status: 'failed', time: payment.updatedAt, title: 'Payment Failed', desc: payment.failureReason || 'Gateway rejected the transaction' },
                  ...refunds.map(r => ({
                    status: 'refund',
                    time: r.createdAt,
                    title: `Refund ${r.status}`,
                    desc: `${formatCurrency(r.amount, payment.currency)} - ${r.reason}`
                  }))
                ];

                const validEvents = events.filter((e): e is TimelineEvent => !!e).sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

                return validEvents.map((event, idx) => (
                  <li key={idx}>
                    <div className="relative pb-8">
                      {idx !== validEvents.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${event.status === 'completed' ? 'bg-green-500' :
                            event.status === 'failed' ? 'bg-red-500' :
                              event.status === 'refund' ? 'bg-purple-500' :
                                'bg-blue-500'
                            }`}>
                            {event.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-white" /> :
                              event.status === 'failed' ? <AlertTriangle className="w-5 h-5 text-white" /> :
                                <Clock className="w-5 h-5 text-white" />}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{event.title}</p>
                            <p className="text-sm text-gray-500">{event.desc}</p>
                          </div>
                          <div className="text-right text-xs whitespace-nowrap text-gray-500">
                            {formatRelativeTime(event.time)}
                            <div className="mt-1">{new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ));
              })()}
            </ul>
          </div>
        )}

        {activeTab === 'fraud' && (
          <div className="space-y-6">
            <div className={`rounded-xl p-6 text-center ${getRiskBg(payment.fraudRiskScore || 0)}`}>
              <div className="text-sm font-medium text-gray-600 mb-2">Fraud Risk Score</div>
              <div className={`text-5xl font-bold ${getRiskColor(payment.fraudRiskScore || 0)}`}>
                {payment.fraudRiskScore || 0}
              </div>
              <div className="text-xs text-gray-500 mt-2">Scale of 0-100 (Higher is riskier)</div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <Shield className="w-4 h-4 mr-2 text-blue-600" />
                Risk Indicators
              </h3>
              <div className="space-y-3">
                {payment.fraudChecks?.map((check, i) => (
                  <div key={i} className="flex items-start bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <Info className="w-4 h-4 text-blue-500 mr-3 mt-0.5" />
                    <div className="text-sm text-gray-700">{check}</div>
                  </div>
                )) || (
                    <div className="text-sm text-gray-500 text-center py-4">No risk indicators detected.</div>
                  )}
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <button className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                Report as Fraudulent
              </button>
            </div>
          </div>
        )}

        {activeTab === 'refund' && (
          <div className="space-y-6">
            {refunds.length > 0 ? (
              <div className="space-y-4">
                {refunds.map((refund) => (
                  <div key={refund.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-gray-50 px-4 py-3 flex justify-between items-center border-b border-gray-200">
                      <span className="text-sm font-bold text-gray-900">{refund.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${refund.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                        {(refund.status || 'unknown').toUpperCase()}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-500">Amount</span>
                        <span className="text-sm font-bold text-gray-900">{formatCurrency(refund.amount, payment.currency)}</span>
                      </div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm text-gray-500">Reason</span>
                        <span className="text-sm text-gray-900">{refund.reason}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Initiated</span>
                        <span className="text-sm text-gray-900">{new Date(refund.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900">No refunds yet</h3>
                <p className="text-gray-500 mt-2 max-w-xs mx-auto">
                  No refunds have been initiated for this transaction.
                </p>
                {payment.status === 'completed' && (
                  <button
                    onClick={() => onRefund(payment)}
                    className="mt-6 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                  >
                    Initiate First Refund
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
