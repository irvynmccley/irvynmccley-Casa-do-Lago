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
    date: format(new Date(), 'yyyy-MM-dd'),
    value: '',
    description: '',
    isCaixa: false
  });

  const [paymentForm, setPaymentForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    value: '',
    person: 'Mccley' as Person
  });

  const handleIncomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incomeForm.value || !incomeForm.description) return;
    
    const incomeData = {
      date: incomeForm.date,
      value: parseFloat(incomeForm.value),
      description: incomeForm.description,
      isCaixa: incomeForm.isCaixa
    };

    if (editingIncomeId) {
      onEditIncome(editingIncomeId, incomeData);
      setEditingIncomeId(null);
    } else {
      onAddIncome(incomeData);
    }

    setIncomeForm({ ...incomeForm, value: '', description: '', isCaixa: false });
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
    if (!paymentForm.value) return;
    onAddPayment({
      date: paymentForm.date,
      value: parseFloat(paymentForm.value),
      person: paymentForm.person
    });
    setPaymentForm({ ...paymentForm, value: '' });
  };

  const sortedIncomes = [...incomes].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h2 className="text-3xl font-bold tracking-tight mb-2">Entradas</h2>
        <p className="text-black">Financiamentos e aportes</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white p-6 border-l-4 border-emerald-500">
          <div className="text-sm font-bold text-black uppercase tracking-widest mb-1">Total Acumulado</div>
          <div className="text-3xl font-light">{formatCurrency(totalIncome)}</div>
        </Card>
        <Card className="bg-white p-6 border-l-4 border-red-500">
          <div className="text-sm font-bold text-black uppercase tracking-widest mb-1">Saldo Devedor Total</div>
          <div className="text-3xl font-light">{formatCurrency(totalDebt)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
          <Card className="bg-white p-6">
            <h3 className="text-lg font-semibold mb-6">Lançar Financiamento</h3>
            <form onSubmit={handleIncomeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">Data</label>
                <input 
                  type="date" 
                  value={incomeForm.date}
                  onChange={e => setIncomeForm({ ...incomeForm, date: e.target.value })}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">Valor R$</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={incomeForm.value}
                  onChange={e => setIncomeForm({ ...incomeForm, value: e.target.value })}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">Descrição</label>
                <input 
                  type="text" 
                  value={incomeForm.description}
                  onChange={e => setIncomeForm({ ...incomeForm, description: e.target.value })}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isCaixa"
                  checked={incomeForm.isCaixa}
                  onChange={e => setIncomeForm({ ...incomeForm, isCaixa: e.target.checked })}
                  className="w-4 h-4 text-emerald-500 rounded border-gray-300 focus:ring-emerald-500"
                />
                <label htmlFor="isCaixa" className="text-sm font-medium text-black">
                  Reserva de Caixa
                </label>
              </div>
              <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-3 rounded-xl hover:bg-emerald-600 transition-all flex items-center justify-center gap-2">
                {editingIncomeId ? <Edit2 size={18} /> : null}
                {editingIncomeId ? "Salvar Alterações" : "Lançar Entrada"}
              </button>
              {editingIncomeId && (
                <button 
                  type="button"
                  onClick={() => {
                    setEditingIncomeId(null);
                    setIncomeForm({
                      date: format(new Date(), 'yyyy-MM-dd'),
                      value: '',
                      description: '',
                      isCaixa: false
                    });
                  }}
                  className="w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300 transition-all mt-2"
                >
                  Cancelar Edição
                </button>
              )}
            </form>
          </Card>

          <Card className="bg-white p-6">
            <h3 className="text-lg font-semibold mb-6">Lançar Recebimento</h3>
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">Data</label>
                <input 
                  type="date" 
                  value={paymentForm.date}
                  onChange={e => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">Valor R$</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={paymentForm.value}
                  onChange={e => setPaymentForm({ ...paymentForm, value: e.target.value })}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-black mb-1">Pessoa</label>
                <select 
                  value={paymentForm.person}
                  onChange={e => setPaymentForm({ ...paymentForm, person: e.target.value as Person })}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {PEOPLE.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-500 text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-all">
                Lançar Recebimento
              </button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-lg font-semibold">Saldos Individuais</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {individualStats.map((stat: any) => (
              <Card key={stat.name} className="bg-white p-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                  <User size={24} />
                </div>
                <h4 className="font-bold text-lg mb-1">{stat.name}</h4>
                <div className="text-xs text-black uppercase mb-4">Saldo Devedor</div>
                <div className={cn(
                  "text-xl font-mono font-bold",
                  stat.debt > 0 ? "text-red-500" : "text-emerald-500"
                )}>
                  {formatCurrency(stat.debt)}
                </div>
                <div className="mt-4 pt-4 border-t border-black/5 w-full text-xs text-black">
                  Total Pago: {formatCurrency(stat.paid)}
                </div>
              </Card>
            ))}
          </div>

          <h3 className="text-lg font-semibold mt-8">Histórico de Entradas</h3>
          <div className="space-y-3">
            {sortedIncomes.map((inc: Income) => (
              <div key={inc.id} className="bg-white p-4 rounded-xl flex justify-between items-center shadow-sm">
                <div>
                  <div className="font-bold flex items-center gap-2">
                    {inc.description}
                    {inc.isCaixa && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-md">Caixa</span>}
                  </div>
                  <div className="text-xs text-black">{inc.date.split('-').reverse().join('/')}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-emerald-600">+{formatCurrency(inc.value)}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditIncomeClick(inc)} className="text-black hover:text-blue-500"><Edit2 size={16} /></button>
                    <button onClick={() => onDeleteIncome(inc.id)} className="text-black hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
