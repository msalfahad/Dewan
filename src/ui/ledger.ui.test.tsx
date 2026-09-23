import { act, render, screen, within, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDataProvider } from '../data/AppDataProvider';
import { LocalRepository } from '../data/localRepository';
import { I18nProvider } from '../i18n/I18nProvider';
import { coffeeBeans, OPENING_1000 } from '../test/fixtures';
import { LedgerList, LedgerTable } from './screens/LedgerViews';
import { useAppData } from '../data/AppDataProvider';
import { Stat } from './components/common';
import type { Lang } from '../config/app';

afterEach(cleanup);

function repoWithCoffee() {
  const repo = new LocalRepository('u1', null);
  void repo.replaceAll({ transactions: [coffeeBeans()], categories: [], recurring: [], openingBalance: OPENING_1000 });
  return repo;
}

function Views() {
  const { ledger } = useAppData();
  return (
    <>
      <LedgerTable rows={ledger.rows} onOpen={() => undefined} />
      <div data-testid="list">
        <LedgerList rows={ledger.rows} onOpen={() => undefined} />
      </div>
      <Stat label="current" fils={ledger.summary.currentBalanceFils} testId="kpi-current" />
    </>
  );
}

function renderApp(lang: Lang) {
  return render(
    <I18nProvider initialLang={lang}>
      <AppDataProvider repo={repoWithCoffee()} today="2026-09-23">
        <Views />
      </AppDataProvider>
    </I18nProvider>,
  );
}

describe('MANDATORY UI: the Coffee beans row displays a balance of 950.000 KWD', () => {
  it('English table row: 05/09/2026 | Coffee beans | Groceries | — | 50.000 | 950.000', async () => {
    await act(async () => renderApp('en'));
    const row = screen.getByTestId('ledger-row-coffee');
    const cells = within(row).getAllByRole('cell').map((c) => c.textContent?.trim());
    expect(cells[0]).toBe('05/09/2026');
    expect(cells[1]).toBe('Coffee beans');
    expect(cells[2]).toContain('Groceries');
    expect(cells[5]).toBe('—');
    expect(cells[6]).toBe('50.000');
    expect(within(row).getByTestId('row-balance').textContent).toBe('950.000');
    expect(screen.getByTestId('list').textContent).toContain('KWD 950.000');
    expect(screen.getByTestId('kpi-current').textContent).toBe('KWD 950.000');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('Arabic table row: 05/09/2026 | حبوب قهوة | مشتريات | — | 50.000 | 950.000', async () => {
    await act(async () => renderApp('ar'));
    const row = screen.getByTestId('ledger-row-coffee');
    const cells = within(row).getAllByRole('cell').map((c) => c.textContent?.trim());
    expect(cells[1]).toBe('حبوب قهوة');
    expect(cells[2]).toContain('مشتريات');
    expect(within(row).getByTestId('row-balance').textContent).toBe('950.000');
    expect(screen.getByTestId('list').textContent).toContain('950.000 د.ك');
    expect(screen.getByTestId('kpi-current').textContent).toBe('950.000 د.ك');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['التاريخ', 'البيان', 'التصنيف', 'من / لمن', 'طريقة الدفع', 'الوارد', 'الصادر', 'الرصيد']);
  });

  it('recalculates the displayed balance after deleting an earlier transaction', async () => {
    const repo = repoWithCoffee();
    await act(async () =>
      render(
        <I18nProvider initialLang="en">
          <AppDataProvider repo={repo} today="2026-09-23">
            <Views />
          </AppDataProvider>
        </I18nProvider>,
      ),
    );
    expect(screen.getByTestId('kpi-current').textContent).toBe('KWD 950.000');
    await act(async () => repo.deleteTransaction('coffee'));
    expect(screen.getByTestId('kpi-current').textContent).toBe('KWD 1,000.000');
  });
});
