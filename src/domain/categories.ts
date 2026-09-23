import type { Lang } from '../config/app';
import type { Category, TransactionType } from './types';

/** Default categories. Custom categories are stored alongside and may override these by id. */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'in-family', nameAr: 'دفعة من العائلة', nameEn: 'Family Contribution', icon: '👪', order: 1, kind: 'inflow', archived: false, isDefault: true, recordKind: 'family' },
  { id: 'in-topup', nameAr: 'تعزيز رصيد', nameEn: 'Balance Top-Up', icon: '⬆', order: 2, kind: 'inflow', archived: false, isDefault: true },
  { id: 'in-refund', nameAr: 'استرداد مبلغ', nameEn: 'Refund', icon: '↩', order: 3, kind: 'inflow', archived: false, isDefault: true },
  { id: 'in-other', nameAr: 'وارد آخر', nameEn: 'Other Inflow', icon: '＋', order: 4, kind: 'inflow', archived: false, isDefault: true },
  { id: 'out-salaries', nameAr: 'رواتب', nameEn: 'Salaries', icon: '👤', order: 1, kind: 'outflow', archived: false, isDefault: true, recordKind: 'salary' },
  { id: 'out-maintenance', nameAr: 'صيانة', nameEn: 'Maintenance', icon: '🛠', order: 2, kind: 'outflow', archived: false, isDefault: true, recordKind: 'maintenance' },
  { id: 'out-groceries', nameAr: 'مشتريات', nameEn: 'Groceries', icon: '🛒', order: 3, kind: 'outflow', archived: false, isDefault: true, recordKind: 'groceries' },
  { id: 'out-supplies', nameAr: 'أغراض الديوان', nameEn: 'Diwaniya Supplies', icon: '☕', order: 4, kind: 'outflow', archived: false, isDefault: true },
  { id: 'out-subscriptions', nameAr: 'اشتراكات', nameEn: 'Subscriptions', icon: '📺', order: 5, kind: 'outflow', archived: false, isDefault: true },
  { id: 'out-residency', nameAr: 'إقامة العمال', nameEn: 'Worker Residency', icon: '🪪', order: 6, kind: 'outflow', archived: false, isDefault: true },
  { id: 'out-services', nameAr: 'خدمات', nameEn: 'Services', icon: '💡', order: 7, kind: 'outflow', archived: false, isDefault: true },
  { id: 'out-other', nameAr: 'أخرى', nameEn: 'Other', icon: '•', order: 8, kind: 'outflow', archived: false, isDefault: true },
];

/** Merges stored categories over the defaults (stored wins by id) and sorts by kind then order. */
export function mergeCategories(stored: readonly Category[]): Category[] {
  const byId = new Map<string, Category>();
  for (const c of DEFAULT_CATEGORIES) byId.set(c.id, c);
  for (const c of stored) byId.set(c.id, { ...byId.get(c.id), ...c });
  return sortCategories([...byId.values()]);
}

export function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) =>
    a.kind !== b.kind ? (a.kind === 'inflow' ? -1 : 1) : a.order - b.order || a.id.localeCompare(b.id),
  );
}

export function categoriesOfKind(list: readonly Category[], kind: TransactionType, includeArchived = false): Category[] {
  return list.filter((c) => c.kind === kind && (includeArchived || !c.archived));
}

/**
 * Display name in the active language. If the English name is missing, the entered
 * (Arabic) name is shown in both modes until it is translated, and vice versa.
 */
export function categoryName(c: Pick<Category, 'nameAr' | 'nameEn'>, lang: Lang): string {
  const ar = c.nameAr.trim();
  const en = c.nameEn.trim();
  return lang === 'en' ? en || ar : ar || en;
}

/** "مشتريات / Groceries" (collapses to one name when both are equal or one is missing). */
export function categoryNameBilingual(c: Pick<Category, 'nameAr' | 'nameEn'>): string {
  const ar = categoryName(c, 'ar');
  const en = categoryName(c, 'en');
  return ar === en ? ar : `${ar} / ${en}`;
}
