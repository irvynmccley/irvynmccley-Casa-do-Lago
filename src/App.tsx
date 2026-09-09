import React, { useState, useEffect, useMemo, useCallback, ErrorInfo, ReactNode } from 'react';
import { 
  LayoutDashboard, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  FileText, 
  Settings, 
  Info,
  LogOut,
  Map
} from 'lucide-react';
import { 
  format
} from 'date-fns';
import { AppState, Expense, Income, Payment, Category, Person } from './types';
import { NavItem } from './components/ui/NavItem';
import { Dashboard } from './components/Dashboard';
import { ExpensesTab } from './components/ExpensesTab';
import { IncomesTab } from './components/IncomesTab';
import { ReportsTab } from './components/ReportsTab';
import { TerrenoTab } from './components/TerrenoTab';
import { ConfigTab } from './components/ConfigTab';
import { Login } from './components/Login';
import { pb } from './pocketbaseClient';
import { Toaster, toast } from 'sonner';
import { ConfirmDialog } from './components/ui/ConfirmDialog';
import { useOfflineSync } from './useOfflineSync';

const ENABLE_POCKETBASE_SYNC = true; // Trava de segurança para persistência no PocketBase

const PEOPLE: Person[] = ['Mccley', 'Jan', 'Saulo'];

export const normalizeCategory = (cat: any): string => {
  if (!cat || typeof cat !== 'string') return '';
  // Remove accents and convert to lowercase for comparison
  const normalized = cat.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  
  if (normalized === 'combustivel') return 'Combustível';
  if (normalized === 'mao de obra') return 'Mão de Obra';
  if (normalized === 'documentacao') return 'Documentação';
  if (normalized === 'alimentacao') return 'Alimentação';
  if (normalized === 'monitoramento') return 'Monitoramento';
  if (normalized === 'material') return 'Material';
  
  // Fallback
  const trimmed = cat.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

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
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#020817] text-slate-200 p-4">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Algo deu errado.</h1>
          <pre className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-sm overflow-auto max-w-full text-slate-300">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20"
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

  // Tab restriction logic for shared mode
  useEffect(() => {
    if (isSharedMode && !['inicio', 'saidas', 'terreno'].includes(activeTab)) {
      setActiveTab('inicio');
    }
  }, [activeTab, isSharedMode]);

  // Auth logic with PocketBase
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared') === 'true';
    setIsSharedMode(shared);

    if (shared) {
      setUser({ id: 'shared-user', email: 'mestre@casadolago.com' });
      setIsAuthReady(true);
      return;
    }

    // Check if PocketBase has a valid logged in session (user or superuser)
    if (pb.authStore.isValid && pb.authStore.record) {
      setUser(pb.authStore.record);
    } else {
      setUser(null);
    }
    setIsAuthReady(true);

    const unsubscribe = pb.authStore.onChange((_token, model) => {
      setUser(model);
      if (!model && !shared) {
        setUser(null);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const [state, setState] = useState<AppState>({ expenses: [], incomes: [], payments: [], terrenoPaidInstallments: INITIAL_PAID_TERRENO });
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'local' | 'error'>(ENABLE_POCKETBASE_SYNC ? 'syncing' : 'local');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    confirmStyle?: 'danger' | 'primary';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const fetchAllData = useCallback(async () => {
    if (!ENABLE_POCKETBASE_SYNC) {
      setSyncStatus('local');
      return;
    }

    let hasError = false;

    const fetchCollection = async (collectionName: string) => {
      try {
        const records = await pb.collection(collectionName).getFullList({
          sort: '-date',
          requestKey: null
        });
        return records || [];
      } catch (err) {
        console.error(`Error fetching collection ${collectionName}:`, err);
        hasError = true;
        return [];
      }
    };

    try {
      const [expensesData, incomesData, paymentsData, terrenoData] = await Promise.all([
        fetchCollection('expenses'),
        fetchCollection('incomes'),
        fetchCollection('payments'),
        (async () => {
          try {
            const records = await pb.collection('terreno_installments').getFullList({ requestKey: null });
            return records || [];
          } catch (err) {
            console.error("Error fetching terreno_installments:", err);
            hasError = true;
            return [];
          }
        })()
      ]);

      setSyncStatus(hasError ? 'error' : 'syncing');

      const normalizedExpenses = (expensesData as any[]).map(e => ({
        ...e,
        id: e.id,
        category: normalizeCategory(e.category) as Category
      }));

      const terrenoIds = terrenoData.map((t: any) => t.month_id || t.original_id || t.id);

      setState(prev => ({
        ...prev,
        expenses: normalizedExpenses as unknown as Expense[],
        incomes: incomesData as unknown as Income[],
        payments: paymentsData as unknown as Payment[],
        terrenoPaidInstallments: terrenoIds.length > 0 ? terrenoIds : INITIAL_PAID_TERRENO
      }));
    } catch (e) {
      console.error("General error in fetchAllData:", e);
      setSyncStatus('error');
    }
  }, [isSharedMode]);

  const { isOffline, isSyncing, saveToOfflineQueue } = useOfflineSync(fetchAllData);

  // Realtime subscription using PocketBase Server-Sent Events
  useEffect(() => {
    if (!isAuthReady) return;

    let isMounted = true;
    fetchAllData();

    const subscribeRealtime = async () => {
      try {
        await pb.collection('expenses').subscribe('*', async () => {
          if (!isMounted) return;
          const records = await pb.collection('expenses').getFullList({ sort: '-date', requestKey: null });
          const normalizedExpenses = records.map(e => ({
            ...e,
            category: normalizeCategory(e.category) as Category
          }));
          setState(prev => ({ ...prev, expenses: normalizedExpenses as unknown as Expense[] }));
        });

        await pb.collection('incomes').subscribe('*', async () => {
          if (!isMounted) return;
          const records = await pb.collection('incomes').getFullList({ sort: '-date', requestKey: null });
          setState(prev => ({ ...prev, incomes: records as unknown as Income[] }));
        });

        await pb.collection('payments').subscribe('*', async () => {
          if (!isMounted) return;
          const records = await pb.collection('payments').getFullList({ sort: '-date', requestKey: null });
          setState(prev => ({ ...prev, payments: records as unknown as Payment[] }));
        });

        await pb.collection('terreno_installments').subscribe('*', async () => {
          if (!isMounted) return;
          const records = await pb.collection('terreno_installments').getFullList({ requestKey: null });
          const ids = records.map((t: any) => t.month_id || t.original_id || t.id);
          setState(prev => ({ ...prev, terrenoPaidInstallments: ids }));
        });
      } catch (err) {
        console.warn("PocketBase realtime subscription notice:", err);
      }
    };

    subscribeRealtime();

    return () => {
      isMounted = false;
      pb.collection('expenses').unsubscribe('*').catch(() => {});
      pb.collection('incomes').unsubscribe('*').catch(() => {});
      pb.collection('payments').unsubscribe('*').catch(() => {});
      pb.collection('terreno_installments').unsubscribe('*').catch(() => {});
    };
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
      const catName = normalizeCategory(e.category);
      if (catName) {
        totals[catName] = (totals[catName] || 0) + e.value;
      }
    });
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [state.expenses]);

  const allCardInstallmentsByMonth = useMemo(() => {
    const monthlyTotals: Record<string, { total: number, items: Array<{id: string, date: string, local: string, value: number, installment: string, originalExp: any}> }> = {};
    
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
        if (!monthlyTotals[monthKey]) {
          monthlyTotals[monthKey] = { total: 0, items: [] };
        }
        monthlyTotals[monthKey].total += valuePerInstallment;
        monthlyTotals[monthKey].items.push({
          id: exp.id,
          date: exp.date,
          local: exp.local || '',
          value: valuePerInstallment,
          installment: `${i + 1}/${installments}`,
          originalExp: exp,
        });
      }
    });

    return Object.entries(monthlyTotals)
      .map(([month, data]) => ({ month, total: data.total, items: data.items }))
      .sort((a, b) => b.month.localeCompare(a.month)); // descending
  }, [state.expenses]);

  const cardInstallmentsByMonth = useMemo(() => {
    const currentMonthKey = format(new Date(), 'yyyy-MM');
    const currentYear = new Date().getFullYear();
    
    const monthlyTotals: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) {
      const monthKey = `${currentYear}-${String(i).padStart(2, '0')}`;
      monthlyTotals[monthKey] = 0;
    }
    
    allCardInstallmentsByMonth.forEach(item => {
      monthlyTotals[item.month] = item.total;
    });

    return Object.entries(monthlyTotals)
      .map(([month, total]) => ({ month, total }))
      .filter(item => item.month.startsWith(`${currentYear}-`) && item.month >= currentMonthKey)
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [allCardInstallmentsByMonth]);

  const totalIncome = useMemo(() => {
    return state.incomes.filter(i => !i.isCaixa).reduce((acc, inc) => acc + inc.value, 0);
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
    if (!ENABLE_POCKETBASE_SYNC) {
      setState(prev => ({ ...prev, expenses: [{ ...expense, id: Date.now().toString() } as Expense, ...prev.expenses] }));
      toast.success("Lançamento com Sucesso");
      return;
    }
    const cleanExpense = Object.fromEntries(Object.entries(expense).filter(([_, v]) => v !== undefined));
    const payload = { ...cleanExpense, createdBy: user?.id || null };
    
    if (isOffline) {
       saveToOfflineQueue('ADD_EXPENSE', payload);
       setState(prev => ({ ...prev, expenses: [{ ...payload, id: 'temp-' + Date.now().toString() } as unknown as Expense, ...prev.expenses] }));
       toast.success("Salvo offline. Rastreando até reconectar.");
       return;
    }

    try {
      await pb.collection('expenses').create(payload);
      await fetchAllData();
      toast.success("Lançamento com Sucesso");
    } catch (error: any) {
      console.error("Error adding expense: ", error);
      if (error.isAbort || !navigator.onLine || (error.message && (error.message.includes('FetchError') || error.message.includes('Failed to fetch') || error.message.includes('network')))) {
         saveToOfflineQueue('ADD_EXPENSE', payload);
         setState(prev => ({ ...prev, expenses: [{ ...payload, id: 'temp-' + Date.now().toString() } as unknown as Expense, ...prev.expenses] }));
         toast.success("Salvo offline (Erro de rede).");
      } else {
         toast.error(`Erro ao adicionar despesa: ${error.message || 'Verifique os dados.'}`);
      }
    }
  };

  const editExpense = async (id: string, expense: Partial<Omit<Expense, 'id'>>) => {
    if (!ENABLE_POCKETBASE_SYNC) {
      setState(prev => ({ ...prev, expenses: prev.expenses.map(e => e.id === id ? { ...e, ...expense } as Expense : e) }));
      toast.success("Lançamento alterado com sucesso");
      return;
    }
    const cleanExpense = Object.fromEntries(Object.entries(expense).filter(([_, v]) => v !== undefined));

    if (isOffline) {
       saveToOfflineQueue('EDIT_EXPENSE', cleanExpense, id);
       setState(prev => ({ ...prev, expenses: prev.expenses.map(e => e.id === id ? { ...e, ...cleanExpense } as Expense : e) }));
       toast.success("Editado offline. Será sincronizado na próxima conexão.");
       return;
    }

    try {
      await pb.collection('expenses').update(id, cleanExpense);
      await fetchAllData();
      toast.success("Lançamento alterado com sucesso");
    } catch (error: any) {
      console.error("Error editing expense: ", error);
      if (error.isAbort || !navigator.onLine || (error.message && (error.message.includes('FetchError') || error.message.includes('Failed to fetch') || error.message.includes('network')))) {
         saveToOfflineQueue('EDIT_EXPENSE', cleanExpense, id);
         setState(prev => ({ ...prev, expenses: prev.expenses.map(e => e.id === id ? { ...e, ...cleanExpense } as Expense : e) }));
         toast.success("Editado offline (Erro de rede).");
      } else {
         toast.error(`Erro ao editar despesa: ${error.message || 'Verifique os dados.'}`);
      }
    }
  };

  const addIncome = async (income: Omit<Income, 'id'>) => {
    if (!ENABLE_POCKETBASE_SYNC) {
      setState(prev => ({ ...prev, incomes: [{ ...income, id: Date.now().toString() } as Income, ...prev.incomes] }));
      toast.success("Lançamento com Sucesso");
      return;
    }
    const payload = { ...income, createdBy: user?.id || null };

    if (isOffline) {
       saveToOfflineQueue('ADD_INCOME', payload);
       setState(prev => ({ ...prev, incomes: [{ ...payload, id: 'temp-' + Date.now().toString() } as unknown as Income, ...prev.incomes] }));
       toast.success("Salvo offline. Será sincronizado na próxima conexão.");
       return;
    }

    try {
      await pb.collection('incomes').create(payload);
      await fetchAllData();
      toast.success("Lançamento com Sucesso");
    } catch (error: any) {
      console.error("Error adding income: ", error);
      if (error.isAbort || !navigator.onLine || (error.message && (error.message.includes('FetchError') || error.message.includes('Failed to fetch') || error.message.includes('network')))) {
         saveToOfflineQueue('ADD_INCOME', payload);
         setState(prev => ({ ...prev, incomes: [{ ...payload, id: 'temp-' + Date.now().toString() } as unknown as Income, ...prev.incomes] }));
         toast.success("Salvo offline (Erro de rede).");
      } else {
         toast.error(`Erro ao adicionar entrada: ${error.message || 'Verifique os dados.'}`);
      }
    }
  };

  const addPayment = async (payment: Omit<Payment, 'id'>) => {
    if (!ENABLE_POCKETBASE_SYNC) {
      setState(prev => ({ ...prev, payments: [{ ...payment, id: Date.now().toString() } as Payment, ...prev.payments] }));
      toast.success("Lançamento com Sucesso");
      return;
    }
    const payload = { ...payment, createdBy: user?.id || null };
    
    if (isOffline) {
       saveToOfflineQueue('ADD_PAYMENT', payload);
       setState(prev => ({ ...prev, payments: [{ ...payload, id: 'temp-' + Date.now().toString() } as unknown as Payment, ...prev.payments] }));
       toast.success("Salvo offline. Rastreando até reconectar.");
       return;
    }

    try {
      await pb.collection('payments').create(payload);
      await fetchAllData();
      toast.success("Lançamento com Sucesso");
    } catch (error: any) {
      console.error("Error adding payment: ", error);
      if (error.isAbort || !navigator.onLine || (error.message && (error.message.includes('FetchError') || error.message.includes('Failed to fetch') || error.message.includes('network')))) {
         saveToOfflineQueue('ADD_PAYMENT', payload);
         setState(prev => ({ ...prev, payments: [{ ...payload, id: 'temp-' + Date.now().toString() } as unknown as Payment, ...prev.payments] }));
         toast.success("Salvo offline (Erro de rede).");
      } else {
         toast.error(`Erro ao adicionar pagamento: ${error.message || 'Verifique os dados.'}`);
      }
    }
  };

  const deleteExpense = async (id: string) => {
    if (!ENABLE_POCKETBASE_SYNC) {
      setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
      toast.success("Lançamento excluído com sucesso");
      return;
    }
    
    if (isOffline) {
       saveToOfflineQueue('DELETE_EXPENSE', null, id);
       setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
       toast.success("Excluído offline. Será sincronizado na próxima conexão.");
       return;
    }

    try {
      await pb.collection('expenses').delete(id);
      await fetchAllData();
      toast.success("Lançamento excluído com sucesso");
    } catch (error: any) {
      console.error("Error deleting expense: ", error);
      if (error.isAbort || !navigator.onLine || (error.message && (error.message.includes('FetchError') || error.message.includes('Failed to fetch') || error.message.includes('network')))) {
         saveToOfflineQueue('DELETE_EXPENSE', null, id);
         setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }));
         toast.success("Excluído offline (Erro de rede).");
      } else {
         toast.error(`Erro ao deletar despesa: ${error.message || 'Verifique suas permissões.'}`);
      }
    }
  };

  const editIncome = async (id: string, income: Partial<Omit<Income, 'id'>>) => {
    if (!ENABLE_POCKETBASE_SYNC) {
      setState(prev => ({ ...prev, incomes: prev.incomes.map(i => i.id === id ? { ...i, ...income } as Income : i) }));
      toast.success("Lançamento alterado com sucesso");
      return;
    }
    const cleanIncome = Object.fromEntries(Object.entries(income).filter(([_, v]) => v !== undefined));

    if (isOffline) {
       saveToOfflineQueue('EDIT_INCOME', cleanIncome, id);
       setState(prev => ({ ...prev, incomes: prev.incomes.map(i => i.id === id ? { ...i, ...cleanIncome } as Income : i) }));
       toast.success("Editado offline. Será sincronizado na próxima conexão.");
       return;
    }

    try {
      await pb.collection('incomes').update(id, cleanIncome);
      await fetchAllData();
      toast.success("Lançamento alterado com sucesso");
    } catch (error: any) {
      console.error("Error editing income: ", error);
      if (error.isAbort || !navigator.onLine || (error.message && (error.message.includes('FetchError') || error.message.includes('Failed to fetch') || error.message.includes('network')))) {
         saveToOfflineQueue('EDIT_INCOME', cleanIncome, id);
         setState(prev => ({ ...prev, incomes: prev.incomes.map(i => i.id === id ? { ...i, ...cleanIncome } as Income : i) }));
         toast.success("Editado offline (Erro de rede).");
      } else {
         toast.error("Erro ao editar entrada. Verifique suas permissões.");
      }
    }
  };

  const deleteIncome = async (id: string) => {
    if (!ENABLE_POCKETBASE_SYNC) {
      setState(prev => ({ ...prev, incomes: prev.incomes.filter(i => i.id !== id) }));
      toast.success("Lançamento excluído com sucesso");
      return;
    }

    if (isOffline) {
       saveToOfflineQueue('DELETE_INCOME', null, id);
       setState(prev => ({ ...prev, incomes: prev.incomes.filter(i => i.id !== id) }));
       toast.success("Excluído offline. Será sincronizado na próxima conexão.");
       return;
    }

    try {
      await pb.collection('incomes').delete(id);
      await fetchAllData();
      toast.success("Lançamento excluído com sucesso");
    } catch (error: any) {
      console.error("Error deleting income: ", error);
      if (error.isAbort || !navigator.onLine || (error.message && (error.message.includes('FetchError') || error.message.includes('Failed to fetch') || error.message.includes('network')))) {
         saveToOfflineQueue('DELETE_INCOME', null, id);
         setState(prev => ({ ...prev, incomes: prev.incomes.filter(i => i.id !== id) }));
         toast.success("Excluído offline (Erro de rede).");
      } else {
         toast.error(`Erro ao deletar entrada: ${error.message || 'Verifique suas permissões.'}`);
      }
    }
  };

  const deletePayment = async (id: string) => {
    if (!ENABLE_POCKETBASE_SYNC) {
      setState(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) }));
      toast.success("Lançamento excluído com sucesso");
      return;
    }
    
    if (isOffline) {
       saveToOfflineQueue('DELETE_PAYMENT', null, id);
       setState(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) }));
       toast.success("Excluído offline. Será sincronizado na próxima conexão.");
       return;
    }

    try {
      await pb.collection('payments').delete(id);
      await fetchAllData();
      toast.success("Lançamento excluído com sucesso");
    } catch (error: any) {
      console.error("Error deleting payment: ", error);
      if (error.isAbort || !navigator.onLine || (error.message && (error.message.includes('FetchError') || error.message.includes('Failed to fetch') || error.message.includes('network')))) {
         saveToOfflineQueue('DELETE_PAYMENT', null, id);
         setState(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) }));
         toast.success("Excluído offline (Erro de rede).");
      } else {
         toast.error(`Erro ao deletar pagamento: ${error.message || 'Verifique suas permissões.'}`);
      }
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
      pb.authStore.clear();
      setUser(null);
      window.location.href = '/';
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

    if (ENABLE_POCKETBASE_SYNC) {
      if (isOffline) {
        saveToOfflineQueue('TOGGLE_TERRENO', { action: isPaid ? 'delete' : 'insert' }, id);
        toast.success("Ação salva offline. Será sincronizada na próxima conexão.");
        return;
      }
      try {
        if (isPaid) {
          try {
            const existing = await pb.collection('terreno_installments').getFirstListItem(`month_id="${id}" || original_id="${id}" || id="${id}"`);
            if (existing) {
              await pb.collection('terreno_installments').delete(existing.id);
            }
          } catch (e: any) {
            if (e.status !== 404) throw e;
          }
        } else {
          try {
            await pb.collection('terreno_installments').getFirstListItem(`month_id="${id}" || original_id="${id}"`);
          } catch (e: any) {
            if (e.status === 404) {
              await pb.collection('terreno_installments').create({
                month_id: id,
                original_id: id
              });
            }
          }
        }
      } catch (error: any) {
        console.error("Error syncing terreno payment: ", error);
        if (error.isAbort || !navigator.onLine || (error.message && (error.message.includes('FetchError') || error.message.includes('Failed to fetch') || error.message.includes('network')))) {
           saveToOfflineQueue('TOGGLE_TERRENO', { action: isPaid ? 'delete' : 'insert' }, id);
           toast.success("Ação salva offline (Erro de rede).");
        } else {
           setState(prev => ({ ...prev, terrenoPaidInstallments: currentPaid }));
           toast.error(`Erro ao sincronizar pagamento: ${error.message || "Tabela 'terreno_installments' não encontrada."}`);
        }
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-[#020817] text-slate-200 font-sans"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>;
  }

  if (!user && !isSharedMode) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-[#020817] text-slate-200 font-sans relative overflow-x-hidden selection:bg-blue-500/30">
      {/* Background Orbs */}
      <div className="fixed top-[-10%] left-[-10%] w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-[100px] opacity-10 animate-pulse pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-[100px] opacity-10 animate-pulse pointer-events-none z-0" style={{ animationDelay: '2s' }}></div>

      {/* Sidebar / Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800/80 px-4 py-2 flex justify-around items-center md:top-0 md:bottom-0 md:right-auto md:w-64 md:flex-col md:justify-start md:border-t-0 md:border-r md:p-6 md:space-y-4">
        <div className="hidden md:flex flex-col items-center gap-3 mb-6 w-full px-2">
          <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
            <span className="font-bold text-white text-xl tracking-wider">CL</span>
          </div>
          <div className="text-center">
            <h1 className="font-bold text-white tracking-wide text-lg">Casa do Lago</h1>
            <p className="text-xs text-slate-400 font-medium">Gestão Financeira</p>
          </div>
          
          <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-slate-800/40 rounded-full border border-slate-700/50 text-[11px] font-medium text-slate-300">
            {syncStatus === 'syncing' && (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                <span className="text-emerald-400" title="Tudo certo! Os dados estão no PocketBase sincronizados em tempo real.">Sincronizado</span>
              </>
            )}
            {syncStatus === 'local' && (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></div>
                <span className="text-amber-400" title="Modo local ativo.">Modo Local</span>
              </>
            )}
            {syncStatus === 'error' && (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
                <span className="text-red-400" title="Verifique a conexão com o PocketBase no Coolify.">Erro de Conexão</span>
              </>
            )}
          </div>
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
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
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
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all"
              >
                <LogOut size={20} />
                Voltar para Login
              </button>
            </div>
          </>
        )}
      </nav>

      {/* Main Content */}
      <main className="pb-24 pt-4 px-2 sm:px-4 md:pl-72 md:pr-8 md:pt-12 max-w-7xl mx-auto w-full relative z-10 overflow-x-hidden">
        {activeTab === 'inicio' && (
          <Dashboard 
            totalSpent={totalSpent} 
            totalDonations={totalDonations}
            categoryTotals={categoryTotals} 
            cardInstallments={cardInstallmentsByMonth} 
            allCardInstallments={allCardInstallmentsByMonth}
            caixaBalance={caixaBalance}
            terrenoBalance={terrenoBalance}
            formatCurrency={formatCurrency} 
            onRefresh={fetchAllData}
            syncStatus={syncStatus}
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
            allCardInstallments={allCardInstallmentsByMonth}
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
        {activeTab === 'config' && <ConfigTab state={state} />}
        {activeTab === 'sobre' && <PlaceholderTab title="Sobre o Sistema" />}
      </main>
      <Toaster position="top-center" richColors />
      <ConfirmDialog 
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText={confirmDialog.confirmText}
        confirmStyle={confirmDialog.confirmStyle}
      />
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center text-slate-400 ring-1 ring-slate-700/50">
        <Settings size={40} />
      </div>
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="text-slate-400 max-w-md">Esta aba está em desenvolvimento e será implementada em breve.</p>
    </div>
  );
}
