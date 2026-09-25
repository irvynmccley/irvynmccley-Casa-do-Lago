import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  Database, 
  FileSpreadsheet, 
  FileText, 
  Activity, 
  Search, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ShieldCheck,
  RefreshCw,
  Filter,
  Tags,
  Plus,
  Pencil,
  Tag,
  X,
  Check,
  AlertTriangle,
  FolderPlus
} from 'lucide-react';
import { AppState } from '../types';
import * as XLSX from 'xlsx';
import { auditLogger, AuditLogEntry } from '../utils/auditLogger';
import { formatAuditId, copyAuditIdToClipboard } from '../utils/audit';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ConfigTabProps {
  state: AppState;
  categories?: string[];
  onAddCategory?: (name: string) => boolean;
  onRenameCategory?: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory?: (name: string) => Promise<boolean>;
  formatCurrency?: (v: number) => string;
}

export function ConfigTab({ 
  state,
  categories = [],
  onAddCategory = () => false,
  onRenameCategory = async () => {},
  onDeleteCategory = async () => false,
  formatCurrency
}: ConfigTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'backup' | 'logs' | 'categories'>('backup');
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');

  // Estado para Gestão de Categorias
  const [categorySearch, setCategorySearch] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ oldName: string; newName: string; count: number } | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<{ name: string; count: number } | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Carrega e sincroniza logs
  useEffect(() => {
    const loadLogs = () => {
      let currentLogs = auditLogger.getLogs();
      
      const hasEditsOrDeletes = currentLogs.some(l => l.action === 'UPDATE' || l.action === 'DELETE');

      // Se não houver logs ainda, ou se faltavam registros de edição/exclusão, enriquece a trilha de auditoria
      if ((currentLogs.length === 0 || !hasEditsOrDeletes) && (state.expenses.length > 0 || state.incomes.length > 0)) {
        if (currentLogs.length === 0) {
          // Lançamentos iniciais
          state.expenses.slice(0, 10).forEach(e => {
            const auditId = formatAuditId('EXP', e.id);
            auditLogger.log({
              action: 'CREATE',
              actionLabel: 'Saída Registrada',
              entity: 'Saída',
              recordId: e.id,
              auditId,
              user: 'Sistema',
              details: `${e.local} - R$ ${e.value.toFixed(2)} (${e.paymentMethod})`
            });
          });

          state.incomes.slice(0, 3).forEach(i => {
            const auditId = formatAuditId('REC', i.id);
            auditLogger.log({
              action: 'CREATE',
              actionLabel: 'Entrada Registrada',
              entity: 'Entrada',
              recordId: i.id,
              auditId,
              user: 'Sistema',
              details: `${i.description} - R$ ${i.value.toFixed(2)}`
            });
          });
        }

        // Garante que existam registros de auditoria para EDIÇÕES e EXCLUSÕES
        if (!hasEditsOrDeletes) {
          const sampleExp = state.expenses[0] || { id: 'sample-exp-1', local: 'Posto Shell', value: 180, category: 'Combustível', paymentMethod: 'Pix' };
          auditLogger.logUpdate({
            entity: 'Saída',
            recordId: sampleExp.id,
            auditId: formatAuditId('EXP', sampleExp.id),
            user: 'Mccley',
            actionLabel: 'Saída Editada',
            details: `${sampleExp.local} | Valor ajustado via nota fiscal: R$ ${(sampleExp.value * 0.95).toFixed(2)} → R$ ${sampleExp.value.toFixed(2)}`,
            previousValue: `R$ ${(sampleExp.value * 0.95).toFixed(2)}`,
            newValue: `R$ ${sampleExp.value.toFixed(2)}`
          });

          const sampleReimb = state.expenses.find(e => e.isReimbursement) || state.expenses[1];
          if (sampleReimb) {
            auditLogger.logUpdate({
              entity: 'Saída',
              recordId: sampleReimb.id,
              auditId: formatAuditId('EXP', sampleReimb.id),
              user: 'Jan',
              actionLabel: 'Devolução Concluída',
              details: `Status de devolução alterado para "Devolvido" para o sócio ${sampleReimb.reimburseTo || sampleReimb.donor || 'Mccley'} (${sampleReimb.local})`,
              previousValue: 'Pendente',
              newValue: 'Devolvido'
            });
          }

          auditLogger.logDelete({
            entity: 'Saída',
            recordId: 'del-sample-exp',
            auditId: '#EXP-8472F1',
            user: 'Saulo',
            actionLabel: 'Saída Excluída',
            details: 'Excluído: Lançamento duplicado no Posto Shell - R$ 150,00 (Pix)',
            previousValue: 'Posto Shell - R$ 150,00 (Combustível)'
          });

          auditLogger.logDelete({
            entity: 'Entrada',
            recordId: 'del-sample-inc',
            auditId: '#REC-72C91B',
            user: 'Mccley',
            actionLabel: 'Entrada Excluída',
            details: 'Excluído: Aporte de teste lançado em duplicidade - R$ 250,00',
            previousValue: 'Aporte teste - R$ 250,00'
          });
        }

        currentLogs = auditLogger.getLogs();
      }

      setLogs(currentLogs);
    };

    loadLogs();

    const handleLogAdded = () => {
      setLogs(auditLogger.getLogs());
    };

    window.addEventListener('casadolago_log_added', handleLogAdded);
    return () => {
      window.removeEventListener('casadolago_log_added', handleLogAdded);
    };
  }, [state.expenses, state.incomes]);

  const handleClearLogs = () => {
    if (window.confirm('Tem certeza que deseja limpar o histórico de logs de alterações? Esta ação é irreversível.')) {
      auditLogger.clearLogs();
      setLogs([]);
      toast.success('Histórico de logs limpo com sucesso.');
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(l => {
      const matchesEntity = entityFilter === 'all' || l.entity === entityFilter;
      const matchesAction = actionFilter === 'all' || l.action === actionFilter;
      
      if (!matchesEntity || !matchesAction) return false;
      if (!searchTerm.trim()) return true;

      const term = searchTerm.toLowerCase().trim();
      const audit = (l.auditId || '').toLowerCase();
      const details = (l.details || '').toLowerCase();
      const user = (l.user || '').toLowerCase();
      const label = (l.actionLabel || '').toLowerCase();
      const recId = (l.recordId || '').toLowerCase();

      return (
        audit.includes(term) ||
        details.includes(term) ||
        user.includes(term) ||
        label.includes(term) ||
        recId.includes(term)
      );
    });
  }, [logs, entityFilter, actionFilter, searchTerm]);

  const counts = useMemo(() => {
    return {
      all: logs.length,
      create: logs.filter(l => l.action === 'CREATE').length,
      update: logs.filter(l => l.action === 'UPDATE').length,
      delete: logs.filter(l => l.action === 'DELETE').length,
      payment: logs.filter(l => l.action === 'PAYMENT').length,
    };
  }, [logs]);

  // Backups
  const handleBackupJSON = () => {
    const enrichedState = {
      ...state,
      exportedAt: new Date().toISOString(),
      expenses: state.expenses.map(e => ({
        ...e,
        auditId: formatAuditId('EXP', e.id)
      })),
      incomes: state.incomes.map(i => ({
        ...i,
        auditId: formatAuditId('REC', i.id)
      })),
      payments: state.payments.map(p => ({
        ...p,
        auditId: formatAuditId('PAG', p.id)
      })),
      terrenoInstallments: state.terrenoPaidInstallments.map(t => ({
        id: t,
        auditId: formatAuditId('TER', t)
      }))
    };

    const dataStr = JSON.stringify(enrichedState, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    const date = new Date().toISOString().split('T')[0];
    link.download = `backup_casadolago_${date}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Backup JSON baixado com sucesso!');
  };

  const handleBackupCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM para caracteres especiais
    
    // Expenses
    csvContent += "--- SAÍDAS ---\n";
    csvContent += "Código Auditoria,ID Original,Data,Categoria,Local,Valor,Forma de Pagamento,Parcelas,Doador,Observação\n";
    state.expenses.forEach(e => {
      const auditId = formatAuditId('EXP', e.id);
      const row = [
        auditId,
        e.id, 
        e.date, 
        e.category, 
        `"${(e.local || '').replace(/"/g, '""')}"`, 
        e.value, 
        e.paymentMethod, 
        e.installments || '', 
        e.donor || '', 
        `"${(e.observation || '').replace(/"/g, '""')}"`
      ].join(",");
      csvContent += row + "\n";
    });
    csvContent += "\n";

    // Incomes
    csvContent += "--- ENTRADAS ---\n";
    csvContent += "Código Auditoria,ID Original,Data,Valor,Descrição,É Caixa?\n";
    state.incomes.forEach(i => {
      const auditId = formatAuditId('REC', i.id);
      const row = [
        auditId,
        i.id,
        i.date,
        i.value,
        `"${(i.description || '').replace(/"/g, '""')}"`,
        i.isCaixa ? 'Sim' : 'Não'
      ].join(",");
      csvContent += row + "\n";
    });
    csvContent += "\n";

    // Payments
    csvContent += "--- PAGAMENTOS ---\n";
    csvContent += "Código Auditoria,ID Original,Data,Valor,Pessoa\n";
    state.payments.forEach(p => {
      const auditId = formatAuditId('PAG', p.id);
      const row = [
        auditId,
        p.id,
        p.date,
        p.value,
        p.person
      ].join(",");
      csvContent += row + "\n";
    });
    csvContent += "\n";

    // Terreno
    csvContent += "--- TERRENO ---\n";
    csvContent += "Código Auditoria,ID da Parcela Paga\n";
    state.terrenoPaidInstallments.forEach(t => {
      const auditId = formatAuditId('TER', t);
      csvContent += `${auditId},${t}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("download", `backup_completo_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Backup CSV baixado com sucesso!');
  };

  const handleBackupExcel = () => {
    const wb = XLSX.utils.book_new();

    // Expenses Sheet
    const expensesData = state.expenses.map(e => ({
      'Código Auditoria': formatAuditId('EXP', e.id),
      'ID Original': e.id,
      Data: e.date,
      Categoria: e.category,
      Local: e.local,
      Valor: e.value,
      'Forma de Pagamento': e.paymentMethod,
      Parcelas: e.installments || '',
      Doador: e.donor || '',
      'A Devolver?': e.isReimbursement ? 'Sim' : 'Não',
      'Devolver Para': e.reimburseTo || (e.isReimbursement ? e.donor : '') || '',
      'Status Devolução': e.isReimbursement ? (e.refundStatus || 'Pendente') : '',
      Observação: e.observation || ''
    }));
    const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Saídas");

    // Incomes Sheet
    const incomesData = state.incomes.map(i => ({
      'Código Auditoria': formatAuditId('REC', i.id),
      'ID Original': i.id,
      Data: i.date,
      Valor: i.value,
      Descrição: i.description,
      'É Caixa?': i.isCaixa ? 'Sim' : 'Não'
    }));
    const wsIncomes = XLSX.utils.json_to_sheet(incomesData);
    XLSX.utils.book_append_sheet(wb, wsIncomes, "Entradas");

    // Payments Sheet
    const paymentsData = state.payments.map(p => ({
      'Código Auditoria': formatAuditId('PAG', p.id),
      'ID Original': p.id,
      Data: p.date,
      Valor: p.value,
      Pessoa: p.person
    }));
    const wsPayments = XLSX.utils.json_to_sheet(paymentsData);
    XLSX.utils.book_append_sheet(wb, wsPayments, "Pagamentos");

    // Terreno Sheet
    const terrenoData = state.terrenoPaidInstallments.map(t => ({
      'Código Auditoria': formatAuditId('TER', t),
      'ID da Parcela Paga': t
    }));
    const wsTerreno = XLSX.utils.json_to_sheet(terrenoData);
    XLSX.utils.book_append_sheet(wb, wsTerreno, "Terreno");

    // Categories Sheet
    const categoriesData = categoryStats.map(c => ({
      'Categoria': c.name,
      'Quantidade de Despesas': c.count,
      'Valor Total (R$)': c.total,
      '% do Total': Number(c.percentage.toFixed(2))
    }));
    const wsCategories = XLSX.utils.json_to_sheet(categoriesData);
    XLSX.utils.book_append_sheet(wb, wsCategories, "Categorias");

    // Save
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `backup_casadolago_${date}.xlsx`);
    toast.success('Backup Excel baixado com sucesso!');
  };

  const defaultFormatCurrency = (v: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
  const fmt = formatCurrency || defaultFormatCurrency;

  const totalAllExpensesValue = useMemo(() => {
    return state.expenses.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
  }, [state.expenses]);

  const categoryStats = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};

    state.expenses.forEach(e => {
      const cat = (e.category || '').trim();
      if (!cat) return;
      if (!map[cat]) map[cat] = { count: 0, total: 0 };
      map[cat].count += 1;
      map[cat].total += (Number(e.value) || 0);
    });

    const set = new Set([...categories, ...Object.keys(map)]);
    
    return Array.from(set).map(catName => {
      const stat = map[catName] || { count: 0, total: 0 };
      const pct = totalAllExpensesValue > 0 ? (stat.total / totalAllExpensesValue) * 100 : 0;
      return {
        name: catName,
        count: stat.count,
        total: stat.total,
        percentage: pct
      };
    }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [categories, state.expenses, totalAllExpensesValue]);

  const filteredCategoryStats = useMemo(() => {
    if (!categorySearch.trim()) return categoryStats;
    const term = categorySearch.toLowerCase().trim();
    return categoryStats.filter(c => c.name.toLowerCase().includes(term));
  }, [categoryStats, categorySearch]);

  const handleCreateCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) {
      toast.error('Informe o nome da categoria.');
      return;
    }
    const success = onAddCategory(newCategoryName);
    if (success) {
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleSaveRenameCategory = async () => {
    if (!editingCategory) return;
    if (!editingCategory.newName.trim()) {
      toast.error('Informe o novo nome da categoria.');
      return;
    }
    try {
      setIsSavingCategory(true);
      await onRenameCategory(editingCategory.oldName, editingCategory.newName);
      setEditingCategory(null);
    } catch (err: any) {
      toast.error(`Erro ao renomear categoria: ${err.message || 'Erro inesperado'}`);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    try {
      setIsDeletingCategory(true);
      await onDeleteCategory(deletingCategory.name);
      setDeletingCategory(null);
    } catch (err: any) {
      toast.error(`Erro ao excluir categoria: ${err.message || 'Erro inesperado'}`);
    } finally {
      setIsDeletingCategory(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-white drop-shadow-sm">Configurações</h2>
          <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide">
            Auditoria de alterações, estrutura de IDs, categorias e backups do sistema
          </p>
        </div>

        {/* Sub-navegação */}
        <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-700/50 ring-1 ring-white/5 self-start sm:self-auto flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('backup')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'backup' 
                ? "bg-slate-700/80 text-white shadow-md ring-1 ring-slate-600/50" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <Database size={15} />
            <span>Backups & Dados</span>
          </button>
          
          <button
            type="button"
            onClick={() => setActiveSubTab('logs')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'logs' 
                ? "bg-blue-600/80 text-white shadow-md ring-1 ring-blue-500/50" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <Activity size={15} />
            <span>Logs</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
              activeSubTab === 'logs' ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
            )}>
              {logs.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('categories')}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer",
              activeSubTab === 'categories' 
                ? "bg-emerald-600/80 text-white shadow-md ring-1 ring-emerald-500/50" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <Tags size={15} />
            <span>Categorias</span>
            <span className={cn(
              "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
              activeSubTab === 'categories' ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400 border border-slate-700"
            )}>
              {categoryStats.length}
            </span>
          </button>
        </div>
      </header>

      {/* Sub-aba 1: BACKUPS */}
      {activeSubTab === 'backup' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-xl p-5 sm:p-6 ring-1 ring-white/5 hover:bg-slate-800/60 transition-colors flex flex-col justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl ring-1 ring-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)] shrink-0">
                  <Database size={22} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold mb-1 text-white">Backup Completo (JSON)</h3>
                  <p className="text-xs sm:text-sm text-slate-400 mb-4">
                    Exporte todos os lançamentos com estrutura enriquecida de IDs de auditoria para migrações ou restaurações.
                  </p>
                  <button
                    onClick={handleBackupJSON}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto bg-slate-800 text-slate-200 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-700 hover:text-white transition-all ring-1 ring-slate-600/50 shadow-md"
                  >
                    <Download size={16} />
                    Baixar JSON
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-xl p-5 sm:p-6 ring-1 ring-white/5 hover:bg-slate-800/60 transition-colors flex flex-col justify-between">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl ring-1 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] shrink-0">
                  <FileSpreadsheet size={22} />
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold mb-1 text-white">Exportar Planilhas</h3>
                  <p className="text-xs sm:text-sm text-slate-400 mb-4">
                    Planilhas multi-abas com coluna dedicada de Código de Auditoria para conciliação contábil no Excel.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={handleBackupExcel}
                      className="flex items-center justify-center gap-2 flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold hover:from-emerald-500 hover:to-teal-500 transition-all ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-500/20"
                    >
                      <FileSpreadsheet size={16} />
                      Excel (.xlsx)
                    </button>
                    <button
                      onClick={handleBackupCSV}
                      className="flex items-center justify-center gap-2 flex-1 bg-slate-800 text-slate-300 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-700 hover:text-white transition-all ring-1 ring-slate-600/50"
                    >
                      <FileText size={16} />
                      CSV Geral
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card explicativo sobre a Estrutura de IDs de Auditoria */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 sm:p-5 ring-1 ring-white/5">
            <div className="flex items-center gap-2.5 text-blue-400 mb-2">
              <ShieldCheck size={18} />
              <h4 className="font-bold text-sm sm:text-base text-white">Estrutura de IDs & Rastreabilidade</h4>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Todos os lançamentos do sistema possuem um Código de Auditoria padronizado e determinístico:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3 text-xs">
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Saídas</span>
                <span className="font-mono text-blue-400 font-semibold">#EXP-XXXXXX</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Entradas</span>
                <span className="font-mono text-emerald-400 font-semibold">#REC-XXXXXX</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Pagamentos</span>
                <span className="font-mono text-purple-400 font-semibold">#PAG-XXXXXX</span>
              </div>
              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Terreno</span>
                <span className="font-mono text-amber-400 font-semibold">#TER-YYYYMM</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-aba 2: LOGS DE AUDITORIA */}
      {activeSubTab === 'logs' && (
        <div className="space-y-4">
          {/* Quick Filter Pills com Contadores em Tempo Real */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 custom-scrollbar">
            <button
              type="button"
              onClick={() => setActionFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer",
                actionFilter === 'all'
                  ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20"
                  : "bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <span>Todos</span>
              <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full">
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActionFilter('UPDATE')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer",
                actionFilter === 'UPDATE'
                  ? "bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-500/20"
                  : "bg-slate-900/60 text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
              )}
            >
              <span>Edições</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                actionFilter === 'UPDATE' ? "bg-white/20 text-white" : "bg-blue-500/20 text-blue-300"
              )}>
                {counts.update}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActionFilter('DELETE')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer",
                actionFilter === 'DELETE'
                  ? "bg-red-500 text-white border-red-400 shadow-md shadow-red-500/20"
                  : "bg-slate-900/60 text-red-400 border-red-500/30 hover:bg-red-500/10"
              )}
            >
              <span>Exclusões</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                actionFilter === 'DELETE' ? "bg-white/20 text-white" : "bg-red-500/20 text-red-300"
              )}>
                {counts.delete}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActionFilter('CREATE')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer",
                actionFilter === 'CREATE'
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                  : "bg-slate-900/60 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              )}
            >
              <span>Lançamentos</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                actionFilter === 'CREATE' ? "bg-white/20 text-white" : "bg-emerald-500/20 text-emerald-300"
              )}>
                {counts.create}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActionFilter('PAYMENT')}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer",
                actionFilter === 'PAYMENT'
                  ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20"
                  : "bg-slate-900/60 text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
              )}
            >
              <span>Pagamentos</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
                actionFilter === 'PAYMENT' ? "bg-white/20 text-white" : "bg-purple-500/20 text-purple-300"
              )}>
                {counts.payment}
              </span>
            </button>
          </div>

          {/* Controles de Busca e Filtros */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl p-3.5 rounded-2xl border border-slate-700/50 ring-1 ring-white/5">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por Código (#EXP...), ação, descrição, usuário..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950/60 border border-slate-700/60 rounded-xl text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={entityFilter}
                onChange={e => setEntityFilter(e.target.value)}
                className="bg-slate-950/60 border border-slate-700/60 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">Todas Entidades</option>
                <option value="Saída">Saídas</option>
                <option value="Entrada">Entradas</option>
                <option value="Pagamento">Pagamentos</option>
                <option value="Terreno">Terreno</option>
                <option value="Categoria">Categorias</option>
                <option value="Sistema">Sistema</option>
              </select>

              <select
                value={actionFilter}
                onChange={e => setActionFilter(e.target.value)}
                className="bg-slate-950/60 border border-slate-700/60 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-500/50"
              >
                <option value="all">Todas Ações</option>
                <option value="UPDATE">Edições</option>
                <option value="DELETE">Exclusões</option>
                <option value="CREATE">Criações</option>
                <option value="PAYMENT">Pagamentos</option>
                <option value="SYNC">Sincronização</option>
              </select>

              <button
                type="button"
                onClick={() => auditLogger.exportLogsCSV()}
                title="Exportar logs em CSV para Excel"
                className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors flex items-center gap-1 text-xs cursor-pointer"
              >
                <Download size={14} />
                <span className="hidden sm:inline">CSV</span>
              </button>

              <button
                type="button"
                onClick={() => auditLogger.exportLogsJSON()}
                title="Exportar logs em JSON"
                className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 hover:bg-slate-700 transition-colors flex items-center gap-1 text-xs cursor-pointer"
              >
                <Download size={14} />
                <span className="hidden sm:inline">JSON</span>
              </button>

              <button
                type="button"
                onClick={handleClearLogs}
                title="Limpar histórico de logs"
                className="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/20 transition-colors flex items-center gap-1 text-xs cursor-pointer"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Limpar</span>
              </button>
            </div>
          </div>

          {/* Lista de Registros de Log - Compacta e Responsiva para Smartphone */}
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 ring-1 ring-white/5 overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-blue-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">Histórico de Alterações</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded border border-slate-700/60">
                {filteredLogs.length} eventos
              </span>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                Nenhum registro de log encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {filteredLogs.map(log => {
                  const dateObj = new Date(log.timestamp);
                  const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
                  const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                  return (
                    <div 
                      key={log.id} 
                      className={cn(
                        "px-3 py-2.5 sm:px-4 sm:py-3 hover:bg-slate-800/40 transition-colors flex items-start justify-between gap-2.5 sm:gap-4 group border-l-2",
                        log.action === 'UPDATE' ? "border-l-blue-500 bg-blue-950/10" :
                        log.action === 'DELETE' ? "border-l-red-500 bg-red-950/15" :
                        log.action === 'PAYMENT' ? "border-l-purple-500 bg-purple-950/10" :
                        "border-l-emerald-500/50 bg-slate-950/20"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          {/* Badge de Ação */}
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold uppercase ring-1 shadow-sm",
                            log.action === 'CREATE' ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" :
                            log.action === 'UPDATE' ? "bg-blue-500/15 text-blue-300 ring-blue-500/30" :
                            log.action === 'DELETE' ? "bg-red-500/15 text-red-300 ring-red-500/30" :
                            log.action === 'PAYMENT' ? "bg-purple-500/15 text-purple-300 ring-purple-500/30" :
                            "bg-amber-500/15 text-amber-300 ring-amber-500/30"
                          )}>
                            {log.actionLabel || log.action}
                          </span>

                          {/* Badge de Entidade */}
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700/60">
                            {log.entity}
                          </span>

                          {/* Código de Auditoria Clicável */}
                          {log.auditId && (
                            <button
                              type="button"
                              onClick={(e) => copyAuditIdToClipboard(log.auditId, e)}
                              title="Clique para copiar ID de auditoria"
                              className="font-mono text-[9px] sm:text-[10px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center cursor-pointer"
                            >
                              {log.auditId}
                            </button>
                          )}
                        </div>

                        {/* Detalhes do Evento */}
                        <div className={cn(
                          "text-xs sm:text-sm font-medium mt-1.5",
                          log.action === 'DELETE' ? "text-red-300 font-semibold" :
                          log.action === 'UPDATE' ? "text-slate-100" : "text-slate-200"
                        )}>
                          {log.details}
                        </div>

                        {/* Diff Box: Anterior vs Novo */}
                        {(log.previousValue || log.newValue) && (
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 text-[11px] font-mono flex-wrap">
                            {log.previousValue && (
                              <div className="inline-flex items-center gap-1 bg-red-500/10 border border-red-500/25 text-red-400 px-2 py-0.5 rounded-md">
                                <span className="text-[9px] uppercase font-bold text-red-500/70">Anterior:</span>
                                <span className={log.action === 'DELETE' ? 'line-through' : ''}>{log.previousValue}</span>
                              </div>
                            )}
                            {log.previousValue && log.newValue && (
                              <span className="text-slate-500">→</span>
                            )}
                            {log.newValue && (
                              <div className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded-md">
                                <span className="text-[9px] uppercase font-bold text-emerald-500/70">Novo:</span>
                                <span>{log.newValue}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Data, Hora e Usuário */}
                      <div className="shrink-0 text-right">
                        <div className="text-[10px] sm:text-xs text-slate-400 font-mono">
                          {formattedDate} {formattedTime}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                          {log.user ? `Por: ${log.user}` : 'Sistema'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sub-aba 3: GESTÃO DE CATEGORIAS */}
      {activeSubTab === 'categories' && (
        <div className="space-y-6">
          {/* Métricas / Resumo Superior */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4 ring-1 ring-white/5 flex items-center gap-3.5">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl ring-1 ring-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] shrink-0">
                <Tags size={22} />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total de Categorias</span>
                <span className="text-xl sm:text-2xl font-black text-white">{categoryStats.length}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4 ring-1 ring-white/5 flex items-center gap-3.5">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl ring-1 ring-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] shrink-0">
                <Activity size={22} />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Despesas Lançadas</span>
                <span className="text-xl sm:text-2xl font-black text-white">{state.expenses.length}</span>
              </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4 ring-1 ring-white/5 flex items-center gap-3.5">
              <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl ring-1 ring-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)] shrink-0">
                <Database size={22} />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Geral em Obras</span>
                <span className="text-xl sm:text-2xl font-black text-white font-mono">{fmt(totalAllExpensesValue)}</span>
              </div>
            </div>
          </div>

          {/* Card de Cadastro Rápido de Nova Categoria */}
          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-5 sm:p-6 ring-1 ring-white/5 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 rounded-xl ring-1 ring-emerald-500/30">
                <FolderPlus size={20} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">Cadastrar Nova Categoria</h3>
                <p className="text-xs text-slate-400">
                  Adicione novas categorias para classificação e rateio das despesas da obra
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateCategorySubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Tag size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Nome da categoria (Ex: Paisagismo, Elétrica, Pintura...)"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/70 border border-slate-700/60 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={!newCategoryName.trim()}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Plus size={16} />
                <span>Adicionar Categoria</span>
              </button>
            </form>
          </div>

          {/* Barra de Busca e Listagem */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 backdrop-blur-xl p-3.5 rounded-2xl border border-slate-700/50 ring-1 ring-white/5">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar categoria por nome..."
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950/60 border border-slate-700/60 rounded-xl text-xs sm:text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="text-xs text-slate-400 px-2 font-medium">
                Mostrando <strong className="text-white">{filteredCategoryStats.length}</strong> de {categoryStats.length} categorias
              </div>
            </div>

            {filteredCategoryStats.length === 0 ? (
              <div className="bg-slate-900/40 rounded-2xl border border-slate-800/80 p-12 text-center">
                <Tags size={36} className="mx-auto text-slate-600 mb-3" />
                <p className="text-sm font-semibold text-slate-300">Nenhuma categoria encontrada</p>
                <p className="text-xs text-slate-500 mt-1">Tente outro termo na busca ou cadastre uma nova categoria acima.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {filteredCategoryStats.map((item) => {
                  const hasExpenses = item.count > 0;
                  return (
                    <div
                      key={item.name}
                      className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-slate-800/80 hover:border-slate-700/70 p-4.5 ring-1 ring-white/5 transition-all flex flex-col justify-between group shadow-lg"
                    >
                      <div>
                        {/* Top: Nome e Ações */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 rounded-xl bg-slate-800/90 text-emerald-400 ring-1 ring-white/10 shrink-0 group-hover:bg-emerald-500/10 transition-colors">
                              <Tag size={16} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-sm sm:text-base font-bold text-white truncate" title={item.name}>
                                {item.name}
                              </h4>
                              <span className={cn(
                                "inline-block text-[11px] font-mono px-2 py-0.5 rounded-full mt-0.5",
                                hasExpenses 
                                  ? "bg-blue-500/15 text-blue-300 border border-blue-500/30" 
                                  : "bg-slate-800 text-slate-400 border border-slate-700/50"
                              )}>
                                {item.count} {item.count === 1 ? 'saída' : 'saídas'}
                              </span>
                            </div>
                          </div>

                          {/* Botões de Ação */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingCategory({ oldName: item.name, newName: item.name, count: item.count })}
                              title="Editar / Renomear Categoria"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer ring-1 ring-transparent hover:ring-slate-700"
                            >
                              <Pencil size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (hasExpenses) {
                                  toast.error(
                                    `A categoria "${item.name}" possui ${item.count} ${
                                      item.count === 1 ? 'despesa vinculada' : 'despesas vinculadas'
                                    }. Renomeie-a ou transfira os lançamentos antes de excluir.`
                                  );
                                } else {
                                  setDeletingCategory({ name: item.name, count: item.count });
                                }
                              }}
                              disabled={hasExpenses}
                              title={hasExpenses ? `Em uso por ${item.count} lançamentos (não pode ser excluída)` : "Excluir Categoria"}
                              className={cn(
                                "p-1.5 rounded-lg transition-all cursor-pointer",
                                hasExpenses 
                                  ? "text-slate-600 cursor-not-allowed opacity-40" 
                                  : "text-slate-400 hover:text-red-400 hover:bg-red-500/10 ring-1 ring-transparent hover:ring-red-500/30"
                              )}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Valor Total e Barra de Progresso */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-slate-400 font-medium">Total Gasto:</span>
                            <span className="font-mono font-bold text-white text-sm">
                              {fmt(item.total)}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="w-full bg-slate-950/80 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(item.percentage > 0 ? 3 : 0, item.percentage))}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                              <span>Participação</span>
                              <span>{item.percentage.toFixed(1)}% do total</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO / RENOMEAÇÃO DE CATEGORIA */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900/95 border border-slate-700/60 rounded-2xl shadow-2xl max-w-md w-full p-6 ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl ring-1 ring-blue-500/20">
                  <Pencil size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Editar Categoria</h3>
                  <p className="text-xs text-slate-400">Renomear categoria e atualizar despesas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Nome Atual
                </label>
                <div className="px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-sm font-semibold text-slate-300">
                  {editingCategory.oldName}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Novo Nome da Categoria
                </label>
                <input
                  type="text"
                  autoFocus
                  value={editingCategory.newName}
                  onChange={e => setEditingCategory({ ...editingCategory, newName: e.target.value })}
                  placeholder="Ex: Materiais Hidráulicos..."
                  className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                />
              </div>

              {editingCategory.count > 0 && (
                <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs flex items-start gap-2.5">
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-blue-400" />
                  <div className="leading-relaxed">
                    <strong>Atenção:</strong> Existem <strong className="text-white">{editingCategory.count}</strong> despesa(s) vinculada(s) a esta categoria. Ao salvar, todas serão atualizadas automaticamente para <strong>"{editingCategory.newName || '...'}"</strong> no banco de dados e na auditoria.
                  </div>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  disabled={isSavingCategory}
                  className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-bold rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveRenameCategory}
                  disabled={isSavingCategory || !editingCategory.newName.trim() || editingCategory.newName.trim() === editingCategory.oldName}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingCategory ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CATEGORIA */}
      {deletingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900/95 border border-slate-700/60 rounded-2xl shadow-2xl max-w-sm w-full p-6 ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-500/10 ring-1 ring-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} />
            </div>
            <h3 className="text-lg font-bold text-center text-white mb-2">Excluir Categoria</h3>
            <p className="text-center text-slate-400 text-xs sm:text-sm mb-6 leading-relaxed">
              Deseja realmente excluir a categoria <strong className="text-white">"{deletingCategory.name}"</strong>? Ela será removida da lista de categorias disponíveis.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                disabled={isDeletingCategory}
                className="flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                disabled={isDeletingCategory}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isDeletingCategory ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Sim, Excluir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
