import React from 'react';
import { X, ShoppingCart, User, MapPin, CreditCard, Clock, Package } from 'lucide-react';
import type { Order } from '../../types';
import { Badge } from '../Badge';
import { Button } from '../Button';

interface OrderDetailPanelProps {
  order: Order;
  onClose: () => void;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onUpdateStatus: (orderId: string, status: Order['status'], note?: string) => void;
  isConfirming?: boolean;
  isUpdating?: boolean;
}

const getStatusBadgeVariant = (status: Order['status']) => {
  switch (status) {
    case 'pending':
      return 'warning';
    case 'confirmed':
      return 'info';
    case 'processing':
      return 'neutral';
    case 'ready':
      return 'success';
    case 'delivered':
      return 'success';
    case 'cancelled':
      return 'error';
    default:
      return 'neutral';
  }
};

const getPaymentStatusBadgeVariant = (paymentStatus: Order['paymentStatus']) => {
  switch (paymentStatus) {
    case 'paid':
      return 'success';
    case 'pending':
      return 'warning';
    case 'processing':
      return 'info';
    case 'failed':
      return 'error';
    default:
      return 'neutral';
  }
};

export const OrderDetailPanel: React.FC<OrderDetailPanelProps> = ({
  order,
  onClose,
  onEdit,
  onConfirm,
  onCancel,
  onUpdateStatus,
  isConfirming = false,
  isUpdating = false
}) => {
  const canConfirm = order.status === 'pending';
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const canUpdateToProcessing = order.status === 'confirmed';
  const canUpdateToReady = order.status === 'processing';
  const canMarkAsDelivered = order.status === 'ready';

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Order Details</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Order Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Order #{order.orderNumber}</h3>
                <p className="text-sm text-gray-500">{order.id.slice(0, 8)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Status</p>
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">Payment</p>
                <div className="mt-1">
                  <Badge variant={getPaymentStatusBadgeVariant(order.paymentStatus)}>
                    {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Information
            </h4>
            <div className="space-y-2 text-sm">
              <p className="text-gray-900">{order.customerName}</p>
              {order.customerEmail && (
                <p className="text-gray-600">{order.customerEmail}</p>
              )}
              {order.customerPhone && (
                <p className="text-gray-600">{order.customerPhone}</p>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          {order.shippingAddress && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Shipping Address
              </h4>
              <p className="text-sm text-gray-600 whitespace-pre-line">{order.shippingAddress}</p>
            </div>
          )}

          {/* Billing Address */}
          {order.billingAddress && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Billing Address
              </h4>
              <p className="text-sm text-gray-600 whitespace-pre-line">{order.billingAddress}</p>
            </div>
          )}

          {/* Order Items */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Items ({order.items.length})
            </h4>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: order.currency || 'USD'
                      }).format(item.total)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: order.currency || 'USD'
                      }).format(item.price)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-gray-900 mb-3">Order Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: order.currency || 'USD'
                  }).format(order.subtotal)}
                </span>
              </div>
              {order.taxAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: order.currency || 'USD'
                    }).format(order.taxAmount)}
                  </span>
                </div>
              )}
              {order.shippingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: order.currency || 'USD'
                    }).format(order.shippingCost)}
                  </span>
                </div>
              )}
              {order.discountAmount && order.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium text-red-600">
                    -{new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: order.currency || 'USD'
                    }).format(order.discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="font-bold text-lg">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: order.currency || 'USD'
                  }).format(order.totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          {order.timeline && order.timeline.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Order Timeline
              </h4>
              <div className="space-y-3">
                {order.timeline.map((event, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-shrink-0">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${event.status === 'current' ? 'bg-blue-100' :
                        event.status === 'completed' ? 'bg-green-100' :
                          event.status === 'failed' ? 'bg-red-100' : 'bg-gray-100'
                        }`}>
                        <div className={`h-3 w-3 rounded-full ${event.status === 'current' ? 'bg-blue-500' :
                          event.status === 'completed' ? 'bg-green-500' :
                            event.status === 'failed' ? 'bg-red-500' : 'bg-gray-400'
                          }`} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{event.note || event.status}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                      {event.note && (
                        <p className="text-xs text-gray-600 mt-1">{event.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {(order.notes || order.internalNotes) && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="font-medium text-gray-900 mb-3">Notes</h4>
              {order.notes && (
                <div className="mb-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Customer Notes</p>
                  <p className="text-sm text-gray-700">{order.notes}</p>
                </div>
              )}
              {order.internalNotes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Internal Notes</p>
                  <p className="text-sm text-gray-700">{order.internalNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-gray-200 space-y-3">
        <div className="flex gap-2">
          <Button
            onClick={onEdit}
            className="flex-1"
            variant="outline"
          >
            Edit Order
          </Button>
        </div>

        {canConfirm && (
          <Button
            onClick={onConfirm}
            className="w-full"
            disabled={isConfirming}
          >
            {isConfirming ? 'Confirming...' : 'Confirm Order'}
          </Button>
        )}

        {canUpdateToProcessing && (
          <Button
            onClick={() => onUpdateStatus(order.id, 'processing', 'Order moved to processing')}
            className="w-full"
            disabled={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Start Processing'}
          </Button>
        )}

        {canUpdateToReady && (
          <Button
            onClick={() => onUpdateStatus(order.id, 'ready', 'Order is ready for delivery')}
            className="w-full"
            disabled={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Mark as Ready'}
          </Button>
        )}

        {canMarkAsDelivered && (
          <Button
            onClick={() => onUpdateStatus(order.id, 'delivered', 'Order delivered successfully')}
            className="w-full"
            disabled={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Mark as Delivered'}
          </Button>
        )}

        {canCancel && (
          <Button
            onClick={onCancel}
            className="w-full"
            variant="destructive"
          >
            Cancel Order
          </Button>
        )}
      </div>
    </div>
  );
};