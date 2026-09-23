import { useState, type FormEvent } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { filsToInput, parseKwdToFils } from '../../domain/money';
import { useI18n } from '../../i18n/I18nProvider';

/** الرصيد الافتتاحي / Opening Balance: amount, effective date, optional description. */
export function OpeningBalanceForm({ onSaved }: { onSaved: (msg: string) => void }) {
  const { t } = useI18n();
  const { repo, openingBalance, today } = useAppData();
  const [amount, setAmount] = useState(openingBalance ? filsToInput(openingBalance.amountFils) : '');
  const [date, setDate] = useState(openingBalance?.date ?? today);
  const [description, setDescription] = useState(openingBalance?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const fils = parseKwdToFils(amount);
    if (fils === null) return setError(t('add.errors.amount'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError(t('add.errors.date'));
    setError(null);
    await repo.saveOpeningBalance({ amountFils: fils, date, description: description.trim() });
    onSaved(t('common.saved'));
  };

  return (
    <form className="card stack" onSubmit={save}>
      <h3>{t('opening.title')}</h3>
      <p className="muted" style={{ margin: 0 }}>
        {t('opening.hint')}
      </p>
      {!openingBalance && <div className="warning">{t('opening.notSet')}</div>}
      <div className="form-grid">
        <label className="field">
          <span>{t('opening.amount')}</span>
          <input className="amount-input" inputMode="decimal" placeholder="0.000" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('opening.date')}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>{t('opening.description')}</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {error && <div className="warning">{error}</div>}
      <div>
        <button type="submit" className="btn primary">
          {t('common.save')}
        </button>
      </div>
    </form>
  );
}
