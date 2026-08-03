import React, { useState, useRef } from 'react';
import { Plus, Trash2, CreditCard, User, Wallet, FileUp, Download, Share2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import { Expense, Category, PaymentMethod, Donor } from '../types';
import { Card } from './ui/Card';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import * as XLSX from 'xlsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES: Category[] = ['Combustível', 'Documentação', 'Material', 'Mão de Obra', 'Monitoramento', 'Alimentação'];
const PAYMENT_METHODS: PaymentMethod[] = ['Pix', 'Cartão', 'doação', 'Caixa'];
const DONORS: Donor[] = ['Jorge', 'Jane', 'Saulo', 'Mccley', 'Jan'];

interface ExpensesTabProps {
  expenses: Expense[];
  onAdd: (e: Omit<Expense, 'id'>) => void;
  onEdit: (id: string, e: Partial<Omit<Expense, 'id'>>) => void;
  onDelete: (id: string) => void;
  formatCurrency: (v: number) => string;
  isSharedMode?: boolean;
}

export function ExpensesTab({ expenses, onAdd, onEdit, onDelete, formatCurrency, isSharedMode }: ExpensesTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isConfirmingEdit, setIsConfirmingEdit] = useState(false);
  const [pendingEditData, setPendingEditData] = useState<any>(null);
  const [formData, setFormData] = useState({
    date: '',
    category: '' as Category,
    local: '',
    value: '',
    paymentMethod: '' as PaymentMethod,
    installments: 1,
    donor: '' as Donor,
    observation: ''
  });

  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitData, setSplitData] = useState({
    value1: '',
    paymentMethod1: '' as PaymentMethod,
    installments1: 1,
    donor1: '' as Donor,
    value2: '',
    paymentMethod2: '' as PaymentMethod,
    installments2: 1,
    donor2: '' as Donor,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.category || !formData.local) return;

    if (isSplitPayment) {
      if (!splitData.value1 || !splitData.paymentMethod1 || !splitData.value2 || !splitData.paymentMethod2) return;

      const expense1 = {
        date: formData.date,
        category: formData.category,
        local: formData.local,
        value: parseFloat(splitData.value1),
        paymentMethod: splitData.paymentMethod1,
        installments: splitData.paymentMethod1 === 'Cartão' ? splitData.installments1 : undefined,
        donor: splitData.paymentMethod1 === 'doação' ? splitData.donor1 : undefined,
        observation: formData.observation ? `${formData.observation} (Parte 1)` : '(Parte 1)'
      };

      const expense2 = {
        date: formData.date,
        category: formData.category,
        local: formData.local,
        value: parseFloat(splitData.value2),
        paymentMethod: splitData.paymentMethod2,
        installments: splitData.paymentMethod2 === 'Cartão' ? splitData.installments2 : undefined,
        donor: splitData.paymentMethod2 === 'doação' ? splitData.donor2 : undefined,
        observation: formData.observation ? `${formData.observation} (Parte 2)` : '(Parte 2)'
      };

      onAdd(expense1);
      onAdd(expense2);

      setFormData({
        date: '',
        category: '' as Category,
        local: '',
        value: '',
        paymentMethod: '' as PaymentMethod,
        installments: 1,
        donor: '' as Donor,
        observation: ''
      });
      setSplitData({
        value1: '',
        paymentMethod1: '' as PaymentMethod,
        installments1: 1,
        donor1: '' as Donor,
        value2: '',
        paymentMethod2: '' as PaymentMethod,
        installments2: 1,
        donor2: '' as Donor,
      });
      setIsSplitPayment(false);
    } else {
      if (!formData.value || !formData.paymentMethod) return;

      const expenseData = {
        date: formData.date,
        category: formData.category,
        local: formData.local,
        value: parseFloat(formData.value),
        paymentMethod: formData.paymentMethod,
        installments: formData.paymentMethod === 'Cartão' ? formData.installments : undefined,
        donor: formData.paymentMethod === 'doação' ? formData.donor : undefined,
        observation: formData.observation || undefined
      };

      if (editingId) {
        setPendingEditData(expenseData);
        setIsConfirmingEdit(true);
      } else {
        onAdd(expenseData);
        setFormData({
          date: '',
          category: '' as Category,
          local: '',
          value: '',
          paymentMethod: '' as PaymentMethod,
          installments: 1,
          donor: '' as Donor,
          observation: ''
        });
      }
    }
  };

  const confirmEdit = () => {
    if (editingId && pendingEditData) {
      onEdit(editingId, pendingEditData);
      setEditingId(null);
      setPendingEditData(null);
      setFormData({
        date: '',
        category: '' as Category,
        local: '',
        value: '',
        paymentMethod: '' as PaymentMethod,
        installments: 1,
        donor: '' as Donor,
        observation: ''
      });
    }
  };

  const handleEditClick = (exp: Expense) => {
    setEditingId(exp.id);
    setFormData({
      date: exp.date,
      category: exp.category,
      local: exp.local,
      value: exp.value.toString(),
      paymentMethod: exp.paymentMethod,
      installments: exp.installments || 1,
      donor: exp.donor || 'Jorge',
      observation: exp.observation || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      data.forEach((row) => {
        const date = row['Data'] || row['date'] || format(new Date(), 'yyyy-MM-dd');
        const category = row['Categoria'] || row['category'] || 'Material';
        const local = row['Local'] || row['local'] || '';
        const value = parseFloat(row['Valor'] || row['value'] || '0');
        const paymentMethod = (row['Forma de Pagamento'] || row['paymentMethod'] || 'Pix') as PaymentMethod;
        const installments = parseInt(row['Parcelas'] || row['installments'] || '1');
        const donor = (row['Doador'] || row['donor'] || 'Jorge') as Donor;
        const observation = row['Observação'] || row['observation'] || '';

        if (local && value > 0) {
          let parsedDate = date;
          if (typeof date === 'number') {
            const dateObj = new Date((date - 25569) * 86400 * 1000);
            const y = dateObj.getUTCFullYear();
            const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
            const d = String(dateObj.getUTCDate()).padStart(2, '0');
            parsedDate = `${y}-${m}-${d}`;
          }

          onAdd({
            date: parsedDate,
            category: category as Category,
            local,
            value,
            paymentMethod,
            installments: paymentMethod === 'Cartão' ? installments : undefined,
            donor: paymentMethod === 'doação' ? donor : undefined,
            observation: observation || undefined
          });
        }
      });
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Data': '2024-03-22',
        'Categoria': 'Material',
        'Local': 'Leroy Merlin',
        'Valor': 150.50,
        'Forma de Pagamento': 'Pix',
        'Parcelas': '',
        'Doador': '',
        'Observação': 'Compra de tintas'
      },
      {
        'Data': '2024-03-23',
        'Categoria': 'Mão de Obra',
        'Local': 'Pedreiro João',
        'Valor': 500.00,
        'Forma de Pagamento': 'Cartão',
        'Parcelas': 3,
        'Doador': '',
        'Observação': 'Semana 1'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "template_saidas.xlsx");
  };

  const handleShare = async () => {
    const url = `${window.location.origin}?shared=true`;
    const text = `Olá! Use este link para lançar as saídas da obra em tempo real: ${url}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Lançamento de Saídas',
          text: text,
          url: url,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
          window.open(whatsappUrl, '_blank');
        }
      }
    } else {
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  const sortedExpenses = [...expenses].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-sm">Saídas</h2>
          <p className="text-slate-400 font-medium tracking-wide">Lance suas despesas aqui</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isSharedMode && (
            <>
              <button 
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all ring-1 ring-white/5 shadow-lg"
                title="Baixar modelo Excel"
              >
                <Download size={16} />
                Modelo
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-emerald-500/20 hover:text-emerald-300 transition-all border border-emerald-500/20 ring-1 ring-emerald-500/10 shadow-lg"
              >
                <FileUp size={16} />
                Carregar em Massa
              </button>
              <button 
                onClick={handleShare}
                className="flex items-center gap-2 bg-blue-500/10 text-blue-400 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-blue-500/20 hover:text-blue-300 transition-all border border-blue-500/20 ring-1 ring-blue-500/10 shadow-lg"
              >
                <Share2 size={16} />
                Compartilhar Link
              </button>
            </>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleBulkUpload} 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
          />
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 p-6 h-fit lg:sticky lg:top-24 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500/10 rounded-lg ring-1 ring-emerald-500/20">
              <Plus size={18} className="text-emerald-400" />
            </div>
            {editingId ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Data</label>
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Categoria</label>
              <select 
                required
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as Category })}
                className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
              >
                <option value="" disabled className="text-slate-500">Selecione...</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-900">{cat}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Local</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Leroy Merlin"
                value={formData.local}
                onChange={e => setFormData({ ...formData, local: e.target.value })}
                className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <label className="block text-[10px] font-bold uppercase text-slate-400">Valor R$</label>
                {!editingId && (
                  <button
                    type="button"
                    onClick={() => setIsSplitPayment(!isSplitPayment)}
                    className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md hover:bg-emerald-500/20 transition-colors ring-1 ring-emerald-500/20"
                  >
                    {isSplitPayment ? 'Pagamento Único' : '2 Formas de Pagamento'}
                  </button>
                )}
              </div>
              
              {!isSplitPayment ? (
                <div className="space-y-4">
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    placeholder="0,00"
                    value={formData.value}
                    onChange={e => setFormData({ ...formData, value: e.target.value })}
                    className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
                  />
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Forma de Pagamento</label>
                    <select 
                      required
                      value={formData.paymentMethod}
                      onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                      className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
                    >
                      <option value="" disabled className="text-slate-500">Selecione...</option>
                      {PAYMENT_METHODS.map(pm => <option key={pm} value={pm} className="bg-slate-900">{pm}</option>)}
                    </select>
                  </div>

                  {formData.paymentMethod === 'Cartão' && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Parcelas</label>
                      <select 
                        value={formData.installments}
                        onChange={e => setFormData({ ...formData, installments: parseInt(e.target.value) })}
                        className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n} className="bg-slate-900">{n}x</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.paymentMethod === 'doação' && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Doador</label>
                      <select 
                        value={formData.donor}
                        onChange={e => setFormData({ ...formData, donor: e.target.value as Donor })}
                        className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
                      >
                        <option value="" disabled className="text-slate-500">Selecione...</option>
                        {DONORS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4 p-4 bg-slate-950/50 rounded-xl border border-slate-700/50">
                  {/* Pagamento 1 */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-1.5">Pagamento 01</h4>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      placeholder="Valor 01"
                      value={splitData.value1}
                      onChange={e => setSplitData({ ...splitData, value1: e.target.value })}
                      className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
                    />
                    <select 
                      required
                      value={splitData.paymentMethod1}
                      onChange={e => setSplitData({ ...splitData, paymentMethod1: e.target.value as PaymentMethod })}
                      className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
                    >
                      <option value="" disabled className="text-slate-500">Forma de Pagamento 01...</option>
                      {PAYMENT_METHODS.map(pm => <option key={pm} value={pm} className="bg-slate-900">{pm}</option>)}
                    </select>
                    
                    {splitData.paymentMethod1 === 'Cartão' && (
                      <select 
                        value={splitData.installments1}
                        onChange={e => setSplitData({ ...splitData, installments1: parseInt(e.target.value) })}
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n} className="bg-slate-900">{n}x</option>
                        ))}
                      </select>
                    )}
                    {splitData.paymentMethod1 === 'doação' && (
                      <select 
                        value={splitData.donor1}
                        onChange={e => setSplitData({ ...splitData, donor1: e.target.value as Donor })}
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
                      >
                        <option value="" disabled className="text-slate-500">Doador 01...</option>
                        {DONORS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                      </select>
                    )}
                  </div>

                  {/* Pagamento 2 */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-1.5">Pagamento 02</h4>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      placeholder="Valor 02"
                      value={splitData.value2}
                      onChange={e => setSplitData({ ...splitData, value2: e.target.value })}
                      className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600"
                    />
                    <select 
                      required
                      value={splitData.paymentMethod2}
                      onChange={e => setSplitData({ ...splitData, paymentMethod2: e.target.value as PaymentMethod })}
                      className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
                    >
                      <option value="" disabled className="text-slate-500">Forma de Pagamento 02...</option>
                      {PAYMENT_METHODS.map(pm => <option key={pm} value={pm} className="bg-slate-900">{pm}</option>)}
                    </select>
                    
                    {splitData.paymentMethod2 === 'Cartão' && (
                      <select 
                        value={splitData.installments2}
                        onChange={e => setSplitData({ ...splitData, installments2: parseInt(e.target.value) })}
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n} className="bg-slate-900">{n}x</option>
                        ))}
                      </select>
                    )}
                    {splitData.paymentMethod2 === 'doação' && (
                      <select 
                        value={splitData.donor2}
                        onChange={e => setSplitData({ ...splitData, donor2: e.target.value as Donor })}
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none"
                      >
                        <option value="" disabled className="text-slate-500">Doador 02...</option>
                        {DONORS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                      </select>
                    )}
                  </div>
                  
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex justify-between items-center text-sm font-bold text-white">
                      <span>Valor Total:</span>
                      <span className="text-emerald-400">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          (parseFloat(splitData.value1) || 0) + (parseFloat(splitData.value2) || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Observação (Opcional)</label>
              <textarea 
                placeholder="Detalhes adicionais..."
                value={formData.observation}
                onChange={e => setFormData({ ...formData, observation: e.target.value })}
                rows={2}
                className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all resize-none placeholder:text-slate-600"
              />
            </div>

            <button type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2 ring-1 ring-emerald-400/30"
            >
              {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
              {editingId ? "Salvar Alterações" : "Lançar Despesa"}
            </button>
            {editingId && (
              <button 
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    date: '',
                    category: '' as Category,
                    local: '',
                    value: '',
                    paymentMethod: '' as PaymentMethod,
                    installments: 1,
                    donor: '' as Donor,
                    observation: ''
                  });
                }}
                className="w-full bg-slate-800/80 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-700 hover:text-white transition-all mt-2 border border-slate-600"
              >
                Cancelar Edição
              </button>
            )}
          </form>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-bold text-white mb-4">Últimos Lançamentos</h3>
          {sortedExpenses.length === 0 ? (
            <div className="bg-slate-900/40 rounded-2xl p-12 text-center text-slate-400 border border-dashed border-slate-700/50">
              Nenhuma despesa lançada ainda.
            </div>
          ) : (
            sortedExpenses.map((exp) => (
              <Card key={exp.id} className="bg-slate-900/40 backdrop-blur-md border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-800/60 transition-all ring-1 ring-white/5">
                <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto overflow-hidden">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ring-1",
                    exp.paymentMethod === 'Cartão' ? "bg-blue-500/10 text-blue-400 ring-blue-500/20" : 
                    exp.paymentMethod === 'doação' ? "bg-purple-500/10 text-purple-400 ring-purple-500/20" : 
                    exp.paymentMethod === 'Caixa' ? "bg-amber-500/10 text-amber-400 ring-amber-500/20" : "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                  )}>
                    {exp.paymentMethod === 'Cartão' ? <CreditCard size={20} /> : 
                     exp.paymentMethod === 'doação' ? <User size={20} /> : 
                     exp.paymentMethod === 'Caixa' ? <Wallet size={20} /> : <Wallet size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-slate-200 truncate">{exp.local}</h4>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-[11px] text-slate-400 uppercase font-semibold tracking-wider">
                      <span>{exp.date ? exp.date.split('-').reverse().join('/') : '-'}</span>
                      <span className="hidden sm:inline text-slate-600">•</span>
                      <span className="text-slate-300">{exp.category}</span>
                      {exp.paymentMethod === 'Cartão' && (
                        <>
                          <span className="hidden sm:inline text-slate-600">•</span>
                          <span className="text-blue-400">Cartão ({exp.installments}x)</span>
                        </>
                      )}
                      {exp.paymentMethod === 'doação' && (
                        <>
                          <span className="hidden sm:inline text-slate-600">•</span>
                          <span className="text-purple-400">Doador: {exp.donor}</span>
                        </>
                      )}
                      {exp.paymentMethod === 'Pix' && (
                        <>
                          <span className="hidden sm:inline text-slate-600">•</span>
                          <span className="text-emerald-400">Pix</span>
                        </>
                      )}
                      {exp.paymentMethod === 'Caixa' && (
                        <>
                          <span className="hidden sm:inline text-slate-600">•</span>
                          <span className="text-amber-400">Caixa</span>
                        </>
                      )}
                    </div>
                    {exp.observation && (
                      <p className="text-sm text-slate-400 mt-1.5 italic truncate bg-slate-950/30 px-2 py-1 rounded-md inline-block max-w-full">"{exp.observation}"</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-3 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-800">
                  <span className="font-mono font-bold text-lg text-white bg-slate-950/50 px-3 py-1.5 rounded-lg border border-slate-800">{formatCurrency(exp.value)}</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEditClick(exp)}
                      className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => onDelete(exp.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      <ConfirmDialog 
        isOpen={isConfirmingEdit}
        title="Salvar Alterações"
        message="Tem certeza que deseja salvar as alterações desta saída?"
        onConfirm={confirmEdit}
        onCancel={() => {
          setIsConfirmingEdit(false);
          setPendingEditData(null);
        }}
        confirmText="Salvar"
        confirmStyle="primary"
      />
    </div>
  );
}
