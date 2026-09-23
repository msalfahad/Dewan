import { useAppData } from '../../data/AppDataProvider';
import { APP_CONFIG } from '../../config/app';
import { demoData } from '../../domain/demo';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSwitcher } from '../components/common';
import { Icon } from '../components/Icon';
import { OpeningBalanceForm } from './OpeningBalanceForm';

export function SettingsScreen({ account, onSignOut, onOpenCategories, onOpenRecurring, onToast }: { account: string | null; onSignOut: () => void; onOpenCategories: () => void; onOpenRecurring: () => void; onToast: (m: string) => void }) {
  const { t } = useI18n();
  const { repo } = useAppData();

  const loadDemo = async () => {
    if (!window.confirm(t('settings.loadDemoConfirm'))) return;
    await repo.replaceAll(demoData(repo.userId));
    onToast(t('common.saved'));
  };
  const clearAll = async () => {
    if (!window.confirm(t('settings.clearAllConfirm'))) return;
    await repo.replaceAll({ transactions: [], categories: [], recurring: [], openingBalance: null });
    onToast(t('common.deleted'));
  };

  return (
    <div className="stack">
      <div className="card stack">
        <h3>
          <span>
            <Icon name="globe" size={18} /> {t('lang.label')}
          </span>
        </h3>
        <LanguageSwitcher />
        <div className="muted">
          {t('settings.appName')}: <b>{APP_CONFIG.nameAr}</b> · <b>{APP_CONFIG.nameEn}</b>
        </div>
      </div>

      <OpeningBalanceForm onSaved={onToast} />

      <div className="card">
        <div className="list-row">
          <span className="ico">
            <Icon name="tag" size={18} />
          </span>
          <div style={{ flex: 1 }}>{t('categories.title')}</div>
          <button type="button" className="btn small" onClick={onOpenCategories}>
            {t('settings.manage')} <Icon name="next" size={16} />
          </button>
        </div>
        <div className="list-row">
          <span className="ico">
            <Icon name="repeat" size={18} />
          </span>
          <div style={{ flex: 1 }}>{t('recurring.title')}</div>
          <button type="button" className="btn small" onClick={onOpenRecurring}>
            {t('settings.manage')} <Icon name="next" size={16} />
          </button>
        </div>
      </div>

      <div className="card stack">
        <h3>{t('settings.account')}</h3>
        <div>
          {t('settings.storage')}: <b>{repo.kind === 'firebase' ? t('settings.firebase') : t('settings.device')}</b>
        </div>
        <div>{account ? `${t('settings.signedInAs')}: ${account}` : t('settings.localMode')}</div>
        <div>
          <button type="button" className="btn" onClick={onSignOut}>
            {t('settings.signOut')}
          </button>
        </div>
      </div>

      <div className="card stack">
        <h3>{t('settings.data')}</h3>
        <div className="row">
          <button type="button" className="btn" onClick={() => void loadDemo()}>
            {t('settings.loadDemo')}
          </button>
          <button type="button" className="btn danger" onClick={() => void clearAll()}>
            {t('settings.clearAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
