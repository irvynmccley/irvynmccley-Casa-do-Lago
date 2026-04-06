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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.category || !formData.local || !formData.value || !formData.paymentMethod) return;

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
        // Map Excel columns to Expense object
        // Expected columns: Data, Categoria, Local, Valor, Forma de Pagamento, Parcelas, Doador, Observação
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
        // If user cancels share, ignore
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Saídas</h2>
          <p className="text-black">Lance suas despesas aqui</p>
        </div>
        <div className="flex items-center gap-2">
          {!isSharedMode && (
            <>
              <button 
                onClick={downloadTemplate}
                className="flex items-center gap-2 bg-white border border-black/5 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-all text-black"
                title="Baixar modelo Excel"
              >
                <Download size={16} />
                Modelo
              </button>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 bg-emerald-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20"
              >
                <FileUp size={16} />
                Carregar em Massa
              </button>
              <button 
                onClick={handleShare}
                className="flex items-center gap-2 bg-blue-500 text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
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
        <Card className="bg-white p-6 h-fit lg:sticky lg:top-24">
          <h3 className="text-lg font-semibold mb-6">Novo Lançamento</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-black mb-1">Data</label>
              <input 
                type="date" 
                required
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-black mb-1">Categoria</label>
              <select 
                required
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as Category })}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              >
                <option value="" disabled>Selecione...</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-black mb-1">Local</label>
              <input 
                type="text" 
                required
                placeholder="Ex: Leroy Merlin"
                value={formData.local}
                onChange={e => setFormData({ ...formData, local: e.target.value })}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-black mb-1">Valor R$</label>
              <input 
                type="number" 
                step="0.01"
                required
                placeholder="0,00"
                value={formData.value}
                onChange={e => setFormData({ ...formData, value: e.target.value })}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-black mb-1">Forma de Pagamento</label>
              <select 
                required
                value={formData.paymentMethod}
                onChange={e => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              >
                <option value="" disabled>Selecione...</option>
                {PAYMENT_METHODS.map(pm => <option key={pm} value={pm}>{pm}</option>)}
              </select>
            </div>

            {formData.paymentMethod === 'Cartão' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold uppercase text-black mb-1">Parcelas</label>
                <select 
                  value={formData.installments}
                  onChange={e => setFormData({ ...formData, installments: parseInt(e.target.value) })}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n}x</option>
                  ))}
                </select>
              </div>
            )}

            {formData.paymentMethod === 'doação' && (
              <div className="animate-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold uppercase text-black mb-1">Doador</label>
                <select 
                  value={formData.donor}
                  onChange={e => setFormData({ ...formData, donor: e.target.value as Donor })}
                  className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                >
                  <option value="" disabled>Selecione...</option>
                  {DONORS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase text-black mb-1">Observação (Opcional)</label>
              <textarea 
                placeholder="Detalhes adicionais..."
                value={formData.observation}
                onChange={e => setFormData({ ...formData, observation: e.target.value })}
                rows={2}
                className="w-full bg-gray-50 border border-black/5 rounded-xl px-4 py-3 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
              />
            </div>

            <button type="submit"
              className="w-full bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
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
                className="w-full bg-gray-200 text-gray-700 font-bold py-3 rounded-xl hover:bg-gray-300 transition-all mt-2"
              >
                Cancelar Edição
              </button>
            )}
          </form>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold mb-4">Últimos Lançamentos</h3>
          {sortedExpenses.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-black border border-dashed border-gray-200">
              Nenhuma despesa lançada ainda.
            </div>
          ) : (
            sortedExpenses.map((exp) => (
              <Card key={exp.id} className="bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:shadow-md transition-all">
                <div className="flex items-start sm:items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    exp.paymentMethod === 'Cartão' ? "bg-blue-100 text-blue-600" : 
                    exp.paymentMethod === 'doação' ? "bg-purple-100 text-purple-600" : 
                    exp.paymentMethod === 'Caixa' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                  )}>
                    {exp.paymentMethod === 'Cartão' ? <CreditCard size={20} /> : 
                     exp.paymentMethod === 'doação' ? <User size={20} /> : 
                     exp.paymentMethod === 'Caixa' ? <Wallet size={20} /> : <Wallet size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold truncate">{exp.local}</h4>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs text-black">
                      <span>{exp.date ? exp.date.split('-').reverse().join('/') : '-'}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="capitalize">{exp.category}</span>
                      {exp.paymentMethod === 'Cartão' && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-blue-500 font-medium">Cartão ({exp.installments}x)</span>
                        </>
                      )}
                      {exp.paymentMethod === 'doação' && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-purple-500 font-medium">Doador: {exp.donor}</span>
                        </>
                      )}
                      {exp.paymentMethod === 'Pix' && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-emerald-500 font-medium">Pix</span>
                        </>
                      )}
                      {exp.paymentMethod === 'Caixa' && (
                        <>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-amber-500 font-medium">Caixa</span>
                        </>
                      )}
                    </div>
                    {exp.observation && (
                      <p className="text-sm text-black mt-1 italic truncate">"{exp.observation}"</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                  <span className="font-mono font-bold text-lg">{formatCurrency(exp.value)}</span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEditClick(exp)}
                      className="p-2 text-black hover:text-blue-500 transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button 
                      onClick={() => onDelete(exp.id)}
                      className="p-2 text-black hover:text-red-500 transition-colors"
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
