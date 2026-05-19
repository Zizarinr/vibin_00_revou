// Feature: cat-clicker-boredom-cure, Property 17: Save/load round-trip preserves all game state fields

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { GameEngine } from '../../GameEngine.ts';
import { arbSaveState } from '../arbitraries.ts';

/**
 * Property 17: Save/load round-trip preserves all game state fields
 * Validates: Requirements 7.3, 7.7
 *
 * For any valid SaveState object, serializing it to JSON and deserializing it back
 * shall produce a SaveState where:
 *   - all numeric fields are strictly equal
 *   - all boolean fields are strictly equal
 *   - all array fields contain the same elements in the same order
 *
 * Furthermore, loading the deserialized SaveState into GameEngine shall produce a
 * GameState where purrs, currentPurrs, upgrades, unlockedAmbience, milestones, and
 * unlockedSkins all match the original saved values.
 */
describe('SaveState — property tests', () => {
  it('Property 17: JSON round-trip preserves all SaveState fields and GameEngine loads them correctly', () => {
    fc.assert(
      fc.property(arbSaveState, (saveState) => {
        // Step 1: Serialize to JSON
        const serialized = JSON.stringify(saveState);

        // Step 2: Deserialize
        const deserialized = JSON.parse(serialized) as typeof saveState;

        // Step 3: Verify top-level numeric fields
        if (deserialized.version !== saveState.version) return false;
        if (deserialized.savedAt !== saveState.savedAt) return false;

        const orig = saveState.state;
        const deser = deserialized.state;

        // Step 4: Verify all numeric fields in state are strictly equal
        const numericFields = [
          'purrs',
          'currentPurrs',
          'clickValue',
          'purrsPerSecond',
          'ambienceVolume',
          'lastSaveTime',
          'lastActiveTime',
        ] as const;

        for (const field of numericFields) {
          if (deser[field] !== orig[field]) return false;
        }

        // Step 5: Verify all boolean fields in state are strictly equal
        if (deser.settings.reducedMotion !== orig.settings.reducedMotion) return false;
        if (deser.settings.soundEnabled !== orig.settings.soundEnabled) return false;

        // Step 6: Verify all array fields have same elements in same order
        const arrayFields = ['unlockedAmbience', 'unlockedSkins', 'notifications'] as const;

        for (const field of arrayFields) {
          const origArr = orig[field] as unknown[];
          const deserArr = deser[field] as unknown[];
          if (origArr.length !== deserArr.length) return false;
          for (let i = 0; i < origArr.length; i++) {
            if (JSON.stringify(origArr[i]) !== JSON.stringify(deserArr[i])) return false;
          }
        }

        // Verify upgrades object keys and values
        for (const upgradeId of Object.keys(orig.upgrades)) {
          if (deser.upgrades[upgradeId]?.owned !== orig.upgrades[upgradeId].owned) return false;
        }

        // Verify milestones object keys and values
        for (const milestoneId of Object.keys(orig.milestones)) {
          if (deser.milestones[milestoneId] !== orig.milestones[milestoneId]) return false;
        }

        // Step 7: Load deserialized SaveState into GameEngine and verify state matches
        const engine = new GameEngine(deserialized);
        const engineState = engine.getState();

        if (engineState.purrs !== orig.purrs) return false;
        if (engineState.currentPurrs !== orig.currentPurrs) return false;

        // Verify upgrades match
        for (const upgradeId of Object.keys(orig.upgrades)) {
          if (engineState.upgrades[upgradeId]?.owned !== orig.upgrades[upgradeId].owned) return false;
        }

        // Verify unlockedAmbience matches
        if (engineState.unlockedAmbience.length !== orig.unlockedAmbience.length) return false;
        for (let i = 0; i < orig.unlockedAmbience.length; i++) {
          if (engineState.unlockedAmbience[i] !== orig.unlockedAmbience[i]) return false;
        }

        // Verify milestones match
        for (const milestoneId of Object.keys(orig.milestones)) {
          if (engineState.milestones[milestoneId] !== orig.milestones[milestoneId]) return false;
        }

        // Verify unlockedSkins matches
        if (engineState.unlockedSkins.length !== orig.unlockedSkins.length) return false;
        for (let i = 0; i < orig.unlockedSkins.length; i++) {
          if (engineState.unlockedSkins[i] !== orig.unlockedSkins[i]) return false;
        }

        return true;
      }),
      { numRuns: 200 },
    );
  });
});
