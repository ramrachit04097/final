import React from 'react';
import { ToastMessage } from '../types';
import { Info, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      id="toast-notifications-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3"
    >
      {toasts.map((toast) => {
        const isWarning = toast.type === 'warning';
        const isSuccess = toast.type === 'success';

        return (
          <div
            key={toast.id}
            id={`toast-${toast.id}`}
            className="pointer-events-auto flex items-start gap-3 p-4 bg-[#181135] border border-violet-700/50 rounded-2xl shadow-2xl shadow-black/60 text-white transition-all duration-200 animate-fadeIn"
          >
            <div className="mt-0.5 flex-shrink-0">
              {isWarning ? (
                <AlertCircle className="w-5 h-5 text-amber-400" />
              ) : isSuccess ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Info className="w-5 h-5 text-violet-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white">{toast.title}</p>
              {toast.description && (
                <p className="text-[11px] text-violet-300/80 mt-0.5 leading-relaxed">{toast.description}</p>
              )}
            </div>

            <button
              id={`toast-close-btn-${toast.id}`}
              onClick={() => onDismiss(toast.id)}
              className="text-violet-400/60 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              aria-label="Dismiss message"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
