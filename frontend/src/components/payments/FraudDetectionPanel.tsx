import React from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Zap,
  MapPin,
  Monitor,
  Activity,
  UserCheck,
  Flag,
  UserX
} from 'lucide-react';
import type { FraudCheck } from '../../types';

type FraudDetectionPanelProps = {
  fraudCheck?: FraudCheck;
  onReportFraud: () => void;
  onWhitelist: () => void;
  onBlacklist: () => void;
};

export const FraudDetectionPanel: React.FC<FraudDetectionPanelProps> = ({
  fraudCheck,
  onReportFraud,
  onWhitelist,
  onBlacklist,
}) => {
  if (!fraudCheck) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
        <Shield className="w-12 h-12 text-gray-200 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Fraud Analysis Available</h3>
        <p className="text-gray-500 mt-2">Analysis will be available once the payment is processed.</p>
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600';
      case 'medium': return 'text-yellow-600';
      case 'high': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getRiskBg = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-50 border-green-100';
      case 'medium': return 'bg-yellow-50 border-yellow-100';
      case 'high': return 'bg-red-50 border-red-100';
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  const riskIndicators = [
    { key: 'unusualAmount', label: 'Unusual Amount', icon: <Zap className="w-4 h-4" />, desc: 'Transaction amount is significantly higher than user average' },
    { key: 'velocityCheck', label: 'Velocity Check', icon: <Activity className="w-4 h-4" />, desc: 'Too many transactions from this user in a short period' },
    { key: 'geographicMismatch', label: 'Geographic Mismatch', icon: <MapPin className="w-4 h-4" />, desc: 'IP address location does not match billing address' },
    { key: 'deviceMismatch', label: 'Device Mismatch', icon: <Monitor className="w-4 h-4" />, desc: 'Transaction from an unrecognized or blacklisted device' },
    { key: 'cardTestingPattern', label: 'Card Testing Pattern', icon: <Shield className="w-4 h-4" />, desc: 'Multiple failed small transactions followed by success' },
  ];

  return (
    <div className="space-y-6">
      {/* Risk Summary Card */}
      <div className={`rounded-2xl border-2 p-6 flex flex-col md:flex-row items-center justify-between ${getRiskBg(fraudCheck.riskLevel)} shadow-sm`}>
        <div className="flex items-center mb-4 md:mb-0">
          <div className={`p-4 rounded-full mr-4 ${
            fraudCheck.riskLevel === 'high' ? 'bg-red-100 text-red-600' :
            fraudCheck.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-600' :
            'bg-green-100 text-green-600'
          }`}>
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm font-bold uppercase tracking-widest opacity-70">Fraud Risk Level</div>
            <div className={`text-3xl font-black uppercase ${getRiskColor(fraudCheck.riskLevel)}`}>
              {fraudCheck.riskLevel} Risk
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end">
          <div className="text-4xl font-black text-gray-900 mb-1">{fraudCheck.riskScore}</div>
          <div className="text-xs font-bold text-gray-500 uppercase">Risk Score / 100</div>
        </div>
      </div>

      {/* Recommendation Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center">
            <Info className="w-4 h-4 mr-2 text-blue-600" />
            Decision Recommendation
          </h3>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
            fraudCheck.recommendation === 'block' ? 'bg-red-600 text-white' :
            fraudCheck.recommendation === 'review' ? 'bg-yellow-500 text-white' :
            'bg-green-600 text-white'
          }`}>
            {fraudCheck.recommendation}
          </span>
        </div>
        <div className="p-6">
          <p className="text-gray-600 text-sm leading-relaxed">
            Based on our automated analysis, we recommend <span className="font-bold text-gray-900">{fraudCheck.recommendation.toUpperCase()}</span> this transaction. 
            {fraudCheck.recommendation === 'block' && " High risk indicators detected suggest potential fraudulent activity."}
            {fraudCheck.recommendation === 'review' && " Some anomalies were detected that require manual verification."}
            {fraudCheck.recommendation === 'allow' && " No significant risk indicators were found for this transaction."}
          </p>
        </div>
      </div>

      {/* Indicators List */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 px-1">Detailed Risk Indicators</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {riskIndicators.map((indicator) => {
            const isDetected = (fraudCheck.checks as any)[indicator.key];
            return (
              <div 
                key={indicator.key}
                className={`p-4 rounded-xl border transition-all ${
                  isDetected 
                    ? 'bg-red-50 border-red-200 shadow-sm' 
                    : 'bg-white border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-center mb-2">
                  <div className={`p-1.5 rounded-lg mr-3 ${isDetected ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'}`}>
                    {indicator.icon}
                  </div>
                  <span className={`font-bold text-sm ${isDetected ? 'text-red-800' : 'text-gray-700'}`}>
                    {indicator.label}
                  </span>
                  {isDetected ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 ml-auto" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                  )}
                </div>
                <p className="text-xs text-gray-500 leading-tight">
                  {indicator.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="pt-4 flex flex-wrap gap-3">
        <button
          onClick={onWhitelist}
          className="flex-1 min-w-[150px] flex items-center justify-center py-3 px-4 bg-green-50 text-green-700 rounded-xl font-bold hover:bg-green-100 transition-colors border border-green-200"
        >
          <UserCheck className="w-4 h-4 mr-2" />
          Whitelist Customer
        </button>
        <button
          onClick={onBlacklist}
          className="flex-1 min-w-[150px] flex items-center justify-center py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors border border-gray-200"
        >
          <UserX className="w-4 h-4 mr-2" />
          Blacklist Customer
        </button>
        <button
          onClick={onReportFraud}
          className="w-full flex items-center justify-center py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
        >
          <Flag className="w-4 h-4 mr-2" />
          Report & Mark as Fraud
        </button>
      </div>
    </div>
  );
};
