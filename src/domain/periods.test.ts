import { describe, expect, it } from 'vitest';
import { buildLedger } from './ledger';
import { buildMonthSection, buildPeriodReport } from './periods';
import { coffeeBeans, OPENING_1000, tx } from '../test/fixtures';

const TODAY = '2026-12-31';

function data() {
  return [
    coffeeBeans(), // Sep: -50
    tx({ transactionType: 'inflow', amountFils: 200_000, date: '2026-09-07' }), // Sep: +200
    tx({ transactionType: 'outflow', amountFils: 100_000, date: '2026-10-10' }), // Oct: -100
    tx({ transactionType: 'outflow', amountFils: 20_000, date: '2026-11-03' }), // Nov: -20
    tx({ transactionType: 'inflow', amountFils: 5_000, date: '2027-01-15' }), // Jan 2027: +5
    tx({ transactionType: 'outflow', amountFils: 40_000, date: '2026-11-20', status: 'due' }), // Nov: due 40
  ];
}

describe('multi-month carry-forward', () => {
  const ledger = buildLedger(OPENING_1000, data(), TODAY);

  it('carries the closing balance of one month into the next (no reset to zero)', () => {
    const report = buildPeriodReport(ledger, ['2026-09', '2026-10', '2026-11']);
    const [sep, oct, nov] = report.sections;
    expect(sep.openingFils).toBe(1_000_000);
    expect(sep.closingFils).toBe(1_150_000);
    expect(oct.openingFils).toBe(1_150_000);
    expect(oct.closingFils).toBe(1_050_000);
    expect(nov.openingFils).toBe(1_050_000);
    expect(nov.closingFils).toBe(1_030_000);
    expect(nov.unpaidFils).toBe(40_000);
    for (const s of report.sections) expect(s.openingFils + s.inflowFils - s.outflowFils).toBe(s.closingFils);
  });

  it('handles non-consecutive months and months across years', () => {
    const report = buildPeriodReport(ledger, ['2027-01', '2026-09', '2026-11']);
    expect(report.months).toEqual(['2026-09', '2026-11', '2027-01']);
    expect(report.sections[1].openingFils).toBe(1_050_000); // includes skipped October
    expect(report.sections[2].openingFils).toBe(1_030_000); // December empty, carried
    expect(report.sections[2].closingFils).toBe(1_035_000);
    expect(report.openingFils).toBe(1_000_000);
    expect(report.closingFils).toBe(1_035_000);
    expect(report.inflowFils).toBe(205_000);
    expect(report.outflowFils).toBe(70_000);
  });

  it('empty month keeps the carried balance', () => {
    const dec = buildMonthSection(ledger, '2026-12');
    expect(dec.rows).toHaveLength(0);
    expect(dec.openingFils).toBe(1_030_000);
    expect(dec.closingFils).toBe(1_030_000);
  });

  it('keeps each row balance identical to the full ledger', () => {
    const report = buildPeriodReport(ledger, ['2026-10']);
    const full = ledger.rows.find((r) => r.date === '2026-10-10')!;
    expect(report.rows[0].balanceAfterFils).toBe(full.balanceAfterFils);
  });
});
