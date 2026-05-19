import {
  type GameState,
  type SaveState,
  type Milestone,
  type Notification,
  MILESTONES,
  UPGRADES,
  DEFAULT_UNLOCKED_AMBIENCE,
} from './constants.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PurchaseResult =
  | { success: true }
  | { success: false; reason: 'insufficient_purrs' };

type StateChangeHandler = (state: Readonly<GameState>) => void;
type MilestoneHandler = (milestone: Milestone) => void;

// ─── GameEngine ───────────────────────────────────────────────────────────────

export class GameEngine {
  private state: GameState;
  private listeners: Set<StateChangeHandler> = new Set();
  private milestoneListeners: Set<MilestoneHandler> = new Set();
  private passiveTickInterval: ReturnType<typeof setInterval> | null = null;
  private audioManager: { setAmbienceVolume(level: number): void } | null = null;
  private persistenceManager: { clear(): void } | null = null;

  constructor(saveState: SaveState | null = null) {
    if (saveState !== null) {
      this.state = saveState.state;
    } else {
      this.state = this.initState();
    }
  }

  setAudioManager(audioManager: { setAmbienceVolume(level: number): void }): void {
    this.audioManager = audioManager;
  }

  setPersistenceManager(pm: { clear(): void }): void {
    this.persistenceManager = pm;
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

  on(event: 'stateChange', handler: StateChangeHandler): void;
  on(event: 'milestone', handler: MilestoneHandler): void;
  on(event: 'stateChange' | 'milestone', handler: StateChangeHandler | MilestoneHandler): void {
    if (event === 'stateChange') {
      this.listeners.add(handler as StateChangeHandler);
    } else if (event === 'milestone') {
      this.milestoneListeners.add(handler as MilestoneHandler);
    }
  }

  off(event: 'stateChange', handler: StateChangeHandler): void;
  off(event: 'milestone', handler: MilestoneHandler): void;
  off(event: 'stateChange' | 'milestone', handler: StateChangeHandler | MilestoneHandler): void {
    if (event === 'stateChange') {
      this.listeners.delete(handler as StateChangeHandler);
    } else if (event === 'milestone') {
      this.milestoneListeners.delete(handler as MilestoneHandler);
    }
  }

  private emit(): void {
    const snapshot = Object.freeze({ ...this.state }) as Readonly<GameState>;
    for (const handler of this.listeners) {
      handler(snapshot);
    }
  }

  private emitMilestone(milestone: Milestone): void {
    for (const handler of this.milestoneListeners) {
      handler(milestone);
    }
  }

  // ─── Getters ───────────────────────────────────────────────────────────────

  getClickValue(): number {
    return this.state.clickValue;
  }

  getPurrsPerSecond(): number {
    return this.state.purrsPerSecond;
  }

  getNextUpgradeCost(upgradeId: string): number {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return 0;
    const owned = this.state.upgrades[upgradeId]?.owned ?? 0;
    return Math.floor(def.baseCost * Math.pow(1.15, owned));
  }

  /** Return the lowest milestone not yet reached, or null if all are reached */
  getNextMilestone(): Milestone | null {
    for (const milestone of MILESTONES) {
      if (this.state.milestones[milestone.id] === false) {
        return milestone;
      }
    }
    return null;
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  /** Increment purrs and currentPurrs by clickValue, then emit stateChange */
  click(): void {
    this.state.currentPurrs += this.state.clickValue;
    this.state.purrs += this.state.clickValue;
    this.checkMilestones();
    this.emit();
  }

  /** Check all milestones and trigger any newly reached ones */
  private checkMilestones(): void {
    for (const milestone of MILESTONES) {
      if (this.state.milestones[milestone.id] === false && this.state.purrs >= milestone.threshold) {
        this.state.milestones[milestone.id] = true;
        if (!this.state.unlockedSkins.includes(milestone.skinId)) {
          this.state.unlockedSkins = [...this.state.unlockedSkins, milestone.skinId];
        }
        this.emitMilestone(milestone);
      }
    }
  }

  purchaseUpgrade(upgradeId: string): PurchaseResult {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) return { success: false, reason: 'insufficient_purrs' };

    const cost = this.getNextUpgradeCost(upgradeId);

    if (this.state.currentPurrs < cost) {
      return { success: false, reason: 'insufficient_purrs' };
    }

    // Deduct cost and increment owned
    this.state.currentPurrs -= cost;
    this.state.upgrades[upgradeId].owned += 1;

    // Apply effect
    const effect = def.effect;
    if (effect.type === 'ambience_unlock') {
      if (!this.state.unlockedAmbience.includes(effect.trackId)) {
        this.state.unlockedAmbience = [...this.state.unlockedAmbience, effect.trackId];
      }
    }

    // Recalculate derived values
    this.recalculateClickValue();
    this.recalculatePurrsPerSecond();

    this.emit();
    return { success: true };
  }

  /** Recalculate clickValue: 1 + sum(multiplier * owned) for all click_multiplier upgrades */
  private recalculateClickValue(): void {
    let clickValue = 1;
    for (const def of UPGRADES) {
      if (def.effect.type === 'click_multiplier') {
        const owned = this.state.upgrades[def.id]?.owned ?? 0;
        clickValue += def.effect.multiplier * owned;
      }
    }
    this.state.clickValue = clickValue;
  }

  /** Recalculate purrsPerSecond: sum(purrsPerSecond * owned) for all passive_generator upgrades */
  private recalculatePurrsPerSecond(): void {
    let purrsPerSecond = 0;
    for (const def of UPGRADES) {
      if (def.effect.type === 'passive_generator') {
        const owned = this.state.upgrades[def.id]?.owned ?? 0;
        purrsPerSecond += def.effect.purrsPerSecond * owned;
      }
    }
    this.state.purrsPerSecond = purrsPerSecond;
  }

  /** Select an ambience track by id */
  selectAmbience(trackId: string): void {
    this.state.activeAmbienceTrack = trackId;
    this.emit();
  }

  /** Set ambience volume, clamped to [0, 1] */
  setVolume(level: number): void {
    const clamped = Math.max(0, Math.min(1, level));
    this.state.ambienceVolume = clamped;
    this.audioManager?.setAmbienceVolume(clamped);
    this.emit();
  }

  /** Dismiss a notification by id */
  dismissNotification(id: string): void {
    this.state.notifications = this.state.notifications.filter((n) => n.id !== id);
    this.emit();
  }

  /** Reset all progress to defaults */
  resetProgress(): void {
    this.persistenceManager?.clear();
    this.state = this.initState();
    this.emit();
  }

  /** Apply offline purrs based on time elapsed since last active */
  applyOfflinePurrs(): void {
    const now = Date.now();
    const elapsed = (now - this.state.lastActiveTime) / 1000; // seconds

    if (elapsed < 60 || this.state.purrsPerSecond === 0) {
      return;
    }

    const cappedElapsed = Math.min(elapsed, 28800); // cap at 8 hours
    const awarded = Math.floor(this.state.purrsPerSecond * cappedElapsed);

    this.state.currentPurrs += awarded;
    this.state.purrs += awarded;

    const notification: Notification = {
      id: crypto.randomUUID(),
      type: 'offline_purrs',
      message: `You earned ${awarded} purrs while away for ${Math.floor(cappedElapsed / 60)} minutes!`,
      timestamp: now,
    };
    this.state.notifications = [...this.state.notifications, notification];
    this.state.lastActiveTime = now;

    this.checkMilestones();
    this.emit();
  }

  /** Start the passive tick interval — adds purrsPerSecond every 1000ms */
  startPassiveTick(): void {
    if (this.passiveTickInterval !== null) {
      return; // already running
    }
    this.passiveTickInterval = setInterval(() => {
      if (this.state.purrsPerSecond > 0) {
        this.state.currentPurrs += this.state.purrsPerSecond;
        this.state.purrs += this.state.purrsPerSecond;
        this.checkMilestones();
        this.emit();
      }
    }, 1000);
  }

  /** Stop the passive tick interval */
  stopPassiveTick(): void {
    if (this.passiveTickInterval !== null) {
      clearInterval(this.passiveTickInterval);
      this.passiveTickInterval = null;
    }
  }

  // ─── State Access (for PersistenceManager) ────────────────────────────────

  getState(): Readonly<GameState> {
    return Object.freeze({ ...this.state });
  }
}
