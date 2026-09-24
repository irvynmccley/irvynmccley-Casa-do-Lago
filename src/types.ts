export type Category = 'Combustível' | 'Documentação' | 'Material' | 'Mão de Obra' | 'Monitoramento' | 'Alimentação';
export type PaymentMethod = 'Pix' | 'Cartão' | 'doação' | 'Caixa';
export type Donor = 'Jorge' | 'Jane' | 'Saulo' | 'Mccley' | 'Jan';
export type Person = 'Mccley' | 'Jan' | 'Saulo' | 'Jorge';

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

export interface AppState {
  expenses: Expense[];
  incomes: Income[];
  payments: Payment[];
  terrenoPaidInstallments: string[];
}
