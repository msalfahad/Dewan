import { I18nProvider } from './i18n/I18nProvider';
import { AuthGate } from './ui/AuthGate';

export default function App() {
  return (
    <I18nProvider>
      <AuthGate />
    </I18nProvider>
  );
}
