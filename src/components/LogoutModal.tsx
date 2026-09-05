import React from 'react';
import { LogOut, X } from 'lucide-react';
import { GlowingEdgeCard } from './GlowingEdgeCard';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName?: string;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  userName,
}) => {
  if (!isOpen) return null;

  return (
    <div
      id="logout-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
        <GlowingEdgeCard
          glowColor="#ef4444"
          className="p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.85)] text-white relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-violet-400/60 hover:text-white p-1 rounded-lg hover:bg-violet-800/30 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center flex-shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Logout</h3>
              <p className="text-xs text-violet-300/70">Confirm session termination</p>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-violet-200/90 leading-relaxed mb-6">
            Are you sure you want to logout?
          </p>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-violet-900/30">
            <button
              type="button"
              id="logout-cancel-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#120e24] hover:bg-[#1a1433] text-violet-300 text-xs font-semibold transition border border-violet-900/40 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="logout-confirm-btn"
              onClick={onConfirm}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-[0_0_20px_rgba(239,68,68,0.4)] cursor-pointer"
            >
              Logout
            </button>
          </div>
        </GlowingEdgeCard>
      </div>
    </div>
  );
};
