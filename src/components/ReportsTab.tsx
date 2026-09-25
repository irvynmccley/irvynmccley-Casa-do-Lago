import React, { useState, useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Expense, Category, Person, PaymentMethod } from '../types';
import { Card } from './ui/Card';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  Search, ChevronDown, ChevronUp, Download, Landmark, FileText, 
  Users, CreditCard, RotateCcw, CheckCircle2, Clock, ShieldCheck, 
  Share2, Copy, FileSpreadsheet, ArrowUpDown, Filter, Sparkles, 
  Check, Building2, Wallet, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { formatAuditId, copyAuditIdToClipboard } from '../utils/audit';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES: Category[] = ['Combustível', 'Documentação', 'Material', 'Mão de Obra', 'Monitoramento', 'Alimentação'];
const PARTNERS: Person[] = ['Mccley', 'Jan', 'Saulo', 'Jorge'];

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
  categories?: string[];
}

export function ReportsTab({ expenses, categories = [], allCardInstallments = [], formatCurrency }: ReportsTabProps) {
  const [activeReportTab, setActiveReportTab] = useState<'geral' | 'extrato' | 'apagar' | 'faturas'>('geral');
  
  const availableCategories = useMemo(() => {
    const list = categories && categories.length > 0 ? [...categories] : [...CATEGORIES];
    expenses.forEach(e => {
      if (e.category && !list.includes(e.category)) {
        list.push(e.category);
      }
    });
    return Array.from(new Set(list));
  }, [categories, expenses]);
  
  // Filtros da aba Geral
  const [filter, setFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Filtros da aba Extrato de Sócios (Modelo Extrato Bancário)
  const [statementPartner, setStatementPartner] = useState<string>('todos');
  const [statementStatus, setStatementStatus] = useState<'todos' | 'pendente' | 'devolvido'>('todos');
  const [statementSortOrder, setStatementSortOrder] = useState<'desc' | 'asc'>('desc');
  const [statementSearch, setStatementSearch] = useState('');
  const [isExportingImage, setIsExportingImage] = useState(false);

  // Faturas accordion
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);

  // -------------------------------------------------------------
  // CÁLCULOS GERAIS
  // -------------------------------------------------------------
  const allReimbursements = useMemo(() => {
    return expenses.filter(e => Boolean(e.isReimbursement));
  }, [expenses]);

  const totalPendingRefunds = useMemo(() => {
    return allReimbursements
      .filter(e => e.refundStatus === 'Pendente' || (!e.refundStatus && e.status !== 'DEVOLVIDO'))
      .reduce((sum, e) => sum + (Number(e.value) || 0), 0);
  }, [allReimbursements]);

  const totalSettledRefunds = useMemo(() => {
    return allReimbursements
      .filter(e => e.refundStatus === 'Devolvido' || e.status === 'DEVOLVIDO')
      .reduce((sum, e) => sum + (Number(e.value) || 0), 0);
  }, [allReimbursements]);

  const totalAllExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
  }, [expenses]);

  const pendingRefundsCount = useMemo(() => {
    return allReimbursements.filter(e => e.refundStatus === 'Pendente' || (!e.refundStatus && e.status !== 'DEVOLVIDO')).length;
  }, [allReimbursements]);

  // -------------------------------------------------------------
  // ABA GERAL: FILTROS E CONTAGENS
  // -------------------------------------------------------------
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach(e => {
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (filter !== 'all') {
      result = result.filter((e: Expense) => e.category === filter);
    }
    if (paymentFilter !== 'all') {
      result = result.filter((e: Expense) => e.paymentMethod === paymentFilter);
    }
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter((e: Expense) => {
        const auditId = formatAuditId('EXP', e.id).toLowerCase();
        return (
          auditId.includes(lowerSearch) ||
          (e.local && typeof e.local === 'string' && e.local.toLowerCase().includes(lowerSearch)) ||
          (e.observation && typeof e.observation === 'string' && e.observation.toLowerCase().includes(lowerSearch)) ||
          (e.paymentMethod && typeof e.paymentMethod === 'string' && e.paymentMethod.toLowerCase().includes(lowerSearch)) ||
          (e.reimburseTo && typeof e.reimburseTo === 'string' && e.reimburseTo.toLowerCase().includes(lowerSearch)) ||
          (e.donor && typeof e.donor === 'string' && e.donor.toLowerCase().includes(lowerSearch)) ||
          (e.isReimbursement && ('reembolso devolver ressarcimento'.includes(lowerSearch)))
        );
      });
    }
    return [...result].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [expenses, filter, paymentFilter, searchTerm]);

  // -------------------------------------------------------------
  // ABA EXTRATO DE SÓCIOS (MODELO EXTRATO BANCÁRIO)
  // -------------------------------------------------------------
  const partnerStatementMetrics = useMemo(() => {
    return PARTNERS.map(p => {
      const pAll = allReimbursements.filter(e => (e.reimburseTo || e.donor) === p);
      const pPending = pAll.filter(e => e.refundStatus === 'Pendente' || (!e.refundStatus && e.status !== 'DEVOLVIDO'));
      const pSettled = pAll.filter(e => e.refundStatus === 'Devolvido' || e.status === 'DEVOLVIDO');

      const totalDisbursed = pAll.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
      const totalPending = pPending.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
      const totalSettled = pSettled.reduce((sum, e) => sum + (Number(e.value) || 0), 0);

      return {
        partner: p,
        totalDisbursed,
        totalPending,
        totalSettled,
        pendingCount: pPending.length,
        settledCount: pSettled.length,
        totalCount: pAll.length
      };
    });
  }, [allReimbursements]);

  // Resumo do sócio selecionado no extrato
  const selectedStatementSummary = useMemo(() => {
    if (statementPartner === 'todos') {
      return {
        partner: 'Todos os Sócios',
        totalDisbursed: allReimbursements.reduce((sum, e) => sum + (Number(e.value) || 0), 0),
        totalPending: totalPendingRefunds,
        totalSettled: totalSettledRefunds,
        pendingCount: pendingRefundsCount,
        settledCount: allReimbursements.length - pendingRefundsCount,
        totalCount: allReimbursements.length
      };
    }
    const found = partnerStatementMetrics.find(m => m.partner === statementPartner);
    return found || {
      partner: statementPartner,
      totalDisbursed: 0,
      totalPending: 0,
      totalSettled: 0,
      pendingCount: 0,
      settledCount: 0,
      totalCount: 0
    };
  }, [statementPartner, partnerStatementMetrics, allReimbursements, totalPendingRefunds, totalSettledRefunds, pendingRefundsCount]);

  // Lançamentos do extrato com saldo progressivo
  const statementRows = useMemo(() => {
    let list = allReimbursements;

    // Filtro por sócio titular
    if (statementPartner !== 'todos') {
      list = list.filter(e => (e.reimburseTo || e.donor) === statementPartner);
    }

    // Filtro por status contábil
    if (statementStatus === 'pendente') {
      list = list.filter(e => e.refundStatus === 'Pendente' || (!e.refundStatus && e.status !== 'DEVOLVIDO'));
    } else if (statementStatus === 'devolvido') {
      list = list.filter(e => e.refundStatus === 'Devolvido' || e.status === 'DEVOLVIDO');
    }

    // Filtro de busca no extrato
    if (statementSearch) {
      const lower = statementSearch.toLowerCase();
      list = list.filter(e => {
        const auditId = formatAuditId('EXP', e.id).toLowerCase();
        return (
          auditId.includes(lower) ||
          (e.local && e.local.toLowerCase().includes(lower)) ||
          (e.observation && e.observation.toLowerCase().includes(lower)) ||
          (e.category && e.category.toLowerCase().includes(lower)) ||
          (e.paymentMethod && e.paymentMethod.toLowerCase().includes(lower)) ||
          ((e.reimburseTo || e.donor || '').toLowerCase().includes(lower))
        );
      });
    }

    // Ordenação cronológica base
    const sorted = [...list].sort((a, b) => {
      const cmp = (a.date || '').localeCompare(b.date || '');
      return statementSortOrder === 'asc' ? cmp : -cmp;
    });

    // Cálculo do saldo acumulado progressivo (Running Balance)
    // Se for 'desc' (mais recentes primeiro), calculamos em relação ao total remanescente
    let runningBalance = 0;
    return sorted.map(item => {
      const isPending = item.refundStatus === 'Pendente' || (!item.refundStatus && item.status !== 'DEVOLVIDO');
      if (isPending) {
        runningBalance += (Number(item.value) || 0);
      }
      return {
        ...item,
        isPending,
        runningBalance
      };
    });
  }, [allReimbursements, statementPartner, statementStatus, statementSearch, statementSortOrder]);

  // -------------------------------------------------------------
  // FUNÇÕES DE EXPORTAÇÃO
  // -------------------------------------------------------------
  const exportStatementToExcel = () => {
    try {
      const dataToExport = statementRows.map(row => {
        const auditId = formatAuditId('EXP', row.id);
        const partner = row.reimburseTo || (row.donor as Person) || 'Sócio';
        const statusLabel = row.isPending ? 'Pendente (A Devolver)' : 'Liquidado (Devolvido)';
        return {
          'Data': row.date ? row.date.split('-').reverse().join('/') : '',
          'Código': auditId,
          'Sócio Titular': partner,
          'Histórico / Local': row.local || '',
          'Categoria': row.category || '',
          'Forma Origem': `${row.paymentMethod} ${row.installments ? `(${row.installments}x)` : ''}`,
          'Natureza': 'Desembolso do Sócio',
          'Valor (R$)': Number(row.value) || 0,
          'Situação': statusLabel,
          'Observação': row.observation || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Extrato de Reembolsos');

      const partnerTag = statementPartner === 'todos' ? 'Consolidado' : statementPartner;
      const fileName = `Extrato_Devolucao_Socios_${partnerTag}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success('Extrato em Excel exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar extrato:', err);
      toast.error('Erro ao gerar planilha do extrato.');
    }
  };

  const copyStatementToWhatsApp = () => {
    try {
      const partnerName = selectedStatementSummary.partner;
      const dataEmissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      
      let text = `🏦 *EXTRATO BANCÁRIO DE REEMBOLSOS - CASA DO LAGO*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `👤 *Titular:* ${partnerName}\n`;
      text += `📅 *Emissão:* ${dataEmissao}\n`;
      text += `💰 *Saldo Devedor do Caixa:* ${formatCurrency(selectedStatementSummary.totalPending)}\n`;
      text += `📊 *Total Adiantado:* ${formatCurrency(selectedStatementSummary.totalDisbursed)}\n`;
      text += `✅ *Total Já Devolvido:* ${formatCurrency(selectedStatementSummary.totalSettled)}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      const pendings = statementRows.filter(r => r.isPending);
      if (pendings.length > 0) {
        text += `⏳ *LANÇAMENTOS EM ABERTO (${pendings.length}):*\n`;
        pendings.forEach((r, idx) => {
          const auditId = formatAuditId('EXP', r.id);
          const dt = r.date ? r.date.split('-').reverse().join('/') : '-';
          text += `${idx + 1}. ${dt} | *${r.local}* (${r.category})\n`;
          text += `   ↳ ${auditId} | *${formatCurrency(r.value)}* [${r.paymentMethod}]\n`;
          if (r.observation) text += `   ↳ _Obs: ${r.observation}_\n`;
        });
      } else {
        text += `🎉 *Todos os reembolsos estão quitados! Nenhum valor pendente.*\n`;
      }

      text += `\n_Relatório gerado pelo Sistema de Gestão Casa do Lago_`;

      navigator.clipboard.writeText(text);
      toast.success('Extrato copiado para o WhatsApp com sucesso!');
    } catch (err) {
      console.error('Erro ao copiar extrato:', err);
      toast.error('Não foi possível copiar o extrato.');
    }
  };

  const exportStatementImage = async () => {
    const element = document.getElementById('extrato-bancario-view');
    if (!element) return;

    setIsExportingImage(true);
    try {
      const dataUrl = await toPng(element, {
        backgroundColor: '#020817',
        style: {
          padding: '24px',
          borderRadius: '16px',
        },
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.classList?.contains('no-export')) {
              return false;
            }
          }
          return true;
        }
      });

      const partnerTag = statementPartner === 'todos' ? 'Consolidado' : statementPartner;
      const link = document.createElement('a');
      link.download = `Extrato_Devolucao_${partnerTag}_${format(new Date(), 'yyyyMMdd')}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('Imagem do extrato salva com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar imagem:', err);
      toast.error('Erro ao exportar imagem do extrato.');
    } finally {
      setIsExportingImage(false);
    }
  };

  const exportGeneralToExcel = () => {
    try {
      const data = filteredExpenses.map(e => ({
        'Código': formatAuditId('EXP', e.id),
        'Data': e.date ? e.date.split('-').reverse().join('/') : '',
        'Categoria': e.category,
        'Local': e.local,
        'Forma de Pagamento': e.paymentMethod,
        'Parcelas': e.installments || 1,
        'Valor (R$)': Number(e.value) || 0,
        'Reembolso?': e.isReimbursement ? 'Sim' : 'Não',
        'Sócio Reembolso': e.reimburseTo || (e.isReimbursement ? e.donor : '') || '',
        'Status Devolução': e.isReimbursement ? (e.refundStatus || 'Pendente') : '',
        'Observação': e.observation || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Despesas');
      XLSX.writeFile(wb, `Relatorio_Geral_Casa_do_Lago_${format(new Date(), 'yyyyMMdd')}.xlsx`);
      toast.success('Relatório geral exportado para Excel com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar relatório geral:', err);
      toast.error('Erro ao gerar planilha.');
    }
  };

  const toggleInvoice = (month: string) => {
    setExpandedInvoice(expandedInvoice === month ? null : month);
  };

  const FIXED_COSTS = 750; // 700 (terreno) + 50 (condominio)
  const PEOPLE_COUNT = 4; // Jorge, Mccley, Jan, Saulo
  const FIXED_PER_PERSON = FIXED_COSTS / PEOPLE_COUNT;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      {/* ======================================================== */}
      {/* CABEÇALHO DO MÓDULO & NAVEGAÇÃO ENTRE ABAS               */}
      {/* ======================================================== */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white drop-shadow-sm">
              Relatórios & Extratos
            </h2>
            <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full uppercase tracking-wider hidden sm:inline">
              Financeiro Obra
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide mt-1">
            Conferência contábil, extrato bancário de reembolsos de sócios e faturas de cartão
          </p>
        </div>
        
        {/* Navegação de Abas do Módulo */}
        <div className="flex bg-slate-900/70 p-1.5 rounded-2xl border border-slate-700/60 ring-1 ring-white/5 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveReportTab('geral')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeReportTab === 'geral' 
                ? "bg-slate-700/90 text-white shadow-lg ring-1 ring-slate-600/60" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <FileText size={15} />
            <span>Geral</span>
          </button>

          {/* NOVA ABA: EXTRATO DE SÓCIOS (MODELO EXTRATO BANCÁRIO) */}
          <button
            onClick={() => setActiveReportTab('extrato')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer relative",
              activeReportTab === 'extrato' 
                ? "bg-amber-500 text-slate-950 shadow-lg font-bold shadow-amber-500/20" 
                : "text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
            )}
          >
            <Landmark size={15} />
            <span>Extrato de Sócios</span>
            {pendingRefundsCount > 0 && (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                activeReportTab === 'extrato' ? "bg-slate-950 text-amber-300" : "bg-amber-500/30 text-amber-300 border border-amber-500/40"
              )}>
                {pendingRefundsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveReportTab('apagar')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeReportTab === 'apagar' 
                ? "bg-slate-700/90 text-white shadow-lg ring-1 ring-slate-600/60" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <Users size={15} />
            <span>A Pagar</span>
          </button>

          <button
            onClick={() => setActiveReportTab('faturas')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer",
              activeReportTab === 'faturas' 
                ? "bg-slate-700/90 text-white shadow-lg ring-1 ring-slate-600/60" 
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            )}
          >
            <CreditCard size={15} />
            <span>Faturas de Cartão</span>
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* CARDS DE RESUMO FINANCEIRO EXECUTIVO NO TOPO             */}
      {/* ======================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3.5 sm:p-4 ring-1 ring-white/5 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Auditado</span>
            <Building2 size={16} className="text-blue-400" />
          </div>
          <div className="text-lg sm:text-xl font-mono font-bold text-white">
            {formatCurrency(totalAllExpenses)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {expenses.length} lançamentos totais
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-900/60 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 ring-1 ring-amber-500/20 shadow-xl">
          <div className="flex items-center justify-between text-amber-400 mb-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">A Devolver Sócios</span>
            <RotateCcw size={16} className="text-amber-400 animate-spin-slow" />
          </div>
          <div className="text-lg sm:text-xl font-mono font-bold text-amber-300">
            {formatCurrency(totalPendingRefunds)}
          </div>
          <div className="text-[10px] text-amber-400/80 mt-0.5">
            {pendingRefundsCount} {pendingRefundsCount === 1 ? 'pendência ativa' : 'pendências ativas'}
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3.5 sm:p-4 ring-1 ring-white/5 shadow-xl">
          <div className="flex items-center justify-between text-emerald-400 mb-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Já Devolvido</span>
            <CheckCircle2 size={16} className="text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-mono font-bold text-emerald-400">
            {formatCurrency(totalSettledRefunds)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Ressarcimentos liquidados
          </div>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3.5 sm:p-4 ring-1 ring-white/5 shadow-xl">
          <div className="flex items-center justify-between text-purple-400 mb-1.5">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Rateio Fixo / Mês</span>
            <Users size={16} className="text-purple-400" />
          </div>
          <div className="text-lg sm:text-xl font-mono font-bold text-white">
            {formatCurrency(FIXED_PER_PERSON)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            Por sócio (R$ 750 ÷ 4)
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: RELATÓRIO GERAL APERFEIÇOADO                     */}
      {/* ======================================================== */}
      {activeReportTab === 'geral' && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 ring-1 ring-white/5 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Campo de Busca */}
              <div className="relative flex-1 group">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Buscar por local, categoria, ID #EXP, sócio, obs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-700/60 text-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-500"
                />
              </div>

              {/* Botão de Exportação Excel da Aba Geral */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={exportGeneralToExcel}
                  className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                  title="Exportar dados filtrados para Excel"
                >
                  <FileSpreadsheet size={15} />
                  <span>Exportar Excel</span>
                </button>
              </div>
            </div>

            {/* Categorias Pills com Contadores */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-1">
              <button 
                onClick={() => setFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                  filter === 'all' 
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30" 
                    : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800/60 hover:text-slate-200"
                )}
              >
                <span>Todas as Categorias</span>
                <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-mono">
                  {expenses.length}
                </span>
              </button>
              {availableCategories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                    filter === cat 
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30" 
                      : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800/60 hover:text-slate-200"
                  )}
                >
                  <span>{cat}</span>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-mono">
                    {categoryCounts[cat] || 0}
                  </span>
                </button>
              ))}
            </div>

            {/* Filtro por Forma de Pagamento */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pagamento:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                {['all', 'Pix', 'Cartão', 'Caixa', 'doação'].map((pm) => (
                  <button
                    key={pm}
                    type="button"
                    onClick={() => setPaymentFilter(pm)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all cursor-pointer border",
                      paymentFilter === pm
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        : "bg-slate-950/30 text-slate-400 border-slate-800 hover:bg-slate-800"
                    )}
                  >
                    {pm === 'all' ? 'Todos' : pm}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabela Geral Aperfeiçoada */}
          <Card className="bg-slate-900/60 backdrop-blur-xl overflow-hidden border border-slate-700/50 shadow-2xl ring-1 ring-white/5 rounded-2xl">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-700/60">
                    <th className="px-3.5 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-400">ID</th>
                    <th className="px-3.5 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-400">Data</th>
                    <th className="px-3.5 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-400">Categoria</th>
                    <th className="px-3.5 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-400">Local & Detalhes</th>
                    <th className="px-3.5 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-400">Pagamento</th>
                    <th className="px-3.5 py-3 text-[10px] tracking-wider font-bold uppercase text-slate-400 text-right">Valor R$</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredExpenses.map((exp: Expense) => {
                    const auditId = formatAuditId('EXP', exp.id);
                    return (
                      <tr key={exp.id} className="hover:bg-slate-800/40 transition-colors group">
                        <td className="px-3.5 py-2.5 text-xs whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => copyAuditIdToClipboard(auditId, e)}
                            title="Clique para copiar ID de auditoria"
                            className="font-mono text-[9px] sm:text-[10px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center cursor-pointer"
                          >
                            {auditId}
                          </button>
                        </td>
                        <td className="px-3.5 py-2.5 text-xs sm:text-sm text-slate-300 whitespace-nowrap font-mono">
                          {exp.date ? exp.date.split('-').reverse().join('/') : '-'}
                        </td>
                        <td className="px-3.5 py-2.5 text-xs sm:text-sm text-slate-300 capitalize whitespace-nowrap">
                          <span className="bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 text-xs">
                            {exp.category}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-200">
                          <div className="font-semibold text-white">{exp.local}</div>
                          {exp.observation && (
                            <div className="text-[10px] text-slate-400 font-normal italic mt-0.5 max-w-[280px] truncate bg-slate-950/40 inline-block px-1.5 py-0.5 rounded border border-slate-800" title={exp.observation}>
                              {exp.observation}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ring-1",
                              exp.paymentMethod === 'Cartão' ? "bg-blue-500/10 text-blue-400 ring-blue-500/20" : 
                              exp.paymentMethod === 'doação' ? "bg-purple-500/10 text-purple-400 ring-purple-500/20" : 
                              exp.paymentMethod === 'Caixa' ? "bg-amber-500/10 text-amber-400 ring-amber-500/20" : "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                            )}>
                              {exp.paymentMethod} {exp.installments ? `(${exp.installments}x)` : ''}
                            </span>
                            {exp.isReimbursement && (
                              <span className={cn(
                                "px-1.5 py-0.5 rounded text-[9px] font-bold inline-flex items-center gap-1 border",
                                exp.refundStatus === 'Devolvido' 
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-300 border-amber-500/40"
                              )}>
                                {exp.refundStatus === 'Devolvido' ? 'Devolvido' : 'A Devolver'} p/ {exp.reimburseTo || exp.donor || 'Sócio'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold text-slate-100 text-right whitespace-nowrap">
                          {formatCurrency(exp.value)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-500 border-t border-slate-700/50 text-sm">
                        Nenhum lançamento encontrado com os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 2: EXTRATO DE SÓCIOS (MODELO EXTRATO BANCÁRIO)       */}
      {/* ======================================================== */}
      {activeReportTab === 'extrato' && (
        <div className="space-y-6">
          {/* Seletor de Conta Corrente do Sócio Titular */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 sm:p-5 ring-1 ring-white/5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                  Selecione a Conta do Sócio
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conferência individual centavo por centavo no formato de extrato bancário
                </p>
              </div>

              {/* Botões de Ação do Extrato */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={copyStatementToWhatsApp}
                  className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Copiar extrato formatado para colar no WhatsApp"
                >
                  <Share2 size={13} />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={exportStatementToExcel}
                  className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Baixar planilha Excel do extrato"
                >
                  <FileSpreadsheet size={13} />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  disabled={isExportingImage}
                  onClick={exportStatementImage}
                  className="px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Exportar imagem PNG do extrato"
                >
                  <Download size={13} />
                  <span>{isExportingImage ? 'Gerando...' : 'Imagem'}</span>
                </button>
              </div>
            </div>

            {/* Contas dos Sócios (Pills Grandes) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <button
                type="button"
                onClick={() => setStatementPartner('todos')}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer",
                  statementPartner === 'todos'
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 font-bold"
                    : "bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:text-white"
                )}
              >
                <div className="text-xs font-bold uppercase tracking-wider">
                  Consolidado
                </div>
                <div className={cn(
                  "text-sm sm:text-base font-mono font-bold mt-1",
                  statementPartner === 'todos' ? "text-slate-950" : "text-amber-300"
                )}>
                  {formatCurrency(totalPendingRefunds)}
                </div>
                <div className={cn(
                  "text-[10px] mt-0.5",
                  statementPartner === 'todos' ? "text-slate-800" : "text-slate-400"
                )}>
                  {pendingRefundsCount} pendências
                </div>
              </button>

              {partnerStatementMetrics.map(m => {
                const isSelected = statementPartner === m.partner;
                return (
                  <button
                    key={m.partner}
                    type="button"
                    onClick={() => setStatementPartner(m.partner)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer",
                      isSelected
                        ? "bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20 font-bold"
                        : "bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:text-white"
                    )}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                      <span>{m.partner}</span>
                      {m.pendingCount > 0 && (
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          isSelected ? "bg-slate-950" : "bg-amber-400 animate-pulse"
                        )} />
                      )}
                    </div>
                    <div className={cn(
                      "text-sm sm:text-base font-mono font-bold mt-1",
                      isSelected ? "text-slate-950" : m.totalPending > 0 ? "text-amber-300" : "text-slate-500"
                    )}>
                      {formatCurrency(m.totalPending)}
                    </div>
                    <div className={cn(
                      "text-[10px] mt-0.5",
                      isSelected ? "text-slate-800" : "text-slate-400"
                    )}>
                      {m.totalPending > 0 ? `${m.pendingCount} pendente(s)` : 'Tudo quitado'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ======================================================== */}
          {/* CARTÃO DO EXTRATO BANCÁRIO (ESTILO BANCO OFICIAL)        */}
          {/* ======================================================== */}
          <div id="extrato-bancario-view" className="bg-slate-900/80 backdrop-blur-2xl border border-slate-700/60 rounded-3xl p-5 sm:p-7 shadow-2xl ring-1 ring-white/10 space-y-6">
            {/* Cabeçalho do Extrato Tipo Folha Bancária */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-bold shadow-lg shadow-amber-500/20 shrink-0">
                  <Landmark size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono tracking-widest uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-bold">
                      Caixa da Obra
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Doc. Conciliação Nº {format(new Date(), 'yyyyMMdd')}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
                    Extrato de Conta Corrente — Reembolsos
                  </h3>
                  <p className="text-xs text-slate-400">
                    Titular: <span className="font-bold text-white">{selectedStatementSummary.partner}</span> • Emissão: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Saldo Líquido do Extrato em Grande Destaque */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-left sm:text-right shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Saldo Devedor do Caixa (A Devolver)
                </span>
                <span className={cn(
                  "text-2xl sm:text-3xl font-mono font-bold block mt-0.5",
                  selectedStatementSummary.totalPending > 0 ? "text-amber-300" : "text-emerald-400"
                )}>
                  {formatCurrency(selectedStatementSummary.totalPending)}
                </span>
                <div className="mt-1 flex items-center sm:justify-end gap-1.5">
                  {selectedStatementSummary.totalPending > 0 ? (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <Clock size={10} /> Pendente de Restituição
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                      <CheckCircle2 size={10} /> Conta 100% Regularizada
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Balancete Resumo da Conta (3 Cards de Extrato) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                    Total Desembolsado (Crédito)
                  </span>
                  <span className="text-base sm:text-lg font-mono font-bold text-white mt-0.5 block">
                    {formatCurrency(selectedStatementSummary.totalDisbursed)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {selectedStatementSummary.totalCount} transação(ões)
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <ArrowUpRight size={18} />
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                    Total Já Ressarcido (Débito)
                  </span>
                  <span className="text-base sm:text-lg font-mono font-bold text-emerald-400 mt-0.5 block">
                    {formatCurrency(selectedStatementSummary.totalSettled)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {selectedStatementSummary.settledCount} devolvido(s)
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ArrowDownRight size={18} />
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                    Saldo Atual a Liquidar
                  </span>
                  <span className="text-base sm:text-lg font-mono font-bold text-amber-300 mt-0.5 block">
                    {formatCurrency(selectedStatementSummary.totalPending)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {selectedStatementSummary.pendingCount} pendente(s)
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <RotateCcw size={18} />
                </div>
              </div>
            </div>

            {/* Barra de Filtros Internos do Extrato */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 no-export">
              {/* Filtro de Status Contábil */}
              <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 w-fit">
                <button
                  type="button"
                  onClick={() => setStatementStatus('todos')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    statementStatus === 'todos' ? "bg-slate-700 text-white shadow" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  Todos ({selectedStatementSummary.totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatementStatus('pendente')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                    statementStatus === 'pendente' ? "bg-amber-500 text-slate-950 font-bold shadow" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Clock size={12} />
                  <span>Em Aberto ({selectedStatementSummary.pendingCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementStatus('devolvido')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1",
                    statementStatus === 'devolvido' ? "bg-emerald-500 text-slate-950 font-bold shadow" : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <CheckCircle2 size={12} />
                  <span>Liquidados ({selectedStatementSummary.settledCount})</span>
                </button>
              </div>

              {/* Busca e Ordenação */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar lançamentos..."
                    value={statementSearch}
                    onChange={(e) => setStatementSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 text-xs rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 w-44 sm:w-56"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setStatementSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                  title={statementSortOrder === 'desc' ? "Mais recentes primeiro" : "Ordem cronológica"}
                >
                  <ArrowUpDown size={13} />
                  <span className="hidden sm:inline">{statementSortOrder === 'desc' ? 'Recentes' : 'Antigos'}</span>
                </button>
              </div>
            </div>

            {/* TABELA DE LANÇAMENTOS DO EXTRATO BANCÁRIO */}
            <div className="overflow-x-auto custom-scrollbar border border-slate-800/80 rounded-2xl bg-slate-950/50">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-slate-950/90 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-3.5 py-3">Data</th>
                    <th className="px-3.5 py-3">Documento</th>
                    <th className="px-3.5 py-3">Histórico / Estabelecimento</th>
                    <th className="px-3.5 py-3">Sócio Titular</th>
                    <th className="px-3.5 py-3">Origem</th>
                    <th className="px-3.5 py-3 text-right">Valor R$</th>
                    <th className="px-3.5 py-3 text-center">Situação</th>
                    <th className="px-3.5 py-3 text-right">Saldo Aberto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {statementRows.map((row) => {
                    const auditId = formatAuditId('EXP', row.id);
                    const partnerName = row.reimburseTo || (row.donor as Person) || 'Sócio';

                    return (
                      <tr 
                        key={row.id} 
                        className={cn(
                          "transition-colors",
                          row.isPending ? "hover:bg-amber-500/5 bg-slate-950/20" : "hover:bg-slate-800/30 opacity-75"
                        )}
                      >
                        {/* Data */}
                        <td className="px-3.5 py-3 whitespace-nowrap text-slate-300 font-sans text-xs">
                          {row.date ? row.date.split('-').reverse().join('/') : '-'}
                        </td>

                        {/* ID Documento */}
                        <td className="px-3.5 py-3 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => copyAuditIdToClipboard(auditId, e)}
                            title="Clique para copiar código do documento"
                            className="font-mono text-[9px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center cursor-pointer"
                          >
                            {auditId}
                          </button>
                        </td>

                        {/* Histórico / Fornecedor */}
                        <td className="px-3.5 py-3 font-sans">
                          <div className="font-semibold text-white text-xs sm:text-sm flex items-center gap-1.5">
                            <span>{row.local}</span>
                            <span className="text-[10px] font-normal text-slate-400 bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-700/60 font-mono">
                              {row.category}
                            </span>
                          </div>
                          {row.observation && (
                            <div className="text-[11px] text-slate-400 italic mt-0.5 font-sans" title={row.observation}>
                              {row.observation}
                            </div>
                          )}
                        </td>

                        {/* Sócio Titular */}
                        <td className="px-3.5 py-3 whitespace-nowrap font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {partnerName}
                          </span>
                        </td>

                        {/* Origem do Pagamento */}
                        <td className="px-3.5 py-3 whitespace-nowrap font-sans text-[11px] text-slate-300">
                          {row.paymentMethod} {row.installments ? `(${row.installments}x)` : ''}
                        </td>

                        {/* Valor R$ */}
                        <td className="px-3.5 py-3 text-right whitespace-nowrap font-bold text-white text-xs sm:text-sm">
                          {formatCurrency(row.value)}
                        </td>

                        {/* Situação */}
                        <td className="px-3.5 py-3 text-center whitespace-nowrap font-sans">
                          {row.isPending ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                              <Clock size={10} /> A Devolver
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                              <CheckCircle2 size={10} /> Liquidado
                            </span>
                          )}
                        </td>

                        {/* Saldo Devedor Acumulado Progressivo */}
                        <td className="px-3.5 py-3 text-right whitespace-nowrap font-bold text-amber-300 font-mono text-xs sm:text-sm">
                          {row.isPending ? formatCurrency(row.runningBalance) : '-'}
                        </td>
                      </tr>
                    );
                  })}

                  {statementRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-sans text-sm">
                        Nenhum lançamento no extrato para o titular e filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Encerramento Contábil do Extrato */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs text-slate-400 font-mono">
              <div>
                Total de transações listadas: <span className="font-bold text-white">{statementRows.length}</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Saldo em Aberto Apurado: <strong className="text-amber-300 text-sm">{formatCurrency(selectedStatementSummary.totalPending)}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ABA 3: A PAGAR (RATEIO MENSAL POR PESSOA)                */}
      {/* ======================================================== */}
      {activeReportTab === 'apagar' && (
        <Card className="bg-slate-900/60 backdrop-blur-xl overflow-hidden border border-slate-700/50 shadow-2xl ring-1 ring-white/5 p-4 sm:p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-lg font-bold text-white">Rateio Mensal por Pessoa</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Parcela fixa de R$ 187,50 (R$ 750 / 4) somada à fatura proporcional do cartão de crédito
              </p>
            </div>
            <div className="text-xs text-slate-400 font-mono bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
              4 sócios participantes
            </div>
          </div>

          <div className="space-y-2.5">
            {allCardInstallments.length > 0 ? (
              allCardInstallments.map((item) => {
                const cardPerPerson = item.total / PEOPLE_COUNT;
                const totalPerPerson = cardPerPerson + FIXED_PER_PERSON;
                
                return (
                  <div key={item.month} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 bg-slate-950/50 rounded-xl border border-slate-800/80 hover:bg-slate-800/40 transition-colors gap-3">
                    <div>
                      <div className="text-base font-bold text-slate-100 capitalize">
                        {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase mt-1 flex items-center gap-2">
                        <span>Cartão: <span className="text-slate-200 font-mono">{formatCurrency(cardPerPerson)}</span></span>
                        <span className="text-slate-600">+</span>
                        <span>Fixo Terreno/Cond.: <span className="text-slate-200 font-mono">{formatCurrency(FIXED_PER_PERSON)}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total por Pessoa</span>
                        <span className="text-lg sm:text-xl font-mono font-bold text-emerald-400">
                          {formatCurrency(totalPerPerson)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700/50 rounded-xl bg-slate-950/30 text-sm">
                Nenhuma parcela a pagar encontrada.
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ======================================================== */}
      {/* ABA 4: FATURAS DE CARTÃO DE CRÉDITO                      */}
      {/* ======================================================== */}
      {activeReportTab === 'faturas' && (
        <Card className="bg-slate-900/60 backdrop-blur-xl overflow-hidden border border-slate-700/50 shadow-2xl ring-1 ring-white/5 p-4 sm:p-6 rounded-2xl">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white">Faturas Futuras de Cartão de Crédito</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Projeção mês a mês com fechamento no dia 28 e detalhamento dos itens faturados
            </p>
          </div>

          <div className="space-y-3.5">
            {allCardInstallments.length > 0 ? (
              allCardInstallments.map((item) => {
                const isExpanded = expandedInvoice === item.month;
                
                return (
                  <div key={item.month} className="bg-slate-950/40 rounded-xl border border-slate-800/80 overflow-hidden transition-all">
                    <button 
                      onClick={() => toggleInvoice(item.month)}
                      className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 hover:bg-slate-800/30 transition-colors cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-lg transition-colors", isExpanded ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-400")}>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                        <div>
                          <div className="text-base font-bold text-slate-100 capitalize">
                            {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {item.items?.length || 0} lançamento(s) faturados
                          </div>
                        </div>
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-bold text-blue-400 mt-2 sm:mt-0">
                        {formatCurrency(item.total)}
                      </div>
                    </button>
                    
                    {isExpanded && item.items && item.items.length > 0 && (
                      <div className="border-t border-slate-800/80 bg-slate-900/50 p-3 sm:p-4">
                        <div className="overflow-x-auto custom-scrollbar">
                          <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                              <tr className="bg-slate-950/60 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                                <th className="px-4 py-2.5">Data Compra</th>
                                <th className="px-4 py-2.5">Local</th>
                                <th className="px-4 py-2.5 text-center">Parcela</th>
                                <th className="px-4 py-2.5 text-right">Valor Parcela</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-xs">
                              {item.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((detail, idx) => (
                                <tr key={`${detail.id}-${idx}`} className="hover:bg-slate-800/30 transition-colors">
                                  <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap font-mono">
                                    {detail.date ? detail.date.split('-').reverse().join('/') : '-'}
                                  </td>
                                  <td className="px-4 py-2.5 font-medium text-slate-200">
                                    {detail.local}
                                    {detail.originalExp?.observation && (
                                      <div className="text-[10px] text-slate-500 italic mt-0.5 truncate max-w-[240px]" title={detail.originalExp.observation}>
                                        {detail.originalExp.observation}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-center text-slate-400">
                                    <span className="bg-slate-800 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-700/60">
                                      {detail.installment}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 font-mono font-bold text-slate-200 text-right whitespace-nowrap">
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
                       <div className="border-t border-slate-800 bg-slate-900/40 p-5 text-center text-sm text-slate-500">
                         Detalhamento não disponível.
                       </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700/50 rounded-xl bg-slate-950/30 text-sm">
                Nenhuma fatura de cartão encontrada.
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
