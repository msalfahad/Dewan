import { Icon } from './Icon';

/** Line icons for the default categories (as in the design); custom categories show their chosen symbol. */
const DEFAULT_ICONS: Record<string, string> = {
  'in-family': 'users',
  'in-topup': 'topup',
  'in-refund': 'refund',
  'in-other': 'plusCircle',
  'out-salaries': 'user',
  'out-maintenance': 'snowflake',
  'out-groceries': 'cart',
  'out-supplies': 'coffee',
  'out-subscriptions': 'tv',
  'out-residency': 'idCard',
  'out-services': 'bolt',
  'out-other': 'dots',
};

export function CategoryIcon({ id, icon, size = 22 }: { id: string; icon?: string; size?: number }) {
  const name = DEFAULT_ICONS[id];
  if (name) return <Icon name={name} size={size} />;
  return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{icon || '•'}</span>;
}
