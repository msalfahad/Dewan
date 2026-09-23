import { useState, type FormEvent } from 'react';
import { isFirebaseConfigured } from '../data/firebase';
import { useI18n } from '../i18n/I18nProvider';
import { LanguageSwitcher } from './components/common';

export function LoginScreen({ onEmailAuth, onLocal }: { onEmailAuth: (email: string, password: string, create: boolean) => Promise<void>; onLocal: () => void }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [create, setCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onEmailAuth(email.trim(), password, create);
    } catch {
      setError(t('login.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="card stack">
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <LanguageSwitcher />
        </div>
        <div>
          <img className="logo" src="./icons/icon.svg" alt="" />
          <p className="tag" style={{ marginBottom: 0 }}>
            {t('login.welcome')}
          </p>
          <h1>{t('app.name')}</h1>
          <p className="tag">{t('app.tagline')}</p>
        </div>
        {isFirebaseConfigured ? (
          <form className="stack" onSubmit={submit}>
            <label className="field">
              <span>{t('login.email')}</span>
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" required />
            </label>
            <label className="field">
              <span>{t('login.password')}</span>
              <input type="password" autoComplete={create ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" required minLength={6} />
            </label>
            {error && <div className="warning">{error}</div>}
            <button type="submit" className="btn primary" disabled={busy}>
              {create ? t('login.signUp') : t('login.signIn')}
            </button>
            <button type="button" className="btn ghost small" onClick={() => setCreate((c) => !c)}>
              {create ? t('login.switchToSignIn') : t('login.switchToSignUp')}
            </button>
          </form>
        ) : (
          <div className="warning">{t('login.firebaseMissing')}</div>
        )}
        <button type="button" className="btn" onClick={onLocal}>
          {t('login.localMode')}
        </button>
      </div>
    </div>
  );
}
