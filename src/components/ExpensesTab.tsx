import React, { useState, useRef, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  CreditCard, 
  User, 
  Wallet, 
  FileUp, 
  Download, 
  Share2, 
  Edit2, 
  Search, 
  RotateCcw, 
  Check, 
  CheckCircle2, 
  Clock, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { Expense, Category, PaymentMethod, Donor, Person, RefundStatus } from '../types';
import { Card } from './ui/Card';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { formatAuditId, copyAuditIdToClipboard } from '../utils/audit';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES: Category[] = ['Combustível', 'Documentação', 'Material', 'Mão de Obra', 'Monitoramento', 'Alimentação'];
const PAYMENT_METHODS: PaymentMethod[] = ['Pix', 'Cartão', 'doação', 'Caixa'];
const DONORS: Donor[] = ['Jorge', 'Jane', 'Saulo', 'Mccley', 'Jan'];
const REIMBURSE_PEOPLE: Person[] = ['Mccley', 'Jan', 'Saulo', 'Jorge'];

interface ExpensesTabProps {
  expenses: Expense[];
  onAdd: (e: Omit<Expense, 'id'>) => Promise<void> | void;
  onEdit: (id: string, e: Partial<Omit<Expense, 'id'>>) => Promise<void> | void;
  onDelete: (id: string) => void;
  onToggleRefund?: (id: string) => void;
  formatCurrency: (v: number) => string;
  isSharedMode?: boolean;
}

export function ExpensesTab({ 
  expenses, 
  onAdd, 
  onEdit, 
  onDelete, 
  onToggleRefund,
  formatCurrency, 
  isSharedMode 
}: ExpensesTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'reimbursements'>('all');
  const [isConfirmingEdit, setIsConfirmingEdit] = useState(false);
  const [pendingEditData, setPendingEditData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getTodayDate = () => format(new Date(), 'yyyy-MM-dd');

  const [formData, setFormData] = useState({
    date: getTodayDate(),
    category: '' as Category,
    local: '',
    value: '',
    paymentMethod: '' as PaymentMethod,
    installments: 1,
    donor: '' as Donor,
    isReimbursement: false,
    reimburseTo: 'Mccley' as Person,
    refundStatus: 'Pendente' as RefundStatus,
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

  // Resumo de Reembolsos Pendentes
  const pendingRefunds = useMemo(() => {
    return expenses.filter(e => e.isReimbursement && e.refundStatus === 'Pendente');
  }, [expenses]);

  const totalPendingRefundValue = useMemo(() => {
    return pendingRefunds.reduce((acc, exp) => acc + (exp.value || 0), 0);
  }, [pendingRefunds]);

  const resetForm = () => {
    setFormData({
      date: getTodayDate(),
      category: '' as Category,
      local: '',
      value: '',
      paymentMethod: '' as PaymentMethod,
      installments: 1,
      donor: '' as Donor,
      isReimbursement: false,
      reimburseTo: 'Mccley' as Person,
      refundStatus: 'Pendente' as RefundStatus,
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
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Trava contra cliques múltiplos

    if (!formData.date || !formData.category || !formData.local) {
      toast.error('Preencha os campos obrigatórios (Data, Categoria e Local)');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSplitPayment) {
        if (!splitData.value1 || !splitData.paymentMethod1 || !splitData.value2 || !splitData.paymentMethod2) {
          toast.error('Informe os valores e formas de pagamento de ambas as partes');
          setIsSubmitting(false);
          return;
        }

        const baseOriginalId = `split_${Date.now()}`;

        const expense1: Omit<Expense, 'id'> = {
          date: formData.date,
          category: formData.category,
          local: formData.local,
          value: parseFloat(splitData.value1),
          paymentMethod: splitData.paymentMethod1,
          installments: splitData.paymentMethod1 === 'Cartão' ? splitData.installments1 : undefined,
          donor: splitData.paymentMethod1 === 'doação' ? splitData.donor1 : undefined,
          observation: formData.observation ? `${formData.observation} (Parte 1)` : '(Parte 1)',
          isReimbursement: formData.isReimbursement,
          reimburseTo: formData.isReimbursement ? formData.reimburseTo : undefined,
          refundStatus: formData.isReimbursement ? formData.refundStatus : undefined,
          original_id: `${baseOriginalId}_1`
        };

        const expense2: Omit<Expense, 'id'> = {
          date: formData.date,
          category: formData.category,
          local: formData.local,
          value: parseFloat(splitData.value2),
          paymentMethod: splitData.paymentMethod2,
          installments: splitData.paymentMethod2 === 'Cartão' ? splitData.installments2 : undefined,
          donor: splitData.paymentMethod2 === 'doação' ? splitData.donor2 : undefined,
          observation: formData.observation ? `${formData.observation} (Parte 2)` : '(Parte 2)',
          isReimbursement: formData.isReimbursement,
          reimburseTo: formData.isReimbursement ? formData.reimburseTo : undefined,
          refundStatus: formData.isReimbursement ? formData.refundStatus : undefined,
          original_id: `${baseOriginalId}_2`
        };

        await onAdd(expense1);
        await onAdd(expense2);
        resetForm();
      } else {
        if (!formData.value || !formData.paymentMethod) {
          toast.error('Informe o valor e a forma de pagamento');
          setIsSubmitting(false);
          return;
        }

        const originalId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        const expenseData: Omit<Expense, 'id'> = {
          date: formData.date,
          category: formData.category,
          local: formData.local,
          value: parseFloat(formData.value),
          paymentMethod: formData.paymentMethod,
          installments: formData.paymentMethod === 'Cartão' ? formData.installments : undefined,
          donor: formData.paymentMethod === 'doação' ? formData.donor : undefined,
          observation: formData.observation || undefined,
          isReimbursement: formData.isReimbursement,
          reimburseTo: formData.isReimbursement ? formData.reimburseTo : undefined,
          refundStatus: formData.isReimbursement ? formData.refundStatus : undefined,
          original_id: originalId
        };

        if (editingId) {
          setPendingEditData(expenseData);
          setIsConfirmingEdit(true);
        } else {
          await onAdd(expenseData);
          resetForm();
        }
      }
    } catch (err: any) {
      console.error("Erro ao salvar despesa:", err);
      toast.error("Ocorreu um erro ao salvar a despesa. Tente novamente.");
    } finally {
      setTimeout(() => {
        setIsSubmitting(false);
      }, 700);
    }
  };

  const confirmEdit = async () => {
    if (editingId && pendingEditData) {
      setIsSubmitting(true);
      try {
        await onEdit(editingId, pendingEditData);
        setEditingId(null);
        setPendingEditData(null);
        setIsConfirmingEdit(false);
        resetForm();
      } catch (err) {
        console.error("Erro ao editar despesa:", err);
        toast.error("Ocorreu um erro ao salvar as alterações.");
      } finally {
        setTimeout(() => setIsSubmitting(false), 500);
      }
    }
  };

  const handleEditClick = (exp: Expense) => {
    setEditingId(exp.id);
    setFormData({
      date: exp.date || getTodayDate(),
      category: exp.category,
      local: exp.local,
      value: exp.value.toString(),
      paymentMethod: exp.paymentMethod,
      installments: exp.installments || 1,
      donor: exp.donor || 'Jorge',
      isReimbursement: Boolean(exp.isReimbursement),
      reimburseTo: exp.reimburseTo || (exp.donor as Person) || 'Mccley',
      refundStatus: exp.refundStatus || (exp.status === 'DEVOLVIDO' ? 'Devolvido' : 'Pendente'),
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

  const filteredExpenses = useMemo(() => {
    let list = [...expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (filterMode === 'reimbursements') {
      list = list.filter(e => e.isReimbursement);
    }

    if (!searchTerm.trim()) return list;

    const term = searchTerm.toLowerCase().trim();
    return list.filter(exp => {
      const auditId = formatAuditId('EXP', exp.id).toLowerCase();
      const local = (exp.local || '').toLowerCase();
      const obs = (exp.observation || '').toLowerCase();
      const cat = (exp.category || '').toLowerCase();
      const method = (exp.paymentMethod || '').toLowerCase();
      const donor = (exp.donor || '').toLowerCase();
      const reimburseTo = (exp.reimburseTo || '').toLowerCase();
      const isReimbKeyword = exp.isReimbursement ? 'reembolso devolver ressarcimento' : '';
      return (
        auditId.includes(term) ||
        local.includes(term) ||
        obs.includes(term) ||
        cat.includes(term) ||
        method.includes(term) ||
        donor.includes(term) ||
        reimburseTo.includes(term) ||
        isReimbKeyword.includes(term)
      );
    });
  }, [expenses, searchTerm, filterMode]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-sm">Saídas</h2>
          <p className="text-slate-400 font-medium tracking-wide">Lance suas despesas com segurança e controle de devolução</p>
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

      {/* Card Informativo de Reembolsos Pendentes */}
      {totalPendingRefundValue > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-600/5 to-transparent border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ring-1 ring-amber-500/20 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <RotateCcw size={20} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Ressarcimentos a Sócios</span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                  {pendingRefunds.length} {pendingRefunds.length === 1 ? 'pendência' : 'pendências'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Despesas pagas por sócios que devem ser ressarcidas pelo caixa da obra.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total a Devolver</span>
              <span className="text-lg sm:text-xl font-bold font-mono text-amber-300">{formatCurrency(totalPendingRefundValue)}</span>
            </div>
            <button
              type="button"
              onClick={() => setFilterMode(prev => prev === 'reimbursements' ? 'all' : 'reimbursements')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                filterMode === 'reimbursements'
                  ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                  : "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
              )}
            >
              {filterMode === 'reimbursements' ? 'Ver Todas' : 'Filtrar Devoluções'}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 ring-1 ring-white/5 p-6 h-fit lg:sticky lg:top-24 shadow-xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <div className="p-1.5 bg-emerald-500/10 rounded-lg ring-1 ring-emerald-500/20">
                <Plus size={18} className="text-emerald-400" />
              </div>
              {editingId ? 'Editar Lançamento' : 'Novo Lançamento'}
            </h3>
            {editingId && (
              <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                Editando
              </span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* DATA */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <label className="block text-[10px] font-bold uppercase text-slate-400">Data</label>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, date: getTodayDate() }))}
                  className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                  title="Definir data como hoje"
                >
                  <Calendar size={11} />
                  Hoje
                </button>
              </div>
              <input 
                type="date" 
                required
                disabled={isSubmitting}
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
              />
            </div>

            {/* CATEGORIA */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Categoria</label>
              <select 
                required
                disabled={isSubmitting}
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as Category })}
                className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
              >
                <option value="" disabled className="text-slate-500">Selecione uma categoria...</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat} className="bg-slate-900">{cat}</option>)}
              </select>
            </div>

            {/* LOCAL */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Local / Fornecedor</label>
              <input 
                type="text" 
                required
                disabled={isSubmitting}
                placeholder="Ex: Leroy Merlin, Posto Ipiranga..."
                value={formData.local}
                onChange={e => setFormData({ ...formData, local: e.target.value })}
                className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50"
              />
            </div>

            {/* VALOR E FORMA DE PAGAMENTO */}
            <div>
              <div className="flex items-center justify-between mb-1.5 px-1">
                <label className="block text-[10px] font-bold uppercase text-slate-400">Valor R$</label>
                {!editingId && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsSplitPayment(!isSplitPayment)}
                    className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md hover:bg-emerald-500/20 transition-colors ring-1 ring-emerald-500/20"
                  >
                    {isSplitPayment ? 'Pagamento Único' : '2 Formas de Pagamento'}
                  </button>
                )}
              </div>
              
              {!isSplitPayment ? (
                <div className="space-y-4">
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      disabled={isSubmitting}
                      placeholder="0,00"
                      value={formData.value}
                      onChange={e => setFormData({ ...formData, value: e.target.value })}
                      className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50 font-mono text-base font-semibold"
                    />
                    {parseFloat(formData.value) > 0 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 pointer-events-none">
                        {formatCurrency(parseFloat(formData.value))}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Forma de Pagamento</label>
                    <select 
                      required
                      disabled={isSubmitting}
                      value={formData.paymentMethod}
                      onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                      className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
                    >
                      <option value="" disabled className="text-slate-500">Selecione a forma de pagamento...</option>
                      {PAYMENT_METHODS.map(pm => <option key={pm} value={pm} className="bg-slate-900">{pm}</option>)}
                    </select>
                  </div>

                  {formData.paymentMethod === 'Cartão' && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Parcelas do Cartão</label>
                      <select 
                        disabled={isSubmitting}
                        value={formData.installments}
                        onChange={e => setFormData({ ...formData, installments: parseInt(e.target.value) })}
                        className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n} className="bg-slate-900">
                            {n}x {formData.value ? `(${formatCurrency(parseFloat(formData.value) / n)}/mês)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {formData.paymentMethod === 'doação' && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Doador (Não gera rateio)</label>
                      <select 
                        disabled={isSubmitting}
                        value={formData.donor}
                        onChange={e => setFormData({ ...formData, donor: e.target.value as Donor })}
                        className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
                      >
                        <option value="" disabled className="text-slate-500">Selecione o doador...</option>
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
                      disabled={isSubmitting}
                      placeholder="Valor 01"
                      value={splitData.value1}
                      onChange={e => setSplitData({ ...splitData, value1: e.target.value })}
                      className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50 font-mono text-sm"
                    />
                    <select 
                      required
                      disabled={isSubmitting}
                      value={splitData.paymentMethod1}
                      onChange={e => setSplitData({ ...splitData, paymentMethod1: e.target.value as PaymentMethod })}
                      className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
                    >
                      <option value="" disabled className="text-slate-500">Forma de Pagamento 01...</option>
                      {PAYMENT_METHODS.map(pm => <option key={pm} value={pm} className="bg-slate-900">{pm}</option>)}
                    </select>
                    
                    {splitData.paymentMethod1 === 'Cartão' && (
                      <select 
                        disabled={isSubmitting}
                        value={splitData.installments1}
                        onChange={e => setSplitData({ ...splitData, installments1: parseInt(e.target.value) })}
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n} className="bg-slate-900">{n}x</option>
                        ))}
                      </select>
                    )}
                    {splitData.paymentMethod1 === 'doação' && (
                      <select 
                        disabled={isSubmitting}
                        value={splitData.donor1}
                        onChange={e => setSplitData({ ...splitData, donor1: e.target.value as Donor })}
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
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
                      disabled={isSubmitting}
                      placeholder="Valor 02"
                      value={splitData.value2}
                      onChange={e => setSplitData({ ...splitData, value2: e.target.value })}
                      className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-600 disabled:opacity-50 font-mono text-sm"
                    />
                    <select 
                      required
                      disabled={isSubmitting}
                      value={splitData.paymentMethod2}
                      onChange={e => setSplitData({ ...splitData, paymentMethod2: e.target.value as PaymentMethod })}
                      className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
                    >
                      <option value="" disabled className="text-slate-500">Forma de Pagamento 02...</option>
                      {PAYMENT_METHODS.map(pm => <option key={pm} value={pm} className="bg-slate-900">{pm}</option>)}
                    </select>
                    
                    {splitData.paymentMethod2 === 'Cartão' && (
                      <select 
                        disabled={isSubmitting}
                        value={splitData.installments2}
                        onChange={e => setSplitData({ ...splitData, installments2: parseInt(e.target.value) })}
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n} className="bg-slate-900">{n}x</option>
                        ))}
                      </select>
                    )}
                    {splitData.paymentMethod2 === 'doação' && (
                      <select 
                        disabled={isSubmitting}
                        value={splitData.donor2}
                        onChange={e => setSplitData({ ...splitData, donor2: e.target.value as Donor })}
                        className="w-full bg-slate-900/50 border border-slate-700/50 text-white rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all appearance-none disabled:opacity-50"
                      >
                        <option value="" disabled className="text-slate-500">Doador 02...</option>
                        {DONORS.map(d => <option key={d} value={d} className="bg-slate-900">{d}</option>)}
                      </select>
                    )}
                  </div>
                  
                  <div className="pt-3 border-t border-slate-800">
                    <div className="flex justify-between items-center text-sm font-bold text-white">
                      <span>Valor Total:</span>
                      <span className="text-emerald-400 font-mono">
                        {formatCurrency(
                          (parseFloat(splitData.value1) || 0) + (parseFloat(splitData.value2) || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MÓDULO EXCLUSIVO: DESPESA A DEVOLVER (REEMBOLSO / ADIANTAMENTO DE SÓCIO) */}
            {formData.paymentMethod !== 'doação' && (
              <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-700/60 space-y-3 ring-1 ring-white/5 transition-all">
                <div className="flex items-center justify-between">
                  <label htmlFor="isReimbursement" className="flex items-center gap-2.5 cursor-pointer select-none">
                    <div className={cn(
                      "w-5 h-5 rounded-md flex items-center justify-center transition-all",
                      formData.isReimbursement ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30" : "bg-slate-800 border border-slate-600"
                    )}>
                      {formData.isReimbursement && <Check size={14} className="stroke-[3]" />}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <RotateCcw size={13} className="text-amber-400" />
                        Valor a Devolver (Reembolso)
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Pago do bolso de um sócio; deve ser ressarcido pelo caixa.
                      </p>
                    </div>
                  </label>
                  <input 
                    type="checkbox"
                    id="isReimbursement"
                    disabled={isSubmitting}
                    checked={formData.isReimbursement}
                    onChange={e => setFormData({ ...formData, isReimbursement: e.target.checked })}
                    className="sr-only"
                  />
                </div>

                {formData.isReimbursement && (
                  <div className="pt-3 border-t border-slate-800/80 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-amber-400 mb-1.5 px-0.5">
                        Quem pagou? (Devolver para)
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        {REIMBURSE_PEOPLE.map(person => (
                          <button
                            key={person}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setFormData({ ...formData, reimburseTo: person })}
                            className={cn(
                              "py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center border",
                              formData.reimburseTo === person 
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm" 
                                : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                            )}
                          >
                            {person}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-0.5">
                        Status do Ressarcimento
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setFormData({ ...formData, refundStatus: 'Pendente' })}
                          className={cn(
                            "py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center border flex items-center justify-center gap-1.5",
                            formData.refundStatus === 'Pendente'
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-500/20"
                              : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                          )}
                        >
                          <Clock size={12} />
                          Pendente (A Devolver)
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => setFormData({ ...formData, refundStatus: 'Devolvido' })}
                          className={cn(
                            "py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center border flex items-center justify-center gap-1.5",
                            formData.refundStatus === 'Devolvido'
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 ring-1 ring-emerald-500/20"
                              : "bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200"
                          )}
                        >
                          <CheckCircle2 size={12} />
                          Já Devolvido
                        </button>
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-start gap-2">
                      <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-300/90 leading-tight">
                        Este valor entra nos custos totais da obra e alimenta os gráficos normalmente, ficando sinalizado para devolução ao sócio.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* OBSERVAÇÃO */}
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 px-1">Observação (Opcional)</label>
              <textarea 
                placeholder="Ex: Compra de emergência, detalhes da nota..."
                disabled={isSubmitting}
                value={formData.observation}
                onChange={e => setFormData({ ...formData, observation: e.target.value })}
                rows={2}
                className="w-full bg-slate-950/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all resize-none placeholder:text-slate-600 disabled:opacity-50 text-sm"
              />
            </div>

            {/* BOTÃO DE SALVAMENTO COM TRAVA ANTI-DUPLICAÇÃO */}
            <button 
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-400 transition-all flex items-center justify-center gap-2 ring-1 ring-emerald-400/30",
                isSubmitting && "opacity-75 cursor-not-allowed pointer-events-none"
              )}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Processando e Salvando...</span>
                </>
              ) : (
                <>
                  {editingId ? <Edit2 size={20} /> : <Plus size={20} />}
                  <span>{editingId ? "Salvar Alterações" : "Lançar Despesa"}</span>
                </>
              )}
            </button>

            {editingId && (
              <button 
                type="button"
                disabled={isSubmitting}
                onClick={resetForm}
                className="w-full bg-slate-800/80 text-slate-300 font-bold py-3 rounded-xl hover:bg-slate-700 hover:text-white transition-all mt-2 border border-slate-600"
              >
                Cancelar Edição
              </button>
            )}
          </form>
        </Card>

        {/* LISTAGEM DE SAÍDAS */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-bold text-white">Últimos Lançamentos</h3>
              <span className="text-xs font-mono font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                {filteredExpenses.length}
              </span>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar local, sócio, #EXP..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-900/60 border border-slate-700/60 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {pendingRefunds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode(prev => prev === 'reimbursements' ? 'all' : 'reimbursements')}
                  title={filterMode === 'reimbursements' ? "Mostrar todas as saídas" : "Filtrar apenas reembolsos"}
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5",
                    filterMode === 'reimbursements'
                      ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md"
                      : "bg-slate-900/60 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                  )}
                >
                  <RotateCcw size={13} />
                  <span className="hidden xs:inline">Devoluções</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/30 text-amber-300">
                    {pendingRefunds.length}
                  </span>
                </button>
              )}
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="bg-slate-900/40 rounded-xl p-8 text-center text-slate-400 border border-dashed border-slate-800">
              {searchTerm || filterMode === 'reimbursements' 
                ? "Nenhum lançamento encontrado para os filtros selecionados." 
                : "Nenhuma despesa lançada ainda."}
            </div>
          ) : (
            <div className="space-y-1.5 sm:space-y-2">
              {filteredExpenses.map((exp) => {
                const auditId = formatAuditId('EXP', exp.id);
                return (
                  <div 
                    key={exp.id} 
                    className={cn(
                      "bg-slate-900/50 hover:bg-slate-800/50 backdrop-blur-md border px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl flex items-center justify-between gap-2.5 sm:gap-4 group transition-all ring-1 ring-white/5",
                      exp.isReimbursement && exp.refundStatus === 'Pendente' 
                        ? "border-amber-500/40 bg-amber-950/10 hover:bg-amber-950/20" 
                        : "border-slate-800/80 hover:border-slate-700/80"
                    )}
                  >
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ring-1",
                        exp.paymentMethod === 'Cartão' ? "bg-blue-500/10 text-blue-400 ring-blue-500/20" : 
                        exp.paymentMethod === 'doação' ? "bg-purple-500/10 text-purple-400 ring-purple-500/20" : 
                        exp.paymentMethod === 'Caixa' ? "bg-amber-500/10 text-amber-400 ring-amber-500/20" : "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                      )}>
                        {exp.paymentMethod === 'Cartão' ? <CreditCard size={15} /> : 
                         exp.paymentMethod === 'doação' ? <User size={15} /> : 
                         exp.paymentMethod === 'Caixa' ? <Wallet size={15} /> : <Wallet size={15} />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="font-bold text-slate-200 text-xs sm:text-sm truncate max-w-[140px] sm:max-w-[260px]">
                            {exp.local}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => copyAuditIdToClipboard(auditId, e)}
                            title="Clique para copiar ID de auditoria"
                            className="font-mono text-[9px] sm:text-[10px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center"
                          >
                            {auditId}
                          </button>
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700/60 hidden xs:inline">
                            {exp.category}
                          </span>

                          {/* BADGE DE REEMBOLSO / DEVOLUÇÃO */}
                          {exp.isReimbursement && (
                            <button
                              type="button"
                              onClick={() => onToggleRefund && onToggleRefund(exp.id)}
                              title={exp.refundStatus === 'Devolvido' ? "Clique para reabrir como pendente de devolução" : "Clique para marcar como devolvido pelo caixa"}
                              className={cn(
                                "text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm",
                                exp.refundStatus === 'Devolvido'
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 ring-1 ring-amber-500/30"
                              )}
                            >
                              {exp.refundStatus === 'Devolvido' ? (
                                <>
                                  <CheckCircle2 size={11} className="text-emerald-400" />
                                  <span>Devolvido p/ {exp.reimburseTo || exp.donor || 'Sócio'}</span>
                                </>
                              ) : (
                                <>
                                  <RotateCcw size={11} className="text-amber-400 animate-spin-slow" />
                                  <span>Devolver p/ {exp.reimburseTo || exp.donor || 'Sócio'}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 truncate">
                          <span>{exp.date ? exp.date.split('-').reverse().join('/') : '-'}</span>
                          <span className="text-slate-600">•</span>
                          {exp.paymentMethod === 'Cartão' && (
                            <span className="text-blue-400">Cartão {exp.installments ? `(${exp.installments}x)` : ''}</span>
                          )}
                          {exp.paymentMethod === 'doação' && (
                            <span className="text-purple-400">Doação ({exp.donor})</span>
                          )}
                          {exp.paymentMethod === 'Pix' && (
                            <span className="text-emerald-400">Pix</span>
                          )}
                          {exp.paymentMethod === 'Caixa' && (
                            <span className="text-amber-400">Caixa</span>
                          )}
                          {exp.observation && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="italic text-slate-500 truncate max-w-[120px] sm:max-w-[200px]" title={exp.observation}>
                                "{exp.observation}"
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      <span className="font-mono font-bold text-xs sm:text-sm text-white bg-slate-950/60 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-800">
                        {formatCurrency(exp.value)}
                      </span>
                      {!isSharedMode && (
                        <div className="flex items-center gap-0.5">
                          <button 
                            type="button"
                            onClick={() => handleEditClick(exp)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Editar lançamento"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button 
                            type="button"
                            onClick={() => onDelete(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Excluir lançamento"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
