import React from 'react';
import {
  CreditCard,
  Trash2,
  Plus,
  Star,
  CheckCircle2,
  Lock
} from 'lucide-react';

type SavedCard = {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isPrimary: boolean;
  type: string;
};

type PaymentCardTokenManagerProps = {
  cards: SavedCard[];
  onSetPrimary: (id: string) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
};

export const PaymentCardTokenManager: React.FC<PaymentCardTokenManagerProps> = ({
  cards,
  onSetPrimary,
  onDelete,
  onAddNew,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-1">
        <div>
          <h3 className="text-lg font-black text-gray-900">Saved Cards</h3>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-0.5">PCI-DSS Compliant Tokens</p>
        </div>
        <button
          onClick={onAddNew}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Card
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`relative group bg - white p - 5 rounded - 2xl border - 2 transition - all ${card.isPrimary ? 'border-blue-600 shadow-xl shadow-blue-50' : 'border-gray-100 hover:border-gray-200'
              } `}
          >
            <div className="flex justify-between items-start mb-6">
              <div className={`p - 2 rounded - lg ${card.isPrimary ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'} `}>
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!card.isPrimary && (
                  <button
                    onClick={() => onSetPrimary(card.id)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Set as Primary"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onDelete(card.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete Card"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xl font-black text-gray-900 tracking-widest font-mono">
                  •••• •••• •••• {card.last4}
                </div>
                {card.isPrimary && (
                  <span className="flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-black uppercase">
                    Primary
                  </span>
                )}
              </div>

              <div className="flex justify-between items-end">
                <div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Expires</div>
                  <div className="text-sm font-bold text-gray-900">{card.expiry}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Brand</div>
                  <div className="text-sm font-bold text-gray-900 capitalize">{card.brand} {card.type}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6">
        <div className="flex items-center mb-4">
          <div className="p-2 bg-emerald-100 rounded-lg mr-3 text-emerald-600">
            <Lock className="w-5 h-5" />
          </div>
          <h4 className="text-sm font-black text-emerald-900 uppercase tracking-widest">Security Standards</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-start">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-800 font-medium">
              Data is tokenized according to PCI-DSS standards.
            </div>
          </div>
          <div className="flex items-start">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-800 font-medium">
              We never store full card numbers or CVV on our servers.
            </div>
          </div>
          <div className="flex items-start">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mr-2 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-800 font-medium">
              All transactions are secured with 256-bit AES encryption.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
