import React from 'react';
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Wallet, 
  Link as LinkIcon, 
  Banknote,
  Check,
  QrCode,
  Copy,
  Send
} from 'lucide-react';

type PaymentMethod = 'card' | 'upi' | 'net_banking' | 'wallet' | 'link' | 'cod';

type PaymentMethodSelectorProps = {
  selectedMethod: PaymentMethod;
  onMethodSelect: (method: PaymentMethod) => void;
  methodData?: {
    card?: { last4: string; brand: string };
    upi?: { id: string; qrCode?: string };
    link?: { url: string; expiresAt: string };
  };
};

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onMethodSelect,
  methodData,
}) => {
  const methods: { id: PaymentMethod; label: string; icon: React.ReactNode; description: string }[] = [
    { id: 'card', label: 'Credit/Debit Card', icon: <CreditCard className="w-5 h-5" />, description: 'Visa, Mastercard, etc.' },
    { id: 'upi', label: 'UPI / QR', icon: <Smartphone className="w-5 h-5" />, description: 'Google Pay, PhonePe, etc.' },
    { id: 'net_banking', label: 'Net Banking', icon: <Building2 className="w-5 h-5" />, description: 'All major banks supported' },
    { id: 'wallet', label: 'Digital Wallets', icon: <Wallet className="w-5 h-5" />, description: 'Amazon Pay, Paytm, etc.' },
    { id: 'link', label: 'Payment Link', icon: <LinkIcon className="w-5 h-5" />, description: 'Send link via SMS/Email' },
    { id: 'cod', label: 'Cash on Delivery', icon: <Banknote className="w-5 h-5" />, description: 'Pay when order arrives' },
  ];

  const handleCopyLink = () => {
    if (methodData?.link?.url) {
      navigator.clipboard.writeText(methodData.link.url);
      // Would normally show a toast here
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {methods.map((method) => (
          <button
            key={method.id}
            onClick={() => onMethodSelect(method.id)}
            className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
              selectedMethod === method.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-100 bg-white hover:border-gray-200'
            }`}
          >
            <div className={`p-2 rounded-full mb-3 ${
              selectedMethod === method.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}>
              {method.icon}
            </div>
            <span className={`text-sm font-bold ${
              selectedMethod === method.id ? 'text-blue-700' : 'text-gray-900'
            }`}>
              {method.label}
            </span>
            <span className="text-xs text-gray-500 mt-1 text-center">{method.description}</span>
            {selectedMethod === method.id && (
              <div className="absolute top-2 right-2">
                <Check className="w-4 h-4 text-blue-600" />
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
        <h3 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Method Configuration</h3>
        
        {selectedMethod === 'card' && (
          <div className="flex items-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <CreditCard className="w-10 h-10 text-blue-600 mr-4" />
            <div>
              <div className="text-sm font-bold text-gray-900">
                {methodData?.card?.brand || 'Visa'} ending in •••• {methodData?.card?.last4 || '4242'}
              </div>
              <div className="text-xs text-gray-500">Securely tokenized (PCI-DSS Compliant)</div>
            </div>
          </div>
        )}

        {selectedMethod === 'upi' && (
          <div className="space-y-4">
            <div className="flex items-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <Smartphone className="w-10 h-10 text-green-600 mr-4" />
              <div className="flex-1">
                <div className="text-sm text-gray-500">UPI ID</div>
                <div className="text-base font-bold text-gray-900">{methodData?.upi?.id || 'customer@okaxis'}</div>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-full">
                <Copy className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="flex flex-col items-center bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <QrCode className="w-32 h-32 text-gray-900 mb-2" />
              <span className="text-sm font-medium text-gray-700">Scan QR to Pay</span>
            </div>
          </div>
        )}

        {selectedMethod === 'link' && (
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="text-xs text-gray-500 mb-1">Payment URL</div>
              <div className="flex items-center">
                <div className="bg-gray-50 p-2 rounded border border-gray-200 text-xs font-mono truncate flex-1 mr-2">
                  {methodData?.link?.url || 'https://pay.cto.new/L_7823945'}
                </div>
                <button 
                  onClick={handleCopyLink}
                  className="p-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[10px] text-gray-400 mt-2 italic">
                Expires: {methodData?.link?.expiresAt || 'Tomorrow, 10:00 AM'}
              </div>
            </div>
            <button className="w-full flex items-center justify-center py-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              <Send className="w-4 h-4 mr-2" />
              Send Link via SMS
            </button>
          </div>
        )}

        {['net_banking', 'wallet', 'cod'].includes(selectedMethod) && (
          <div className="text-center py-6 text-gray-500 italic text-sm">
            No additional configuration required for this method.
          </div>
        )}
      </div>
    </div>
  );
};
