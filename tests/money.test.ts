import { describe, it, expect } from 'vitest';
import { 
  toMinorUnits, 
  toMajorUnits, 
  formatMoney, 
  parseMoneyInput, 
  validateSplitSum 
} from '../src/utils/money';

describe('Integer Money Math & Precision Unit Tests', () => {
  it('converts decimal amounts to integer minor units without float drift', () => {
    expect(toMinorUnits(10.50, 'USD')).toBe(1050);
    expect(toMinorUnits('10.50', 'USD')).toBe(1050);
    expect(toMinorUnits(0.01, 'USD')).toBe(1);
    expect(toMinorUnits(0.07, 'USD')).toBe(7);
    expect(toMinorUnits('1,234.56', 'USD')).toBe(123456);
    expect(toMinorUnits(50000, 'KHR')).toBe(50000); // 0 decimals
  });

  it('converts minor units back to major units accurately', () => {
    expect(toMajorUnits(1050, 'USD')).toBe(10.5);
    expect(toMajorUnits(1, 'USD')).toBe(0.01);
    expect(toMajorUnits(123456, 'USD')).toBe(1234.56);
    expect(toMajorUnits(50000, 'KHR')).toBe(50000);
  });

  it('formats money with proper currency symbols and decimal places', () => {
    expect(formatMoney(1050, 'USD')).toBe('$10.50');
    expect(formatMoney(-1050, 'USD')).toBe('-$10.50');
    expect(formatMoney(1050, 'USD', { showSign: true })).toBe('+$10.50');
    expect(formatMoney(50000, 'KHR')).toBe('50,000 ៛');
    expect(formatMoney(1050, 'EUR')).toBe('€10.50');
  });

  it('renders masked bullets in privacy mode', () => {
    expect(formatMoney(1050, 'USD', { privacy: true })).toBe('••••••');
    expect(formatMoney(9999999, 'KHR', { privacy: true })).toBe('••••••');
  });

  it('parses dirty string inputs into valid integer minor units', () => {
    expect(parseMoneyInput('$12.34', 'USD')).toBe(1234);
    expect(parseMoneyInput('   -45.00  ', 'USD')).toBe(-4500);
    expect(parseMoneyInput('invalid', 'USD')).toBe(0);
  });

  it('validates multi-category split sum down to the exact cent', () => {
    const parentAmount = 10000; // $100.00
    
    // Balanced splits ($60 + $40 = $100)
    const validSplits = [
      { amount: 6000 },
      { amount: 4000 },
    ];
    const res1 = validateSplitSum(parentAmount, validSplits);
    expect(res1.isValid).toBe(true);
    expect(res1.difference).toBe(0);
    expect(res1.currentSum).toBe(10000);

    // Under-allocated ($60 + $30 = $90, remaining $10)
    const underSplits = [
      { amount: 6000 },
      { amount: 3000 },
    ];
    const res2 = validateSplitSum(parentAmount, underSplits);
    expect(res2.isValid).toBe(false);
    expect(res2.difference).toBe(1000);

    // Over-allocated ($60 + $50 = $110, over by $10)
    const overSplits = [
      { amount: 6000 },
      { amount: 5000 },
    ];
    const res3 = validateSplitSum(parentAmount, overSplits);
    expect(res3.isValid).toBe(false);
    expect(res3.difference).toBe(-1000);
  });
});
