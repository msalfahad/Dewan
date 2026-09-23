import { ICON_PATHS as PATHS } from '../iconPaths';


/** Icons whose meaning is directional; they mirror automatically in RTL. */
const DIRECTIONAL = new Set(['next', 'prev']);

export function Icon({ name, size = 22, className = '' }: { name: keyof typeof PATHS | string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${DIRECTIONAL.has(name) ? 'flip-rtl' : ''} ${className}`.trim()}
    >
      <path d={PATHS[name] ?? PATHS.tag} />
    </svg>
  );
}
