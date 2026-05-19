// Feature: cat-clicker-boredom-cure
// Property 2: Floating text appears near the click position
// Property 3: Purr counter always reflects current state

import { vi, describe, it, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { GameEngine } from '../../GameEngine.ts';
import { AudioManager } from '../../AudioManager.ts';
import { ClickerWidget } from '../../widgets/ClickerWidget.ts';
import { MILESTONES, UPGRADES, DEFAULT_UNLOCKED_AMBIENCE } from '../../constants.ts';
import type { SaveState } from '../../constants.ts';

// ─── Mock AudioManager ────────────────────────────────────────────────────────

const mockAudioManager = {
  isSupported: () => true,
  isAutoplayBlocked: () => false,
  playSfx: vi.fn(),
  playAmbience: vi.fn(),
  stopAmbience: vi.fn(),
  setAmbienceVolume: vi.fn(),
} as unknown as AudioManager;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSaveState(clickValue: number, purrs: number = 0): SaveState {
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
      purrs,
      currentPurrs: purrs,
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
      settings: { reducedMotion: false, soundEnabled: true },
    },
  };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

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

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('ClickerWidget — property tests', () => {

  /**
   * Property 2: Floating text appears near the click position
   * Validates: Requirements 1.4
   *
   * For any click position (x, y) on the Cat_Sprite, the floating "+N Purrs"
   * element injected by ClickerWidget shall have an initial position within
   * 50px (Euclidean distance) of (x, y), and the value N shall equal the
   * current clickValue.
   */
  it('Property 2: floating text is within 50px of click position and shows correct clickValue', () => {
    // Coordinate range: typical viewport coordinates
    const arbCoord = fc.integer({ min: 0, max: 1000 });
    const arbClickValue = fc.integer({ min: 1, max: 1_000_000 });

    fc.assert(
      fc.property(arbCoord, arbCoord, arbClickValue, (x, y, clickValue) => {
        const container = document.createElement('div');
        document.body.appendChild(container);

        const engine = new GameEngine(buildSaveState(clickValue));
        const widget = new ClickerWidget(container, engine, mockAudioManager);

        // Simulate a click at (x, y) on the cat button
        const catButton = container.querySelector('#cat-sprite') as HTMLButtonElement;
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          clientX: x,
          clientY: y,
        });
        catButton.dispatchEvent(clickEvent);

        // Find the injected floating-purrs span
        const span = document.body.querySelector('.floating-purrs') as HTMLSpanElement | null;

        if (!span) {
          widget.destroy();
          container.remove();
          return false;
        }

        // Check text content contains the correct clickValue
        const expectedText = `+${clickValue} Purrs`;
        const textOk = span.textContent === expectedText;

        // Check position is within 50px of (x, y)
        const spanX = parseFloat(span.style.left);
        const spanY = parseFloat(span.style.top);
        const distance = Math.sqrt((spanX - x) ** 2 + (spanY - y) ** 2);
        const positionOk = distance <= 50;

        // Cleanup
        span.remove();
        widget.destroy();
        container.remove();

        return textOk && positionOk;
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: Purr counter always reflects current state
   * Validates: Requirements 1.5
   *
   * For any currentPurrs value in GameState, the text content of the Purr
   * counter DOM element shall equal `Math.floor(state.purrs) + " Purrs"`
   * after each stateChange event (accounting for the 100ms debounce).
   */
  it('Property 3: purr counter text matches Math.floor(purrs) + " Purrs" after stateChange', () => {
    // Number of clicks to simulate (1–20)
    const arbNumClicks = fc.integer({ min: 1, max: 20 });
    // clickValue for the engine
    const arbClickValue = fc.integer({ min: 1, max: 10_000 });

    fc.assert(
      fc.property(arbNumClicks, arbClickValue, (numClicks, clickValue) => {
        vi.useFakeTimers();

        const container = document.createElement('div');
        document.body.appendChild(container);

        const engine = new GameEngine(buildSaveState(clickValue));
        const widget = new ClickerWidget(container, engine, mockAudioManager);

        let allMatch = true;

        for (let i = 0; i < numClicks; i++) {
          engine.click();

          // Advance fake timers past the 100ms debounce
          vi.advanceTimersByTime(150);

          const state = engine.getState();
          const expectedText = `${Math.floor(state.purrs)} Purrs`;
          const purrCounter = container.querySelector('.purr-counter') as HTMLElement;

          if (!purrCounter || purrCounter.textContent !== expectedText) {
            allMatch = false;
            break;
          }
        }

        widget.destroy();
        container.remove();
        vi.useRealTimers();

        return allMatch;
      }),
      { numRuns: 100 },
    );
  });
});
