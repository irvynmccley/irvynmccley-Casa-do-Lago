import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  X, 
  Check, 
  ArrowRight, 
  Calculator, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Equal
} from 'lucide-react';

interface EditCondominioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentValue: number;
  terrenoValue?: number;
  peopleCount?: number;
  onSave: (newValue: number) => Promise<void> | void;
  formatCurrency?: (v: number) => string;
}

export function EditCondominioModal({
  isOpen,
  onClose,
  currentValue,
  terrenoValue = 700,
  peopleCount = 4,
  onSave,
  formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
}: EditCondominioModalProps) {
  const [inputValue, setInputValue] = useState<string>(currentValue.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(currentValue.toString());
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, currentValue]);

  if (!isOpen) return null;

  // Valor numérico digitado
  const parsedValue = parseFloat(inputValue.replace(',', '.'));
  const isValidNumber = !isNaN(parsedValue) && parsedValue >= 0;

  // Cálculos comparativos atuais vs projetados
  const oldTotal = terrenoValue + currentValue;
  const oldPerPerson = oldTotal / peopleCount;

  const newTotal = isValidNumber ? terrenoValue + parsedValue : oldTotal;
  const newPerPerson = isValidNumber ? newTotal / peopleCount : oldPerPerson;

  const diffPerPerson = newPerPerson - oldPerPerson;
  const diffCondominio = isValidNumber ? parsedValue - currentValue : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNumber) {
      setError('Por favor, informe um valor válido maior ou igual a zero.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave(parsedValue);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar o valor do condomínio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0b1329] border border-blue-500/30 rounded-2xl shadow-2xl shadow-blue-950/50 overflow-hidden ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400 shadow-inner">
              <Building2 size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Reajustar Valor do Condomínio</h3>
              <p className="text-xs text-slate-400 mt-0.5">Atualiza a taxa fixa mensal e recalcula todos os rateios</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5">
          {/* Campo de Novo Valor */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Novo Valor do Condomínio (Mensal)
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm pointer-events-none">
                R$
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                autoFocus
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="0,00"
                className="w-full pl-11 pr-4 py-3 bg-slate-950/70 border border-slate-700/80 rounded-xl text-white font-mono text-lg font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600"
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
              <span>Valor atual: <span className="font-semibold text-slate-200">{formatCurrency(currentValue)}</span></span>
              <span>Terreno (fixo): <span className="font-semibold text-emerald-300">{formatCurrency(terrenoValue)}</span></span>
            </div>
          </div>

          {/* Card de Simulação e Impacto em Tempo Real */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
              <span className="flex items-center gap-1.5 text-blue-300">
                <Calculator size={14} /> Simulação do Reajuste
              </span>
              <span className="text-[11px] font-mono lowercase text-slate-400">÷ {peopleCount} sócios</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Total Fixo Mensal */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Novo Total Fixo
                </span>
                <div className="text-base sm:text-lg font-mono font-bold text-purple-300">
                  {formatCurrency(newTotal)}
                </div>
                <span className="text-[10px] text-slate-400">
                  R$ {terrenoValue.toFixed(0)} + R$ {isValidNumber ? parsedValue.toFixed(2) : '0,00'}
                </span>
              </div>

              {/* Rateio por Pessoa */}
              <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Novo Fixo por Sócio
                </span>
                <div className="text-base sm:text-lg font-mono font-bold text-emerald-400">
                  {formatCurrency(newPerPerson)}
                </div>
                <span className="text-[10px] text-slate-400">
                  (R$ {newTotal.toFixed(2)} ÷ {peopleCount})
                </span>
              </div>
            </div>

            {/* Variação */}
            {isValidNumber && (
              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-800/80">
                <span className="text-slate-400 flex items-center gap-1">
                  Impacto mensal por pessoa:
                </span>
                <div className="flex items-center gap-1.5 font-bold font-mono">
                  {diffPerPerson > 0 ? (
                    <span className="text-amber-400 flex items-center gap-1">
                      <TrendingUp size={14} /> +{formatCurrency(diffPerPerson)} / mês
                    </span>
                  ) : diffPerPerson < 0 ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <TrendingDown size={14} /> {formatCurrency(diffPerPerson)} / mês
                    </span>
                  ) : (
                    <span className="text-slate-400 flex items-center gap-1">
                      <Equal size={14} /> Sem alteração
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || !isValidNumber}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Confirmar Reajuste</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
