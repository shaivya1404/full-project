import React, { useState } from 'react';
import {
  CreditCard,
  Download,
  LayoutDashboard,
  BarChart3,
  RotateCcw,
  ShieldAlert,
  Plus
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getPayments,
  getPaymentAnalytics,
  initiateRefund,
  markAsCompleted,
  downloadInvoicePDF
} from '../services/api';
import { PaymentsTable } from '../components/payments/PaymentsTable';
import { PaymentFiltersPanel } from '../components/payments/PaymentFiltersPanel';
import { PaymentDetailPanel } from '../components/payments/PaymentDetailPanel';
import { RefundDialog } from '../components/payments/RefundDialog';
import { PaymentAnalyticsDashboard } from '../components/payments/PaymentAnalyticsDashboard';
import { BulkPaymentActions } from '../components/payments/BulkPaymentActions';
import { PaymentMethodAnalytics } from '../components/payments/PaymentMethodAnalytics';
import { RefundAnalytics } from '../components/payments/RefundAnalytics';
import { PaymentCardTokenManager } from '../components/payments/PaymentCardTokenManager';
import { InvoiceGenerator } from '../components/payments/InvoiceGenerator';
import { PaymentLinkDialog } from '../components/payments/PaymentLinkDialog';
import type { Payment } from '../types';
import { DashboardLayout, Button } from '../components';

export const PaymentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'analytics' | 'methods' | 'refunds' | 'fraud' | 'cards'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showInvoiceGenerator, setShowInvoiceGenerator] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  
  const [filters, setFilters] = useState({
    search: '',
    status: [] as string[],
    method: [] as string[],
    refundStatus: [] as string[],
    dateRange: { start: '', end: '' },
    amountRange: { min: 0, max: 0 }
  });

  const queryClient = useQueryClient();
  const teamId = 'team-123'; // In a real app, this would come from context

  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments', teamId, currentPage, filters],
    queryKeyHashFn: (queryKey) => JSON.stringify(queryKey),
    queryFn: () => getPayments(teamId, pageSize, (currentPage - 1) * pageSize, {
      status: filters.status.join(','),
      method: filters.method.join(','),
      search: filters.search,
      startDate: filters.dateRange.start,
      endDate: filters.dateRange.end
    })
  });

  const { data: analyticsData } = useQuery({
    queryKey: ['payment-analytics', teamId],
    queryFn: () => getPaymentAnalytics(teamId)
  });

  const { data: methodAnalytics } = useQuery({
    queryKey: ['payment-method-analytics', teamId],
    queryFn: () => [
      { method: 'Card', count: 1240, revenue: 650000, successRate: 98, avgTime: 45 },
      { method: 'UPI', count: 850, revenue: 320000, successRate: 96, avgTime: 15 },
      { method: 'Net Banking', count: 420, revenue: 180000, successRate: 88, avgTime: 120 },
      { method: 'Wallet', count: 210, revenue: 45000, successRate: 99, avgTime: 10 },
      { method: 'COD', count: 150, revenue: 75000, successRate: 100, avgTime: 0 },
    ]
  });

  const refundMutation = useMutation({
    mutationFn: (data: { paymentId: string; amount: number; reason: string; notes?: string }) => 
      initiateRefund(data.paymentId, data.amount, data.reason, data.notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Refund initiated successfully');
      setShowRefundDialog(false);
    },
    onError: (error: any) => {
      toast.error(`Refund failed: ${error.message}`);
    }
  });

  const handleRefund = (data: { amount: number; reason: string; notes?: string }) => {
    if (selectedPayment) {
      refundMutation.mutate({
        paymentId: selectedPayment.id,
        ...data
      });
    }
  };

  const handleDownloadReceipt = (payment: Payment) => {
    toast.promise(
      downloadInvoicePDF(payment.id),
      {
        loading: 'Preparing receipt...',
        success: 'Receipt downloaded!',
        error: 'Failed to download receipt'
      }
    );
  };

  const tabs = [
    { id: 'all', label: 'All Payments', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'analytics', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'methods', label: 'Methods', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'refunds', label: 'Refunds', icon: <RotateCcw className="w-4 h-4" /> },
    { id: 'fraud', label: 'Fraud Alerts', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'cards', label: 'Saved Cards', icon: <CreditCard className="w-4 h-4" /> },
  ];

  // Mock data for analytics visuals
  const revenueTrend = [
    { date: 'Dec 01', amount: 45000 },
    { date: 'Dec 05', amount: 52000 },
    { date: 'Dec 10', amount: 48000 },
    { date: 'Dec 15', amount: 61000 },
    { date: 'Dec 20', amount: 55000 },
    { date: 'Dec 25', amount: 72000 },
    { date: 'Dec 30', amount: 68000 },
  ];

  const methodDistribution = [
    { name: 'Card', value: 45 },
    { name: 'UPI', value: 30 },
    { name: 'Net Banking', value: 15 },
    { name: 'Wallets', value: 10 },
  ];

  const statusDistribution = [
    { status: 'Completed', count: 450 },
    { status: 'Processing', count: 45 },
    { status: 'Failed', count: 25 },
    { status: 'Cancelled', count: 12 },
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto pb-24">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Payments Dashboard</h1>
            <p className="text-gray-500 mt-1 font-medium dark:text-gray-400">Monitor, process, and manage all your transactions in one place.</p>
          </div>
          <div className="flex space-x-3">
            <Button className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700">
              <Download className="w-4 h-4 mr-2" />
              Export Data
            </Button>
            <Button className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
              <Plus className="w-4 h-4 mr-2" />
              New Payment
            </Button>
          </div>
        </div>

      {/* Tabs */}
      <div className="bg-white p-1 rounded-2xl shadow-sm border border-gray-100 inline-flex">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center px-6 py-3 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'all' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <PaymentFiltersPanel 
            filters={filters} 
            onFilterChange={setFilters} 
            onReset={() => setFilters({
              search: '',
              status: [],
              method: [],
              refundStatus: [],
              dateRange: { start: '', end: '' },
              amountRange: { min: 0, max: 0 }
            })}
          />
          
          <PaymentsTable 
            payments={paymentsData?.data || []}
            isLoading={isLoading}
            onViewDetails={setSelectedPayment}
            onProcessPayment={(p) => markAsCompleted(p.id)}
            onRefund={(p) => { setSelectedPayment(p); setShowRefundDialog(true); }}
            onDownloadReceipt={handleDownloadReceipt}
            onPageChange={setCurrentPage}
            totalPayments={paymentsData?.total || 0}
            currentPage={currentPage}
            pageSize={pageSize}
          />
        </div>
      )}

      {activeTab === 'analytics' && analyticsData && (
        <div className="animate-in fade-in duration-500">
          <PaymentAnalyticsDashboard 
            analytics={analyticsData}
            revenueTrend={revenueTrend}
            methodDistribution={methodDistribution}
            statusDistribution={statusDistribution}
            onExport={() => toast.success('Analytics report being generated...')}
          />
        </div>
      )}

      {activeTab === 'methods' && methodAnalytics && (
        <div className="animate-in fade-in duration-500">
          <PaymentMethodAnalytics data={methodAnalytics} />
        </div>
      )}

      {activeTab === 'refunds' && analyticsData && (
        <div className="animate-in fade-in duration-500">
          <RefundAnalytics 
            totalRefunds={analyticsData.totalRefunds || 0}
            refundAmount={analyticsData.totalRevenue * (analyticsData.refundRate / 100)}
            refundRate={analyticsData.refundRate}
            avgProcessingTime={3.5}
            reasonBreakdown={[
              { name: 'Customer Requested', value: 45 },
              { name: 'Order Cancelled', value: 25 },
              { name: 'Product Not Received', value: 15 },
              { name: 'Defective Item', value: 10 },
              { name: 'Other', value: 5 },
            ]}
            refundTrend={[
              { date: 'Dec 01', count: 5 },
              { date: 'Dec 05', count: 8 },
              { date: 'Dec 10', count: 12 },
              { date: 'Dec 15', count: 7 },
              { date: 'Dec 20', count: 9 },
              { date: 'Dec 25', count: 15 },
              { date: 'Dec 30', count: 10 },
            ]}
          />
        </div>
      )}

      {activeTab === 'cards' && (
        <div className="animate-in fade-in duration-500">
          <PaymentCardTokenManager 
            cards={[
              { id: '1', brand: 'visa', last4: '4242', expiry: '12/26', isPrimary: true, type: 'credit' },
              { id: '2', brand: 'mastercard', last4: '8888', expiry: '08/25', isPrimary: false, type: 'debit' },
              { id: '3', brand: 'visa', last4: '1234', expiry: '04/24', isPrimary: false, type: 'credit' },
            ]}
            onSetPrimary={(id) => toast.success(`Card ${id} set as primary`)}
            onDelete={(id) => toast.success(`Card ${id} removed`)}
            onAddNew={() => toast.success('Add new card modal opened')}
          />
        </div>
      )}

      {/* Slide-over Detail Panel */}
      {selectedPayment && !showRefundDialog && !showInvoiceGenerator && !showLinkDialog && (
        <PaymentDetailPanel 
          payment={selectedPayment}
          onClose={() => setSelectedPayment(null)}
          onRefund={() => setShowRefundDialog(true)}
          onDownloadReceipt={handleDownloadReceipt}
          onGenerateInvoice={() => setShowInvoiceGenerator(true)}
          onResendLink={() => setShowLinkDialog(true)}
        />
      )}

      {/* Refund Dialog */}
      {showRefundDialog && selectedPayment && (
        <RefundDialog 
          payment={selectedPayment}
          onClose={() => setShowRefundDialog(false)}
          onConfirm={handleRefund}
        />
      )}

      {/* Invoice Generator */}
      {showInvoiceGenerator && selectedPayment && (
        <InvoiceGenerator
          payment={selectedPayment}
          items={[
            { id: '1', name: 'Premium Subscription', quantity: 1, price: selectedPayment.amount, total: selectedPayment.amount }
          ]}
          onGenerate={() => {
            toast.success('Invoice generated successfully');
            setShowInvoiceGenerator(false);
          }}
          onPreview={() => toast.success('Previewing invoice...')}
          onClose={() => setShowInvoiceGenerator(false)}
        />
      )}

      {/* Payment Link Dialog */}
      {showLinkDialog && selectedPayment && (
        <PaymentLinkDialog
          orderId={selectedPayment.orderId}
          amount={selectedPayment.amount}
          currentLink={{
            id: 'link_123',
            orderId: selectedPayment.orderId,
            link: `https://pay.cto.new/L_${selectedPayment.id.slice(0, 8)}`,
            status: 'pending',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            sentCount: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }}
          onGenerate={() => toast.success('New link generated')}
          onCancel={() => toast.success('Link cancelled')}
          onSendSMS={() => toast.success('Link sent')}
          onClose={() => setShowLinkDialog(false)}
        />
      )}

      {/* Bulk Actions Bar */}
      <BulkPaymentActions 
        selectedCount={selectedCount} 
        onAction={(action) => toast.success(`Performing ${action} on selected items`)}
        onClearSelection={() => setSelectedCount(0)}
      />
      </div>
    </DashboardLayout>
  );
};

export default PaymentsPage;
