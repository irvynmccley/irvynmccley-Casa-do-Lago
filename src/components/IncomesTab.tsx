import React, { useState } from 'react';
import { Trash2, User, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { Income, Payment, Person } from '../types';
import { Card } from './ui/Card';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PEOPLE: Person[] = ['Mccley', 'Jan', 'Saulo'];

interface IncomesTabProps {
  incomes: Income[];
  payments: Payment[];
  totalIncome: number;
  totalPayments: number;
  totalDebt: number;
  individualStats: any[];
  onAddIncome: (i: Omit<Income, 'id'>) => void;
  onEditIncome: (id: string, i: Partial<Omit<Income, 'id'>>) => void;
  onAddPayment: (p: Omit<Payment, 'id'>) => void;
  onDeleteIncome: (id: string) => void;
  onDeletePayment: (id: string) => void;
  formatCurrency: (v: number) => string;
}

export function IncomesTab({ 
  incomes, 
  payments, 
  totalIncome, 
  totalPayments, 
  totalDebt, 
  individualStats, 
  onAddIncome, 
  onEditIncome,
  onAddPayment, 
  onDeleteIncome, 
  onDeletePayment, 
  formatCurrency 
}: IncomesTabProps) {
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [incomeForm, setIncomeForm] = useState({
    date: '',
    value: '',
    description: '',
    isCaixa: false
  });

  const [paymentForm, setPaymentForm] = useState({
    date: '',
    value: '',
    person: '' as Person
  });

  const handleIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const incomeData = {
      date: incomeForm.date,
      value: parseFloat(incomeForm.value) || 0,
      description: incomeForm.description,
      isCaixa: incomeForm.isCaixa
    };

    if (editingIncomeId) {
      onEditIncome(editingIncomeId, incomeData);
      setEditingIncomeId(null);
    } else {
      onAddIncome(incomeData);
    }

    setIncomeForm({ date: '', value: '', description: '', isCaixa: false });
  };

  const handleEditIncomeClick = (inc: Income) => {
    setEditingIncomeId(inc.id);
    setIncomeForm({
      date: inc.date,
      value: inc.value.toString(),
      description: inc.description,
      isCaixa: inc.isCaixa || false
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddPayment({
      date: paymentForm.date,
      value: parseFloat(paymentForm.value) || 0,
      person: paymentForm.person
    });
    setPaymentForm({ date: '', value: '', person: '' as Person });
  };

  const sortedIncomes = [...incomes].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      <header>
        <h2 className="text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-sm">Entradas</h2>
        <p className="text-slate-400 font-medium tracking-wide">Financiamentos e aportes</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 p-6 border-l-4 border-l-emerald-500 ring-1 ring-white/5 shadow-xl">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Total Acumulado</div>
          <div className="text-3xl font-light text-white">{formatCurrency(totalIncome)}</div>
        </Card>
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 p-6 border-l-4 border-l-red-500 ring-1 ring-white/5 shadow-xl">
          <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">Saldo Devedor Total</div>
          <div className="text-3xl font-light text-white">{formatCurrency(totalDebt)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">Lançar Financiamento</h3>
            <form onSubmit={handleIncomeSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Data</label>
                <input 
                  type="date" 
                  required
                  value={incomeForm.date}
                  onChange={e => setIncomeForm({ ...incomeForm, date: e.target.value })}
                  className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Valor R$</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={incomeForm.value}
                  onChange={e => setIncomeForm({ ...incomeForm, value: e.target.value })}
                  className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Descrição</label>
                <input 
                  type="text" 
                  required
                  value={incomeForm.description}
                  onChange={e => setIncomeForm({ ...incomeForm, description: e.target.value })}
                  className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
              <div className="flex items-center gap-2 px-1">
                <input 
                  type="checkbox" 
                  id="isCaixa"
                  checked={incomeForm.isCaixa}
                  onChange={e => setIncomeForm({ ...incomeForm, isCaixa: e.target.checked })}
                  className="w-4 h-4 text-emerald-500 bg-slate-950/50 border-slate-700/50 rounded focus:ring-emerald-500 focus:ring-offset-slate-900"
                />
                <label htmlFor="isCaixa" className="text-sm font-medium text-slate-300">
                  Reserva de Caixa
                </label>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2 ring-1 ring-emerald-400/30">
                {editingIncomeId ? <Edit2 size={18} /> : null}
                {editingIncomeId ? "Salvar Alterações" : "Lançar Entrada"}
              </button>
              {editingIncomeId && (
                <button 
                  type="button"
                  onClick={() => {
                    setEditingIncomeId(null);
                    setIncomeForm({
                      date: '',
                      value: '',
                      description: '',
                      isCaixa: false
                    });
                  }}
                  className="w-full bg-slate-800/80 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-700 hover:text-white transition-all mt-2 border border-slate-600"
                >
                  Cancelar Edição
                </button>
              )}
            </form>
          </Card>

          <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6">Lançar Recebimento</h3>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Data</label>
                <input 
                  type="date" 
                  required
                  value={paymentForm.date}
                  onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Valor R$</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={paymentForm.value}
                  onChange={e => setPaymentForm({ ...paymentForm, value: e.target.value })}
                  className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 outline-none transition-all placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Pessoa</label>
                <select 
                  required
                  value={paymentForm.person}
                  onChange={e => setPaymentForm({ ...paymentForm, person: e.target.value as Person })}
                  className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500/50 outline-none transition-all appearance-none"
                >
                  <option value="" disabled className="text-slate-500">Selecione...</option>
                  {PEOPLE.map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-indigo-500 transition-all ring-1 ring-blue-500/30">
                Lançar Recebimento
              </button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-bold text-white">Saldos Individuais</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {individualStats.map((stat: any) => (
              <Card key={stat.name} className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 p-6 flex flex-col items-center text-center ring-1 ring-white/5 hover:bg-slate-800/60 transition-all">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 text-emerald-400 ring-1 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                  <User size={24} />
                </div>
                <h4 className="font-bold text-lg text-white mb-1">{stat.name}</h4>
                <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-4">Saldo Devedor</div>
                <div className={cn(
                  "text-xl font-mono font-bold bg-slate-950/50 px-4 py-1.5 rounded-lg border border-slate-800",
                  stat.debt > 0 ? "text-red-400 shadow-[inset_0_0_10px_rgba(239,68,68,0.1)]" : "text-emerald-400 shadow-[inset_0_0_10px_rgba(16,185,129,0.1)]"
                )}>
                  {formatCurrency(stat.debt)}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700/50 w-full text-xs text-slate-400 font-medium">
                  Total Pago: <span className="text-slate-200">{formatCurrency(stat.paid)}</span>
                </div>
              </Card>
            ))}
          </div>

          <h3 className="text-lg font-bold text-white mt-8">Histórico de Entradas</h3>
          <div className="space-y-3">
            {sortedIncomes.map((inc: Income) => (
              <div key={inc.id} className="bg-slate-900/40 backdrop-blur-md border border-slate-800 p-4 rounded-xl flex justify-between items-center shadow-sm hover:bg-slate-800/60 transition-all ring-1 ring-white/5 group">
                <div>
                  <div className="font-bold text-slate-200 flex items-center gap-2">
                    {inc.description}
                    {inc.isCaixa && <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 text-[10px] font-bold uppercase rounded-md ring-1 ring-amber-500/20">Caixa</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{inc.date ? inc.date.split('-').reverse().join('/') : '-'}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">+{formatCurrency(inc.value)}</span>
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEditIncomeClick(inc)} className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"><Edit2 size={16} /></button>
                    <button onClick={() => onDeleteIncome(inc.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
            {sortedIncomes.length === 0 && (
              <div className="bg-slate-900/40 rounded-2xl p-8 text-center text-slate-400 border border-dashed border-slate-700/50">
                Nenhuma entrada registrada ainda.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
