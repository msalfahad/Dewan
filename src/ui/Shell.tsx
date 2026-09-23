import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppData } from '../data/AppDataProvider';
import { monthKeyOf } from '../domain/dates';
import { demoData } from '../domain/demo';
import { EMPTY_FILTER, type LedgerFilter } from '../domain/filters';
import type { LedgerRow } from '../domain/ledger';
import type { Transaction, TransactionType } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { Icon } from './components/Icon';
import { LanguageSwitcher } from './components/common';
import { CategoriesScreen } from './screens/CategoriesScreen';
import { Dashboard } from './screens/Dashboard';
import { LedgerScreen } from './screens/LedgerScreen';
import { RecurringScreen } from './screens/RecurringScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TransactionDetail, type DetailMode } from './screens/TransactionDetail';
import { RowActionsContext, type RowActionHandlers } from './components/RowActions';
import { TransactionForm } from './screens/TransactionForm';
import { TypeScreen } from './screens/TypeScreen';

type Tab = 'home' | 'ledger' | 'family' | 'expenses' | 'reports' | 'settings';
type SettingsPage = 'main' | 'categories' | 'recurring';

const TITLE_KEY: Record<Tab, string> = {
  home: 'app.name',
  ledger: 'ledger.title',
  family: 'family.title',
  expenses: 'expenses.title',
  reports: 'reports.screenTitle',
  settings: 'settings.title',
};

/** Header month dropdown ("سبتمبر 2026 ⌄") backed by a native month picker. */
function MonthDrop({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const { t, month: label } = useI18n();
  return (
    <label className="month-drop">
      <span>{label(month)}</span>
      <Icon name="chevronDown" size={16} />
      <input type="month" aria-label={t('filters.months')} value={month} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  );
}

export function Shell({ account, onSignOut }: { account: string | null; onSignOut: () => void }) {
  const { t } = useI18n();
  const { ledger, repo, today, ready } = useAppData();
  const [tab, setTab] = useState<Tab>('home');
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('main');
  const [month, setMonth] = useState(monthKeyOf(today));
  const [filter, setFilter] = useState<LedgerFilter>(EMPTY_FILTER);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openMode, setOpenMode] = useState<DetailMode>('view');
  const [editing, setEditing] = useState<{ tx?: Transaction; type: TransactionType } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  // Resolve the open row from the live ledger so its balance updates after edits.
  const openRow = openKey ? (ledger.rows.find((r) => r.key === openKey) ?? null) : null;
  const open = useCallback((r: LedgerRow) => {
    setOpenMode('view');
    setOpenKey(r.key);
  }, []);
  // ✏️ / 🗑 on every row: edit opens the form (the opening balance edits in its sheet);
  // delete opens the record with the in-app confirmation already showing.
  const rowActions = useMemo<RowActionHandlers>(
    () => ({
      edit: (r) => {
        if (r.transaction) setEditing({ tx: r.transaction, type: r.transaction.transactionType });
        else {
          setOpenMode('edit');
          setOpenKey(r.key);
        }
      },
      remove: (r) => {
        setOpenMode('delete');
        setOpenKey(r.key);
      },
    }),
    [],
  );

  const go = (next: Tab) => {
    setTab(next);
    if (next === 'settings') setSettingsPage('main');
    window.scrollTo({ top: 0 });
  };

  const nav: { id: Tab; icon: string; label: string }[] = [
    { id: 'home', icon: 'home', label: t('nav.dashboard') },
    { id: 'ledger', icon: 'ledger', label: t('nav.ledger') },
    { id: 'family', icon: 'users', label: t('nav.family') },
    { id: 'expenses', icon: 'card', label: t('nav.expenses') },
    { id: 'reports', icon: 'bars', label: t('nav.reports') },
  ];
  const showMonth = tab === 'home' || tab === 'family' || tab === 'expenses';
  const addType: TransactionType = tab === 'family' ? 'inflow' : 'outflow';

  return (
    <RowActionsContext.Provider value={rowActions}>
      <div className="app">
        {/* Laptop / desktop: sidebar navigation (hidden on phones, which use the bottom bar). */}
        <aside className="sidebar no-print" aria-label={t('app.name')}>
          <div className="side-brand">
            <span className="logo">
              <Icon name="diwan" size={26} />
            </span>
            <span>
              <b>{t('app.name')}</b>
              <small>{t('app.tagline')}</small>
            </span>
          </div>
          <button type="button" className="btn primary side-add" onClick={() => setEditing({ type: addType })}>
            <Icon name="plusCircle" size={20} /> {t('home.addTransaction')}
          </button>
          <nav className="side-nav">
            {[...nav, { id: 'settings' as Tab, icon: 'settings', label: t('nav.settings') }].map((n) => (
              <button key={n.id} type="button" aria-current={tab === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
                <Icon name={n.icon} size={20} />
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="side-foot">
            <LanguageSwitcher />
            {account && <small className="muted">{account}</small>}
          </div>
        </aside>

        <header className="topbar no-print">
          <button type="button" className="icon-plain" onClick={() => go('home')} aria-label={t('nav.dashboard')}>
            <Icon name="home" size={24} />
          </button>
          <div className="title">
            <h1>{t(TITLE_KEY[tab])}</h1>
            {showMonth && <MonthDrop month={month} onChange={setMonth} />}
          </div>
          <button type="button" className="icon-plain end" onClick={() => go('settings')} aria-label={t('nav.settings')} aria-current={tab === 'settings' ? 'page' : undefined}>
            <Icon name="settings" size={22} />
          </button>
        </header>

        {!ready ? (
          <p className="muted">{t('common.loading')}</p>
        ) : (
          <main>
            {tab === 'home' && (
              <Dashboard
                month={month}
                onOpen={open}
                onAdd={() => setEditing({ type: 'outflow' })}
                onViewLedger={() => go('ledger')}
                onLoadDemo={() => void repo.replaceAll(demoData(repo.userId))}
              />
            )}
            {tab === 'ledger' && <LedgerScreen filter={filter} onFilter={setFilter} onOpen={open} onAdd={() => setEditing({ type: 'outflow' })} />}
            {tab === 'family' && <TypeScreen type="inflow" month={month} onOpen={open} onAdd={() => setEditing({ type: 'inflow' })} />}
            {tab === 'expenses' && <TypeScreen type="outflow" month={month} onOpen={open} onAdd={() => setEditing({ type: 'outflow' })} />}
            {tab === 'reports' && <ReportsScreen initialMonth={month} />}
            {tab === 'settings' && settingsPage === 'main' && (
              <SettingsScreen
                account={account}
                onSignOut={onSignOut}
                onOpenCategories={() => setSettingsPage('categories')}
                onOpenRecurring={() => setSettingsPage('recurring')}
                onToast={setToast}
              />
            )}
            {tab === 'settings' && settingsPage === 'categories' && <CategoriesScreen onBack={() => setSettingsPage('main')} />}
            {tab === 'settings' && settingsPage === 'recurring' && <RecurringScreen month={month} onBack={() => setSettingsPage('main')} onToast={setToast} />}
          </main>
        )}

        <nav className="bottom-nav no-print" aria-label={t('app.name')}>
          <div className="inner">
            {nav.map((n) => (
              <button key={n.id} type="button" aria-current={tab === n.id ? 'page' : undefined} onClick={() => go(n.id)}>
                <Icon name={n.icon} />
                {n.label}
              </button>
            ))}
          </div>
        </nav>

        {openRow && !editing && (
          <TransactionDetail
            key={`${openRow.key}-${openMode}`}
            mode={openMode}
            row={openRow}
            onClose={() => setOpenKey(null)}
            onEdit={() => openRow.transaction && setEditing({ tx: openRow.transaction, type: openRow.transaction.transactionType })}
            onToast={setToast}
          />
        )}
        {editing && (
          <TransactionForm
            existing={editing.tx}
            initialType={editing.type}
            onClose={() => {
              setEditing(null);
              setOpenKey(null);
            }}
            onSaved={setToast}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </RowActionsContext.Provider>
  );
}
