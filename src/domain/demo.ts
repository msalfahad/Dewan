/**
 * Demo data. The first rows reproduce the required example exactly:
 * opening balance 1,000.000 KWD → Coffee beans (Groceries) outflow 50.000 → balance 950.000,
 * then family payment +200.000 → 1,150.000, then AC maintenance −100.000 → 1,050.000.
 */
import { DEFAULT_CATEGORIES } from './categories';
import type { AppData, Category, PaymentMethod, RecurringExpense, StoredStatus, Transaction, TransactionType } from './types';

const cat = (id: string): Category => DEFAULT_CATEGORIES.find((c) => c.id === id)!;

let seq = 0;
function tx(
  id: string,
  type: TransactionType,
  date: string,
  descriptionAr: string,
  descriptionEn: string,
  categoryId: string,
  amountFils: number,
  counterparty: string,
  paymentMethod: PaymentMethod | null,
  status: StoredStatus,
  userId: string,
): Transaction {
  const c = cat(categoryId);
  const createdAt = Date.UTC(2026, 8, 1) + seq++ * 1000;
  return {
    id,
    userId,
    transactionType: type,
    date,
    ...(status === 'due' ? { dueDate: date } : {}),
    description: descriptionAr,
    descriptionAr,
    descriptionEn,
    categoryId: c.id,
    categoryNameAr: c.nameAr,
    categoryNameEn: c.nameEn,
    amountFils,
    paymentMethod,
    counterparty,
    status,
    notes: '',
    createdAt,
    updatedAt: createdAt,
    recordKind: c.recordKind ?? 'general',
  };
}

export const DEMO_OPENING = { amountFils: 1_000_000, date: '2026-09-01', description: 'رصيد افتتاحي' };

export function demoData(userId: string): AppData {
  seq = 0;
  const transactions: Transaction[] = [
    tx('demo-01', 'outflow', '2026-09-05', 'حبوب قهوة', 'Coffee beans', 'out-groceries', 50_000, 'محمصة القهوة', 'cash', 'paid', userId),
    tx('demo-02', 'inflow', '2026-09-07', 'دفعة من العائلة', 'Family payment', 'in-family', 200_000, 'أبو محمد', 'cash', 'received', userId),
    tx('demo-03', 'outflow', '2026-09-10', 'صيانة التكييف', 'AC maintenance', 'out-maintenance', 100_000, 'شركة التبريد', 'paymentLink', 'paid', userId),
    tx('demo-04', 'outflow', '2026-09-12', 'شاي وماء', 'Tea and water', 'out-supplies', 6_085, 'الجمعية التعاونية', 'card', 'paid', userId),
    tx('demo-05', 'inflow', '2026-09-15', 'تحويل من الأخ', 'Transfer from brother', 'in-topup', 150_000, 'أبو خالد', 'paymentLink', 'received', userId),
    tx('demo-06', 'outflow', '2026-09-20', 'اشتراك الإنترنت', 'Internet subscription', 'out-subscriptions', 18_500, 'زين', 'paymentLink', 'paid', userId),
    tx('demo-07', 'inflow', '2026-09-25', 'دفعة من العائلة', 'Family payment', 'in-family', 100_000, 'أبو سالم', 'cheque', 'pending', userId),
    tx('demo-08', 'outflow', '2026-09-30', 'راتب العامل لشهر سبتمبر', 'Worker salary for September', 'out-salaries', 120_000, 'راجو', 'cash', 'due', userId),
    tx('demo-09', 'outflow', '2026-10-03', 'تجديد إقامة العامل', 'Worker residency renewal', 'out-residency', 60_000, 'وزارة الداخلية', null, 'due', userId),
  ];
  transactions[7].salaryMonth = '2026-09';
  const recurring: RecurringExpense[] = [
    { id: 'rec-salary', description: 'راتب العامل', descriptionEn: 'Worker salary', categoryId: 'out-salaries', amountFils: 120_000, dayOfMonth: 28, counterparty: 'راجو', paymentMethod: 'cash', active: true, createdAt: Date.UTC(2026, 8, 1) },
    { id: 'rec-internet', description: 'اشتراك الإنترنت', descriptionEn: 'Internet subscription', categoryId: 'out-subscriptions', amountFils: 18_500, dayOfMonth: 20, counterparty: 'زين', paymentMethod: 'paymentLink', active: true, createdAt: Date.UTC(2026, 8, 1) },
  ];
  return { transactions, categories: [], recurring, openingBalance: { ...DEMO_OPENING } };
}
