import React, { useState } from 'react';
import {
  X,
  Link as LinkIcon,
  Copy,
  QrCode,
  Send,
  CheckCircle2,
  Smartphone,
  Calendar,
  BarChart2,
  Trash2,
  RefreshCw
} from 'lucide-react';
import type { PaymentLink } from '../../types';

type PaymentLinkDialogProps = {
  orderId: string;
  amount: number;
  currentLink?: PaymentLink;
  onGenerate: () => void;
  onCancel: (id: string) => void;
  onSendSMS: (id: string, phone: string) => void;
  onClose: () => void;
};

export const PaymentLinkDialog: React.FC<PaymentLinkDialogProps> = ({
  orderId,
  currentLink,
  onGenerate,
  onCancel,
  onSendSMS,
  onClose,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (currentLink?.link) {
      navigator.clipboard.writeText(currentLink.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center text-blue-600">
            <LinkIcon className="w-5 h-5 mr-2" />
            <h2 className="text-lg font-bold">Payment Link Management</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {!currentLink ? (
            <div className="text-center py-8 space-y-6">
              <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
                <LinkIcon className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">No active link found</h3>
                <p className="text-gray-500 mt-2">
                  Generate a secure payment link for order <span className="font-bold text-gray-900">#{orderId}</span>.
                </p>
              </div>
              <button
                onClick={onGenerate}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate Payment Link
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Payment URL</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${currentLink.status === 'pending' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                      }`}>
                      {currentLink.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="bg-white border border-blue-200 p-3 rounded-lg text-sm font-mono truncate flex-1 text-blue-800">
                      {currentLink.link}
                    </div>
                    <button
                      onClick={handleCopy}
                      className={`p-3 rounded-lg transition-all ${copied ? 'bg-green-500 text-white' : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50'
                        }`}
                    >
                      {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center text-xs text-gray-500 mb-1">
                      <Calendar className="w-3 h-3 mr-1" />
                      Expires At
                    </div>
                    <div className="text-sm font-bold text-gray-900">
                      {new Date(currentLink.expiresAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center text-xs text-gray-500 mb-1">
                      <BarChart2 className="w-3 h-3 mr-1" />
                      Times Sent
                    </div>
                    <div className="text-sm font-bold text-gray-900">{currentLink.sentCount}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Send to Customer</h3>
                  <button
                    onClick={() => setShowQR(!showQR)}
                    className="text-xs font-bold text-blue-600 flex items-center hover:underline"
                  >
                    <QrCode className="w-3 h-3 mr-1" />
                    {showQR ? 'Hide QR Code' : 'Show QR Code'}
                  </button>
                </div>

                {showQR && (
                  <div className="flex flex-col items-center p-4 bg-white border border-gray-200 rounded-xl animate-in slide-in-from-top-2 duration-200">
                    <div className="bg-gray-50 p-4 rounded-lg mb-2">
                      <QrCode className="w-32 h-32 text-gray-900" />
                    </div>
                    <span className="text-xs text-gray-500">Scan to open payment page</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      placeholder="Customer Phone (e.g. +91 9876543210)"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                  </div>
                  <button
                    onClick={() => onSendSMS(currentLink.id, phoneNumber)}
                    disabled={!phoneNumber}
                    className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 transition-all flex items-center justify-center"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send via SMS
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {currentLink && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
            <button
              onClick={() => onCancel(currentLink.id)}
              className="text-sm font-bold text-red-600 flex items-center hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Cancel Link
            </button>
            <div className="text-xs text-gray-400">
              ID: {currentLink.id}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
