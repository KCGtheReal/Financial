import React from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { TransactionSplit, Category } from '@contracts/api';
import { formatMoney, toMinorUnits, toMajorUnits, validateSplitSum } from '../../utils/money';
import { t } from '../../i18n';

interface SplitTransactionFormProps {
  totalAmount: number; // in integer minor units
  currency: string;
  categories: Category[];
  splits: TransactionSplit[];
  onChange: (splits: TransactionSplit[]) => void;
  language: 'en' | 'km';
}

export const SplitTransactionForm: React.FC<SplitTransactionFormProps> = ({
  totalAmount,
  currency,
  categories,
  splits,
  onChange,
  language,
}) => {
  const { isValid, difference, currentSum } = validateSplitSum(totalAmount, splits);

  const parentCategories = categories.filter((c) => !c.parentId);

  const handleAddSplit = () => {
    const remaining = Math.max(0, totalAmount - currentSum);
    const newSplit: TransactionSplit = {
      id: 'split-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      amount: remaining,
      categoryId: parentCategories[0]?.id || '',
      notes: '',
    };
    onChange([...splits, newSplit]);
  };

  const handleUpdateSplit = (id: string, updates: Partial<TransactionSplit>) => {
    onChange(
      splits.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  };

  const handleRemoveSplit = (id: string) => {
    onChange(splits.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-3 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 block">
            {t('splitTransaction', language)}
          </span>
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
            {t('splitDetails', language)}
          </span>
        </div>

        {/* Validation Status Indicator */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {isValid ? (
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold">
              <CheckCircle2 size={12} />
              <span>Balanced</span>
            </span>
          ) : (
            <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-800 text-[11px] font-semibold">
              <AlertCircle size={12} />
              <span>
                {difference > 0 ? 'Remaining: ' : 'Over: '}
                {formatMoney(Math.abs(difference), currency)}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Split Rows */}
      <div className="space-y-2">
        {splits.map((split, index) => {
          const subcategories = categories.filter((c) => c.parentId === split.categoryId);

          return (
            <div
              key={split.id}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
            >
              <span className="text-[10px] font-mono text-zinc-400 w-4">
                #{index + 1}
              </span>

              {/* Category Select */}
              <select
                value={split.categoryId}
                onChange={(e) =>
                  handleUpdateSplit(split.id, {
                    categoryId: e.target.value,
                    subcategoryId: undefined,
                  })
                }
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                {parentCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>

              {/* Subcategory Select (if any) */}
              {subcategories.length > 0 && (
                <select
                  value={split.subcategoryId || ''}
                  onChange={(e) =>
                    handleUpdateSplit(split.id, {
                      subcategoryId: e.target.value || undefined,
                    })
                  }
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                >
                  <option value="">(No subcategory)</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              )}

              {/* Split Amount Input */}
              <div className="w-28 relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={toMajorUnits(split.amount, currency) || ''}
                  onChange={(e) =>
                    handleUpdateSplit(split.id, {
                      amount: toMinorUnits(e.target.value, currency),
                    })
                  }
                  placeholder="0.00"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white font-mono text-right outline-none focus:border-zinc-400 dark:focus:border-zinc-600 font-semibold"
                />
              </div>

              {/* Remove Split Button */}
              <button
                type="button"
                onClick={() => handleRemoveSplit(split.id)}
                className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors self-end sm:self-center"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Add Split Item Button */}
      <button
        type="button"
        onClick={handleAddSplit}
        className="w-full py-2 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors font-medium bg-white dark:bg-zinc-900/60"
      >
        <Plus size={14} />
        <span>{t('addSplit', language)}</span>
      </button>
    </div>
  );
};
