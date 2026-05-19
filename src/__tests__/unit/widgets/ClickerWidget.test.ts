// Unit tests for ClickerWidget
// Requirements: 1.3, 1.4

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameEngine } from '../../../GameEngine.ts';
import { AudioManager } from '../../../AudioManager.ts';
import { ClickerWidget } from '../../../widgets/ClickerWidget.ts';
import { MILESTONES, UPGRADES, DEFAULT_UNLOCKED_AMBIENCE } from '../../../constants.ts';
import type { SaveState } from '../../../constants.ts';

// ─── Mock AudioManager ────────────────────────────────────────────────────────

const mockAudioManager = {
  isSupported: () => true,
  isAutoplayBlocked: () => false,
  playSfx: vi.fn(),
  playAmbience: vi.fn(),
  stopAmbience: vi.fn(),
  setAmbienceVolume: vi.fn(),
} as unknown as AudioManager;

// ─── Mock AudioContext for GameEngine ─────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('AudioContext', vi.fn(() => ({
    currentTime: 0,
    destination: {},
    createGain: vi.fn(() => ({
      gain: { value: 0.7, setValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    resume: vi.fn(() => Promise.resolve()),
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSaveState(clickValue: number = 1, soundEnabled: boolean = true): SaveState {
  const upgrades: Record<string, { owned: number }> = {};
  for (const upgrade of UPGRADES) {
    upgrades[upgrade.id] = { owned: 0 };
  }
  const milestones: Record<string, boolean> = {};
  for (const milestone of MILESTONES) {
    milestones[milestone.id] = false;
  }
  const now = Date.now();
  return {
    version: 1,
    savedAt: now,
    state: {
      purrs: 0,
      currentPurrs: 0,
      clickValue,
      purrsPerSecond: 0,
      upgrades,
      milestones,
      unlockedAmbience: [...DEFAULT_UNLOCKED_AMBIENCE],
      unlockedSkins: [],
      activeSkin: 'default',
      lastSaveTime: now,
      lastActiveTime: now,
      activeAmbienceTrack: null,
      ambienceVolume: 0.7,
      notifications: [],
      settings: { reducedMotion: false, soundEnabled },
    },
  };
}

function createWidget(clickValue: number = 1, soundEnabled: boolean = true): {
  container: HTMLDivElement;
  engine: GameEngine;
  widget: ClickerWidget;
  catButton: HTMLButtonElement;
} {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const engine = new GameEngine(buildSaveState(clickValue, soundEnabled));
  const widget = new ClickerWidget(container, engine, mockAudioManager);
  const catButton = container.querySelector('#cat-sprite') as HTMLButtonElement;
  return { container, engine, widget, catButton };
}

function simulateClick(catButton: HTMLButtonElement, x = 100, y = 100): void {
  catButton.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ClickerWidget', () => {

  // ─── Bounce animation ──────────────────────────────────────────────────────

  describe('bounce animation', () => {
    it('adds cat--bounce class to the cat button on click', () => {
      const { widget, catButton, container } = createWidget();

      simulateClick(catButton);

      expect(catButton.classList.contains('cat--bounce')).toBe(true);

      widget.destroy();
      container.remove();
    });

    it('removes cat--bounce class after animationend fires', () => {
      const { widget, catButton, container } = createWidget();

      simulateClick(catButton);
      expect(catButton.classList.contains('cat--bounce')).toBe(true);

      // Fire animationend
      catButton.dispatchEvent(new Event('animationend'));

      expect(catButton.classList.contains('cat--bounce')).toBe(false);

      widget.destroy();
      container.remove();
    });

    it('resets bounce class (remove + re-add via requestAnimationFrame) if click arrives mid-animation', () => {
      const rafCallbacks: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      }));

      const { widget, catButton, container } = createWidget();

      // First click — starts animation
      simulateClick(catButton);
      expect(catButton.classList.contains('cat--bounce')).toBe(true);

      // Second click while animating — should remove class and schedule re-add via rAF
      simulateClick(catButton);

      // After second click, class should be removed (mid-animation reset)
      expect(catButton.classList.contains('cat--bounce')).toBe(false);

      // Execute the rAF callback — class should be re-added
      expect(rafCallbacks.length).toBeGreaterThan(0);
      rafCallbacks[rafCallbacks.length - 1](0);
      expect(catButton.classList.contains('cat--bounce')).toBe(true);

      widget.destroy();
      container.remove();
    });
  });

  // ─── Floating text ─────────────────────────────────────────────────────────

  describe('floating text', () => {
    it('injects a <span class="floating-purrs"> on click', () => {
      const { widget, catButton, container } = createWidget();

      simulateClick(catButton);

      const span = document.body.querySelector('.floating-purrs');
      expect(span).not.toBeNull();

      // Cleanup
      span?.remove();
      widget.destroy();
      container.remove();
    });

    it('floating text content is "+N Purrs" where N equals the clickValue', () => {
      const clickValue = 7;
      const { widget, catButton, container } = createWidget(clickValue);

      simulateClick(catButton);

      const span = document.body.querySelector('.floating-purrs');
      expect(span?.textContent).toBe(`+${clickValue} Purrs`);

      span?.remove();
      widget.destroy();
      container.remove();
    });

    it('removes the floating text span after 800ms', () => {
      vi.useFakeTimers();

      const { widget, catButton, container } = createWidget();

      simulateClick(catButton);

      // Span should exist immediately after click
      expect(document.body.querySelector('.floating-purrs')).not.toBeNull();

      // Advance time to just before 800ms — span should still be present
      vi.advanceTimersByTime(799);
      expect(document.body.querySelector('.floating-purrs')).not.toBeNull();

      // Advance past 800ms — span should be removed
      vi.advanceTimersByTime(1);
      expect(document.body.querySelector('.floating-purrs')).toBeNull();

      widget.destroy();
      container.remove();
    });
  });

  // ─── Muted indicator ───────────────────────────────────────────────────────

  describe('muted indicator', () => {
    it('muted indicator is hidden when soundEnabled is true', () => {
      const { widget, container } = createWidget(1, true);

      const mutedIndicator = container.querySelector('.muted-indicator') as HTMLElement;
      expect(mutedIndicator).not.toBeNull();
      expect(mutedIndicator.style.display).toBe('none');

      widget.destroy();
      container.remove();
    });

    it('muted indicator is visible when soundEnabled is false', () => {
      const { widget, container } = createWidget(1, false);

      const mutedIndicator = container.querySelector('.muted-indicator') as HTMLElement;
      expect(mutedIndicator).not.toBeNull();
      expect(mutedIndicator.style.display).toBe('inline');

      widget.destroy();
      container.remove();
    });
  });
});
