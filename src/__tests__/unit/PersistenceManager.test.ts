import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PersistenceManager } from '../../PersistenceManager.ts';
import type { SaveState } from '../../constants.ts';
import { UPGRADES, MILESTONES, DEFAULT_UNLOCKED_AMBIENCE } from '../../constants.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildValidSaveState(overrides: Partial<SaveState['state']> = {}): SaveState {
  const upgrades: SaveState['state']['upgrades'] = {};
  for (const u of UPGRADES) {
    upgrades[u.id] = { owned: 0 };
  }

  const milestones: SaveState['state']['milestones'] = {};
  for (const m of MILESTONES) {
    milestones[m.id] = false;
  }

  const now = Date.now();

  return {
    version: 1,
    savedAt: now,
    state: {
      purrs: 0,
      currentPurrs: 0,
      clickValue: 1,
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
      ...overrides,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PersistenceManager', () => {
  let pm: PersistenceManager;

  beforeEach(() => {
    localStorage.clear();
    pm = new PersistenceManager();
  });

  afterEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  // ─── load() ─────────────────────────────────────────────────────────────────

  it('load() returns null when localStorage is empty', () => {
    expect(pm.load()).toBeNull();
  });

  it('load() returns null when JSON is corrupted (invalid JSON string)', () => {
    localStorage.setItem('cat-clicker-save', 'not-valid-json{{{');
    expect(pm.load()).toBeNull();
  });

  it('load() returns null when schema validation fails (missing required fields)', () => {
    // Missing the `state` object entirely
    const incomplete = JSON.stringify({ version: 1, savedAt: Date.now() });
    localStorage.setItem('cat-clicker-save', incomplete);
    expect(pm.load()).toBeNull();
  });

  it('load() returns null when numeric fields are not finite (NaN)', () => {
    const saveState = buildValidSaveState();
    // Manually inject NaN into a numeric field
    const raw = JSON.parse(JSON.stringify(saveState));
    raw.state.purrs = NaN;
    // JSON.stringify converts NaN to null, which is not finite
    localStorage.setItem('cat-clicker-save', JSON.stringify(raw));
    expect(pm.load()).toBeNull();
  });

  it('load() returns null when numeric fields are not finite (Infinity)', () => {
    const saveState = buildValidSaveState();
    const raw = JSON.parse(JSON.stringify(saveState));
    // Inject Infinity via a workaround (JSON.stringify converts Infinity to null)
    // We simulate by setting the field to null directly in the raw object
    raw.state.currentPurrs = null;
    localStorage.setItem('cat-clicker-save', JSON.stringify(raw));
    expect(pm.load()).toBeNull();
  });

  it('load() returns a valid SaveState when data is correct', () => {
    const saveState = buildValidSaveState({ purrs: 42, currentPurrs: 42 });
    localStorage.setItem('cat-clicker-save', JSON.stringify(saveState));

    const result = pm.load();
    expect(result).not.toBeNull();
    expect(result!.state.purrs).toBe(42);
    expect(result!.state.currentPurrs).toBe(42);
    expect(result!.version).toBe(1);
  });

  // ─── flush() ────────────────────────────────────────────────────────────────

  it('flush() writes to localStorage when storageAvailable is true', () => {
    const saveState = buildValidSaveState({ purrs: 100 });
    pm.setStateGetter(() => saveState);

    pm.flush();

    const stored = localStorage.getItem('cat-clicker-save');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.purrs).toBe(100);
  });

  it('flush() is a no-op when storageAvailable is false', () => {
    const saveState = buildValidSaveState({ purrs: 999 });
    pm.setStateGetter(() => saveState);

    // Force storageAvailable to false by making localStorage.setItem throw
    const originalSetItem = localStorage.setItem.bind(localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    // First flush triggers the error and sets storageAvailable = false
    pm.flush();

    // Restore setItem
    vi.restoreAllMocks();

    // Second flush should be a no-op (storageAvailable is false)
    pm.flush();

    // localStorage should not have the save key (first flush failed, second was no-op)
    expect(localStorage.getItem('cat-clicker-save')).toBeNull();
  });

  // ─── clear() ────────────────────────────────────────────────────────────────

  it('clear() removes the save key from localStorage', () => {
    const saveState = buildValidSaveState();
    localStorage.setItem('cat-clicker-save', JSON.stringify(saveState));

    pm.clear();

    expect(localStorage.getItem('cat-clicker-save')).toBeNull();
  });

  // ─── scheduleAutoSave() ─────────────────────────────────────────────────────

  it('scheduleAutoSave() calls flush at the given interval', () => {
    vi.useFakeTimers();

    const saveState = buildValidSaveState({ purrs: 77 });
    pm.setStateGetter(() => saveState);

    pm.scheduleAutoSave(5000);

    // No flush yet
    expect(localStorage.getItem('cat-clicker-save')).toBeNull();

    // Advance time by 5 seconds — one flush should have occurred
    vi.advanceTimersByTime(5000);
    expect(localStorage.getItem('cat-clicker-save')).not.toBeNull();

    // Advance by another 5 seconds — another flush
    const firstSave = localStorage.getItem('cat-clicker-save');
    vi.advanceTimersByTime(5000);
    const secondSave = localStorage.getItem('cat-clicker-save');
    expect(secondSave).not.toBeNull();
    // Both saves should contain the same data (state hasn't changed)
    expect(secondSave).toBe(firstSave);
  });

  it('scheduleAutoSave() caps interval at 30000ms', () => {
    vi.useFakeTimers();

    const saveState = buildValidSaveState({ purrs: 55 });
    pm.setStateGetter(() => saveState);

    // Request an interval larger than 30000ms
    pm.scheduleAutoSave(60000);

    // Should not fire at 30001ms (capped to 30000ms)
    vi.advanceTimersByTime(29999);
    expect(localStorage.getItem('cat-clicker-save')).toBeNull();

    // Should fire at exactly 30000ms
    vi.advanceTimersByTime(1);
    expect(localStorage.getItem('cat-clicker-save')).not.toBeNull();
  });

  // ─── beforeunload event ─────────────────────────────────────────────────────

  it('beforeunload event triggers flush', () => {
    const saveState = buildValidSaveState({ purrs: 123 });
    pm.setStateGetter(() => saveState);

    // Simulate the beforeunload event
    window.dispatchEvent(new Event('beforeunload'));

    const stored = localStorage.getItem('cat-clicker-save');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.purrs).toBe(123);
  });
});
