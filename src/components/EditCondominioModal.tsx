import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  X, 
  Check, 
  ArrowRight, 
  Calculator, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Equal,
  Calendar,
  History,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CondominioAdjustment } from '../utils/financialSettings';

interface EditCondominioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentValue: number;
  terrenoValue?: number;
  peopleCount?: number;
  history?: CondominioAdjustment[];
  onSave: (newValue: number, effectiveFromMonth: string) => Promise<void> | void;
  formatCurrency?: (v: number) => string;
}

export function EditCondominioModal({
  isOpen,
  onClose,
  currentValue,
  terrenoValue = 700,
  peopleCount = 4,
  history = [],
  onSave,
  formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
}: EditCondominioModalProps) {
  const currentMonthKey = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  
  const [inputValue, setInputValue] = useState<string>(currentValue.toString());
  const [effectiveFromMonth, setEffectiveFromMonth] = useState<string>(currentMonthKey);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputValue(currentValue.toString());
      setEffectiveFromMonth(currentMonthKey);
      setError(null);
      setIsSubmitting(false);
      setShowHistory(false);
    }
  }, [isOpen, currentValue, currentMonthKey]);

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

  // Nome formatado do mês de vigência (ex: "Outubro de 2026")
  const formattedEffectiveMonthName = (() => {
    try {
      const [year, month] = effectiveFromMonth.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return format(date, 'MMMM yyyy', { locale: ptBR });
    } catch {
      return effectiveFromMonth;
    }
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidNumber) {
      setError('Por favor, informe um valor válido maior ou igual a zero.');
      return;
    }

    if (!effectiveFromMonth || !effectiveFromMonth.match(/^\d{4}-\d{2}$/)) {
      setError('Informe um mês de vigência válido (YYYY-MM).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave(parsedValue, effectiveFromMonth);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Erro ao atualizar o valor do condomínio.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-[#0b1329] border border-blue-500/30 rounded-2xl shadow-2xl shadow-blue-950/60 overflow-hidden ring-1 ring-white/10 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-900/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-500/15 border border-blue-500/30 rounded-xl text-blue-400 shadow-inner">
              <Building2 size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Reajustar Valor do Condomínio</h3>
              <p className="text-xs text-slate-400 mt-0.5">Atualiza a taxa fixa mensal e salva na nuvem</p>
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

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto custom-scrollbar flex-grow">
          {/* Campo de Novo Valor */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              Novo Valor da Taxa de Condomínio (Mensal)
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
                className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white font-mono text-xl font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-600 shadow-inner"
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
              <span>Valor vigente atual: <span className="font-semibold text-slate-200">{formatCurrency(currentValue)}</span></span>
              <span>Terreno (fixo): <span className="font-semibold text-emerald-300">{formatCurrency(terrenoValue)}</span></span>
            </div>
          </div>

          {/* Campo de Competência / Mês de Início */}
          <div className="bg-slate-950/50 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-400" />
                Vigência do Reajuste (Competência)
              </label>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                A partir de {effectiveFromMonth}
              </span>
            </div>
            
            <input
              type="month"
              value={effectiveFromMonth}
              onChange={(e) => setEffectiveFromMonth(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />

            {/* Aviso da Regra de Negócio */}
            <div className="flex items-start gap-2 p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-200">
              <ShieldCheck size={16} className="text-blue-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Regra Contábil Aplicada:</strong> O valor ajustado atualizará somente <span className="text-white font-semibold underline capitalize">{formattedEffectiveMonthName}</span> e os <strong>meses futuros</strong>. Os meses anteriores permanecerão intactos com os valores de suas épocas.
              </div>
            </div>
          </div>

          {/* Card de Simulação e Impacto em Tempo Real */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
              <span className="flex items-center gap-1.5 text-blue-300">
                <Calculator size={14} /> Simulação do Reajuste
              </span>
              <span className="text-[11px] font-mono text-slate-400">÷ {peopleCount} sócios</span>
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

          {/* Histórico de Reajustes Anteriores (Accordion) */}
          {history.length > 0 && (
            <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/30">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between p-3 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <History size={14} className="text-slate-400" />
                  Histórico de Vigências Cadastradas ({history.length})
                </span>
                <span className="text-[10px] text-blue-400 font-mono">
                  {showHistory ? 'Ocultar ▲' : 'Ver Detalhes ▼'}
                </span>
              </button>

              {showHistory && (
                <div className="p-3 pt-0 space-y-2 border-t border-slate-800/60">
                  {history.map((h, idx) => (
                    <div 
                      key={h.effectiveFrom + idx}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900/50 border border-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-slate-500" />
                        <span className="font-mono text-slate-300 font-medium">A partir de {h.effectiveFrom}</span>
                        {h.notes && <span className="text-[10px] text-slate-500 italic">({h.notes})</span>}
                      </div>
                      <span className="font-mono font-bold text-blue-300">{formatCurrency(h.condominioCost)} / mês</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                  <span>Salvando na Nuvem...</span>
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
