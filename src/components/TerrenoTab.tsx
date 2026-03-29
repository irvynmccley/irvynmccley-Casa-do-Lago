import React from 'react';
import { CheckCircle, Circle, Map } from 'lucide-react';
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

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Terreno</h2>
          <p className="text-black">Acompanhamento do financiamento do terreno</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-white border-none shadow-sm p-6 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center gap-3 text-black mb-4">
              <Map size={18} className="text-emerald-500" />
              <span className="text-sm font-medium uppercase tracking-wider">Valor Total</span>
            </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-black mb-4">{formatCurrency(62451.92)}</div>
          </div>
          <div className="space-y-1.5 text-sm text-gray-500 border-t border-gray-100 pt-4">
            <div className="flex justify-between">
              <span>Zaira:</span>
              <span className="font-medium text-gray-900">{formatCurrency(20504.03)}</span>
            </div>
            <div className="flex justify-between">
              <span>Juros Zaira:</span>
              <span className="font-medium text-gray-900">{formatCurrency(1947.89)}</span>
            </div>
            <div className="flex justify-between">
              <span>Cris (parcelado):</span>
              <span className="font-medium text-gray-900">{formatCurrency(40000)}</span>
            </div>
          </div>
        </Card>
        <Card className="bg-white border-none shadow-sm p-6 flex flex-col justify-between h-full">
          <div className="flex items-center gap-3 text-black mb-4">
            <CheckCircle size={18} className="text-blue-500" />
            <span className="text-sm font-medium uppercase tracking-wider">Total Pago</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-black">{formatCurrency(totalPaid)}</div>
        </Card>
        <Card className="bg-white border-none shadow-sm p-6 flex flex-col justify-between h-full">
          <div className="flex items-center gap-3 text-black mb-4">
            <Circle size={18} className="text-red-500" />
            <span className="text-sm font-medium uppercase tracking-wider">Saldo Devedor</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight text-black">{formatCurrency(currentBalance)}</div>
        </Card>
      </div>

      <Card className="bg-white border-none shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-medium">Linha do Tempo de Pagamentos</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {installments.map((installment, index) => {
              const isPaid = safePaidInstallments.includes(installment.id);
              const monthName = installment.date.toLocaleString('pt-BR', { month: 'long' });
              const year = installment.date.getFullYear();
              
              return (
                <div key={installment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 capitalize">{monthName} {year}</p>
                      <p className="text-sm text-gray-500">Vencimento: 25/{String(installment.date.getMonth() + 1).padStart(2, '0')}/{year}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                    <span className="font-medium">{formatCurrency(installment.value)}</span>
                    
                    {isPaid ? (
                      <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">Pago</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => onTogglePayment(installment.id)}
                        className="flex items-center gap-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-full transition-colors border border-gray-200 hover:border-emerald-200"
                      >
                        <Circle size={16} />
                        <span className="text-sm font-medium">Marcar como Pago</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}
