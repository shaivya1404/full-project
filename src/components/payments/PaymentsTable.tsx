import React, { useState } from 'react';
import { 
  Eye, 
  Download, 
  RotateCcw, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  Filter,
  MoreHorizontal,
  CreditCard,
  Smartphone,
  Link as LinkIcon,
  Banknote,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Payment } from '../../types';

type PaymentsTableProps = {
  payments: Payment[];
  isLoading: boolean;
  onViewDetails: (payment: Payment) => void;
  onProcessPayment: (payment: Payment) => void;
  onRefund: (payment: Payment) => void;
  onDownloadReceipt: (payment: Payment) => void;
  onPageChange: (page: number) => void;
  totalPayments: number;
  currentPage: number;
  pageSize: number;
};

export const PaymentsTable: React.FC<PaymentsTableProps> = ({
  payments,
  isLoading,
  onViewDetails,
  onProcessPayment,
  onRefund,
  onDownloadReceipt,
  onPageChange,
  totalPayments,
  currentPage,
  pageSize,
}) => {
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);

  const toggleSelectAll = () => {
    if (selectedPayments.length === payments.length) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(payments.map(p => p.id));
    }
  };

  const toggleSelectPayment = (id: string) => {
    if (selectedPayments.includes(id)) {
      setSelectedPayments(selectedPayments.filter(pId => pId !== id));
    } else {
      setSelectedPayments([...selectedPayments, id]);
    }
  };

  const getStatusBadge = (status: Payment['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3 mr-1 animate-pulse" />
            Processing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </span>
        );
    }
  };

  const getRefundBadge = (status: Payment['refundStatus']) => {
    if (!status || status === 'none') return null;
    
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 ml-2">
            Refunded
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 ml-2">
            Refund Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 ml-2">
            Refund Failed
          </span>
        );
      default:
        return null;
    }
  };

  const getMethodIcon = (method: Payment['method']) => {
    switch (method) {
      case 'card':
        return <CreditCard className="w-4 h-4 text-gray-500" />;
      case 'upi':
        return <Smartphone className="w-4 h-4 text-gray-500" />;
      case 'link':
        return <LinkIcon className="w-4 h-4 text-gray-500" />;
      case 'cod':
        return <Banknote className="w-4 h-4 text-gray-500" />;
      default:
        return <CreditCard className="w-4 h-4 text-gray-500" />;
    }
  };

  const totalPages = Math.ceil(totalPayments / pageSize);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow animate-pulse">
        <div className="h-12 bg-gray-100 rounded-t-lg"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 border-t border-gray-100"></div>
        ))}
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <Search className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No payments found</h3>
        <p className="text-gray-500 mt-1">Try adjusting your search or filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  checked={selectedPayments.length === payments.length && payments.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order / Transaction
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Customer
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th scope="col" className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    checked={selectedPayments.includes(payment.id)}
                    onChange={() => toggleSelectPayment(payment.id)}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-blue-600 hover:underline cursor-pointer" onClick={() => onViewDetails(payment)}>
                    #{payment.orderId}
                  </div>
                  <div className="text-xs text-gray-500 font-mono">{payment.transactionId}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {payment.customerId}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">
                    {formatCurrency(payment.amount, payment.currency)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-500">
                    {getMethodIcon(payment.method)}
                    <span className="ml-2 capitalize">{payment.method.replace('_', ' ')}</span>
                  </div>
                  {payment.cardLast4 && (
                    <div className="text-xs text-gray-400 mt-1">•••• {payment.cardLast4}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {getStatusBadge(payment.status)}
                    {getRefundBadge(payment.refundStatus)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(payment.createdAt).toLocaleDateString()}
                  <div className="text-xs text-gray-400">
                    {new Date(payment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onViewDetails(payment)}
                      className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {payment.status === 'completed' && (
                      <>
                        <button
                          onClick={() => onRefund(payment)}
                          className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                          title="Initiate Refund"
                        >
                          <RotateCcw className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => onDownloadReceipt(payment)}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Download Receipt"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </>
                    )}
                    {payment.status === 'pending' && (
                      <button
                        onClick={() => onProcessPayment(payment)}
                        className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                        title="Process Payment"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
              <span className="font-medium">
                {Math.min(currentPage * pageSize, totalPayments)}
              </span>{' '}
              of <span className="font-medium">{totalPayments}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              
              {[...Array(Math.min(5, totalPages))].map((_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      currentPage === pageNum
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};
