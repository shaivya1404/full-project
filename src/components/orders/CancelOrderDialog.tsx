import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import type { Order } from '../../types';

interface CancelOrderDialogProps {
  order: Order;
  onClose: () => void;
  onCancel: (orderId: string, reason: string) => void;
  isCancelling?: boolean;
}

export const CancelOrderDialog: React.FC<CancelOrderDialogProps> = ({
  order,
  onClose,
  onCancel,
  isCancelling = false
}) => {
  const [reason, setReason] = useState('');
  const [selectedReason, setSelectedReason] = useState('');

  const commonReasons = [
    'Customer requested cancellation',
    'Out of stock',
    'Payment failed',
    'Fraudulent order',
    'Shipping address issue',
    'Other'
  ];

  const handleSubmit = () => {
    const finalReason = selectedReason === 'Other' ? reason : selectedReason;
    if (finalReason.trim()) {
      onCancel(order.id, finalReason.trim());
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Cancel Order">
      <div className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0">
            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              Cancel Order #{order.orderNumber}
            </h3>
            <p className="text-sm text-gray-600">
              Are you sure you want to cancel this order? This action cannot be undone.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for cancellation *
          </label>
          
          <div className="space-y-2 mb-3">
            {commonReasons.map((option) => (
              <label key={option} className="flex items-center">
                <input
                  type="radio"
                  value={option}
                  checked={selectedReason === option}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">{option}</span>
              </label>
            ))}
          </div>

          {selectedReason === 'Other' && (
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
              placeholder="Please specify the reason for cancellation..."
            />
          )}
        </div>

        <div className="mt-6 bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">Order Details</h4>
          <div className="space-y-1 text-sm">
            <p><span className="font-medium">Order:</span> #{order.orderNumber}</p>
            <p><span className="font-medium">Customer:</span> {order.customerName}</p>
            <p><span className="font-medium">Amount:</span> ${order.totalAmount.toFixed(2)}</p>
            <p><span className="font-medium">Status:</span> {order.status}</p>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-3 p-6 border-t">
        <Button onClick={onClose} variant="outline">
          Keep Order
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={!selectedReason || (selectedReason === 'Other' && !reason.trim()) || isCancelling}
          variant="destructive"
        >
          {isCancelling ? 'Cancelling...' : 'Cancel Order'}
        </Button>
      </div>
    </Modal>
  );
};