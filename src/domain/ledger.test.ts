import { describe, expect, it } from 'vitest';
import { buildLedger, compareTransactions, sortTransactions } from './ledger';
import { formatAmount, formatMoney } from './money';
import { markAsPaid, updateTransaction, createTransaction } from './transactions';
import { DEFAULT_CATEGORIES } from './categories';
import { coffeeBeans, OPENING_1000, tx } from '../test/fixtures';

const TODAY = '2026-09-23';
const balances = (l: ReturnType<typeof buildLedger>) => l.rows.map((r) => r.balanceAfterFils);

describe('MANDATORY: opening 1,000.000 KWD − outflow 50.000 KWD = 950.000 KWD', () => {
  it('shows 950.000 on the Coffee beans row', () => {
    const ledger = buildLedger(OPENING_1000, [coffeeBeans()], TODAY);
    const row = ledger.rows.find((r) => r.key === 'coffee')!;
    expect(row.balanceAfterFils).toBe(950_000);
    expect(formatAmount(row.balanceAfterFils)).toBe('950.000');
    expect(formatMoney(row.balanceAfterFils, 'en')).toBe('KWD 950.000');
    expect(formatMoney(row.balanceAfterFils, 'ar')).toBe('950.000 د.ك');
    expect(row.inflowFils).toBe(0);
    expect(row.outflowFils).toBe(50_000);
    expect(ledger.summary.currentBalanceFils).toBe(950_000);
  });
});

describe('opening balance', () => {
  it('is the first ledger row and the starting balance', () => {
    const ledger = buildLedger(OPENING_1000, [], TODAY);
    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0].kind).toBe('opening');
    expect(ledger.rows[0].balanceAfterFils).toBe(1_000_000);
    expect(ledger.summary.totalInflowFils).toBe(0); // not an ordinary inflow
  });

  it('is placed before same-day transactions', () => {
    const ledger = buildLedger(OPENING_1000, [tx({ transactionType: 'outflow', amountFils: 10_000, date: '2026-09-01' })], TODAY);
    expect(ledger.rows.map((r) => r.kind)).toEqual(['opening', 'transaction']);
    expect(balances(ledger)).toEqual([1_000_000, 990_000]);
  });

  it('works with no opening balance (starts at zero)', () => {
    const ledger = buildLedger(null, [tx({ transactionType: 'inflow', amountFils: 5_000, date: '2026-01-01' })], TODAY);
    expect(balances(ledger)).toEqual([5_000]);
  });
});

describe('running balance', () => {
  it('matches the specified sequence 1,000 → 950 → 1,150 → 1,050', () => {
    const ledger = buildLedger(
      OPENING_1000,
      [
        coffeeBeans(),
        tx({ transactionType: 'inflow', amountFils: 200_000, date: '2026-09-07', description: 'Family payment' }),
        tx({ transactionType: 'outflow', amountFils: 100_000, date: '2026-09-10', categoryId: 'out-maintenance', description: 'AC maintenance' }),
      ],
      TODAY,
    );
    expect(balances(ledger).map(formatAmount)).toEqual(['1,000.000', '950.000', '1,150.000', '1,050.000']);
    expect(ledger.summary.totalInflowFils).toBe(200_000);
    expect(ledger.summary.totalOutflowFils).toBe(150_000);
  });

  it('applies inflow calculations', () => {
    const ledger = buildLedger(OPENING_1000, [tx({ transactionType: 'inflow', amountFils: 6_085, date: '2026-09-02' })], TODAY);
    expect(ledger.rows[1].balanceAfterFils).toBe(1_006_085);
  });

  it('applies outflow calculations and can go negative', () => {
    const ledger = buildLedger(OPENING_1000, [tx({ transactionType: 'outflow', amountFils: 1_200_000, date: '2026-09-02' })], TODAY);
    expect(ledger.rows[1].balanceAfterFils).toBe(-200_000);
  });

  it('every row equals previous balance + inflow − outflow', () => {
    const txs = Array.from({ length: 40 }, (_, i) =>
      tx({ transactionType: i % 3 ? 'outflow' : 'inflow', amountFils: 1_000 + i * 137, date: `2026-09-${String((i % 28) + 1).padStart(2, '0')}` }),
    );
    const ledger = buildLedger(OPENING_1000, txs, TODAY);
    for (let i = 1; i < ledger.rows.length; i++) {
      const r = ledger.rows[i];
      expect(r.balanceBeforeFils).toBe(ledger.rows[i - 1].balanceAfterFils);
      expect(r.balanceAfterFils).toBe(r.balanceBeforeFils + (r.applied ? r.inflowFils - r.outflowFils : 0));
    }
  });
});

describe('same-day ordering', () => {
  it('orders by date, then created time, then document id', () => {
    const a = tx({ id: 'b', transactionType: 'outflow', amountFils: 1_000, date: '2026-09-05', createdAt: 10 });
    const b = tx({ id: 'a', transactionType: 'outflow', amountFils: 2_000, date: '2026-09-05', createdAt: 10 });
    const c = tx({ id: 'c', transactionType: 'inflow', amountFils: 3_000, date: '2026-09-05', createdAt: 5 });
    const d = tx({ id: 'd', transactionType: 'inflow', amountFils: 4_000, date: '2026-09-04', createdAt: 99 });
    expect(sortTransactions([a, b, c, d]).map((t) => t.id)).toEqual(['d', 'c', 'a', 'b']);
    expect(compareTransactions(a, a)).toBe(0);
  });

  it('is stable regardless of input order', () => {
    const list = [1, 2, 3, 4, 5].map((n) => tx({ id: `x${n}`, transactionType: 'outflow', amountFils: n * 1000, date: '2026-09-09', createdAt: 7 }));
    const l1 = buildLedger(OPENING_1000, list, TODAY);
    const l2 = buildLedger(OPENING_1000, [...list].reverse(), TODAY);
    expect(l1.rows.map((r) => [r.key, r.balanceAfterFils])).toEqual(l2.rows.map((r) => [r.key, r.balanceAfterFils]));
  });
});

describe('received vs unreceived inflow', () => {
  it('only received inflow increases the balance', () => {
    const ledger = buildLedger(
      OPENING_1000,
      [
        tx({ id: 'r', transactionType: 'inflow', amountFils: 100_000, date: '2026-09-02', status: 'received' }),
        tx({ id: 'p', transactionType: 'inflow', amountFils: 300_000, date: '2026-09-03', status: 'pending' }),
      ],
      TODAY,
    );
    expect(balances(ledger)).toEqual([1_000_000, 1_100_000, 1_100_000]);
    expect(ledger.summary.totalInflowFils).toBe(100_000);
    expect(ledger.summary.pendingInflowFils).toBe(300_000);
  });
});

describe('paid vs unpaid outflow', () => {
  it('due/overdue outflows do not reduce the cash balance but count as commitments', () => {
    const ledger = buildLedger(
      OPENING_1000,
      [
        tx({ id: 'paid', transactionType: 'outflow', amountFils: 100_000, date: '2026-09-02' }),
        tx({ id: 'due', transactionType: 'outflow', amountFils: 120_000, date: '2026-09-30', status: 'due' }),
        tx({ id: 'late', transactionType: 'outflow', amountFils: 30_000, date: '2026-09-10', status: 'due' }),
      ],
      TODAY,
    );
    expect(ledger.summary.currentBalanceFils).toBe(900_000);
    expect(ledger.summary.unpaidCommitmentsFils).toBe(150_000);
    expect(ledger.summary.balanceAfterCommitmentsFils).toBe(750_000);
    expect(ledger.rows.find((r) => r.key === 'late')!.status).toBe('overdue');
    expect(ledger.rows.find((r) => r.key === 'due')!.status).toBe('due');
    expect(ledger.rows.find((r) => r.key === 'due')!.balanceAfterFils).toBe(900_000);
  });
});

describe('marking an expense paid', () => {
  it('moves it to the actual payment date and recalculates that row and every later balance', () => {
    const salary = tx({ id: 'salary', transactionType: 'outflow', amountFils: 120_000, date: '2026-09-30', status: 'due', categoryId: 'out-salaries' });
    const later = tx({ id: 'later', transactionType: 'inflow', amountFils: 10_000, date: '2026-09-20' });
    const before = buildLedger(OPENING_1000, [coffeeBeans(), salary, later], TODAY);
    expect(before.summary.currentBalanceFils).toBe(960_000);

    const paid = markAsPaid(salary, '2026-09-15', 'cheque', 5_000);
    expect(paid.status).toBe('paid');
    expect(paid.date).toBe('2026-09-15');
    expect(paid.dueDate).toBe('2026-09-30');
    expect(paid.paymentMethod).toBe('cheque');

    const after = buildLedger(OPENING_1000, [coffeeBeans(), paid, later], TODAY);
    expect(after.rows.map((r) => r.key)).toEqual(['opening', 'coffee', 'salary', 'later']);
    expect(balances(after)).toEqual([1_000_000, 950_000, 830_000, 840_000]);
    expect(after.summary.unpaidCommitmentsFils).toBe(0);
  });
});

describe('editing and deleting historical transactions', () => {
  const groceries = DEFAULT_CATEGORIES.find((c) => c.id === 'out-groceries')!;
  const base = () => [
    coffeeBeans(),
    tx({ id: 'fam', transactionType: 'inflow', amountFils: 200_000, date: '2026-09-07' }),
    tx({ id: 'ac', transactionType: 'outflow', amountFils: 100_000, date: '2026-09-10' }),
  ];

  it('editing an old transaction recalculates every later balance', () => {
    const list = base();
    const edited = updateTransaction(list[0], {
      transactionType: 'outflow',
      date: '2026-09-05',
      description: 'حبوب قهوة',
      category: groceries,
      amountFils: 75_000,
      paymentMethod: 'cash',
      counterparty: '',
      status: 'paid',
      notes: '',
    });
    const ledger = buildLedger(OPENING_1000, [edited, list[1], list[2]], TODAY);
    expect(balances(ledger)).toEqual([1_000_000, 925_000, 1_125_000, 1_025_000]);
    expect(edited.createdAt).toBe(list[0].createdAt);
    expect(edited.id).toBe('coffee');
  });

  it('deleting an old transaction recalculates every later balance', () => {
    const list = base().filter((t) => t.id !== 'coffee');
    const ledger = buildLedger(OPENING_1000, list, TODAY);
    expect(balances(ledger)).toEqual([1_000_000, 1_200_000, 1_100_000]);
  });

  it('never stores a running balance on the transaction', () => {
    const created = createTransaction(
      { transactionType: 'outflow', date: '2026-09-05', description: 'x', category: groceries, amountFils: 1, paymentMethod: null, counterparty: '', status: 'paid', notes: '' },
      'u1',
    );
    expect(Object.keys(created).some((k) => /balance/i.test(k))).toBe(false);
  });

  it('validates category type and positive integer amounts', () => {
    const input = { transactionType: 'inflow' as const, date: '2026-09-05', description: 'x', category: groceries, amountFils: 1, paymentMethod: null, counterparty: '', status: 'received' as const, notes: '' };
    expect(() => createTransaction(input, 'u1')).toThrow('category');
    expect(() => createTransaction({ ...input, transactionType: 'outflow', status: 'paid', amountFils: 1.5 }, 'u1')).toThrow('amount');
  });
});
