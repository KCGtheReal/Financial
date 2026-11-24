/**
 * ApexFinance Core Contracts & Domain Specifications
 * All monetary amounts are STRICTLY represented as integers in minor units (e.g., cents, satoshis).
 * Example: $10.50 USD = 1050 (minor unit factor: 100)
 * Example: 10,000 KHR = 1000000 (minor unit factor: 100) or non-subdivided where factor is 1 or 100.
 * Default standard: 2 decimal places (cents) with factor 100 for fiat currencies unless specified.
 */

export type AccountType = 
  | 'cash'
  | 'bank'
  | 'credit_card'
  | 'e_wallet'
  | 'savings'
  | 'investment'
  | 'loan';

export type TransactionType = 'expense' | 'income' | 'transfer';

export type TransactionStatus = 'cleared' | 'pending';

export type PaymentMethod = 
  | 'cash'
  | 'debit_card'
  | 'credit_card'
  | 'bank_transfer'
  | 'e_wallet'
  | 'check'
  | 'other';

export interface CurrencyConfig {
  code: string;        // e.g. "USD", "KHR", "EUR"
  name: string;        // e.g. "US Dollar", "Cambodian Riel"
  symbol: string;      // e.g. "$", "៛", "€"
  minorUnitFactor: number; // usually 100 (cents) or 1
  decimals: number;    // usually 2, or 0
  symbolPosition: 'prefix' | 'suffix';
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: string;             // ISO 4217 code
  initialBalance: number;       // Integer in minor units (signed)
  currentBalance: number;       // Computed / cached integer balance
  color: string;                // Hex code
  icon: string;                 // Lucide icon identifier
  isArchived: boolean;
  institutionName?: string;
  accountNumberMask?: string;   // e.g. "•••• 4242"
  notes?: string;
  createdAt: string;            // ISO timestamp
  updatedAt: string;            // ISO timestamp
}

export interface TransactionSplit {
  id: string;
  amount: number;               // Integer in minor units
  categoryId: string;
  subcategoryId?: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;               // Integer in minor units (always positive)
  date: string;                 // YYYY-MM-DD
  time?: string;                // HH:mm:ss
  accountId: string;            // Source account
  toAccountId?: string;         // Destination account (for type === 'transfer')
  categoryId?: string;          // Category id (optional if split or transfer)
  subcategoryId?: string;
  merchant: string;             // Payee / Merchant
  notes?: string;
  tags: string[];               // e.g. ["tax", "personal"]
  paymentMethod: PaymentMethod;
  attachmentData?: string;      // Base64 or Object URL of receipt
  attachmentName?: string;
  status: TransactionStatus;
  splits?: TransactionSplit[];  // If split across categories
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'expense' | 'income';
  icon: string;
  color: string;
  parentId?: string;            // If subcategory, points to parent Category.id
  isSystem?: boolean;           // Default built-in categories
  order: number;
}

export interface LedgerFilter {
  query?: string;
  accountIds?: string[];
  categoryIds?: string[];
  types?: TransactionType[];
  statuses?: TransactionStatus[];
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;           // Minor units
  amountMax?: number;           // Minor units
  paymentMethods?: PaymentMethod[];
}

export interface SavedFilter {
  id: string;
  name: string;
  filter: LedgerFilter;
  color?: string;
  icon?: string;
  createdAt: string;
}

export interface LedgerHistoryAction {
  id: string;
  description: string;
  timestamp: number;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export interface AppSettings {
  baseCurrency: string;
  language: 'en' | 'km';
  theme: 'dark' | 'light' | 'system';
  isPrivacyMode: boolean;       // Blurs amounts
  isAppLocked: boolean;
  pinCodeHash?: string;         // SHA-256 hash of PIN
  autoLockMinutes: number;      // 0 = disabled, 1, 5, 15
  lastActiveTimestamp?: number;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;              // Preset icon identifier or base64 photo URL
  avatarColor?: string;         // Minimalist hex accent for badge
  pinCode?: string;             // 4-digit PIN for login / quick lock
  currency: string;             // User's default base currency
  bio?: string;                 // Short tagline or bio
  role?: 'admin' | 'user';      // Access control role: admin can manage users & PINs
  isLoggedIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthCredentials {
  name: string;
  email: string;
  pinCode: string;
  avatar?: string;
  avatarColor?: string;
  currency?: string;
  bio?: string;
}
