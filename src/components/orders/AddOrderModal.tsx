import React, { useState } from 'react';
import { X, Plus, ShoppingCart, User, MapPin, CreditCard } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import type { Order, OrderItem } from '../../types';

interface AddOrderModalProps {
  onClose: () => void;
  onAdd: (orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'>) => void;
}

export const AddOrderModal: React.FC<AddOrderModalProps> = ({ onClose, onAdd }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<OrderItem[]>([
    { id: '1', name: '', quantity: 1, price: 0, total: 0 }
  ]);

  const handleAddItem = () => {
    setItems([...items, { 
      id: Date.now().toString(), 
      name: '', 
      quantity: 1, 
      price: 0, 
      total: 0 
    }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

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

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * 0.1; // 10% tax
  const shippingCost = shippingAddress ? 9.99 : 0;
  const totalAmount = subtotal + taxAmount + shippingCost;

  const handleSubmit = () => {
    const orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'orderNumber'> = {
      customerId: Date.now().toString(),
      customerName,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      shippingAddress: shippingAddress || undefined,
      billingAddress: billingAddress || undefined,
      items,
      subtotal,
      taxAmount,
      shippingCost,
      totalAmount,
      currency: 'USD',
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'card',
      notes: notes || undefined,
      teamId: 'team-123',
      orderNumber: `ORD-${Date.now()}`
    };

    onAdd(orderData);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Add New Order">
      <div className="max-h-[80vh] overflow-y-auto p-6">
        {/* Customer Information */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="John Doe"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="john@example.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
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
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Order Items
            </h3>
            <Button onClick={handleAddItem} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Item
            </Button>
          </div>
          
          <div className="space-y-3">
            {items.map((item, index) => (
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
                
                {items.length > 1 && (
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-red-500 hover:text-red-700 mt-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                
                <div className="text-right min-w-[80px]">
                  <p className="text-sm font-medium">
                    ${item.total.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax (10%):</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
            {shippingCost > 0 && (
              <div className="flex justify-between text-sm">
                <span>Shipping:</span>
                <span>${shippingCost.toFixed(2)}</span>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Order Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
            placeholder="Special instructions or notes..."
          />
        </div>
      </div>
      
      <div className="flex justify-end gap-3 p-6 border-t">
        <Button onClick={onClose} variant="outline">
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit}
          disabled={!customerName || items.some(item => !item.name || item.price <= 0)}
        >
          Create Order
        </Button>
      </div>
    </Modal>
  );
};