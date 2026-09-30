import React from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  details,
  confirmText = 'Confirm & Implement',
  cancelText = 'Cancel',
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800">
        {/* Header */}
        <div className={`p-5 flex items-start gap-4 ${isDestructive ? 'bg-amber-50 border-b border-amber-100' : 'bg-blue-50/50 border-b border-blue-100/50'}`}>
          <div className={`p-2.5 rounded-xl ${isDestructive ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {isDestructive ? <AlertTriangle className="w-6 h-6" /> : <CheckCircle className="w-6 h-6" />}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            <p className="text-sm text-slate-600 mt-0.5">{message}</p>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Details list if provided */}
        {details && details.length > 0 && (
          <div className="p-5 max-h-60 overflow-y-auto bg-slate-50 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Affected Items / Details:</p>
            <ul className="space-y-1 text-sm text-slate-700">
              {details.slice(0, 10).map((d, i) => (
                <li key={i} className="flex items-center gap-2 font-mono text-xs bg-white px-2.5 py-1.5 rounded border border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  {d}
                </li>
              ))}
              {details.length > 10 && (
                <li className="text-xs text-slate-500 italic pt-1">
                  + {details.length - 10} more items...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-5 py-2 text-sm font-medium text-white rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer ${
              isDestructive
                ? 'bg-amber-600 hover:bg-amber-700 focus:ring-4 focus:ring-amber-200'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-200'
            } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Updating Google Sheet...</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
