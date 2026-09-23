/**
 * Bidirectional text for the PDF.
 *
 * pdf-lib + fontkit already shape Arabic (initial/medial/final/ligature forms, so letters stay
 * connected) and emit an Arabic run in visual (right-to-left) glyph order. What they do not do
 * is the Unicode Bidirectional Algorithm for *mixed* lines such as "حبوب قهوة 2" or
 * "التاريخ / Date". This module splits a logical string into directional runs with bidi-js and
 * returns them in visual left-to-right order so each run can be drawn after the previous one.
 */
import bidiFactory from 'bidi-js';

const bidi = bidiFactory();

export type BaseDir = 'rtl' | 'ltr';

export interface VisualRun {
  text: string;
  rtl: boolean;
  /** True when the run contains Arabic letters (fontkit will emit it right-to-left itself). */
  arabic: boolean;
}

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const MIRROR: Record<string, string> = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<', '«': '»', '»': '«' };

export function hasArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

interface LogicalRun {
  start: number;
  end: number;
  level: number;
}

export function visualRuns(text: string, baseDir: BaseDir): VisualRun[] {
  if (!text) return [];
  const { levels } = bidi.getEmbeddingLevels(text, baseDir);
  const runs: LogicalRun[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || levels[i] !== levels[start]) {
      runs.push({ start, end: i, level: levels[start] });
      start = i;
    }
  }
  // Rule L2: from the highest level down to the lowest odd level, reverse every
  // contiguous sequence of runs at that level or higher.
  const maxLevel = Math.max(...runs.map((r) => r.level));
  const oddLevels = runs.map((r) => r.level).filter((l) => l % 2 === 1);
  const minOdd = oddLevels.length ? Math.min(...oddLevels) : maxLevel + 1;
  for (let lvl = maxLevel; lvl >= minOdd; lvl--) {
    let i = 0;
    while (i < runs.length) {
      if (runs[i].level >= lvl) {
        let j = i;
        while (j < runs.length && runs[j].level >= lvl) j++;
        const reversed = runs.slice(i, j).reverse();
        runs.splice(i, j - i, ...reversed);
        i = j;
      } else i++;
    }
  }
  return runs.map((r) => {
    const t = text.slice(r.start, r.end);
    return { text: t, rtl: r.level % 2 === 1, arabic: hasArabic(t) };
  });
}

/**
 * Text to hand to the font for one run. Arabic runs are passed in logical order (fontkit
 * shapes and reverses them) with paired brackets mirrored. RTL runs without Arabic letters (only spaces/punctuation) are
 * reversed and mirrored here, since fontkit treats them as left-to-right.
 */
export function runDrawText(run: VisualRun): string {
  if (!run.rtl) return run.text;
  // fontkit reverses Arabic glyphs but does not apply bidi mirroring, so swap paired brackets.
  if (run.arabic) return [...run.text].map((c) => MIRROR[c] ?? c).join('');
  return [...run.text].reverse().map((c) => MIRROR[c] ?? c).join('');
}

/** Visual left-to-right string (for tests and debugging): Arabic runs are reversed char-wise. */
export function toVisualString(text: string, baseDir: BaseDir): string {
  return visualRuns(text, baseDir)
    .map((r) => (r.rtl ? [...r.text].reverse().map((c) => MIRROR[c] ?? c).join('') : r.text))
    .join('');
}
