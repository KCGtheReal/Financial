# ApexFinance Terminal (PWA)
> Advanced, Local-First Personal Finance Platform — A synthesis of Monarch Money, YNAB zero-based budgeting, and Bloomberg Terminal analytical density.

---

## ⚡ Overview
ApexFinance is a private, client-side, offline-first Progressive Web App built with React, TypeScript, Tailwind CSS, and Dexie IndexedDB. All monetary calculations are performed strictly with **integer arithmetic in minor units** (cents / minor units) to eliminate floating-point imprecision.

---

## 🎯 Phase 1: Core Ledger Deliverables
- **7 Core Account Types**: `cash`, `bank`, `credit_card`, `e_wallet`, `savings`, `investment`, `loan`.
  - Supports custom initial balances, currency codes, color swatches, institution masks, and archiving (preserves ledger integrity while decluttering active views).
- **Three Transaction Types**:
  - `expense`: Decreases account balance.
  - `income`: Increases account balance.
  - `transfer`: Bilateral account rebalancing. **Transfers are strictly invariant and never count as spending or income in category calculations.**
- **Comprehensive Fields**:
  - Amount (minor units), Date, Account, Category, Subcategory, Payee/Merchant, Notes, Tags, Payment Method, Cleared/Pending flag, and Attachment (receipt photo upload).
- **Split Transactions**:
  - Split single transactions across multiple categories and subcategories.
  - Strict mathematical validation ensures split items sum up to the exact cent of the transaction total.
- **Undo / Redo Stack**:
  - Built-in transaction history manager with instant `Ctrl+Z` / `Ctrl+Y` shortcuts.
- **Multi-Select Bulk Operations**:
  - Select multiple entries to bulk recategorize, bulk add tags, bulk mark cleared/pending, or bulk delete with single-click undo.
- **Taxonomy & Category Manager**:
  - Hierarchical categories (Parent Category → Subcategories) with customizable colors and Lucide icons.
- **Fast Filter & Search Engine**:
  - Full-text search (payee, notes, tags) with `/` shortcut.
  - Date ranges, Amount ranges, Account filtering, Category filtering, Status filtering.
  - Saved filter presets with 1-click execution.
- **Privacy Mode & App Lock**:
  - One-tap privacy blur masking all monetary numbers.
  - 4-digit PIN lock screen (Default PIN: `1234`).
- **Internationalization (i18n)**:
  - Full dual-language support for **English (`en`)** and **Khmer (`km`)**.
- **PWA Ready**:
  - Offline Service Worker precaching, Web App Manifest, mobile responsive bottom navigation bar and mobile Quick-Add FAB.

---

## ⌨️ Desktop Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `N` | Open New Transaction modal |
| `/` | Focus search bar |
| `Ctrl + K` / `Cmd + K` | Open Command Palette |
| `Ctrl + Z` | Undo last ledger operation |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo last ledger operation |
| `ESC` | Close active modal / command palette |

---

## 📁 Project Directory Layout

```text
├── .agents/
│   └── TASK_BOARD.md           # Living task board and verification matrix
├── contracts/
│   └── api.ts                  # Shared Contract-First TypeScript source of truth
├── specs/
│   └── PRD.md                  # Product Requirements Document
├── src/
│   ├── components/
│   │   ├── common/             # Icon, Modal, Badge, CommandPalette, PinLockScreen
│   │   ├── layout/             # Header, AccountsBar
│   │   └── ledger/             # TransactionTable, TransactionRow, TransactionModal,
│   │                           # SplitTransactionForm, FilterBar, BulkToolbar,
│   │                           # AccountModal, CategoryModal
│   ├── db/
│   │   ├── db.ts               # Dexie IndexedDB schemas & initial seeds
│   │   └── repository.ts       # LedgerRepository, transactions mutations & filter queries
│   ├── i18n/
│   │   ├── en.ts               # English translations
│   │   ├── km.ts               # Khmer translations
│   │   └── index.ts            # Translator hook
│   ├── store/
│   │   ├── useAppStore.ts      # Settings, privacy blur, PIN, active modals
│   │   └── useLedgerStore.ts   # Multi-select state, history revision counter
│   ├── utils/
│   │   ├── cn.ts               # Tailwind class merger
│   │   ├── date.ts             # date-fns formatting and range helpers
│   │   ├── history.ts          # Undo / Redo action manager
│   │   └── money.ts            # Integer minor units math & split validation
│   ├── App.tsx                 # Root Application container
│   ├── main.tsx                # React DOM entry point
│   └── index.css               # Tailwind & custom scrollbar styling
├── tests/
│   ├── ledger.test.ts          # Ledger invariants, search, and history tests
│   └── money.test.ts           # Integer money math & split sum validation tests
├── index.html                  # PWA HTML shell with Bloomberg typography
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts              # Vite + React + VitePWA configuration
```

---

## 🚀 Setup & Running Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Test Suite
```bash
npm test
```

### 3. Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 4. Build for Production (with PWA offline worker)
```bash
npm run build
npm run preview
```

---

## 🧪 Phase 1 Testing Checklist

1. **Integer Money Math Precision**:
   - Create a transaction for `$10.50`. Check that it is stored as `1050` in Dexie IndexedDB.
   - Verify zero rounding drift across multiple transactions.
2. **Transfer Invariant**:
   - Add a transfer from `Primary Checking` to `High Yield Reserve` of `$500.00`.
   - Verify that `Checking` decreases by `$500.00` and `Reserve` increases by `$500.00`.
   - Verify that neither Inflow nor Outflow spending totals in the ledger header are affected by the transfer.
3. **Split Transactions**:
   - Open New Transaction (`N`), input amount `$100.00`.
   - Toggle "Split Across Multiple Categories".
   - Split into `$70.00` Groceries and `$30.00` Gear. Notice the "Balanced" status indicator.
   - Change one split to `$20.00`. Notice the "Under: $10.00" alert prevents submission until balanced.
   - Expand the split transaction row in the table to view the category breakdown.
4. **Receipt Upload**:
   - Attach an image file to a transaction.
   - Click the paperclip icon in the transaction row to view the full-size receipt preview.
5. **Undo / Redo (`Ctrl+Z` / `Ctrl+Y`)**:
   - Delete a transaction. Notice it disappears and balance recalculates.
   - Press `Ctrl+Z` (or click Undo in the header). Notice the transaction and its balance impact are instantly restored!
   - Press `Ctrl+Y` to redo the deletion.
6. **Bulk Operations**:
   - Check the checkboxes for 2 or more transactions.
   - Notice the floating bottom toolbar appears showing count of selected items.
   - Test "Recategorize" to update all selected items at once.
   - Test "Add Tag" to add a tag across all selected items.
   - Test "Delete Selected" and verify undo works for the entire batch.
7. **Search & Filters**:
   - Press `/` to focus search. Type merchant name or tag (e.g. `direct-deposit`).
   - Use quick date range filters (`Today`, `7D`, `Month`).
   - Save a custom filter as a preset and reload it from the Saved Filters dropdown.
8. **Privacy Mode & App Lock**:
   - Click the Eye icon (or `Ctrl+K` -> Privacy). Verify all balances become `••••••`.
   - Click the Lock icon. Enter PIN `1234` to unlock.
9. **Dual Language (EN/KM)**:
   - Click the language badge to toggle between English and Khmer (ខ្មែរ). Verify UI labels change seamlessly.
