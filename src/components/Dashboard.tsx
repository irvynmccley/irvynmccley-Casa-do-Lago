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
import { Banknote, TrendingUp, CreditCard, BarChart as BarChartIcon, User, RefreshCw, Wallet, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from './ui/Card';
import { toPng } from 'html-to-image';
import { formatAuditId, copyAuditIdToClipboard } from '../utils/audit';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

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

export function Dashboard({ totalSpent, totalDonations, categoryTotals, cardInstallments, allCardInstallments, caixaBalance, terrenoBalance, formatCurrency, onRefresh, syncStatus }: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [expandedInvoice, setExpandedInvoice] = React.useState<string | null>(null);

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
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50 ring-1 ring-white/5 shadow-lg"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin text-blue-400" : "text-slate-400"} />
          {isRefreshing ? "Atualizando..." : "Atualizar"}
        </button>
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
      </div>
    </div>
  );
}
