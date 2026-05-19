import * as fc from 'fast-check';
import type { SaveState, GameState } from '../constants.ts';
import { MILESTONES, UPGRADES, DEFAULT_UNLOCKED_AMBIENCE } from '../constants.ts';

// ─── Primitive Arbitraries ────────────────────────────────────────────────────

/** Any valid click value (≥ 1) */
export const arbClickValue = fc.integer({ min: 1, max: 1_000_000 });

/** Any valid currentPurrs starting value */
export const arbPurrs = fc.nat({ max: 10_000_000 });

/** Any valid elapsed time in seconds (1 minute to 24 hours) */
export const arbElapsed = fc.integer({ min: 60, max: 86400 });

// ─── SaveState Arbitrary ──────────────────────────────────────────────────────

/** Builds a full SaveState arbitrary matching the actual SaveState interface */
export const arbSaveState: fc.Arbitrary<SaveState> = fc
  .record({
    purrs: fc.nat({ max: 100_000_000 }),
    currentPurrs: fc.nat({ max: 100_000_000 }),
    clickValue: arbClickValue,
    purrsPerSecond: fc.float({ min: 0, max: 1000, noNaN: true }),
    unlockedAmbience: fc.constant([...DEFAULT_UNLOCKED_AMBIENCE]),
    unlockedSkins: fc.constant([]),
    activeSkin: fc.constant('default'),
    lastSaveTime: fc.integer({ min: 0, max: Date.now() }),
    lastActiveTime: fc.integer({ min: 0, max: Date.now() }),
    activeAmbienceTrack: fc.option(fc.constant('track_rainy_window'), { nil: null }),
    ambienceVolume: fc.float({ min: 0, max: 1, noNaN: true }),
    notifications: fc.constant([]),
    settings: fc.record({
      reducedMotion: fc.boolean(),
      soundEnabled: fc.boolean(),
    }),
  })
  .map((partial) => {
    // Build upgrades record
    const upgrades: GameState['upgrades'] = {};
    for (const upgrade of UPGRADES) {
      upgrades[upgrade.id] = { owned: 0 };
    }

    // Build milestones record
    const milestones: GameState['milestones'] = {};
    for (const milestone of MILESTONES) {
      milestones[milestone.id] = false;
    }

    const state: GameState = {
      ...partial,
      upgrades,
      milestones,
    };

    return {
      version: 1,
      savedAt: partial.lastSaveTime,
      state,
    } satisfies SaveState;
  });
