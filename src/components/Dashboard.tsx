import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  LabelList,
  Legend
} from 'recharts';
import { Banknote, TrendingUp, CreditCard, BarChart as BarChartIcon, User, RefreshCw, Wallet, ChevronDown, ChevronUp, Download, RotateCcw, CheckCircle2, Clock, ShieldCheck, Check, Pencil, Building2, Heart, Trophy, Sparkles, ArrowUpRight, FileText, ArrowLeftRight, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from './ui/Card';
import { toPng } from 'html-to-image';
import { formatAuditId, copyAuditIdToClipboard } from '../utils/audit';
import { Expense, Person } from '../types';
import { EditCondominioModal } from './EditCondominioModal';
import { 
  FinancialSettings, 
  getStoredFinancialSettings, 
  saveStoredFinancialSettings,
  calculateFixedPerPersonForMonth,
  getCondominioCostForMonth,
  applyCondominioAdjustment 
} from '../utils/financialSettings';
import { toast } from 'sonner';

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', 
  '#06b6d4', '#14b8a6', '#f97316', '#6366f1', '#84cc16', 
  '#e11d48', '#d97706'
];

interface DashboardProps {
  totalSpent: number;
  totalDonations: number;
  categoryTotals: { name: string; value: number }[];
  cardInstallments: { month: string; total: number }[];
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
  caixaBalance: number;
  terrenoBalance: number;
  formatCurrency: (v: number) => string;
  onRefresh: () => Promise<void>;
  syncStatus?: 'syncing' | 'local' | 'error';
  expenses?: Expense[];
  onToggleRefund?: (id: string) => Promise<void>;
  isSharedMode?: boolean;
  financialSettings?: FinancialSettings;
  onUpdateCondominio?: (newVal: number, effectiveFrom?: string) => Promise<void> | void;
  onNavigateToReports?: (subTab?: 'geral' | 'extrato' | 'doacoes' | 'apagar' | 'faturas') => void;
}

const TriangleBar = (props: any) => {
  const { fill, x, y, width, height } = props;
  const depth = 10;
  
  return (
    <g>
      {/* Front face */}
      <path d={`M${x},${y} L${x + width},${y} L${x + width},${y + height} L${x},${y + height} Z`} fill={fill} />
      {/* Top face */}
      <path d={`M${x},${y} L${x + depth},${y - depth} L${x + width + depth},${y - depth} L${x + width},${y} Z`} fill={fill} opacity={0.8} />
      {/* Right face */}
      <path d={`M${x + width},${y} L${x + width + depth},${y - depth} L${x + width + depth},${y + height - depth} L${x + width},${y + height} Z`} fill={fill} opacity={0.6} />
    </g>
  );
};

export function Dashboard({ 
  totalSpent, 
  totalDonations, 
  categoryTotals, 
  cardInstallments, 
  allCardInstallments, 
  caixaBalance, 
  terrenoBalance, 
  formatCurrency, 
  onRefresh, 
  syncStatus,
  expenses = [],
  onToggleRefund,
  isSharedMode = false,
  financialSettings,
  onUpdateCondominio,
  onNavigateToReports
}: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [expandedInvoice, setExpandedInvoice] = React.useState<string | null>(null);
  const [isEditCondoOpen, setIsEditCondoOpen] = React.useState(false);
  const [localSettings, setLocalSettings] = React.useState<FinancialSettings>(() => financialSettings ?? getStoredFinancialSettings());

  React.useEffect(() => {
    if (financialSettings) {
      setLocalSettings(financialSettings);
    }
  }, [financialSettings]);

  React.useEffect(() => {
    const handleSync = (e: any) => {
      if (e.detail) {
        setLocalSettings(e.detail);
      } else {
        setLocalSettings(getStoredFinancialSettings());
      }
    };
    window.addEventListener('financialSettingsUpdated', handleSync);
    return () => window.removeEventListener('financialSettingsUpdated', handleSync);
  }, []);

  // Estados do Painel de Gestão de Devoluções aos Sócios
  const [refundStatusFilter, setRefundStatusFilter] = React.useState<'pendente' | 'devolvido' | 'todos'>('pendente');
  const [refundPartnerFilter, setRefundPartnerFilter] = React.useState<string>('todos');
  const [processingRefundId, setProcessingRefundId] = React.useState<string | null>(null);

  const allReimbursements = React.useMemo(() => {
    return (expenses || []).filter(e => Boolean(e.isReimbursement));
  }, [expenses]);

  const pendingReimbursements = React.useMemo(() => {
    return allReimbursements.filter(e => e.refundStatus === 'Pendente' || (!e.refundStatus && e.status !== 'DEVOLVIDO'));
  }, [allReimbursements]);

  const settledReimbursements = React.useMemo(() => {
    return allReimbursements.filter(e => e.refundStatus === 'Devolvido' || e.status === 'DEVOLVIDO');
  }, [allReimbursements]);

  const totalPendingRefunds = React.useMemo(() => {
    return pendingReimbursements.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
  }, [pendingReimbursements]);

  const totalSettledRefunds = React.useMemo(() => {
    return settledReimbursements.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
  }, [settledReimbursements]);

  const partnerBalances = React.useMemo(() => {
    const partners: Person[] = ['Mccley', 'Jan', 'Saulo', 'Jorge'];
    return partners.map(p => {
      const pPending = pendingReimbursements.filter(e => (e.reimburseTo || e.donor) === p);
      const total = pPending.reduce((acc, e) => acc + (Number(e.value) || 0), 0);
      return { partner: p, count: pPending.length, total };
    });
  }, [pendingReimbursements]);

  // Cálculos do Gráfico de Doações por Pessoa
  const donationExpenses = React.useMemo(() => {
    return (expenses || []).filter(e => e.paymentMethod === 'doação');
  }, [expenses]);

  const totalCalculatedDonations = React.useMemo(() => {
    return donationExpenses.reduce((sum, e) => sum + (Number(e.value) || 0), 0);
  }, [donationExpenses]);

  const donationsByPerson = React.useMemo(() => {
    const totals: Record<string, number> = {};
    donationExpenses.forEach(e => {
      const donor = e.donor?.trim() || 'Não Identificado';
      totals[donor] = (totals[donor] || 0) + (Number(e.value) || 0);
    });

    return Object.entries(totals)
      .map(([name, value]) => {
        const percentage = totalCalculatedDonations > 0 ? (value / totalCalculatedDonations) * 100 : 0;
        return {
          name,
          value,
          percentage
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [donationExpenses, totalCalculatedDonations]);

  const filteredReimbursements = React.useMemo(() => {
    let list = allReimbursements;
    if (refundStatusFilter === 'pendente') {
      list = pendingReimbursements;
    } else if (refundStatusFilter === 'devolvido') {
      list = settledReimbursements;
    }

    if (refundPartnerFilter !== 'todos') {
      list = list.filter(e => (e.reimburseTo || e.donor) === refundPartnerFilter);
    }

    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [allReimbursements, pendingReimbursements, settledReimbursements, refundStatusFilter, refundPartnerFilter]);

  const handleAcknowledgeRefund = async (id: string) => {
    if (!onToggleRefund || processingRefundId) return;
    setProcessingRefundId(id);
    try {
      await onToggleRefund(id);
    } finally {
      setProcessingRefundId(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleInvoice = (month: string) => {
    setExpandedInvoice(expandedInvoice === month ? null : month);
  };

  const exportAsImage = async (elementId: string, filename: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const element = document.getElementById(elementId);
    if (!element) return;

    try {
      const dataUrl = await toPng(element, {
        backgroundColor: '#0f172a',
        style: {
          padding: '24px',
          borderRadius: '16px',
        },
        filter: (node) => {
          if (node instanceof HTMLElement) {
            if (node.classList?.contains('export-btn') || node.classList?.contains('chevron-icon')) {
              return false;
            }
          }
          return true;
        }
      });
      
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error exporting image:', err);
    }
  };

  const currentMonthKey = React.useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const activeSettings = financialSettings ?? localSettings;
  const activeCondominioCost = getCondominioCostForMonth(currentMonthKey, activeSettings);
  const activeTerrenoCost = activeSettings.terrenoCost;
  const PEOPLE_COUNT = activeSettings.peopleCount || 4;
  const FIXED_COSTS = activeTerrenoCost + activeCondominioCost;
  const FIXED_PER_PERSON = FIXED_COSTS / PEOPLE_COUNT;

  const previousMonthInfo = React.useMemo(() => {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthName = format(prevMonthDate, 'MMMM', { locale: ptBR });
    
    return {
      date: prevMonthDate,
      name: prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1)
    };
  }, []);

  const previousMonthValue = React.useMemo(() => {
    if (!allCardInstallments) return null;
    const prevMonthKey = format(previousMonthInfo.date, 'yyyy-MM');
    const prevMonthData = allCardInstallments.find(item => item.month === prevMonthKey);
    const prevFixedPerPerson = calculateFixedPerPersonForMonth(prevMonthKey, activeSettings);
    
    if (prevMonthData) {
      const cardPerPerson = prevMonthData.total / PEOPLE_COUNT;
      return cardPerPerson + prevFixedPerPerson;
    }
    return prevFixedPerPerson;
  }, [allCardInstallments, previousMonthInfo, activeSettings, PEOPLE_COUNT]);

  const previousMonthInvoiceTotal = React.useMemo(() => {
    if (!allCardInstallments) return null;
    const prevMonthKey = format(previousMonthInfo.date, 'yyyy-MM');
    const prevMonthData = allCardInstallments.find(item => item.month === prevMonthKey);
    
    if (prevMonthData) {
      return prevMonthData.total;
    }
    return 0;
  }, [allCardInstallments, previousMonthInfo]);

  // Informações do Mês Atual (2ª coluna em evidência)
  const currentMonthInfo = React.useMemo(() => {
    const now = new Date();
    const currMonthDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const currMonthName = format(currMonthDate, 'MMMM', { locale: ptBR });
    return {
      date: currMonthDate,
      key: format(currMonthDate, 'yyyy-MM'),
      name: currMonthName.charAt(0).toUpperCase() + currMonthName.slice(1)
    };
  }, []);

  // Projeção dinâmica de 12 meses das Faturas de Cartão:
  // 1ª Coluna (índice 0): Mês Anterior (em vermelho)
  // 2ª Coluna (índice 1): Mês Atual (em evidência)
  // Demais 10 Colunas (índices 2 a 11): Próximos meses (tom agradável)
  const twelveMonthsInvoices = React.useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const invoiceMap = new Map<string, { total: number; items: any[] }>();
    if (allCardInstallments) {
      allCardInstallments.forEach(item => {
        invoiceMap.set(item.month, item);
      });
    }

    return Array.from({ length: 12 }, (_, i) => {
      const monthOffset = i - 1; // -1 = anterior, 0 = atual, 1..10 = futuros
      const targetDate = new Date(currentYear, currentMonth + monthOffset, 1);
      const monthKey = format(targetDate, 'yyyy-MM');
      const shortMonth = format(targetDate, 'MMM/yy', { locale: ptBR });
      const fullMonth = format(targetDate, 'MMMM yyyy', { locale: ptBR });
      const monthOnly = format(targetDate, 'MMMM', { locale: ptBR });

      const existing = invoiceMap.get(monthKey);
      const total = existing ? existing.total : 0;
      const items = existing ? (existing.items || []) : [];

      const isPrevious = i === 0;
      const isCurrent = i === 1;

      return {
        monthKey,
        name: shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1),
        fullName: fullMonth.charAt(0).toUpperCase() + fullMonth.slice(1),
        monthOnly: monthOnly.charAt(0).toUpperCase() + monthOnly.slice(1),
        total,
        items,
        isPrevious,
        isCurrent,
        isFuture: i > 1,
        index: i
      };
    });
  }, [allCardInstallments]);

  const currentMonthInvoiceTotal = React.useMemo(() => {
    const curr = twelveMonthsInvoices.find(m => m.isCurrent);
    return curr ? curr.total : 0;
  }, [twelveMonthsInvoices]);

  const totalTwelveMonthsInvoices = React.useMemo(() => {
    return twelveMonthsInvoices.reduce((sum, m) => sum + m.total, 0);
  }, [twelveMonthsInvoices]);

  // Mês selecionado interativamente no gráfico (padrão: mês atual)
  const [selectedInvoiceMonthKey, setSelectedInvoiceMonthKey] = React.useState<string>(() => {
    const now = new Date();
    return format(now, 'yyyy-MM');
  });

  const selectedInvoiceData = React.useMemo(() => {
    return twelveMonthsInvoices.find(m => m.monthKey === selectedInvoiceMonthKey) 
      || twelveMonthsInvoices.find(m => m.isCurrent) 
      || twelveMonthsInvoices[0];
  }, [twelveMonthsInvoices, selectedInvoiceMonthKey]);

  const [showAllInvoicesAccordion, setShowAllInvoicesAccordion] = React.useState(false);

  // Renderizador do Rótulo de Valor em cada coluna (Bem Visível e sem cortes)
  const renderInvoiceBarLabel = (props: any) => {
    const { x, y, width, value, index } = props;
    if (value === undefined || value === null) return null;

    const item = twelveMonthsInvoices[index];
    if (!item) return null;

    const isZero = Number(value) <= 0;
    const isPrev = item.isPrevious;
    const isCurr = item.isCurrent;

    if (isZero) {
      return (
        <text
          x={x + width / 2}
          y={y - 8}
          fill="#64748b"
          textAnchor="middle"
          fontSize={10}
          fontWeight="600"
          className="select-none font-mono"
        >
          -
        </text>
      );
    }

    const formatted = formatCurrency(value);

    let textColor = '#f1f5f9'; // Branco / slate-100 para alta visibilidade
    if (isPrev) textColor = '#fca5a5'; // Red-300 contrastante
    if (isCurr) textColor = '#7dd3fc'; // Sky-300 vibrante em evidência

    return (
      <g>
        <text
          x={x + width / 2}
          y={y - 10}
          fill={textColor}
          textAnchor="middle"
          fontSize={10.5}
          fontWeight={isCurr ? '800' : '700'}
          className="font-mono select-none"
          style={{
            filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.95))'
          }}
        >
          {formatted}
        </text>
      </g>
    );
  };

  // Renderizador personalizado do Eixo X (identificação clara de Mês Anterior, Atual e Futuros)
  const renderCustomInvoiceTick = (props: any) => {
    const { x, y, payload } = props;
    const item = twelveMonthsInvoices.find(m => m.name === payload.value);
    if (!item) {
      return (
        <text x={x} y={y + 12} fill="#94a3b8" fontSize={10} textAnchor="middle">
          {payload.value}
        </text>
      );
    }

    const isPrev = item.isPrevious;
    const isCurr = item.isCurrent;
    const isSelected = item.monthKey === selectedInvoiceMonthKey;

    return (
      <g 
        transform={`translate(${x},${y})`} 
        className="cursor-pointer"
        onClick={() => setSelectedInvoiceMonthKey(item.monthKey)}
      >
        {isSelected && (
          <rect
            x={-30}
            y={2}
            width={60}
            height={34}
            rx={6}
            fill={isPrev ? 'rgba(239, 68, 68, 0.15)' : isCurr ? 'rgba(56, 189, 248, 0.2)' : 'rgba(99, 102, 241, 0.2)'}
            stroke={isPrev ? '#ef4444' : isCurr ? '#38bdf8' : '#818cf8'}
            strokeWidth={1}
          />
        )}
        <text
          x={0}
          y={16}
          textAnchor="middle"
          fill={isPrev ? '#f87171' : isCurr ? '#38bdf8' : '#cbd5e1'}
          fontSize={11}
          fontWeight={isCurr || isSelected ? '800' : '600'}
          className="font-mono select-none"
        >
          {item.name}
        </text>
        {isPrev && (
          <text x={0} y={28} textAnchor="middle" fill="#ef4444" fontSize={9} fontWeight="bold" className="select-none">
            (Anterior)
          </text>
        )}
        {isCurr && (
          <text x={0} y={28} textAnchor="middle" fill="#38bdf8" fontSize={9} fontWeight="bold" className="select-none">
            (Atual)
          </text>
        )}
      </g>
    );
  };


  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-sm">Casa do Lago 🏠</h2>
          <div className="md:hidden mt-1 mb-2 flex items-center gap-1.5 text-[10px] font-medium px-1">
            {syncStatus === 'syncing' && (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-emerald-400" title="Tudo certo! Os dados estão indo para a nuvem e aparecerão em qualquer dispositivo.">Sincronizado</span>
              </>
            )}
            {syncStatus === 'local' && (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                <span className="text-amber-400" title="As chaves não foram encontradas. Os dados ficam presos no aparelho atual.">Modo Local</span>
              </>
            )}
            {syncStatus === 'error' && (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                <span className="text-red-400" title="As chaves estão lá, mas há algo errado (talvez as tabelas não foram criadas no Supabase).">Erro de Conexão</span>
              </>
            )}
          </div>
          <p className="text-slate-400 font-medium tracking-wide">Visão geral da sua obra</p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/20 ring-1 ring-white/5 shadow-xl p-4 sm:p-6 flex flex-col justify-between h-full hover:shadow-emerald-500/10 hover:border-emerald-500/40 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Banknote size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2 bg-emerald-500/10 rounded-xl ring-1 ring-emerald-500/20">
              <Banknote size={18} className="text-emerald-400" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">Total da Obra</span>
          </div>
          <div className="text-sm sm:text-base font-extrabold tracking-tight text-white relative z-10 drop-shadow-sm" title={formatCurrency(totalSpent)}>
            {formatCurrency(totalSpent)}
          </div>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-xl border border-amber-500/20 ring-1 ring-white/5 shadow-xl p-4 sm:p-6 flex flex-col justify-between h-full hover:shadow-amber-500/10 hover:border-amber-500/40 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Wallet size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2 bg-amber-500/10 rounded-xl ring-1 ring-amber-500/20">
              <Wallet size={18} className="text-amber-400" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">Saldo do Caixa</span>
          </div>
          <div className="text-sm sm:text-base font-extrabold tracking-tight text-white relative z-10 drop-shadow-sm" title={formatCurrency(caixaBalance)}>
            {formatCurrency(caixaBalance)}
          </div>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-xl border border-red-500/20 ring-1 ring-white/5 shadow-xl p-4 sm:p-6 flex flex-col justify-between h-full hover:shadow-red-500/10 hover:border-red-500/40 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Banknote size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2 bg-red-500/10 rounded-xl ring-1 ring-red-500/20">
              <Banknote size={18} className="text-red-400" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">Saldo do Terreno</span>
          </div>
          <div className="text-sm sm:text-base font-extrabold tracking-tight text-white relative z-10 drop-shadow-sm" title={formatCurrency(terrenoBalance)}>
            {formatCurrency(terrenoBalance)}
          </div>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 ring-1 ring-white/5 shadow-xl p-4 sm:p-6 flex flex-col justify-between h-full hover:shadow-purple-500/10 hover:border-purple-500/40 transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Heart size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2 bg-purple-500/10 rounded-xl ring-1 ring-purple-500/20">
              <Heart size={18} className="text-purple-400 fill-purple-400/20" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">Total Doações</span>
          </div>
          <div className="text-sm sm:text-base font-extrabold tracking-tight text-white relative z-10 drop-shadow-sm" title={formatCurrency(totalDonations)}>
            {formatCurrency(totalDonations)}
          </div>
        </Card>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 items-stretch">
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-blue-500/20 ring-1 ring-white/5 shadow-xl p-4 sm:p-8 flex flex-col h-full hover:shadow-blue-500/10 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-3 text-white">
              <div className="p-2 bg-blue-500/10 rounded-xl ring-1 ring-blue-500/20">
                <Wallet size={20} className="text-blue-400" />
              </div>
              A Pagar (Mensal por Pessoa)
            </h3>
            <div className="text-[10px] text-blue-300 font-bold uppercase tracking-wider bg-blue-500/10 px-3 py-1.5 rounded-full ring-1 ring-blue-500/20">
              Jorge, Mccley, Jan, Saulo
            </div>
          </div>
          
          {previousMonthValue !== null && (
            <div className="mb-4 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg inline-block self-start ring-1 ring-red-500/20">
              {previousMonthInfo.name}: {formatCurrency(previousMonthValue)}
            </div>
          )}
          
          <div className="space-y-2 sm:space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar flex-grow">
            {cardInstallments.length > 0 ? (
              cardInstallments.map((item) => {
                const fixedPerPersonThisMonth = calculateFixedPerPersonForMonth(item.month, activeSettings);
                const cardPerPerson = item.total / PEOPLE_COUNT;
                const totalPerPerson = cardPerPerson + fixedPerPersonThisMonth;
                
                return (
                  <div key={item.month} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600 transition-colors">
                    <div className="mb-2 sm:mb-0">
                      <div className="text-sm font-bold text-slate-200 capitalize">
                        {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-tighter mt-1">
                        Cartão: {formatCurrency(cardPerPerson)} + Fixo: {formatCurrency(fixedPerPersonThisMonth)}
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-mono font-bold text-white bg-slate-900/50 px-4 py-2 rounded-xl shadow-inner border border-slate-700/50">
                      {formatCurrency(totalPerPerson)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 italic text-sm bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
                <p className="font-medium">Nenhum gasto fixo ou parcelado identificado.</p>
                <p className="text-xs mt-1 text-slate-500">Lançamentos no cartão aparecerão aqui.</p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-700/50 flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              <span className="text-xs text-emerald-300 font-medium">Terreno: <span className="font-bold text-emerald-200">{formatCurrency(activeTerrenoCost)}</span></span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!isSharedMode) {
                  setIsEditCondoOpen(true);
                }
              }}
              disabled={isSharedMode}
              className={`flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20 transition-all ${
                !isSharedMode 
                  ? "hover:bg-blue-500/20 hover:border-blue-500/50 cursor-pointer active:scale-95 group shadow-sm hover:shadow-blue-500/10" 
                  : "opacity-90 cursor-default"
              }`}
              title={isSharedMode ? "Taxa mensal de condomínio" : "Clique para reajustar o valor do condomínio"}
            >
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)] group-hover:scale-125 transition-transform"></div>
              <span className="text-xs text-blue-300 font-medium flex items-center gap-1.5">
                Condomínio: <span className="font-bold text-blue-200">{formatCurrency(activeCondominioCost)}</span>
                {!isSharedMode && (
                  <Pencil size={11} className="text-blue-400 opacity-70 group-hover:opacity-100 group-hover:text-blue-300 transition-opacity ml-0.5" />
                )}
              </span>
            </button>

            <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
              <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
              <span className="text-xs text-purple-300 font-medium">Total Fixo: <span className="font-bold text-purple-200">{formatCurrency(FIXED_COSTS)}</span></span>
            </div>
          </div>
        </Card>

        <Card className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/20 ring-1 ring-white/5 shadow-xl p-4 sm:p-8 flex flex-col h-full hover:shadow-emerald-500/10 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-6">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-3 text-white">
              <div className="p-2 bg-emerald-500/10 rounded-xl ring-1 ring-emerald-500/20">
                <BarChartIcon size={20} className="text-emerald-400" />
              </div>
              Gastos por Categoria
            </h3>
            <div className="text-[10px] text-slate-400 font-medium italic bg-slate-800/50 px-3 py-1.5 rounded-full ring-1 ring-slate-700/50">
              * Inclui pagamentos (Pix, Cartão, Doações)
            </div>
          </div>
          <div className="h-[400px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryTotals} margin={{ top: 40, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8' }} 
                  interval={0} 
                  angle={-45} 
                  textAnchor="end" 
                  height={60} 
                />
                <YAxis hide />
                <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#f1f5f9' }} formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" shape={<TriangleBar />}>
                  {categoryTotals.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(v: number) => formatCurrency(v)}
                    style={{ fontSize: '9px', fontWeight: 'bold', fill: '#cbd5e1' }}
                    offset={15}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ======================================================== */}
        {/* CARD COM GRÁFICO: FATURAS DE CARTÃO (12 MESES)           */}
        {/* 1ª Coluna: Mês Anterior (Vermelho)                       */}
        {/* 2ª Coluna: Mês Atual (Em Evidência)                      */}
        {/* Demais Colunas: Próximos 10 Meses (Tom Agradável)        */}
        {/* ======================================================== */}
        {((allCardInstallments && allCardInstallments.length > 0) || twelveMonthsInvoices.some(m => m.total > 0)) && (
          <Card className="bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 ring-1 ring-white/5 shadow-xl p-4 sm:p-8 flex flex-col h-full hover:shadow-purple-500/10 transition-all lg:col-span-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 rounded-2xl ring-1 ring-purple-500/20 shadow-inner">
                  <CreditCard size={22} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
                    Faturas de Cartão (Total)
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">
                      12 Meses
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Projeção anual de parcelas com fechamento contábil no dia 28
                  </p>
                </div>
              </div>

              {/* Badges de Resumo Rápido */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Mês Anterior (Vermelho) */}
                <div 
                  onClick={() => {
                    const prev = twelveMonthsInvoices.find(m => m.isPrevious);
                    if (prev) setSelectedInvoiceMonthKey(prev.monthKey);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-xs font-bold shadow-sm cursor-pointer transition-all active:scale-95"
                  title="Clique para visualizar os lançamentos do mês anterior"
                >
                  <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"></span>
                  <span>{previousMonthInfo.name}:</span>
                  <span className="font-mono">{formatCurrency(previousMonthInvoiceTotal || 0)}</span>
                </div>

                {/* Mês Atual (Em Evidência - Azul Celeste Neon) */}
                <div 
                  onClick={() => {
                    const curr = twelveMonthsInvoices.find(m => m.isCurrent);
                    if (curr) setSelectedInvoiceMonthKey(curr.monthKey);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-300 text-xs font-bold shadow-sm shadow-sky-500/10 ring-1 ring-sky-400/30 cursor-pointer transition-all active:scale-95"
                  title="Clique para visualizar os lançamentos do mês atual"
                >
                  <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] animate-pulse"></span>
                  <span>{currentMonthInfo.name} (Atual):</span>
                  <span className="font-mono text-white font-extrabold">{formatCurrency(currentMonthInvoiceTotal || 0)}</span>
                </div>

                {/* Total 12 Meses */}
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-bold shadow-sm">
                  <span>Total Ano:</span>
                  <span className="font-mono font-extrabold text-white">{formatCurrency(totalTwelveMonthsInvoices)}</span>
                </div>

                {/* Botão de Exportar Card em Imagem */}
                <button
                  type="button"
                  onClick={(e) => exportAsImage('card-faturas-12-meses', `Faturas-12-Meses-${currentMonthKey}`, e)}
                  className="export-btn p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all border border-slate-700 shrink-0 cursor-pointer active:scale-95 shadow-sm"
                  title="Exportar gráfico de faturas como imagem PNG"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>

            {/* Aviso de rolagem touch para telas menores (Smartphones) */}
            <div className="md:hidden flex items-center justify-between px-3 py-1.5 mb-3 rounded-xl bg-slate-800/50 border border-slate-700/60 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <ArrowLeftRight size={13} className="text-purple-400 shrink-0" />
                Deslize para ver todos os 12 meses
              </span>
              <span className="text-[10px] text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                Toque na coluna para detalhar
              </span>
            </div>

            {/* Legenda Explicativa das Cores */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400 mb-4 px-1">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]"></span>
                <span className="text-red-300 font-medium">1ª Coluna: Mês Anterior (Fechada)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] border border-white/60"></span>
                <span className="text-sky-300 font-bold">2ª Coluna: Mês Atual (Em Evidência)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-indigo-500/80"></span>
                <span className="text-indigo-200 font-medium">Demais 10 Colunas: Próximos Meses (Projeção)</span>
              </div>
            </div>

            {/* Container do Gráfico com Rolagem Horizontal Otimizada para Celular */}
            <div id="card-faturas-12-meses" className="rounded-2xl p-2 sm:p-4 bg-slate-950/40 border border-slate-800/80 shadow-inner">
              <div className="overflow-x-auto pb-2 custom-scrollbar">
                <div className="min-w-[760px] h-[370px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={twelveMonthsInvoices} 
                      margin={{ top: 38, right: 25, left: 15, bottom: 42 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        interval={0}
                        height={45}
                        content={renderCustomInvoiceTick}
                      />
                      <YAxis hide domain={[0, (dataMax: number) => Math.max(100, Math.ceil(dataMax * 1.30))]} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(51, 65, 85, 0.35)', radius: 6 }}
                        contentStyle={{ 
                          backgroundColor: '#0f172a', 
                          borderColor: '#334155', 
                          borderRadius: '12px', 
                          color: '#f1f5f9',
                          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.6)'
                        }} 
                        formatter={(val: number, _name: string, props: any) => {
                          const p = props?.payload;
                          const statusName = p?.isPrevious 
                            ? 'Fatura Anterior' 
                            : p?.isCurrent 
                            ? 'Fatura Atual (Em Aberto)' 
                            : 'Fatura Projetada';
                          return [
                            `${formatCurrency(val)} (${p?.items?.length || 0} compras/parcelas)`,
                            statusName
                          ];
                        }}
                        labelFormatter={(_label, payload) => {
                          return payload?.[0]?.payload?.fullName || '';
                        }}
                      />
                      <Bar 
                        dataKey="total" 
                        radius={[6, 6, 0, 0]}
                        onClick={(data: any) => {
                          if (data && data.monthKey) {
                            setSelectedInvoiceMonthKey(data.monthKey);
                          }
                        }}
                        className="cursor-pointer"
                      >
                        {twelveMonthsInvoices.map((entry, index) => {
                          let fillColor = '#818cf8'; // tom agradável para meses futuros
                          let strokeColor = '#6366f1';
                          let opacity = 0.85;

                          if (entry.isPrevious) {
                            fillColor = '#ef4444'; // 1ª coluna em vermelho
                            strokeColor = '#b91c1c';
                            opacity = 1;
                          } else if (entry.isCurrent) {
                            fillColor = '#0284c7'; // 2ª coluna em evidência (Azul Celeste Neon)
                            strokeColor = '#38bdf8';
                            opacity = 1;
                          }

                          const isSelected = entry.monthKey === selectedInvoiceMonthKey;

                          return (
                            <Cell 
                              key={`cell-invoice-${index}`} 
                              fill={fillColor}
                              stroke={isSelected ? '#ffffff' : strokeColor}
                              strokeWidth={isSelected ? 2.5 : (entry.isCurrent ? 2 : 1)}
                              fillOpacity={opacity}
                              style={{
                                filter: entry.isCurrent 
                                  ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.55))' 
                                  : entry.isPrevious 
                                  ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.45))' 
                                  : undefined
                              }}
                            />
                          );
                        })}
                        <LabelList 
                          dataKey="total" 
                          content={renderInvoiceBarLabel}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Detalhamento Interativo do Mês Selecionado */}
            {selectedInvoiceData && (
              <div className="mt-6 bg-slate-800/40 rounded-2xl border border-slate-700/60 overflow-hidden" id={`invoice-${selectedInvoiceData.monthKey}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 via-slate-800/50 to-transparent border-b border-slate-700/60 gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ring-1 ${
                      selectedInvoiceData.isPrevious 
                        ? 'bg-red-500/15 text-red-400 ring-red-500/30' 
                        : selectedInvoiceData.isCurrent 
                        ? 'bg-sky-500/15 text-sky-400 ring-sky-500/30' 
                        : 'bg-indigo-500/15 text-indigo-400 ring-indigo-500/30'
                    }`}>
                      <Calendar size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-white capitalize">
                          {selectedInvoiceData.fullName}
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          selectedInvoiceData.isPrevious 
                            ? 'bg-red-500/10 text-red-400 border-red-500/30' 
                            : selectedInvoiceData.isCurrent 
                            ? 'bg-sky-500/10 text-sky-300 border-sky-500/30 font-extrabold ring-1 ring-sky-400/20' 
                            : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                        }`}>
                          {selectedInvoiceData.isPrevious 
                            ? 'Mês Anterior (Fechada)' 
                            : selectedInvoiceData.isCurrent 
                            ? 'Mês Atual (Em Aberto)' 
                            : 'Projeção Futura'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {selectedInvoiceData.items.length} lançamento(s) faturados nesta data
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-auto">
                    <div className="text-lg sm:text-xl font-mono font-bold text-white bg-slate-900/80 px-4 py-2 rounded-xl shadow-inner border border-slate-700/60">
                      {formatCurrency(selectedInvoiceData.total)}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => exportAsImage(`invoice-${selectedInvoiceData.monthKey}`, `Fatura-${selectedInvoiceData.monthKey}`, e)}
                      className="export-btn p-2.5 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 hover:text-white rounded-xl transition-all border border-purple-500/30 flex items-center justify-center shrink-0 cursor-pointer active:scale-95 shadow-sm"
                      title="Exportar detalhamento como imagem PNG"
                    >
                      <Download size={17} />
                    </button>
                  </div>
                </div>

                {/* Tabela de Lançamentos do Mês Selecionado */}
                {selectedInvoiceData.items && selectedInvoiceData.items.length > 0 ? (
                  <div className="p-3 sm:p-4 bg-slate-900/40 breakdown-section">
                    <div className="overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                          <tr className="bg-slate-800/60 border-b border-slate-700">
                            <th className="px-3 sm:px-4 py-2 text-[10px] font-bold uppercase text-slate-400">ID</th>
                            <th className="px-3 sm:px-4 py-2 text-[10px] font-bold uppercase text-slate-400">Data</th>
                            <th className="px-3 sm:px-4 py-2 text-[10px] font-bold uppercase text-slate-400">Local</th>
                            <th className="px-3 sm:px-4 py-2 text-[10px] font-bold uppercase text-slate-400 text-center">Parcela</th>
                            <th className="px-3 sm:px-4 py-2 text-[10px] font-bold uppercase text-slate-400 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {selectedInvoiceData.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((detail, idx) => {
                            const auditId = formatAuditId('EXP', detail.id);
                            return (
                              <tr key={`${detail.id}-${idx}`} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-3 sm:px-4 py-2 text-xs whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={(e) => copyAuditIdToClipboard(auditId, e)}
                                    title="Clique para copiar ID de auditoria"
                                    className="font-mono text-[9px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center cursor-pointer"
                                  >
                                    {auditId}
                                  </button>
                                </td>
                                <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-slate-300 whitespace-nowrap">
                                  {detail.date ? detail.date.split('-').reverse().join('/') : '-'}
                                </td>
                                <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-200">
                                  {detail.local}
                                  {detail.originalExp?.observation && (
                                    <div className="text-[10px] text-slate-500 font-normal italic mt-0.5 truncate max-w-[200px]" title={detail.originalExp.observation}>
                                      {detail.originalExp.observation}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-center text-slate-400">
                                  {detail.installment}
                                </td>
                                <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-mono font-bold text-slate-200 text-right whitespace-nowrap">
                                  {formatCurrency(detail.value)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-900/30">
                    <p className="text-sm font-medium text-slate-400">
                      Nenhuma compra ou parcela no cartão registrada para {selectedInvoiceData.fullName}.
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Toque em outra coluna do gráfico para ver seu detalhamento.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Alternância para Ver Todas as Faturas em Formato Acordeão */}
            <div className="mt-5 pt-4 border-t border-slate-700/50 flex flex-col items-center">
              <button
                type="button"
                onClick={() => setShowAllInvoicesAccordion(prev => !prev)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                {showAllInvoicesAccordion ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span>{showAllInvoicesAccordion ? 'Ocultar lista de todas as faturas' : 'Ver lista completa de todas as faturas'}</span>
              </button>

              {showAllInvoicesAccordion && (
                <div className="w-full mt-4 space-y-3 animate-in fade-in duration-300">
                  {allCardInstallments.map((item) => {
                    const isExpanded = expandedInvoice === item.month;
                    return (
                      <div key={`acc-${item.month}`} id={`accordion-invoice-${item.month}`} className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden">
                        <div 
                          onClick={() => toggleInvoice(item.month)}
                          className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-gradient-to-r from-purple-500/10 to-transparent cursor-pointer"
                          role="button"
                          tabIndex={0}
                        >
                          <div className="flex items-center gap-2">
                            <div className="text-purple-400">
                              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                            <span className="text-sm font-bold text-slate-200 capitalize">
                              {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-2 sm:mt-0">
                            <span className="font-mono font-bold text-white text-base">
                              {formatCurrency(item.total)}
                            </span>
                            {isExpanded && (
                              <button
                                type="button"
                                onClick={(e) => exportAsImage(`accordion-invoice-${item.month}`, `Fatura-${item.month}`, e)}
                                className="p-1.5 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded-lg cursor-pointer"
                                title="Exportar fatura como imagem"
                              >
                                <Download size={15} />
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && item.items && item.items.length > 0 && (
                          <div className="border-t border-slate-700/50 bg-slate-900/40 p-3">
                            <div className="overflow-x-auto custom-scrollbar">
                              <table className="w-full text-left border-collapse min-w-[480px]">
                                <thead>
                                  <tr className="bg-slate-800/60 border-b border-slate-700 text-[9px] uppercase font-bold text-slate-400">
                                    <th className="px-3 py-2">ID</th>
                                    <th className="px-3 py-2">Data</th>
                                    <th className="px-3 py-2">Local</th>
                                    <th className="px-3 py-2 text-center">Parcela</th>
                                    <th className="px-3 py-2 text-right">Valor</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700/50 text-xs">
                                  {item.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((detail, idx) => {
                                    const auditId = formatAuditId('EXP', detail.id);
                                    return (
                                      <tr key={`acc-item-${detail.id}-${idx}`} className="hover:bg-slate-800/40">
                                        <td className="px-3 py-1.5">
                                          <button
                                            type="button"
                                            onClick={(e) => copyAuditIdToClipboard(auditId, e)}
                                            className="font-mono text-[9px] text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded cursor-pointer"
                                          >
                                            {auditId}
                                          </button>
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-300">
                                          {detail.date ? detail.date.split('-').reverse().join('/') : '-'}
                                        </td>
                                        <td className="px-3 py-1.5 text-slate-200">
                                          {detail.local}
                                        </td>
                                        <td className="px-3 py-1.5 text-center text-slate-400">
                                          {detail.installment}
                                        </td>
                                        <td className="px-3 py-1.5 text-right font-mono font-bold text-slate-200">
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ======================================================== */}
        {/* CARD COM GRÁFICO: DOAÇÕES POR PESSOA                     */}
        {/* ======================================================== */}
        <Card className="bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 ring-1 ring-white/5 shadow-xl p-4 sm:p-8 flex flex-col hover:shadow-purple-500/10 transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-6">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-3 text-white">
              <div className="p-2 bg-purple-500/10 rounded-xl ring-1 ring-purple-500/20">
                <Heart size={20} className="text-purple-400 fill-purple-400/20" />
              </div>
              Doações por Pessoa
            </h3>
            <div className="text-xs font-mono font-bold text-purple-300 bg-purple-500/10 px-3 py-1.5 rounded-full ring-1 ring-purple-500/20 self-start sm:self-auto">
              Total Doado: {formatCurrency(totalCalculatedDonations)}
            </div>
          </div>

          {donationsByPerson.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center flex-grow">
              {/* Gráfico Donut de Doações */}
              <div className="h-[280px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donationsByPerson}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={100}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {donationsByPerson.map((entry, index) => (
                        <Cell 
                          key={`cell-donor-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                          stroke="#0f172a"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ 
                        backgroundColor: '#0f172a', 
                        borderColor: '#334155', 
                        borderRadius: '12px', 
                        color: '#f1f5f9',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
                      }}
                      formatter={(val: number, name: string, item: any) => [
                        `${formatCurrency(val)} (${item?.payload?.percentage?.toFixed(1) ?? 0}%)`,
                        name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Lista dos Valores Doados e Percentuais por Pessoa */}
              <div className="space-y-3">
                {donationsByPerson.map((d, index) => {
                  const color = COLORS[index % COLORS.length];
                  return (
                    <div 
                      key={d.name}
                      className="p-3.5 rounded-2xl bg-slate-950/50 border border-slate-800/80 hover:bg-slate-800/40 hover:border-slate-700 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span 
                            className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" 
                            style={{ backgroundColor: color }} 
                          />
                          <span className="text-sm font-bold text-white truncate">
                            {d.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm sm:text-base font-mono font-bold text-slate-100">
                            {formatCurrency(d.value)}
                          </span>
                          <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-full min-w-[55px] text-center">
                            {d.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Barra de progresso visual */}
                      <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, d.percentage))}%`,
                            backgroundColor: color
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 italic text-sm bg-slate-800/30 rounded-2xl border border-dashed border-slate-700">
              <Heart size={28} className="text-slate-600 mb-2" />
              <p className="font-medium">Nenhuma doação registrada até o momento.</p>
              <p className="text-xs mt-1 text-slate-500">Lançamentos de doação aparecerão aqui.</p>
            </div>
          )}
        </Card>

        {/* ======================================================== */}
        {/* PAINEL DE GESTÃO DE VALORES A RESTITUIR AOS SÓCIOS       */}
        {/* ======================================================== */}
        <Card id="painel-gestao-reembolsos" className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 shadow-2xl rounded-2xl p-4 sm:p-6 ring-1 ring-white/5 space-y-6">
          {/* Cabeçalho do Painel */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                <RotateCcw size={22} className="animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Gestão de Valores a Restituir aos Sócios
                  </h3>
                  {pendingReimbursements.length > 0 ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                      {pendingReimbursements.length} {pendingReimbursements.length === 1 ? 'pendência' : 'pendências'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <ShieldCheck size={12} />
                      Tudo Quitado
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Controle centralizado de despesas custeadas pelos sócios e baixa de ressarcimentos pendentes pelo caixa da obra.
                </p>
              </div>
            </div>

            {/* Indicadores Principais */}
            <div className="flex items-center gap-3">
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2 text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Total em Aberto</span>
                <span className="text-xl sm:text-2xl font-mono font-bold text-amber-300">
                  {formatCurrency(totalPendingRefunds)}
                </span>
              </div>
              {settledReimbursements.length > 0 && (
                <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl px-3 py-2 text-right hidden sm:block">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Já Devolvido</span>
                  <span className="text-sm sm:text-base font-mono font-bold text-emerald-400">
                    {formatCurrency(totalSettledRefunds)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Cards de Saldo Individual por Sócio */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {partnerBalances.map(({ partner, count, total }) => {
              const isSelected = refundPartnerFilter === partner;
              const hasPending = total > 0;

              return (
                <button
                  key={partner}
                  type="button"
                  onClick={() => setRefundPartnerFilter(prev => prev === partner ? 'todos' : partner)}
                  className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/50 ring-2 ring-amber-500/20 shadow-lg'
                      : hasPending
                        ? 'bg-slate-950/50 border-slate-800 hover:border-amber-500/30 hover:bg-slate-800/40'
                        : 'bg-slate-950/30 border-slate-800/60 hover:bg-slate-800/30 opacity-75'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${hasPending ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      {partner}
                    </span>
                    {count > 0 && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-bold">
                        {count} pend.
                      </span>
                    )}
                  </div>
                  <div className={`text-sm sm:text-base font-mono font-bold ${hasPending ? 'text-amber-300' : 'text-slate-500'}`}>
                    {formatCurrency(total)}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {hasPending ? 'A restituir' : 'Sem pendências'}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Barra de Filtros e Busca de Devoluções */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Filtro de Status */}
            <div className="flex items-center bg-slate-950/70 p-1 rounded-xl border border-slate-800/80 w-fit">
              <button
                type="button"
                onClick={() => setRefundStatusFilter('pendente')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  refundStatusFilter === 'pendente'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock size={13} />
                <span>Em Aberto ({pendingReimbursements.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRefundStatusFilter('devolvido')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  refundStatusFilter === 'devolvido'
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <CheckCircle2 size={13} />
                <span>Já Devolvidos ({settledReimbursements.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setRefundStatusFilter('todos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  refundStatusFilter === 'todos'
                    ? 'bg-slate-700 text-white shadow-md font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todos ({allReimbursements.length})
              </button>
            </div>

            {/* Filtro de sócio ativo indicador */}
            {refundPartnerFilter !== 'todos' && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filtrando por sócio:</span>
                <span className="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1">
                  {refundPartnerFilter}
                  <button
                    type="button"
                    onClick={() => setRefundPartnerFilter('todos')}
                    className="hover:text-white ml-1 text-slate-400 cursor-pointer"
                    title="Remover filtro"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
          </div>

          {/* Listagem dos Lançamentos */}
          <div className="space-y-2.5">
            {filteredReimbursements.length === 0 ? (
              <div className="py-10 px-4 rounded-xl border border-dashed border-slate-800 text-center bg-slate-950/30">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center mb-3">
                  <ShieldCheck size={24} />
                </div>
                <h4 className="text-sm font-bold text-slate-300">
                  {refundStatusFilter === 'pendente' 
                    ? 'Nenhum valor em aberto para restituição!' 
                    : 'Nenhum registro encontrado com estes filtros.'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  {refundStatusFilter === 'pendente'
                    ? 'Todas as despesas custeadas pelos sócios foram devidamente ressarcidas pelo caixa da obra.'
                    : 'Alterne os filtros de status ou de sócio acima para consultar outros registros.'}
                </p>
              </div>
            ) : (
              filteredReimbursements.map((item) => {
                const auditId = formatAuditId('EXP', item.id);
                const partnerName = item.reimburseTo || (item.donor as Person) || 'Sócio';
                const isPending = item.refundStatus === 'Pendente' || (!item.refundStatus && item.status !== 'DEVOLVIDO');
                const isProcessing = processingRefundId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 ${
                      isPending
                        ? 'bg-slate-950/60 border-amber-500/30 hover:border-amber-500/50 hover:bg-slate-900/50 ring-1 ring-amber-500/10 shadow-md'
                        : 'bg-slate-950/30 border-slate-800/80 hover:bg-slate-900/30 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5">
                        <button
                          type="button"
                          onClick={(e) => copyAuditIdToClipboard(auditId, e)}
                          title="Clique para copiar código de auditoria"
                          className="font-mono text-[9px] sm:text-[10px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center shrink-0 cursor-pointer"
                        >
                          {auditId}
                        </button>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white tracking-wide">
                            {item.local}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                            {item.category}
                          </span>
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                            Sócio: {partnerName}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                          <span>{item.date ? item.date.split('-').reverse().join('/') : '-'}</span>
                          <span className="text-slate-600">•</span>
                          <span>Origem: {item.paymentMethod} {item.installments ? `(${item.installments}x)` : ''}</span>
                          {item.observation && (
                            <>
                              <span className="text-slate-600">•</span>
                              <span className="text-slate-400 italic truncate max-w-[200px]" title={item.observation}>
                                {item.observation}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3.5 self-stretch md:self-center shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800/80">
                      <div className="text-left md:text-right">
                        <span className="text-base sm:text-lg font-mono font-bold text-white block">
                          {formatCurrency(item.value)}
                        </span>
                        <span className={`text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                          isPending ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {isPending ? (
                            <>
                              <Clock size={10} />
                              A Devolver
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={10} />
                              Devolvido
                            </>
                          )}
                        </span>
                      </div>

                      {/* BOTÃO DE ACUSAR DEVOLUÇÃO */}
                      <div>
                        {isPending ? (
                          <button
                            type="button"
                            disabled={isProcessing || isSharedMode}
                            onClick={() => handleAcknowledgeRefund(item.id)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
                            title="Confirmar que o caixa da obra efetuou a devolução deste valor ao sócio"
                          >
                            {isProcessing ? (
                              <RefreshCw size={13} className="animate-spin text-slate-950" />
                            ) : (
                              <CheckCircle2 size={14} className="stroke-[2.5]" />
                            )}
                            <span>Acusar Devolução</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isProcessing || isSharedMode}
                            onClick={() => handleAcknowledgeRefund(item.id)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-amber-300 hover:bg-slate-800/80 border border-slate-700/60 transition-all flex items-center gap-1 cursor-pointer"
                            title="Reabrir como pendente se necessário"
                          >
                            <RotateCcw size={11} />
                            <span>Reabrir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Modal de Reajuste do Condomínio */}
      <EditCondominioModal
        isOpen={isEditCondoOpen}
        onClose={() => setIsEditCondoOpen(false)}
        currentValue={activeCondominioCost}
        terrenoValue={activeTerrenoCost}
        peopleCount={PEOPLE_COUNT}
        history={activeSettings.history}
        onSave={async (newValue, effectiveFrom) => {
          if (onUpdateCondominio) {
            await onUpdateCondominio(newValue, effectiveFrom);
          } else {
            const updated = await applyCondominioAdjustment(newValue, effectiveFrom);
            setLocalSettings(updated);
            toast.success(`Condomínio reajustado para ${formatCurrency(newValue)} a partir de ${effectiveFrom}! Totais recalculados.`);
          }
        }}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
