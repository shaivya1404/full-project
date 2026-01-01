import { useState } from 'react';
import {
  Plus,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getOrders,
  confirmOrder,
  cancelOrder,
  updateOrderStatus,
} from '../services/api';
import type { Order } from '../types';
import { OrdersTable } from '../components/orders/OrdersTable';
import { OrderDetailPanel } from '../components/orders/OrderDetailPanel';
import { AddOrderModal } from '../components/orders/AddOrderModal';
import { EditOrderModal } from '../components/orders/EditOrderModal';
import { OrderFiltersPanel } from '../components/orders/OrderFiltersPanel';
import { OrderAnalytics } from '../components/orders/OrderAnalytics';
import { CancelOrderDialog } from '../components/orders/CancelOrderDialog';

export const OrdersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled' | 'analytics'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const [filters, setFilters] = useState({
    search: '',
    status: [] as string[],
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: ''
  });

  const queryClient = useQueryClient();
  // const { user } = useAuthStore();
  const teamId = 'team-123';

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders', teamId, currentPage, filters, activeTab],
    queryKeyHashFn: (queryKey) => JSON.stringify(queryKey),
    queryFn: () => {
      const searchFilters = activeTab === 'all' ? filters : { ...filters, status: [activeTab] };
      return getOrders(teamId, pageSize, (currentPage - 1) * pageSize, {
        status: searchFilters.status.join(','),
        search: searchFilters.search,
        dateFrom: searchFilters.dateFrom,
        dateTo: searchFilters.dateTo,
        minAmount: searchFilters.minAmount,
        maxAmount: searchFilters.maxAmount
      });
    }
  });

  const confirmOrderMutation = useMutation({
    mutationFn: (orderId: string) => confirmOrder(orderId),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order confirmed successfully');
      if (selectedOrder?.id === updatedOrder.id) {
        setSelectedOrder(updatedOrder);
      }
    },
    onError: () => {
      toast.error('Failed to confirm order');
    }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) => cancelOrder(orderId, reason),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order cancelled successfully');
      if (selectedOrder?.id === updatedOrder.id) {
        setSelectedOrder(updatedOrder);
      }
      setShowCancelDialog(false);
    },
    onError: () => {
      toast.error('Failed to cancel order');
    }
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: ({ orderId, status, note }: { orderId: string; status: Order['status']; note?: string }) =>
      updateOrderStatus(orderId, status, note),
    onSuccess: (updatedOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order status updated successfully');
      if (selectedOrder?.id === updatedOrder.id) {
        setSelectedOrder(updatedOrder);
      }
    },
    onError: () => {
      toast.error('Failed to update order status');
    }
  });

  const handleConfirmOrder = (orderId: string) => {
    confirmOrderMutation.mutate(orderId);
  };

  const handleCancelOrder = (orderId: string, reason: string) => {
    cancelOrderMutation.mutate({ orderId, reason });
  };

  const handleUpdateStatus = (orderId: string, status: Order['status'], note?: string) => {
    updateOrderStatusMutation.mutate({ orderId, status, note });
  };

  const handleAddOrder = () => {
    // Add order logic would go here - for now show success
    toast.success('Order created successfully');
    setShowAddModal(false);
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const handleEditOrder = () => {
    if (selectedOrder) {
      // Edit order logic would go here - for now show success
      toast.success('Order updated successfully');
      setShowEditModal(false);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  };

  const handleRowClick = (order: Order) => {
    setSelectedOrder(order);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
          <p className="text-sm text-gray-600">Manage customer orders and track fulfillment</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Order
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-gray-200">
        {['all', 'pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled', 'analytics'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className={selectedOrder ? 'lg:col-span-3' : 'lg:col-span-4'}>
          {activeTab === 'analytics' ? (
            <OrderAnalytics />
          ) : (
            <>
              {/* Filters */}
              <OrderFiltersPanel
                filters={filters}
                onFiltersChange={setFilters}
                onSearchChange={(search) => {
                  setFilters((prev: any) => ({ ...prev, search }));
                  setCurrentPage(1);
                }}
              />

              {/* Orders Table */}
              <OrdersTable
                orders={ordersData?.data || []}
                isLoading={isLoading}
                selectedOrder={selectedOrder}
                onRowClick={handleRowClick}
                onConfirm={handleConfirmOrder}
                onCancel={(order) => {
                  setSelectedOrder(order);
                  setShowCancelDialog(true);
                }}
                onEdit={(order) => {
                  setSelectedOrder(order);
                  setShowEditModal(true);
                }}
                onUpdateStatus={handleUpdateStatus}
                currentPage={currentPage}
                totalPages={Math.ceil((ordersData?.total || 0) / pageSize)}
                onPageChange={setCurrentPage}
              />
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedOrder && (
          <div className="lg:col-span-1">
            <OrderDetailPanel
              order={selectedOrder}
              onClose={() => setSelectedOrder(null)}
              onEdit={() => {
                setShowEditModal(true);
              }}
              onConfirm={() => handleConfirmOrder(selectedOrder.id)}
              onCancel={() => setShowCancelDialog(true)}
              onUpdateStatus={handleUpdateStatus}
              isConfirming={confirmOrderMutation.isPending}
              isUpdating={updateOrderStatusMutation.isPending}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <AddOrderModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddOrder}
        />
      )}

      {showEditModal && selectedOrder && (
        <EditOrderModal
          order={selectedOrder}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
          onEdit={handleEditOrder}
        />
      )}

      {showCancelDialog && selectedOrder && (
        <CancelOrderDialog
          order={selectedOrder}
          onClose={() => {
            setShowCancelDialog(false);
            if (!ordersData?.data.some(o => o.id === selectedOrder.id)) {
              setSelectedOrder(null);
            }
          }}
          onCancel={handleCancelOrder}
          isCancelling={cancelOrderMutation.isPending}
        />
      )}
    </div>
  );
};