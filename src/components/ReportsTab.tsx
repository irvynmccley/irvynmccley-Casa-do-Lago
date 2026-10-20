import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Expense, Category, Person, PaymentMethod, Donor } from '../types';
import { Card } from './ui/Card';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  Search, ChevronDown, ChevronUp, Download, Landmark, FileText, 
  Users, CreditCard, RotateCcw, CheckCircle2, Clock, ShieldCheck, 
  Share2, Copy, FileSpreadsheet, ArrowUpDown, Filter, Sparkles, 
  Check, Building2, Wallet, ArrowDownRight, ArrowUpRight,
  Heart, Trophy, Gift, ArrowRight
} from 'lucide-react';
import { formatAuditId, copyAuditIdToClipboard } from '../utils/audit';
import { toPng } from 'html-to-image';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { 
  FinancialSettings, 
  getStoredFinancialSettings,
  calculateFixedPerPersonForMonth,
  getCondominioCostForMonth,
  calculateMonthlyPartnerDues
} from '../utils/financialSettings';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CATEGORIES: Category[] = ['Combustível', 'Documentação', 'Material', 'Mão de Obra', 'Monitoramento', 'Alimentação'];
const PARTNERS: Person[] = ['Mccley', 'Jan', 'Saulo', 'Jorge'];

export type ReportSubTab = 'geral' | 'extrato' | 'doacoes' | 'apagar' | 'faturas';

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
  financialSettings?: FinancialSettings;
  initialSubTab?: ReportSubTab;
  onSubTabChange?: (tab: ReportSubTab) => void;
}

export function ReportsTab({ 
  expenses, 
  categories = [], 
  allCardInstallments = [], 
  formatCurrency,
  financialSettings,
  initialSubTab,
  onSubTabChange
}: ReportsTabProps) {
  const [activeReportTab, setActiveReportTab] = useState<ReportSubTab>(initialSubTab || 'geral');
  const [isReportDropdownOpen, setIsReportDropdownOpen] = useState(false);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const reportDropdownRef = useRef<HTMLDivElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialSubTab) {
      setActiveReportTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (reportDropdownRef.current && !reportDropdownRef.current.contains(event.target as Node)) {
        setIsReportDropdownOpen(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsReportDropdownOpen(false);
        setIsFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleSelectReportTab = (tab: ReportSubTab) => {
    setActiveReportTab(tab);
    onSubTabChange?.(tab);
    setIsReportDropdownOpen(false);
  };
  
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

  // Filtros da aba Extrato de Doações (Auditoria de Aportes Voluntários)
  const [statementDonor, setStatementDonor] = useState<string>('todos');
  const [donorCategoryFilter, setDonorCategoryFilter] = useState<string>('all');
  const [donorSearch, setDonorSearch] = useState<string>('');
  const [donorSortOrder, setDonorSortOrder] = useState<'desc' | 'asc' | 'highest' | 'lowest'>('desc');
  const [isExportingDonorImage, setIsExportingDonorImage] = useState<boolean>(false);

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
  // ABA EXTRATO DE DOAÇÕES (AUDITORIA DE APORTES VOLUNTÁRIOS)
  // -------------------------------------------------------------
  const donationExpenses = useMemo(() => {
    return expenses.filter(e => e.paymentMethod === 'doação');
  }, [expenses]);

  const totalDonationsAmount = useMemo(() => {
    return donationExpenses.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
  }, [donationExpenses]);

  const donorMetrics = useMemo(() => {
    const KNOWN_DONORS: Donor[] = ['Jorge', 'Jane', 'Saulo', 'Mccley', 'Jan'];
    const allNames = Array.from(new Set([
      ...KNOWN_DONORS,
      ...donationExpenses.map(e => e.donor?.trim()).filter(Boolean) as string[]
    ]));

    return allNames.map(dName => {
      const items = donationExpenses.filter(e => (e.donor?.trim() || 'Não Identificado') === dName);
      const total = items.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
      const count = items.length;
      const percentage = totalDonationsAmount > 0 ? (total / totalDonationsAmount) * 100 : 0;
      
      const catCount: Record<string, number> = {};
      items.forEach(e => {
        catCount[e.category] = (catCount[e.category] || 0) + (Number(e.value) || 0);
      });
      const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
      const highestItem = items.reduce((max, e) => Math.max(max, Number(e.value) || 0), 0);

      return {
        donor: dName,
        total,
        count,
        percentage,
        topCategory: topCat,
        highestItem,
        items
      };
    }).sort((a, b) => b.total - a.total);
  }, [donationExpenses, totalDonationsAmount]);

  const selectedDonorSummary = useMemo(() => {
    if (statementDonor === 'todos') {
      const topDonor = donorMetrics.find(m => m.total > 0)?.donor || '-';
      return {
        donor: 'Todos os Doadores (Consolidado)',
        total: totalDonationsAmount,
        count: donationExpenses.length,
        average: donationExpenses.length > 0 ? totalDonationsAmount / donationExpenses.length : 0,
        topDonor,
        highestDonation: donationExpenses.reduce((max, e) => Math.max(max, Number(e.value) || 0), 0)
      };
    }

    const found = donorMetrics.find(m => m.donor === statementDonor);
    if (found) {
      return {
        donor: found.donor,
        total: found.total,
        count: found.count,
        average: found.count > 0 ? found.total / found.count : 0,
        topDonor: found.donor,
        highestDonation: found.highestItem
      };
    }

    return {
      donor: statementDonor,
      total: 0,
      count: 0,
      average: 0,
      topDonor: '-',
      highestDonation: 0
    };
  }, [statementDonor, donorMetrics, totalDonationsAmount, donationExpenses]);

  const donationRows = useMemo(() => {
    let list = donationExpenses;

    if (statementDonor !== 'todos') {
      list = list.filter(e => (e.donor?.trim() || 'Não Identificado') === statementDonor);
    }

    if (donorCategoryFilter !== 'all') {
      list = list.filter(e => e.category === donorCategoryFilter);
    }

    if (donorSearch) {
      const lower = donorSearch.toLowerCase();
      list = list.filter(e => {
        const auditId = formatAuditId('EXP', e.id).toLowerCase();
        return (
          auditId.includes(lower) ||
          (e.local && e.local.toLowerCase().includes(lower)) ||
          (e.observation && e.observation.toLowerCase().includes(lower)) ||
          (e.category && e.category.toLowerCase().includes(lower)) ||
          (e.donor && e.donor.toLowerCase().includes(lower))
        );
      });
    }

    const sorted = [...list].sort((a, b) => {
      if (donorSortOrder === 'desc') {
        return (b.date || '').localeCompare(a.date || '');
      }
      if (donorSortOrder === 'asc') {
        return (a.date || '').localeCompare(b.date || '');
      }
      if (donorSortOrder === 'highest') {
        return (Number(b.value) || 0) - (Number(a.value) || 0);
      }
      if (donorSortOrder === 'lowest') {
        return (Number(a.value) || 0) - (Number(b.value) || 0);
      }
      return 0;
    });

    let runningTotal = 0;
    return sorted.map(row => {
      const val = Number(row.value) || 0;
      runningTotal += val;
      const itemPercentage = totalDonationsAmount > 0 ? (val / totalDonationsAmount) * 100 : 0;
      return {
        ...row,
        runningTotal,
        itemPercentage
      };
    });
  }, [donationExpenses, statementDonor, donorCategoryFilter, donorSearch, donorSortOrder, totalDonationsAmount]);

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

  const exportDonationsToExcel = () => {
    try {
      const dataToExport = donationRows.map(row => {
        const auditId = formatAuditId('EXP', row.id);
        const donorName = row.donor?.trim() || 'Não Identificado';
        return {
          'Data': row.date ? row.date.split('-').reverse().join('/') : '',
          'Código': auditId,
          'Doador Titular': donorName,
          'Histórico / Material / Local': row.local || '',
          'Categoria': row.category || '',
          'Forma de Pagamento': 'Doação (Sem rateio)',
          'Valor (R$)': Number(row.value) || 0,
          '% do Total': totalDonationsAmount > 0 ? `${((Number(row.value) || 0) / totalDonationsAmount * 100).toFixed(2)}%` : '0%',
          'Observações': row.observation || ''
        };
      });

      const summaryData = donorMetrics.map(m => ({
        'Doador': m.donor,
        'Total Doado (R$)': m.total,
        'Qtd. de Contribuições': m.count,
        '% do Total Geral': `${m.percentage.toFixed(2)}%`,
        'Categoria Principal': m.topCategory,
        'Maior Doação (R$)': m.highestItem
      }));

      const wb = XLSX.utils.book_new();
      const wsDetails = XLSX.utils.json_to_sheet(dataToExport);
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      
      XLSX.utils.book_append_sheet(wb, wsDetails, 'Extrato de Doações');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumo por Doador');

      const donorTag = statementDonor === 'todos' ? 'Consolidado' : statementDonor;
      const fileName = `Extrato_Doacoes_${donorTag}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success('Extrato de doações em Excel exportado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar doações:', err);
      toast.error('Erro ao gerar planilha do extrato de doações.');
    }
  };

  const copyDonationsToWhatsApp = () => {
    try {
      const dataEmissao = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      const donorTitle = selectedDonorSummary.donor;

      let text = `💜 *EXTRATO DE DOAÇÕES PARA AUDITORIA - CASA DO LAGO*\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n`;
      text += `👤 *Titular:* ${donorTitle}\n`;
      text += `📅 *Emissão:* ${dataEmissao}\n`;
      text += `💎 *Total Geral em Doações:* ${formatCurrency(selectedDonorSummary.total)}\n`;
      text += `📦 *Total de Contribuições:* ${selectedDonorSummary.count} itens\n`;
      text += `⚖️ *Regra:* Gastos voluntários • Não geram débito de rateio entre sócios\n`;
      text += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

      if (statementDonor === 'todos') {
        text += `🏆 *RESUMO POR DOADOR:*\n`;
        donorMetrics.filter(m => m.total > 0).forEach(m => {
          text += `• *${m.donor}:* ${formatCurrency(m.total)} (${m.count} itens • ${m.percentage.toFixed(1)}%)\n`;
        });
        text += `\n`;
      }

      if (donationRows.length > 0) {
        text += `📋 *ITENS AUDITADOS (${donationRows.length}):*\n`;
        donationRows.forEach((r, idx) => {
          const auditId = formatAuditId('EXP', r.id);
          const dt = r.date ? r.date.split('-').reverse().join('/') : '-';
          const dName = r.donor || 'Não Identificado';
          text += `${idx + 1}. ${dt} | *${r.local}* (${r.category})\n`;
          text += `   ↳ ${auditId} | *${formatCurrency(r.value)}* [Doador: ${dName}]\n`;
          if (r.observation) text += `   ↳ _Obs: ${r.observation}_\n`;
        });
      } else {
        text += `Nenhum lançamento encontrado para os filtros selecionados.\n`;
      }

      text += `\n_Relatório auditado pelo Sistema de Gestão Casa do Lago_`;

      navigator.clipboard.writeText(text);
      toast.success('Extrato de doações copiado para o WhatsApp com sucesso!');
    } catch (err) {
      console.error('Erro ao copiar extrato de doações:', err);
      toast.error('Não foi possível copiar o extrato de doações.');
    }
  };

  const exportDonationImage = async () => {
    const element = document.getElementById('extrato-doacoes-view');
    if (!element) return;

    setIsExportingDonorImage(true);
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

      const donorTag = statementDonor === 'todos' ? 'Consolidado' : statementDonor;
      const link = document.createElement('a');
      link.download = `Extrato_Doacoes_${donorTag}_${format(new Date(), 'yyyyMMdd')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Imagem do extrato de doações gerada com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar imagem:', err);
      toast.error('Não foi possível gerar imagem do extrato.');
    } finally {
      setIsExportingDonorImage(false);
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

  const currentSettings = financialSettings ?? getStoredFinancialSettings();
  const activeCondominioCost = currentSettings.condominioCost;
  const activeTerrenoCost = currentSettings.terrenoCost;
  const FIXED_COSTS = activeTerrenoCost + activeCondominioCost;
  const PEOPLE_COUNT = currentSettings.peopleCount || 4; // Jorge, Mccley, Jan, Saulo
  const FIXED_PER_PERSON = FIXED_COSTS / PEOPLE_COUNT;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      {/* ======================================================== */}
      {/* CABEÇALHO DO MÓDULO & NAVEGAÇÃO ENTRE ABAS               */}
      {/* ======================================================== */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
        
        {/* SUBMENU SUSPENSO DA PÁGINA "RELATÓRIO" */}
        <div className="relative shrink-0" ref={reportDropdownRef}>
          <button
            type="button"
            onClick={() => setIsReportDropdownOpen(prev => !prev)}
            className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/70 hover:border-slate-600 rounded-2xl text-white font-semibold text-xs sm:text-sm shadow-xl ring-1 ring-white/10 transition-all cursor-pointer group w-full sm:w-auto justify-between"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                {activeReportTab === 'geral' && <FileText size={16} />}
                {activeReportTab === 'extrato' && <Landmark size={16} className="text-amber-400" />}
                {activeReportTab === 'doacoes' && <Heart size={16} className="text-purple-400" />}
                {activeReportTab === 'apagar' && <Users size={16} className="text-blue-400" />}
                {activeReportTab === 'faturas' && <CreditCard size={16} className="text-blue-400" />}
              </div>
              <div className="flex flex-col text-left truncate">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Submenu Relatório</span>
                <span className="text-white font-bold leading-tight flex items-center gap-2 truncate">
                  {activeReportTab === 'geral' && 'Geral'}
                  {activeReportTab === 'extrato' && 'Extrato de Sócios'}
                  {activeReportTab === 'doacoes' && 'Extrato de Doações'}
                  {activeReportTab === 'apagar' && 'A Pagar'}
                  {activeReportTab === 'faturas' && 'Faturas de Cartão'}

                  {activeReportTab === 'extrato' && pendingRefundsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/30 text-amber-300 border border-amber-500/40 shrink-0">
                      {pendingRefundsCount}
                    </span>
                  )}
                  {activeReportTab === 'doacoes' && donationExpenses.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-300 border border-purple-500/40 shrink-0">
                      {donationExpenses.length}
                    </span>
                  )}
                </span>
              </div>
            </div>
            <ChevronDown size={16} className={cn("text-slate-400 transition-transform duration-200 ml-2 group-hover:text-white shrink-0", isReportDropdownOpen && "rotate-180 text-blue-400")} />
          </button>

          {/* Submenu Suspenso Flutuante */}
          {isReportDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[95vw] bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/10 space-y-1">
              <div className="px-3 py-1.5 border-b border-slate-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Navegar pelos Relatórios</span>
              </div>
              
              <button
                type="button"
                onClick={() => handleSelectReportTab('geral')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group",
                  activeReportTab === 'geral' 
                    ? "bg-blue-600/20 text-white border border-blue-500/40 ring-1 ring-blue-500/30" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-colors shrink-0", activeReportTab === 'geral' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 group-hover:text-white")}>
                  <FileText size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white block">Geral</span>
                  <p className="text-[10px] text-slate-400 truncate">Conferência contábil de todos os lançamentos</p>
                </div>
                {activeReportTab === 'geral' && <Check size={14} className="text-blue-400 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => handleSelectReportTab('extrato')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group",
                  activeReportTab === 'extrato' 
                    ? "bg-amber-500/20 text-white border border-amber-500/40 ring-1 ring-amber-500/30" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-colors shrink-0", activeReportTab === 'extrato' ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800 text-amber-400 group-hover:text-amber-300")}>
                  <Landmark size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs sm:text-sm font-bold text-white block">Extrato de Sócios</span>
                    {pendingRefundsCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/30 text-amber-300 border border-amber-500/40">
                        {pendingRefundsCount} pendente{pendingRefundsCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">Extrato bancário de reembolsos de sócios</p>
                </div>
                {activeReportTab === 'extrato' && <Check size={14} className="text-amber-400 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => handleSelectReportTab('doacoes')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group",
                  activeReportTab === 'doacoes' 
                    ? "bg-purple-500/20 text-white border border-purple-500/40 ring-1 ring-purple-500/30" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-colors shrink-0", activeReportTab === 'doacoes' ? "bg-purple-600 text-white" : "bg-slate-800 text-purple-400 group-hover:text-purple-300")}>
                  <Heart size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs sm:text-sm font-bold text-white block">Extrato de Doações</span>
                    {donationExpenses.length > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-purple-500/30 text-purple-300 border border-purple-500/40">
                        {donationExpenses.length} doações
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">Auditoria contábil de aportes voluntários</p>
                </div>
                {activeReportTab === 'doacoes' && <Check size={14} className="text-purple-400 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => handleSelectReportTab('apagar')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group",
                  activeReportTab === 'apagar' 
                    ? "bg-blue-600/20 text-white border border-blue-500/40 ring-1 ring-blue-500/30" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-colors shrink-0", activeReportTab === 'apagar' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 group-hover:text-white")}>
                  <Users size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white block">A Pagar</span>
                  <p className="text-[10px] text-slate-400 truncate">Rateio de custos fixos e saldos individuais</p>
                </div>
                {activeReportTab === 'apagar' && <Check size={14} className="text-blue-400 shrink-0" />}
              </button>

              <button
                type="button"
                onClick={() => handleSelectReportTab('faturas')}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group",
                  activeReportTab === 'faturas' 
                    ? "bg-blue-600/20 text-white border border-blue-500/40 ring-1 ring-blue-500/30" 
                    : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                )}
              >
                <div className={cn("p-2 rounded-xl transition-colors shrink-0", activeReportTab === 'faturas' ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 group-hover:text-white")}>
                  <CreditCard size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs sm:text-sm font-bold text-white block">Faturas de Cartão</span>
                  <p className="text-[10px] text-slate-400 truncate">Projeção mensal e faturas de cartão</p>
                </div>
                {activeReportTab === 'faturas' && <Check size={14} className="text-blue-400 shrink-0" />}
              </button>
            </div>
          )}
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
            Por sócio ({formatCurrency(FIXED_COSTS)} ÷ {PEOPLE_COUNT})
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ABA 1: RELATÓRIO GERAL APERFEIÇOADO                     */}
      {/* ======================================================== */}
      {activeReportTab === 'geral' && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca Limpa */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-3.5 sm:p-4 ring-1 ring-white/5 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Campo de Busca */}
              <div className="relative flex-1 group">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
                <input
                  type="text"
                  placeholder="Buscar por local, categoria, ID #EXP, sócio, obs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-8 py-2.5 bg-slate-950/60 border border-slate-700/60 text-white rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-500"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                    title="Limpar busca"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Botões de Ação: Submenu Suspenso de Filtros + Exportação Excel */}
              <div className="flex items-center gap-2 shrink-0">
                {/* SUBMENU SUSPENSO DE FILTROS DOS LANÇAMENTOS */}
                <div className="relative" ref={filterDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsFilterDropdownOpen(prev => !prev)}
                    className={cn(
                      "px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border shadow-sm",
                      (filter !== 'all' || paymentFilter !== 'all')
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30"
                        : "bg-slate-950/60 hover:bg-slate-800/80 text-slate-300 border-slate-700/60"
                    )}
                  >
                    <Filter size={15} className={cn((filter !== 'all' || paymentFilter !== 'all') ? "text-emerald-400" : "text-slate-400")} />
                    <span>Filtros</span>
                    {(filter !== 'all' || paymentFilter !== 'all') && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                        {(filter !== 'all' ? 1 : 0) + (paymentFilter !== 'all' ? 1 : 0)}
                      </span>
                    )}
                    <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-200", isFilterDropdownOpen && "rotate-180 text-emerald-400")} />
                  </button>

                  {/* Popover Suspenso dos Filtros */}
                  {isFilterDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[92vw] bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/10 space-y-4">
                      {/* Cabeçalho do Popover */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Filter size={15} className="text-emerald-400" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">Filtros de Lançamento</span>
                        </div>
                        {(filter !== 'all' || paymentFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setFilter('all');
                              setPaymentFilter('all');
                            }}
                            className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            Limpar filtros
                          </button>
                        )}
                      </div>

                      {/* Seção 1: Categorias */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <span>Categoria</span>
                          <span className="text-slate-500">{filteredExpenses.length} itens</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto custom-scrollbar p-0.5">
                          <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={cn(
                              "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border",
                              filter === 'all'
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30 font-bold"
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
                              type="button"
                              onClick={() => setFilter(cat)}
                              className={cn(
                                "px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border",
                                filter === cat
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-500/30 font-bold"
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
                      </div>

                      {/* Seção 2: Forma de Pagamento */}
                      <div className="space-y-2 pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Forma de Pagamento</span>
                        <div className="flex flex-wrap gap-1.5">
                          {['all', 'Pix', 'Cartão', 'Caixa', 'doação'].map((pm) => (
                            <button
                              key={pm}
                              type="button"
                              onClick={() => setPaymentFilter(pm)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border",
                                paymentFilter === pm
                                  ? "bg-blue-500/20 text-blue-300 border-blue-500/40 ring-1 ring-blue-500/30 font-bold"
                                  : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800/60 hover:text-slate-200"
                              )}
                            >
                              {pm === 'all' ? 'Todos os Pagamentos' : pm}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Rodapé do Popover */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">
                          {filteredExpenses.length} {filteredExpenses.length === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsFilterDropdownOpen(false)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
                        >
                          Concluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botão de Exportação Excel */}
                <button
                  type="button"
                  onClick={exportGeneralToExcel}
                  className="px-3.5 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
                  title="Exportar dados filtrados para Excel"
                >
                  <FileSpreadsheet size={15} />
                  <span className="hidden sm:inline">Exportar Excel</span>
                </button>
              </div>
            </div>

            {/* Chips de Filtros Ativos (aparecem de forma compacta quando ativos) */}
            {(filter !== 'all' || paymentFilter !== 'all') && (
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60 flex-wrap animate-in fade-in duration-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filtros Ativos:</span>
                {filter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium">
                    <span>Categoria: {filter} ({categoryCounts[filter] || 0})</span>
                    <button
                      type="button"
                      onClick={() => setFilter('all')}
                      className="hover:text-white transition-colors cursor-pointer text-xs"
                      title="Remover filtro de categoria"
                    >
                      ✕
                    </button>
                  </span>
                )}
                {paymentFilter !== 'all' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/15 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium">
                    <span>Pagamento: {paymentFilter}</span>
                    <button
                      type="button"
                      onClick={() => setPaymentFilter('all')}
                      className="hover:text-white transition-colors cursor-pointer text-xs"
                      title="Remover filtro de pagamento"
                    >
                      ✕
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setFilter('all');
                    setPaymentFilter('all');
                  }}
                  className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer ml-1"
                >
                  Limpar todos
                </button>
              </div>
            )}
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
      {/* ABA 2.5: EXTRATO DE DOAÇÕES (AUDITORIA CONTÁBIL)        */}
      {/* ======================================================== */}
      {activeReportTab === 'doacoes' && (
        <div className="space-y-6">
          {/* Seletor de Contas de Doadores (Pills Estilo Contábil) */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 rounded-2xl p-4 sm:p-5 ring-1 ring-white/5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400 block flex items-center gap-1.5">
                  <Heart size={14} className="fill-purple-400 text-purple-400" />
                  Selecione o Doador Titular para Auditoria
                </span>
                <p className="text-xs text-slate-400 mt-0.5">
                  Conferência detalhada item a item de doações voluntárias e materiais sem rateio
                </p>
              </div>

              {/* Botões de Ação do Extrato */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={copyDonationsToWhatsApp}
                  className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Copiar extrato formatado para colar no WhatsApp"
                >
                  <Share2 size={13} />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={exportDonationsToExcel}
                  className="px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Baixar planilha Excel do extrato"
                >
                  <FileSpreadsheet size={13} />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  disabled={isExportingDonorImage}
                  onClick={exportDonationImage}
                  className="px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Exportar imagem PNG do extrato"
                >
                  <Download size={13} />
                  <span>{isExportingDonorImage ? 'Gerando...' : 'Imagem'}</span>
                </button>
              </div>
            </div>

            {/* Contas dos Doadores (Pills Grandes) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <button
                type="button"
                onClick={() => setStatementDonor('todos')}
                className={cn(
                  "p-3 rounded-xl border text-left transition-all cursor-pointer",
                  statementDonor === 'todos'
                    ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30 font-bold ring-1 ring-purple-300/40"
                    : "bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:text-white"
                )}
              >
                <div className="text-xs font-bold uppercase tracking-wider">
                  Consolidado
                </div>
                <div className={cn(
                  "text-sm sm:text-base font-mono font-bold mt-1",
                  statementDonor === 'todos' ? "text-white" : "text-purple-300"
                )}>
                  {formatCurrency(totalDonationsAmount)}
                </div>
                <div className={cn(
                  "text-[10px] mt-0.5",
                  statementDonor === 'todos' ? "text-purple-200" : "text-slate-400"
                )}>
                  {donationExpenses.length} doações
                </div>
              </button>

              {donorMetrics.map(m => {
                const isSelected = statementDonor === m.donor;
                return (
                  <button
                    key={m.donor}
                    type="button"
                    onClick={() => setStatementDonor(m.donor)}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-all cursor-pointer",
                      isSelected
                        ? "bg-purple-600 text-white border-purple-400 shadow-lg shadow-purple-600/30 font-bold ring-1 ring-purple-300/40"
                        : "bg-slate-950/50 border-slate-800 text-slate-300 hover:bg-slate-800/50 hover:text-white"
                    )}
                  >
                    <div className="text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                      <span>{m.donor}</span>
                      {m.count > 0 && (
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          isSelected ? "bg-white" : "bg-purple-400 animate-pulse"
                        )} />
                      )}
                    </div>
                    <div className={cn(
                      "text-sm sm:text-base font-mono font-bold mt-1",
                      isSelected ? "text-white" : m.total > 0 ? "text-purple-300" : "text-slate-500"
                    )}>
                      {formatCurrency(m.total)}
                    </div>
                    <div className={cn(
                      "text-[10px] mt-0.5",
                      isSelected ? "text-purple-200" : "text-slate-400"
                    )}>
                      {m.total > 0 ? `${m.count} nota(s) • ${m.percentage.toFixed(0)}%` : 'Sem doações'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ======================================================== */}
          {/* CARTÃO DO EXTRATO CONTÁBIL DE DOAÇÕES                     */}
          {/* ======================================================== */}
          <div id="extrato-doacoes-view" className="bg-slate-900/80 backdrop-blur-2xl border border-purple-500/20 rounded-3xl p-5 sm:p-7 shadow-2xl ring-1 ring-white/10 space-y-6">
            {/* Cabeçalho do Extrato Tipo Folha Oficial */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-purple-600/30 shrink-0">
                  <Heart size={24} className="fill-white/30" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono tracking-widest uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded font-bold">
                      Aportes Voluntários
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Auditoria Nº {format(new Date(), 'yyyyMMdd')}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
                    Extrato Contábil de Doações
                  </h3>
                  <p className="text-xs text-slate-400">
                    Titular: <span className="font-bold text-white">{selectedDonorSummary.donor}</span> • Emissão: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              {/* Saldo Líquido do Extrato de Doações */}
              <div className="bg-slate-950/80 border border-purple-500/30 rounded-2xl p-4 text-left sm:text-right shrink-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-purple-300/80 block">
                  Total Doado no Período
                </span>
                <span className="text-2xl sm:text-3xl font-mono font-bold block mt-0.5 text-purple-300">
                  {formatCurrency(selectedDonorSummary.total)}
                </span>
                <div className="mt-1 flex items-center sm:justify-end gap-1.5">
                  <span className="text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <ShieldCheck size={10} /> Não Gera Rateio Entre Sócios
                  </span>
                </div>
              </div>
            </div>

            {/* Balancete Resumo das Doações (3 Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                    Total Registrado (R$)
                  </span>
                  <span className="text-base sm:text-lg font-mono font-bold text-white mt-0.5 block">
                    {formatCurrency(selectedDonorSummary.total)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {selectedDonorSummary.count} lançamento(s) auditado(s)
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Heart size={18} className="fill-purple-400/20" />
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                    Ticket Médio por Nota
                  </span>
                  <span className="text-base sm:text-lg font-mono font-bold text-slate-200 mt-0.5 block">
                    {formatCurrency(selectedDonorSummary.average)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Valor médio por contribuição
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <FileText size={18} />
                </div>
              </div>

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                    Maior Aporte Único
                  </span>
                  <span className="text-base sm:text-lg font-mono font-bold text-emerald-400 mt-0.5 block">
                    {formatCurrency(selectedDonorSummary.highestDonation)}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate max-w-[150px] block" title={`Doador: ${selectedDonorSummary.topDonor}`}>
                    Doador: {selectedDonorSummary.topDonor}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Trophy size={18} />
                </div>
              </div>
            </div>

            {/* Barra de Filtros Internos do Extrato de Doações */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 no-export">
              {/* Categorias Pills com Contadores */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-1">
                <button 
                  onClick={() => setDonorCategoryFilter('all')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                    donorCategoryFilter === 'all' 
                      ? "bg-purple-600/30 text-purple-200 border-purple-500/50 ring-1 ring-purple-500/30" 
                      : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800/60 hover:text-slate-200"
                  )}
                >
                  <span>Todas</span>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-mono">
                    {donationExpenses.length}
                  </span>
                </button>
                {availableCategories.map(cat => {
                  const count = donationExpenses.filter(e => e.category === cat).length;
                  if (count === 0) return null;
                  return (
                    <button 
                      key={cat}
                      onClick={() => setDonorCategoryFilter(cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border",
                        donorCategoryFilter === cat 
                          ? "bg-purple-600/30 text-purple-200 border-purple-500/50 ring-1 ring-purple-500/30" 
                          : "bg-slate-950/40 text-slate-400 border-slate-800 hover:bg-slate-800/60 hover:text-slate-200"
                      )}
                    >
                      <span>{cat}</span>
                      <span className="text-[10px] bg-slate-800 px-1.5 py-0.2 rounded-full font-mono">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Busca e Ordenação */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filtrar por local, ID, doador..."
                    value={donorSearch}
                    onChange={(e) => setDonorSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 text-xs rounded-xl text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 w-48 sm:w-60"
                  />
                </div>

                <select
                  value={donorSortOrder}
                  onChange={(e) => setDonorSortOrder(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold transition-all cursor-pointer outline-none"
                >
                  <option value="desc" className="bg-slate-900">Mais recentes</option>
                  <option value="asc" className="bg-slate-900">Mais antigos</option>
                  <option value="highest" className="bg-slate-900">Maior valor</option>
                  <option value="lowest" className="bg-slate-900">Menor valor</option>
                </select>
              </div>
            </div>

            {/* TABELA DE LANÇAMENTOS DO EXTRATO DE DOAÇÕES */}
            <div className="overflow-x-auto custom-scrollbar border border-slate-800/80 rounded-2xl bg-slate-950/50">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-slate-950/90 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="px-3.5 py-3">Data</th>
                    <th className="px-3.5 py-3">Documento</th>
                    <th className="px-3.5 py-3">Histórico / Estabelecimento</th>
                    <th className="px-3.5 py-3">Doador Titular</th>
                    <th className="px-3.5 py-3">Categoria</th>
                    <th className="px-3.5 py-3 text-right">Valor R$</th>
                    <th className="px-3.5 py-3 text-center">% Impacto</th>
                    <th className="px-3.5 py-3 text-right">Total Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {donationRows.map((row) => {
                    const auditId = formatAuditId('EXP', row.id);
                    const donorName = row.donor?.trim() || 'Não Identificado';

                    return (
                      <tr 
                        key={row.id} 
                        className="transition-colors hover:bg-purple-600/5 bg-slate-950/20"
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
                            className="font-mono text-[9px] text-purple-400 bg-purple-500/10 hover:bg-purple-500/25 border border-purple-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center cursor-pointer"
                          >
                            {auditId}
                          </button>
                        </td>

                        {/* Histórico / Fornecedor */}
                        <td className="px-3.5 py-3 font-sans">
                          <div className="font-semibold text-white text-xs sm:text-sm flex items-center gap-1.5">
                            <span>{row.local}</span>
                          </div>
                          {row.observation && (
                            <div className="text-[11px] text-slate-400 italic mt-0.5 font-sans" title={row.observation}>
                              {row.observation}
                            </div>
                          )}
                        </td>

                        {/* Doador Titular */}
                        <td className="px-3.5 py-3 whitespace-nowrap font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {donorName}
                          </span>
                        </td>

                        {/* Categoria */}
                        <td className="px-3.5 py-3 whitespace-nowrap font-sans text-[11px] text-slate-300">
                          <span className="text-[10px] font-normal text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60 font-mono">
                            {row.category}
                          </span>
                        </td>

                        {/* Valor R$ */}
                        <td className="px-3.5 py-3 text-right whitespace-nowrap font-bold text-white text-xs sm:text-sm">
                          {formatCurrency(row.value)}
                        </td>

                        {/* % Impacto sobre total doado */}
                        <td className="px-3.5 py-3 text-center whitespace-nowrap font-sans">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-purple-300 border border-slate-700">
                            {row.itemPercentage.toFixed(1)}%
                          </span>
                        </td>

                        {/* Saldo Acumulado Progressivo */}
                        <td className="px-3.5 py-3 text-right whitespace-nowrap font-bold text-purple-300 font-mono text-xs sm:text-sm">
                          {formatCurrency(row.runningTotal)}
                        </td>
                      </tr>
                    );
                  })}

                  {donationRows.length === 0 && (
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
                Total de transações listadas: <span className="font-bold text-white">{donationRows.length}</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Total Auditado Apurado: <strong className="text-purple-300 text-sm">{formatCurrency(selectedDonorSummary.total)}</strong></span>
              </div>
            </div>

            {/* Demonstrativo Resumido por Doador (Ranking Contábil) */}
            <div className="mt-6 pt-6 border-t border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Trophy size={14} className="text-amber-400" />
                Quadro Resumo de Doações por Participante
              </h4>
              <div className="overflow-x-auto custom-scrollbar border border-slate-800 rounded-xl bg-slate-950/40">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="px-3.5 py-2.5">Participante</th>
                      <th className="px-3.5 py-2.5 text-right">Total Contribuído</th>
                      <th className="px-3.5 py-2.5 text-center">Qtd. Notas</th>
                      <th className="px-3.5 py-2.5 text-center">% de Participação</th>
                      <th className="px-3.5 py-2.5">Categoria Principal</th>
                      <th className="px-3.5 py-2.5 text-right">Maior Doação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {donorMetrics.map((m, idx) => (
                      <tr key={m.donor} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-3.5 py-2.5 font-sans font-semibold text-white flex items-center gap-2">
                          <span className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono",
                            idx === 0 && m.total > 0 ? "bg-amber-500 text-slate-950" : "bg-slate-800 text-slate-300"
                          )}>
                            {idx + 1}
                          </span>
                          <span>{m.donor}</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-bold text-purple-300">
                          {formatCurrency(m.total)}
                        </td>
                        <td className="px-3.5 py-2.5 text-center text-slate-300 font-sans">
                          {m.count}
                        </td>
                        <td className="px-3.5 py-2.5 text-center text-slate-300">
                          {m.percentage.toFixed(1)}%
                        </td>
                        <td className="px-3.5 py-2.5 font-sans text-slate-400">
                          {m.topCategory}
                        </td>
                        <td className="px-3.5 py-2.5 text-right text-slate-300">
                          {formatCurrency(m.highestItem)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                Parcela fixa de {formatCurrency(FIXED_PER_PERSON)} ({formatCurrency(FIXED_COSTS)} / {PEOPLE_COUNT}) somada à fatura proporcional do cartão de crédito
              </p>
            </div>
            <div className="text-xs text-slate-400 font-mono bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
              4 sócios participantes
            </div>
          </div>

          <div className="space-y-2.5">
            {allCardInstallments.length > 0 ? (
              allCardInstallments.map((item) => {
                const duesResult = calculateMonthlyPartnerDues(item.month, item.total, currentSettings, item.items);
                const { hasActivePartnerFixed, hasSauloSplitExpense, dues } = duesResult;
                const fixedPerPersonThisMonth = duesResult.fixedCostPerPerson;
                const cardPerPersonNormal = item.total / PEOPLE_COUNT;
                const standardTotal = cardPerPersonNormal + fixedPerPersonThisMonth;
                
                return (
                  <div key={item.month} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 bg-slate-950/50 rounded-xl border border-slate-800/80 hover:bg-slate-800/40 transition-colors gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-100 capitalize">
                          {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                        </span>
                        <div className="flex items-center gap-1">
                          {hasActivePartnerFixed && (
                            <span 
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                              title="Parcela fixa com abatimento do saldo na fatura dos demais sócios"
                            >
                              Parcelas Fixas
                            </span>
                          )}
                          {hasSauloSplitExpense && !hasActivePartnerFixed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              Parc. Saulo
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 font-semibold tracking-wide uppercase mt-1 flex flex-wrap items-center gap-2">
                        <span>Fixo Terreno/Cond.: <span className="text-slate-200 font-mono">{formatCurrency(fixedPerPersonThisMonth)}</span></span>
                        <span className="text-slate-600">•</span>
                        <span>Total Fatura: <span className="text-slate-200 font-mono">{formatCurrency(item.total)}</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {hasActivePartnerFixed ? (
                        <div className="flex flex-wrap items-center gap-2 text-right">
                          {(['Jorge', 'Mccley', 'Jan', 'Saulo'] as Person[]).map((p) => {
                            const due = dues[p];
                            return (
                              <div key={p} className="bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-left sm:text-right">
                                <span className="text-[9px] uppercase font-bold text-slate-400 block">{p}</span>
                                <span className={`text-sm font-mono font-bold block ${due.isFixed ? 'text-cyan-300' : 'text-white'}`}>
                                  {formatCurrency(due.totalDue)}
                                </span>
                                {due.isFixed ? (
                                  <span className="text-[8px] text-cyan-300 font-medium block">
                                    Parcela Fixa
                                  </span>
                                ) : (
                                  <span className="text-[8px] text-slate-400 font-mono block">
                                    {due.cardShare < 0 
                                      ? `Abat. -${formatCurrency(Math.abs(due.cardShare))}`
                                      : `Cartão +${formatCurrency(due.cardShare)}`}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : hasSauloSplitExpense ? (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-right">
                          <div className="bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-700/60">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Mccley, Jan, Jorge (1/3)</span>
                            <span className="text-base font-mono font-bold text-amber-300">{formatCurrency(dues.Jorge.totalDue)}</span>
                          </div>
                          <div className="bg-slate-900/50 px-2.5 py-1 rounded-lg border border-slate-800">
                            <span className="text-[9px] uppercase font-bold text-slate-400 block">Saulo</span>
                            <span className="text-base font-mono font-bold text-slate-300">{formatCurrency(dues.Saulo.totalDue)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Total por Pessoa</span>
                          <span className="text-lg sm:text-xl font-mono font-bold text-emerald-400">
                            {formatCurrency(standardTotal)}
                          </span>
                        </div>
                      )}
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
                                <th className="px-4 py-2.5 text-center">Rateio</th>
                                <th className="px-4 py-2.5 text-right">Valor Parcela</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-xs">
                              {[...(item.items || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((detail, idx) => {
                                const isSauloSplit = detail.originalExp?.rateioType === 'Parc. Fixa Saulo' || 
                                  detail.originalExp?.observation?.includes('[Parc. Fixa Saulo]');
                                return (
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
                                    <td className="px-4 py-2.5 text-center whitespace-nowrap">
                                      {isSauloSplit ? (
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                          Parc. Saulo (3)
                                        </span>
                                      ) : (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                                          4 Sócios
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-slate-200 text-right whitespace-nowrap">
                                      {formatCurrency(detail.value)}
                                    </td>
                                  </tr>
                                );
                              })}
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
