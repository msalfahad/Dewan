import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppDataProvider, useAppData } from '../data/AppDataProvider';
import { LocalRepository } from '../data/localRepository';
import { I18nProvider } from '../i18n/I18nProvider';
import { coffeeBeans, OPENING_1000 } from '../test/fixtures';
import { TransactionDetail } from './screens/TransactionDetail';
import { SettingsScreen } from './screens/SettingsScreen';

afterEach(cleanup);

function seeded() {
  const repo = new LocalRepository('u1', null);
  void repo.replaceAll({ transactions: [coffeeBeans()], categories: [], recurring: [], openingBalance: OPENING_1000 });
  return repo;
}

function Detail({ onClose }: { onClose: () => void }) {
  const { ledger } = useAppData();
  const row = ledger.rows.find((r) => r.key === 'coffee');
  return row ? <TransactionDetail row={row} onClose={onClose} onEdit={() => undefined} onToast={() => undefined} /> : <p>gone</p>;
}

describe('deleting works without window.confirm (blocked on some iPhones)', () => {
  it('deletes a transaction through the in-app confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const repo = seeded();
    const onClose = vi.fn();
    await act(async () =>
      render(
        <I18nProvider initialLang="ar">
          <AppDataProvider repo={repo} today="2026-09-23">
            <Detail onClose={onClose} />
          </AppDataProvider>
        </I18nProvider>,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: /حذف/ }));
    const panel = screen.getByRole('alertdialog');
    await act(async () => fireEvent.click(within(panel).getByRole('button', { name: /حذف/ })));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('gone')).toBeTruthy();
    let tx: unknown[] = [];
    repo.subscribe((d) => (tx = d.transactions))();
    expect(tx).toHaveLength(0);
    confirmSpy.mockRestore();
  });

  it('clears all data from Settings through the in-app confirmation', async () => {
    const repo = seeded();
    await act(async () =>
      render(
        <I18nProvider initialLang="ar">
          <AppDataProvider repo={repo} today="2026-09-23">
            <SettingsScreen account={null} onSignOut={() => undefined} onOpenCategories={() => undefined} onOpenRecurring={() => undefined} onToast={() => undefined} />
          </AppDataProvider>
        </I18nProvider>,
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'حذف جميع البيانات' }));
    await act(async () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /تأكيد/ })));
    let state: { transactions: unknown[]; openingBalance: unknown } = { transactions: [1], openingBalance: 1 };
    repo.subscribe((d) => (state = d))();
    expect(state.transactions).toHaveLength(0);
    expect(state.openingBalance).toBeNull();
  });
});

describe('edit and delete buttons on every row', () => {
  it('shows تعديل / حذف on list rows and calls the handlers', async () => {
    const { LedgerList } = await import('./screens/LedgerViews');
    const { RowActionsContext } = await import('./components/RowActions');
    const repo = seeded();
    const edit = vi.fn();
    const remove = vi.fn();
    function List() {
      const { ledger } = useAppData();
      return <LedgerList rows={ledger.rows} onOpen={() => undefined} />;
    }
    await act(async () =>
      render(
        <I18nProvider initialLang="ar">
          <AppDataProvider repo={repo} today="2026-09-23">
            <RowActionsContext.Provider value={{ edit, remove }}>
              <List />
            </RowActionsContext.Provider>
          </AppDataProvider>
        </I18nProvider>,
      ),
    );
    // opening balance + coffee beans → two rows, each with edit and delete
    expect(screen.getAllByRole('button', { name: 'تعديل' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'حذف' })[1]);
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ key: 'coffee' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'تعديل' })[0]);
    expect(edit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'opening' }));
  });

  it('deletes the opening balance after confirmation', async () => {
    const repo = seeded();
    function OpeningDetail() {
      const { ledger } = useAppData();
      const row = ledger.rows.find((r) => r.kind === 'opening');
      return row ? <TransactionDetail row={row} mode="delete" onClose={() => undefined} onEdit={() => undefined} onToast={() => undefined} /> : <p>no opening</p>;
    }
    await act(async () =>
      render(
        <I18nProvider initialLang="ar">
          <AppDataProvider repo={repo} today="2026-09-23">
            <OpeningDetail />
          </AppDataProvider>
        </I18nProvider>,
      ),
    );
    await act(async () => fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /حذف/ })));
    expect(screen.getByText('no opening')).toBeTruthy();
  });
});
