import React, { useState, useMemo } from 'react';
import { useLedgerStore } from '../../store/useLedgerStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { LedgerRepository } from '../../db/repository';
import { 
  Trash2, 
  FolderEdit, 
  Tag, 
  CheckCircle2, 
  Clock, 
  X,
  Plus
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Icon } from '../common/Icon';
import { t } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

export const TransactionBulkToolbar: React.FC = () => {
  const { selectedTxIds, clearSelection, incrementHistoryRevision } = useLedgerStore();
  const { language } = useAppStore();

  const [isRecategorizeOpen, setIsRecategorizeOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');
  const [categoryFilterType, setCategoryFilterType] = useState<'all' | 'expense' | 'income'>('all');

  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];

  const parentCategories = categories.filter((c) => !c.parentId);
  const subcategories = categories.filter((c) => c.parentId === selectedCatId);

  // Compute smart suggested tags from existing transactions
  const existingTags = useMemo(() => {
    const tagSet = new Set<string>(['tax', 'personal', 'business', 'vacation', 'subscription', 'reimbursable', 'groceries', 'dining']);
    transactions.forEach((tx) => {
      tx.tags?.forEach((tg) => {
        const clean = tg.trim();
        if (clean) tagSet.add(clean);
      });
    });
    return Array.from(tagSet);
  }, [transactions]);

  if (selectedTxIds.length === 0) return null;

  const count = selectedTxIds.length;
  const countLabel = count === 1
    ? (language === 'km' ? '១ ប្រតិបត្តិការ' : '1 transaction')
    : (language === 'km' ? `${count} ប្រតិបត្តិការ` : `${count} transactions`);

  const handleBulkDelete = async () => {
    const confirmMsg = language === 'km'
      ? `តើអ្នកពិតជាចង់លុប ${countLabel} មែនទេ? អ្នកអាចត្រឡប់វិញបាន។`
      : `Delete ${countLabel}? You can undo this action.`;

    if (confirm(confirmMsg)) {
      await LedgerRepository.bulkDelete(selectedTxIds);
      incrementHistoryRevision();
      clearSelection();
    }
  };

  const handleBulkRecategorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatId) return;

    await LedgerRepository.bulkUpdate(selectedTxIds, {
      categoryId: selectedCatId,
      subcategoryId: selectedSubId || undefined,
    });
    incrementHistoryRevision();
    setIsRecategorizeOpen(false);
    clearSelection();
  };

  const handleBulkAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const tag = tagInput.trim().replace(/^#/, '');
    if (!tag) return;

    await LedgerRepository.bulkUpdate(selectedTxIds, { addTag: tag });
    incrementHistoryRevision();
    setTagInput('');
    setIsTagModalOpen(false);
    clearSelection();
  };

  const handleBulkStatus = async (status: 'cleared' | 'pending') => {
    await LedgerRepository.bulkUpdate(selectedTxIds, { status });
    incrementHistoryRevision();
    clearSelection();
  };

  const filteredParentCategories = parentCategories.filter(
    (c) => categoryFilterType === 'all' || c.type === categoryFilterType
  );

  return (
    <>
      {/* Floating Bulk Actions Island: Sleek, Symmetrical, Elevated above Navbar */}
      <div
        data-testid="transaction-bulk-toolbar"
        className="fixed bottom-[calc(var(--navbar-height,5rem)+1.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-8 left-1/2 -translate-x-1/2 z-40 bg-zinc-950/95 dark:bg-white/95 text-white dark:text-zinc-950 backdrop-blur-xl border border-zinc-800 dark:border-zinc-200 shadow-2xl shadow-black/40 dark:shadow-black/20 rounded-full px-3.5 sm:px-4 py-2 flex items-center justify-between gap-2.5 sm:gap-4 max-w-md w-[calc(100%-2rem)] sm:w-auto animate-slide-up font-['Kantumruy_Pro'] select-none"
      >
        {/* Left: Counter & Selection Info */}
        <div className="flex items-center gap-2 pl-0.5 flex-shrink-0">
          <div className="min-w-6 h-6 px-1.5 rounded-full bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white flex items-center justify-center text-xs font-mono font-bold shadow-sm">
            {count}
          </div>
          <span className="text-xs font-semibold tracking-tight truncate max-w-[85px] sm:max-w-none">
            {t('selectedItems', language)}
          </span>
        </div>

        {/* Center: Action Buttons Group */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Recategorize */}
          <button
            onClick={() => {
              setSelectedCatId('');
              setSelectedSubId('');
              setIsRecategorizeOpen(true);
            }}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 dark:bg-zinc-900/10 hover:bg-white/20 dark:hover:bg-zinc-900/20 active:scale-90 transition-all text-white dark:text-zinc-950"
            title={t('bulkRecategorize', language)}
            aria-label={t('bulkRecategorize', language)}
          >
            <FolderEdit size={15} />
          </button>

          {/* Tag */}
          <button
            onClick={() => setIsTagModalOpen(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 dark:bg-zinc-900/10 hover:bg-white/20 dark:hover:bg-zinc-900/20 active:scale-90 transition-all text-white dark:text-zinc-950"
            title={t('bulkTag', language)}
            aria-label={t('bulkTag', language)}
          >
            <Tag size={15} />
          </button>

          {/* Mark Cleared */}
          <button
            onClick={() => handleBulkStatus('cleared')}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 dark:bg-zinc-900/10 hover:bg-white/20 dark:hover:bg-zinc-900/20 active:scale-90 transition-all text-white dark:text-zinc-950"
            title={t('bulkMarkCleared', language)}
            aria-label={t('bulkMarkCleared', language)}
          >
            <CheckCircle2 size={15} />
          </button>

          {/* Mark Pending */}
          <button
            onClick={() => handleBulkStatus('pending')}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/10 dark:bg-zinc-900/10 hover:bg-white/20 dark:hover:bg-zinc-900/20 active:scale-90 transition-all text-white dark:text-zinc-950"
            title={t('bulkMarkPending', language)}
            aria-label={t('bulkMarkPending', language)}
          >
            <Clock size={15} />
          </button>

          {/* Delete */}
          <button
            onClick={handleBulkDelete}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-rose-500/20 dark:bg-rose-500/15 hover:bg-rose-500/30 text-rose-400 dark:text-rose-600 active:scale-90 transition-all"
            title={t('bulkDelete', language)}
            aria-label={t('bulkDelete', language)}
          >
            <Trash2 size={15} />
          </button>
        </div>

        {/* Right: Separator + Deselect All Button */}
        <div className="flex items-center gap-1 border-l border-zinc-800 dark:border-zinc-200 pl-1.5 flex-shrink-0">
          <button
            onClick={clearSelection}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-white dark:text-zinc-500 dark:hover:text-zinc-950 hover:bg-white/10 dark:hover:bg-zinc-900/10 active:scale-90 transition-all"
            title={t('deselectAll', language)}
            aria-label={t('deselectAll', language)}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Recategorize Modal: Visual Category Picker */}
      <Modal
        isOpen={isRecategorizeOpen}
        onClose={() => setIsRecategorizeOpen(false)}
        title={t('bulkRecategorize', language)}
        subtitle={`${language === 'km' ? 'អនុវត្តប្រភេទថ្មីលើ' : 'Apply new category to'} ${countLabel}`}
        maxWidth="md"
      >
        <form onSubmit={handleBulkRecategorize} className="space-y-4">
          {/* Segmented Filter Toggle: All vs Expense vs Income */}
          <div className="grid grid-cols-3 gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setCategoryFilterType('all')}
              className={`py-1.5 rounded-xl transition-all ${
                categoryFilterType === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {language === 'km' ? 'ទាំងអស់' : 'All'}
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilterType('expense')}
              className={`py-1.5 rounded-xl transition-all ${
                categoryFilterType === 'expense'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {t('expense', language)}
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilterType('income')}
              className={`py-1.5 rounded-xl transition-all ${
                categoryFilterType === 'income'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {t('income', language)}
            </button>
          </div>

          {/* Visual Category Cards Grid */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">
              {t('chooseCategory', language)}
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {filteredParentCategories.map((cat) => {
                const isSelected = selectedCatId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      setSelectedSubId('');
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl text-left transition-all active:scale-95 border ${
                      isSelected
                        ? 'border-zinc-950 dark:border-white bg-zinc-100 dark:bg-zinc-800/90 shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      <Icon name={cat.icon} size={16} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white truncate">
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subcategories Selector (Interactive Chips) */}
          {subcategories.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {t('selectSubcategoryOpt', language)}
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setSelectedSubId('')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border ${
                    selectedSubId === ''
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-transparent shadow-sm'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {t('noSubcategory', language)}
                </button>
                {subcategories.map((sub) => {
                  const isSubSelected = selectedSubId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSubId(sub.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border ${
                        isSubSelected
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-transparent shadow-sm'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      {sub.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsRecategorizeOpen(false)}
              className="w-full py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white active:scale-95 transition-all"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              disabled={!selectedCatId}
              className="w-full py-2.5 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('apply', language)}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Tag Modal: Smart Chips & Interactive Input */}
      <Modal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        title={t('bulkTag', language)}
        subtitle={`${language === 'km' ? 'បន្ថែមស្លាកទៅ' : 'Add tag to'} ${countLabel}`}
        maxWidth="md"
      >
        <form onSubmit={handleBulkAddTag} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              {t('tagName', language)}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                <Tag size={15} />
              </div>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. tax, personal, travel"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors placeholder:text-zinc-400"
              />
            </div>
          </div>

          {/* Quick-Pick Suggested Tags */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 block">
              {t('popularTags', language)}
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {existingTags.map((tg) => {
                const isSelected = tagInput.toLowerCase().replace(/^#/, '') === tg.toLowerCase();
                return (
                  <button
                    key={tg}
                    type="button"
                    onClick={() => setTagInput(tg)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border flex items-center gap-1 ${
                      isSelected
                        ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-transparent shadow-sm'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                    }`}
                  >
                    <Plus size={11} strokeWidth={2.5} />
                    <span>#{tg}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsTagModalOpen(false)}
              className="w-full py-2.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white active:scale-95 transition-all"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              disabled={!tagInput.trim()}
              className="w-full py-2.5 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold text-xs shadow-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('apply', language)}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
