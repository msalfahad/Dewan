/**
 * Single source of truth for the application name.
 * The same JSON is read by vite.config.ts to fill index.html (<title>, meta tags)
 * and to generate the PWA manifest (installed app name).
 */
import appConfig from './app.json';

export const APP_CONFIG = appConfig;

export type Lang = 'ar' | 'en';

export function appName(lang: Lang): string {
  return lang === 'ar' ? APP_CONFIG.nameAr : APP_CONFIG.nameEn;
}

/** "حساب الديوان — Diwaniya Account" */
export const APP_NAME_BILINGUAL = `${APP_CONFIG.nameAr} — ${APP_CONFIG.nameEn}`;
