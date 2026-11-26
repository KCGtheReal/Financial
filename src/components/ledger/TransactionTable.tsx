import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { LedgerRepository } from '../../db/repository';
import { useAppStore } from '../../store/useAppStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { TransactionRow } from './TransactionRow';
import { TransactionCard } from './TransactionCard';
import { formatMoney } from '../../utils/money';
import { PlusCircle, Search, TrendingDown, TrendingUp, CheckSquare, Square } from 'lucide-react';
import { t } from '../../i18n';

export const TransactionTable: React.FC = () => {
  const { 
    filter, 
    selectedAccountId, 
    isPrivacyMode, 
    setQuickAddOpen, 
    setAccountModalOpen, 
    setEditingAccount, 
    language 
  } = useAppStore();
  const { selectedTxIds, selectAll, clearSelection } = useLedgerStore();

  const allTransactions = useLiveQuery(() => 
    db.transactions.orderBy('date').reverse().toArray()
  ) || [];

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // Filter transactions based on active account filter + search filters
  const filteredTransactions = useMemo(() => {
    let list = allTransactions;

    // Filter by single selected account if any
    if (selectedAccountId) {
      list = list.filter(
        (tx) => tx.accountId === selectedAccountId || tx.toAccountId === selectedAccountId
      );
    }

    // Apply general search & filters
    return LedgerRepository.filterTransactions(list, filter);
  }, [allTransactions, selectedAccountId, filter]);

  // Aggregate income and expense per currency (transfers strictly excluded from spending)
  const { incomeEntries, expenseEntries } = useMemo(() => {
    const accCurrencyMap = new Map(accounts.map((a) => [a.id, a.currency]));
    const selectedAccCurrency = selectedAccountId ? accCurrencyMap.get(selectedAccountId) : undefined;
    const fallbackCurr = selectedAccCurrency || 'USD';

    const incMap: Record<string, number> = {};
    const expMap: Record<string, number> = {};

    for (const tx of filteredTransactions) {
      const curr = accCurrencyMap.get(tx.accountId) || fallbackCurr;
      if (tx.type === 'income') {
        incMap[curr] = (incMap[curr] || 0) + tx.amount;
      } else if (tx.type === 'expense') {
        expMap[curr] = (expMap[curr] || 0) + tx.amount;
      }
    }

    const incEntries = Object.entries(incMap);
    const expEntries = Object.entries(expMap);

    return {
      incomeEntries: incEntries.length > 0 ? incEntries : ([[fallbackCurr, 0]] as [string, number][]),
      expenseEntries: expEntries.length > 0 ? expEntries : ([[fallbackCurr, 0]] as [string, number][]),
    };
  }, [filteredTransactions, accounts, selectedAccountId]);

  const allSelected =
    filteredTransactions.length > 0 &&
    filteredTransactions.every((tx) => selectedTxIds.includes(tx.id));

  const handleToggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAll(filteredTransactions.map((tx) => tx.id));
    }
  };

  return (
    <div className="w-full max-w-md sm:max-w-7xl mx-auto px-4 sm:px-6 py-3 pb-nav-safe">
      {/* Ledger Header Summary */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>{t('recentTransactions', language)}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
              {filteredTransactions.length}
            </span>
          </h2>
        </div>

        {/* Minimalist In/Out Totals Ticker (currency-accurate) */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1 rounded-full max-w-[60vw] overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1 flex-shrink-0">
            <TrendingUp size={12} className="text-emerald-600 dark:text-emerald-400" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs whitespace-nowrap">
              {incomeEntries.map(([curr, amt]) => formatMoney(amt, curr, { privacy: isPrivacyMode })).join(' · ')}
            </span>
          </div>
          <div className="w-px h-2.5 bg-zinc-300 dark:bg-zinc-700 flex-shrink-0" />
          <div className="flex items-center gap-1 flex-shrink-0">
            <TrendingDown size={12} className="text-zinc-500 dark:text-zinc-400" />
            <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs whitespace-nowrap">
              {expenseEntries.map(([curr, amt]) => formatMoney(amt, curr, { privacy: isPrivacyMode })).join(' · ')}
            </span>
          </div>
        </div>
      </div>

      {/* Select All Toggle for Mobile */}
      {filteredTransactions.length > 0 && (
        <div className="flex md:hidden items-center justify-between mb-2 px-1">
          <button
            onClick={handleToggleSelectAll}
            className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1.5 py-1 font-medium transition-colors"
          >
            {allSelected ? (
              <CheckSquare size={14} className="text-zinc-900 dark:text-zinc-100" />
            ) : (
              <Square size={14} />
            )}
            <span>{allSelected ? t('deselectAll', language) : t('selectAll', language)}</span>
          </button>
          {selectedTxIds.length > 0 && (
            <span className="text-xs font-mono font-semibold text-zinc-900 dark:text-zinc-100">
              {selectedTxIds.length} {t('selectedItems', language)}
            </span>
          )}
        </div>
      )}

      {/* Empty State */}
      {filteredTransactions.length === 0 ? (
        <div className="p-8 sm:p-14 rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 text-center shadow-sm">
          <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-zinc-400 dark:text-zinc-500">
            <div className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800/80 mb-3 border border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-400">
              {accounts.length === 0 ? <PlusCircle size={20} /> : <Search size={20} />}
            </div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
              {accounts.length === 0 ? 'No Accounts Created Yet' : t('noTransactionsFound', language)}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
              {accounts.length === 0 
                ? 'Create your first bank checking, cash wallet, or card to begin tracking.'
                : t('emptyTransactionTip', language)}
            </p>
            {accounts.length === 0 ? (
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setAccountModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 dark:bg-white hover:opacity-90 text-white dark:text-zinc-950 font-semibold text-xs shadow-sm active:scale-95 transition-all"
              >
                <PlusCircle size={15} />
                <span>{t('addAccount', language)}</span>
              </button>
            ) : (
              <button
                onClick={() => setQuickAddOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 dark:bg-white hover:opacity-90 text-white dark:text-zinc-950 font-semibold text-xs shadow-sm active:scale-95 transition-all"
              >
                <PlusCircle size={15} />
                <span>{t('newTransaction', language)}</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Mobile Native Cards Layout (md:hidden) */}
          <div className="space-y-2 md:hidden">
            {filteredTransactions.map((tx) => (
              <TransactionCard
                key={tx.id}
                tx={tx}
                accounts={accounts}
                categories={categories}
              />
            ))}
          </div>

          {/* Desktop Bloomberg Table Container (hidden md:block) */}
          <div className="hidden md:block w-full bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <th className="py-2.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 accent-zinc-900 dark:accent-zinc-100 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3">{t('date', language)}</th>
                    <th className="py-2.5 px-3">{t('merchant', language)} & {t('category', language)}</th>
                    <th className="py-2.5 px-3 hidden sm:table-cell">{t('account', language)}</th>
                    <th className="py-2.5 px-3 hidden lg:table-cell">{t('tags', language)}</th>
                    <th className="py-2.5 px-3 text-right">{t('amount', language)}</th>
                    <th className="py-2.5 px-3 text-right w-20">{t('actions', language)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
                  {filteredTransactions.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      tx={tx}
                      accounts={accounts}
                      categories={categories}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
