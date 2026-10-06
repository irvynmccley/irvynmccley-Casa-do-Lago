export type Category = string;
export type PaymentMethod = 'Pix' | 'Cartão' | 'doação' | 'Caixa';
export type Donor = 'Jorge' | 'Jane' | 'Saulo' | 'Mccley' | 'Jan';
export type Person = 'Mccley' | 'Jan' | 'Saulo' | 'Jorge';
export type RefundStatus = 'Pendente' | 'Devolvido';

export interface Expense {
  id: string;
  date: string;
  category: Category;
  local: string;
  value: number;
  paymentMethod: PaymentMethod;
  installments?: number;
  donor?: Donor;
  observation?: string;
  auditId?: string;
  original_id?: string;
  isReimbursement?: boolean;
  reimburseTo?: Person;
  refundStatus?: RefundStatus;
  status?: string;
}

export interface Income {
  id: string;
  date: string;
  value: number;
  description: string;
  isCaixa?: boolean;
  auditId?: string;
}

export interface Payment {
  id: string;
  date: string;
  value: number;
  person: Person;
  auditId?: string;
}

export interface TerrenoInstallmentRecord {
  id: string;
  month_id: string; // e.g., '2024-02'
  original_id?: string;
  receipt_url?: string;
  receipt_name?: string;
  notes?: string;
  paid_at?: string;
}

export interface AppState {
  expenses: Expense[];
  incomes: Income[];
  payments: Payment[];
  terrenoPaidInstallments: string[];
  terrenoInstallmentsData?: Record<string, TerrenoInstallmentRecord>;
}
