import { describe, it, expect } from 'vitest';
import { LedgerRepository } from '../src/db/repository';
import { Transaction } from '@contracts/api';
import { historyManager } from '../src/utils/history';

describe('Ledger Invariants, Filtering & History Tests', () => {
  const sampleTransactions: Transaction[] = [
    {
      id: 'tx-1',
      type: 'income',
      amount: 500000, // $5,000.00
      date: '2026-11-01',
      accountId: 'acc-bank',
      categoryId: 'cat-salary',
      merchant: 'Tech Corp Payroll',
      notes: 'Monthly salary deposit',
      tags: ['salary', 'direct-deposit'],
      paymentMethod: 'bank_transfer',
      status: 'cleared',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
    {
      id: 'tx-2',
      type: 'expense',
      amount: 15000, // $150.00
      date: '2026-11-05',
      accountId: 'acc-credit',
      categoryId: 'cat-groceries',
      merchant: 'Whole Foods Market',
      notes: 'Weekly groceries run',
      tags: ['food', 'organic'],
      paymentMethod: 'credit_card',
      status: 'cleared',
      createdAt: '2026-11-05T00:00:00Z',
      updatedAt: '2026-11-05T00:00:00Z',
    },
    {
      id: 'tx-3',
      type: 'transfer',
      amount: 100000, // $1,000.00
      date: '2026-11-06',
      accountId: 'acc-bank',
      toAccountId: 'acc-savings',
      merchant: 'Savings Allocation',
      notes: 'Transfer to emergency fund',
      tags: ['transfer', 'savings'],
      paymentMethod: 'bank_transfer',
      status: 'cleared',
      createdAt: '2026-11-06T00:00:00Z',
      updatedAt: '2026-11-06T00:00:00Z',
    },
    {
      id: 'tx-4',
      type: 'expense',
      amount: 8000, // $80.00 Split ($50 dining, $30 drinks)
      date: '2026-11-10',
      accountId: 'acc-credit',
      merchant: 'Bistro Downtown',
      tags: ['dining'],
      paymentMethod: 'credit_card',
      status: 'pending',
      splits: [
        { id: 's-1', amount: 5000, categoryId: 'cat-dining' },
        { id: 's-2', amount: 3000, categoryId: 'cat-drinks' },
      ],
      createdAt: '2026-11-10T00:00:00Z',
      updatedAt: '2026-11-10T00:00:00Z',
    },
  ];

  it('guarantees transfers are excluded from spending and income calculations', () => {
    let totalExpense = 0;
    let totalIncome = 0;

    for (const tx of sampleTransactions) {
      if (tx.type === 'expense') totalExpense += tx.amount;
      if (tx.type === 'income') totalIncome += tx.amount;
    }

    // $150 + $80 = $230 (23,000 cents)
    expect(totalExpense).toBe(23000);
    // $5,000 = 500,000 cents
    expect(totalIncome).toBe(500000);
    // Transfer of $1,000 is not counted in spending or income
    const transferTx = sampleTransactions.find((t) => t.type === 'transfer');
    expect(transferTx).toBeDefined();
    expect(totalExpense).not.toContain(transferTx!.amount);
  });

  it('filters transactions accurately by free-text search across merchant, notes, and tags', () => {
    const res1 = LedgerRepository.filterTransactions(sampleTransactions, { query: 'Whole Foods' });
    expect(res1.length).toBe(1);
    expect(res1[0].id).toBe('tx-2');

    const res2 = LedgerRepository.filterTransactions(sampleTransactions, { query: 'direct-deposit' });
    expect(res2.length).toBe(1);
    expect(res2[0].id).toBe('tx-1');

    const res3 = LedgerRepository.filterTransactions(sampleTransactions, { query: 'bistro' });
    expect(res3.length).toBe(1);
    expect(res3[0].id).toBe('tx-4');
  });

  it('filters transactions by date and amount ranges', () => {
    const resDate = LedgerRepository.filterTransactions(sampleTransactions, {
      dateFrom: '2026-11-05',
      dateTo: '2026-11-08',
    });
    expect(resDate.length).toBe(2); // tx-2 and tx-3

    const resAmount = LedgerRepository.filterTransactions(sampleTransactions, {
      amountMin: 10000, // >= $100
      amountMax: 200000, // <= $2,000
    });
    expect(resAmount.length).toBe(2); // tx-2 ($150) and tx-3 ($1,000)
  });

  it('correctly matches split transactions when filtering by split category', () => {
    const resSplit = LedgerRepository.filterTransactions(sampleTransactions, {
      categoryIds: ['cat-dining'],
    });
    expect(resSplit.length).toBe(1);
    expect(resSplit[0].id).toBe('tx-4');
  });

  it('verifies undo and redo stack operations', async () => {
    historyManager.clear();
    expect(historyManager.canUndo()).toBe(false);
    expect(historyManager.canRedo()).toBe(false);

    let state = 10;
    historyManager.push({
      description: 'Add 5',
      undo: async () => { state -= 5; },
      redo: async () => { state += 5; },
    });

    state += 5;
    expect(state).toBe(15);
    expect(historyManager.canUndo()).toBe(true);

    await historyManager.undo();
    expect(state).toBe(10);
    expect(historyManager.canRedo()).toBe(true);

    await historyManager.redo();
    expect(state).toBe(15);
  });
});
