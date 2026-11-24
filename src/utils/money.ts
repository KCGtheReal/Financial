export interface CurrencyDefinition {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
  symbolPosition: 'prefix' | 'suffix';
}

export const CURRENCIES: Record<string, CurrencyDefinition> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2, symbolPosition: 'prefix' },
  KHR: { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', decimals: 0, symbolPosition: 'suffix' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2, symbolPosition: 'prefix' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2, symbolPosition: 'prefix' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0, symbolPosition: 'prefix' },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2, symbolPosition: 'prefix' },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2, symbolPosition: 'prefix' },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2, symbolPosition: 'prefix' },
  THB: { code: 'THB', name: 'Thai Baht', symbol: '฿', decimals: 2, symbolPosition: 'prefix' },
};

export function getCurrency(code: string = 'USD'): CurrencyDefinition {
  return CURRENCIES[code.toUpperCase()] || {
    code: code.toUpperCase(),
    name: code.toUpperCase(),
    symbol: code.toUpperCase() + ' ',
    decimals: 2,
    symbolPosition: 'prefix'
  };
}

export function getMinorFactor(currency: string = 'USD'): number {
  const curr = getCurrency(currency);
  return Math.pow(10, curr.decimals);
}

/**
 * Converts a decimal representation (e.g., 10.50) to integer minor units (1050 cents).
 * Uses Math.round to eliminate floating point imprecision.
 */
export function toMinorUnits(decimalAmount: number | string, currency: string = 'USD'): number {
  const factor = getMinorFactor(currency);
  const num = typeof decimalAmount === 'string' ? parseFloat(decimalAmount.replace(/,/g, '')) : decimalAmount;
  if (isNaN(num)) return 0;
  return Math.round(num * factor);
}

/**
 * Converts integer minor units (e.g. 1050) to decimal number (10.5).
 */
export function toMajorUnits(minorUnits: number, currency: string = 'USD'): number {
  const factor = getMinorFactor(currency);
  return minorUnits / factor;
}

/**
 * Formats integer minor units into human-readable currency string.
 * Example: 1050 USD -> "$10.50"
 * Example: -1050 USD -> "-$10.50"
 * Example: 50000 KHR -> "50,000 ៛"
 */
export function formatMoney(
  minorUnits: number,
  currency: string = 'USD',
  options?: {
    showSign?: boolean;
    privacy?: boolean;
    includeSymbol?: boolean;
  }
): string {
  if (options?.privacy) {
    return '••••••';
  }

  const curr = getCurrency(currency);
  const factor = getMinorFactor(currency);
  const isNegative = minorUnits < 0;
  const absAmount = Math.abs(minorUnits) / factor;

  const formattedNumber = absAmount.toLocaleString(undefined, {
    minimumFractionDigits: curr.decimals,
    maximumFractionDigits: curr.decimals,
  });

  const includeSymbol = options?.includeSymbol !== false;
  let formattedWithSymbol = formattedNumber;

  if (includeSymbol) {
    if (curr.symbolPosition === 'prefix') {
      formattedWithSymbol = `${curr.symbol}${formattedNumber}`;
    } else {
      formattedWithSymbol = `${formattedNumber} ${curr.symbol}`;
    }
  }

  if (isNegative) {
    return `-${formattedWithSymbol}`;
  } else if (options?.showSign && minorUnits > 0) {
    return `+${formattedWithSymbol}`;
  }

  return formattedWithSymbol;
}

/**
 * Parses a user input string into integer minor units safely.
 */
export function parseMoneyInput(input: string, currency: string = 'USD'): number {
  if (!input) return 0;
  // Clean string keeping only digits, minus, and period
  const cleaned = input.replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return toMinorUnits(num, currency);
}

/**
 * Validates that the sum of splits strictly matches the parent amount.
 */
export function validateSplitSum(
  parentAmount: number,
  splits: { amount: number }[]
): { isValid: boolean; difference: number; currentSum: number } {
  const currentSum = splits.reduce((acc, split) => acc + (split.amount || 0), 0);
  const difference = parentAmount - currentSum;
  return {
    isValid: difference === 0,
    difference,
    currentSum
  };
}
