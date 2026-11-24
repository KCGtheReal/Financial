import React, { useState } from 'react';
import { Transaction, Account, Category } from '@contracts/api';
import { useAppStore } from '../../store/useAppStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { LedgerRepository } from '../../db/repository';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/date';
import { Icon } from '../common/Icon';
import { Modal } from '../common/Modal';
import { 
  ArrowRightLeft, 
  Paperclip, 
  Split, 
  Edit3, 
  Trash2, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { t } from '../../i18n';

interface TransactionCardProps {
  tx: Transaction;
  accounts: Account[];
  categories: Category[];
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  tx,
  accounts,
  categories,
}) => {
  const { isPrivacyMode, setEditingTransaction, language } = useAppStore();
  const { selectedTxIds, toggleSelectTx, incrementHistoryRevision } = useLedgerStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const isSelected = selectedTxIds.includes(tx.id);

  const sourceAccount = accounts.find((a) => a.id === tx.accountId);
  const destAccount = tx.toAccountId ? accounts.find((a) => a.id === tx.toAccountId) : null;
  const category = categories.find((c) => c.id === tx.categoryId);
  const subcategory = tx.subcategoryId ? categories.find((c) => c.id === tx.subcategoryId) : null;

  const currency = sourceAccount?.currency || 'USD';

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete transaction "${tx.merchant}"? You can undo this with Ctrl+Z.`)) {
      await LedgerRepository.deleteTransaction(tx.id);
      incrementHistoryRevision();
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTransaction(tx);
  };

  const isTransfer = tx.type === 'transfer';
  const hasSplits = Boolean(tx.splits && tx.splits.length > 0);

  return (
    <div
      onClick={() => toggleSelectTx(tx.id)}
      className={`p-3.5 rounded-2xl border transition-all duration-150 cursor-pointer select-none active:scale-[0.99] space-y-2.5 ${
        isSelected
          ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900 dark:ring-zinc-100'
          : 'bg-white dark:bg-[#121214] border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
      }`}
    >
      {/* Top Line: Checkbox + Icon + Merchant & Category + Amount */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Subtle Checkbox for selection */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelectTx(tx.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 accent-zinc-900 dark:accent-zinc-100 cursor-pointer flex-shrink-0"
          />

          {/* Minimalist Monochrome Category Icon */}
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 text-zinc-800 dark:text-zinc-200 flex items-center justify-center flex-shrink-0">
            {isTransfer ? (
              <ArrowRightLeft size={16} />
            ) : (
              <Icon name={category?.icon || 'CircleDollarSign'} size={16} />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                {tx.merchant}
              </span>
              {tx.attachmentData && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsReceiptModalOpen(true);
                  }}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded"
                  title="Receipt"
                >
                  <Paperclip size={12} />
                </button>
              )}
            </div>

            <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5 truncate">
              {isTransfer ? (
                <span className="font-mono">
                  {sourceAccount?.name} → {destAccount?.name || 'Account'}
                </span>
              ) : (
                <span>
                  {category?.name || t('uncategorized', language)}
                  {subcategory && ` › ${subcategory.name}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right flex-shrink-0">
          <div
            className={`text-base font-bold font-mono tracking-tight ${
              isTransfer
                ? 'text-zinc-600 dark:text-zinc-300'
                : tx.type === 'income'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-zinc-900 dark:text-white'
            }`}
          >
            {isTransfer ? '' : tx.type === 'income' ? '+' : '-'}
            {formatMoney(tx.amount, currency, { privacy: isPrivacyMode })}
          </div>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 uppercase">
              {currency}
            </span>
            {tx.status === 'pending' && (
              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                {t('pending', language)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Sub-info: Date, Account, Splits, Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/60 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-500 dark:text-zinc-400">
            {formatDate(tx.date, 'MMM dd')}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium border border-zinc-200 dark:border-zinc-700/60">
            {sourceAccount?.name || 'Account'}
          </span>
          {hasSplits && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
            >
              <Split size={10} />
              <span>{t('splitTransaction', language)} ({tx.splits?.length})</span>
              {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          )}
        </div>

        {/* Quick Edit and Delete buttons */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleEdit}
            className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center transition-colors"
            title={t('editTransaction', language)}
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={handleDelete}
            className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors"
            title={t('deleteTransaction', language)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Expanded Split Breakdown */}
      {isExpanded && hasSplits && (
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1 bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl animate-fade-in">
          <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 dark:text-zinc-400 font-bold block">
            Split Breakdown:
          </span>
          {tx.splits?.map((split, idx) => {
            const sCat = categories.find((c) => c.id === split.categoryId);
            const sSub = split.subcategoryId ? categories.find((c) => c.id === split.subcategoryId) : null;
            return (
              <div key={split.id || idx} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-zinc-700 dark:text-zinc-300">
                  #{idx + 1} {sCat?.name || 'Category'} {sSub && `› ${sSub.name}`}
                </span>
                <span className="font-mono text-zinc-900 dark:text-white font-semibold">
                  {formatMoney(split.amount, currency, { privacy: isPrivacyMode })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Receipt Image Lightbox Modal */}
      {tx.attachmentData && (
        <Modal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          title={`Receipt: ${tx.merchant}`}
          subtitle={`${formatDate(tx.date)} • ${formatMoney(tx.amount, currency)}`}
          maxWidth="lg"
        >
          <div className="flex flex-col items-center">
            <img
              src={tx.attachmentData}
              alt="Receipt Attachment"
              className="max-h-[65vh] rounded-xl object-contain border border-zinc-200 dark:border-zinc-800 shadow-xl"
            />
            {tx.attachmentName && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 font-mono">
                {tx.attachmentName}
              </span>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
