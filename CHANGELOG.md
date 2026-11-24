# Changelog — ApexFinance

## [Phase 1: Core Ledger] — 2026-11-23

### Completed Architecture & Deliverables
- **Contract-First Architecture**: Authored `specs/PRD.md` and `contracts/api.ts` defining domain interfaces, models, and minor-unit rules.
- **IndexedDB Storage Layer**: Built versioned Dexie schema with `accounts`, `transactions`, `categories`, `savedFilters`, and `settings` stores.
- **Integer Minor-Unit Engine (`src/utils/money.ts`)**: Pure integer math eliminating floating-point errors, supporting USD, KHR, EUR, GBP, JPY, and split calculation invariants.
- **Multi-Category Split Transactions**: Dynamic split engine with real-time balance validation down to 1 cent.
- **Core Ledger Features**:
  - Accounts management (cash, bank, credit card, e-wallet, savings, investment, loan) with balances, custom colors, institution masks, and archive options.
  - Transactions (expense, income, transfer with transfer spending exclusion).
  - Cleared/pending status flags, receipt attachment previews, payment methods, multi-tag arrays.
  - Full-text search, multi-condition filtering, date presets, and saved filters.
- **Power User Controls**:
  - Desktop keyboard shortcuts (`N` for new, `/` for search, `Ctrl+K` for command palette).
  - Undo / Redo action manager stack (`Ctrl+Z`, `Ctrl+Y`).
  - Floating bulk operations toolbar (bulk recategorize, bulk tag, bulk clear, bulk delete).
- **Security & Privacy**:
  - One-tap privacy blur mode.
  - Local PIN app lock screen with customizable PIN.
- **Internationalization**:
  - Dual language dictionaries for English (`en`) and Khmer (`km`).
- **PWA Scaffolding**:
  - Service worker generation, offline precache, and Web App Manifest.
- **Automated Verification**:
  - 11 Vitest unit tests passed (100% pass rate).
  - Production build compiled with zero errors.
