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
        backgroundColor: '#ffffff',
        style: {
          padding: '24px',
          borderRadius: '16px',
        },
        filter: (node) => {
          // Filter out the chevron icon and export button from the generated image
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

  // Fixed costs calculation
  const FIXED_COSTS = 750; // 700 (terreno) + 50 (condominio)
  const PEOPLE_COUNT = 4; // Jorge, Mccley, Jan, Saulo
  const FIXED_PER_PERSON = FIXED_COSTS / PEOPLE_COUNT;

  // Calculate previous month value
  const previousMonthInfo = React.useMemo(() => {
    const now = new Date();
    // Get previous month key (e.g., "2026-03" if now is April 2026)
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthName = format(prevMonthDate, 'MMMM', { locale: ptBR });
    
    return {
      date: prevMonthDate,
      name: prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1) // Capitalize
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
    return 0; // fallback to 0
  }, [allCardInstallments, previousMonthInfo]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Casa do Lago 🏠</h2>
          <div className="md:hidden mt-1 mb-2 flex items-center gap-1.5 text-[10px] font-medium px-1">
            {syncStatus === 'syncing' && (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <span className="text-emerald-700" title="Tudo certo! Os dados estão indo para a nuvem e aparecerão em qualquer dispositivo.">Sincronizado</span>
              </>
            )}
            {syncStatus === 'local' && (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-amber-700" title="As chaves não foram encontradas. Os dados ficam presos no aparelho atual.">Modo Local</span>
              </>
            )}
            {syncStatus === 'error' && (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-red-700" title="As chaves estão lá, mas há algo errado (talvez as tabelas não foram criadas no Supabase).">Erro de Conexão</span>
              </>
            )}
          </div>
          <p className="text-black">Visão geral da sua obra</p>
        </div>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 bg-white border border-black/5 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? "Atualizando..." : "Atualizar"}
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
        <Card className="bg-gradient-to-br from-white to-emerald-50/30 border border-emerald-100/50 shadow-sm p-4 sm:p-6 flex flex-col justify-between h-full hover:shadow-md transition-all">
          <div className="flex items-center gap-3 text-black mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Banknote size={18} className="text-emerald-600" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Total da Obra</span>
          </div>
          <div className="text-sm sm:text-base font-bold tracking-tight text-black" title={formatCurrency(totalSpent)}>
            {formatCurrency(totalSpent)}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-white to-amber-50/30 border border-amber-100/50 shadow-sm p-4 sm:p-6 flex flex-col justify-between h-full hover:shadow-md transition-all">
          <div className="flex items-center gap-3 text-black mb-4">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Wallet size={18} className="text-amber-600" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Saldo do Caixa</span>
          </div>
          <div className="text-sm sm:text-base font-bold tracking-tight text-black" title={formatCurrency(caixaBalance)}>
            {formatCurrency(caixaBalance)}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-white to-red-50/30 border border-red-100/50 shadow-sm p-4 sm:p-6 flex flex-col justify-between h-full hover:shadow-md transition-all">
          <div className="flex items-center gap-3 text-black mb-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <Banknote size={18} className="text-red-600" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Saldo do Terreno</span>
          </div>
          <div className="text-sm sm:text-base font-bold tracking-tight text-black" title={formatCurrency(terrenoBalance)}>
            {formatCurrency(terrenoBalance)}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-white to-orange-50/30 border border-orange-100/50 shadow-sm p-4 sm:p-6 flex flex-col h-full hover:shadow-md transition-all">
          <div className="flex items-center gap-3 text-black mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <CreditCard size={18} className="text-orange-600" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Fatura do Cartão</span>
          </div>
          
          {previousMonthInvoiceTotal !== null && (
            <div className="mb-4 text-[10px] font-medium text-red-600 bg-red-50 px-2 py-1 rounded-md inline-block self-start">
              {previousMonthInfo.name}: {formatCurrency(previousMonthInvoiceTotal)}
            </div>
          )}
          
          <div className="space-y-2 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar mt-auto">
            {cardInstallments.map((item) => (
              <div key={item.month} className="flex justify-between items-center py-1.5 border-b border-orange-100/50 last:border-0">
                <span className="text-xs font-semibold text-black">
                  {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMM yy', { locale: ptBR })}
                </span>
                <span className="text-xs font-mono font-bold text-black">{formatCurrency(item.total)}</span>
              </div>
            ))}
            {cardInstallments.length === 0 && <p className="text-xs text-black italic">Nenhum lançamento</p>}
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-white to-purple-50/30 border border-purple-100/50 shadow-sm p-4 sm:p-6 flex flex-col justify-between h-full hover:shadow-md transition-all">
          <div className="flex items-center gap-3 text-black mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User size={18} className="text-purple-600" />
            </div>
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">Total Doações</span>
          </div>
          <div className="text-sm sm:text-base font-bold tracking-tight text-black" title={formatCurrency(totalDonations)}>
            {formatCurrency(totalDonations)}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 items-stretch">
        <Card className="bg-white border border-blue-100/50 shadow-sm p-4 sm:p-8 flex flex-col h-full hover:shadow-md transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-3 text-black">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Wallet size={20} className="text-blue-600" />
              </div>
              A Pagar (Mensal por Pessoa)
            </h3>
            <div className="text-[10px] text-black font-bold uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-full">
              Jorge, Mccley, Jan, Saulo
            </div>
          </div>
          
          {previousMonthValue !== null && (
            <div className="mb-4 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg inline-block self-start">
              {previousMonthInfo.name}: {formatCurrency(previousMonthValue)}
            </div>
          )}
          
          <div className="space-y-2 sm:space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar flex-grow">
            {cardInstallments.length > 0 ? (
              cardInstallments.map((item) => {
                const cardPerPerson = item.total / PEOPLE_COUNT;
                const totalPerPerson = cardPerPerson + FIXED_PER_PERSON;
                
                return (
                  <div key={item.month} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-blue-50/50 to-transparent rounded-2xl border border-blue-100/50 hover:border-blue-200 transition-colors">
                    <div className="mb-2 sm:mb-0">
                      <div className="text-sm font-bold text-black capitalize">
                        {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-[10px] text-black font-semibold uppercase tracking-tighter mt-1">
                        Cartão: {formatCurrency(cardPerPerson)} + Fixo: {formatCurrency(FIXED_PER_PERSON)}
                      </div>
                    </div>
                    <div className="text-lg sm:text-xl font-mono font-bold text-black bg-white px-4 py-2 rounded-xl shadow-sm border border-blue-50">
                      {formatCurrency(totalPerPerson)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-blue-800/60 italic text-sm bg-blue-50/30 rounded-2xl border border-dashed border-blue-200">
                <p className="font-medium">Nenhum gasto fixo ou parcelado identificado.</p>
                <p className="text-xs mt-1">Lançamentos no cartão aparecerão aqui.</p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-blue-100/50 flex flex-wrap gap-x-8 gap-y-3">
            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100/50">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-xs text-emerald-900 font-medium">Terreno: <span className="font-bold">R$ 700,00</span></span>
            </div>
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100/50">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs text-blue-900 font-medium">Condomínio: <span className="font-bold">R$ 50,00</span></span>
            </div>
            <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-100/50">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-xs text-purple-900 font-medium">Total Fixo: <span className="font-bold">R$ 750,00</span></span>
            </div>
          </div>
        </Card>

        <Card className="bg-white border border-emerald-100/50 shadow-sm p-4 sm:p-8 flex flex-col h-full hover:shadow-md transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-6">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-3 text-black">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <BarChartIcon size={20} className="text-emerald-600" />
              </div>
              Gastos por Categoria
            </h3>
            <div className="text-xs text-black font-medium italic bg-emerald-50 px-3 py-1 rounded-full">
              * Inclui todos os pagamentos (Pix, Cartão e Doações)
            </div>
          </div>
          <div className="h-[400px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryTotals} margin={{ top: 40, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10 }} 
                  interval={0} 
                  angle={-45} 
                  textAnchor="end" 
                  height={60} 
                />
                <YAxis hide />
                <Tooltip cursor={{ fill: '#f9fafb' }} formatter={(value: number) => formatCurrency(value)} />
                <Bar dataKey="value" shape={<TriangleBar />}>
                  {categoryTotals.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList 
                    dataKey="value" 
                    position="top" 
                    formatter={(v: number) => formatCurrency(v)}
                    style={{ fontSize: '9px', fontWeight: 'bold', fill: '#374151' }}
                    offset={15}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {allCardInstallments && allCardInstallments.length > 0 && (
          <Card className="bg-white border border-purple-100/50 shadow-sm p-4 sm:p-8 flex flex-col h-full hover:shadow-md transition-all lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 mb-2">
              <h3 className="text-base sm:text-lg font-bold flex items-center gap-3 text-black">
                <div className="p-2 bg-purple-50 rounded-lg">
                  <CreditCard size={20} className="text-purple-600" />
                </div>
                Faturas de Cartão (Total)
              </h3>
            </div>
            
            {previousMonthInvoiceTotal !== null && (
              <div className="mb-4 text-xs font-medium text-red-600 bg-red-50 px-3 py-1.5 rounded-lg inline-block self-start">
                {previousMonthInfo.name}: {formatCurrency(previousMonthInvoiceTotal)}
              </div>
            )}
            
            <div className="space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar flex-grow">
              {allCardInstallments.map((item) => {
                const isExpanded = expandedInvoice === item.month;
                
                return (
                  <div key={item.month} id={`invoice-${item.month}`} className="bg-gray-50 rounded-xl border border-purple-100/50 hover:border-purple-200 transition-colors overflow-hidden relative">
                    <div 
                      onClick={() => toggleInvoice(item.month)}
                      className="w-full flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-purple-50/50 to-transparent transition-colors cursor-pointer"
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex items-center gap-2 mb-2 sm:mb-0">
                        <div className="chevron-icon">
                          {isExpanded ? <ChevronUp size={20} className="text-purple-500" /> : <ChevronDown size={20} className="text-purple-500" />}
                        </div>
                        <div className="text-sm font-bold text-black capitalize">
                          {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-lg sm:text-xl font-mono font-bold text-black bg-white px-4 py-2 rounded-xl shadow-sm border border-purple-50 flex-shrink-0 text-left sm:text-right w-full sm:w-auto">
                          {formatCurrency(item.total)}
                        </div>
                        {isExpanded && (
                          <button
                            onClick={(e) => exportAsImage(`invoice-${item.month}`, `Fatura-${item.month}`, e)}
                            className="export-btn p-2.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg transition-colors flex items-center justify-center shrink-0"
                            title="Exportar como Imagem"
                          >
                            <Download size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && item.items && item.items.length > 0 && (
                      <div className="border-t border-purple-100 bg-white p-4 breakdown-section">
                        <div className="overflow-x-auto hide-scrollbar">
                          <table className="w-full text-left border-collapse min-w-[500px]">
                            <thead>
                              <tr className="bg-purple-50/30 border-b border-black/5">
                                <th className="px-4 py-3 text-xs font-bold uppercase text-black">Data da Compra</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase text-black">Local</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase text-black text-center">Parcela</th>
                                <th className="px-4 py-3 text-xs font-bold uppercase text-black text-right">Valor</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-black/5">
                              {item.items.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((detail, idx) => (
                                <tr key={`${detail.id}-${idx}`} className="hover:bg-purple-50/10 transition-colors">
                                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                                    {detail.date ? detail.date.split('-').reverse().join('/') : '-'}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-black">
                                    {detail.local}
                                    {detail.originalExp?.observation && (
                                      <div className="text-[10px] text-gray-500 font-normal italic mt-0.5 truncate max-w-[200px]" title={detail.originalExp.observation}>
                                        {detail.originalExp.observation}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-center text-gray-600">
                                    {detail.installment}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-mono font-bold text-right whitespace-nowrap">
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
                       <div className="border-t border-purple-100 bg-white p-4 text-center text-sm text-gray-500">
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
