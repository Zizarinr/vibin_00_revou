import {
  type GameState,
  type SaveState,
  type Milestone,
  MILESTONES,
  UPGRADES,
  DEFAULT_UNLOCKED_AMBIENCE,
} from './constants.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PurchaseResult =
  | { success: true }
  | { success: false; reason: 'insufficient_purrs' };

type StateChangeHandler = (state: Readonly<GameState>) => void;

// ─── GameEngine ───────────────────────────────────────────────────────────────

export class GameEngine {
  private state: GameState;
  private listeners: Set<StateChangeHandler> = new Set();

  constructor(saveState: SaveState | null = null) {
    if (saveState !== null) {
      this.state = saveState.state;
    } else {
      this.state = this.initState();
    }
  }

  // ─── State Initialization ──────────────────────────────────────────────────

  private initState(): GameState {
    // Build upgrades record from UPGRADES constants
    const upgrades: GameState['upgrades'] = {};
    for (const upgrade of UPGRADES) {
      upgrades[upgrade.id] = { owned: 0 };
    }

    // Build milestones record — all set to false initially
    const milestones: GameState['milestones'] = {};
    for (const milestone of MILESTONES) {
      milestones[milestone.id] = false;
    }

    const now = Date.now();

    return {
      purrs: 0,
      currentPurrs: 0,
      clickValue: 1,
      purrsPerSecond: 0,
      upgrades,
      unlockedAmbience: [...DEFAULT_UNLOCKED_AMBIENCE],
      milestones,
      unlockedSkins: [],
      activeSkin: 'default',
      lastSaveTime: now,
      lastActiveTime: now,
      activeAmbienceTrack: null,
      ambienceVolume: 0.7,
      notifications: [],
      settings: {
        reducedMotion: false,
        soundEnabled: true,
      },
    };
  }

  // ─── Event Subscription ────────────────────────────────────────────────────

  on(event: 'stateChange', handler: StateChangeHandler): void {
    if (event === 'stateChange') {
      this.listeners.add(handler);
    }
  }

  off(event: 'stateChange', handler: Function): void {
    if (event === 'stateChange') {
      this.listeners.delete(handler as StateChangeHandler);
    }
  }

  private emit(): void {
    const snapshot = Object.freeze({ ...this.state }) as Readonly<GameState>;
    for (const handler of this.listeners) {
      handler(snapshot);
    }
  }

  // ─── Getters ───────────────────────────────────────────────────────────────

  getClickValue(): number {
    return this.state.clickValue;
  }

  /** Stub — will be implemented in task 2.3 */
  getPurrsPerSecond(): number {
    return this.state.purrsPerSecond;
  }

  /** Stub — will be implemented in task 2.3 */
  getNextUpgradeCost(_upgradeId: string): number {
    return 0;
  }

  /** Stub — will be implemented in task 2.7 */
  getNextMilestone(): Milestone | null {
    return null;
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  /** Increment purrs and currentPurrs by clickValue, then emit stateChange */
  click(): void {
    this.state.currentPurrs += this.state.clickValue;
    this.state.purrs += this.state.clickValue;
    this.emit();
  }

  /** Stub — will be implemented in task 2.3 */
  purchaseUpgrade(_upgradeId: string): PurchaseResult {
    return { success: false, reason: 'insufficient_purrs' };
  }

  /** Stub — will be implemented in task 2.7 */
  selectAmbience(_trackId: string): void {
    // no-op placeholder
  }

  /** Stub — will be implemented in task 2.7 */
  setVolume(_level: number): void {
    // no-op placeholder
  }

  /** Stub — will be implemented in task 2.7 */
  dismissNotification(_id: string): void {
    // no-op placeholder
  }

  /** Stub — will be implemented in task 2.7 */
  resetProgress(): void {
    // no-op placeholder
  }

  /** Stub — will be implemented in task 2.5 */
  applyOfflinePurrs(): void {
    // no-op placeholder
  }

  // ─── State Access (for PersistenceManager) ────────────────────────────────

  getState(): Readonly<GameState> {
    return Object.freeze({ ...this.state });
  }
}
