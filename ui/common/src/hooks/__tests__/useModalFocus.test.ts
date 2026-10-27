import { createRoot, createSignal } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useModalFocus } from '../useModalFocus';

describe('useModalFocus', () => {
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  let animationFrameCallbacks: Map<number, FrameRequestCallback>;
  let disposeTestRoot: (() => void) | undefined;
  let nextAnimationFrameId: number;

  beforeEach(() => {
    animationFrameCallbacks = new Map();
    disposeTestRoot = undefined;
    nextAnimationFrameId = 0;
    window.cancelAnimationFrame = vi.fn((animationFrameId: number) => {
      animationFrameCallbacks.delete(animationFrameId);
    });
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      nextAnimationFrameId += 1;
      animationFrameCallbacks.set(nextAnimationFrameId, callback);
      return nextAnimationFrameId;
    });
  });

  afterEach(() => {
    disposeTestRoot?.();
    window.cancelAnimationFrame = originalCancelAnimationFrame;
    window.requestAnimationFrame = originalRequestAnimationFrame;
    document.body.replaceChildren();
  });

  it('should close only the nested modal and restore focus to its trigger', async () => {
    const parentModal = document.createElement('div');
    const childModal = document.createElement('div');
    const childCloseButton = document.createElement('button');
    const childModalTrigger = document.createElement('button');
    const onChildClose = vi.fn();
    const onParentClose = vi.fn();

    markVisible(childCloseButton);
    markVisible(childModalTrigger);
    childModal.appendChild(childCloseButton);
    parentModal.append(childModalTrigger, childModal);
    document.body.appendChild(parentModal);
    childModalTrigger.focus();

    disposeTestRoot = createRoot((disposeRoot) => {
      const [childOpen, setChildOpen] = createSignal(true);
      const [parentOpen, setParentOpen] = createSignal(true);

      useModalFocus(
        () => parentModal,
        parentOpen,
        () => {
          onParentClose();
          setParentOpen(false);
        }
      );
      useModalFocus(
        () => childModal,
        childOpen,
        () => {
          onChildClose();
          setChildOpen(false);
        }
      );

      return disposeRoot;
    });

    await Promise.resolve();
    runAnimationFrames(animationFrameCallbacks);
    expect(document.activeElement).toBe(childCloseButton);

    childCloseButton.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onChildClose).toHaveBeenCalledTimes(1);
    expect(onParentClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(childModalTrigger);

    childModal.remove();
  });

  it('should wrap focus without including hidden controls', async () => {
    const modal = document.createElement('div');
    const firstButton = document.createElement('button');
    const hiddenButton = document.createElement('button');
    const lastButton = document.createElement('button');

    hiddenButton.style.display = 'none';
    markVisible(firstButton);
    markVisible(lastButton);
    modal.append(firstButton, lastButton, hiddenButton);
    document.body.appendChild(modal);

    disposeTestRoot = createRoot((disposeRoot) => {
      const [open] = createSignal(true);
      useModalFocus(() => modal, open, vi.fn());
      return disposeRoot;
    });

    await Promise.resolve();
    runAnimationFrames(animationFrameCallbacks);
    expect(document.activeElement).toBe(firstButton);

    lastButton.focus();
    lastButton.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab' }));
    expect(document.activeElement).toBe(firstButton);

    firstButton.focus();
    firstButton.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Tab', shiftKey: true }));
    expect(document.activeElement).toBe(lastButton);
  });
});

const runAnimationFrames = (animationFrameCallbacks: Map<number, FrameRequestCallback>) => {
  const callbacks = Array.from(animationFrameCallbacks.values());
  animationFrameCallbacks.clear();
  callbacks.forEach((callback) => callback(performance.now()));
};

const markVisible = (element: HTMLElement) => {
  vi.spyOn(element, 'getClientRects').mockReturnValue([{} as DOMRect] as unknown as DOMRectList);
};
