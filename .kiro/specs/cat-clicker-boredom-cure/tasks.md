# Implementation Plan: Cat Clicker Boredom Cure

## Overview

Implement a single-page cat clicker browser game using vanilla HTML, CSS, and TypeScript bundled with Vite. The implementation follows the modular architecture defined in the design: a central `GameEngine` coordinating five widgets (`ClickerWidget`, `ShopWidget`, `AmbientPlayerWidget`, `MilestoneWidget`, `VisualWidget`), a `PersistenceManager` for localStorage, and an `AudioManager` for Web Audio API. Property-based tests use fast-check + Vitest.

## Tasks

- [x] 1. Project scaffolding and static constants
  - [x] 1.1 Initialize Vite project with TypeScript and configure Vitest
    - Run `npm create vite@latest` with vanilla-ts template
    - Install dev dependencies: `vitest`, `@vitest/coverage-v8`, `jsdom`, `fast-check`
    - Configure `vitest.config.ts` with `globals: true` and `environment: 'jsdom'`
    - Create `src/` directory structure: `widgets/`, `__tests__/unit/widgets/`, `__tests__/property/`, `__tests__/integration/`
    - _Requirements: 8.1, 8.6_

  - [x] 1.2 Define static constants in `src/constants.ts`
    - Define `MILESTONES` array with thresholds 100, 500, 1000, 10000, 100000, 1000000 and associated `skinId` and `soundId` per entry
    - Define `UPGRADES` array with at least: click multipliers, passive generators ("Sleeping Cat", "Yarn Ball", "Cat Café"), and ambience unlocks
    - Define `AMBIENCE_TRACKS` array with at least 3 default tracks ("Rainy Window", "Sunny Nap", "Cozy Fireplace") and locked tracks
    - Export all TypeScript interfaces: `GameState`, `SaveState`, `UpgradeDefinition`, `UpgradeEffect`, `Milestone`, `Notification`, `UserSettings`, `UpgradeState`
    - _Requirements: 3.7, 4.2, 6.1_

- [ ] 2. GameEngine — core state and actions
  - [x] 2.1 Implement `GameEngine` class with `GameState` initialization and `click()` action
    - Create `src/GameEngine.ts` with `GameState` as private field
    - Implement `initState()` returning default `GameState` (purrs: 0, currentPurrs: 0, clickValue: 1, etc.)
    - Implement `click()`: increment `currentPurrs` and `purrs` by `clickValue`, emit `stateChange`
    - Implement `on()` / `off()` event subscription for `stateChange`
    - Implement `getClickValue()` computed getter
    - _Requirements: 1.2, 1.5_

  - [x] 2.2 Write property test for `click()` — Property 1
    - **Property 1: Click increments Purrs by exactly the click value**
    - **Validates: Requirements 1.2**
    - File: `src/__tests__/property/GameEngine.property.test.ts`
    - Use `arbClickValue` and `arbPurrs` arbitraries from design

  - [x] 2.3 Implement `purchaseUpgrade()`, `getNextUpgradeCost()`, and `getPurrsPerSecond()`
    - Implement `purchaseUpgrade(upgradeId)`: re-validate affordability, deduct cost, increment `owned`, apply effect, emit `stateChange`; return `{ success: false, reason: 'insufficient_purrs' }` on failure
    - Implement `getNextUpgradeCost(upgradeId)`: `Math.floor(baseCost * Math.pow(1.15, owned))`
    - Implement `getPurrsPerSecond()`: sum of `purrsPerSecond × owned` for all passive generator upgrades
    - Recalculate and cache `clickValue` and `purrsPerSecond` on each purchase
    - _Requirements: 3.3, 3.4, 3.8, 2.1_

  - [-] 2.4 Write property tests for purchase and cost formula — Properties 8, 9, 11
    - **Property 8: Successful purchase deducts exact cost and increments owned count**
    - **Property 9: Upgrade cost formula is always floor(baseCost × 1.15^owned)**
    - **Property 11: Purchase is rejected when Purrs are insufficient at click time**
    - **Validates: Requirements 3.3, 3.4, 3.8**
    - File: `src/__tests__/property/GameEngine.property.test.ts`

  - [-] 2.5 Implement passive generation tick, `applyOfflinePurrs()`, and milestone guard
    - Implement `startPassiveTick()`: `setInterval` at 1000ms, add `purrsPerSecond` to `currentPurrs` and `purrs`, emit `stateChange`
    - Implement `applyOfflinePurrs()`: compute `elapsed = now - lastActiveTime`, cap at 28800s, award `purrsPerSecond × elapsed`, add `offline_purrs` notification
    - Implement milestone check inside `click()` and `applyOfflinePurrs()`: guard with `milestones[id] === false` before triggering
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 6.2, 6.6_

  - [~] 2.6 Write property tests for offline Purrs and milestone idempotency — Properties 5, 6, 16
    - **Property 5: Offline Purrs calculation is correctly bounded**
    - **Property 6: Offline notification contains exact earned amount and duration**
    - **Property 16: Already-reached milestones are idempotent on load**
    - **Validates: Requirements 2.4, 2.5, 6.6**
    - File: `src/__tests__/property/GameEngine.property.test.ts`

  - [~] 2.7 Implement `selectAmbience()`, `setVolume()`, `dismissNotification()`, `resetProgress()`, and remaining getters
    - Implement `selectAmbience(trackId)`: update `activeAmbienceTrack` in state, emit `stateChange`
    - Implement `setVolume(level)`: clamp to [0, 1], update `ambienceVolume`, call `AudioManager.setAmbienceVolume(level)`, emit `stateChange`
    - Implement `dismissNotification(id)`: remove notification from array, emit `stateChange`
    - Implement `resetProgress()`: call `PersistenceManager.clear()`, reinitialize state to defaults, emit `stateChange`
    - Implement `getNextMilestone()`: return lowest milestone not yet reached, or `null`
    - _Requirements: 4.3, 4.5, 4.6, 2.5, 7.4, 6.4_

  - [~] 2.8 Write property tests for passive rate, milestone progress, and volume — Properties 4, 12, 15
    - **Property 4: Passive generation rate equals sum of all owned generator rates**
    - **Property 12: Volume changes are applied to AudioManager immediately**
    - **Property 15: Milestone progress indicator reflects correct next threshold**
    - **Validates: Requirements 2.1, 2.3, 4.6, 6.4**
    - File: `src/__tests__/property/GameEngine.property.test.ts`

- [~] 3. Checkpoint — GameEngine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. PersistenceManager
  - [~] 4.1 Implement `PersistenceManager` with load, flush, auto-save, and clear
    - Create `src/PersistenceManager.ts`
    - Implement `load()`: `JSON.parse` in try/catch, run schema validator (all required keys present, all numeric fields are finite), return `null` on any failure and add `corrupt_save` notification
    - Implement `flush()`: synchronous `localStorage.setItem`; on write failure set `storageAvailable = false` and stop auto-saves
    - Implement `scheduleAutoSave(intervalMs)`: `setInterval` calling `flush()` every `intervalMs` (≤ 30000ms)
    - Implement `clear()`: `localStorage.removeItem` for the save key
    - Register `beforeunload` listener calling `flush()` synchronously
    - Wrap all `localStorage` calls in try/catch; on unavailability add persistent `save_error` notification
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [~] 4.2 Write property test for save/load round-trip — Property 17
    - **Property 17: Save/load round-trip preserves all game state fields**
    - **Validates: Requirements 7.3, 7.7**
    - File: `src/__tests__/property/SaveState.property.test.ts`
    - Use `arbSaveState` arbitrary from design

  - [~] 4.3 Write unit tests for PersistenceManager
    - Test auto-save interval fires within 30s
    - Test `beforeunload` triggers `flush()`
    - Test corrupted JSON returns `null` and does not throw
    - Test `localStorage` unavailable sets `storageAvailable = false`
    - File: `src/__tests__/unit/PersistenceManager.test.ts`
    - _Requirements: 7.1, 7.2, 7.5, 7.6_

  - [~] 4.4 Write integration test for PersistenceManager round-trip
    - Mock `localStorage` with an in-memory store
    - Verify `flush()` then `load()` returns identical `SaveState`
    - File: `src/__tests__/integration/PersistenceManager.integration.test.ts`
    - _Requirements: 7.3, 7.7_

- [ ] 5. AudioManager
  - [~] 5.1 Implement `AudioManager` with SFX, ambient playback, crossfade, and volume
    - Create `src/AudioManager.ts`
    - Implement `isSupported()`: check `window.AudioContext || window.webkitAudioContext`
    - Implement `playSfx(name)`: decode and play a short buffer (≤ 500ms); no-op if unsupported
    - Implement `playAmbience(trackId)`: if another track is playing, crossfade using two `GainNode`s with `linearRampToValueAtTime` over 1s; wrap `AudioContext.resume()` in try/catch for autoplay block
    - Implement `stopAmbience()`: ramp gain to 0 over 200ms then disconnect
    - Implement `setAmbienceVolume(level)`: apply immediately (≤ 100ms) to active gain node
    - _Requirements: 1.6, 1.7, 4.3, 4.4, 4.5, 4.6, 4.9_

  - [~] 5.2 Write unit tests for AudioManager
    - Mock `AudioContext` with jest-compatible stubs
    - Test `isSupported()` returns false when `AudioContext` is absent
    - Test `playSfx` is a no-op when unsupported
    - Test autoplay block triggers the retry banner flag
    - File: `src/__tests__/unit/AudioManager.test.ts`
    - _Requirements: 1.7, 4.9_

  - [~] 5.3 Write integration test for AudioManager crossfade
    - Verify `GainNode.linearRampToValueAtTime` is called with correct values during crossfade
    - File: `src/__tests__/integration/AudioManager.integration.test.ts`
    - _Requirements: 4.4_

- [ ] 6. ClickerWidget
  - [~] 6.1 Implement `ClickerWidget` — Cat_Sprite, counter, bounce animation, floating text
    - Create `src/widgets/ClickerWidget.ts`
    - Render Cat_Sprite `<button>` with minimum 100×100px clickable area, `aria-label`, `role="button"`, `aria-pressed`
    - On click: call `GameEngine.click()`, add CSS class `cat--bounce`, remove on `animationend`; if mid-animation, remove and re-add on next frame
    - On click: inject absolutely-positioned `<span>` at click coordinates (within 50px), content "+N Purrs", remove after 800ms via `setTimeout`
    - Subscribe to `stateChange`: update Purr counter text within 100ms (debounced)
    - Render persistent muted icon `🔇` with `aria-label="Sound unavailable"` when `settings.soundEnabled === false`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

  - [~] 6.2 Write property tests for ClickerWidget — Properties 2, 3
    - **Property 2: Floating text appears near the click position**
    - **Property 3: Purr counter always reflects current state**
    - **Validates: Requirements 1.4, 1.5**
    - File: `src/__tests__/property/ClickerWidget.property.test.ts`

  - [~] 6.3 Write unit tests for ClickerWidget
    - Test bounce class is added on click and removed on `animationend`
    - Test bounce class resets if click arrives mid-animation
    - Test floating text is removed after 800ms
    - File: `src/__tests__/unit/widgets/ClickerWidget.test.ts`
    - _Requirements: 1.3, 1.4_

- [ ] 7. ShopWidget
  - [~] 7.1 Implement `ShopWidget` — upgrade list, affordability, purchase flow
    - Create `src/widgets/ShopWidget.ts`
    - Render scrollable list of all upgrades; each row shows name, description, current cost, owned count
    - Subscribe to `stateChange`: re-render affordability state; apply disabled CSS class and `aria-disabled="true"` when `currentPurrs < cost`
    - On upgrade click: re-validate affordability, call `GameEngine.purchaseUpgrade(id)`; on `{ success: false }` display insufficient-Purrs message
    - Display updated Purrs/sec label within 1s of passive generator purchase
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 3.8_

  - [~] 7.2 Write property tests for ShopWidget — Properties 7, 10
    - **Property 7: Unaffordable upgrades are always rendered disabled**
    - **Property 10: Shop rows contain all required display fields**
    - **Validates: Requirements 3.2, 3.5**
    - File: `src/__tests__/property/ShopWidget.property.test.ts`

  - [~] 7.3 Write unit tests for ShopWidget
    - Test disabled state rendering when `currentPurrs < cost`
    - Test purchase flow UI feedback on success and failure
    - File: `src/__tests__/unit/widgets/ShopWidget.test.ts`
    - _Requirements: 3.2, 3.8_

- [ ] 8. AmbientPlayerWidget
  - [~] 8.1 Implement `AmbientPlayerWidget` — track list, play/stop, volume, locked tracks
    - Create `src/widgets/AmbientPlayerWidget.ts`
    - Render available tracks and locked tracks; locked tracks show name and exact Purr unlock cost
    - Render Play/Stop button, volume slider (0–100%), animated waveform indicator (visible only when playing)
    - On track select + Play: call `GameEngine.selectAmbience(trackId)`, then `AudioManager.playAmbience(trackId)`
    - On volume change: call `GameEngine.setVolume(level)` within 100ms
    - Display autoplay-blocked banner when `AudioManager` signals blocked; retry on next user interaction
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [~] 8.2 Write property tests for AmbientPlayerWidget — Properties 12, 13
    - **Property 12: Volume changes are applied to AudioManager immediately**
    - **Property 13: Locked ambience tracks display name and unlock cost**
    - **Validates: Requirements 4.6, 4.8**
    - File: `src/__tests__/property/AmbientPlayer.property.test.ts`

  - [~] 8.3 Write unit tests for AmbientPlayerWidget
    - Test waveform indicator is visible when playing and hidden when stopped
    - Test locked track rows display name and cost
    - Test autoplay banner appears and disappears correctly
    - File: `src/__tests__/unit/widgets/AmbientPlayerWidget.test.ts`
    - _Requirements: 4.7, 4.8, 4.9_

- [ ] 9. MilestoneWidget
  - [~] 9.1 Implement `MilestoneWidget` — progress bar, celebration overlay, skin unlocks
    - Create `src/widgets/MilestoneWidget.ts`
    - Subscribe to `stateChange`: render progress bar toward next milestone threshold; display "Max Milestone Reached" when all milestones are reached
    - On milestone trigger (emitted by `GameEngine`): inject full-screen overlay `<div>` with `aria-live="assertive"`, disable pointer events on Cat_Sprite, remove overlay after 1–3s
    - Call `AudioManager.playSfx('milestone')` on milestone trigger
    - Persist unlocked skin to `GameState` (handled by `GameEngine`); do not re-trigger if already reached
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [~] 9.2 Write unit tests for MilestoneWidget
    - Test overlay is injected and removed after duration
    - Test Cat_Sprite pointer events are disabled during overlay
    - Test progress bar shows correct next threshold
    - File: `src/__tests__/unit/widgets/MilestoneWidget.test.ts`
    - _Requirements: 5.6, 6.2, 6.4_

- [ ] 10. VisualWidget
  - [~] 10.1 Implement `VisualWidget` — Mood_Meter, idle animations, decorative cat walk
    - Create `src/widgets/VisualWidget.ts`
    - Implement Mood_Meter: maintain rolling 60s click timestamp array; if count ≥ 50 apply `body.mood--happy` CSS class (warm background transition over 500ms); remove class when count drops below 50
    - Implement idle animation: `setInterval` at 3s checks last-click time; if > 3s, cycle at least 2 idle CSS classes on Cat_Sprite (e.g., `cat--blink`, `cat--tail-sway`)
    - Implement decorative cat walk: `setTimeout` chain fires at random interval 30–120s, inject walking cat `<div>`, remove after 5s
    - Subscribe to `stateChange` for click timestamps
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

  - [~] 10.2 Write unit tests for VisualWidget
    - Test `mood--happy` class is applied when click count ≥ 50 in 60s window
    - Test `mood--happy` class is removed when count drops below threshold
    - Test idle animation cycles after 3s of inactivity
    - Test decorative cat walk `<div>` is removed after 5s
    - File: `src/__tests__/unit/widgets/VisualWidget.test.ts`
    - _Requirements: 5.2, 5.3, 5.4, 5.5_

- [~] 11. Checkpoint — Widget tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. HTML, CSS, and accessibility
  - [~] 12.1 Create `index.html` and `src/styles.css` with cat-themed design and responsive layout
    - Create `index.html` with semantic structure: mount points for all five widgets
    - Apply cat-themed design using pastel/warm-neutral CSS custom properties; include paw-print or yarn motif in at least 3 UI sections
    - Define CSS animations: `cat--bounce` (100–300ms), `cat--blink`, `cat--tail-sway`, mood background transition (500ms), milestone overlay, floating text fade (800ms)
    - Add `@media (prefers-reduced-motion: reduce)` block: replace all decorative/transitional animations with instant state changes (≤ 16ms); preserve functional behavior
    - Ensure responsive layout from 320px to 2560px with no horizontal scrolling
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7, 8.4, 8.5_

  - [~] 12.2 Add ARIA attributes and keyboard navigation to all interactive elements
    - Ensure all buttons, sliders, and the Cat_Sprite have `aria-label`, explicit `role` (if non-semantic), `aria-disabled`, `aria-pressed` as appropriate
    - Ensure all interactive elements are natively focusable or have non-negative `tabIndex`
    - Ensure `Enter` and `Space` key events trigger the same action as click on all interactive elements
    - _Requirements: 8.2, 8.3_

  - [~] 12.3 Write property test for accessibility — Property 18
    - **Property 18: All interactive elements are keyboard-accessible and have ARIA attributes**
    - **Validates: Requirements 8.2, 8.3**
    - File: `src/__tests__/property/Accessibility.property.test.ts`

- [ ] 13. `main.ts` — wiring all modules together
  - [~] 13.1 Implement `src/main.ts` to initialize and connect all modules
    - Instantiate `PersistenceManager`, call `load()`, pass `SaveState` (or `null`) to `GameEngine` constructor
    - Instantiate `AudioManager`; if `!isSupported()` set `settings.soundEnabled = false`
    - Instantiate all five widgets, passing `GameEngine` and `AudioManager` references
    - Call `GameEngine.applyOfflinePurrs()` after state is restored
    - Call `PersistenceManager.scheduleAutoSave(30000)`
    - Subscribe `PersistenceManager.flush` to `stateChange` (dirty-flag pattern)
    - Register `beforeunload` → `PersistenceManager.flush()`
    - Start passive tick via `GameEngine.startPassiveTick()`
    - _Requirements: 2.1, 2.4, 7.1, 7.2, 7.3_

- [~] 14. Final checkpoint — all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (18 properties from design)
- Unit tests validate specific examples and edge cases
- The design uses TypeScript (ES2022 modules) — all implementation files should be `.ts`
- fast-check arbitraries defined in the design (`arbSaveState`, `arbClickValue`, `arbPurrs`, `arbElapsed`) should be shared via a `src/__tests__/arbitraries.ts` helper file

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["2.4", "2.5"] },
    { "id": 4, "tasks": ["2.6", "2.7"] },
    { "id": 5, "tasks": ["2.8", "4.1", "5.1"] },
    { "id": 6, "tasks": ["4.2", "4.3", "5.2", "6.1"] },
    { "id": 7, "tasks": ["4.4", "5.3", "6.2", "6.3", "7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "9.1"] },
    { "id": 10, "tasks": ["9.2", "10.1"] },
    { "id": 11, "tasks": ["10.2", "12.1"] },
    { "id": 12, "tasks": ["12.2"] },
    { "id": 13, "tasks": ["12.3", "13.1"] }
  ]
}
```
