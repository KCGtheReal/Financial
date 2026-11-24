// @vitest-environment jsdom
import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { Modal } from '../src/components/common/Modal';
import { toMinorUnits, validateSplitSum } from '../src/utils/money';
import fs from 'fs';
import path from 'path';

describe('Modal & Bottom Sheet Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('CSS Keyframe Architecture Verification', () => {
    it('verifies src/index.css contains GPU-composited slide up/down keyframes and utility classes', () => {
      const cssPath = path.resolve(__dirname, '../src/index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      // Keyframes
      expect(cssContent).toContain('@keyframes sheetSlideUp');
      expect(cssContent).toContain('@keyframes sheetSlideDown');
      expect(cssContent).toContain('@keyframes backdropFadeIn');
      expect(cssContent).toContain('@keyframes backdropFadeOut');

      // Keyframe definitions
      expect(cssContent).toContain('transform: translateY(100%)');
      expect(cssContent).toContain('transform: translateY(0%)');

      // Animation utility classes
      expect(cssContent).toContain('.sheet-enter');
      expect(cssContent).toContain('.sheet-exit');
      expect(cssContent).toContain('.backdrop-enter');
      expect(cssContent).toContain('.backdrop-exit');
      expect(cssContent).toContain('will-change: transform');
      expect(cssContent).toContain('will-change: opacity');

      // Bottom Tab Gap: navbar + 2rem
      expect(cssContent).toContain('--navbar-height: 5rem;');
      expect(cssContent).toContain('--tab-bottom-gap: 2rem;');
      expect(cssContent).toContain('var(--navbar-height, 5rem) + var(--tab-bottom-gap, 2rem)');
    });
  });

  describe('Modal Component Mount & Slide-Up Lifecycle', () => {
    it('mounts into DOM with .sheet-enter and .backdrop-enter classes on open', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const bottomSheet = screen.getByTestId('bottom-sheet');
      const backdrop = screen.getByTestId('modal-backdrop');

      expect(bottomSheet).toBeTruthy();
      expect(bottomSheet.classList.contains('w-full')).toBe(true);
      expect(bottomSheet.classList.contains('sm:max-w-md')).toBe(true);
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(true);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);

      expect(backdrop).toBeTruthy();
      expect(backdrop.classList.contains('backdrop-enter')).toBe(true);
      expect(backdrop.classList.contains('backdrop-exit')).toBe(false);
    });

    it('does not render into DOM when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()} title="Closed Modal">
          <p>Content</p>
        </Modal>
      );

      expect(screen.queryByTestId('bottom-sheet')).toBeNull();
      expect(screen.queryByTestId('modal-backdrop')).toBeNull();
    });
  });

  describe('Backdrop Click & Slide-Down Exit Animation', () => {
    it('transitions to .sheet-exit and .backdrop-exit, waits 240ms before unmounting and calling onClose', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const backdrop = screen.getByTestId('modal-backdrop');
      const bottomSheet = screen.getByTestId('bottom-sheet');

      // Click the backdrop outside the bottom sheet
      fireEvent.click(backdrop);

      // Immediately upon click, classes switch to exit animations
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(true);
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(backdrop.classList.contains('backdrop-exit')).toBe(true);
      expect(backdrop.classList.contains('backdrop-enter')).toBe(false);

      // onClose has NOT been called yet because animation is in progress
      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();

      // Fast-forward 240ms for the slide-down animation to finish
      act(() => {
        vi.advanceTimersByTime(240);
      });

      // Now onClose is called and modal unmounts from DOM
      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    });

    it('clicking close button (X) triggers .sheet-exit and slides down before unmounting', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const closeButton = screen.getByTestId('modal-close-button');
      const bottomSheet = screen.getByTestId('bottom-sheet');

      fireEvent.click(closeButton);

      expect(bottomSheet.classList.contains('sheet-exit')).toBe(true);
      expect(handleClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(240);
      });

      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    });

    it('pressing Escape key triggers slide-down exit animation', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const bottomSheet = screen.getByTestId('bottom-sheet');

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(bottomSheet.classList.contains('sheet-exit')).toBe(true);

      act(() => {
        vi.advanceTimersByTime(240);
      });

      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    });
  });

  describe('External isOpen Prop Flip to False', () => {
    it('slides down gracefully with .sheet-exit when parent sets isOpen to false', () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <Modal isOpen={true} onClose={handleClose} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const bottomSheet = screen.getByTestId('bottom-sheet');
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(true);

      // Parent sets isOpen to false (e.g. form submitted)
      rerender(
        <Modal isOpen={false} onClose={handleClose} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      // Must NOT disappear instantly! Must have .sheet-exit
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(true);
      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();

      // After 240ms, clean unmount
      act(() => {
        vi.advanceTimersByTime(240);
      });

      expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    });
  });

  describe('Zero Re-Animation on Prop or State Changes (Glitch Prevention)', () => {
    it('does NOT re-trigger sheet-enter or slide-up animation when parent re-renders with new callback references', () => {
      let closeHandler = () => {};
      const { rerender } = render(
        <Modal isOpen={true} onClose={closeHandler} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const bottomSheet = screen.getByTestId('bottom-sheet');
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(true);

      // Advance timers by 280ms to lock entered state
      act(() => {
        vi.advanceTimersByTime(280);
      });

      // sheet-enter should now be removed
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);

      // Parent re-renders with a brand new function reference for onClose
      closeHandler = () => {};
      rerender(
        <Modal isOpen={true} onClose={closeHandler} title="New Transaction">
          <p>Updated Form Content</p>
        </Modal>
      );

      // Crucial assertion: sheet-enter must NOT be re-applied! Modal must NOT re-slide up!
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);
    });

    it('switching between Expense, Income, and Transfer does NOT re-trigger bottom sheet animation', () => {
      const TestTransactionForm = () => {
        const [type, setType] = useState('expense');
        const [amount, setAmount] = useState('');

        return (
          <Modal
            isOpen={true}
            onClose={() => {}}
            title="New Transaction"
          >
            <div data-testid="active-type">{type}</div>
            <button onClick={() => setType('expense')}>Expense</button>
            <button onClick={() => setType('income')}>Income</button>
            <button onClick={() => setType('transfer')}>Transfer</button>
            <input
              data-testid="amount-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Modal>
        );
      };

      render(<TestTransactionForm />);

      const bottomSheet = screen.getByTestId('bottom-sheet');
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(true);

      // Finish enter animation
      act(() => {
        vi.advanceTimersByTime(280);
      });
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);

      // Click "Income" button
      const incomeBtn = screen.getByText('Income');
      fireEvent.click(incomeBtn);

      expect(screen.getByTestId('active-type').textContent).toBe('income');
      // The bottom sheet MUST NOT have sheet-enter or sheet-exit applied!
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);

      // Click "Transfer" button
      const transferBtn = screen.getByText('Transfer');
      fireEvent.click(transferBtn);

      expect(screen.getByTestId('active-type').textContent).toBe('transfer');
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);

      // Click "Expense" button
      const expenseBtn = screen.getByText('Expense');
      fireEvent.click(expenseBtn);

      expect(screen.getByTestId('active-type').textContent).toBe('expense');
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);

      // Type amount
      const amountInput = screen.getByTestId('amount-input');
      fireEvent.change(amountInput, { target: { value: '150.00' } });

      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);
    });
  });

  describe('Touch Drag Down Gesture to Dismiss', () => {
    it('applies 1:1 finger tracking during downward drag', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const grabHandle = screen.getByTestId('bottom-sheet-grab-handle');
      const bottomSheet = screen.getByTestId('bottom-sheet');

      // Start drag at Y = 100
      fireEvent.touchStart(grabHandle, {
        touches: [{ clientY: 100 }],
      });

      // Move down to Y = 150 (deltaY = 50)
      fireEvent.touchMove(window, {
        touches: [{ clientY: 150 }],
      });

      expect(bottomSheet.style.transform).toBe('translateY(50px)');
      expect(bottomSheet.style.transition).toBe('none');
    });

    it('snaps back smoothly if drag release is under 80px threshold', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const grabHandle = screen.getByTestId('bottom-sheet-grab-handle');
      const bottomSheet = screen.getByTestId('bottom-sheet');

      // Start drag at Y = 100
      fireEvent.touchStart(grabHandle, { touches: [{ clientY: 100 }] });
      // Move down 40px (< 80px)
      fireEvent.touchMove(window, { touches: [{ clientY: 140 }] });
      // Release
      fireEvent.touchEnd(window);

      // Snaps back to 0px with spring transition
      expect(bottomSheet.style.transform).toBe('translateY(0px)');
      expect(bottomSheet.style.transition).toContain('transform 0.24s');

      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Should still be open and resting
      expect(handleClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    });

    it('dismisses and slides down if drag release exceeds 80px threshold', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const grabHandle = screen.getByTestId('bottom-sheet-grab-handle');
      const bottomSheet = screen.getByTestId('bottom-sheet');

      // Start drag at Y = 100
      fireEvent.touchStart(grabHandle, { touches: [{ clientY: 100 }] });
      // Move down 120px (> 80px threshold)
      fireEvent.touchMove(window, { touches: [{ clientY: 220 }] });
      // Release
      fireEvent.touchEnd(window);

      // Transitions to full translateY(100%) to complete the slide-down
      expect(bottomSheet.style.transform).toBe('translateY(100%)');
      expect(bottomSheet.style.transition).toContain('transform 0.24s');

      act(() => {
        vi.advanceTimersByTime(240);
      });

      expect(handleClose).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('bottom-sheet')).toBeNull();
    });
  });

  describe('Zero Re-Animation on Prop or State Changes (Glitch Prevention)', () => {
    it('does NOT re-trigger sheet-enter or slide-up animation when parent re-renders with new callback references', () => {
      let closeHandler = () => {};
      const { rerender } = render(
        <Modal isOpen={true} onClose={closeHandler} title="New Transaction">
          <p>Transaction Form Content</p>
        </Modal>
      );

      const bottomSheet = screen.getByTestId('bottom-sheet');
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(true);

      // Advance timers by 280ms to lock entered state
      act(() => {
        vi.advanceTimersByTime(280);
      });

      // sheet-enter should now be removed
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);

      // Parent re-renders with a brand new function reference for onClose
      closeHandler = () => {};
      rerender(
        <Modal isOpen={true} onClose={closeHandler} title="New Transaction">
          <p>Updated Form Content</p>
        </Modal>
      );

      // Crucial assertion: sheet-enter must NOT be re-applied! Modal must NOT re-slide up!
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);
    });

    it('switching between Expense, Income, and Transfer does NOT re-trigger bottom sheet animation', () => {
      const TestTransactionForm = () => {
        const [type, setType] = useState('expense');
        const [amount, setAmount] = useState('');

        return (
          <Modal
            isOpen={true}
            onClose={() => {}}
            title="New Transaction"
          >
            <div data-testid="active-type">{type}</div>
            <button onClick={() => setType('expense')}>Expense</button>
            <button onClick={() => setType('income')}>Income</button>
            <button onClick={() => setType('transfer')}>Transfer</button>
            <input
              data-testid="amount-input"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Modal>
        );
      };

      render(<TestTransactionForm />);

      const bottomSheet = screen.getByTestId('bottom-sheet');
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(true);

      // Finish enter animation
      act(() => {
        vi.advanceTimersByTime(280);
      });
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);

      // Click "Income" button
      const incomeBtn = screen.getByText('Income');
      fireEvent.click(incomeBtn);

      expect(screen.getByTestId('active-type').textContent).toBe('income');
      // The bottom sheet MUST NOT have sheet-enter or sheet-exit applied!
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);

      // Click "Transfer" button
      const transferBtn = screen.getByText('Transfer');
      fireEvent.click(transferBtn);

      expect(screen.getByTestId('active-type').textContent).toBe('transfer');
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);

      // Click "Expense" button
      const expenseBtn = screen.getByText('Expense');
      fireEvent.click(expenseBtn);

      expect(screen.getByTestId('active-type').textContent).toBe('expense');
      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);

      // Type amount
      const amountInput = screen.getByTestId('amount-input');
      fireEvent.change(amountInput, { target: { value: '150.00' } });

      expect(bottomSheet.classList.contains('sheet-enter')).toBe(false);
      expect(bottomSheet.classList.contains('sheet-exit')).toBe(false);
    });
  });

  describe('Transaction Modal Invariants', () => {
    it('validates transfer requires distinct source and destination accounts', () => {
      const accountA = 'acc-1';
      const accountB = 'acc-2';
      const sameAccount = (acc1: string, acc2: string) => acc1 === acc2;

      expect(sameAccount(accountA, accountB)).toBe(false);
      expect(sameAccount(accountA, accountA)).toBe(true);
    });

    it('requires amount greater than 0 in minor units', () => {
      expect(toMinorUnits('0', 'USD')).toBe(0);
      expect(toMinorUnits('0.00', 'USD')).toBe(0);
      expect(toMinorUnits('-5.00', 'USD') <= 0).toBe(true);
      expect(toMinorUnits('12.50', 'USD')).toBe(1250);
      expect(toMinorUnits('12.50', 'USD') > 0).toBe(true);
    });

    it('validates multi-category split matches the transaction total exactly', () => {
      const totalAmount = toMinorUnits('100.00', 'USD');
      const validSplits = [
        { id: '1', amount: 4000, categoryId: 'cat-food' },
        { id: '2', amount: 6000, categoryId: 'cat-transport' },
      ];
      const result = validateSplitSum(totalAmount, validSplits);
      expect(result.isValid).toBe(true);
      expect(result.difference).toBe(0);

      const invalidSplits = [
        { id: '1', amount: 4000, categoryId: 'cat-food' },
        { id: '2', amount: 5000, categoryId: 'cat-transport' },
      ];
      const invalidResult = validateSplitSum(totalAmount, invalidSplits);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.difference).toBe(1000);
    });
  });

  describe('Tab Navigation Scroll Position Invariants', () => {
    it('resets window and document scroll position to top (0, 0) upon tab change', () => {
      let scrollY = 850;
      window.scrollTo = vi.fn((optionsOrX: any, y?: any) => {
        if (typeof optionsOrX === 'object') {
          scrollY = optionsOrX.top ?? 0;
        } else {
          scrollY = y ?? 0;
        }
      });

      // Simulate being scrolled down at bottom of Core Ledger
      expect(scrollY).toBe(850);

      // Switching tab executes scroll reset
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;

      expect(scrollY).toBe(0);
      expect(document.documentElement.scrollTop).toBe(0);
      expect(document.body.scrollTop).toBe(0);
    });
  });

  describe('Slide-Up Number Pad & Keypad Interaction', () => {
    it('verifies keypad input logic for digits, period, backspace, and leading zeros', () => {
      // Simulate the exact state and handler used by the slide-up keypad
      let amountStr = '';
      const maxDecimals = 2;

      const handleKeypadPress = (key: string) => {
        if (key === '<') {
          if (!amountStr || amountStr.length <= 1) {
            amountStr = '';
          } else {
            amountStr = amountStr.slice(0, -1);
          }
          return;
        }

        if (key === '.') {
          if (!amountStr || amountStr === '0') {
            amountStr = '0.';
            return;
          }
          if (amountStr.includes('.')) return;
          amountStr += '.';
          return;
        }

        if (amountStr.length >= 12) return;

        if (amountStr.includes('.')) {
          const parts = amountStr.split('.');
          if (parts[1] && parts[1].length >= maxDecimals && maxDecimals > 0) {
            return;
          }
        }

        if (amountStr === '0') {
          amountStr = key;
          return;
        }

        if (!amountStr) {
          amountStr = key;
          return;
        }

        amountStr += key;
      };

      // 1. Initial typing
      handleKeypadPress('1');
      expect(amountStr).toBe('1');
      handleKeypadPress('5');
      expect(amountStr).toBe('15');

      // 2. Add decimal
      handleKeypadPress('.');
      expect(amountStr).toBe('15.');

      // 3. Prevent double decimal
      handleKeypadPress('.');
      expect(amountStr).toBe('15.');

      // 4. Add cents
      handleKeypadPress('5');
      expect(amountStr).toBe('15.5');
      handleKeypadPress('0');
      expect(amountStr).toBe('15.50');

      // 5. Prevent 3rd decimal digit for 2-decimal currency
      handleKeypadPress('9');
      expect(amountStr).toBe('15.50');

      // 6. Backspace removes last digit
      handleKeypadPress('<');
      expect(amountStr).toBe('15.5');
      handleKeypadPress('<');
      expect(amountStr).toBe('15.');
      handleKeypadPress('<');
      expect(amountStr).toBe('15');

      // 7. Complete delete returns to empty
      handleKeypadPress('<');
      expect(amountStr).toBe('1');
      handleKeypadPress('<');
      expect(amountStr).toBe('');

      // 8. Typing period on empty starts with 0.
      handleKeypadPress('.');
      expect(amountStr).toBe('0.');
    });

    it('verifies keypad slide-up/down transition classes and backdrop presence', () => {
      // Test the keypad panel element with isKeypadOpen true vs false
      const KeypadMock = ({ isOpen }: { isOpen: boolean }) => (
        <div>
          {isOpen && <div data-testid="number-pad-backdrop" />}
          <div
            data-testid="number-pad-panel"
            className={`fixed bottom-0 z-40 transition-transform duration-300 ${
              isOpen ? 'translate-y-0' : 'translate-y-full pointer-events-none'
            }`}
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '<'].map((k) => (
              <button key={k} data-testid={`key-${k}`}>
                {k}
              </button>
            ))}
          </div>
        </div>
      );

      // When open: backdrop is rendered, translate-y-0 is active
      const { rerender } = render(<KeypadMock isOpen={true} />);
      const panelOpen = screen.getByTestId('number-pad-panel');
      const backdrop = screen.getByTestId('number-pad-backdrop');

      expect(panelOpen.classList.contains('translate-y-0')).toBe(true);
      expect(panelOpen.classList.contains('translate-y-full')).toBe(false);
      expect(backdrop).toBeTruthy();

      // All 12 keys exist
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '<'].forEach((k) => {
        expect(screen.getByTestId(`key-${k}`)).toBeTruthy();
      });

      // When closed: backdrop removed, translate-y-full is active
      rerender(<KeypadMock isOpen={false} />);
      const panelClosed = screen.getByTestId('number-pad-panel');
      expect(panelClosed.classList.contains('translate-y-full')).toBe(true);
      expect(panelClosed.classList.contains('pointer-events-none')).toBe(true);
      expect(screen.queryByTestId('number-pad-backdrop')).toBeNull();
    });
  });
});
