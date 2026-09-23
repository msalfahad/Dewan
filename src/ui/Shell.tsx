import { useCallback, useEffect, useState } from 'react';
import { useAppData } from '../data/AppDataProvider';
import { monthKeyOf } from '../domain/dates';
import { demoData } from '../domain/demo';
import { EMPTY_FILTER, type LedgerFilter } from '../domain/filters';
import type { LedgerRow } from '../domain/ledger';
import type { Transaction } from '../domain/types';
import { useI18n } from '../i18n/I18nProvider';
import { LanguageSwitcher } from './components/common';
import { Icon } from './components/Icon';
import { MonthSelector } from './components/MonthSelector';
import { AnalysisScreen } from './screens/AnalysisScreen';
import { CategoriesScreen } from './screens/CategoriesScreen';
import { Dashboard } from './screens/Dashboard';
import { LedgerScreen } from './screens/LedgerScreen';
import { RecurringScreen } from './screens/RecurringScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TransactionDetail } from './screens/TransactionDetail';
import { TransactionForm } from './screens/TransactionForm';

type Tab = 'dashboard' | 'ledger' | 'analysis' | 'reports' | 'settings';
type SettingsPage = 'main' | 'categories' | 'recurring';

export function Shell({ account, onSignOut }: { account: string | null; onSignOut: () => void }) {
  const { t } = useI18n();
  const { ledger, repo, today, ready } = useAppData();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [settingsPage, setSettingsPage] = useState<SettingsPage>('main');
  const [month, setMonth] = useState(monthKeyOf(today));
  const [filter, setFilter] = useState<LedgerFilter>(EMPTY_FILTER);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | 'new' | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(id);
  }, [toast]);

  // Resolve the open row from the live ledger so its balance updates after edits.
  const openRow = openKey ? (ledger.rows.find((r) => r.key === openKey) ?? null) : null;
  const open = useCallback((r: LedgerRow) => setOpenKey(r.key), []);

  const go = (next: Tab) => {
    setTab(next);
    if (next === 'settings') setSettingsPage('main');
    window.scrollTo({ top: 0 });
  };

  const nav: { id: Tab | 'add'; icon: string; label: string }[] = [
    { id: 'dashboard', icon: 'home', label: t('nav.dashboard') },
    { id: 'ledger', icon: 'ledger', label: t('nav.ledger') },
    { id: 'add', icon: 'plus', label: t('nav.add') },
    { id: 'analysis', icon: 'chart', label: t('nav.analysis') },
    { id: 'reports', icon: 'report', label: t('nav.reports') },
    { id: 'settings', icon: 'settings', label: t('nav.settings') },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="./icons/icon.svg" alt="" />
          <div style={{ minWidth: 0 }}>
            <h1>{t('app.name')}</h1>
            <small>{t('app.tagline')}</small>
          </div>
        </div>
        {(tab === 'dashboard' || tab === 'analysis' || tab === 'reports') && (
          <div className="no-print show-desktop">
            <MonthSelector month={month} onChange={setMonth} />
          </div>
        )}
        <div className="no-print">
          <LanguageSwitcher compact />
        </div>
      </header>

      {(tab === 'dashboard' || tab === 'analysis' || tab === 'reports') && (
        <div className="show-mobile no-print" style={{ marginBottom: 12 }}>
          <MonthSelector month={month} onChange={setMonth} />
        </div>
      )}

      {!ready ? (
        <p className="muted">{t('common.loading')}</p>
      ) : (
        <main>
          {tab === 'dashboard' && (
            <Dashboard
              month={month}
              onOpen={open}
              onAdd={() => setEditing('new')}
              onViewLedger={() => go('ledger')}
              onLoadDemo={() => void repo.replaceAll(demoData(repo.userId))}
            />
          )}
          {tab === 'ledger' && <LedgerScreen filter={filter} onFilter={setFilter} onOpen={open} />}
          {tab === 'analysis' && <AnalysisScreen key={month} initialMonth={month} />}
          {tab === 'reports' && <ReportsScreen key={month} initialMonth={month} />}
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
          {nav.map((n) =>
            n.id === 'add' ? (
              <button key={n.id} type="button" className="add-btn" onClick={() => setEditing('new')}>
                <span className="circle">
                  <Icon name="plus" />
                </span>
                {n.label}
              </button>
            ) : (
              <button key={n.id} type="button" aria-current={tab === n.id ? 'page' : undefined} onClick={() => go(n.id as Tab)}>
                <Icon name={n.icon} />
                {n.label}
              </button>
            ),
          )}
        </div>
      </nav>

      {openRow && !editing && (
        <TransactionDetail
          row={openRow}
          onClose={() => setOpenKey(null)}
          onEdit={() => openRow.transaction && setEditing(openRow.transaction)}
          onToast={setToast}
        />
      )}
      {editing && (
        <TransactionForm
          existing={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={setToast}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
