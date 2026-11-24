import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Users, 
  CreditCard, 
  ArrowLeftRight, 
  Layers, 
  ShieldCheck, 
  Shield, 
  KeyRound, 
  Trash2, 
  Search, 
  Check, 
  Eye, 
  EyeOff, 
  X,
  AlertTriangle
} from 'lucide-react';
import { LedgerRepository } from '../../db/repository';
import { useAppStore } from '../../store/useAppStore';
import { Modal } from '../common/Modal';
import { t } from '../../i18n';
import { UserProfile } from '@contracts/api';

export const AdminPanelModal: React.FC = () => {
  const { 
    isAdminPanelOpen, 
    setAdminPanelOpen, 
    userProfile, 
    setUserProfile, 
    setPinCode,
    language 
  } = useAppStore();

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');

  // PIN Editing State
  const [editingPinUserId, setEditingPinUserId] = useState<string | null>(null);
  const [newPinValue, setNewPinValue] = useState('');
  const [pinSuccessUserId, setPinSuccessUserId] = useState<string | null>(null);
  const [revealedPinUserId, setRevealedPinUserId] = useState<string | null>(null);

  // Deletion Confirmation State
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Status Feedback Toast
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live Query users and metrics from Dexie database
  const liveUsers = useLiveQuery(async () => {
    return LedgerRepository.getAllUsers();
  }, [isAdminPanelOpen]) || [];

  const metrics = useLiveQuery(async () => {
    return LedgerRepository.getSystemMetrics();
  }, [isAdminPanelOpen, liveUsers.length]) || {
    totalUsers: liveUsers.length || 1,
    totalAccounts: 0,
    totalTransactions: 0,
    totalCategories: 0,
  };

  // Auto-clear feedback toast after 3 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  // Filter users by search query
  const filteredUsers = liveUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q) ||
      u.id?.toLowerCase().includes(q)
    );
  });

  // Handle PIN Change Submission
  const handleSavePin = async (userId: string) => {
    if (newPinValue.length !== 4 || !/^\d{4}$/.test(newPinValue)) {
      setFeedback({ type: 'error', message: 'PIN must be exactly 4 numeric digits.' });
      return;
    }

    try {
      await LedgerRepository.updateUserPin(userId, newPinValue);
      if (userProfile && userProfile.id === userId) {
        setPinCode(newPinValue);
        setUserProfile({ ...userProfile, pinCode: newPinValue });
      }
      setPinSuccessUserId(userId);
      setFeedback({ type: 'success', message: t('pinChangedSuccess', language) });
      setTimeout(() => {
        setPinSuccessUserId(null);
        setEditingPinUserId(null);
        setNewPinValue('');
      }, 900);
    } catch (err) {
      console.error('Failed to update PIN:', err);
      setFeedback({ type: 'error', message: 'Failed to update PIN code.' });
    }
  };

  // Handle Role Toggle (Admin <-> User)
  const handleToggleRole = async (targetUser: UserProfile) => {
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    try {
      await LedgerRepository.updateUserRole(targetUser.id, nextRole);
      if (userProfile && userProfile.id === targetUser.id) {
        setUserProfile({ ...userProfile, role: nextRole });
      }
      setFeedback({
        type: 'success',
        message: `${targetUser.name}: ${nextRole === 'admin' ? t('makeAdmin', language) : t('makeUser', language)}`,
      });
    } catch (err) {
      console.error('Failed to toggle role:', err);
      setFeedback({ type: 'error', message: 'Failed to update user role.' });
    }
  };

  // Handle User Deletion
  const handleDeleteUser = async (userId: string) => {
    try {
      const isSelf = userProfile?.id === userId;
      await LedgerRepository.deleteUser(userId);
      setDeletingUserId(null);
      setFeedback({ type: 'success', message: t('userDeletedSuccess', language) });

      if (isSelf) {
        setUserProfile(null);
        setAdminPanelOpen(false);
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      setFeedback({ type: 'error', message: 'Failed to delete user account.' });
    }
  };

  return (
    <Modal
      isOpen={isAdminPanelOpen}
      onClose={() => {
        setAdminPanelOpen(false);
        setEditingPinUserId(null);
        setDeletingUserId(null);
      }}
      title={t('adminConsole', language)}
      subtitle={t('adminConsoleDesc', language)}
      maxWidth="2xl"
    >
      <div className="space-y-4 px-1 py-1 max-h-[75vh] overflow-y-auto">
        {/* Status Toast */}
        {feedback && (
          <div
            className={`p-3 rounded-2xl text-xs font-semibold flex items-center justify-between border transition-all animate-fade-in ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} />}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* System Metrics Bento Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {/* 1. Total Users */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-mono uppercase tracking-wider font-bold">
                {t('totalUsers', language)}
              </span>
              <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                <Users size={14} />
              </div>
            </div>
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-white">
              {metrics.totalUsers}
            </span>
          </div>

          {/* 2. Total Accounts */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-mono uppercase tracking-wider font-bold">
                {t('totalAccounts', language)}
              </span>
              <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                <CreditCard size={14} />
              </div>
            </div>
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-white">
              {metrics.totalAccounts}
            </span>
          </div>

          {/* 3. Total Transactions */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-mono uppercase tracking-wider font-bold">
                {t('totalTransactions', language)}
              </span>
              <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                <ArrowLeftRight size={14} />
              </div>
            </div>
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-white">
              {metrics.totalTransactions}
            </span>
          </div>

          {/* 4. Total Categories */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-[#18181B] border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between shadow-sm">
            <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
              <span className="text-xs font-mono uppercase tracking-wider font-bold">
                {t('totalCategories', language)}
              </span>
              <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                <Layers size={14} />
              </div>
            </div>
            <span className="text-2xl font-bold font-mono tracking-tight text-zinc-950 dark:text-white">
              {metrics.totalCategories}
            </span>
          </div>
        </div>

        {/* User Directory Header & Search */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider font-bold text-zinc-900 dark:text-white">
                {t('userManagement', language)}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {filteredUsers.length}
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchUsersPlaceholder', language)}
              className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* User Roster List */}
        <div className="space-y-2.5">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t('noUsersFound', language)}
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelf = userProfile?.id === user.id;
              const isAdmin = user.role === 'admin';
              const isEditingPin = editingPinUserId === user.id;
              const isDeleting = deletingUserId === user.id;
              const isPinRevealed = revealedPinUserId === user.id;

              return (
                <div
                  key={user.id}
                  className="p-3.5 sm:p-4 rounded-2xl bg-zinc-50 dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 space-y-3 transition-colors shadow-sm"
                >
                  {/* User Profile Header Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm flex-shrink-0"
                        style={{ backgroundColor: user.avatarColor || '#09090B' }}
                      >
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>

                      {/* Name & Email */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-bold text-zinc-950 dark:text-white truncate">
                            {user.name}
                          </span>
                          {/* Role Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                              isAdmin
                                ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950'
                                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {isAdmin ? <ShieldCheck size={11} /> : <Shield size={11} />}
                            <span>{isAdmin ? t('roleAdmin', language) : t('roleUser', language)}</span>
                          </span>

                          {/* Active Session Badge */}
                          {isSelf && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              {t('activeSession', language)}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {/* Quick Role Toggle Button */}
                    <button
                      onClick={() => handleToggleRole(user)}
                      title={isAdmin ? t('makeUser', language) : t('makeAdmin', language)}
                      className="px-2.5 py-1 rounded-xl text-xs font-medium transition-colors border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex-shrink-0"
                    >
                      {isAdmin ? t('makeUser', language) : t('makeAdmin', language)}
                    </button>
                  </div>

                  {/* Security PIN & Account Actions Row */}
                  <div className="pt-2 border-t border-zinc-200/70 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                    {/* PIN Section */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-200/60 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 text-xs font-mono">
                        <KeyRound size={12} className="text-zinc-400" />
                        <span>PIN:</span>
                        <span className="font-bold tracking-wider">
                          {isPinRevealed ? (user.pinCode || '1234') : '••••'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRevealedPinUserId(isPinRevealed ? null : user.id)}
                          className="ml-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                          title="Show / Hide PIN"
                        >
                          {isPinRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>

                      {/* Change PIN Button */}
                      {!isEditingPin && (
                        <button
                          onClick={() => {
                            setEditingPinUserId(user.id);
                            setNewPinValue(user.pinCode || '');
                          }}
                          className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-opacity shadow-sm"
                        >
                          {t('changeUserPin', language)}
                        </button>
                      )}
                    </div>

                    {/* Delete Account Button */}
                    {!isDeleting ? (
                      <button
                        onClick={() => setDeletingUserId(user.id)}
                        className="px-2.5 py-1 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 transition-colors flex items-center gap-1.5"
                        title={t('deleteAccount', language)}
                      >
                        <Trash2 size={12} />
                        <span>{t('delete', language)}</span>
                      </button>
                    ) : (
                      /* Confirm Delete Prompt */
                      <div className="flex items-center gap-1.5 animate-fade-in">
                        <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                          Confirm delete?
                        </span>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-sm"
                        >
                          {t('delete', language)}
                        </button>
                        <button
                          onClick={() => setDeletingUserId(null)}
                          className="px-2 py-1 rounded-xl text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        >
                          {t('cancel', language)}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Inline PIN Editor Form */}
                  {isEditingPin && (
                    <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-fade-in space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {t('changePinForUser', language)} <span className="font-bold">{user.name}</span>
                        </label>
                        <button
                          onClick={() => {
                            setEditingPinUserId(null);
                            setNewPinValue('');
                          }}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <X size={13} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="password"
                          inputMode="numeric"
                          pattern="[0-9]{4}"
                          maxLength={4}
                          placeholder="4-digit PIN"
                          value={newPinValue}
                          onChange={(e) => setNewPinValue(e.target.value.replace(/\D/g, ''))}
                          className="px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-center tracking-widest text-sm text-zinc-900 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-500 w-32"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSavePin(user.id)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 transition-opacity flex items-center gap-1 shadow-sm"
                        >
                          {pinSuccessUserId === user.id ? (
                            <>
                              <Check size={13} />
                              <span>{t('save', language)}</span>
                            </>
                          ) : (
                            t('save', language)
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingPinUserId(null);
                            setNewPinValue('');
                          }}
                          className="px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                        >
                          {t('cancel', language)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
