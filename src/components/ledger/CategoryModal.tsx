import React, { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { LedgerRepository } from '../../db/repository';
import { useAppStore } from '../../store/useAppStore';
import { Modal } from '../common/Modal';
import { Icon } from '../common/Icon';
import { Category } from '@contracts/api';
import { Plus, Trash2, FolderPlus } from 'lucide-react';
import { t } from '../../i18n';

const AVAILABLE_ICONS = [
  'Home', 'Utensils', 'Coffee', 'Car', 'Fuel', 'Bus', 'Zap', 'Wifi',
  'Activity', 'Film', 'ShoppingBag', 'Briefcase', 'TrendingUp',
  'Laptop', 'ShieldCheck', 'CreditCard', 'PiggyBank', 'Gift'
];

const PRESET_COLORS = [
  '#18181B', '#71717A', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'
];

export const CategoryModal: React.FC = () => {
  const { isCategoryModalOpen, setCategoryModalOpen, language } = useAppStore();

  const categories = useLiveQuery(() => db.categories.orderBy('order').toArray()) || [];

  const [name, setName] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [parentId, setParentId] = useState<string>('');
  const [icon, setIcon] = useState('CircleDollarSign');
  const [color, setColor] = useState('#18181B');

  const parentCategories = categories.filter((c) => !c.parentId);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCategory: Category = {
      id: 'cat-' + Date.now(),
      name: name.trim(),
      type,
      parentId: parentId || undefined,
      icon,
      color,
      order: categories.length + 1,
      isSystem: false,
    };

    await LedgerRepository.createCategory(newCategory);
    setName('');
    setParentId('');
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (confirm(`Delete category "${cat.name}" and any subcategories?`)) {
      await LedgerRepository.deleteCategory(cat.id);
    }
  };

  const handleClose = useCallback(() => {
    setCategoryModalOpen(false);
  }, [setCategoryModalOpen]);

  return (
    <Modal
      isOpen={isCategoryModalOpen}
      onClose={handleClose}
      title={t('categories', language)}
      subtitle="Create custom parent categories and subcategories with custom icons"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Category Creation Form */}
        <form onSubmit={handleCreateCategory} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <FolderPlus size={16} className="text-zinc-900 dark:text-white" />
            <span className="text-xs font-semibold text-zinc-900 dark:text-white">Add New Category / Subcategory</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Gym, Streaming, Coffee"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'expense' | 'income')}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Parent Category</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="">(None - Top-level Category)</option>
                {parentCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Icon & Color Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Icon</label>
              <div className="flex items-center gap-1.5 flex-wrap max-h-20 overflow-y-auto p-1.5 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                {AVAILABLE_ICONS.map((iName) => (
                  <button
                    key={iName}
                    type="button"
                    onClick={() => setIcon(iName)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      icon === iName 
                        ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950' 
                        : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon name={iName} size={14} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Color Accent</label>
              <div className="flex items-center gap-2 pt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-lg transition-transform ${
                      color === c ? 'scale-110 ring-2 ring-zinc-900 dark:ring-white ring-offset-1 ring-offset-white dark:ring-offset-black' : 'opacity-70'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 flex items-center gap-1 shadow-sm"
            >
              <Plus size={14} />
              <span>Add Category</span>
            </button>
          </div>
        </form>

        {/* Existing Categories Tree */}
        <div className="space-y-3">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider font-mono">
            Existing Taxonomy ({categories.length})
          </span>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {parentCategories.map((parent) => {
              const subcats = categories.filter((c) => c.parentId === parent.id);

              return (
                <div key={parent.id} className="p-3 rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-900 dark:text-white">
                        <Icon name={parent.icon} size={14} />
                      </div>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-white">{parent.name}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                        {parent.type}
                      </span>
                    </div>

                    {!parent.isSystem && (
                      <button
                        onClick={() => handleDeleteCategory(parent)}
                        className="p-1 text-zinc-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Subcategories */}
                  {subcats.length > 0 && (
                    <div className="mt-2 ml-7 pl-3 border-l border-zinc-200 dark:border-zinc-800 space-y-1">
                      {subcats.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between py-0.5 text-xs">
                          <span className="text-zinc-600 dark:text-zinc-400">{sub.name}</span>
                          {!sub.isSystem && (
                            <button
                              onClick={() => handleDeleteCategory(sub)}
                              className="p-1 text-zinc-400 hover:text-rose-600 rounded"
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
      </div>
    </Modal>
  );
};
