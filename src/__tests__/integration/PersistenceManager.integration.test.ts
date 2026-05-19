import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PersistenceManager } from '../../PersistenceManager.ts';
import type { SaveState } from '../../constants.ts';
import { UPGRADES, MILESTONES, DEFAULT_UNLOCKED_AMBIENCE } from '../../constants.ts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildKnownSaveState(): SaveState {
  const upgrades: SaveState['state']['upgrades'] = {};
  for (const u of UPGRADES) {
    upgrades[u.id] = { owned: 0 };
  }

  const milestones: SaveState['state']['milestones'] = {};
  for (const m of MILESTONES) {
    milestones[m.id] = false;
  }

  const now = 1700000000000; // fixed timestamp for determinism

  return {
    version: 1,
    savedAt: now,
    state: {
      purrs: 500,
      currentPurrs: 250,
      clickValue: 3,
      purrsPerSecond: 1.5,
      upgrades,
      milestones,
      unlockedAmbience: [...DEFAULT_UNLOCKED_AMBIENCE],
      unlockedSkins: [],
      activeSkin: 'default',
      lastSaveTime: now,
      lastActiveTime: now,
      activeAmbienceTrack: 'track_rainy_window',
      ambienceVolume: 0.6,
      notifications: [],
      settings: { reducedMotion: false, soundEnabled: true },
    },
  };
}

// ─── Integration Tests ────────────────────────────────────────────────────────

describe('PersistenceManager — integration', () => {
  let pm: PersistenceManager;

  beforeEach(() => {
    localStorage.clear();
    pm = new PersistenceManager();
  });

  afterEach(() => {
    localStorage.clear();
  });

  /**
   * flush() then load() returns identical SaveState
   * Validates: Requirements 7.3, 7.7
   */
  it('flush() then load() returns a SaveState deeply equal to the original', () => {
    const original = buildKnownSaveState();

    // Set the state getter so flush() knows what to save
    pm.setStateGetter(() => original);

    // Flush to localStorage
    pm.flush();

    // Load back from localStorage
    const loaded = pm.load();

    expect(loaded).not.toBeNull();

    // Top-level fields
    expect(loaded!.version).toBe(original.version);
    expect(loaded!.savedAt).toBe(original.savedAt);

    // Numeric state fields
    expect(loaded!.state.purrs).toBe(original.state.purrs);
    expect(loaded!.state.currentPurrs).toBe(original.state.currentPurrs);
    expect(loaded!.state.clickValue).toBe(original.state.clickValue);
    expect(loaded!.state.purrsPerSecond).toBe(original.state.purrsPerSecond);
    expect(loaded!.state.ambienceVolume).toBe(original.state.ambienceVolume);
    expect(loaded!.state.lastSaveTime).toBe(original.state.lastSaveTime);
    expect(loaded!.state.lastActiveTime).toBe(original.state.lastActiveTime);

    // String fields
    expect(loaded!.state.activeSkin).toBe(original.state.activeSkin);
    expect(loaded!.state.activeAmbienceTrack).toBe(original.state.activeAmbienceTrack);

    // Boolean settings
    expect(loaded!.state.settings.reducedMotion).toBe(original.state.settings.reducedMotion);
    expect(loaded!.state.settings.soundEnabled).toBe(original.state.settings.soundEnabled);

    // Array fields
    expect(loaded!.state.unlockedAmbience).toEqual(original.state.unlockedAmbience);
    expect(loaded!.state.unlockedSkins).toEqual(original.state.unlockedSkins);
    expect(loaded!.state.notifications).toEqual(original.state.notifications);

    // Upgrades record
    for (const upgradeId of Object.keys(original.state.upgrades)) {
      expect(loaded!.state.upgrades[upgradeId]?.owned).toBe(
        original.state.upgrades[upgradeId].owned,
      );
    }

    // Milestones record
    for (const milestoneId of Object.keys(original.state.milestones)) {
      expect(loaded!.state.milestones[milestoneId]).toBe(
        original.state.milestones[milestoneId],
      );
    }
  });

  it('load() returns null after clear() removes the save', () => {
    const original = buildKnownSaveState();
    pm.setStateGetter(() => original);

    pm.flush();
    expect(pm.load()).not.toBeNull();

    pm.clear();
    expect(pm.load()).toBeNull();
  });

  it('second flush() overwrites the first with updated state', () => {
    const first = buildKnownSaveState();
    pm.setStateGetter(() => first);
    pm.flush();

    // Update the state getter to return a different state
    const second: SaveState = {
      ...first,
      state: { ...first.state, purrs: 9999, currentPurrs: 9999 },
    };
    pm.setStateGetter(() => second);
    pm.flush();

    const loaded = pm.load();
    expect(loaded).not.toBeNull();
    expect(loaded!.state.purrs).toBe(9999);
    expect(loaded!.state.currentPurrs).toBe(9999);
  });
});
