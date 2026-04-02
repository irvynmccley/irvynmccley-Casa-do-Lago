import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Expense, Category } from '../types';
import { Card } from './ui/Card';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES: Category[] = ['Combustível', 'Documentação', 'Material', 'Mão de Obra', 'Monitoramento', 'Alimentação'];

interface ReportsTabProps {
  expenses: Expense[];
  allCardInstallments?: { month: string; total: number }[];
  formatCurrency: (v: number) => string;
}

export function ReportsTab({ expenses, allCardInstallments = [], formatCurrency }: ReportsTabProps) {
  const [activeReportTab, setActiveReportTab] = useState<'geral' | 'apagar' | 'faturas'>('geral');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (filter !== 'all') {
      result = result.filter((e: Expense) => e.category === filter);
    }
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter((e: Expense) => 
        (e.local && typeof e.local === 'string' && e.local.toLowerCase().includes(lowerSearch)) ||
        (e.observation && typeof e.observation === 'string' && e.observation.toLowerCase().includes(lowerSearch)) ||
        (e.paymentMethod && typeof e.paymentMethod === 'string' && e.paymentMethod.toLowerCase().includes(lowerSearch))
      );
    }
    return [...result].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [expenses, filter, searchTerm]);

  const FIXED_COSTS = 750; // 700 (terreno) + 50 (condominio)
  const PEOPLE_COUNT = 4; // Jorge, Mccley, Jan, Saulo
  const FIXED_PER_PERSON = FIXED_COSTS / PEOPLE_COUNT;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Relatórios</h2>
          <p className="text-black">Detalhamento de todos os lançamentos</p>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl self-start md:self-auto">
          <button
            onClick={() => setActiveReportTab('geral')}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", activeReportTab === 'geral' ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-black")}
          >
            Geral
          </button>
          <button
            onClick={() => setActiveReportTab('apagar')}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", activeReportTab === 'apagar' ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-black")}
          >
            A Pagar
          </button>
          <button
            onClick={() => setActiveReportTab('faturas')}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all", activeReportTab === 'faturas' ? "bg-white shadow-sm text-black" : "text-gray-500 hover:text-black")}
          >
            Faturas de Cartão
          </button>
        </div>
      </header>

      {activeReportTab === 'geral' && (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Buscar local, obs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-black/5 overflow-x-auto w-full sm:w-auto hide-scrollbar">
              <button 
                onClick={() => setFilter('all')}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap", filter === 'all' ? "bg-emerald-500 text-white" : "text-black hover:bg-gray-50")}
              >
                Todos
              </button>
              {CATEGORIES.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize whitespace-nowrap", filter === cat ? "bg-emerald-500 text-white" : "text-black hover:bg-gray-50")}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <Card className="bg-white overflow-hidden border-none shadow-sm">
            <div className="overflow-x-auto hide-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-black/5">
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs font-bold uppercase text-black">Data</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs font-bold uppercase text-black">Categoria</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs font-bold uppercase text-black">Local</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs font-bold uppercase text-black">Pagamento</th>
                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-xs font-bold uppercase text-black text-right">Valor R$</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {filteredExpenses.map((exp: Expense) => (
                    <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm whitespace-nowrap">{exp.date ? exp.date.split('-').reverse().join('/') : '-'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm capitalize whitespace-nowrap">{exp.category}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium">
                        <div className="whitespace-nowrap">{exp.local}</div>
                        {exp.observation && (
                          <div className="text-[10px] text-black font-normal italic mt-0.5 max-w-[150px] sm:max-w-[200px] truncate" title={exp.observation}>
                            {exp.observation}
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm whitespace-nowrap">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                          exp.paymentMethod === 'Cartão' ? "bg-blue-100 text-blue-600" : 
                          exp.paymentMethod === 'doação' ? "bg-purple-100 text-purple-600" : 
                          exp.paymentMethod === 'Caixa' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                        )}>
                          {exp.paymentMethod} {exp.installments ? `(${exp.installments}x)` : ''}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-mono font-bold text-right whitespace-nowrap">{formatCurrency(exp.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {activeReportTab === 'apagar' && (
        <Card className="bg-white overflow-hidden border-none shadow-sm p-4 sm:p-6">
          <h3 className="text-lg font-bold mb-6 text-black">A Pagar (Mensal por Pessoa)</h3>
          <div className="space-y-4">
            {allCardInstallments.length > 0 ? (
              allCardInstallments.map((item) => {
                const cardPerPerson = item.total / PEOPLE_COUNT;
                const totalPerPerson = cardPerPerson + FIXED_PER_PERSON;
                
                return (
                  <div key={item.month} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div>
                      <div className="text-base font-bold text-black capitalize">
                        {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-xs text-gray-500 font-medium mt-1">
                        Cartão: {formatCurrency(cardPerPerson)} + Fixo: {formatCurrency(FIXED_PER_PERSON)}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-black mt-2 sm:mt-0">
                      {formatCurrency(totalPerPerson)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">Nenhuma parcela a pagar encontrada.</div>
            )}
          </div>
        </Card>
      )}

      {activeReportTab === 'faturas' && (
        <Card className="bg-white overflow-hidden border-none shadow-sm p-4 sm:p-6">
          <h3 className="text-lg font-bold mb-6 text-black">Faturas de Cartão (Total)</h3>
          <div className="space-y-4">
            {allCardInstallments.length > 0 ? (
              allCardInstallments.map((item) => (
                <div key={item.month} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-base font-bold text-black capitalize">
                    {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                  </div>
                  <div className="text-xl font-bold text-black mt-2 sm:mt-0">
                    {formatCurrency(item.total)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">Nenhuma fatura de cartão encontrada.</div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
