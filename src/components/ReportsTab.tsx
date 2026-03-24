import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Expense, Category } from '../types';
import { Card } from './ui/Card';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES: Category[] = ['Combustível', 'Documentação', 'Material', 'Mão de Obra', 'Monitoramento'];

interface ReportsTabProps {
  expenses: Expense[];
  formatCurrency: (v: number) => string;
}

export function ReportsTab({ expenses, formatCurrency }: ReportsTabProps) {
  const [filter, setFilter] = useState('all');

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (filter !== 'all') {
      result = expenses.filter((e: Expense) => e.category === filter);
    }
    return [...result].sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, filter]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Relatórios</h2>
          <p className="text-black">Detalhamento de todos os lançamentos</p>
        </div>
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-black/5 overflow-x-auto">
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
      </header>

      <Card className="bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-black/5">
                <th className="px-6 py-4 text-xs font-bold uppercase text-black">Data</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-black">Categoria</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-black">Local</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-black">Pagamento</th>
                <th className="px-6 py-4 text-xs font-bold uppercase text-black text-right">Valor R$</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filteredExpenses.map((exp: Expense) => (
                <tr key={exp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm">{exp.date.split('-').reverse().join('/')}</td>
                  <td className="px-6 py-4 text-sm capitalize">{exp.category}</td>
                  <td className="px-6 py-4 text-sm font-medium">
                    <div>{exp.local}</div>
                    {exp.observation && (
                      <div className="text-[10px] text-black font-normal italic mt-0.5 max-w-[200px] truncate" title={exp.observation}>
                        {exp.observation}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={cn(
                      "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                      exp.paymentMethod === 'Cartão' ? "bg-blue-100 text-blue-600" : 
                      exp.paymentMethod === 'doação' ? "bg-purple-100 text-purple-600" : 
                      exp.paymentMethod === 'Caixa' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                    )}>
                      {exp.paymentMethod} {exp.installments ? `(${exp.installments}x)` : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono font-bold text-right">{formatCurrency(exp.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
