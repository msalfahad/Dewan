import { useState, type FormEvent } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { categoriesOfKind, categoryName } from '../../domain/categories';
import { parseKwdToFils } from '../../domain/money';
import { generateRecurringForMonth } from '../../domain/recurring';
import { newId } from '../../domain/transactions';
import { OUTFLOW_PAYMENT_METHODS, type PaymentMethod } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { Money } from '../components/common';
import { Icon } from '../components/Icon';

/** Recurring expenses: templates that create due outflows for a chosen month. */
export function RecurringScreen({ month, onBack, onToast }: { month: string; onBack: () => void; onToast: (m: string) => void }) {
  const { t, lang, month: monthText } = useI18n();
  const { repo, recurring, categories, categoriesById, transactions } = useAppData();
  const outCats = categoriesOfKind(categories, 'outflow');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('out-salaries');
  const [day, setDay] = useState('1');
  const [counterparty, setCounterparty] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [error, setError] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const fils = parseKwdToFils(amount);
    if (fils === null || fils <= 0) return setError(t('add.errors.amount'));
    if (!description.trim()) return setError(t('add.errors.description'));
    setError(null);
    await repo.saveRecurring({
      id: newId('rec'),
      description: description.trim(),
      ...(lang === 'en' ? { descriptionEn: description.trim() } : {}),
      categoryId,
      amountFils: fils,
      dayOfMonth: Math.min(28, Math.max(1, Number.parseInt(day, 10) || 1)),
      counterparty: counterparty.trim(),
      paymentMethod: method,
      active: true,
      createdAt: Date.now(),
    });
    setDescription('');
    setAmount('');
    setCounterparty('');
  };

  const generate = async () => {
    const created = generateRecurringForMonth(recurring, month, transactions, categoriesById, repo.userId);
    if (created.length) await repo.saveTransactions(created);
    onToast(created.length ? t('recurring.generated', { count: created.length }) : t('recurring.nothing'));
  };

  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('common.back')}>
          <Icon name="prev" />
        </button>
        <h2 className="section-title" style={{ margin: 0 }}>{t('recurring.title')}</h2>
      </div>
      <div className="card stack">
        <button type="button" className="btn primary" onClick={() => void generate()}>
          <Icon name="repeat" size={18} /> {t('recurring.generate', { month: monthText(month) })}
        </button>
        {recurring.length === 0 && <p className="muted">{t('recurring.empty')}</p>}
        {recurring.map((r) => {
          const cat = categoriesById.get(r.categoryId);
          return (
            <div key={r.id} className={`list-row ${r.active ? '' : 'archived'}`}>
              <span className="ico">{cat?.icon ?? '•'}</span>
              <div style={{ flex: 1 }}>
                <div>{lang === 'en' ? r.descriptionEn || r.description : r.description}</div>
                <div className="muted" style={{ fontSize: '0.78rem' }}>
                  {cat ? categoryName(cat, lang) : ''} · {t('recurring.day')}: <span className="num">{r.dayOfMonth}</span>
                  {r.counterparty && ` · ${r.counterparty}`}
                </div>
              </div>
              <b className="coral">
                <Money fils={r.amountFils} />
              </b>
              <button type="button" className="btn small ghost" onClick={() => void repo.saveRecurring({ ...r, active: !r.active })}>
                {r.active ? t('recurring.active') : t('recurring.paused')}
              </button>
              <button type="button" className="btn small ghost" onClick={() => void repo.deleteRecurring(r.id)} aria-label={t('common.delete')}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <form className="card stack" onSubmit={add}>
        <h3>{t('recurring.add')}</h3>
        <div className="form-grid">
          <label className="field">
            <span>{t('add.description')}</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('add.amount')}</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.000" />
          </label>
          <label className="field">
            <span>{t('add.category')}</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {outCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {categoryName(c, lang)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{t('recurring.day')}</span>
            <input inputMode="numeric" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('add.paidTo')}</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('add.paymentMethod')}</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {OUTFLOW_PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`methods.${m}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <div className="warning">{error}</div>}
        <div>
          <button type="submit" className="btn">
            <Icon name="plus" size={18} /> {t('recurring.add')}
          </button>
        </div>
      </form>
    </div>
  );
}
