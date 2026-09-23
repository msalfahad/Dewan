import type { ReportFonts } from './pdfReport';

let cache: Promise<ReportFonts> | null = null;

/** Loads the embedded Arabic/Latin font files shipped in public/fonts. */
export function loadReportFonts(): Promise<ReportFonts> {
  if (!cache) {
    const base = import.meta.env.BASE_URL ?? './';
    const get = (file: string) =>
      fetch(`${base}fonts/${file}`).then((r) => {
        if (!r.ok) throw new Error(`Font ${file} failed to load`);
        return r.arrayBuffer();
      });
    cache = Promise.all([get('IBMPlexSansArabic-Regular.ttf'), get('IBMPlexSansArabic-Bold.ttf')]).then(([regular, bold]) => ({ regular, bold }));
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}
