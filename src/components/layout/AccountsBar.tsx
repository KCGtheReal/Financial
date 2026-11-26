import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAppStore } from '../../store/useAppStore';
import { formatMoney } from '../../utils/money';
import { t } from '../../i18n';
import { Plus } from 'lucide-react';

export const AccountsBar: React.FC = () => {
  const { 
    selectedAccountId, 
    setSelectedAccountId, 
    isPrivacyMode, 
    setAccountModalOpen,
    setEditingAccount,
    userProfile,
    language 
  } = useAppStore();

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const activeAccounts = accounts.filter((acc) => !acc.isArchived);

  // Group balances by currency
  const totalBalances = activeAccounts.reduce((acc, curr) => {
    acc[curr.currency] = (acc[curr.currency] || 0) + curr.currentBalance;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="w-full bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-800/80 px-4 sm:px-6 py-3 transition-colors duration-200">
      <div className="max-w-md sm:max-w-7xl mx-auto space-y-3">
        {/* Net Balance Minimalist Hero */}
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block font-semibold">
              {t('totalNetBalance', language)}
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              {Object.keys(totalBalances).length === 0 ? (
                <div className="flex items-baseline gap-1 font-mono">
                  <span className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    {formatMoney(0, userProfile?.currency || 'USD', { privacy: isPrivacyMode, showSign: false })}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 font-sans font-semibold uppercase">
                    {userProfile?.currency || 'USD'}
                  </span>
                </div>
              ) : (
                Object.entries(totalBalances).map(([curr, total]) => (
                  <div key={curr} className="flex items-baseline gap-1 font-mono">
                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                      {formatMoney(total, curr, { privacy: isPrivacyMode, showSign: false })}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500 font-sans font-semibold uppercase">
                      {curr}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Account Horizontal Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {/* All Accounts Pill */}
          <button
            onClick={() => setSelectedAccountId(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0 ${
              selectedAccountId === null
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800'
            }`}
          >
            {t('allAccounts', language)}
          </button>

          {/* Quick Add Account Pill */}
          <button
            onClick={() => {
              setEditingAccount(null);
              setAccountModalOpen(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400"
          >
            <Plus size={12} />
            <span>{t('addAccount', language)}</span>
          </button>

          {/* Individual Account Pills */}
          {activeAccounts.map((account) => {
            const isSelected = selectedAccountId === account.id;
            return (
              <button
                key={account.id}
                onClick={() => setSelectedAccountId(isSelected ? null : account.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 flex-shrink-0 ${
                  isSelected
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-semibold shadow-sm'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: account.color || '#71717A' }}
                />
                <span>{account.name}</span>
                <span className="font-mono text-[10px] opacity-70">
                  {formatMoney(account.currentBalance, account.currency, { privacy: isPrivacyMode })}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
