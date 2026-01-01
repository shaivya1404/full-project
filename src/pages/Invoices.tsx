import { useState } from 'react';
import {
  Plus,
  Download,
  Search,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getInvoices, downloadInvoicePDF, sendInvoiceEmail, sendInvoiceSMS } from '../services/api';
import { InvoicesTable } from '../components/payments/InvoicesTable';


export const InvoicesPage: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const teamId = 'team-123';

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', teamId, currentPage, statusFilter],
    queryFn: () => getInvoices(teamId, pageSize, (currentPage - 1) * pageSize, {
      status: statusFilter === 'all' ? undefined : statusFilter
    })
  });

  const handleDownload = (invoice: any) => {
    toast.promise(
      downloadInvoicePDF(invoice.id),
      {
        loading: 'Downloading invoice...',
        success: 'Invoice downloaded!',
        error: 'Failed to download invoice'
      }
    );
  };

  const handleSend = (invoice: any, method: 'email' | 'sms') => {
    const sendFn = method === 'email'
      ? () => sendInvoiceEmail(invoice.id, invoice.customerEmail)
      : () => sendInvoiceSMS(invoice.id, invoice.customerPhone);

    toast.promise(
      sendFn(),
      {
        loading: `Sending via ${method}...`,
        success: `Invoice sent via ${method}!`,
        error: `Failed to send via ${method}`
      }
    );
  };

  const stats = [
    { label: 'Total Invoiced', value: '₹12,45,000', icon: <FileText className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50' },
    { label: 'Paid Invoices', value: '₹9,82,000', icon: <CheckCircle className="w-5 h-5 text-green-600" />, bg: 'bg-green-50' },
    { label: 'Pending / Due', value: '₹2,18,000', icon: <Clock className="w-5 h-5 text-yellow-600" />, bg: 'bg-yellow-50' },
    { label: 'Overdue', value: '₹45,000', icon: <AlertTriangle className="w-5 h-5 text-red-600" />, bg: 'bg-red-50' },
  ];

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Invoices</h1>
          <p className="text-gray-500 mt-1 font-medium">Manage and track all customer billing and tax invoices.</p>
        </div>
        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm">
            <Download className="w-4 h-4 mr-2" />
            Bulk Export
          </button>
          <button className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                {stat.icon}
              </div>
              <div className="text-xs font-bold text-green-600 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +8%
              </div>
            </div>
            <div className="text-2xl font-black text-gray-900">{stat.value}</div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search invoices by number, order ID, or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="flex space-x-2 overflow-x-auto pb-1 lg:pb-0">
          {['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all border ${statusFilter === status
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Invoices Table */}
      <InvoicesTable
        invoices={invoicesData?.data || []}
        isLoading={isLoading}
        onViewDetails={(inv) => toast.success(`Viewing invoice ${inv.invoiceNumber}`)}
        onDownload={handleDownload}
        onSend={handleSend}
        onPageChange={setCurrentPage}
        totalInvoices={invoicesData?.total || 0}
        currentPage={currentPage}
        pageSize={pageSize}
      />
    </div>
  );
};

export default InvoicesPage;
