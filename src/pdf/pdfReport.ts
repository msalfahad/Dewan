/**
 * PDF LEDGER REPORT GENERATOR.
 *
 * Produces a vector PDF (real text, not a screenshot) with pdf-lib and an embedded Arabic font
 * (IBM Plex Sans Arabic, which also covers Latin). Arabic is shaped by fontkit so letters stay
 * connected, and mixed Arabic/English/number strings are ordered with the Unicode bidi algorithm
 * (bidiText.ts). Arabic and bilingual reports are laid out right-to-left (columns, charts,
 * legends and alignment mirrored); English reports left-to-right.
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

export interface ReportFonts {
  regular: Uint8Array | ArrayBuffer;
  bold: Uint8Array | ArrayBuffer;
}

const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

/** Print palette: warm ivory paper, dark navy, champagne gold, coral outflows, amber dues. No green. */
export const PDF_COLORS = {
  paper: hex('#FBF8F1'),
  white: hex('#FFFFFF'),
  navy: hex('#0B1428'),
  navySoft: hex('#1C2A4A'),
  gold: hex('#B8955A'),
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
  border: hex('#D6CCB8'),
  rowAlt: hex('#F6F1E6'),
};

const CATEGORY_COLORS = [PDF_COLORS.coral, PDF_COLORS.gold, PDF_COLORS.amber, PDF_COLORS.blue, PDF_COLORS.silver, hex('#C9B99A'), hex('#8C7A5B'), hex('#7D8BA3')];

const toneColor: Record<Tone, RGB> = {
  gold: PDF_COLORS.gold,
  coral: PDF_COLORS.coral,
  amber: PDF_COLORS.amber,
  navy: PDF_COLORS.navy,
  blue: PDF_COLORS.blue,
};

const PAGE_W = 841.89; // A4 landscape
const PAGE_H = 595.28;
const MARGIN = 28;
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

const CELL_PAD = 4;
const BODY: TextOpts = { size: 7.6 };
const LINE_H = 9.6;
const HEAD: TextOpts = { size: 7.6, bold: true, color: PDF_COLORS.paper };

function headerHeight(cv: Canvas, cols: ColumnLayout[]): { height: number; lines: string[][] } {
  const lines = cols.map((c) => cv.wrap(c.label, c.width - CELL_PAD * 2, HEAD, 2));
  const maxLines = Math.max(...lines.map((l) => l.length));
  return { height: maxLines * LINE_H + CELL_PAD * 2, lines };
}

function drawHeader(cv: Canvas, cols: ColumnLayout[]) {
  const { height, lines } = headerHeight(cv, cols);
  const top = cv.y;
  cols.forEach((c, i) => {
    cv.rect(c.start, top, c.width, height, c.key === 'balance' ? PDF_COLORS.gold : PDF_COLORS.navy, PDF_COLORS.navySoft);
    lines[i].forEach((l, j) => cv.text(l, c.start + CELL_PAD, c.width - CELL_PAD * 2, top + CELL_PAD + 7 + j * LINE_H, HEAD, c.numeric ? 'center' : 'start'));
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
      inflow: r.isPendingInflow ? PDF_COLORS.muted : PDF_COLORS.gold,
      outflow: r.isUnpaidOutflow ? PDF_COLORS.amber : PDF_COLORS.coral,
      balance: r.balanceFils < 0 ? PDF_COLORS.coral : PDF_COLORS.navy,
    },
    boldKeys: ['balance', ...(r.kind === 'opening' ? ['description'] : [])],
  };
}

// ---------------------------------------------------------------------------
// Page furniture

function drawCoverHeader(cv: Canvas, model: ReportModel) {
  const h = 84;
  cv.page.drawRectangle({ x: 0, y: PAGE_H - h, width: PAGE_W, height: h, color: PDF_COLORS.navy });
  cv.page.drawRectangle({ x: 0, y: PAGE_H - h - 3, width: PAGE_W, height: 3, color: PDF_COLORS.goldLight });
  const half = CONTENT_W / 2;
  cv.text(model.title, MARGIN, half, 36, { size: 20, bold: true, color: PDF_COLORS.paper });
  cv.text(model.subtitle, MARGIN, half, 54, { size: 10.5, color: PDF_COLORS.goldLight });
  cv.text(model.currencyNote, MARGIN, half, 70, { size: 7.5, color: PDF_COLORS.silver });
  const endStart = MARGIN + half;
  cv.text(`${model.generatedLabel}: ${model.generatedValue}`, endStart, half, 32, { size: 8.5, color: PDF_COLORS.paper }, 'end');
  cv.text(model.monthsLabel, endStart, half, 47, { size: 8.5, bold: true, color: PDF_COLORS.goldLight }, 'end');
  cv.wrap(model.monthsValue, half, { size: 8 }, 2).forEach((l, i) => cv.text(l, endStart, half, 60 + i * 10, { size: 8, color: PDF_COLORS.paper }, 'end'));
  cv.y = h + 14;
}

function drawRunningHeader(cv: Canvas, model: ReportModel) {
  const h = 26;
  cv.page.drawRectangle({ x: 0, y: PAGE_H - h, width: PAGE_W, height: h, color: PDF_COLORS.navy });
  cv.page.drawRectangle({ x: 0, y: PAGE_H - h - 2, width: PAGE_W, height: 2, color: PDF_COLORS.goldLight });
  cv.text(model.title, MARGIN, CONTENT_W / 2, 17, { size: 10, bold: true, color: PDF_COLORS.paper });
  cv.text(model.monthsValue, MARGIN + CONTENT_W / 2, CONTENT_W / 2, 17, { size: 7.5, color: PDF_COLORS.goldLight }, 'end');
  cv.y = h + 12;
}

function drawFooters(cv: Canvas, model: ReportModel) {
  const total = cv.pages.length;
  cv.pages.forEach((p, i) => {
    cv.page = p;
    const y = PAGE_H - MARGIN + 6;
    cv.line(MARGIN, y - 10, MARGIN + CONTENT_W, y - 10, PDF_COLORS.goldLight, 0.6);
    cv.text(`${model.footer} · ${model.generatedValue}`, MARGIN, CONTENT_W * 0.7, y, { size: 7, color: PDF_COLORS.muted });
    cv.text(model.pageLabel(i + 1, total), MARGIN + CONTENT_W * 0.7, CONTENT_W * 0.3, y, { size: 7, color: PDF_COLORS.muted }, 'end');
  });
}

function bottomLimit() {
  return PAGE_H - MARGIN - FOOTER_H;
}

function sectionTitle(cv: Canvas, title: string, size = 12.5) {
  cv.rect(MARGIN, cv.y, 4, size + 4, PDF_COLORS.gold);
  cv.text(title, MARGIN + 10, CONTENT_W - 10, cv.y + size, { size, bold: true, color: PDF_COLORS.navy });
  cv.y += size + 12;
}

function drawStatCards(cv: Canvas, stats: { label: string; value: string; tone: Tone }[], height = 46) {
  const gap = 8;
  const w = (CONTENT_W - gap * (stats.length - 1)) / stats.length;
  stats.forEach((s, i) => {
    const start = MARGIN + i * (w + gap);
    cv.rect(start, cv.y, w, height, PDF_COLORS.white, PDF_COLORS.border, 0.6);
    cv.rect(start, cv.y, w, 3, toneColor[s.tone]);
    cv.wrap(s.label, w - 12, { size: 7.2, bold: true }, 2).forEach((l, j) => cv.text(l, start + 6, w - 12, cv.y + 13 + j * 8.5, { size: 7.2, bold: true, color: PDF_COLORS.muted }));
    const valueLines = cv.wrap(s.value, w - 12, { size: 9.5, bold: true }, 2);
    valueLines.forEach((l, j) =>
      cv.text(l, start + 6, w - 12, cv.y + height - 7 - (valueLines.length - 1 - j) * 10.5, { size: valueLines.length > 1 ? 8.2 : 9.5, bold: true, color: toneColor[s.tone] }),
    );
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
  cv.rect(box.start, box.top, box.width, box.height, PDF_COLORS.white, PDF_COLORS.border, 0.6);
  cv.text(title, box.start + 8, box.width - 16, box.top + 14, { size: 8.5, bold: true, color: PDF_COLORS.navy });
  return { start: box.start + 10, top: box.top + 24, width: box.width - 20, height: box.height - 32 };
}

function legend(cv: Canvas, items: { label: string; color: RGB }[], start: number, top: number) {
  let x = start;
  for (const it of items) {
    cv.rect(x, top - 6, 7, 7, it.color);
    const w = cv.width(it.label, { size: 7 });
    cv.text(it.label, x + 10, w + 2, top, { size: 7, color: PDF_COLORS.muted });
    x += w + 22;
  }
}

function compactAmount(fils: number): string {
  return formatAmount(fils).replace(/\.\d{3}$/, '');
}

function drawInOutChart(cv: Canvas, box: Box, model: ReportModel) {
  const p = chartFrame(cv, box, model.labels.inflowVsOutflow);
  const bars = [
    { label: model.labels.inflow, fils: model.charts.inflowFils, color: PDF_COLORS.gold },
    { label: model.labels.outflow, fils: model.charts.outflowFils, color: PDF_COLORS.coral },
    { label: model.summary[4].label, fils: model.charts.dueFils, color: PDF_COLORS.amber },
  ];
  const max = Math.max(1, ...bars.map((b) => b.fils));
  const plotH = p.height - 30;
  const slot = p.width / bars.length;
  const bw = Math.min(46, slot * 0.5);
  bars.forEach((b, i) => {
    const h = (b.fils / max) * plotH;
    const start = p.start + i * slot + (slot - bw) / 2;
    const base = p.top + 10 + plotH;
    if (h > 0) cv.rect(start, base - h, bw, h, b.color);
    cv.text(formatAmount(b.fils), p.start + i * slot, slot, base - h - 3, { size: 7, bold: true, color: PDF_COLORS.text }, 'center');
    cv.wrap(b.label, slot - 4, { size: 6.8 }, 2).forEach((l, j) => cv.text(l, p.start + i * slot, slot, base + 10 + j * 8, { size: 6.8, color: PDF_COLORS.muted }, 'center'));
  });
  cv.line(p.start, p.top + 10 + plotH, p.start + p.width, p.top + 10 + plotH, PDF_COLORS.border, 0.6);
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
  const axisW = 44;
  const plot = { start: p.start + axisW, top: p.top + 4, width: p.width - axisW - 4, height: p.height - 18 };
  for (let g = 0; g <= 3; g++) {
    const v = min + ((max - min) * g) / 3;
    const y = plot.top + plot.height - (plot.height * g) / 3;
    cv.line(plot.start, y, plot.start + plot.width, y, PDF_COLORS.border, 0.4);
    cv.text(compactAmount(Math.round(v)), p.start, axisW - 4, y + 2.5, { size: 6.2, color: PDF_COLORS.muted }, 'end');
  }
  if (min < 0 && max > 0) {
    const y0 = plot.top + plot.height - ((0 - min) / (max - min)) * plot.height;
    cv.line(plot.start, y0, plot.start + plot.width, y0, PDF_COLORS.coral, 0.6);
  }
  const xAt = (i: number) => plot.start + (pts.length === 1 ? plot.width / 2 : (plot.width * i) / (pts.length - 1));
  const yAt = (v: number) => plot.top + plot.height - ((v - min) / (max - min)) * plot.height;
  for (let i = 1; i < pts.length; i++) cv.line(xAt(i - 1), yAt(values[i - 1]), xAt(i), yAt(values[i]), PDF_COLORS.gold, 1.4);
  pts.forEach((pt, i) => cv.circle(xAt(i), yAt(pt.balanceFils), pts.length > 40 ? 0.9 : 1.6, pt.balanceFils < 0 ? PDF_COLORS.coral : PDF_COLORS.navy));
  cv.text(pts[0].label, plot.start, 60, plot.top + plot.height + 11, { size: 6.2, color: PDF_COLORS.muted }, 'start');
  cv.text(pts[pts.length - 1].label, plot.start + plot.width - 60, 60, plot.top + plot.height + 11, { size: 6.2, color: PDF_COLORS.muted }, 'end');
  const last = values[values.length - 1];
  cv.text(`${model.labels.balance}: ${formatAmount(last)}`, p.start, p.width, p.top - 10, { size: 7.5, bold: true, color: PDF_COLORS.navy }, 'end');
}

function drawCategoryChart(cv: Canvas, box: Box, model: ReportModel) {
  const p = chartFrame(cv, box, model.labels.byCategory);
  const cats = model.charts.categories.slice(0, 7);
  if (!cats.length) return;
  const total = cats.reduce((s, c) => s + c.fils, 0) || 1;
  const max = Math.max(1, ...cats.map((c) => c.fils));
  const labelW = p.width * 0.34;
  const valueW = 72;
  const barMax = p.width - labelW - valueW - 8;
  const rowH = Math.min(16, p.height / cats.length);
  cats.forEach((c, i) => {
    const y = p.top + i * rowH;
    cv.text(cv.truncate(c.name, labelW - 4, { size: 7 }), p.start, labelW - 4, y + rowH * 0.62, { size: 7, color: PDF_COLORS.text });
    const w = Math.max(1, (c.fils / max) * barMax);
    cv.rect(p.start + labelW, y + rowH * 0.18, w, rowH * 0.6, CATEGORY_COLORS[i % CATEGORY_COLORS.length]);
    const pct = Math.round((c.fils * 1000) / total);
    cv.text(`${formatAmount(c.fils)}  ${Math.trunc(pct / 10)}.${pct % 10}%`, p.start + labelW + w + 4, valueW + 20, y + rowH * 0.62, { size: 6.6, color: PDF_COLORS.muted });
  });
}

function drawMonthlyChart(cv: Canvas, box: Box, model: ReportModel) {
  const p = chartFrame(cv, box, model.labels.monthlyComparison);
  const months = model.charts.monthly;
  legend(cv, [
    { label: model.labels.inflow, color: PDF_COLORS.gold },
    { label: model.labels.outflow, color: PDF_COLORS.coral },
    { label: model.labels.due, color: PDF_COLORS.amber },
  ], p.start, p.top + 2);
  if (!months.length) return;
  const max = Math.max(1, ...months.flatMap((m) => [m.inflowFils, m.outflowFils, m.dueFils]));
  const plotTop = p.top + 12;
  const plotH = p.height - 34;
  const slot = p.width / months.length;
  const bw = Math.min(16, (slot - 8) / 3);
  months.forEach((m, i) => {
    const base = plotTop + plotH;
    const center = p.start + i * slot + slot / 2;
    const hi = (m.inflowFils / max) * plotH;
    const ho = (m.outflowFils / max) * plotH;
    const hd = (m.dueFils / max) * plotH;
    if (hi > 0) cv.rect(center - bw * 1.5 - 1, base - hi, bw, hi, PDF_COLORS.gold);
    if (ho > 0) cv.rect(center - bw / 2, base - ho, bw, ho, PDF_COLORS.coral);
    if (hd > 0) cv.rect(center + bw / 2 + 1, base - hd, bw, hd, PDF_COLORS.amber);
    const label = months.length > 8 ? m.label.replace(/^(\S{3})\S*/, '$1') : m.label;
    cv.text(cv.truncate(label, slot - 2, { size: 6.4 }), p.start + i * slot, slot, base + 10, { size: 6.4, color: PDF_COLORS.muted }, 'center');
  });
  cv.line(p.start, plotTop + plotH, p.start + p.width, plotTop + plotH, PDF_COLORS.border, 0.6);
}

// ---------------------------------------------------------------------------
// Tables

function drawSimpleTable(cv: Canvas, model: ReportModel, headers: string[], rows: string[][], onNewPage: () => void) {
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
  void model;
  cv.y += 14;
}

function drawLedgerSection(cv: Canvas, model: ReportModel, sectionIndex: number, onNewPage: () => void) {
  const section = model.sections[sectionIndex];
  const cols = layoutColumns(model.columns);
  const head = headerHeight(cv, cols).height;
  // Keep the title, stats and at least the header plus one row together.
  if (cv.y + 20 + 58 + head + 24 > bottomLimit()) onNewPage();
  sectionTitle(cv, section.title, 12);
  drawStatCards(cv, section.stats, 40);
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
  cv.y += 18;
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

  // Page 1: header, summary, visual summary
  cv.addPage();
  drawCoverHeader(cv, model);
  drawStatCards(cv, model.summary, 50);
  sectionTitle(cv, model.labels.visualSummary, 11);
  const gap = 10;
  const chartW = (CONTENT_W - gap) / 2;
  const available = bottomLimit() - cv.y - gap;
  const chartH = Math.max(120, available / 2);
  const top1 = cv.y;
  const top2 = cv.y + chartH + gap;
  drawInOutChart(cv, { start: MARGIN, top: top1, width: chartW, height: chartH }, model);
  drawTrendChart(cv, { start: MARGIN + chartW + gap, top: top1, width: chartW, height: chartH }, model);
  drawCategoryChart(cv, { start: MARGIN, top: top2, width: chartW, height: chartH }, model);
  drawMonthlyChart(cv, { start: MARGIN + chartW + gap, top: top2, width: chartW, height: chartH }, model);

  // Consolidated summary, then one ledger section per month (balances carried forward).
  newPage();
  sectionTitle(cv, model.labels.consolidated, 12);
  drawSimpleTable(cv, model, model.consolidated.headers, model.consolidated.rows, newPage);
  sectionTitle(cv, model.labels.detailedLedger, 13);
  model.sections.forEach((_, i) => drawLedgerSection(cv, model, i, newPage));

  drawFooters(cv, model);
  return doc.save({ useObjectStreams: false });
}

export const PDF_PAGE = { width: PAGE_W, height: PAGE_H, margin: MARGIN, contentWidth: CONTENT_W };
