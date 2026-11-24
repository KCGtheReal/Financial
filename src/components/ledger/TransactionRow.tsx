import React, { useState } from 'react';
import { 
  Transaction, 
  Account, 
  Category 
} from '@contracts/api';
import { useAppStore } from '../../store/useAppStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { LedgerRepository } from '../../db/repository';
import { formatMoney } from '../../utils/money';
import { formatDate } from '../../utils/date';
import { Icon } from '../common/Icon';
import { Modal } from '../common/Modal';
import { 
  ArrowRightLeft, 
  CheckCircle2, 
  Clock, 
  Paperclip, 
  Edit3, 
  Trash2, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { t } from '../../i18n';

interface TransactionRowProps {
  tx: Transaction;
  accounts: Account[];
  categories: Category[];
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
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
    <>
      <tr
        onClick={() => toggleSelectTx(tx.id)}
        className={`group border-b border-zinc-100 dark:border-zinc-800/60 transition-colors cursor-pointer text-xs ${
          isSelected
            ? 'bg-zinc-100 dark:bg-zinc-800/80'
            : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
        }`}
      >
        {/* Checkbox */}
        <td className="py-3 px-3 w-10 text-center" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelectTx(tx.id)}
            className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 accent-zinc-900 dark:accent-zinc-100 cursor-pointer"
          />
        </td>

        {/* Date & Status */}
        <td className="py-3 px-3 whitespace-nowrap font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span>{formatDate(tx.date, 'MMM dd, yyyy')}</span>
            {tx.status === 'cleared' ? (
              <span title={t('cleared', language)} className="text-emerald-500">
                <CheckCircle2 size={13} />
              </span>
            ) : (
              <span title={t('pending', language)} className="text-amber-500">
                <Clock size={13} />
              </span>
            )}
          </div>
        </td>

        {/* Payee / Merchant & Category info */}
        <td className="py-3 px-3">
          <div className="flex items-center gap-2.5">
            {/* Category / Transfer Icon */}
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
              {isTransfer ? (
                <ArrowRightLeft size={13} />
              ) : (
                <Icon name={category?.icon || 'CircleDollarSign'} size={13} />
              )}
            </div>

            <div className="min-w-0">
              <div className="font-medium text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                <span>{tx.merchant}</span>
                {hasSplits && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    {t('splitTransaction', language)} ({tx.splits?.length})
                  </span>
                )}
                {tx.attachmentData && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsReceiptModalOpen(true);
                    }}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded"
                    title={t('attachment', language)}
                  >
                    <Paperclip size={12} />
                  </button>
                )}
              </div>

              <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 mt-0.5">
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
                {tx.notes && (
                  <span className="text-zinc-400 truncate max-w-[200px] hidden md:inline">
                    • {tx.notes}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Account Badge */}
        <td className="py-3 px-3 whitespace-nowrap hidden sm:table-cell">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            {sourceAccount?.name || 'Account'}
          </span>
        </td>

        {/* Tags */}
        <td className="py-3 px-3 hidden lg:table-cell">
          <div className="flex flex-wrap gap-1 max-w-[160px]">
            {tx.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-xs font-mono px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60"
              >
                #{tag}
              </span>
            ))}
            {tx.tags?.length > 2 && (
              <span className="text-xs text-zinc-400 font-mono">
                +{tx.tags.length - 2}
              </span>
            )}
          </div>
        </td>

        {/* Amount */}
        <td className="py-3 px-3 whitespace-nowrap text-right font-mono font-bold">
          <div
            className={`text-sm ${
              isTransfer
                ? 'text-zinc-700 dark:text-zinc-300'
                : tx.type === 'income'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-zinc-900 dark:text-white'
            }`}
          >
            {isTransfer ? '' : tx.type === 'income' ? '+' : '-'}
            {formatMoney(tx.amount, currency, { privacy: isPrivacyMode })}
          </div>
          <div className="text-xs text-zinc-400 font-sans uppercase">
            {currency}
          </div>
        </td>

        {/* Action Controls */}
        <td className="py-3 px-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {hasSplits && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                title="Toggle Split Breakdown"
              >
                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
            <button
              onClick={handleEdit}
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={t('editTransaction', language)}
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title={t('deleteTransaction', language)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded Split Breakdown Row */}
      {isExpanded && hasSplits && (
        <tr className="bg-zinc-50 dark:bg-zinc-950/80 border-b border-zinc-100 dark:border-zinc-800/80 text-xs animate-fade-in">
          <td colSpan={7} className="py-2.5 px-6">
            <div className="pl-6 border-l-2 border-zinc-300 dark:border-zinc-700 space-y-1.5 my-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 dark:text-zinc-400 font-bold block mb-1">
                Category Split Breakdown:
              </span>
              {tx.splits?.map((split, idx) => {
                const sCat = categories.find((c) => c.id === split.categoryId);
                const sSub = split.subcategoryId ? categories.find((c) => c.id === split.subcategoryId) : null;
                return (
                  <div key={split.id || idx} className="flex items-center justify-between py-0.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 font-mono text-[10px]">#{idx + 1}</span>
                      <span className="text-zinc-800 dark:text-zinc-200 font-medium">{sCat?.name || 'Category'}</span>
                      {sSub && <span className="text-zinc-500">› {sSub.name}</span>}
                      {split.notes && <span className="text-zinc-400 italic">({split.notes})</span>}
                    </div>
                    <span className="font-mono text-zinc-900 dark:text-white font-semibold">
                      {formatMoney(split.amount, currency, { privacy: isPrivacyMode })}
                    </span>
                  </div>
                );
              })}
            </div>
          </td>
        </tr>
      )}

      {/* Receipt Image Modal */}
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
              className="max-h-[70vh] rounded-xl object-contain border border-zinc-200 dark:border-zinc-800 shadow-xl"
            />
            {tx.attachmentName && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 font-mono">
                {tx.attachmentName}
              </span>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};
