import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => {
        const isErr = toast.type === 'error';
        const isSuccess = toast.type === 'success';

        return (
          <div
            key={toast.id}
            role="alert"
            aria-live="assertive"
            className={`pointer-events-auto flex items-start justify-between p-4 border shadow-lg transition-all animate-slide-up ${
              isErr
                ? 'bg-rose-950 text-white border-rose-800'
                : isSuccess
                ? 'bg-[#1C1917] text-white border-emerald-600'
                : 'bg-stone-900 text-white border-stone-700'
            }`}
          >
            <div className="flex items-start space-x-3 pr-2">
              {isErr ? (
                <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs uppercase tracking-wider">{toast.title}</h4>
                {toast.message && <p className="text-xs text-stone-300 font-serif">{toast.message}</p>}
              </div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 text-stone-400 hover:text-white"
              aria-label="Fechar notificação"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
