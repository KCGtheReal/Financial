import { create } from 'zustand';

interface LedgerSelectionState {
  selectedTxIds: string[];
  selectTx: (id: string) => void;
  deselectTx: (id: string) => void;
  toggleSelectTx: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  
  // History trigger counter to re-render undo/redo states
  historyRevision: number;
  incrementHistoryRevision: () => void;
}

export const useLedgerStore = create<LedgerSelectionState>((set) => ({
  selectedTxIds: [],
  selectTx: (id) =>
    set((state) => ({
      selectedTxIds: state.selectedTxIds.includes(id) ? state.selectedTxIds : [...state.selectedTxIds, id],
    })),
  deselectTx: (id) =>
    set((state) => ({
      selectedTxIds: state.selectedTxIds.filter((item) => item !== id),
    })),
  toggleSelectTx: (id) =>
    set((state) => ({
      selectedTxIds: state.selectedTxIds.includes(id)
        ? state.selectedTxIds.filter((item) => item !== id)
        : [...state.selectedTxIds, id],
    })),
  selectAll: (ids) => set({ selectedTxIds: ids }),
  clearSelection: () => set({ selectedTxIds: [] }),

  historyRevision: 0,
  incrementHistoryRevision: () => set((state) => ({ historyRevision: state.historyRevision + 1 })),
}));
