import { useMemo, useState, type FormEvent } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { categoriesOfKind, categoryName } from '../../domain/categories';
import { monthKeyOf } from '../../domain/dates';
import { filsToInput, parseKwdToFils } from '../../domain/money';
import { createTransaction, defaultStatus, newId, updateTransaction, validStatuses, type TransactionInput } from '../../domain/transactions';
import { INFLOW_PAYMENT_METHODS, OUTFLOW_PAYMENT_METHODS, type Category, type PaymentMethod, type RecordKind, type StoredStatus, type Transaction, type TransactionType } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { monthLabel, translate } from '../../i18n/translate';
import { BottomSheet } from '../components/BottomSheet';
import { Icon } from '../components/Icon';
import { CategoryEditor } from './CategoryEditor';
import { CategoryIcon } from '../components/CategoryIcon';
import { ConfirmPanel } from '../components/common';

type OutflowTab = 'salary' | 'maintenance' | 'groceries' | 'other' | 'new';

const TAB_CATEGORY: Record<'salary' | 'maintenance' | 'groceries', string> = {
  salary: 'out-salaries',
  maintenance: 'out-maintenance',
  groceries: 'out-groceries',
};

function tabForCategory(id: string): OutflowTab {
  if (id === TAB_CATEGORY.salary) return 'salary';
  if (id === TAB_CATEGORY.maintenance) return 'maintenance';
  if (id === TAB_CATEGORY.groceries) return 'groceries';
  return 'other';
}

export function TransactionForm({ existing, initialType = 'outflow', onClose, onSaved }: { existing?: Transaction; initialType?: TransactionType; onClose: () => void; onSaved: (msg: string) => void }) {
  const { t, lang } = useI18n();
  const { repo, categories, categoriesById, today } = useAppData();
  const [type, setType] = useState<TransactionType>(existing?.transactionType ?? initialType);
  const [tab, setTab] = useState<OutflowTab>(existing ? tabForCategory(existing.categoryId) : 'groceries');
  const [categoryId, setCategoryId] = useState<string>(existing?.categoryId ?? (initialType === 'inflow' ? 'in-family' : TAB_CATEGORY.groceries));
  const [amount, setAmount] = useState(existing ? filsToInput(existing.amountFils) : '');
  const [date, setDate] = useState(existing?.date ?? today);
  const other: 'ar' | 'en' = lang === 'ar' ? 'en' : 'ar';
  const primaryOf = (tx?: Transaction) => (tx ? (lang === 'ar' ? tx.descriptionAr : tx.descriptionEn) ?? tx.description : '');
  const [description, setDescription] = useState(primaryOf(existing));
  const [otherDescription, setOtherDescription] = useState((existing && (other === 'en' ? existing.descriptionEn : existing.descriptionAr)) ?? '');
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? '');
  const [method, setMethod] = useState<PaymentMethod | ''>(existing?.paymentMethod ?? 'cash');
  const [status, setStatus] = useState<StoredStatus>(existing?.status ?? defaultStatus(initialType));
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [salaryMonth, setSalaryMonth] = useState(existing?.salaryMonth ?? monthKeyOf(today));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const kindCategories = useMemo(() => categoriesOfKind(categories, type), [categories, type]);
  const methods = type === 'inflow' ? INFLOW_PAYMENT_METHODS : OUTFLOW_PAYMENT_METHODS;

  const switchType = (next: TransactionType) => {
    setType(next);
    setStatus(defaultStatus(next));
    setCategoryId(next === 'inflow' ? 'in-family' : TAB_CATEGORY[tab === 'salary' || tab === 'maintenance' || tab === 'groceries' ? tab : 'groceries']);
    if (next === 'inflow' && method && !INFLOW_PAYMENT_METHODS.includes(method)) setMethod('cash');
  };

  const chooseTab = (next: OutflowTab) => {
    setTab(next);
    if (next === 'salary' || next === 'maintenance' || next === 'groceries') setCategoryId(TAB_CATEGORY[next]);
    else if (next === 'other') {
      const first = kindCategories.find((c) => !Object.values(TAB_CATEGORY).includes(c.id));
      if (first) setCategoryId(first.id);
    }
  };

  const onCategoryCreated = (c: Category) => {
    setCategoryId(c.id);
    setTab('other');
  };

  const recordKind: RecordKind = type === 'inflow' ? (categoryId === 'in-family' ? 'family' : 'general') : tab === 'salary' ? 'salary' : tab === 'maintenance' ? 'maintenance' : tab === 'groceries' ? 'groceries' : 'general';

  const counterpartyLabel =
    type === 'inflow'
      ? categoryId === 'in-family'
        ? t('add.familyMember')
        : t('add.receivedFrom')
      : tab === 'salary'
        ? t('add.workerName')
        : tab === 'maintenance'
          ? t('add.vendor')
          : tab === 'groceries'
            ? t('add.shop')
            : t('add.paidTo');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const fils = parseKwdToFils(amount);
    if (fils === null || fils <= 0) return setError(t('add.errors.amount'));
    const category = categoriesById.get(categoryId);
    if (!category || category.kind !== type) return setError(t('add.errors.category'));
    let primary = description.trim();
    let secondary = otherDescription.trim();
    if (recordKind === 'salary' && !primary) {
      const name = counterparty.trim() || category.nameAr;
      primary = translate(lang, 'add.salaryDescription', { name, month: monthLabel(lang, salaryMonth) });
      if (!secondary) secondary = translate(other, 'add.salaryDescription', { name, month: monthLabel(other, salaryMonth) });
    }
    if (!primary && !secondary) return setError(t('add.errors.description'));
    const input: TransactionInput = {
      transactionType: type,
      date,
      description: primary || secondary,
      descriptionAr: lang === 'ar' ? primary : secondary,
      descriptionEn: lang === 'en' ? primary : secondary,
      category,
      amountFils: fils,
      paymentMethod: method || null,
      counterparty,
      status,
      notes,
      recordKind,
      salaryMonth: recordKind === 'salary' ? salaryMonth : undefined,
    };
    try {
      const tx = existing ? updateTransaction(existing, input) : createTransaction(input, repo.userId, Date.now(), newId());
      setSaving(true);
      await repo.saveTransaction(tx);
      onSaved(t('common.saved'));
      onClose();
    } catch (err) {
      const key = err instanceof Error ? err.message : '';
      setError(['amount', 'date', 'description', 'category', 'status'].includes(key) ? t(`add.errors.${key}`) : t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const title = existing ? t('add.editTitle') : type === 'inflow' ? t('add.inflowTitle') : t('add.outflowTitle');

  return (
    <BottomSheet title={title} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <div className={`segmented ${type}`} role="group" aria-label={t('ledger.type')}>
          {(['inflow', 'outflow'] as TransactionType[]).map((k) => (
            <button key={k} type="button" aria-pressed={type === k} onClick={() => switchType(k)}>
              <Icon name={k === 'inflow' ? 'arrowIn' : 'arrowOut'} size={16} /> {t(`types.${k}`)}
            </button>
          ))}
        </div>

        {type === 'outflow' ? (
          <div className="tabs" role="group" aria-label={t('add.category')}>
            {(['salary', 'maintenance', 'groceries'] as const).map((k) => (
              <button key={k} type="button" aria-pressed={tab === k} onClick={() => chooseTab(k)}>
                <CategoryIcon id={TAB_CATEGORY[k]} size={16} /> {t(`add.tab${k[0].toUpperCase()}${k.slice(1)}`)}
              </button>
            ))}
            <button type="button" aria-pressed={tab === 'other'} onClick={() => chooseTab('other')}>
              {t('add.tabOther')}
            </button>
            <button type="button" aria-pressed={tab === 'new'} onClick={() => chooseTab('new')}>
              ● {t('add.tabNewType')}
            </button>
          </div>
        ) : null}

        {(type === 'inflow' || tab === 'other') && (
          <label className="field">
            <span>{t('add.category')}</span>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {kindCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {categoryName(c, lang)}
                </option>
              ))}
            </select>
          </label>
        )}
        {type === 'inflow' && (
          <button type="button" className="btn small ghost" onClick={() => setTab('new')}>
            ● {t('add.tabNewType')}
          </button>
        )}
        {tab === 'new' && <CategoryEditor kind={type} inline onSaved={onCategoryCreated} onCancel={() => setTab(type === 'outflow' ? 'groceries' : 'other')} />}

        <label className="field">
          <span>{t('add.amount')}</span>
          <input className="amount-input" inputMode="decimal" placeholder="0.000" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!existing} />
        </label>

        <div className="form-grid">
          <label className="field">
            <span>{t('add.date')}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          {recordKind === 'salary' && (
            <label className="field">
              <span>{t('add.salaryMonth')}</span>
              <input type="month" value={salaryMonth} onChange={(e) => setSalaryMonth(e.target.value)} />
            </label>
          )}
        </div>

        <label className="field">
          <span>{t('add.description')}</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} lang={lang} />
        </label>
        <label className="field">
          <span>
            {t(other === 'en' ? 'add.descriptionEn' : 'add.descriptionAr')} ({t('common.optional')})
          </span>
          <input value={otherDescription} onChange={(e) => setOtherDescription(e.target.value)} lang={other} dir={other === 'ar' ? 'rtl' : 'ltr'} />
        </label>

        <div className="form-grid">
          <label className="field">
            <span>{counterpartyLabel}</span>
            <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          </label>
          <label className="field">
            <span>{t('add.paymentMethod')}</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod | '')}>
              <option value="">{t('common.none')}</option>
              {methods.map((m) => (
                <option key={m} value={m}>
                  {t(`methods.${m}`)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="field">
          <span>{t('add.status')}</span>
          <div className="segmented" role="group" aria-label={t('add.status')}>
            {validStatuses(type).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}>
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>{t('add.notes')}</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {error && (
          <div className="warning" role="alert">
            {error}
          </div>
        )}
        <div className="row">
          <button type="submit" className="btn primary" disabled={saving}>
            <Icon name="check" size={18} /> {t('common.save')}
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            {t('common.cancel')}
          </button>
          {existing && !confirmingDelete && (
            <button type="button" className="btn danger" onClick={() => setConfirmingDelete(true)}>
              <Icon name="trash" size={18} /> {t('common.delete')}
            </button>
          )}
        </div>
        {existing && confirmingDelete && (
          <ConfirmPanel
            message={t('common.confirmDelete')}
            confirmLabel={t('common.delete')}
            onConfirm={() => {
              repo.deleteTransaction(existing.id).catch((e) => {
                console.error(e);
                onSaved(t('common.error'));
              });
              onSaved(t('common.deleted'));
              onClose();
            }}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
      </form>
    </BottomSheet>
  );
}
