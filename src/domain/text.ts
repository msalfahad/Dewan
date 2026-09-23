import type { Lang } from '../config/app';
import { categoryName } from './categories';
import type { Category, Transaction } from './types';

/** Description in the requested language, falling back to whatever was entered. */
export function describe(tx: Pick<Transaction, 'description' | 'descriptionAr' | 'descriptionEn'>, lang: Lang): string {
  const ar = tx.descriptionAr?.trim();
  const en = tx.descriptionEn?.trim();
  const base = tx.description.trim();
  return lang === 'ar' ? ar || base || en || '' : en || base || ar || '';
}

/** Both languages when they differ: ["حبوب قهوة", "Coffee beans"]. */
export function describeBilingual(tx: Pick<Transaction, 'description' | 'descriptionAr' | 'descriptionEn'>): string[] {
  const ar = describe(tx, 'ar');
  const en = describe(tx, 'en');
  return ar === en ? [ar] : [ar, en];
}

/** Category name for a transaction, preferring the live category (so renames apply everywhere). */
export function txCategory(
  tx: Pick<Transaction, 'categoryId' | 'categoryNameAr' | 'categoryNameEn'>,
  categoriesById: ReadonlyMap<string, Category>,
): Pick<Category, 'nameAr' | 'nameEn'> & { icon: string } {
  const live = categoriesById.get(tx.categoryId);
  if (live) return live;
  return { nameAr: tx.categoryNameAr, nameEn: tx.categoryNameEn, icon: '•' };
}

export function txCategoryName(
  tx: Pick<Transaction, 'categoryId' | 'categoryNameAr' | 'categoryNameEn'>,
  categoriesById: ReadonlyMap<string, Category>,
  lang: Lang,
): string {
  return categoryName(txCategory(tx, categoriesById), lang);
}

export function indexCategories(list: readonly Category[]): Map<string, Category> {
  return new Map(list.map((c) => [c.id, c]));
}
