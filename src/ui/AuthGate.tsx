import { useEffect, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { AppDataProvider } from '../data/AppDataProvider';
import { firebase, isFirebaseConfigured } from '../data/firebase';
import { FirebaseRepository } from '../data/firebaseRepository';
import { LocalRepository } from '../data/localRepository';
import type { DataRepository } from '../data/repository';
import { useI18n } from '../i18n/I18nProvider';
import { LoginScreen } from './LoginScreen';
import { Shell } from './Shell';

const LOCAL_KEY = 'diwaniya.localMode';

function readLocalMode(): boolean {
  try {
    return localStorage.getItem(LOCAL_KEY) === '1';
  } catch {
    return false;
  }
}

export function AuthGate() {
  const { t } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [localMode, setLocalMode] = useState(readLocalMode);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(firebase().auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  const repo = useMemo<DataRepository | null>(() => {
    if (user) return new FirebaseRepository(firebase().db, user.uid);
    if (localMode) return new LocalRepository();
    return null;
  }, [user, localMode]);

  const setLocal = (on: boolean) => {
    try {
      if (on) localStorage.setItem(LOCAL_KEY, '1');
      else localStorage.removeItem(LOCAL_KEY);
    } catch {
      /* ignore */
    }
    setLocalMode(on);
  };

  if (!authReady) return <p className="muted" style={{ padding: 24 }}>{t('common.loading')}</p>;

  if (!repo) {
    return (
      <LoginScreen
        onLocal={() => setLocal(true)}
        onEmailAuth={async (email, password, create) => {
          const { auth } = firebase();
          if (create) await createUserWithEmailAndPassword(auth, email, password);
          else await signInWithEmailAndPassword(auth, email, password);
        }}
      />
    );
  }

  return (
    <AppDataProvider repo={repo}>
      <Shell
        account={user?.email ?? null}
        onSignOut={() => {
          setLocal(false);
          if (user) void signOut(firebase().auth);
        }}
      />
    </AppDataProvider>
  );
}
