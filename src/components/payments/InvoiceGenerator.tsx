import React, { useState } from 'react';
import { 
  FileText, 
  Download, 
  Send, 
  Plus, 
  Trash2, 
  Mail, 
  Smartphone,
  Check,
  Eye,
  Settings,
  X
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import type { Payment, OrderItem } from '../../types';

type InvoiceGeneratorProps = {
  payment: Payment;
  items: OrderItem[];
  onGenerate: (data: any) => void;
  onPreview: (data: any) => void;
  onClose: () => void;
};

export const InvoiceGenerator: React.FC<InvoiceGeneratorProps> = ({
  payment,
  items: initialItems,
  onGenerate,
  onPreview,
  onClose,
}) => {
  const [items, setItems] = useState<OrderItem[]>(initialItems);
  const [taxRate, setTaxRate] = useState(18);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('Thank you for your business!');
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${Date.now().toString().slice(-6)}`);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const totalAmount = subtotal + taxAmount - discount;

  const handleAddItem = () => {
    const newItem: OrderItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Item',
      quantity: 1,
      price: 0,
      total: 0
    };
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, field: keyof OrderItem, value: any) => {
    const newItems = items.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'price') {
          updatedItem.total = updatedItem.quantity * updatedItem.price;
        }
        return updatedItem;
      }
      return item;
    });
    setItems(newItems);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const invoiceData = {
    paymentId: payment.id,
    orderId: payment.orderId,
    invoiceNumber,
    items,
    taxAmount,
    taxRate,
    discount,
    totalAmount,
    notes,
    dueDate,
    customerName: payment.customerId, // Should ideally be from customer data
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50">
          <div className="flex items-center text-blue-800">
            <FileText className="w-5 h-5 mr-2" />
            <h2 className="text-lg font-bold">Generate Tax Invoice</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-blue-100 rounded-full text-blue-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Billing From</h3>
              <div className="text-sm font-bold text-gray-900">Your Company Name</div>
              <div className="text-xs text-gray-500 mt-1">
                123 Business Avenue, Suite 100<br />
                Silicon Valley, CA 94025<br />
                GSTIN: 29ABCDE1234F1Z5
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Line Items</h3>
              <button 
                onClick={handleAddItem}
                className="flex items-center text-xs font-bold text-blue-600 hover:underline"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left py-2 text-xs font-bold text-gray-400 uppercase">Item Description</th>
                    <th className="text-center py-2 text-xs font-bold text-gray-400 uppercase w-20">Qty</th>
                    <th className="text-right py-2 text-xs font-bold text-gray-400 uppercase w-32">Price</th>
                    <th className="text-right py-2 text-xs font-bold text-gray-400 uppercase w-32">Total</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-4">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium text-gray-900"
                        />
                      </td>
                      <td className="py-4 px-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(item.id, 'quantity', Number(e.target.value))}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-center text-sm"
                        />
                      </td>
                      <td className="py-4 text-right">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => handleUpdateItem(item.id, 'price', Number(e.target.value))}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-right text-sm"
                        />
                      </td>
                      <td className="py-4 text-right text-sm font-bold text-gray-900">
                        {formatCurrency(item.total, payment.currency)}
                      </td>
                      <td className="py-4 text-center">
                        <button 
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-1 text-gray-300 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-gray-100">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes & Terms</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal, payment.currency)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <div className="flex items-center">
                  <span>Tax ({taxRate}%)</span>
                  <button 
                    onClick={() => setTaxRate(taxRate === 18 ? 12 : taxRate === 12 ? 5 : 18)}
                    className="ml-2 p-1 hover:bg-gray-100 rounded"
                  >
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
                <span>{formatCurrency(taxAmount, payment.currency)}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-500">
                <span>Discount</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-24 px-2 py-1 text-right border border-gray-200 rounded text-sm"
                />
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="text-lg font-black text-gray-900">Total Amount</span>
                <span className="text-2xl font-black text-blue-600">{formatCurrency(totalAmount, payment.currency)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-4">
          <button
            onClick={() => onPreview(invoiceData)}
            className="flex-1 min-w-[140px] flex items-center justify-center py-3 px-4 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 bg-white hover:bg-gray-50"
          >
            <Eye className="w-4 h-4 mr-2" />
            Preview PDF
          </button>
          <div className="flex-1 min-w-[280px] flex gap-2">
            <button
              onClick={() => onGenerate(invoiceData)}
              className="flex-1 flex items-center justify-center py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100"
            >
              <Check className="w-4 h-4 mr-2" />
              Generate & Save
            </button>
            <div className="flex border border-blue-600 rounded-xl overflow-hidden">
              <button className="p-3 bg-white text-blue-600 hover:bg-blue-50 border-r border-blue-100" title="Send via Email">
                <Mail className="w-4 h-4" />
              </button>
              <button className="p-3 bg-white text-blue-600 hover:bg-blue-50" title="Send via SMS">
                <Smartphone className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
