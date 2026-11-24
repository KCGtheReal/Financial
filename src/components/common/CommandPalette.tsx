import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  PlusCircle, 
  Eye, 
  EyeOff, 
  Lock, 
  Sun, 
  Moon, 
  Languages, 
  Layers, 
  FolderPlus, 
  Undo2, 
  Redo2, 
  FilterX,
  ShieldCheck
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useLedgerStore } from '../../store/useLedgerStore';
import { historyManager } from '../../utils/history';

export const CommandPalette: React.FC = () => {
  const { 
    isCommandPaletteOpen, 
    setCommandPaletteOpen,
    setQuickAddOpen,
    isPrivacyMode,
    togglePrivacyMode,
    setIsAppLocked,
    theme,
    setTheme,
    language,
    setLanguage,
    setAccountModalOpen,
    setCategoryModalOpen,
    resetFilter,
    setAdminPanelOpen,
  } = useAppStore();

  const { incrementHistoryRevision } = useLedgerStore();
  const [query, setQuery] = useState('');

  // Keyboard shortcut listener: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const commands = [
    {
      id: 'new-tx',
      title: 'New Transaction',
      subtitle: 'Add expense, income, or transfer',
      shortcut: 'N',
      icon: PlusCircle,
      action: () => {
        setCommandPaletteOpen(false);
        setQuickAddOpen(true);
      },
    },
    {
      id: 'privacy',
      title: isPrivacyMode ? 'Disable Privacy Mode' : 'Enable Privacy Mode',
      subtitle: isPrivacyMode ? 'Reveal monetary amounts' : 'Blur all balances and amounts',
      shortcut: 'P',
      icon: isPrivacyMode ? Eye : EyeOff,
      action: () => {
        togglePrivacyMode();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'lock',
      title: 'Lock App',
      subtitle: 'Require 4-digit PIN to re-enter',
      shortcut: 'L',
      icon: Lock,
      action: () => {
        setIsAppLocked(true);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'admin',
      title: 'Admin Console',
      subtitle: 'System metrics, user directory, and PIN management',
      shortcut: 'A',
      icon: ShieldCheck,
      action: () => {
        setCommandPaletteOpen(false);
        setAdminPanelOpen(true);
      },
    },
    {
      id: 'theme',
      title: theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
      subtitle: 'Toggle appearance',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'lang',
      title: language === 'en' ? 'ប្តូរជាភាសាខ្មែរ (Khmer)' : 'Switch to English',
      subtitle: 'Switch application language',
      icon: Languages,
      action: () => {
        setLanguage(language === 'en' ? 'km' : 'en');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'manage-acc',
      title: 'Manage Accounts',
      subtitle: 'Create, edit, or archive accounts',
      icon: Layers,
      action: () => {
        setCommandPaletteOpen(false);
        setAccountModalOpen(true);
      },
    },
    {
      id: 'manage-cat',
      title: 'Manage Categories',
      subtitle: 'Add or customize categories and subcategories',
      icon: FolderPlus,
      action: () => {
        setCommandPaletteOpen(false);
        setCategoryModalOpen(true);
      },
    },
    {
      id: 'clear-filter',
      title: 'Clear All Filters',
      subtitle: 'Show all historical ledger entries',
      icon: FilterX,
      action: () => {
        resetFilter();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'undo',
      title: 'Undo Last Action',
      subtitle: historyManager.getLastUndoDescription() || 'Nothing to undo',
      shortcut: 'Ctrl+Z',
      icon: Undo2,
      action: async () => {
        await historyManager.undo();
        incrementHistoryRevision();
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'redo',
      title: 'Redo Action',
      subtitle: historyManager.getLastRedoDescription() || 'Nothing to redo',
      shortcut: 'Ctrl+Y',
      icon: Redo2,
      action: async () => {
        await historyManager.redo();
        incrementHistoryRevision();
        setCommandPaletteOpen(false);
      },
    },
  ];

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const paletteNode = (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4 animate-fade-in">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm"
        onClick={() => setCommandPaletteOpen(false)}
      />

      {/* Palette Box: Minimalist B&W */}
      <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden z-10 flex flex-col text-zinc-900 dark:text-zinc-100 animate-scale-in">
        <div className="flex items-center px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
          <Search size={16} className="text-zinc-400 dark:text-zinc-500 mr-3" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 text-sm font-sans"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded border border-zinc-200 dark:border-zinc-700">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-400">
              No matching commands found
            </div>
          ) : (
            filtered.map((item) => {
              const ItemIcon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 transition-colors">
                      <ItemIcon size={15} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-900 dark:text-white">
                        {item.title}
                      </div>
                      <div className="text-xs text-zinc-500 line-clamp-1">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>
                  {item.shortcut && (
                    <kbd className="px-2 py-1 text-[10px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded border border-zinc-200 dark:border-zinc-700">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(paletteNode, document.body) : paletteNode;
};
