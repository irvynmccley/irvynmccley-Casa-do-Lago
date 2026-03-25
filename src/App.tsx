import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  FileText, 
  Settings, 
  Info,
  Wallet,
  LogOut
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
import { Login } from './components/Login';
import { supabase } from './supabaseClient';

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
      if (!['inicio', 'saidas'].includes(activeTab)) {
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
      } else {
        setUser(null);
        if (shared) {
          supabase.auth.signInAnonymously().then(({ data: { session: anonSession } }) => {
            if (anonSession?.user) {
              setUser(anonSession.user);
            }
            setIsAuthReady(true);
          }).catch(err => {
            console.error(err);
            setIsAuthReady(true);
          });
          return;
        }
      }
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        if (!shared && session.user.is_anonymous) {
          await supabase.auth.signOut();
          setUser(null);
        } else {
          setUser(session.user);
        }
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [activeTab]);

  const [state, setState] = useState<AppState>({ expenses: [], incomes: [], payments: [] });

  useEffect(() => {
    if (!isAuthReady) return;

    const fetchAndSubscribe = async () => {
      // Initial fetch
      const fetchTable = async (table: string) => {
        const { data } = await supabase.from(table).select('*').order('date', { ascending: false });
        return data || [];
      };

      const [expensesData, incomesData, paymentsData] = await Promise.all([
        fetchTable('expenses'),
        !isSharedMode ? fetchTable('incomes') : Promise.resolve([]),
        !isSharedMode ? fetchTable('payments') : Promise.resolve([])
      ]);

      setState({
        expenses: expensesData as Expense[],
        incomes: incomesData as Income[],
        payments: paymentsData as Payment[]
      });

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
  }, [isAuthReady, isSharedMode]);

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
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    
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
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + valuePerInstallment;
      }
    });

    if (!monthlyTotals[currentMonthKey]) {
      monthlyTotals[currentMonthKey] = 0;
    }

    return Object.entries(monthlyTotals)
      .map(([month, total]) => ({ month, total }))
      .filter(item => item.month >= currentMonthKey)
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

  // --- Handlers ---

  const addExpense = async (expense: Omit<Expense, 'id'>) => {
    try {
      const cleanExpense = Object.fromEntries(Object.entries(expense).filter(([_, v]) => v !== undefined));
      const { error } = await supabase.from('expenses').insert({
        ...cleanExpense,
        createdAt: new Date().toISOString(),
        createdBy: user?.id || null
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Error adding expense: ", error);
      alert(`Erro ao adicionar despesa: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const editExpense = async (id: string, expense: Partial<Omit<Expense, 'id'>>) => {
    try {
      const cleanExpense = Object.fromEntries(Object.entries(expense).filter(([_, v]) => v !== undefined));
      const { error } = await supabase.from('expenses').update(cleanExpense).eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      console.error("Error editing expense: ", error);
      alert(`Erro ao editar despesa: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const addIncome = async (income: Omit<Income, 'id'>) => {
    try {
      const { error } = await supabase.from('incomes').insert({
        ...income,
        createdAt: new Date().toISOString(),
        createdBy: user?.id || null
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Error adding income: ", error);
      alert(`Erro ao adicionar entrada: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const addPayment = async (payment: Omit<Payment, 'id'>) => {
    try {
      const { error } = await supabase.from('payments').insert({
        ...payment,
        createdAt: new Date().toISOString(),
        createdBy: user?.id || null
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Error adding payment: ", error);
      alert(`Erro ao adicionar pagamento: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      console.error("Error deleting expense: ", error);
      alert(`Erro ao deletar despesa: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const editIncome = async (id: string, income: Partial<Omit<Income, 'id'>>) => {
    try {
      const cleanIncome = Object.fromEntries(Object.entries(income).filter(([_, v]) => v !== undefined));
      const { error } = await supabase.from('incomes').update(cleanIncome).eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error("Error editing income: ", error);
      alert("Erro ao editar entrada. Verifique suas permissões.");
    }
  };

  const deleteIncome = async (id: string) => {
    try {
      const { error } = await supabase.from('incomes').delete().eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      console.error("Error deleting income: ", error);
      alert(`Erro ao deletar entrada: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const deletePayment = async (id: string) => {
    try {
      const { error } = await supabase.from('payments').delete().eq('id', id);
      if (error) throw error;
    } catch (error: any) {
      console.error("Error deleting payment: ", error);
      alert(`Erro ao deletar pagamento: ${error.message || 'Verifique suas permissões.'}`);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out: ", error);
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
      <main className="pb-24 pt-8 px-4 md:pl-72 md:pr-8 md:pt-12 max-w-7xl mx-auto">
        {activeTab === 'inicio' && (
          <Dashboard 
            totalSpent={totalSpent} 
            totalDonations={totalDonations}
            categoryTotals={categoryTotals} 
            cardInstallments={cardInstallmentsByMonth} 
            caixaBalance={caixaBalance}
            formatCurrency={formatCurrency} 
          />
        )}
        {activeTab === 'saidas' && (
          <ExpensesTab 
            expenses={state.expenses} 
            onAdd={addExpense} 
            onEdit={editExpense}
            onDelete={deleteExpense} 
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
            onDeleteIncome={deleteIncome}
            onDeletePayment={deletePayment}
            formatCurrency={formatCurrency} 
          />
        )}
        {activeTab === 'relatorios' && !isSharedMode && (
          <ReportsTab 
            expenses={state.expenses} 
            formatCurrency={formatCurrency} 
          />
        )}
        {activeTab === 'config' && <PlaceholderTab title="Configurações" />}
        {activeTab === 'sobre' && <PlaceholderTab title="Sobre o Sistema" />}
      </main>
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
