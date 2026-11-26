import React, { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { LedgerRepository } from '../../db/repository';
import { Modal } from '../common/Modal';
import { ConfirmModal } from '../common/ConfirmModal';
import { Account, AccountType } from '@contracts/api';
import { CURRENCIES, getCurrency, toMinorUnits, toMajorUnits } from '../../utils/money';
import { generateId } from '../../utils/id';
import { t } from '../../i18n';
import { Archive, Trash2 } from 'lucide-react';

const ACCOUNT_TYPES: { type: AccountType; label: string }[] = [
  { type: 'bank', label: 'Bank Checking' },
  { type: 'savings', label: 'Savings Reserve' },
  { type: 'credit_card', label: 'Credit Card' },
  { type: 'cash', label: 'Physical Cash' },
  { type: 'e_wallet', label: 'E-Wallet (KHQR / Digital)' },
  { type: 'investment', label: 'Investment Portfolio' },
  { type: 'loan', label: 'Loan / Debt' },
];

const PRESET_COLORS = [
  '#18181B', // Zinc Black
  '#71717A', // Slate Gray
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
];

export const AccountModal: React.FC = () => {
  const { 
    isAccountModalOpen, 
    setAccountModalOpen, 
    editingAccount, 
    setEditingAccount, 
    language 
  } = useAppStore();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [currency, setCurrency] = useState('USD');
  const [initialBalanceStr, setInitialBalanceStr] = useState('0.00');
  const [color, setColor] = useState('#18181B');
  const [institutionName, setInstitutionName] = useState('');
  const [accountNumberMask, setAccountNumberMask] = useState('');
  const [isArchived, setIsArchived] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (editingAccount) {
      setName(editingAccount.name);
      setType(editingAccount.type);
      setCurrency(editingAccount.currency);
      setInitialBalanceStr(toMajorUnits(editingAccount.initialBalance, editingAccount.currency).toString());
      setColor(editingAccount.color);
      setInstitutionName(editingAccount.institutionName || '');
      setAccountNumberMask(editingAccount.accountNumberMask || '');
      setIsArchived(editingAccount.isArchived || false);
      setNotes(editingAccount.notes || '');
    } else {
      setName('');
      setType('bank');
      setCurrency('USD');
      setInitialBalanceStr('0.00');
      setColor('#18181B');
      setInstitutionName('');
      setAccountNumberMask('');
      setIsArchived(false);
      setNotes('');
    }
    setErrorMessage('');
  }, [editingAccount, isAccountModalOpen]);

  const handleClose = useCallback(() => {
    setAccountModalOpen(false);
    setEditingAccount(null);
    setErrorMessage('');
  }, [setAccountModalOpen, setEditingAccount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !name.trim()) return;

    setErrorMessage('');
    setIsSubmitting(true);
    try {
      const minorUnits = toMinorUnits(initialBalanceStr, currency);

      const accountData: Account = {
        id: editingAccount ? editingAccount.id : generateId('acc'),
        userId: editingAccount?.userId,
        name: name.trim(),
        type,
        currency,
        initialBalance: minorUnits,
        currentBalance: editingAccount ? editingAccount.currentBalance : minorUnits,
        color,
        icon: 'Landmark',
        isArchived,
        institutionName: institutionName.trim() || undefined,
        accountNumberMask: accountNumberMask.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: editingAccount ? editingAccount.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingAccount) {
        await LedgerRepository.updateAccount(accountData);
      } else {
        await LedgerRepository.createAccount(accountData);
      }

      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleDelete = () => {
    if (!editingAccount || isSubmitting) return;
    setIsDeleteConfirmOpen(true);
  };

  const executeDeleteAccount = async () => {
    if (!editingAccount || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await LedgerRepository.deleteAccount(editingAccount.id);
      handleClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Modal
      isOpen={isAccountModalOpen}
      onClose={handleClose}
      title={editingAccount ? t('editAccount', language) : t('addAccount', language)}
      subtitle="Configure account type, currency, and initial ledger balance"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Account Name *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Primary Checking"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
        </div>

        {/* Type & Currency */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('accountType', language)}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full px-3 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            >
              {ACCOUNT_TYPES.map((tItem) => (
                <option key={tItem.type} value={tItem.type}>
                  {tItem.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              {t('currency', language)}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            >
              {Object.values(CURRENCIES).map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.code} ({curr.symbol}) - {curr.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Initial Balance */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {t('initialBalance', language)} ({currency})
          </label>
          <input
            type="number"
            step={getCurrency(currency).decimals === 0 ? '1' : '0.01'}
            value={initialBalanceStr}
            onChange={(e) => setInitialBalanceStr(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-900 dark:text-white font-mono outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          />
        </div>

        {/* Institution & Mask */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Institution Name
            </label>
            <input
              type="text"
              placeholder="e.g. Chase Bank, ABA"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Account Number Mask
            </label>
            <input
              type="text"
              placeholder="e.g. •••• 1234"
              value={accountNumberMask}
              onChange={(e) => setAccountNumberMask(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
          </div>
        </div>

        {/* Color Palette */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
            Color Accent
          </label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-xl transition-transform ${
                  color === c ? 'scale-110 ring-2 ring-zinc-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-black' : 'opacity-70 hover:opacity-100'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Archive Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <Archive size={16} className="text-zinc-500" />
            <div>
              <span className="text-xs font-medium text-zinc-900 dark:text-white block">
                {t('archiveAccount', language)}
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Hide from daily balance while preserving history
              </span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isArchived}
            onChange={(e) => setIsArchived(e.target.checked)}
            className="w-4 h-4 rounded text-zinc-900 dark:text-white accent-zinc-900 dark:accent-white cursor-pointer"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
          {editingAccount ? (
            <button
              type="button"
              onClick={handleDelete}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 flex items-center justify-center gap-1 py-2 px-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 size={14} />
              <span>{t('delete', language)}</span>
            </button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 sm:flex-none px-4 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white text-center"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-6 py-2.5 text-xs rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-semibold hover:opacity-90 text-center shadow-sm disabled:opacity-50"
            >
              {t('save', language)}
            </button>
          </div>
        </div>
      </form>
    </Modal>

    <ConfirmModal
      isOpen={isDeleteConfirmOpen && isAccountModalOpen}
      onClose={() => setIsDeleteConfirmOpen(false)}
      onConfirm={executeDeleteAccount}
      title={language === 'km' ? 'លុបគណនី' : 'Delete Account'}
      message={
        editingAccount
          ? language === 'km'
            ? `តើអ្នកប្រាកដជាចង់លុប "${editingAccount.name}" និងប្រតិបត្តិការដែលភ្ជាប់ទាំងអស់មែនទេ?`
            : `Delete account "${editingAccount.name}" and all its linked transactions?`
          : ''
      }
      confirmLabel={t('delete', language)}
      tone="danger"
      isLoading={isSubmitting}
    />
    </>
  );
};
