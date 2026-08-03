import React, { useState } from 'react';
import { CheckCircle, Circle, Map, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from './ui/Card';

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
    
    return (
      <div key={installment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-700/50 hover:bg-slate-800/40 transition-colors gap-4 bg-slate-950/30">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-sm font-bold text-slate-400 ring-1 ring-white/5">
            {index + 1}
          </div>
          <div>
            <p className="font-bold text-slate-200 capitalize">{monthName} {year}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Vencimento: 25/{String(installment.date.getMonth() + 1).padStart(2, '0')}/{year}</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-0 border-slate-800">
          <span className="font-mono font-bold text-slate-300 text-lg">{formatCurrency(installment.value)}</span>
          
          {isPaid ? (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20 ring-1 ring-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <CheckCircle size={16} />
              <span className="text-sm font-bold tracking-wide">Pago</span>
            </div>
          ) : (
            <button
              onClick={() => onTogglePayment(installment.id)}
              className="flex items-center gap-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 px-4 py-2 rounded-full transition-all border border-slate-700 hover:border-emerald-500/30 ring-1 ring-white/5"
            >
              <Circle size={16} />
              <span className="text-sm font-bold tracking-wide">Marcar como Pago</span>
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
        <div className="p-6 border-b border-slate-700/50 bg-slate-950/30">
          <h3 className="text-lg font-bold text-white">Linha do Tempo de Pagamentos</h3>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            
            {paidItems.length > 0 && (
              <div className="space-y-4">
                <button
                  onClick={() => setShowPaid(!showPaid)}
                  className="flex items-center gap-2 text-slate-300 font-bold hover:text-white transition-colors bg-slate-800/50 px-4 py-2 rounded-xl ring-1 ring-slate-700/50"
                >
                  {showPaid ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  Parcelas Pagas ({paidItems.length})
                </button>

                {showPaid && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300 pt-2">
                    {paidItems.map((installment) => {
                      const index = installments.findIndex(i => i.id === installment.id);
                      return renderInstallment(installment, index, true);
                    })}
                  </div>
                )}
              </div>
            )}

            {unpaidItems.length > 0 && (
              <div className="space-y-4">
                {paidItems.length > 0 && (
                  <h4 className="text-slate-300 font-bold text-sm uppercase tracking-wider mt-6 mb-2">Próximos Vencimentos</h4>
                )}
                {unpaidItems.map((installment) => {
                  const index = installments.findIndex(i => i.id === installment.id);
                  return renderInstallment(installment, index, false);
                })}
              </div>
            )}

            {installments.length === 0 && (
              <p className="text-slate-500 text-center py-4">Nenhuma parcela gerada.</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
