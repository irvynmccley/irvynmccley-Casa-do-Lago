import React from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  confirmStyle?: 'danger' | 'primary';
}

export function ConfirmDialog({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Excluir',
  confirmStyle = 'danger'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const isDanger = confirmStyle === 'danger';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-white/5">
        <div className="p-6">
          <div className={`flex items-center justify-center w-12 h-12 mx-auto rounded-full mb-4 ${isDanger ? 'bg-red-500/10 ring-1 ring-red-500/20' : 'bg-blue-500/10 ring-1 ring-blue-500/20'}`}>
            {isDanger ? (
              <AlertTriangle className="text-red-400" size={24} />
            ) : (
              <HelpCircle className="text-blue-400" size={24} />
            )}
          </div>
          <h3 className="text-lg font-bold text-center text-white mb-2">{title}</h3>
          <p className="text-center text-slate-400 text-sm mb-6">{message}</p>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-slate-800/50 text-slate-300 font-medium rounded-xl hover:bg-slate-700 hover:text-white transition-colors border border-slate-700/50"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onConfirm();
                onCancel();
              }}
              className={`flex-1 px-4 py-2.5 text-white font-medium rounded-xl transition-all shadow-sm ${
                isDanger 
                  ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20 ring-1 ring-red-500/50' 
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 ring-1 ring-blue-500/50'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
