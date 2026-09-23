/**
 * PDF LEDGER REPORT GENERATOR.
 *
 * Produces a vector PDF (real text, not a screenshot) with pdf-lib and an embedded Arabic font
 * (IBM Plex Sans Arabic, which also covers Latin). Arabic is shaped by fontkit so letters stay
 * connected, and mixed Arabic/English/number strings are ordered with the Unicode bidi algorithm
 * (bidiText.ts). Arabic and bilingual reports are laid out right-to-left (columns, charts,
 * legends and alignment mirrored); English reports left-to-right.
 *
 * Layout follows the Royal Sapphire design: A4 portrait, white paper, navy/gold header swoosh,
 * logo, icon summary cards, period bar chart + category donut, and a navy-headed ledger table.
 *
 * The detailed ledger table always includes the Balance column: widths are distributed by
 * weight over the full printable width, cells wrap/truncate instead of pushing columns off
 * the page, and the table header is repeated on every page.
 */
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { formatAmount } from '../domain/money';
import { runDrawText, visualRuns, type BaseDir } from './bidiText';
import type { ColumnKey, ReportModel, ReportRow, Tone } from './reportModel';
import { ICON_PATHS } from '../ui/iconPaths';

export interface ReportFonts {
  regular: Uint8Array | ArrayBuffer;
  bold: Uint8Array | ArrayBuffer;
}

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** Print palette: white paper, dark navy, champagne-gold accents, green inflows, coral outflows, amber dues. */
export const PDF_COLORS = {
  paper: hex('#FFFFFF'),
  ivoryCard: hex('#FCFAF5'),
  pinkCard: hex('#FDEEEE'),
  pinkBorder: hex('#F0C1C3'),
  white: hex('#FFFFFF'),
  navy: hex('#0B1428'),
  navySoft: hex('#1C2A4A'),
  gold: hex('#B8955A'),
  green: hex('#1E9E5A'),
  greenTint: hex('#EAF7EF'),
  greenBorder: hex('#B7E2C8'),
  goldLight: hex('#D4B483'),
  goldTint: hex('#F3EAD8'),
  coral: hex('#D9534A'),
  coralTint: hex('#FBE7E4'),
  amber: hex('#C98A12'),
  amberTint: hex('#FBF0DA'),
  ivory: hex('#E9DFC9'),
  silver: hex('#A3AAB5'),
  blue: hex('#5F7899'),
  text: hex('#1B2233'),
  muted: hex('#5B6475'),
  border: hex('#E3DCCD'),
  cardBorder: hex('#E7D3A6'),
  rowAlt: hex('#FAF7F0'),
};

/** Donut / category palette as in the design: muted blue, coral, gold, light gold, silver … */
const CATEGORY_COLORS = [hex('#3F6AA8'), PDF_COLORS.coral, PDF_COLORS.gold, PDF_COLORS.goldLight, PDF_COLORS.silver, hex('#8C7A5B'), hex('#7D8BA3'), PDF_COLORS.amber];

const toneColor: Record<Tone, RGB> = {
  gold: PDF_COLORS.gold,
  green: PDF_COLORS.green,
  coral: PDF_COLORS.coral,
  amber: PDF_COLORS.amber,
  navy: PDF_COLORS.navy,
  blue: PDF_COLORS.blue,
};

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 30;
const FOOTER_H = 22;
const CONTENT_W = PAGE_W - MARGIN * 2;

type Align = 'start' | 'end' | 'center';

interface TextOpts {
  size: number;
  bold?: boolean;
  color?: RGB;
}

/** Page-drawing helper working in "start-side" coordinates so RTL layouts mirror automatically. */
class Canvas {
  readonly pages: PDFPage[] = [];
  page!: PDFPage;
  /** Cursor measured from the top of the page. */
  y = 0;

  constructor(
    private doc: PDFDocument,
    private regular: PDFFont,
    private bold: PDFFont,
    readonly dir: BaseDir,
  ) {}

  get rtl() {
    return this.dir === 'rtl';
  }

  addPage(): PDFPage {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PDF_COLORS.paper });
    this.pages.push(this.page);
    this.y = MARGIN;
    return this.page;
  }

  /** Absolute left x of a box that starts `start` points from the start-side page edge. */
  left(start: number, width: number): number {
    return this.rtl ? PAGE_W - start - width : start;
  }

  font(bold?: boolean) {
    return bold ? this.bold : this.regular;
  }

  width(text: string, opts: TextOpts): number {
    const font = this.font(opts.bold);
    return visualRuns(text, autoDir(text, this.dir)).reduce((w, r) => w + font.widthOfTextAtSize(runDrawText(r), opts.size), 0);
  }

  /** Draws text with its baseline `yTop` points from the page top, aligned inside [start, start+width]. */
  text(text: string, start: number, width: number, yTop: number, opts: TextOpts, align: Align = 'start') {
    if (!text) return;
    const font = this.font(opts.bold);
    const runs = visualRuns(text, autoDir(text, this.dir));
    const total = runs.reduce((w, r) => w + font.widthOfTextAtSize(runDrawText(r), opts.size), 0);
    const boxLeft = this.left(start, width);
    const physical: 'left' | 'right' | 'center' = align === 'center' ? 'center' : (align === 'start') !== this.rtl ? 'left' : 'right';
    let x = physical === 'left' ? boxLeft : physical === 'right' ? boxLeft + width - total : boxLeft + (width - total) / 2;
    const y = PAGE_H - yTop;
    for (const run of runs) {
      const s = runDrawText(run);
      if (s.trim()) this.page.drawText(s, { x, y, size: opts.size, font, color: opts.color ?? PDF_COLORS.text });
      x += font.widthOfTextAtSize(s, opts.size);
    }
  }

  rect(start: number, yTop: number, width: number, height: number, fill?: RGB, border?: RGB, borderWidth = 0.5) {
    this.page.drawRectangle({
      x: this.left(start, width),
      y: PAGE_H - yTop - height,
      width,
      height,
      ...(fill ? { color: fill } : {}),
      ...(border ? { borderColor: border, borderWidth } : {}),
    });
  }

  line(start1: number, y1: number, start2: number, y2: number, color: RGB, thickness = 0.5) {
    const x1 = this.rtl ? PAGE_W - start1 : start1;
    const x2 = this.rtl ? PAGE_W - start2 : start2;
    this.page.drawLine({ start: { x: x1, y: PAGE_H - y1 }, end: { x: x2, y: PAGE_H - y2 }, color, thickness });
  }

  circle(start: number, yTop: number, r: number, color: RGB) {
    this.page.drawCircle({ x: this.rtl ? PAGE_W - start : start, y: PAGE_H - yTop, size: r, color });
  }

  /** Draws one of the shared 24×24 line icons (same set as the app). */
  icon(name: string, start: number, yTop: number, size: number, color: RGB) {
    const path = ICON_PATHS[name];
    if (!path) return;
    this.page.drawSvgPath(path, { x: this.left(start, size), y: PAGE_H - yTop, scale: size / 24, borderColor: color, borderWidth: 1.7 });
  }

  /** Fills an SVG path given in absolute top-left page coordinates (already mirrored by the caller). */
  path(d: string, fill: RGB) {
    this.page.drawSvgPath(d, { x: 0, y: PAGE_H, color: fill });
  }

  /** Greedy word wrap on logical text; the last allowed line is truncated with an ellipsis. */
  wrap(text: string, maxWidth: number, opts: TextOpts, maxLines = 3): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (!current || this.width(candidate, opts) <= maxWidth) current = candidate;
      else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    if (lines.length > maxLines) {
      const kept = lines.slice(0, maxLines);
      kept[maxLines - 1] = `${kept[maxLines - 1]} ${lines.slice(maxLines).join(' ')}`;
      lines.length = 0;
      lines.push(...kept);
    }
    return lines.map((l) => this.truncate(l, maxWidth, opts));
  }

  truncate(text: string, maxWidth: number, opts: TextOpts): string {
    if (this.width(text, opts) <= maxWidth) return text;
    let s = text;
    while (s.length > 1 && this.width(`${s}…`, opts) > maxWidth) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  }
}

/** Paragraph direction: from the first strong character, falling back to the layout direction. */
function autoDir(text: string, fallback: BaseDir): BaseDir {
  for (const ch of text) {
    if (/[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(ch)) return 'rtl';
    if (/[A-Za-z]/.test(ch)) return 'ltr';
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Table layout

export interface ColumnLayout {
  key: ColumnKey | string;
  label: string;
  start: number;
  width: number;
  numeric: boolean;
}

/** Distributes the printable width over the columns. The balance column is always present. */
export function layoutColumns(columns: { key: string; label: string; weight: number; numeric: boolean }[], totalWidth = CONTENT_W): ColumnLayout[] {
  if (!columns.some((c) => c.key === 'balance') && columns.some((c) => c.key === 'inflow')) {
    throw new Error('Ledger table must include the balance column');
  }
  const sum = columns.reduce((s, c) => s + c.weight, 0);
  let start = MARGIN;
  return columns.map((c) => {
    const width = (c.weight / sum) * totalWidth;
    const col = { key: c.key, label: c.label, start, width, numeric: c.numeric };
    start += width;
    return col;
  });
}

const CELL_PAD = 3.5;
const BODY: TextOpts = { size: 7 };
const LINE_H = 9;
const HEAD: TextOpts = { size: 7, bold: true, color: PDF_COLORS.paper };

function headerHeight(cv: Canvas, cols: ColumnLayout[]): { height: number; lines: string[][] } {
  const lines = cols.map((c) => cv.wrap(c.label, c.width - CELL_PAD * 2, HEAD, 2));
  const maxLines = Math.max(...lines.map((l) => l.length));
  return { height: maxLines * LINE_H + CELL_PAD * 2, lines };
}

function drawHeader(cv: Canvas, cols: ColumnLayout[]) {
  const { height, lines } = headerHeight(cv, cols);
  const top = cv.y;
  cols.forEach((c, i) => {
    cv.rect(c.start, top, c.width, height, PDF_COLORS.navy, PDF_COLORS.navySoft);
    const opts = c.key === 'balance' ? { ...HEAD, color: PDF_COLORS.goldLight } : HEAD;
    lines[i].forEach((l, j) => cv.text(l, c.start + CELL_PAD, c.width - CELL_PAD * 2, top + CELL_PAD + 7 + j * LINE_H, opts, c.numeric ? 'center' : 'start'));
  });
  cv.y += height;
}

interface BodyRow {
  cells: Record<string, string[]>;
  fill?: RGB;
  color?: Partial<Record<string, RGB>>;
  boldKeys?: string[];
}

function prepareRow(cv: Canvas, cols: ColumnLayout[], row: BodyRow): { height: number; lines: string[][] } {
  const lines = cols.map((c) => {
    const opts = { ...BODY, bold: row.boldKeys?.includes(c.key) };
    return (row.cells[c.key] ?? ['']).flatMap((t) => cv.wrap(t, c.width - CELL_PAD * 2, opts, c.key === 'description' ? 3 : 2));
  });
  const maxLines = Math.max(1, ...lines.map((l) => l.length));
  return { height: maxLines * LINE_H + CELL_PAD * 2 - 1, lines };
}

function drawRow(cv: Canvas, cols: ColumnLayout[], row: BodyRow, prepared: { height: number; lines: string[][] }) {
  const top = cv.y;
  cols.forEach((c, i) => {
    const fill = c.key === 'balance' ? PDF_COLORS.goldTint : row.fill;
    cv.rect(c.start, top, c.width, prepared.height, fill, PDF_COLORS.border, 0.4);
    const opts: TextOpts = { ...BODY, bold: row.boldKeys?.includes(c.key), color: row.color?.[c.key] ?? PDF_COLORS.text };
    prepared.lines[i].forEach((l, j) => cv.text(l, c.start + CELL_PAD, c.width - CELL_PAD * 2, top + CELL_PAD + 6.8 + j * LINE_H, j > 0 && c.numeric ? { ...opts, size: 6.4 } : opts, c.numeric ? 'end' : 'start'));
  });
  cv.y += prepared.height;
}

function ledgerBodyRow(r: ReportRow, index: number): BodyRow {
  const fill = r.kind === 'opening' ? PDF_COLORS.goldTint : r.isUnpaidOutflow ? PDF_COLORS.amberTint : index % 2 ? PDF_COLORS.rowAlt : PDF_COLORS.white;
  return {
    cells: r.cells,
    fill,
    color: {
      inflow: r.isPendingInflow ? PDF_COLORS.muted : PDF_COLORS.green,
      outflow: r.isUnpaidOutflow ? PDF_COLORS.amber : PDF_COLORS.coral,
      balance: r.balanceFils < 0 ? PDF_COLORS.coral : PDF_COLORS.navy,
    },
    boldKeys: ['balance', ...(r.kind === 'opening' ? ['description'] : [])],
  };
}

// ---------------------------------------------------------------------------
// Page furniture

/** Mirrors an x coordinate (points from the start edge) into a physical x. */
function px(cv: Canvas, xFromStart: number): number {
  return cv.rtl ? PAGE_W - xFromStart : xFromStart;
}

/**
 * Cover header: navy sweep with a champagne-gold swoosh on the end side, logo + app name on the
 * start side, then the centred report title, selected period and generation date.
 */
function drawCoverHeader(cv: Canvas, model: ReportModel) {
  // Shapes are defined from the END edge (x measured from the far side) and mirrored per direction.
  const e = (x: number) => px(cv, PAGE_W - x);
  cv.path(`M${e(0)} 0 L${e(350)} 0 C${e(300)} 38 ${e(190)} 70 ${e(0)} 92 Z`, PDF_COLORS.navy);
  cv.path(`M${e(0)} 104 C${e(170)} 88 ${e(300)} 52 ${e(372)} 0 L${e(362)} 0 C${e(292)} 46 ${e(165)} 80 ${e(0)} 97 Z`, PDF_COLORS.goldLight);
  cv.path(`M${e(0)} 112 C${e(150)} 100 ${e(270)} 70 ${e(345)} 22 L${e(343)} 26 C${e(265)} 76 ${e(145)} 104 ${e(0)} 115 Z`, PDF_COLORS.gold);

  // Logo + app name (start side)
  const logo = 34;
  cv.rect(MARGIN, 26, logo, logo, PDF_COLORS.paper, PDF_COLORS.gold, 1);
  cv.icon('diwan', MARGIN + 6, 32, logo - 12, PDF_COLORS.gold);
  cv.text(model.appName, MARGIN + logo + 8, 220, 42, { size: 11, bold: true, color: PDF_COLORS.navy });
  cv.text(model.tagline, MARGIN + logo + 8, 220, 55, { size: 7, color: PDF_COLORS.muted });

  cv.text(model.title, MARGIN, CONTENT_W, 142, { size: 22, bold: true, color: PDF_COLORS.navy }, 'center');
  cv.wrap(model.monthsValue, CONTENT_W - 40, { size: 10.5, bold: true }, 2).forEach((l, i) =>
    cv.text(l, MARGIN, CONTENT_W, 162 + i * 13, { size: 10.5, bold: true, color: PDF_COLORS.navy }, 'center'),
  );
  const extra = model.monthsValue.length > 70 ? 13 : 0;
  cv.text(`${model.generatedLabel}: ${model.generatedValue} · ${model.currencyNote}`, MARGIN, CONTENT_W, 177 + extra, { size: 7.5, color: PDF_COLORS.muted }, 'center');
  cv.y = 192 + extra;
}

function drawRunningHeader(cv: Canvas, model: ReportModel) {
  const h = 26;
  cv.page.drawRectangle({ x: 0, y: PAGE_H - h, width: PAGE_W, height: h, color: PDF_COLORS.navy });
  cv.page.drawRectangle({ x: 0, y: PAGE_H - h - 2, width: PAGE_W, height: 2, color: PDF_COLORS.goldLight });
  cv.text(model.title, MARGIN, CONTENT_W / 2, 17, { size: 9.5, bold: true, color: PDF_COLORS.paper });
  cv.text(cv.truncate(model.monthsValue, CONTENT_W / 2, { size: 7.5 }), MARGIN + CONTENT_W / 2, CONTENT_W / 2, 17, { size: 7.5, color: PDF_COLORS.goldLight }, 'end');
  cv.y = h + 14;
}

function drawFooters(cv: Canvas, model: ReportModel) {
  const total = cv.pages.length;
  cv.pages.forEach((p, i) => {
    cv.page = p;
    const y = PAGE_H - MARGIN + 8;
    cv.line(MARGIN, y - 11, MARGIN + CONTENT_W, y - 11, PDF_COLORS.goldLight, 0.6);
    const small = { size: 6.4, color: PDF_COLORS.muted };
    cv.text(cv.truncate(`${model.labels.issuedOn}: ${model.generatedValue}`, CONTENT_W * 0.38, small), MARGIN, CONTENT_W * 0.38, y, small);
    cv.text(cv.truncate(model.appName, CONTENT_W * 0.28, { size: 6.4, bold: true }), MARGIN + CONTENT_W * 0.38, CONTENT_W * 0.28, y, { size: 6.4, bold: true, color: PDF_COLORS.gold }, 'center');
    cv.text(cv.truncate(model.pageLabel(i + 1, total), CONTENT_W * 0.32, small), MARGIN + CONTENT_W * 0.68, CONTENT_W * 0.32, y, small, 'end');
  });
}

function bottomLimit() {
  return PAGE_H - MARGIN - FOOTER_H;
}

function sectionTitle(cv: Canvas, title: string, size = 11.5) {
  cv.text(title, MARGIN, CONTENT_W, cv.y + size, { size, bold: true, color: PDF_COLORS.navy });
  cv.y += size + 9;
}

function monthTitle(cv: Canvas, title: string) {
  cv.rect(MARGIN, cv.y, 3.5, 15, PDF_COLORS.gold);
  cv.text(title, MARGIN + 9, CONTENT_W - 9, cv.y + 12, { size: 11, bold: true, color: PDF_COLORS.navy });
  cv.y += 22;
}

/** Headline cards (inflow / outflow / net flow) with an icon on the end side, as in the design. */
function drawHeadlineCards(cv: Canvas, model: ReportModel) {
  const gap = 10;
  const h = 50;
  const w = (CONTENT_W - gap * 2) / 3;
  model.headline.forEach((s, i) => {
    const start = MARGIN + i * (w + gap);
    const pink = s.tone === 'coral';
    const green = s.tone === 'green';
    const fill = pink ? PDF_COLORS.pinkCard : green ? PDF_COLORS.greenTint : PDF_COLORS.ivoryCard;
    const border = pink ? PDF_COLORS.pinkBorder : green ? PDF_COLORS.greenBorder : PDF_COLORS.cardBorder;
    cv.rect(start, cv.y, w, h, fill, border, 0.8);
    const color = toneColor[s.tone === 'navy' ? 'gold' : s.tone];
    cv.icon(s.icon, start + w - 30, cv.y + 13, 22, color);
    const textW = w - 44;
    cv.text(cv.truncate(s.label, textW, { size: 7.8, bold: true }), start + 9, textW, cv.y + 18, { size: 7.8, bold: true, color: pink ? PDF_COLORS.coral : green ? PDF_COLORS.green : PDF_COLORS.navy });
    const size = cv.width(s.value, { size: 12, bold: true }) > textW ? 9 : 12;
    cv.text(cv.truncate(s.value, textW, { size, bold: true }), start + 9, textW, cv.y + 38, { size, bold: true, color: pink ? PDF_COLORS.coral : green ? PDF_COLORS.green : PDF_COLORS.navy });
  });
  cv.y += h + 8;
}

function drawBalanceCards(cv: Canvas, stats: { label: string; value: string; tone: Tone }[], baseHeight = 38) {
  const gap = 8;
  const twoLine = stats.some((s) => cv.width(s.label, { size: 6.5, bold: true }) > (CONTENT_W - gap * (stats.length - 1)) / stats.length - 14);
  const height = baseHeight + (twoLine ? 8 : 0);
  const w = (CONTENT_W - gap * (stats.length - 1)) / stats.length;
  stats.forEach((s, i) => {
    const start = MARGIN + i * (w + gap);
    cv.rect(start, cv.y, w, height, PDF_COLORS.white, PDF_COLORS.border, 0.7);
    cv.rect(start, cv.y, 3, height, toneColor[s.tone]);
    const labelLines = cv.wrap(s.label, w - 14, { size: 6.5, bold: true }, 2);
    labelLines.forEach((l, j) => cv.text(l, start + 9, w - 14, cv.y + 11 + j * 8, { size: 6.5, bold: true, color: PDF_COLORS.muted }));
    const size = cv.width(s.value, { size: 9.5, bold: true }) > w - 14 ? 7.2 : 9.5;
    cv.text(cv.truncate(s.value, w - 14, { size, bold: true }), start + 9, w - 14, cv.y + height - 9, { size, bold: true, color: toneColor[s.tone] });
  });
  cv.y += height + 12;
}

// ---------------------------------------------------------------------------
// Charts (vector, drawn in start-relative coordinates so RTL mirrors time axes and legends)

interface Box {
  start: number;
  top: number;
  width: number;
  height: number;
}

function chartFrame(cv: Canvas, box: Box, title: string): Box {
  cv.rect(box.start, box.top, box.width, box.height, PDF_COLORS.white, PDF_COLORS.border, 0.7);
  cv.text(title, box.start + 8, box.width - 16, box.top + 15, { size: 8.8, bold: true, color: PDF_COLORS.navy }, 'center');
  return { start: box.start + 10, top: box.top + 24, width: box.width - 20, height: box.height - 32 };
}

function legend(cv: Canvas, items: { label: string; color: RGB }[], center: number, top: number) {
  const widths = items.map((it) => cv.width(it.label, { size: 6.8 }) + 18);
  let x = center - widths.reduce((a, b) => a + b, 0) / 2;
  items.forEach((it, i) => {
    cv.circle(x + 3.5, top - 2.5, 3.2, it.color);
    cv.text(it.label, x + 9, widths[i], top, { size: 6.8, color: PDF_COLORS.muted });
    x += widths[i];
  });
}

function compactAmount(fils: number): string {
  return formatAmount(fils).replace(/\.\d{3}$/, '');
}

/** "Inflow and outflow over the period": grouped monthly bars (gold / coral / amber). */
function drawPeriodChart(cv: Canvas, box: Box, model: ReportModel) {
  const p = chartFrame(cv, box, model.labels.periodChart);
  const months = model.charts.monthly;
  const hasDue = months.some((m) => m.dueFils > 0);
  legend(
    cv,
    [
      { label: model.labels.inflow, color: PDF_COLORS.green },
      { label: model.labels.outflow, color: PDF_COLORS.coral },
      ...(hasDue ? [{ label: model.labels.due, color: PDF_COLORS.amber }] : []),
    ],
    p.start + p.width / 2,
    p.top + 4,
  );
  if (!months.length) return;
  const axisW = 34;
  const plot = { start: p.start + axisW, top: p.top + 14, width: p.width - axisW, height: p.height - 30 };
  const max = Math.max(1, ...months.flatMap((m) => [m.inflowFils, m.outflowFils, m.dueFils]));
  for (let g = 0; g <= 4; g++) {
    const y = plot.top + plot.height - (plot.height * g) / 4;
    cv.line(plot.start, y, plot.start + plot.width, y, PDF_COLORS.border, 0.4);
    cv.text(compactAmount(Math.round((max * g) / 4)), p.start, axisW - 4, y + 2.2, { size: 5.6, color: PDF_COLORS.muted }, 'end');
  }
  const slot = plot.width / months.length;
  const series = hasDue ? 3 : 2;
  const bw = Math.min(13, (slot - 8) / series);
  months.forEach((m, i) => {
    const base = plot.top + plot.height;
    const center = plot.start + i * slot + slot / 2;
    const vals: [number, RGB][] = [
      [m.inflowFils, PDF_COLORS.green],
      [m.outflowFils, PDF_COLORS.coral],
      ...(hasDue ? ([[m.dueFils, PDF_COLORS.amber]] as [number, RGB][]) : []),
    ];
    vals.forEach(([v, c], j) => {
      const h = (v / max) * plot.height;
      if (h > 0) cv.rect(center - (bw * series) / 2 + j * bw, base - h, bw - 1, h, c);
    });
    const label = months.length > 6 ? m.label.replace(/^(\S{3})\S*/, '$1') : m.label.replace(/\s\d{4}$/, '');
    cv.text(cv.truncate(label, slot - 2, { size: 6 }), plot.start + i * slot, slot, base + 9, { size: 6, color: PDF_COLORS.muted }, 'center');
  });
}

/** Ring segment path in physical page coordinates (angles clockwise from 12 o'clock). */
function ringSegment(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const pt = (r: number, a: number) => `${(cx + r * Math.sin(a)).toFixed(2)} ${(cy - r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${pt(r1, a0)} A${r1} ${r1} 0 ${large} 1 ${pt(r1, a1)} L${pt(r0, a1)} A${r0} ${r0} 0 ${large} 0 ${pt(r0, a0)} Z`;
}

/** "Outflow by category": donut with the total in the centre and a legend with percentages. */
function drawDonutChart(cv: Canvas, box: Box, model: ReportModel) {
  const p = chartFrame(cv, box, model.labels.outflowByCategory);
  const cats = model.charts.categories.slice(0, 6);
  const rest = model.charts.categories.slice(6).reduce((s, c) => s + c.fils, 0);
  const items = rest > 0 ? [...cats, { name: '…', fils: rest }] : cats;
  const total = items.reduce((s, c) => s + c.fils, 0);
  if (!total) return;
  const r1 = Math.min(p.height / 2 - 4, p.width * 0.22);
  const r0 = r1 * 0.58;
  // Donut on the end side, legend on the start side (mirrors with the language).
  const cxStart = p.start + p.width - r1 - 4;
  const cx = px(cv, cxStart);
  const cy = p.top + p.height / 2 + 2;
  let a = 0;
  items.forEach((c, i) => {
    const sweep = (c.fils / total) * Math.PI * 2;
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    if (sweep >= Math.PI * 2 - 1e-6) {
      cv.path(ringSegment(cx, cy, r0, r1, 0, Math.PI), color);
      cv.path(ringSegment(cx, cy, r0, r1, Math.PI, Math.PI * 2), color);
    } else cv.path(ringSegment(cx, cy, r0, r1, a, a + sweep), color);
    a += sweep;
  });
  const totalText = formatAmount(total);
  cv.text(totalText, cxStart - r0, r0 * 2, cy + 1, { size: 8, bold: true, color: PDF_COLORS.navy }, 'center');
  cv.text(model.language === 'en' ? 'KWD' : 'د.ك', cxStart - r0, r0 * 2, cy + 10, { size: 6.5, color: PDF_COLORS.muted }, 'center');
  const legendW = p.width - r1 * 2 - 16;
  const rowH = Math.min(15, p.height / items.length);
  const top = cy - (rowH * items.length) / 2 + rowH / 2;
  items.forEach((c, i) => {
    const y = top + i * rowH;
    cv.circle(p.start + 4, y - 2.4, 3.2, CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
    const pct = Math.round((c.fils * 1000) / total);
    const pctText = `${Math.trunc(pct / 10)}.${pct % 10}%`;
    cv.text(pctText, p.start + 12, legendW - 12, y, { size: 6.8, bold: true, color: PDF_COLORS.navy }, 'end');
    cv.text(cv.truncate(c.name, legendW - 50, { size: 6.8 }), p.start + 12, legendW - 50, y, { size: 6.8, color: PDF_COLORS.text });
  });
}

function drawTrendChart(cv: Canvas, box: Box, model: ReportModel) {
  const p = chartFrame(cv, box, model.labels.balanceTrend);
  const pts = model.charts.trend;
  if (!pts.length) return;
  const values = pts.map((x) => x.balanceFils);
  let min = Math.min(...values, 0);
  let max = Math.max(...values);
  if (max === min) {
    max += 1000;
    min -= 1000;
  }
  const axisW = 38;
  const plot = { start: p.start + axisW, top: p.top + 4, width: p.width - axisW - 6, height: p.height - 16 };
  for (let g = 0; g <= 3; g++) {
    const v = min + ((max - min) * g) / 3;
    const y = plot.top + plot.height - (plot.height * g) / 3;
    cv.line(plot.start, y, plot.start + plot.width, y, PDF_COLORS.border, 0.4);
    cv.text(compactAmount(Math.round(v)), p.start, axisW - 4, y + 2.2, { size: 5.6, color: PDF_COLORS.muted }, 'end');
  }
  if (min < 0 && max > 0) {
    const y0 = plot.top + plot.height - ((0 - min) / (max - min)) * plot.height;
    cv.line(plot.start, y0, plot.start + plot.width, y0, PDF_COLORS.coral, 0.6);
  }
  const xAt = (i: number) => plot.start + (pts.length === 1 ? plot.width / 2 : (plot.width * i) / (pts.length - 1));
  const yAt = (v: number) => plot.top + plot.height - ((v - min) / (max - min)) * plot.height;
  for (let i = 1; i < pts.length; i++) cv.line(xAt(i - 1), yAt(values[i - 1]), xAt(i), yAt(values[i]), PDF_COLORS.gold, 1.4);
  pts.forEach((pt, i) => cv.circle(xAt(i), yAt(pt.balanceFils), pts.length > 40 ? 0.9 : 1.6, pt.balanceFils < 0 ? PDF_COLORS.coral : PDF_COLORS.navy));
  cv.text(pts[0].label, plot.start, 60, plot.top + plot.height + 10, { size: 5.8, color: PDF_COLORS.muted }, 'start');
  cv.text(pts[pts.length - 1].label, plot.start + plot.width - 60, 60, plot.top + plot.height + 10, { size: 5.8, color: PDF_COLORS.muted }, 'end');
  cv.text(`${model.labels.balance}: ${formatAmount(values[values.length - 1])}`, box.start + 8, box.width - 16, box.top + 15, { size: 7, bold: true, color: PDF_COLORS.gold }, 'end');
}

/** Total inflow vs outflow (and unpaid commitments) for the whole period. */
function drawInOutChart(cv: Canvas, box: Box, model: ReportModel) {
  const p = chartFrame(cv, box, model.labels.inflowVsOutflow);
  const bars = [
    { label: model.labels.inflow, fils: model.charts.inflowFils, color: PDF_COLORS.green },
    { label: model.labels.outflow, fils: model.charts.outflowFils, color: PDF_COLORS.coral },
    { label: model.labels.due, fils: model.charts.dueFils, color: PDF_COLORS.amber },
  ];
  const max = Math.max(1, ...bars.map((b) => b.fils));
  const plotH = p.height - 30;
  const slot = p.width / bars.length;
  const bw = Math.min(26, slot * 0.5);
  const base = p.top + 10 + plotH;
  bars.forEach((b, i) => {
    const h = (b.fils / max) * plotH;
    const start = p.start + i * slot + (slot - bw) / 2;
    if (h > 0) cv.rect(start, base - h, bw, h, b.color);
    cv.text(formatAmount(b.fils), p.start + i * slot, slot, base - h - 3, { size: 5.8, bold: true, color: PDF_COLORS.text }, 'center');
    cv.text(cv.truncate(b.label, slot - 2, { size: 6 }), p.start + i * slot, slot, base + 9, { size: 6, color: PDF_COLORS.muted }, 'center');
  });
  cv.line(p.start, base, p.start + p.width, base, PDF_COLORS.border, 0.6);
}

// ---------------------------------------------------------------------------
// Tables

function drawSimpleTable(cv: Canvas, headers: string[], rows: string[][], onNewPage: () => void) {
  const cols = layoutColumns(headers.map((h, i) => ({ key: `c${i}`, label: h, weight: i === 0 ? 2 : 1.4, numeric: i > 0 })));
  const needHeader = headerHeight(cv, cols).height;
  if (cv.y + needHeader + 20 > bottomLimit()) onNewPage();
  drawHeader(cv, cols);
  rows.forEach((r, idx) => {
    const row: BodyRow = { cells: Object.fromEntries(r.map((v, i) => [`c${i}`, [v]])), fill: idx % 2 ? PDF_COLORS.rowAlt : PDF_COLORS.white, boldKeys: ['c0'] };
    const prepared = prepareRow(cv, cols, row);
    if (cv.y + prepared.height > bottomLimit()) {
      onNewPage();
      drawHeader(cv, cols);
    }
    drawRow(cv, cols, row, prepared);
  });
  cv.y += 14;
}

function drawLedgerSection(cv: Canvas, model: ReportModel, sectionIndex: number, onNewPage: () => void) {
  const section = model.sections[sectionIndex];
  const cols = layoutColumns(model.columns);
  const head = headerHeight(cv, cols).height;
  // Keep the title, stats and at least the header plus one row together.
  if (cv.y + 22 + 50 + head + 24 > bottomLimit()) onNewPage();
  monthTitle(cv, section.title);
  drawBalanceCards(cv, section.stats, 34);
  drawHeader(cv, cols);
  if (!section.rows.length) {
    cv.rect(MARGIN, cv.y, CONTENT_W, 20, PDF_COLORS.white, PDF_COLORS.border, 0.4);
    cv.text(section.emptyText, MARGIN, CONTENT_W, cv.y + 13, { size: 8, color: PDF_COLORS.muted }, 'center');
    cv.y += 20;
  }
  section.rows.forEach((r, i) => {
    const row = ledgerBodyRow(r, i);
    const prepared = prepareRow(cv, cols, row);
    if (cv.y + prepared.height > bottomLimit()) {
      onNewPage();
      cv.text(`${section.title} ${model.labels.continued}`, MARGIN, CONTENT_W, cv.y + 9, { size: 9, bold: true, color: PDF_COLORS.navy });
      cv.y += 16;
      drawHeader(cv, cols); // repeating table header on every page
    }
    drawRow(cv, cols, row, prepared);
  });
  cv.y += 16;
}

// ---------------------------------------------------------------------------

export async function renderReportPdf(model: ReportModel, fonts: ReportFonts): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // subset:false keeps the full OpenType GSUB tables so Arabic joining forms render correctly.
  const regular = await doc.embedFont(fonts.regular, { subset: false });
  const bold = await doc.embedFont(fonts.bold, { subset: false });
  doc.setTitle(`${model.title} — ${model.monthsValue}`);
  doc.setAuthor(model.appName);
  doc.setCreator(model.appName);
  doc.setProducer(model.appName);
  doc.setLanguage(model.language === 'en' ? 'en' : 'ar');

  const cv = new Canvas(doc, regular, bold, model.dir);
  const newPage = () => {
    cv.addPage();
    drawRunningHeader(cv, model);
  };

  // Page 1: header, summary cards, visual summary, then the ledger flows on.
  cv.addPage();
  drawCoverHeader(cv, model);
  drawHeadlineCards(cv, model);
  drawBalanceCards(cv, model.balances);
  const gap = 10;
  const half = (CONTENT_W - gap) / 2;
  const h1 = 150;
  drawPeriodChart(cv, { start: MARGIN, top: cv.y, width: half, height: h1 }, model);
  drawDonutChart(cv, { start: MARGIN + half + gap, top: cv.y, width: half, height: h1 }, model);
  cv.y += h1 + gap;
  const h2 = 104;
  const wide = CONTENT_W * 0.62;
  drawTrendChart(cv, { start: MARGIN, top: cv.y, width: wide, height: h2 }, model);
  drawInOutChart(cv, { start: MARGIN + wide + gap, top: cv.y, width: CONTENT_W - wide - gap, height: h2 }, model);
  cv.y += h2 + 16;

  // Consolidated summary (several months), then one ledger section per month with carried balances.
  if (model.sections.length > 1) {
    if (cv.y + 70 > bottomLimit()) newPage();
    sectionTitle(cv, model.labels.consolidated);
    drawSimpleTable(cv, model.consolidated.headers, model.consolidated.rows, newPage);
  }
  // Keep the heading together with the first month title, cards, table header and a row.
  if (cv.y + 150 > bottomLimit()) newPage();
  sectionTitle(cv, model.labels.transactionsDetail, 12);
  model.sections.forEach((_, i) => drawLedgerSection(cv, model, i, newPage));

  drawFooters(cv, model);
  return doc.save({ useObjectStreams: false });
}

export const PDF_PAGE = { width: PAGE_W, height: PAGE_H, margin: MARGIN, contentWidth: CONTENT_W };
