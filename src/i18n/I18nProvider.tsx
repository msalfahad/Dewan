import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { appName, type Lang } from '../config/app';
import { formatMoney } from '../domain/money';
import { dirOf, formatLongDate, monthLabel, translate } from './translate';

const STORAGE_KEY = 'diwaniya.lang';

export interface I18n {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  isRtl: boolean;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  money: (fils: number) => string;
  month: (monthKey: string) => string;
  longDate: (iso: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

export function I18nProvider({ children, initialLang }: { children: ReactNode; initialLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => initialLang ?? readStoredLang());

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable: keep in memory */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dirOf(lang);
    document.title = appName(lang);
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({
      lang,
      dir: dirOf(lang),
      isRtl: lang === 'ar',
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      money: (fils) => formatMoney(fils, lang),
      month: (m) => monthLabel(lang, m),
      longDate: (iso) => formatLongDate(lang, iso),
    }),
    [lang, setLang],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
