# Product Requirements Document (PRD)
## Project: ApexFinance PWA (Bloomberg × Monarch × YNAB Personal Finance Platform)

### Executive Summary
ApexFinance is a private, local-first, high-velocity Personal Finance Progressive Web App (PWA). It merges the rigorous zero-based ledger clarity of YNAB, the modern clarity and clean ergonomics of Monarch Money, and the real-time density, hotkey precision, and analytics posture of a Bloomberg Terminal.

### Stakeholder Requirements & Phase Constraints
- **Phase Execution**: Strict phase-by-phase delivery. Phase 1 focuses exclusively on the **Core Ledger**, establishing foundational architecture (Dexie IndexedDB, integer minor-units money math, PWA scaffolding, hotkeys, theme/privacy controls, and i18n English + Khmer).
- **Execution Rule**: Deliver working code, verified tests, file tree, and comprehensive testing checklist, then pause and wait for stakeholder approval before proceeding to Phase 2.

---

### Scope: Phase 1 — Core Ledger

#### 1. Accounts Management
- **Account Types**: `cash`, `bank`, `credit_card`, `e_wallet`, `savings`, `investment`, `loan`.
- **Properties**: ID, Name, Account Type, Currency (ISO 4217, e.g. USD, KHR, EUR), Balance (in integer minor units, e.g., cents), Color (hex), Icon, Archived flag, Institution Name, Notes, CreatedAt, UpdatedAt.
- **Computed Balance**: Initial balance + sum of reconciled/all transactions.
- **Archiving**: Ability to hide/archive accounts while preserving historical ledger integrity.

#### 2. Transaction Engine
- **Transaction Types**:
  - `expense`: Decreases account balance.
  - `income`: Increases account balance.
  - `transfer`: Moves funds from Source Account to Destination Account. Transfers **must not** count as spending or income in category calculations.
- **Transaction Fields**:
  - `id`: UUID.
  - `type`: `expense` | `income` | `transfer`.
  - `amount`: Integer in minor units (e.g., $10.50 -> 1050 cents).
  - `date`: ISO string / timestamp.
  - `accountId`: Origin account.
  - `toAccountId`: Destination account (required for transfers).
  - `categoryId`: Category identifier (null/system for transfers).
  - `subcategoryId`: Optional subcategory identifier.
  - `merchant`: Merchant / Payee name.
  - `notes`: Markdown or plain text notes.
  - `tags`: Array of string tags (e.g., `["tax-deductible", "business"]`).
  - `paymentMethod`: `cash` | `debit_card` | `credit_card` | `bank_transfer` | `e_wallet` | `check` | `other`.
  - `attachment`: Receipt image (base64/data URI or Blob stored in IndexedDB).
  - `status`: `cleared` | `pending`.
  - `splits`: Array of split items for split transactions.
  - `createdAt`, `updatedAt`.

#### 3. Split Transactions
- A single transaction can be split across multiple categories and subcategories.
- Sum of split amounts must strictly equal the total transaction amount (validated down to the single minor unit).
- Each split item contains: `id`, `amount`, `categoryId`, `subcategoryId`, `notes`.

#### 4. Undo / Redo & Bulk Operations
- **Undo / Redo**: Command/Action history stack supporting instant Ctrl+Z / Ctrl+Y undo/redo for create, update, delete, and bulk actions.
- **Bulk Actions**: Multi-select transactions in table/ledger to:
  - Bulk recategorize.
  - Bulk add/remove tags.
  - Bulk mark as cleared/pending.
  - Bulk delete (with undo safety).

#### 5. Custom Categories & Subcategories
- Hierarchical category structure: Group/Parent Category -> Subcategories.
- Custom categories with custom icon, color, and budgetable flag.
- Default seeded taxonomy (Housing, Food & Dining, Transportation, Utilities, Entertainment, Healthcare, Income, Transfers) with full user customization.

#### 6. Fast Search & Saved Filters
- Fast in-memory + IndexedDB indexed search over transactions.
- Filters:
  - Date Range (preset: today, this week, this month, this year, custom range).
  - Amount Range (min, max in minor units).
  - Categories & Subcategories.
  - Accounts (single or multiple).
  - Tags (any / all).
  - Merchant text search.
  - Transaction Type & Status (cleared/pending).
- Saved Filter presets: Name, filter parameters, quick-access badge.

#### 7. Non-Functional & Foundation UX
- **Money Math**: Pure integer arithmetic (`1050` = $10.50, `1000000` = 10,000.00 KHR). Zero floating point drift.
- **Local-First Database**: Dexie IndexedDB with versioned schema.
- **Privacy Mode**: One-tap toggle that blurs all currency amounts with CSS filter.
- **App Lock**: Optional local PIN protection with auto-lock timer.
- **PWA Ready**: Offline service worker, web app manifest, mobile responsive bottom navigation, installable.
- **Bloomberg / Monarch Aesthetic**: High-contrast, clean typography, compact data density options, keyboard hotkeys (`N` for new transaction, `/` for search, `Ctrl+K` for command palette).
- **Internationalization**: Full i18n support for English (`en`) and Khmer (`km`).
