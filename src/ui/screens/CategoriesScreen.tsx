import { useState } from 'react';
import { useAppData } from '../../data/AppDataProvider';
import { categoriesOfKind, categoryName } from '../../domain/categories';
import type { Category, TransactionType } from '../../domain/types';
import { useI18n } from '../../i18n/I18nProvider';
import { BottomSheet } from '../components/BottomSheet';
import { Icon } from '../components/Icon';
import { CategoryEditor } from './CategoryEditor';

export function CategoriesScreen({ onBack }: { onBack: () => void }) {
  const { t, lang } = useI18n();
  const { categories, repo } = useAppData();
  const [editing, setEditing] = useState<{ kind: TransactionType; category?: Category } | null>(null);

  const section = (kind: TransactionType) => (
    <div className="card">
      <h3>
        {t(kind === 'inflow' ? 'categories.inflowCategories' : 'categories.outflowCategories')}
        <button type="button" className="btn small" onClick={() => setEditing({ kind })}>
          <Icon name="plus" size={16} /> {t('categories.add')}
        </button>
      </h3>
      {categoriesOfKind(categories, kind, true).map((c) => (
        <div key={c.id} className={`list-row ${c.archived ? 'archived' : ''}`}>
          <span className="ico">{c.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div>{categoryName(c, lang)}</div>
            <div className="muted" style={{ fontSize: '0.78rem' }}>
              {categoryName(c, lang === 'ar' ? 'en' : 'ar')}
              {!c.nameEn.trim() && ` · ${t('categories.missingEnglish')}`}
              {c.isDefault && ` · ${t('categories.default')}`}
              {c.archived && ` · ${t('categories.archived')}`}
            </div>
          </div>
          <button type="button" className="btn small ghost" onClick={() => setEditing({ kind, category: c })} aria-label={t('common.edit')}>
            <Icon name="edit" size={16} />
          </button>
          <button type="button" className="btn small ghost" onClick={() => void repo.saveCategory({ ...c, archived: !c.archived })}>
            {c.archived ? t('categories.restore') : t('categories.archive')}
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="icon-btn" onClick={onBack} aria-label={t('common.back')}>
          <Icon name="prev" />
        </button>
        <h2 className="section-title" style={{ margin: 0 }}>{t('categories.title')}</h2>
      </div>
      {section('inflow')}
      {section('outflow')}
      {editing && (
        <BottomSheet title={editing.category ? t('categories.edit') : t('categories.add')} onClose={() => setEditing(null)}>
          <CategoryEditor kind={editing.kind} existing={editing.category} onSaved={() => setEditing(null)} onCancel={() => setEditing(null)} />
        </BottomSheet>
      )}
    </div>
  );
}
