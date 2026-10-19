import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  CreditCard, 
  Heart, 
  Wallet, 
  Banknote, 
  Check, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles,
  Info
} from 'lucide-react';
import { PaymentMethod, RateioType } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface RateioPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRateio?: RateioType;
  initialPaymentMethod?: PaymentMethod;
  onSelect: (rateio: RateioType, paymentMethod: PaymentMethod) => void;
  title?: string;
}

export function RateioPaymentModal({
  isOpen,
  onClose,
  initialRateio = 'Rateio Normal',
  initialPaymentMethod,
  onSelect,
  title = 'Definir Rateio & Forma de Pagamento'
}: RateioPaymentModalProps) {
  const [selectedRateio, setSelectedRateio] = useState<RateioType>(initialRateio || 'Rateio Normal');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | ''>(initialPaymentMethod || '');
  const [step, setStep] = useState<'rateio' | 'payment'>('rateio');

  useEffect(() => {
    if (isOpen) {
      setSelectedRateio(initialRateio || 'Rateio Normal');
      setSelectedMethod(initialPaymentMethod || '');
      // Se já tem método definido, abre mostrando ambas as opções
      setStep(initialPaymentMethod ? 'payment' : 'rateio');
    }
  }, [isOpen, initialRateio, initialPaymentMethod]);

  if (!isOpen) return null;

  const handleChooseRateio = (rateio: RateioType) => {
    setSelectedRateio(rateio);
    setStep('payment');
  };

  const handleChooseMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
    // Dispara a seleção e encerra o modal
    onSelect(selectedRateio, method);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-slate-900 border border-slate-700/70 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl ring-1 ring-white/10 relative overflow-hidden text-slate-100 flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow de fundo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Passo a passo para registro financeiro da despesa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Indicador de Passos */}
        <div className="grid grid-cols-2 gap-2 my-4">
          <button
            type="button"
            onClick={() => setStep('rateio')}
            className={cn(
              "py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border text-center cursor-pointer",
              step === 'rateio'
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/20 shadow-sm"
                : "bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200"
            )}
          >
            <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono">1</span>
            <span>Forma de Rateio</span>
            {selectedRateio && <Check size={12} className="text-emerald-400 ml-1" />}
          </button>

          <button
            type="button"
            onClick={() => setStep('payment')}
            className={cn(
              "py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border text-center cursor-pointer",
              step === 'payment'
                ? "bg-blue-500/20 text-blue-300 border-blue-500/40 ring-1 ring-blue-500/20 shadow-sm"
                : "bg-slate-950/40 text-slate-400 border-slate-800 hover:text-slate-200"
            )}
          >
            <span className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono">2</span>
            <span>Forma de Pagamento</span>
            {selectedMethod && <Check size={12} className="text-blue-400 ml-1" />}
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="overflow-y-auto custom-scrollbar pr-1 flex-1 space-y-4">
          {/* PASSO 1: FORMA DE RATEIO */}
          <div className={cn("space-y-3", step !== 'rateio' && "hidden sm:block")}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <span>1. Escolha a Regra de Rateio</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Toque para selecionar</span>
            </div>

            <div className="space-y-2.5">
              {/* OPÇÃO 1: PARC. FIXA SAULO */}
              <button
                type="button"
                onClick={() => handleChooseRateio('Parc. Fixa Saulo')}
                className={cn(
                  "w-full text-left p-4 rounded-2xl border transition-all cursor-pointer relative group",
                  selectedRateio === 'Parc. Fixa Saulo'
                    ? "bg-amber-500/15 border-amber-500/60 ring-2 ring-amber-500/30 shadow-lg shadow-amber-500/10"
                    : "bg-slate-950/50 border-slate-800 hover:bg-slate-800/40 hover:border-slate-700"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                        Opção 1: Parc. Fixa Saulo
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        3 Sócios
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      A despesa lançada é rateada em <strong className="text-white">partes iguais (1/3 cada)</strong> para:
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {['Mccley', 'Jan', 'Jorge'].map(p => (
                        <span key={p} className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-amber-300 border border-amber-500/30">
                          {p}
                        </span>
                      ))}
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-500/10 text-red-300 border border-red-500/20 line-through">
                        Saulo (Isento)
                      </span>
                    </div>
                  </div>

                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border transition-all",
                    selectedRateio === 'Parc. Fixa Saulo'
                      ? "bg-amber-500 border-amber-400 text-slate-950"
                      : "border-slate-700 bg-slate-900"
                  )}>
                    {selectedRateio === 'Parc. Fixa Saulo' && <Check size={14} className="stroke-[3]" />}
                  </div>
                </div>
              </button>

              {/* OPÇÃO 2: RATEIO NORMAL */}
              <button
                type="button"
                onClick={() => handleChooseRateio('Rateio Normal')}
                className={cn(
                  "w-full text-left p-4 rounded-2xl border transition-all cursor-pointer relative group",
                  selectedRateio === 'Rateio Normal'
                    ? "bg-emerald-500/15 border-emerald-500/60 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/10"
                    : "bg-slate-950/50 border-slate-800 hover:bg-slate-800/40 hover:border-slate-700"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                        Opção 2: Rateio Normal
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        4 Sócios
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      A despesa lançada é rateada em <strong className="text-white">partes iguais (1/4 cada)</strong> para todos os sócios:
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {['Mccley', 'Jan', 'Saulo', 'Jorge'].map(p => (
                        <span key={p} className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-800 text-emerald-300 border border-emerald-500/30">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border transition-all",
                    selectedRateio === 'Rateio Normal'
                      ? "bg-emerald-500 border-emerald-400 text-slate-950"
                      : "border-slate-700 bg-slate-900"
                  )}>
                    {selectedRateio === 'Rateio Normal' && <Check size={14} className="stroke-[3]" />}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* PASSO 2: FORMA DE PAGAMENTO */}
          <div className={cn("space-y-3 pt-2", step === 'rateio' && "sm:pt-4 border-t border-slate-800/80")}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <span>2. Selecione a Forma de Pagamento</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Toque para concluir</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* PIX */}
              <button
                type="button"
                onClick={() => handleChooseMethod('Pix')}
                className={cn(
                  "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 relative group active:scale-95",
                  selectedMethod === 'Pix'
                    ? "bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/40 text-white"
                    : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-emerald-500/40 text-slate-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform">
                    <Wallet size={18} />
                  </div>
                  {selectedMethod === 'Pix' && (
                    <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs">
                      <Check size={13} className="stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">Pix</span>
                  <span className="text-[10px] text-slate-400">Transferência imediata</span>
                </div>
              </button>

              {/* CARTÃO */}
              <button
                type="button"
                onClick={() => handleChooseMethod('Cartão')}
                className={cn(
                  "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 relative group active:scale-95",
                  selectedMethod === 'Cartão'
                    ? "bg-blue-500/20 border-blue-500 ring-2 ring-blue-500/40 text-white"
                    : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-blue-500/40 text-slate-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                    <CreditCard size={18} />
                  </div>
                  {selectedMethod === 'Cartão' && (
                    <span className="w-5 h-5 rounded-full bg-blue-500 text-slate-950 flex items-center justify-center text-xs">
                      <Check size={13} className="stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">Cartão</span>
                  <span className="text-[10px] text-slate-400">À vista ou parcelado</span>
                </div>
              </button>

              {/* DOAÇÃO */}
              <button
                type="button"
                onClick={() => handleChooseMethod('doação')}
                className={cn(
                  "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 relative group active:scale-95",
                  selectedMethod === 'doação'
                    ? "bg-purple-500/20 border-purple-500 ring-2 ring-purple-500/40 text-white"
                    : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-purple-500/40 text-slate-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20 group-hover:scale-110 transition-transform">
                    <Heart size={18} />
                  </div>
                  {selectedMethod === 'doação' && (
                    <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs">
                      <Check size={13} className="stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">Doação</span>
                  <span className="text-[10px] text-slate-400">Sem rateio (Aporte)</span>
                </div>
              </button>

              {/* CAIXA */}
              <button
                type="button"
                onClick={() => handleChooseMethod('Caixa')}
                className={cn(
                  "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between h-28 relative group active:scale-95",
                  selectedMethod === 'Caixa'
                    ? "bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/40 text-white"
                    : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/60 hover:border-amber-500/40 text-slate-300"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                    <Banknote size={18} />
                  </div>
                  {selectedMethod === 'Caixa' && (
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs">
                      <Check size={13} className="stroke-[3]" />
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-sm font-bold text-white block">Caixa</span>
                  <span className="text-[10px] text-slate-400">Saldo da obra</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Rodapé informativo */}
        <div className="pt-4 mt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Info size={13} className="text-emerald-400 shrink-0" />
            <span className="text-[11px]">
              Rateio ativo: <strong className="text-slate-200">{selectedRateio}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
