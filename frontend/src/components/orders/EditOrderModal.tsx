import React, { useState, useEffect } from 'react';
import { User, MapPin, Package } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import type { Order, OrderItem } from '../../types';

interface EditOrderModalProps {
  order: Order;
  onClose: () => void;
  onEdit: (orderData: Partial<Omit<Order, 'id' | 'createdAt' | 'updatedAt'>>) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, onClose, onEdit }) => {
  const [shippingAddress, setShippingAddress] = useState(order.shippingAddress || '');
  const [billingAddress, setBillingAddress] = useState(order.billingAddress || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [internalNotes, setInternalNotes] = useState(order.internalNotes || '');
  const [items, setItems] = useState<OrderItem[]>(order.items);
  const [estimatedDelivery, setEstimatedDelivery] = useState(order.estimatedDelivery || '');

  useEffect(() => {
    setShippingAddress(order.shippingAddress || '');
    setBillingAddress(order.billingAddress || '');
    setNotes(order.notes || '');
    setInternalNotes(order.internalNotes || '');
    setItems(order.items);
    setEstimatedDelivery(order.estimatedDelivery || '');
  }, [order]);

  const handleItemChange = (id: string, field: keyof OrderItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updatedItem = {
          ...item,
          [field]: field === 'quantity' || field === 'price' ? Number(value) : value
        };
        updatedItem.total = updatedItem.quantity * updatedItem.price;
        return updatedItem;
      }
      return item;
    }));
  };

  const handleSubmit = () => {
    const orderData: Partial<Omit<Order, 'id' | 'createdAt' | 'updatedAt'>> = {
      shippingAddress: shippingAddress || undefined,
      billingAddress: billingAddress || undefined,
      notes: notes || undefined,
      internalNotes: internalNotes || undefined,
      items,
      estimatedDelivery: estimatedDelivery || undefined,
      subtotal: items.reduce((sum, item) => sum + item.total, 0),
      totalAmount: items.reduce((sum, item) => sum + item.total, 0) + order.taxAmount + order.shippingCost - (order.discountAmount || 0)
    };

    onEdit(orderData);
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalAmount = subtotal + order.taxAmount + order.shippingCost - (order.discountAmount || 0);

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Order">
      <div className="max-h-[80vh] overflow-y-auto p-6">
        {/* Customer Info (Read-only) */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Information
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-1">
            <p className="text-sm"><span className="font-medium">Name:</span> {order.customerName}</p>
            {order.customerEmail && (
              <p className="text-sm"><span className="font-medium">Email:</span> {order.customerEmail}</p>
            )}
            {order.customerPhone && (
              <p className="text-sm"><span className="font-medium">Phone:</span> {order.customerPhone}</p>
            )}
          </div>
        </div>

        {/* Status Info */}
        <div className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Status</label>
              <input
                type="text"
                value={(order.status || 'unknown').charAt(0).toUpperCase() + (order.status || 'unknown').slice(1)}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
              <input
                type="text"
                value={(order.paymentStatus || 'unknown').charAt(0).toUpperCase() + (order.paymentStatus || 'unknown').slice(1)}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Addresses
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Shipping Address</label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                placeholder="123 Main St, City, State 12345"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Address</label>
              <textarea
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                placeholder="123 Main St, City, State 12345"
              />
            </div>
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Order Items
          </h3>

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3 items-start p-3 border border-gray-200 rounded-lg">
                <div className="flex-1">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                    placeholder="Item name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={item.quantity || 1}
                      onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Qty"
                      min="1"
                    />
                    <input
                      type="number"
                      value={item.price || 0}
                      onChange={(e) => handleItemChange(item.id, 'price', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Price"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>

                <div className="text-right min-w-[80px]">
                  <p className="text-sm font-medium">
                    ${item.total.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Estimated Delivery */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Delivery Date</label>
          <input
            type="date"
            value={estimatedDelivery}
            onChange={(e) => setEstimatedDelivery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Order Summary */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-3">Order Summary</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax:</span>
              <span>${order.taxAmount.toFixed(2)}</span>
            </div>
            {order.shippingCost > 0 && (
              <div className="flex justify-between text-sm">
                <span>Shipping:</span>
                <span>${order.shippingCost.toFixed(2)}</span>
              </div>
            )}
            {order.discountAmount && order.discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span>Discount:</span>
                <span className="text-red-600">-${order.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total:</span>
              <span className="text-lg">${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
            placeholder="Special instructions or notes..."
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
            placeholder="Internal notes (not visible to customer)..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 p-6 border-t">
        <Button onClick={onClose} variant="outline">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={items.some(item => !item.name || item.price <= 0 || item.quantity <= 0)}
        >
          Save Changes
        </Button>
      </div>
    </Modal>
  );
};