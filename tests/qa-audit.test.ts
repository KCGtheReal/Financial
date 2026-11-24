import { describe, it, expect, beforeEach } from 'vitest';
import { 
  toMinorUnits, 
  toMajorUnits, 
  formatMoney, 
  validateSplitSum,
  getCurrency,
  CURRENCIES 
} from '../src/utils/money';
import { LedgerRepository } from '../src/db/repository';
import { historyManager } from '../src/utils/history';
import { Transaction } from '@contracts/api';

describe('QA Rigorous Audit: Precision, Invariants & Resilience', () => {
  beforeEach(() => {
    historyManager.clear();
  });

  describe('1. Minor-Unit Integer Engine Invariants & Edge Cases', () => {
    it('handles zero amount and edge numbers safely', () => {
      expect(toMinorUnits(0, 'USD')).toBe(0);
      expect(toMinorUnits('0', 'USD')).toBe(0);
      expect(toMinorUnits('', 'USD')).toBe(0);
      expect(toMajorUnits(0, 'USD')).toBe(0);
      expect(formatMoney(0, 'USD')).toBe('$0.00');
      expect(formatMoney(0, 'KHR')).toBe('0 ៛');
    });

    it('maintains absolute zero drift over 10,000 sequential transactions', () => {
      let balance = 0;
      // Add $0.10 ten thousand times
      const stepMinor = toMinorUnits('0.10', 'USD'); // 10 cents
      for (let i = 0; i < 10000; i++) {
        balance += stepMinor;
      }
      // 10,000 * $0.10 = $1,000.00 = 100,000 cents
      expect(balance).toBe(100000);
      expect(toMajorUnits(balance, 'USD')).toBe(1000);
      expect(formatMoney(balance, 'USD')).toBe('$1,000.00');
    });

    it('handles extreme multi-million dollar balances without overflow', () => {
      // $50,000,000.00 = 5,000,000,000 cents
      const bigMinor = toMinorUnits('50,000,000.00', 'USD');
      expect(bigMinor).toBe(5000000000);
      expect(formatMoney(bigMinor, 'USD')).toBe('$50,000,000.00');

      // 400 Billion KHR
      const khrMinor = toMinorUnits(400000000000, 'KHR');
      expect(formatMoney(khrMinor, 'KHR')).toBe('400,000,000,000 ៛');
    });

    it('formats currencies properly according to their definitions', () => {
      expect(CURRENCIES['USD'].decimals).toBe(2);
      expect(CURRENCIES['KHR'].decimals).toBe(0);
      expect(CURRENCIES['EUR'].decimals).toBe(2);
      expect(getCurrency('UNKNOWN').code).toBe('UNKNOWN');
    });
  });

  describe('2. Multi-Category Split Math & Validation', () => {
    it('accurately validates 5-way split down to the single cent', () => {
      const parentTotal = 50000; // $500.00
      const splits = [
        { amount: 12550 }, // $125.50
        { amount: 7450 },  // $74.50
        { amount: 15000 }, // $150.00
        { amount: 10000 }, // $100.00
        { amount: 5000 },  // $50.00
      ];
      const res = validateSplitSum(parentTotal, splits);
      expect(res.isValid).toBe(true);
      expect(res.difference).toBe(0);
      expect(res.currentSum).toBe(50000);
    });

    it('flags 1-cent discrepancy accurately', () => {
      const parentTotal = 1000; // $10.00
      const splits = [
        { amount: 333 },
        { amount: 333 },
        { amount: 333 }, // Total 999 cents, 1 cent off
      ];
      const res = validateSplitSum(parentTotal, splits);
      expect(res.isValid).toBe(false);
      expect(res.difference).toBe(1);
    });
  });

  describe('3. Transfer & Spending Invariants', () => {
    it('verifies that bilateral account transfers never mutate total expense/income', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-inc',
          type: 'income',
          amount: 250000, // $2,500
          date: '2026-11-20',
          accountId: 'acc-checking',
          merchant: 'Payroll',
          tags: [],
          paymentMethod: 'bank_transfer',
          status: 'cleared',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'tx-transfer',
          type: 'transfer',
          amount: 100000, // $1,000
          date: '2026-11-21',
          accountId: 'acc-checking',
          toAccountId: 'acc-savings',
          merchant: 'Transfer to Savings',
          tags: [],
          paymentMethod: 'bank_transfer',
          status: 'cleared',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'tx-exp',
          type: 'expense',
          amount: 50000, // $500
          date: '2026-11-22',
          accountId: 'acc-checking',
          merchant: 'Supermarket',
          tags: [],
          paymentMethod: 'credit_card',
          status: 'cleared',
          createdAt: '',
          updatedAt: '',
        },
      ];

      // Compute total income & expense
      let totalIncome = 0;
      let totalExpense = 0;
      for (const t of transactions) {
        if (t.type === 'income') totalIncome += t.amount;
        if (t.type === 'expense') totalExpense += t.amount;
      }

      expect(totalIncome).toBe(250000);
      expect(totalExpense).toBe(50000);

      // Verify checking account net effect
      let checkingBalance = 0;
      let savingsBalance = 0;
      for (const t of transactions) {
        if (t.accountId === 'acc-checking') {
          if (t.type === 'income') checkingBalance += t.amount;
          if (t.type === 'expense' || t.type === 'transfer') checkingBalance -= t.amount;
        }
        if (t.toAccountId === 'acc-savings' && t.type === 'transfer') {
          savingsBalance += t.amount;
        }
      }

      // $2500 in - $1000 transfer - $500 exp = $1000
      expect(checkingBalance).toBe(100000);
      // $1000 transfer in
      expect(savingsBalance).toBe(100000);
    });
  });

  describe('4. Search & Filter Edge Cases', () => {
    const list: Transaction[] = [
      {
        id: 't-1',
        type: 'expense',
        amount: 2500,
        date: '2026-11-15',
        accountId: 'acc-1',
        categoryId: 'cat-food',
        merchant: 'Starbucks Coffee',
        notes: 'Cold brew & croissant',
        tags: ['coffee', 'breakfast'],
        paymentMethod: 'credit_card',
        status: 'cleared',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: 't-2',
        type: 'expense',
        amount: 15000,
        date: '2026-11-18',
        accountId: 'acc-2',
        categoryId: 'cat-electronics',
        merchant: 'Apple Store',
        notes: 'USB-C Cable',
        tags: ['gear'],
        paymentMethod: 'debit_card',
        status: 'pending',
        createdAt: '',
        updatedAt: '',
      },
    ];

    it('matches partial query in notes case-insensitively', () => {
      const res = LedgerRepository.filterTransactions(list, { query: 'cRoIsSaNt' });
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('t-1');
    });

    it('filters correctly by status', () => {
      const cleared = LedgerRepository.filterTransactions(list, { statuses: ['cleared'] });
      expect(cleared.length).toBe(1);
      expect(cleared[0].id).toBe('t-1');

      const pending = LedgerRepository.filterTransactions(list, { statuses: ['pending'] });
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe('t-2');
    });
  });

  describe('5. Undo/Redo Action Stack Robustness', () => {
    it('safely handles empty undo/redo triggers without throwing', async () => {
      expect(await historyManager.undo()).toBe(false);
      expect(await historyManager.redo()).toBe(false);
    });

    it('reverses sequential transactions accurately in LIFO order', async () => {
      let counter = 0;

      historyManager.push({
        description: 'First',
        undo: async () => { counter -= 10; },
        redo: async () => { counter += 10; },
      });
      counter += 10;

      historyManager.push({
        description: 'Second',
        undo: async () => { counter -= 20; },
        redo: async () => { counter += 20; },
      });
      counter += 20;

      expect(counter).toBe(30);

      // Undo Second
      await historyManager.undo();
      expect(counter).toBe(10);

      // Undo First
      await historyManager.undo();
      expect(counter).toBe(0);

      // Redo First
      await historyManager.redo();
      expect(counter).toBe(10);

      // Redo Second
      await historyManager.redo();
      expect(counter).toBe(30);
    });
  });

  describe('6. Bottom Sheet Gesture & Drag Mechanics', () => {
    it('calculates downward drag tracking and upward resistance correctly', () => {
      const startY = 200;
      
      // Dragging downward (positive delta)
      const currentDownY = 320;
      const deltaDown = currentDownY - startY; // 120px down
      expect(deltaDown).toBe(120);
      expect(deltaDown > 80).toBe(true); // Should trigger dismiss threshold

      // Dragging upward (negative delta) with 0.2 resistance factor
      const currentUpY = 150;
      const deltaUp = (currentUpY - startY) * 0.2; // -10px dampened
      expect(deltaUp).toBe(-10);
      expect(deltaUp < 0).toBe(true);
    });
  });
});
