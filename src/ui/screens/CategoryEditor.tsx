import { useState, type FormEvent } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { categoriesOfKind } from '../../domain/categories';
import { newId } from '../../domain/transactions';
import type { Category, TransactionType } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';

/** Create or edit a category: Arabic name, English name, icon, display order, inflow/outflow, archived. */
export function CategoryEditor({ kind, existing, inline = false, onSaved, onCancel }: { kind: TransactionType; existing?: Category; inline?: boolean; onSaved: (c: Category) => void; onCancel: () => void }) {
  const { t, lang } = useI18n();
  const { repo, categories } = useAppData();
  const [nameAr, setNameAr] = useState(existing?.nameAr ?? '');
  const [nameEn, setNameEn] = useState(existing?.nameEn ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? '•');
  const [categoryKind, setKind] = useState<TransactionType>(existing?.kind ?? kind);
  const [order, setOrder] = useState(String(existing?.order ?? categoriesOfKind(categories, kind, true).length + 1));
  const [archived, setArchived] = useState(existing?.archived ?? false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!nameAr.trim() && !nameEn.trim()) return setError(t('categories.nameRequired'));
    const category: Category = {
      id: existing?.id ?? newId(categoryKind === 'inflow' ? 'in' : 'out'),
      // If only one name is entered it is shown in both languages until translated.
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim(),
      icon: icon.trim() || '•',
      order: Number.parseInt(order, 10) || 99,
      kind: categoryKind,
      archived,
      isDefault: existing?.isDefault ?? false,
      ...(existing?.recordKind ? { recordKind: existing.recordKind } : {}),
    };
    await repo.saveCategory(category);
    onSaved(category);
  };

  const body = (
    <>
      <div className="form-grid">
        <label className="field">
          <span>{t('categories.nameAr')}</span>
          <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" lang="ar" autoFocus={lang === 'ar'} />
        </label>
        <label className="field">
          <span>
            {t('categories.nameEn')} ({t('common.optional')})
          </span>
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} dir="ltr" lang="en" autoFocus={lang === 'en'} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>{t('categories.icon')}</span>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} />
        </label>
        <label className="field">
          <span>{t('categories.order')}</span>
          <input inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} />
        </label>
      </div>
      {!inline && (
        <div className="row">
          <div className="segmented" role="group" aria-label={t('categories.kind')}>
            {(['inflow', 'outflow'] as TransactionType[]).map((k) => (
              <button key={k} type="button" aria-pressed={categoryKind === k} onClick={() => setKind(k)} disabled={Boolean(existing?.isDefault)}>
                {t(`types.${k}`)}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label={t('categories.archived')}>
            <button type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>
              {t('categories.active')}
            </button>
            <button type="button" aria-pressed={archived} onClick={() => setArchived(true)}>
              {t('categories.archived')}
            </button>
          </div>
        </div>
      )}
      {error && <div className="warning">{error}</div>}
      <div className="row">
        <button type={inline ? 'button' : 'submit'} className="btn primary small" onClick={inline ? () => void save() : undefined}>
          {t('common.save')}
        </button>
        <button type="button" className="btn ghost small" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </>
  );

  // Inline mode lives inside the transaction form, so it must not render a nested <form>.
  return inline ? (
    <div className="card stack" aria-label={t('add.tabNewType')}>
      <div className="muted">{t('add.newTypeHint')}</div>
      {body}
    </div>
  ) : (
    <form className="stack" onSubmit={save}>
      {body}
    </form>
  );
}
