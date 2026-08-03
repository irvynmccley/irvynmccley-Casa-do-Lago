import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Expense, Category } from '../types';
import { Card } from './ui/Card';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES: Category[] = ['Combustível', 'Documentação', 'Material', 'Mão de Obra', 'Monitoramento', 'Alimentação'];

interface ReportsTabProps {
  expenses: Expense[];
  allCardInstallments?: { 
    month: string; 
    total: number;
    items?: Array<{
      id: string;
      date: string;
      local: string;
      value: number;
      installment: string;
      originalExp: any;
    }>;
  }[];
  formatCurrency: (v: number) => string;
}

export function ReportsTab({ expenses, allCardInstallments = [], formatCurrency }: ReportsTabProps) {
  const [activeReportTab, setActiveReportTab] = useState<'geral' | 'apagar' | 'faturas'>('geral');
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

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

  const toggleInvoice = (month: string) => {
    setExpandedInvoice(expandedInvoice === month ? null : month);
  };

  const FIXED_COSTS = 750; // 700 (terreno) + 50 (condominio)
  const PEOPLE_COUNT = 4; // Jorge, Mccley, Jan, Saulo
  const FIXED_PER_PERSON = FIXED_COSTS / PEOPLE_COUNT;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-sm">Relatórios</h2>
          <p className="text-slate-400 font-medium tracking-wide">Detalhamento de todos os lançamentos</p>
        </div>
        
        <div className="flex bg-slate-900/50 p-1.5 rounded-xl self-start md:self-auto border border-slate-700/50 ring-1 ring-white/5">
          <button
            onClick={() => setActiveReportTab('geral')}
            className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all", activeReportTab === 'geral' ? "bg-slate-700/80 text-white shadow-md ring-1 ring-slate-600/50" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")}
          >
            Geral
          </button>
          <button
            onClick={() => setActiveReportTab('apagar')}
            className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all", activeReportTab === 'apagar' ? "bg-slate-700/80 text-white shadow-md ring-1 ring-slate-600/50" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")}
          >
            A Pagar
          </button>
          <button
            onClick={() => setActiveReportTab('faturas')}
            className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all", activeReportTab === 'faturas' ? "bg-slate-700/80 text-white shadow-md ring-1 ring-slate-600/50" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")}
          >
            Faturas de Cartão
          </button>
        </div>
      </header>

      {activeReportTab === 'geral' && (
        <>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
            <div className="relative w-full sm:w-64 group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
              </div>
              <input
                type="text"
                placeholder="Buscar local, obs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 border border-slate-700/50 text-white rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-500 ring-1 ring-white/5"
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/50 overflow-x-auto w-full sm:w-auto hide-scrollbar ring-1 ring-white/5">
              <button 
                onClick={() => setFilter('all')}
                className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap", filter === 'all' ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200")}
              >
                Todos
              </button>
              {CATEGORIES.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={cn("px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize whitespace-nowrap", filter === cat ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200")}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <Card className="bg-slate-900/60 backdrop-blur-xl overflow-hidden border border-slate-700/50 shadow-xl ring-1 ring-white/5">
            <div className="overflow-x-auto hide-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-700/50">
                    <th className="px-4 sm:px-6 py-4 text-[10px] tracking-wider font-bold uppercase text-slate-400">Data</th>
                    <th className="px-4 sm:px-6 py-4 text-[10px] tracking-wider font-bold uppercase text-slate-400">Categoria</th>
                    <th className="px-4 sm:px-6 py-4 text-[10px] tracking-wider font-bold uppercase text-slate-400">Local</th>
                    <th className="px-4 sm:px-6 py-4 text-[10px] tracking-wider font-bold uppercase text-slate-400">Pagamento</th>
                    <th className="px-4 sm:px-6 py-4 text-[10px] tracking-wider font-bold uppercase text-slate-400 text-right">Valor R$</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {filteredExpenses.map((exp: Expense) => (
                    <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-slate-300 whitespace-nowrap">{exp.date ? exp.date.split('-').reverse().join('/') : '-'}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm text-slate-300 capitalize whitespace-nowrap">{exp.category}</td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium text-slate-200">
                        <div className="whitespace-nowrap">{exp.local}</div>
                        {exp.observation && (
                          <div className="text-[10px] text-slate-400 font-normal italic mt-1 max-w-[150px] sm:max-w-[200px] truncate bg-slate-950/30 inline-block px-1.5 py-0.5 rounded-md border border-slate-800" title={exp.observation}>
                            {exp.observation}
                          </div>
                        )}
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm whitespace-nowrap">
                        <span className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold uppercase ring-1",
                          exp.paymentMethod === 'Cartão' ? "bg-blue-500/10 text-blue-400 ring-blue-500/20" : 
                          exp.paymentMethod === 'doação' ? "bg-purple-500/10 text-purple-400 ring-purple-500/20" : 
                          exp.paymentMethod === 'Caixa' ? "bg-amber-500/10 text-amber-400 ring-amber-500/20" : "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                        )}>
                          {exp.paymentMethod} {exp.installments ? `(${exp.installments}x)` : ''}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-3 sm:py-4 text-sm font-mono font-bold text-slate-200 text-right whitespace-nowrap">{formatCurrency(exp.value)}</td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500 border-t border-slate-700/50">
                        Nenhum lançamento encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {activeReportTab === 'apagar' && (
        <Card className="bg-slate-900/60 backdrop-blur-xl overflow-hidden border border-slate-700/50 shadow-xl ring-1 ring-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-bold mb-6 text-white">A Pagar (Mensal por Pessoa)</h3>
          <div className="space-y-4">
            {allCardInstallments.length > 0 ? (
              allCardInstallments.map((item) => {
                const cardPerPerson = item.total / PEOPLE_COUNT;
                const totalPerPerson = cardPerPerson + FIXED_PER_PERSON;
                
                return (
                  <div key={item.month} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-950/30 rounded-xl border border-slate-800 hover:bg-slate-800/40 transition-colors">
                    <div>
                      <div className="text-base font-bold text-slate-200 capitalize">
                        {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase mt-1.5 flex items-center gap-2">
                        <span>Cartão: <span className="text-slate-300">{formatCurrency(cardPerPerson)}</span></span>
                        <span className="text-slate-600">+</span>
                        <span>Fixo: <span className="text-slate-300">{formatCurrency(FIXED_PER_PERSON)}</span></span>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-emerald-400 mt-3 sm:mt-0 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20">
                      {formatCurrency(totalPerPerson)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-700/50 rounded-xl bg-slate-950/30">Nenhuma parcela a pagar encontrada.</div>
            )}
          </div>
        </Card>
      )}

      {activeReportTab === 'faturas' && (
        <Card className="bg-slate-900/60 backdrop-blur-xl overflow-hidden border border-slate-700/50 shadow-xl ring-1 ring-white/5 p-4 sm:p-6">
          <h3 className="text-lg font-bold mb-6 text-white">Faturas de Cartão (Total)</h3>
          <div className="space-y-4">
            {allCardInstallments.length > 0 ? (
              allCardInstallments.map((item) => {
                const isExpanded = expandedInvoice === item.month;
                
                return (
                  <div key={item.month} className="bg-slate-950/30 rounded-xl border border-slate-800 overflow-hidden transition-all">
                    <button 
                      onClick={() => toggleInvoice(item.month)}
                      className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-md transition-colors", isExpanded ? "bg-slate-700 text-slate-300" : "bg-slate-800 text-slate-400")}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                        <div className="text-base font-bold text-slate-200 capitalize">
                          {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-blue-400 mt-3 sm:mt-0 text-left sm:text-right w-full sm:w-auto pl-9 sm:pl-0">
                        {formatCurrency(item.total)}
                      </div>
                    </button>
                    
                    {isExpanded && item.items && item.items.length > 0 && (
                      <div className="border-t border-slate-800 bg-slate-900/40">
                        <div className="overflow-x-auto hide-scrollbar">
                          <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                              <tr className="bg-slate-950/50 border-b border-slate-800">
                                <th className="px-6 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-500">Data da Compra</th>
                                <th className="px-6 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-500">Local</th>
                                <th className="px-6 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-500 text-center">Parcela</th>
                                <th className="px-6 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-500 text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                              {item.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((detail, idx) => (
                                <tr key={`${detail.id}-${idx}`} className="hover:bg-slate-800/30 transition-colors group">
                                  <td className="px-6 py-3 text-sm text-slate-400 whitespace-nowrap">
                                    {detail.date ? detail.date.split('-').reverse().join('/') : '-'}
                                  </td>
                                  <td className="px-6 py-3 text-sm font-medium text-slate-300">
                                    {detail.local}
                                    {detail.originalExp?.observation && (
                                      <div className="text-[10px] text-slate-500 font-normal italic mt-1 truncate max-w-[200px] bg-slate-950/50 inline-block px-1.5 py-0.5 rounded border border-slate-800" title={detail.originalExp.observation}>
                                        {detail.originalExp.observation}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-3 text-sm font-medium text-center text-slate-400">
                                    <span className="bg-slate-800/50 px-2 py-0.5 rounded text-xs ring-1 ring-slate-700/50">{detail.installment}</span>
                                  </td>
                                  <td className="px-6 py-3 text-sm font-mono font-bold text-slate-300 text-right whitespace-nowrap">
                                    {formatCurrency(detail.value)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {isExpanded && (!item.items || item.items.length === 0) && (
                       <div className="border-t border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500 font-medium">
                         Detalhamento não disponível.
                       </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-700/50 rounded-xl bg-slate-950/30">Nenhuma fatura de cartão encontrada.</div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
