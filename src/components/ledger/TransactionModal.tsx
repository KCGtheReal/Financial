import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { LedgerRepository } from '../../db/repository';
import { useAppStore } from '../../store/useAppStore';
import { Modal } from '../common/Modal';
import { SplitTransactionForm } from './SplitTransactionForm';
import { 
  Transaction, 
  TransactionType, 
  PaymentMethod, 
  TransactionStatus, 
  TransactionSplit 
} from '@contracts/api';
import { toMinorUnits, toMajorUnits, validateSplitSum, getCurrency } from '../../utils/money';
import { getTodayString } from '../../utils/date';
import { 
  Upload, 
  X, 
  Split, 
  Plus, 
  CreditCard, 
  PenLine, 
  Calendar, 
  Tag, 
  ArrowRightLeft, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';
import { t } from '../../i18n';

export const TransactionModal: React.FC = () => {
  const { 
    isQuickAddOpen, 
    setQuickAddOpen, 
    editingTransaction, 
    setEditingTransaction,
    selectedAccountId,
    setAccountModalOpen,
    setEditingAccount,
    language
  } = useAppStore();

  const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const isOpen = isQuickAddOpen || Boolean(editingTransaction);

  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [date, setDate] = useState(getTodayString());
  const [accountId, setAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [merchant, setMerchant] = useState('');
  const [notes, setNotes] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card');
  const [status, setStatus] = useState<TransactionStatus>('cleared');
  const [attachmentData, setAttachmentData] = useState<string | undefined>();
  const [attachmentName, setAttachmentName] = useState<string | undefined>();
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [splits, setSplits] = useState<TransactionSplit[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);

  const prevIsOpen = useRef(false);

  // Find active account to know currency
  const activeAccount = accounts.find((a) => a.id === accountId) || accounts[0];
  const currency = activeAccount?.currency || 'USD';

  // Handle keypad input
  const handleKeypadPress = useCallback((key: string) => {
    const currDef = getCurrency(currency);
    const maxDecimals = currDef.decimals;

    if (key === '<') {
      setAmountStr((prev) => {
        if (!prev || prev.length <= 1) return '';
        return prev.slice(0, -1);
      });
      return;
    }

    if (key === '.') {
      setAmountStr((prev) => {
        if (!prev || prev === '0') return '0.';
        if (prev.includes('.')) return prev;
        return prev + '.';
      });
      return;
    }

    // Digit 0-9
    setAmountStr((prev) => {
      if (prev.length >= 12) return prev;

      if (prev.includes('.')) {
        const parts = prev.split('.');
        if (parts[1] && parts[1].length >= maxDecimals && maxDecimals > 0) {
          return prev;
        }
      }

      if (prev === '0') {
        return key;
      }

      if (!prev) {
        return key;
      }

      return prev + key;
    });
  }, [currency]);

  // Physical keyboard support while keypad is open
  useEffect(() => {
    if (!isKeypadOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') &&
        target.getAttribute('data-keypad-input') !== 'true'
      ) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeypadPress(e.key);
      } else if (e.key === '.' || e.key === ',') {
        e.preventDefault();
        handleKeypadPress('.');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleKeypadPress('<');
      } else if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        setIsKeypadOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isKeypadOpen, handleKeypadPress]);

  // Sync state when modal opens or editing changes
  useEffect(() => {
    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountStr(toMajorUnits(editingTransaction.amount, currency).toString());
      setDate(editingTransaction.date);
      setAccountId(editingTransaction.accountId);
      setToAccountId(editingTransaction.toAccountId || '');
      setCategoryId(editingTransaction.categoryId || '');
      setSubcategoryId(editingTransaction.subcategoryId || '');
      setMerchant(editingTransaction.merchant);
      setNotes(editingTransaction.notes || '');
      setTags(editingTransaction.tags || []);
      setPaymentMethod(editingTransaction.paymentMethod || 'credit_card');
      setStatus(editingTransaction.status || 'cleared');
      setAttachmentData(editingTransaction.attachmentData);
      setAttachmentName(editingTransaction.attachmentName);
      if (editingTransaction.splits && editingTransaction.splits.length > 0) {
        setIsSplitMode(true);
        setSplits(editingTransaction.splits);
      } else {
        setIsSplitMode(false);
        setSplits([]);
      }
      setShowMoreDetails(Boolean(
        editingTransaction.notes || 
        (editingTransaction.tags && editingTransaction.tags.length > 0) || 
        editingTransaction.attachmentData || 
        editingTransaction.subcategoryId ||
        (editingTransaction.paymentMethod && editingTransaction.paymentMethod !== 'credit_card')
      ));
      setIsKeypadOpen(false);
      prevIsOpen.current = true;
    } else if (isOpen && !prevIsOpen.current) {
      setType('expense');
      setAmountStr('');
      setDate(getTodayString());
      setAccountId(selectedAccountId || (accounts[0]?.id ?? ''));
      setToAccountId(accounts[1]?.id ?? '');
      setCategoryId(categories.find((c) => c.type === 'expense')?.id || '');
      setSubcategoryId('');
      setMerchant('');
      setNotes('');
      setTags([]);
      setPaymentMethod('credit_card');
      setStatus('cleared');
      setAttachmentData(undefined);
      setAttachmentName(undefined);
      setIsSplitMode(false);
      setSplits([]);
      setErrorMessage('');
      setShowMoreDetails(false);
      setIsKeypadOpen(false);
      prevIsOpen.current = true;
    } else if (!isOpen) {
      setIsKeypadOpen(false);
      prevIsOpen.current = false;
    }
  }, [editingTransaction, isOpen, selectedAccountId, accounts, categories, currency]);

  // Fallback if accounts or categories loaded after opening
  useEffect(() => {
    if (isOpen) {
      if (!accountId && accounts.length > 0) {
        setAccountId(selectedAccountId || accounts[0].id);
      }
      if (!categoryId && categories.length > 0) {
        setCategoryId(categories.find((c) => c.type === type)?.id || categories[0].id);
      }
    }
  }, [isOpen, accountId, categoryId, accounts, categories, selectedAccountId, type]);

  const handleClose = useCallback(() => {
    setIsKeypadOpen(false);
    setQuickAddOpen(false);
    setEditingTransaction(null);
    setErrorMessage('');
  }, [setQuickAddOpen, setEditingTransaction]);

  const handleTypeChange = (tType: TransactionType) => {
    setType(tType);
    if (tType === 'transfer') {
      setIsSplitMode(false);
    } else {
      const currentCat = categories.find((c) => c.id === categoryId);
      if (!currentCat || currentCat.type !== tType) {
        const matchingCat = categories.find((c) => !c.parentId && c.type === tType);
        setCategoryId(matchingCat ? matchingCat.id : '');
        setSubcategoryId('');
      }
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Receipt image must be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentData(reader.result as string);
      setAttachmentName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const parsedAmount = toMinorUnits(amountStr, currency);
    if (parsedAmount <= 0) {
      setErrorMessage('Amount must be greater than 0');
      return;
    }

    if (!accountId) {
      setErrorMessage('Please select an account');
      return;
    }

    if (type === 'transfer') {
      if (!toAccountId) {
        setErrorMessage('Please select a destination account for transfer');
        return;
      }
      if (accountId === toAccountId) {
        setErrorMessage('Source and destination accounts must be different');
        return;
      }
    }

    let finalSplits: TransactionSplit[] | undefined = undefined;
    if (isSplitMode && type !== 'transfer') {
      if (splits.length === 0) {
        setErrorMessage('Add at least one split item or disable split mode');
        return;
      }
      const validation = validateSplitSum(parsedAmount, splits);
      if (!validation.isValid) {
        setErrorMessage(
          `Split amounts sum to ${validation.currentSum / 100}, but total is ${parsedAmount / 100}`
        );
        return;
      }
      finalSplits = splits;
    }

    const txData: Transaction = {
      id: editingTransaction ? editingTransaction.id : 'tx-' + Date.now(),
      type,
      amount: parsedAmount,
      date,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type === 'transfer' ? undefined : (isSplitMode ? undefined : categoryId),
      subcategoryId: type === 'transfer' ? undefined : (isSplitMode ? undefined : subcategoryId || undefined),
      merchant: merchant.trim() || (type === 'transfer' ? 'Account Transfer' : 'Uncategorized'),
      notes: notes.trim() || undefined,
      tags,
      paymentMethod,
      status,
      attachmentData,
      attachmentName,
      splits: finalSplits,
      createdAt: editingTransaction ? editingTransaction.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      if (editingTransaction) {
        await LedgerRepository.updateTransaction(txData);
      } else {
        await LedgerRepository.createTransaction(txData);
      }
      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save transaction');
    }
  };

  const availableCategories = categories.filter((c) => !c.parentId && (type === 'transfer' ? true : c.type === type));
  const availableSubcategories = categories.filter((c) => c.parentId === categoryId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingTransaction ? t('editTransaction', language) : t('newTransaction', language)}
      subtitle={t('newTxSubtitle', language)}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Transaction Type Segmented Toggle: Generous Pill Bar */}
        <div className="grid grid-cols-3 gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-full border border-zinc-200 dark:border-zinc-800">
          {(['expense', 'income', 'transfer'] as TransactionType[]).map((tType) => (
            <button
              key={tType}
              type="button"
              onClick={() => handleTypeChange(tType)}
              className={`h-10 sm:h-10.5 rounded-full text-xs font-semibold capitalize transition-all duration-150 cursor-pointer flex items-center justify-center ${
                type === tType
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              {t(tType, language)}
            </button>
          ))}
        </div>

        {/* Hero Amount Display (Click to open slide-up number pad) */}
        <div
          data-testid="hero-amount-display"
          onClick={() => setIsKeypadOpen(true)}
          className="py-3 sm:py-5 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-transform active:scale-98"
          title="Click to enter amount"
        >
          <div className="relative inline-flex items-center justify-center max-w-full">
            <input
              type="text"
              data-keypad-input="true"
              inputMode="none"
              readOnly
              required
              placeholder="0"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              onFocus={() => setIsKeypadOpen(true)}
              className="w-full bg-transparent text-5xl sm:text-6xl font-bold tracking-tight text-center text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-700 outline-none cursor-pointer caret-transparent select-none border-none focus:outline-none focus:ring-0"
            />
          </div>
          <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">
            {currency}
          </span>
        </div>

        {/* Card Rows Section */}
        <div className="space-y-2.5">
          {/* Card 1: Account Selection */}
          {type === 'transfer' ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all min-h-[3.5rem]">
                <CreditCard size={18} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
                <div className="flex-1 flex items-center justify-between gap-2 overflow-hidden">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                    {t('fromAccount', language)}
                  </span>
                  <select
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full text-right bg-transparent text-sm font-semibold text-zinc-900 dark:text-white outline-none cursor-pointer truncate"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id} className="text-zinc-900 dark:text-white bg-white dark:bg-zinc-900">
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all min-h-[3.5rem]">
                <ArrowRightLeft size={18} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
                <div className="flex-1 flex items-center justify-between gap-2 overflow-hidden">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                    {t('toAccount', language)}
                  </span>
                  <select
                    required
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full text-right bg-transparent text-sm font-semibold text-zinc-900 dark:text-white outline-none cursor-pointer truncate"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id} className="text-zinc-900 dark:text-white bg-white dark:bg-zinc-900">
                        {acc.name} ({acc.currency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all min-h-[3.5rem]">
              <CreditCard size={18} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
              {accounts.length === 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    setEditingAccount(null);
                    setAccountModalOpen(true);
                  }}
                  className="w-full text-left text-sm font-semibold text-zinc-900 dark:text-white flex items-center justify-between cursor-pointer group"
                >
                  <span className="flex items-center gap-2">
                    <Plus size={16} className="text-zinc-900 dark:text-white group-hover:scale-110 transition-transform" />
                    <span>{language === 'km' ? 'បង្កើតកាតគណនី' : 'Create Account Card'}</span>
                  </span>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                    {language === 'km' ? 'បង្កើត' : 'Add Card'}
                  </span>
                </button>
              ) : (
                <>
                  <select
                    required
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full bg-transparent text-sm font-semibold text-zinc-900 dark:text-white outline-none cursor-pointer truncate"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id} className="text-zinc-900 dark:text-white bg-white dark:bg-zinc-900">
                        {acc.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 uppercase shrink-0 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    {currency}
                  </span>
                </>
              )}
            </div>
          )}

          {/* Card 2: Payee / Title */}
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all min-h-[3.5rem]">
            <PenLine size={18} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder={language === 'km' ? 'ចំណងជើងប្រតិបត្តិការ' : 'Add Title'}
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"
            />
          </div>

          {/* Card 3: Date */}
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all min-h-[3.5rem]">
            <Calendar size={18} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold text-zinc-900 dark:text-white outline-none cursor-pointer"
            />
            {date === getTodayString() && (
              <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 shrink-0 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700">
                {language === 'km' ? 'ថ្ងៃនេះ' : 'Today'}
              </span>
            )}
          </div>

          {/* Card 4: Category (For Expense & Income) */}
          {type !== 'transfer' && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-sm focus-within:border-zinc-400 dark:focus-within:border-zinc-600 transition-all min-h-[3.5rem]">
                <Tag size={18} className="text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 shrink-0">
                  {t('category', language)}
                </span>
                <select
                  value={categoryId}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setSubcategoryId('');
                  }}
                  className="w-full text-right bg-transparent text-sm font-semibold text-zinc-900 dark:text-white outline-none cursor-pointer truncate"
                >
                  <option value="" className="text-zinc-900 dark:text-white bg-white dark:bg-zinc-900">
                    {language === 'km' ? 'ជ្រើសរើសប្រភេទ' : 'Select Category'}
                  </option>
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id} className="text-zinc-900 dark:text-white bg-white dark:bg-zinc-900">
                      {cat.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsSplitMode(!isSplitMode)}
                  title={isSplitMode ? 'Single Category' : 'Split Category'}
                  className={`h-9 px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 ${
                    isSplitMode
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                      : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  <Split size={15} />
                  <span className="hidden sm:inline">{isSplitMode ? 'Single' : 'Split'}</span>
                </button>
              </div>

              {/* Split Category Engine */}
              {isSplitMode && (
                <SplitTransactionForm
                  totalAmount={toMinorUnits(amountStr, currency)}
                  currency={currency}
                  categories={categories}
                  splits={splits}
                  onChange={setSplits}
                  language={language}
                />
              )}
            </div>
          )}
        </div>

        {/* Collapsible More Options: Retaining all rich ledger features */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowMoreDetails(!showMoreDetails)}
            className="w-full h-11 px-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center justify-between hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer active:scale-[0.99]"
          >
            <span className="flex items-center gap-2">
              <span>{language === 'km' ? 'ជម្រើសបន្ថែម' : 'More Options'}</span>
              {(notes || tags.length > 0 || attachmentData || (paymentMethod && paymentMethod !== 'credit_card') || status !== 'cleared') && (
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 dark:bg-white" />
              )}
            </span>
            {showMoreDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showMoreDetails && (
            <div className="mt-2.5 space-y-3.5 p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
              {/* Subcategory if applicable */}
              {type !== 'transfer' && !isSplitMode && availableSubcategories.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('subcategory', language)}
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={(e) => setSubcategoryId(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 cursor-pointer"
                  >
                    <option value="">{t('selectSubcategory', language)}</option>
                    {availableSubcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Payment Method & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('paymentMethod', language)}
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full h-11 px-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-semibold text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600 cursor-pointer"
                  >
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="e_wallet">E-Wallet (KHQR / Digital)</option>
                    <option value="check">Check</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    {t('status', language)}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setStatus('cleared')}
                      className={`h-11 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center ${
                        status === 'cleared'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                      }`}
                    >
                      {t('cleared', language)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('pending')}
                      className={`h-11 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center ${
                        status === 'pending'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                      }`}
                    >
                      {t('pending', language)}
                    </button>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('tags', language)}
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add tag and press Enter"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    className="flex-1 h-11 px-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="h-11 px-5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs sm:text-sm font-bold hover:opacity-90 cursor-pointer active:scale-95 transition-all"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 shadow-sm"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-rose-500 cursor-pointer p-0.5 rounded-full"
                          title="Remove tag"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t('notes', language)}
                </label>
                <textarea
                  rows={2}
                  placeholder="Add optional notes, invoice numbers, or details..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                />
              </div>

              {/* Receipt Image Upload */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {t('attachment', language)}
                </label>
                {attachmentData ? (
                  <div className="relative group w-full max-h-40 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <img
                      src={attachmentData}
                      alt={attachmentName || 'Receipt'}
                      className="w-full object-cover max-h-40"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setAttachmentData(undefined);
                        setAttachmentName(undefined);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/80 text-white hover:bg-rose-500 transition-colors cursor-pointer"
                      title={t('removeAttachment', language)}
                    >
                      <X size={14} />
                    </button>
                    <div className="absolute bottom-2 left-2 text-[10px] bg-black/75 px-2 py-0.5 rounded text-white">
                      {attachmentName}
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-4 border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-500 rounded-xl cursor-pointer transition-colors bg-white dark:bg-zinc-900">
                    <Upload size={18} className="text-zinc-400 dark:text-zinc-500 mb-1" />
                    <span className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-semibold">
                      {t('uploadAttachment', language)}
                    </span>
                    <span className="text-[10px] text-zinc-400 mt-0.5">
                      PNG, JPG, WebP up to 5MB
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Full-Width Bottom CTA Button */}
        <div className="pt-2">
          <button
            type="submit"
            className="w-full h-12 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-sm tracking-wide flex items-center justify-center gap-2 shadow-md hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
          >
            <CreditCard size={17} />
            <span>
              {editingTransaction 
                ? t('save', language) 
                : (language === 'km' ? 'រក្សាទុកប្រតិបត្តិការ' : 'Save Transaction')}
            </span>
          </button>
        </div>

        {/* Backdrop for Number Pad to dismiss when clicking outside */}
        {isKeypadOpen && (
          <div
            data-testid="number-pad-backdrop"
            className="fixed inset-0 z-30"
            onClick={() => setIsKeypadOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Slide-Up Number Pad Panel */}
        <div
          data-testid="number-pad-panel"
          className={`fixed bottom-0 left-0 right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:w-full sm:max-w-md z-40 bg-[#F4F5F7] dark:bg-[#151518] border-t border-zinc-200/80 dark:border-zinc-800 rounded-t-[32px] shadow-2xl transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] transform-gpu will-change-transform select-none ${
            isKeypadOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Keypad Header with Dismiss Handle & Done Button */}
          <div className="flex items-center justify-between px-6 pt-3 pb-2">
            <button
              type="button"
              onClick={() => setIsKeypadOpen(false)}
              className="w-10 h-10 -ml-2 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              title="Close keypad"
            >
              <ChevronDown size={22} />
            </button>
            <div
              onClick={() => setIsKeypadOpen(false)}
              className="w-14 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 cursor-pointer hover:bg-zinc-400 dark:hover:bg-zinc-600 transition-colors"
              title="Dismiss"
            />
            <button
              type="button"
              onClick={() => setIsKeypadOpen(false)}
              className="h-10 px-4 -mr-2 text-sm font-bold text-zinc-900 dark:text-white rounded-xl hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center"
            >
              {language === 'km' ? 'រួចរាល់' : 'Done'}
            </button>
          </div>

          {/* 3x4 Keypad Grid matching exact spacious layout in reference mockup */}
          <div className="grid grid-cols-3 gap-x-3 gap-y-3 sm:gap-y-4 px-6 sm:px-8 pt-2 pb-safe pb-8 sm:pb-10">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '<'].map((key) => (
              <button
                key={key}
                type="button"
                data-testid={`keypad-key-${key}`}
                onClick={() => handleKeypadPress(key)}
                className="h-16 sm:h-20 rounded-3xl flex items-center justify-center text-3xl sm:text-4xl font-normal sm:font-medium text-zinc-900 dark:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/40 active:bg-zinc-200/80 dark:active:bg-zinc-800/80 active:scale-95 transition-all cursor-pointer font-sans"
              >
                {key === '<' ? (
                  <span className="text-2xl sm:text-3xl font-light tracking-tighter">&lt;</span>
                ) : key === '.' ? (
                  <span className="text-3xl sm:text-4xl font-bold leading-none">.</span>
                ) : (
                  key
                )}
              </button>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};
