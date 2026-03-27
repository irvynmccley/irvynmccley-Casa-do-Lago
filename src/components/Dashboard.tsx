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
import { Banknote, TrendingUp, CreditCard, BarChart as BarChartIcon, User, RefreshCw, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from './ui/Card';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

interface DashboardProps {
  totalSpent: number;
  totalDonations: number;
  categoryTotals: { name: string; value: number }[];
  cardInstallments: { month: string; total: number }[];
  caixaBalance: number;
  terrenoBalance: number;
  formatCurrency: (v: number) => string;
  onRefresh: () => Promise<void>;
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

export function Dashboard({ totalSpent, totalDonations, categoryTotals, cardInstallments, caixaBalance, terrenoBalance, formatCurrency, onRefresh }: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fixed costs calculation
  const FIXED_COSTS = 750; // 700 (terreno) + 50 (condominio)
  const PEOPLE_COUNT = 4; // Jorge, Mccley, Jan, Saulo
  const FIXED_PER_PERSON = FIXED_COSTS / PEOPLE_COUNT;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Painel</h2>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <Card className="bg-white border-none shadow-sm p-6 flex flex-col justify-between h-full">
          <div className="flex items-center gap-3 text-black mb-4">
            <Banknote size={18} className="text-emerald-500" />
            <span className="text-sm font-medium uppercase tracking-wider">Total da Obra</span>
          </div>
          <div className="text-3xl font-light tracking-tight truncate">{formatCurrency(totalSpent)}</div>
        </Card>

        <Card className="bg-white border-none shadow-sm p-6 flex flex-col justify-between h-full">
          <div className="flex items-center gap-3 text-black mb-4">
            <Wallet size={18} className="text-amber-500" />
            <span className="text-sm font-medium uppercase tracking-wider">Saldo do Caixa</span>
          </div>
          <div className={`text-3xl font-light tracking-tight truncate ${caixaBalance > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(caixaBalance)}
          </div>
        </Card>

        <Card className="bg-white border-none shadow-sm p-6 flex flex-col justify-between h-full">
          <div className="flex items-center gap-3 text-black mb-4">
            <Banknote size={18} className="text-red-500" />
            <span className="text-sm font-medium uppercase tracking-wider">Saldo do Terreno</span>
          </div>
          <div className="text-3xl font-light tracking-tight truncate text-red-600">
            {formatCurrency(terrenoBalance)}
          </div>
        </Card>

        <Card className="bg-white border-none shadow-sm p-6 flex flex-col h-full">
          <div className="flex items-center gap-3 text-black mb-4">
            <CreditCard size={18} className="text-orange-500" />
            <span className="text-sm font-medium uppercase tracking-wider">Fatura do Cartão</span>
          </div>
          <div className="space-y-2 overflow-y-auto max-h-[120px] pr-2 custom-scrollbar mt-auto">
            {cardInstallments.slice(0, 5).map((item) => (
              <div key={item.month} className="flex justify-between items-center py-1 border-b border-black/5 last:border-0">
                <span className="text-xs font-medium">
                  {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMM yy', { locale: ptBR })}
                </span>
                <span className="text-xs font-mono">{formatCurrency(item.total)}</span>
              </div>
            ))}
            {cardInstallments.length === 0 && <p className="text-xs text-black italic">Nenhum lançamento</p>}
          </div>
        </Card>

        <Card className="bg-white border-none shadow-sm p-6 flex flex-col justify-between h-full">
          <div className="flex items-center gap-3 text-black mb-4">
            <User size={18} className="text-purple-500" />
            <span className="text-sm font-medium uppercase tracking-wider">Total Doações</span>
          </div>
          <div className="text-3xl font-light tracking-tight text-purple-600 truncate">{formatCurrency(totalDonations)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        <Card className="bg-white border-none shadow-sm p-8 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Wallet size={20} className="text-blue-500" />
              A Pagar (Mensal por Pessoa)
            </h3>
            <div className="text-[10px] text-black font-medium uppercase tracking-wider">
              Jorge, Mccley, Jan, Saulo
            </div>
          </div>
          
          <div className="space-y-4 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar flex-grow">
            {cardInstallments.length > 0 ? (
              cardInstallments.map((item) => {
                const cardPerPerson = item.total / PEOPLE_COUNT;
                const totalPerPerson = cardPerPerson + FIXED_PER_PERSON;
                
                return (
                  <div key={item.month} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-2xl border border-black/5">
                    <div className="mb-2 sm:mb-0">
                      <div className="text-sm font-bold text-black">
                        {format(new Date(parseInt(item.month.split('-')[0]), parseInt(item.month.split('-')[1]) - 1, 1), 'MMMM yyyy', { locale: ptBR })}
                      </div>
                      <div className="text-[10px] text-black uppercase tracking-tighter">
                        Cartão: {formatCurrency(cardPerPerson)} + Fixo: {formatCurrency(FIXED_PER_PERSON)}
                      </div>
                    </div>
                    <div className="text-xl font-mono font-bold text-blue-600">
                      {formatCurrency(totalPerPerson)}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-black italic text-sm">
                <p>Nenhum gasto fixo ou parcelado identificado.</p>
                <p className="text-xs mt-1">Lançamentos no cartão aparecerão aqui.</p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-black/5 flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-xs text-black">Terreno: <span className="font-bold text-black">R$ 700,00</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-xs text-black">Condomínio: <span className="font-bold text-black">R$ 50,00</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500"></div>
              <span className="text-xs text-black">Total Fixo: <span className="font-bold text-black">R$ 750,00</span></span>
            </div>
          </div>
        </Card>

        <Card className="bg-white border-none shadow-sm p-8 flex flex-col h-full">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChartIcon size={20} className="text-emerald-500" />
              Gastos por Categoria
            </h3>
            <div className="text-xs text-black italic">
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
      </div>
    </div>
  );
}
