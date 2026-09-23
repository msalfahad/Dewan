import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppDataProvider } from '../data/AppDataProvider';
import { LocalRepository } from '../data/localRepository';
import { I18nProvider } from '../i18n/I18nProvider';
import { TransactionForm } from './screens/TransactionForm';

afterEach(cleanup);

describe('saving an inflow never hangs', () => {
  it('closes the form immediately even if the server has not confirmed yet', async () => {
    const repo = new LocalRepository('u1', null);
    // Simulate a slow / stalled connection: the server never confirms the write.
    vi.spyOn(repo, 'saveTransaction').mockReturnValue(new Promise<void>(() => undefined));
    const onClose = vi.fn();
    const onSaved = vi.fn();
    await act(async () =>
      render(
        <I18nProvider initialLang="ar">
          <AppDataProvider repo={repo} today="2026-09-24">
            <TransactionForm initialType="inflow" onClose={onClose} onSaved={onSaved} />
          </AppDataProvider>
        </I18nProvider>,
      ),
    );
    fireEvent.change(screen.getByPlaceholderText('0.000'), { target: { value: '200' } });
    fireEvent.change(screen.getByLabelText('البيان'), { target: { value: 'دفعة من أبو محمد' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /حفظ/ })));
    expect(repo.saveTransaction).toHaveBeenCalledWith(expect.objectContaining({ transactionType: 'inflow', amountFils: 200_000, status: 'received' }));
    expect(onClose).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith('تم الحفظ');
  });
});
