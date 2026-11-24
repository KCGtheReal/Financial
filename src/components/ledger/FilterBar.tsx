import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  Bookmark 
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { LedgerRepository } from '../../db/repository';
import { getDateRangePresets } from '../../utils/date';
import { Modal } from '../common/Modal';
import { t } from '../../i18n';

export const FilterBar: React.FC = () => {
  const { filter, setFilter, resetFilter, language } = useAppStore();
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [filterPresetName, setFilterPresetName] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const savedFilters = useLiveQuery(() => db.savedFilters.toArray()) || [];
  const datePresets = getDateRangePresets();

  // Hotkey "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const hasActiveFilters = Boolean(
    filter.query ||
    (filter.categoryIds && filter.categoryIds.length > 0) ||
    (filter.types && filter.types.length > 0) ||
    (filter.statuses && filter.statuses.length > 0) ||
    (filter.tags && filter.tags.length > 0) ||
    filter.dateFrom ||
    filter.dateTo ||
    filter.amountMin !== undefined ||
    filter.amountMax !== undefined
  );

  const handleSaveFilter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filterPresetName.trim()) return;

    await LedgerRepository.saveFilter({
      id: 'flt-' + Date.now(),
      name: filterPresetName.trim(),
      filter: { ...filter },
      createdAt: new Date().toISOString(),
    });

    setFilterPresetName('');
    setIsSaveModalOpen(false);
  };

  return (
    <div className="w-full bg-white dark:bg-black border-b border-zinc-200 dark:border-zinc-850 px-4 sm:px-6 py-2.5 transition-colors duration-200">
      <div className="max-w-md sm:max-w-7xl mx-auto space-y-2.5">
        {/* Main Search Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('searchPlaceholder', language)}
              value={filter.query || ''}
              onChange={(e) => setFilter((prev) => ({ ...prev, query: e.target.value }))}
              className="w-full pl-9 pr-10 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-all font-sans"
            />
            {filter.query && (
              <button
                onClick={() => setFilter((prev) => ({ ...prev, query: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded-full"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center justify-center w-10 h-10 rounded-2xl border transition-all flex-shrink-0 ${
              showAdvanced || hasActiveFilters
                ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:text-zinc-900 dark:hover:text-white'
            }`}
            title={t('filters', language)}
          >
            <Filter size={16} />
          </button>
        </div>

        {/* Quick Date Range Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none font-['Kantumruy_Pro']">
          <button
            onClick={() =>
              setFilter((prev) => ({
                ...prev,
                dateFrom: undefined,
                dateTo: undefined,
              }))
            }
            className={`text-xs px-3 py-1 rounded-full border transition-all flex-shrink-0 ${
              !filter.dateFrom && !filter.dateTo
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100 font-semibold shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            {t('allTime', language)}
          </button>
          <button
            onClick={() =>
              setFilter((prev) => ({
                ...prev,
                dateFrom: datePresets.today.from,
                dateTo: datePresets.today.to,
              }))
            }
            className={`text-xs px-3 py-1 rounded-full border transition-all flex-shrink-0 ${
              filter.dateFrom === datePresets.today.from && filter.dateTo === datePresets.today.to
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100 font-semibold shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            {t('today', language)}
          </button>
          <button
            onClick={() =>
              setFilter((prev) => ({
                ...prev,
                dateFrom: datePresets.last7Days.from,
                dateTo: datePresets.last7Days.to,
              }))
            }
            className={`text-xs px-3 py-1 rounded-full border transition-all flex-shrink-0 ${
              filter.dateFrom === datePresets.last7Days.from && filter.dateTo === datePresets.last7Days.to
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100 font-semibold shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            {t('last7Days', language)}
          </button>
          <button
            onClick={() =>
              setFilter((prev) => ({
                ...prev,
                dateFrom: datePresets.thisMonth.from,
                dateTo: datePresets.thisMonth.to,
              }))
            }
            className={`text-xs px-3 py-1 rounded-full border transition-all flex-shrink-0 ${
              filter.dateFrom === datePresets.thisMonth.from && filter.dateTo === datePresets.thisMonth.to
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 border-zinc-900 dark:border-zinc-100 font-semibold shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            {t('thisMonth', language)}
          </button>

          {/* Saved Filters Dropdown */}
          {savedFilters.length > 0 && (
            <select
              onChange={(e) => {
                const saved = savedFilters.find((f) => f.id === e.target.value);
                if (saved) setFilter(saved.filter);
              }}
              defaultValue=""
              className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 outline-none flex-shrink-0"
            >
              <option value="" disabled>
                ★ {t('savedFilters', language)}
              </option>
              {savedFilters.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {sf.name}
                </option>
              ))}
            </select>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={resetFilter}
              className="text-xs text-rose-500 hover:text-rose-600 dark:text-rose-400 px-2.5 py-1 flex items-center gap-1 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all flex-shrink-0 font-medium"
            >
              <X size={12} />
              <span>{t('clearFilters', language)}</span>
            </button>
          )}
        </div>

        {/* Advanced Filters Expandable Drawer */}
        {showAdvanced && (
          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs animate-fade-in">
            {/* Transaction Type Filter */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('type', language)}
              </label>
              <select
                value={filter.types?.[0] || ''}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    types: e.target.value ? [e.target.value as any] : undefined,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="">{t('allTypes', language)}</option>
                <option value="expense">{t('expense', language)}</option>
                <option value="income">{t('income', language)}</option>
                <option value="transfer">{t('transfer', language)}</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('status', language)}
              </label>
              <select
                value={filter.statuses?.[0] || ''}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    statuses: e.target.value ? [e.target.value as any] : undefined,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="">{t('allStatuses', language)}</option>
                <option value="cleared">{t('cleared', language)}</option>
                <option value="pending">{t('pending', language)}</option>
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('category', language)}
              </label>
              <select
                value={filter.categoryIds?.[0] || ''}
                onChange={(e) =>
                  setFilter((prev) => ({
                    ...prev,
                    categoryIds: e.target.value ? [e.target.value] : undefined,
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
              >
                <option value="">{t('allCategories', language)}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Inputs */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                {t('dateRange', language)}
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={filter.dateFrom || ''}
                  onChange={(e) =>
                    setFilter((prev) => ({ ...prev, dateFrom: e.target.value || undefined }))
                  }
                  className="w-1/2 px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs outline-none"
                />
                <span className="text-zinc-400">-</span>
                <input
                  type="date"
                  value={filter.dateTo || ''}
                  onChange={(e) =>
                    setFilter((prev) => ({ ...prev, dateTo: e.target.value || undefined }))
                  }
                  className="w-1/2 px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs outline-none"
                />
              </div>
            </div>

            {/* Save Current Filter Preset Button */}
            {hasActiveFilters && (
              <div className="sm:col-span-2 md:col-span-4 flex justify-end pt-1">
                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  className="text-xs text-zinc-900 dark:text-zinc-100 hover:opacity-80 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-medium"
                >
                  <Bookmark size={13} />
                  <span>{t('saveCurrentFilter', language)}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save Filter Preset Modal */}
      <Modal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        title={t('saveCurrentFilter', language)}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveFilter} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('filterName', language)}
            </label>
            <input
              type="text"
              required
              placeholder={t('filterPresetPlaceholder', language)}
              value={filterPresetName}
              onChange={(e) => setFilterPresetName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white text-sm outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsSaveModalOpen(false)}
              className="px-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold"
            >
              {t('save', language)}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
