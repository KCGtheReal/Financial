import React from 'react';
import { 
  Receipt, 
  Landmark, 
  Plus, 
  FolderTree, 
  Settings2 
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { t } from '../../i18n';

export const MobileNav: React.FC = () => {
  const { activeTab, setActiveTab, setQuickAddOpen, language } = useAppStore();

  const handleTabClick = (tab: typeof activeTab) => {
    if (activeTab === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveTab(tab);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-black/95 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 px-3 pb-safe pt-2 transition-colors duration-200 font-['Kantumruy_Pro']">
      <div className="max-w-md mx-auto flex items-center justify-around relative">
        {/* Tab 1: Ledger */}
        <button
          onClick={() => handleTabClick('ledger')}
          className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-150 ${
            activeTab === 'ledger'
              ? 'text-zinc-950 dark:text-white font-semibold'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Receipt size={20} strokeWidth={activeTab === 'ledger' ? 2.5 : 1.75} />
          <span className="text-[11px] mt-0.5 tracking-tight font-medium truncate">
            {t('ledger', language)}
          </span>
        </button>

        {/* Tab 2: Accounts */}
        <button
          onClick={() => handleTabClick('accounts')}
          className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-150 ${
            activeTab === 'accounts'
              ? 'text-zinc-950 dark:text-white font-semibold'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Landmark size={20} strokeWidth={activeTab === 'accounts' ? 2.5 : 1.75} />
          <span className="text-[11px] mt-0.5 tracking-tight font-medium truncate">
            {t('accounts', language)}
          </span>
        </button>

        {/* Center Quick Add Action Button: Crisp B&W */}
        <div className="relative -top-3.5 flex flex-col items-center">
          <button
            onClick={() => setQuickAddOpen(true)}
            className="w-14 h-14 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-lg shadow-black/20 dark:shadow-white/10 active:scale-90 transition-transform p-3.5 border-4 border-white dark:border-black"
            aria-label="New Transaction"
          >
            <Plus size={24} strokeWidth={2.8} />
          </button>
        </div>

        {/* Tab 3: Categories */}
        <button
          onClick={() => handleTabClick('categories')}
          className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-150 ${
            activeTab === 'categories'
              ? 'text-zinc-950 dark:text-white font-semibold'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <FolderTree size={20} strokeWidth={activeTab === 'categories' ? 2.5 : 1.75} />
          <span className="text-[11px] mt-0.5 tracking-tight font-medium truncate">
            {t('categories', language)}
          </span>
        </button>

        {/* Tab 4: Settings */}
        <button
          onClick={() => handleTabClick('settings')}
          className={`flex flex-col items-center justify-center w-16 py-1 rounded-xl transition-all duration-150 ${
            activeTab === 'settings'
              ? 'text-zinc-950 dark:text-white font-semibold'
              : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          <Settings2 size={20} strokeWidth={activeTab === 'settings' ? 2.5 : 1.75} />
          <span className="text-[11px] mt-0.5 tracking-tight font-medium truncate">
            {t('settings', language)}
          </span>
        </button>
      </div>
    </nav>
  );
};
