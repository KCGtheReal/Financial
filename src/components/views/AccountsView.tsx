import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAppStore } from '../../store/useAppStore';
import { formatMoney } from '../../utils/money';
import { Icon } from '../common/Icon';
import { Plus, Archive, Edit2 } from 'lucide-react';
import { t } from '../../i18n';
import { Account, AccountType } from '@contracts/api';

export const AccountsView: React.FC = () => {
  const { 
    isPrivacyMode, 
    setAccountModalOpen, 
    setEditingAccount, 
    setSelectedAccountId, 
    setActiveTab, 
    language 
  } = useAppStore();

  const [showArchived, setShowArchived] = useState(false);
  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

  const visibleAccounts = accounts.filter((a) => showArchived || !a.isArchived);

  // Totals by currency
  const totalBalances = accounts.reduce((acc, curr) => {
    if (curr.isArchived) return acc;
    acc[curr.currency] = (acc[curr.currency] || 0) + curr.currentBalance;
    return acc;
  }, {} as Record<string, number>);

  const groupByType: Record<string, Account[]> = visibleAccounts.reduce((acc, account) => {
    const key = account.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(account);
    return acc;
  }, {} as Record<string, Account[]>);

  const getAccountTypeLabel = (type: AccountType) => {
    const key = `account_${type}` as const;
    return t(key, language);
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 pb-nav-safe space-y-4 animate-fade-in">
      {/* Net Balance Minimalist Hero Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
        <span className="text-xs font-mono uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-1 font-semibold">
          {t('totalNetBalance', language)}
        </span>
        <div className="space-y-1">
          {Object.keys(totalBalances).length === 0 ? (
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-400 dark:text-zinc-500">
                $0.00
              </span>
              <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase font-semibold">
                USD
              </span>
            </div>
          ) : (
            Object.entries(totalBalances).map(([curr, total]) => (
              <div key={curr} className="flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-zinc-900 dark:text-white">
                  {formatMoney(total, curr, { privacy: isPrivacyMode })}
                </span>
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 uppercase font-semibold">
                  {curr}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
          <span className="text-zinc-500 dark:text-zinc-400">
            {accounts.filter((a) => !a.isArchived).length} {t('activeAccountsCount', language)}
          </span>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white flex items-center gap-1 font-medium transition-colors"
          >
            <Archive size={12} />
            <span>{showArchived ? t('hideArchived', language) : t('showArchived', language)}</span>
          </button>
        </div>
      </div>

      {/* Add Account Button */}
      <button
        onClick={() => {
          setEditingAccount(null);
          setAccountModalOpen(true);
        }}
        className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-2 text-xs font-semibold transition-all active:scale-98 shadow-sm cursor-pointer"
      >
        <Plus size={16} />
        <span>{t('addAccount', language)}</span>
      </button>

      {/* Empty State: Guide to create a card for each currency */}
      {visibleAccounts.length === 0 && (
        <div className="p-6 rounded-3xl bg-zinc-50 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-3 animate-fade-in">
          <div className="w-12 h-12 rounded-2xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-600 dark:text-zinc-300">
            <Plus size={22} />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
              {language === 'km' ? 'បង្កើតកាតតាមរូបិយប័ណ្ណនីមួយៗ' : 'Create a Card for Each Currency'}
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
              {language === 'km' 
                ? 'បន្ថែមគណនី ឬកាតសម្រាប់ USD, KHR ឬរូបិយប័ណ្ណផ្សេងទៀត ដើម្បីចាប់ផ្តើមកត់ត្រាការចំណាយ' 
                : 'Add account cards for USD, KHR, EUR, or any currency you use to track your multi-currency ledger.'}
            </p>
          </div>
        </div>
      )}

      {/* Grouped Account Lists */}
      <div className="space-y-4">
        {Object.entries(groupByType).map(([typeKey, accList]) => (
          <div key={typeKey} className="space-y-2">
            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-1">
              {getAccountTypeLabel(typeKey as AccountType) || typeKey}
            </h3>

            <div className="space-y-2">
              {accList.map((account) => (
                <div
                  key={account.id}
                  onClick={() => {
                    setSelectedAccountId(account.id);
                    setActiveTab('ledger');
                  }}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 active:scale-98 transition-all flex items-center justify-between cursor-pointer group shadow-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center flex-shrink-0">
                      <Icon name={account.icon || 'Wallet'} size={18} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                          {account.name}
                        </span>
                        {account.isArchived && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
                        {account.institutionName && <span>{account.institutionName}</span>}
                        {account.accountNumberMask && <span>• {account.accountNumberMask}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <div className="text-right">
                      <div className={`text-sm font-bold font-mono ${account.currentBalance >= 0 ? 'text-zinc-900 dark:text-white' : 'text-rose-500'}`}>
                        {formatMoney(account.currentBalance, account.currency, { privacy: isPrivacyMode })}
                      </div>
                      <div className="text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase">
                        {account.currency}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingAccount(account);
                        setAccountModalOpen(true);
                      }}
                      className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors"
                      title={t('editAccount', language)}
                    >
                      <Edit2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
