import { LedgerHistoryAction } from '@contracts/api';

class HistoryManager {
  private undoStack: LedgerHistoryAction[] = [];
  private redoStack: LedgerHistoryAction[] = [];
  private listeners: Array<() => void> = [];
  private maxHistory: number = 50;

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  public push(action: Omit<LedgerHistoryAction, 'id' | 'timestamp'>) {
    const fullAction: LedgerHistoryAction = {
      ...action,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };

    this.undoStack.push(fullAction);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    // Clear redo stack on new action
    this.redoStack = [];
    this.notify();
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public getLastUndoDescription(): string | null {
    if (this.undoStack.length === 0) return null;
    return this.undoStack[this.undoStack.length - 1].description;
  }

  public getLastRedoDescription(): string | null {
    if (this.redoStack.length === 0) return null;
    return this.redoStack[this.redoStack.length - 1].description;
  }

  public async undo(): Promise<boolean> {
    const action = this.undoStack.pop();
    if (!action) return false;

    try {
      await action.undo();
      this.redoStack.push(action);
      this.notify();
      return true;
    } catch (err) {
      console.error('Failed to undo action:', err);
      return false;
    }
  }

  public async redo(): Promise<boolean> {
    const action = this.redoStack.pop();
    if (!action) return false;

    try {
      await action.redo();
      this.undoStack.push(action);
      this.notify();
      return true;
    } catch (err) {
      console.error('Failed to redo action:', err);
      return false;
    }
  }

  public clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }
}

export const historyManager = new HistoryManager();
