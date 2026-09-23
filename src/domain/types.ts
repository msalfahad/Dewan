export type TransactionType = 'inflow' | 'outflow';

export type PaymentMethod = 'cash' | 'cheque' | 'paymentLink' | 'bankTransfer' | 'card';

export const INFLOW_PAYMENT_METHODS: PaymentMethod[] = ['cash', 'cheque', 'paymentLink'];
export const OUTFLOW_PAYMENT_METHODS: PaymentMethod[] = ['cash', 'cheque', 'paymentLink', 'bankTransfer', 'card'];

/** Stored status. "overdue" is derived from a "due" record whose date has passed. */
export type StoredStatus = 'received' | 'pending' | 'paid' | 'due';
export type EffectiveStatus = StoredStatus | 'overdue';

/** Which add-record tab created the record (salary, maintenance, groceries or a custom type). */
export type RecordKind = 'salary' | 'maintenance' | 'groceries' | 'family' | 'general';

export interface Transaction {
  id: string;
  userId: string;
  transactionType: TransactionType;
  /** ISO date YYYY-MM-DD. For a due record this is the due date; once paid it is the actual payment date. */
  date: string;
  /** Original due date, kept after a due record is paid. */
  dueDate?: string;
  description: string;
  descriptionAr?: string;
  descriptionEn?: string;
  categoryId: string;
  categoryNameAr: string;
  categoryNameEn: string;
  amountFils: number;
  paymentMethod: PaymentMethod | null;
  /** Paid to (outflow) or received from (inflow): person, company or shop. */
  counterparty: string;
  status: StoredStatus;
  notes: string;
  createdAt: number;
  updatedAt: number;
  recordKind?: RecordKind;
  /** Salary month (YYYY-MM) for salary records. */
  salaryMonth?: string;
  recurringId?: string;
  recurringMonth?: string;
}

export interface Category {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: string;
  order: number;
  kind: TransactionType;
  archived: boolean;
  isDefault: boolean;
  /** Links the category to one of the legacy add-record tabs. */
  recordKind?: RecordKind;
}

export interface OpeningBalance {
  amountFils: number;
  /** ISO date YYYY-MM-DD */
  date: string;
  description: string;
}

export interface RecurringExpense {
  id: string;
  description: string;
  descriptionEn?: string;
  categoryId: string;
  amountFils: number;
  /** Day of month the expense becomes due (1–28). */
  dayOfMonth: number;
  counterparty: string;
  paymentMethod: PaymentMethod | null;
  active: boolean;
  createdAt: number;
}

export interface AppData {
  transactions: Transaction[];
  categories: Category[];
  recurring: RecurringExpense[];
  openingBalance: OpeningBalance | null;
}
