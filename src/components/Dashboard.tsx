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
import { Banknote, TrendingUp, CreditCard, BarChart as BarChartIcon, User, RefreshCw, Wallet, ChevronDown, ChevronUp, Download, RotateCcw, CheckCircle2, Clock, ShieldCheck, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from './ui/Card';
import { toPng } from 'html-to-image';
import { formatAuditId, copyAuditIdToClipboard } from '../utils/audit';
import { Expense, Person } from '../types';

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
  isSharedMode = false
}: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [expandedInvoice, setExpandedInvoice] = React.useState<string | null>(null);

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

  const FIXED_COSTS = 750;
  const PEOPLE_COUNT = 4;
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
    
    if (prevMonthData) {
      const cardPerPerson = prevMonthData.total / PEOPLE_COUNT;
      return cardPerPerson + FIXED_PER_PERSON;
    }
    return FIXED_PER_PERSON;
  }, [allCardInstallments, previousMonthInfo]);

  const previousMonthInvoiceTotal = React.useMemo(() => {
    if (!allCardInstallments) return null;
    const prevMonthKey = format(previousMonthInfo.date, 'yyyy-MM');
    const prevMonthData = allCardInstallments.find(item => item.month === prevMonthKey);
    
    if (prevMonthData) {
      return prevMonthData.total;
    }
    return 0;
  }, [allCardInstallments, previousMonthInfo]);

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
             <User size={80} />
          </div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-2 bg-purple-500/10 rounded-xl ring-1 ring-purple-500/20">
              <User size={18} className="text-purple-400" />
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
                const cardPerPerson = item.total / PEOPLE_COUNT;
                const totalPerPerson = cardPerPerson + FIXED_PER_PERSON;
                
                return (
                  <div key={item.month} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600 transition-colors">
                    <div className="mb-2 sm:mb-0">
                      <div className="text-sm font-bold text-slate-200 capitalize">
                        {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-tighter mt-1">
                        Cartão: {formatCurrency(cardPerPerson)} + Fixo: {formatCurrency(FIXED_PER_PERSON)}
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
              <span className="text-xs text-emerald-300 font-medium">Terreno: <span className="font-bold text-emerald-200">R$ 700,00</span></span>
            </div>
            <div className="flex items-center gap-2 bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/20">
              <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
              <span className="text-xs text-blue-300 font-medium">Condomínio: <span className="font-bold text-blue-200">R$ 50,00</span></span>
            </div>
            <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
              <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></div>
              <span className="text-xs text-purple-300 font-medium">Total Fixo: <span className="font-bold text-purple-200">R$ 750,00</span></span>
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

        {allCardInstallments && allCardInstallments.length > 0 && (
          <Card className="bg-slate-900/60 backdrop-blur-xl border border-purple-500/20 ring-1 ring-white/5 shadow-xl p-4 sm:p-8 flex flex-col h-full hover:shadow-purple-500/10 transition-all lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-3 text-white">
                <div className="p-2 bg-purple-500/10 rounded-xl ring-1 ring-purple-500/20">
                  <CreditCard size={20} className="text-purple-400" />
                </div>
                Faturas de Cartão (Total)
              </h3>
            </div>
            
            {previousMonthInvoiceTotal !== null && (
              <div className="mb-4 text-xs font-bold text-red-400 bg-red-500/10 px-3 py-1.5 rounded-lg inline-block self-start ring-1 ring-red-500/20">
                {previousMonthInfo.name}: {formatCurrency(previousMonthInvoiceTotal)}
              </div>
            )}
            
            <div className="space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar flex-grow">
              {allCardInstallments.map((item) => {
                const isExpanded = expandedInvoice === item.month;
                
                return (
                  <div key={item.month} id={`invoice-${item.month}`} className="bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600 transition-colors overflow-hidden relative">
                    <div 
                      onClick={() => toggleInvoice(item.month)}
                      className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-purple-500/10 to-transparent transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-center gap-2 mb-2 sm:mb-0">
                        <div className="chevron-icon">
                          {isExpanded ? <ChevronUp size={20} className="text-purple-400" /> : <ChevronDown size={20} className="text-purple-400" />}
                        </div>
                        <div className="text-sm font-bold text-slate-200 capitalize">
                          {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-lg sm:text-xl font-mono font-bold text-white bg-slate-900/50 px-4 py-2 rounded-xl shadow-inner border border-slate-700/50 flex-shrink-0 text-left sm:text-right w-full sm:w-auto">
                          {formatCurrency(item.total)}
                        </div>
                        {isExpanded && (
                          <button
                            onClick={(e) => exportAsImage(`invoice-${item.month}`, `Fatura-${item.month}`, e)}
                            className="export-btn p-2.5 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 hover:text-white rounded-lg transition-colors flex items-center justify-center shrink-0 ring-1 ring-purple-500/30"
                            title="Exportar como Imagem"
                          >
                            <Download size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && item.items && item.items.length > 0 && (
                      <div className="border-t border-slate-700/50 bg-slate-900/40 p-3 sm:p-4 breakdown-section">
                        <div className="overflow-x-auto custom-scrollbar pb-2">
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
                              {item.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((detail, idx) => {
                                const auditId = formatAuditId('EXP', detail.id);
                                return (
                                  <tr key={`${detail.id}-${idx}`} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-3 sm:px-4 py-2 text-xs whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={(e) => copyAuditIdToClipboard(auditId, e)}
                                        title="Clique para copiar ID de auditoria"
                                        className="font-mono text-[9px] text-blue-400 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/20 px-1.5 py-0.5 rounded transition-all active:scale-95 inline-flex items-center"
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
                    )}
                    {isExpanded && (!item.items || item.items.length === 0) && (
                       <div className="border-t border-slate-700/50 bg-slate-900/40 p-4 text-center text-sm text-slate-500">
                         Detalhamento não disponível.
                       </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

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
    </div>
  );
}
