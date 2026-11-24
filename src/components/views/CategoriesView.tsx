import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAppStore } from '../../store/useAppStore';
import { LedgerRepository } from '../../db/repository';
import { Icon } from '../common/Icon';
import { Plus, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { t } from '../../i18n';
import { Category } from '@contracts/api';

export const CategoriesView: React.FC = () => {
  const { setCategoryModalOpen, language } = useAppStore();
  const [activeType, setActiveType] = useState<'expense' | 'income'>('expense');

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray()) || [];

  const parentCategories = categories.filter(
    (c) => !c.parentId && c.type === activeType
  );

  const handleDelete = async (cat: Category) => {
    if (confirm(`Delete category "${cat.name}" and all subcategories?`)) {
      await LedgerRepository.deleteCategory(cat.id);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 pb-nav-safe space-y-4 animate-fade-in">
      {/* Category Type Segmented Control (Expense vs Income) */}
      <div className="grid grid-cols-2 gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveType('expense')}
          className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 ${
            activeType === 'expense'
              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <ArrowDownLeft size={14} />
          <span>{t('expense', language)}</span>
        </button>

        <button
          onClick={() => setActiveType('income')}
          className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-150 ${
            activeType === 'income'
              ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <ArrowUpRight size={14} />
          <span>{t('income', language)}</span>
        </button>
      </div>

      {/* Add Category Trigger */}
      <button
        onClick={() => setCategoryModalOpen(true)}
        className="w-full py-3 px-4 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-2 text-xs font-semibold transition-all active:scale-98 shadow-sm"
      >
        <Plus size={16} />
        <span>{t('addCategoryOrSub', language)}</span>
      </button>

      {/* Category List */}
      <div className="space-y-3">
        {parentCategories.map((parent) => {
          const subcats = categories.filter((c) => c.parentId === parent.id);

          return (
            <div
              key={parent.id}
              className="p-3.5 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2.5 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center justify-center flex-shrink-0">
                    <Icon name={parent.icon} size={16} />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white block">
                      {parent.name}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {subcats.length} {t('subcategoriesCount', language)}
                    </span>
                  </div>
                </div>

                {!parent.isSystem && (
                  <button
                    onClick={() => handleDelete(parent)}
                    className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-colors"
                    title="Delete Category"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {/* Nested Subcategories */}
              {subcats.length > 0 && (
                <div className="ml-5 pl-4 border-l-2 border-zinc-100 dark:border-zinc-800 space-y-1 pt-1">
                  {subcats.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between py-1 text-xs"
                    >
                      <span className="text-zinc-600 dark:text-zinc-300">{sub.name}</span>
                      {!sub.isSystem && (
                        <button
                          onClick={() => handleDelete(sub)}
                          className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
