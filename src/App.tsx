import React, { useState, useEffect, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  FileText, 
  Settings, 
  Info,
  Wallet,
  LogOut,
  Map
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  getDate 
} from 'date-fns';
import { AppState, Expense, Income, Payment, Category, Person } from './types';
import { NavItem } from './components/ui/NavItem';
import { Dashboard } from './components/Dashboard';
import { ExpensesTab } from './components/ExpensesTab';
import { IncomesTab } from './components/IncomesTab';
import { ReportsTab } from './components/ReportsTab';
import { TerrenoTab } from './components/TerrenoTab';
import { Login } from './components/Login';
import { supabase } from './supabaseClient';
import { Toaster, toast } from 'sonner';
import { ConfirmDialog } from './components/ui/ConfirmDialog';

const ENABLE_SUPABASE_SYNC = true; // Trava de segurança

const CATEGORIES: Category[] = ['Combustível', 'Documentação', 'Material', 'Mão de Obra', 'Monitoramento'];
const PEOPLE: Person[] = ['Mccley', 'Jan', 'Saulo'];

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f5] text-black p-4">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Algo deu errado.</h1>
          <pre className="bg-white p-4 rounded-xl shadow-sm text-sm overflow-auto max-w-full">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-[#0a192f] text-white rounded-xl"
          >
            Recarregar página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

const INITIAL_PAID_TERRENO = [
  '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12',
  '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02'
];

function App() {
  const [activeTab, setActiveTab] = useState('inicio');
  const [isSharedMode, setIsSharedMode] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared') === 'true';
    if (shared) {
      setIsSharedMode(true);
      if (!['inicio', 'saidas', 'terreno'].includes(activeTab)) {
        setActiveTab('inicio');
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (!shared && session.user.is_anonymous) {
          supabase.auth.signOut().then(() => {
            setUser(null);
            setIsAuthReady(true);
          });
          return;
        }
        setUser(session.user);
        setIsAuthReady(true);
      } else {
        setUser(null);
        if (shared) {
          try {
            if (typeof supabase.auth.signInAnonymously === 'function') {
              supabase.auth.signInAnonymously().then((response) => {
                const anonSession = response?.data?.session;
                if (anonSession?.user) {
                  setUser(anonSession.user);
                }
                setIsAuthReady(true);
              }).catch(err => {
                console.error("Error signing in anonymously:", err);
                setIsAuthReady(true);
              });
            } else {
              console.warn("signInAnonymously is not available. Continuing as public user.");
              setIsAuthReady(true);
            }
          } catch (err) {
            console.error("Sync error signing in anonymously:", err);
            setIsAuthReady(true);
          }
          return;
        }
        setIsAuthReady(true);
      }
    }).catch(err => {
      console.error("Error getting session:", err);
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        if (!shared && session.user.is_anonymous) {
          supabase.auth.signOut().then(() => {
            setUser(null);
          });
        } else {
          setUser(session.user);
        }
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, [activeTab]);

  const [state, setState] = useState<AppState>({ expenses: [], incomes: [], payments: [], terrenoPaidInstallments: INITIAL_PAID_TERRENO });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const fetchAllData = useCallback(async () => {
    const fetchTable = async (table: string) => {
      const { data } = await supabase.from(table).select('*').order('date', { ascending: false });
      return data || [];
    };

    const [expensesData, incomesData, paymentsData, terrenoData] = await Promise.all([
      fetchTable('expenses'),
      !isSharedMode ? fetchTable('incomes') : Promise.resolve([]),
      !isSharedMode ? fetchTable('payments') : Promise.resolve([]),
      fetchTable('terreno_installments').catch(() => []) // Catch error if table doesn't exist yet
    ]);

    setState(prev => ({
      ...prev,
      expenses: expensesData as Expense[],
      incomes: incomesData as Income[],
      payments: paymentsData as Payment[],
      terrenoPaidInstallments: terrenoData && terrenoData.length > 0 ? terrenoData.map((t: any) => t.id) : INITIAL_PAID_TERRENO
    }));
  }, [isSharedMode]);

  useEffect(() => {
    if (!isAuthReady) return;

    const fetchAndSubscribe = async () => {
      // Initial fetch
      await fetchAllData();

      const fetchTable = async (table: string) => {
        const { data } = await supabase.from(table).select('*').order('date', { ascending: false });
        return data || [];
      };

      // Realtime subscriptions
      const channel = supabase.channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, async () => {
          const data = await fetchTable('expenses');
          setState(prev => ({ ...prev, expenses: data as Expense[] }));
        });

      if (!isSharedMode) {
        channel
          .on('postgres_changes', { event: '*', schema: 'public', table: 'incomes' }, async () => {
            const data = await fetchTable('incomes');
            setState(prev => ({ ...prev, incomes: data as Income[] }));
          })
          .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, async () => {
            const data = await fetchTable('payments');
            setState(prev => ({ ...prev, payments: data as Payment[] }));
          });
      }

      channel.subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let cleanup = () => {};
    fetchAndSubscribe().then(unsub => {
      if (unsub) cleanup = unsub;
    });

    return () => cleanup();
  }, [isAuthReady, isSharedMode, fetchAllData]);

  // --- Calculations ---

  const totalSpent = useMemo(() => {
    return state.expenses.reduce((acc, exp) => acc + exp.value, 0);
  }, [state.expenses]);

  const totalDonations = useMemo(() => {
    return state.expenses
      .filter(e => e.paymentMethod === 'doação')
      .reduce((acc, e) => acc + e.value, 0);
  }, [state.expenses]);

  const caixaBalance = useMemo(() => {
    const totalCaixaIncomes = state.incomes
      .filter(i => i.isCaixa)
      .reduce((acc, i) => acc + i.value, 0);
    const totalCaixaExpenses = state.expenses
      .filter(e => e.paymentMethod === 'Caixa')
      .reduce((acc, e) => acc + e.value, 0);
    return totalCaixaIncomes - totalCaixaExpenses;
  }, [state.incomes, state.expenses]);

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    state.expenses.forEach(e => {
      totals[e.category] = (totals[e.category] || 0) + e.value;
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [state.expenses]);

  const cardInstallmentsByMonth = useMemo(() => {
    const monthlyTotals: Record<string, number> = {};
    const currentYear = new Date().getFullYear();
    
    // Initialize all months for the current year
    for (let i = 1; i <= 12; i++) {
      const monthKey = `${currentYear}-${String(i).padStart(2, '0')}`;
      monthlyTotals[monthKey] = 0;
    }
    
    state.expenses.filter(e => e.paymentMethod === 'Cartão').forEach(exp => {
      if (!exp.date || !exp.date.includes('-')) return;
      
      const parts = exp.date.split('-');
      if (parts.length !== 3) return;
      
      const [yearStr, monthStr, dayStr] = parts;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) return;
      
      const installments = Number(exp.installments) || 1;
      const value = Number(exp.value) || 0;
      const valuePerInstallment = value / installments;
      
      // Compras entre dia 29 do mês vigente e 28 do mês seguinte
      // caem na fatura do mês seguinte (o mês que se encerrou no dia 28).
      let startMonthOffset = day > 28 ? 1 : 0;
      
      for (let i = 0; i < installments; i++) {
        const installmentDate = new Date(year, month + startMonthOffset + i, 1);
        const monthKey = format(installmentDate, 'yyyy-MM');
        // Only add if it's in the current year or we want to track future years too
        // Actually, we should track all, but we'll filter later
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + valuePerInstallment;
      }
    });

    return Object.entries(monthlyTotals)
      .map(([month, total]) => ({ month, total }))
      .filter(item => item.month.startsWith(`${currentYear}-`))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [state.expenses]);

  const totalIncome = useMemo(() => {
    return state.incomes.reduce((acc, inc) => acc + inc.value, 0);
  }, [state.incomes]);

  const totalPayments = useMemo(() => {
    return state.payments.reduce((acc, pay) => acc + pay.value, 0);
  }, [state.payments]);

  const totalDebt = totalIncome - totalPayments;

  const individualStats = useMemo(() => {
    const baseShare = totalIncome / 3;
    return PEOPLE.map(person => {
      const paid = state.payments.filter(p => p.person === person).reduce((acc, p) => acc + p.value, 0);
      return {
        name: person,
        share: baseShare,
        paid,
        debt: baseShare - paid
      };
    });
  }, [totalIncome, state.payments]);

  const terrenoBalance = useMemo(() => {
    let remainingDebt = 40000;
    let currentDate = new Date(2024, 1, 25);
    const installments = [];
    while (remainingDebt > 0) {
      const paymentValue = Math.min(700, remainingDebt);
      const id = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      installments.push({ id, value: paymentValue });
      remainingDebt -= paymentValue;
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    const totalPaid = installments
      .filter(i => (state.terrenoPaidInstallments || []).includes(i.id))
      .reduce((acc, curr) => acc + curr.value, 0);
    return 40000 - totalPaid;
  }, [state.terrenoPaidInstallments]);

  // --- Handlers ---

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    if (!ENABLE_SUPABASE_SYNC) {
      setState(prev => ({ ...prev, expenses: [{ ...expense, id: Date.now().toString() } as Expense, ...prev.expenses] }));
      toast.success("Lançamento com Sucesso");
      return;
    }
    try {
      const cleanExpense = Object.fromEntries(Object.entries(expense).filter(([_, v]) => v !== undefined));
      const { error } = await supabase.from('expenses').insert(cleanExpense);
      if (error) throw error;
      await fetchAllData();
      toast.success("Lançamento com Sucesso");
    } catch (error: any) {
      console.error("Error adding expense: ", error);
      toast.error(`Erro ao adicionar despesa: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const editExpense = async (id: string, expense: Partial<Omit<Expense, 'id'>>) => {
    if (!ENABLE_SUPABASE_SYNC) {
      setState(prev => ({ ...prev, expenses: prev.expenses.map(e => e.id === id ? { ...e, ...expense } as Expense : e) }));
      toast.success("Lançamento alterado com sucesso");
      return;
    }
    try {
      const cleanExpense = Object.fromEntries(Object.entries(expense).filter(([_, v]) => v !== undefined));
      const { error } = await supabase.from('expenses').update(cleanExpense).eq('id', id);
      if (error) throw error;
      await fetchAllData();
      toast.success("Lançamento alterado com sucesso");
    } catch (error: any) {
      console.error("Error editing expense: ", error);
      toast.error(`Erro ao editar despesa: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const addIncome = async (income: Omit<Income, 'id'>) => {
    if (!ENABLE_SUPABASE_SYNC) {
      setState(prev => ({ ...prev, incomes: [{ ...income, id: Date.now().toString() } as Income, ...prev.incomes] }));
      toast.success("Lançamento com Sucesso");
      return;
    }
    try {
      const { error } = await supabase.from('incomes').insert(income);
      if (error) throw error;
      await fetchAllData();
      toast.success("Lançamento com Sucesso");
    } catch (error: any) {
      console.error("Error adding income: ", error);
      toast.error(`Erro ao adicionar entrada: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const addPayment = async (payment: Omit<Payment, 'id'>) => {
    if (!ENABLE_SUPABASE_SYNC) {
      setState(prev => ({ ...prev, payments: [{ ...payment, id: Date.now().toString() } as Payment, ...prev.payments] }));
      toast.success("Lançamento com Sucesso");
      return;
    }
    try {
      const { error } = await supabase.from('payments').insert(payment);
      if (error) throw error;
      await fetchAllData();
      toast.success("Lançamento com Sucesso");
    } catch (error: any) {
      console.error("Error adding payment: ", error);
      toast.error(`Erro ao adicionar pagamento: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!ENABLE_SUPABASE_SYNC) {
      setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
      toast.success("Lançamento excluído com sucesso");
      return;
    }
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      await fetchAllData();
      toast.success("Lançamento excluído com sucesso");
    } catch (error: any) {
      console.error("Error deleting expense: ", error);
      toast.error(`Erro ao deletar despesa: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const editIncome = async (id: string, income: Partial<Omit<Income, 'id'>>) => {
    if (!ENABLE_SUPABASE_SYNC) {
      setState(prev => ({ ...prev, incomes: prev.incomes.map(i => i.id === id ? { ...i, ...income } as Income : i) }));
      toast.success("Lançamento alterado com sucesso");
      return;
    }
    try {
      const cleanIncome = Object.fromEntries(Object.entries(income).filter(([_, v]) => v !== undefined));
      const { error } = await supabase.from('incomes').update(cleanIncome).eq('id', id);
      if (error) throw error;
      await fetchAllData();
      toast.success("Lançamento alterado com sucesso");
    } catch (error) {
      console.error("Error editing income: ", error);
      toast.error("Erro ao editar entrada. Verifique suas permissões.");
    }
  };

  const deleteIncome = async (id: string) => {
    if (!ENABLE_SUPABASE_SYNC) {
      setState(prev => ({ ...prev, incomes: prev.incomes.filter(i => i.id !== id) }));
      toast.success("Lançamento excluído com sucesso");
      return;
    }
    try {
      const { error } = await supabase.from('incomes').delete().eq('id', id);
      if (error) throw error;
      await fetchAllData();
      toast.success("Lançamento excluído com sucesso");
    } catch (error: any) {
      console.error("Error deleting income: ", error);
      toast.error(`Erro ao deletar entrada: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const deletePayment = async (id: string) => {
    if (!ENABLE_SUPABASE_SYNC) {
      setState(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) }));
      toast.success("Lançamento excluído com sucesso");
      return;
    }
    try {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
      await fetchAllData();
      toast.success("Lançamento excluído com sucesso");
    } catch (error: any) {
      console.error("Error deleting payment: ", error);
      toast.error(`Erro ao deletar pagamento: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const confirmDeleteExpense = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Saída',
      message: 'Tem certeza que deseja excluir esta saída? Esta ação não pode ser desfeita.',
      onConfirm: () => deleteExpense(id),
    });
  };

  const confirmDeleteIncome = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Entrada',
      message: 'Tem certeza que deseja excluir esta entrada? Esta ação não pode ser desfeita.',
      onConfirm: () => deleteIncome(id),
    });
  };

  const confirmDeletePayment = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Pagamento',
      message: 'Tem certeza que deseja excluir este pagamento? Esta ação não pode ser desfeita.',
      onConfirm: () => deletePayment(id),
    });
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleToggleTerrenoPayment = async (id: string) => {
    const currentPaid = state.terrenoPaidInstallments || [];
    const isPaid = currentPaid.includes(id);
    const newPaid = isPaid 
      ? currentPaid.filter(i => i !== id)
      : [...currentPaid, id];
    
    setState(prev => ({ ...prev, terrenoPaidInstallments: newPaid }));

    if (ENABLE_SUPABASE_SYNC) {
      try {
        if (isPaid) {
          const { error } = await supabase.from('terreno_installments').delete().eq('id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('terreno_installments').insert({ id });
          if (error) throw error;
        }
      } catch (error: any) {
        console.error("Error syncing terreno payment: ", error);
        // Revert state on error
        setState(prev => ({ ...prev, terrenoPaidInstallments: currentPaid }));
        toast.error(`Erro ao sincronizar pagamento: ${error.message || "Tabela 'terreno_installments' não encontrada."}`);
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-black">Carregando...</div>;
  }

  if (!user && !isSharedMode) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-black font-sans">
      {/* Sidebar / Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-4 py-2 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:flex-col md:w-64 md:h-screen md:border-t-0 md:border-r md:justify-start md:py-8 md:gap-4">
        <div className="hidden md:flex items-center gap-3 mb-8 px-4 w-full">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <Wallet size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Casa do Lago</h1>
        </div>

        <NavItem icon={<LayoutDashboard size={20} />} label="Início" active={activeTab === 'inicio'} onClick={() => setActiveTab('inicio')} />
        <NavItem icon={<ArrowDownCircle size={20} />} label="Saídas" active={activeTab === 'saidas'} onClick={() => setActiveTab('saidas')} />
        <NavItem icon={<Map size={20} />} label="Terreno" active={activeTab === 'terreno'} onClick={() => setActiveTab('terreno')} />
        
        {!isSharedMode ? (
          <>
            <NavItem icon={<ArrowUpCircle size={20} />} label="Entradas" active={activeTab === 'entradas'} onClick={() => setActiveTab('entradas')} />
            <NavItem icon={<FileText size={20} />} label="Relatórios" active={activeTab === 'relatorios'} onClick={() => setActiveTab('relatorios')} />
            <NavItem icon={<Settings size={20} />} label="Config" active={activeTab === 'config'} onClick={() => setActiveTab('config')} />
            <NavItem icon={<Info size={20} />} label="Sobre" active={activeTab === 'sobre'} onClick={() => setActiveTab('sobre')} />
            
            <div className="mt-auto hidden md:block w-full px-4 pb-4">
              <button 
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut size={20} />
                Sair
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="md:hidden">
              <NavItem 
                icon={<LogOut size={20} />} 
                label="Sair" 
                active={false} 
                onClick={() => window.location.href = '/'} 
              />
            </div>
            <div className="mt-auto hidden md:block w-full px-4 pb-4">
              <button 
                onClick={() => window.location.href = '/'}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut size={20} />
                Voltar para Login
              </button>
            </div>
          </>
        )}
      </nav>

      {/* Main Content */}
      <main className="pb-24 pt-4 px-2 sm:px-4 md:pl-72 md:pr-8 md:pt-12 max-w-7xl mx-auto w-full overflow-x-hidden">
        {activeTab === 'inicio' && (
          <Dashboard 
            totalSpent={totalSpent} 
            totalDonations={totalDonations}
            categoryTotals={categoryTotals} 
            cardInstallments={cardInstallmentsByMonth} 
            caixaBalance={caixaBalance}
            terrenoBalance={terrenoBalance}
            formatCurrency={formatCurrency} 
            onRefresh={fetchAllData}
          />
        )}
        {activeTab === 'saidas' && (
          <ExpensesTab 
            expenses={state.expenses} 
            onAdd={addExpense} 
            onEdit={editExpense}
            onDelete={confirmDeleteExpense} 
            formatCurrency={formatCurrency} 
            isSharedMode={isSharedMode}
          />
        )}
        {activeTab === 'entradas' && !isSharedMode && (
          <IncomesTab 
            incomes={state.incomes} 
            payments={state.payments}
            totalIncome={totalIncome}
            totalPayments={totalPayments}
            totalDebt={totalDebt}
            individualStats={individualStats}
            onAddIncome={addIncome} 
            onEditIncome={editIncome}
            onAddPayment={addPayment}
            onDeleteIncome={confirmDeleteIncome}
            onDeletePayment={confirmDeletePayment}
            formatCurrency={formatCurrency} 
          />
        )}
        {activeTab === 'relatorios' && !isSharedMode && (
          <ReportsTab 
            expenses={state.expenses} 
            formatCurrency={formatCurrency} 
          />
        )}
        {activeTab === 'terreno' && (
          <TerrenoTab 
            paidInstallments={state.terrenoPaidInstallments}
            onTogglePayment={handleToggleTerrenoPayment}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'config' && <PlaceholderTab title="Configurações" />}
        {activeTab === 'sobre' && <PlaceholderTab title="Sobre o Sistema" />}
      </main>
      <Toaster position="top-center" richColors />
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-black">
        <Settings size={40} />
      </div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="text-black max-w-md">Esta aba está em desenvolvimento e será implementada em breve.</p>
    </div>
  );
}
