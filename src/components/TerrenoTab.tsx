import React, { useState } from 'react';
import { CheckCircle, Circle, Map, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from './ui/Card';
import { formatAuditId, copyAuditIdToClipboard } from '../utils/audit';

interface TerrenoInstallment {
  id: string; // e.g., "2024-02"
  date: Date;
  value: number;
}

interface TerrenoTabProps {
  paidInstallments: string[];
  onTogglePayment: (id: string) => void;
  formatCurrency: (v: number) => string;
}

export function TerrenoTab({ paidInstallments, onTogglePayment, formatCurrency }: TerrenoTabProps) {
  const [showPaid, setShowPaid] = useState(false);

  // Generate installments
  const installments: TerrenoInstallment[] = [];
  let currentDate = new Date(2024, 1, 25); // Feb 25, 2024
  let remainingDebt = 40000;

  while (remainingDebt > 0) {
    const paymentValue = Math.min(700, remainingDebt);
    const id = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    
    installments.push({
      id,
      date: new Date(currentDate),
      value: paymentValue
    });

    remainingDebt -= paymentValue;
    currentDate.setMonth(currentDate.getMonth() + 1);
  }

  const safePaidInstallments = paidInstallments || [];
  
  const totalPaid = installments
    .filter(i => safePaidInstallments.includes(i.id))
    .reduce((acc, curr) => acc + curr.value, 0);
    
  const currentBalance = 40000 - totalPaid;

  const paidItems = installments.filter(i => safePaidInstallments.includes(i.id));
  const unpaidItems = installments.filter(i => !safePaidInstallments.includes(i.id));

  const renderInstallment = (installment: TerrenoInstallment, index: number, isPaid: boolean) => {
    const monthName = installment.date.toLocaleString('pt-BR', { month: 'long' });
    const year = installment.date.getFullYear();
    const auditId = formatAuditId('TER', installment.id);
    
    return (
      <div 
        key={installment.id} 
        className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700 bg-slate-950/40 hover:bg-slate-800/40 transition-all gap-2 sm:gap-4 group ring-1 ring-white/5"
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-slate-800/90 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shadow-sm">
            {index + 1}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="font-semibold text-slate-200 capitalize text-xs sm:text-sm truncate leading-tight">
                {monthName} {year}
              </span>
              <button
                type="button"
                onClick={(e) => copyAuditIdToClipboard(auditId, e)}
                title="Clique para copiar ID de auditoria"
                className="font-mono text-[9px] sm:text-[10px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center"
              >
                {auditId}
              </button>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
              Venc. 25/{String(installment.date.getMonth() + 1).padStart(2, '0')}/{year}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <span className="font-mono font-bold text-slate-200 text-xs sm:text-sm">
            {formatCurrency(installment.value)}
          </span>
          
          {isPaid ? (
            <button
              type="button"
              onClick={() => onTogglePayment(installment.id)}
              title="Clique para alterar status"
              className="flex items-center gap-1 sm:gap-1.5 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 sm:px-2.5 py-1 rounded-lg border border-emerald-500/20 transition-all text-[11px] sm:text-xs font-semibold"
            >
              <CheckCircle size={14} className="shrink-0" />
              <span>Pago</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onTogglePayment(installment.id)}
              className="flex items-center gap-1 sm:gap-1.5 text-slate-400 hover:text-emerald-400 bg-slate-800/60 hover:bg-emerald-500/10 px-2 sm:px-2.5 py-1 rounded-lg transition-all border border-slate-700/80 hover:border-emerald-500/30 text-[11px] sm:text-xs font-semibold"
            >
              <Circle size={14} className="shrink-0" />
              <span className="hidden xs:inline">Pagar</span>
              <span className="xs:hidden">Pagar</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-sm">Terreno</h2>
          <p className="text-slate-400 font-medium tracking-wide">Acompanhamento do financiamento do terreno</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 shadow-xl p-6 flex flex-col justify-between h-full hover:bg-slate-800/60 transition-colors">
          <div>
            <div className="flex items-center gap-3 text-slate-300 mb-4">
              <Map size={18} className="text-emerald-400" />
              <span className="text-sm font-medium uppercase tracking-wider">Valor Total</span>
            </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-4">{formatCurrency(62451.92)}</div>
          </div>
          <div className="space-y-1.5 text-sm text-slate-400 border-t border-slate-700/50 pt-4">
            <div className="flex justify-between">
              <span>Zaira:</span>
              <span className="font-medium text-slate-200">{formatCurrency(20504.03)}</span>
            </div>
            <div className="flex justify-between">
              <span>Juros Zaira:</span>
              <span className="font-medium text-slate-200">{formatCurrency(1947.89)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cris (parcelado):</span>
              <span className="font-medium text-slate-200">{formatCurrency(40000)}</span>
            </div>
          </div>
        </Card>
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 shadow-xl p-6 flex flex-col justify-between h-full hover:bg-slate-800/60 transition-colors">
          <div className="flex items-center gap-3 text-slate-300 mb-4">
            <CheckCircle size={18} className="text-blue-400" />
            <span className="text-sm font-medium uppercase tracking-wider">Total Pago</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-white">{formatCurrency(totalPaid)}</div>
        </Card>
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 shadow-xl p-6 flex flex-col justify-between h-full hover:bg-slate-800/60 transition-colors">
          <div className="flex items-center gap-3 text-slate-300 mb-4">
            <Circle size={18} className="text-red-400" />
            <span className="text-sm font-medium uppercase tracking-wider">Saldo Devedor</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-white">{formatCurrency(currentBalance)}</div>
        </Card>
      </div>

      <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 shadow-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-700/50 bg-slate-950/30 flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Linha do Tempo de Pagamentos</h3>
            <p className="text-xs text-slate-400 mt-0.5">Clique no ID para copiar ou no status para alternar</p>
          </div>
          <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700">
            {paidItems.length}/{installments.length} Pagas
          </span>
        </div>
        <div className="p-3 sm:p-5">
          <div className="space-y-4">
            
            {paidItems.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowPaid(!showPaid)}
                  className="flex items-center gap-2 text-slate-300 font-bold hover:text-white transition-colors bg-slate-800/50 px-3.5 py-1.5 rounded-xl ring-1 ring-slate-700/50 text-xs sm:text-sm"
                >
                  {showPaid ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Parcelas Pagas ({paidItems.length})
                </button>

                {showPaid && (
                  <div className="space-y-1.5 sm:space-y-2 animate-in slide-in-from-top-2 duration-300 pt-1">
                    {paidItems.map((installment) => {
                      const index = installments.findIndex(i => i.id === installment.id);
                      return renderInstallment(installment, index, true);
                    })}
                  </div>
                )}
              </div>
            )}

            {unpaidItems.length > 0 && (
              <div className="space-y-2">
                {paidItems.length > 0 && (
                  <h4 className="text-slate-300 font-bold text-xs uppercase tracking-wider mt-4 mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Próximos Vencimentos ({unpaidItems.length})
                  </h4>
                )}
                <div className="space-y-1.5 sm:space-y-2">
                  {unpaidItems.map((installment) => {
                    const index = installments.findIndex(i => i.id === installment.id);
                    return renderInstallment(installment, index, false);
                  })}
                </div>
              </div>
            )}

            {installments.length === 0 && (
              <p className="text-slate-500 text-center py-4 text-sm">Nenhuma parcela gerada.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
