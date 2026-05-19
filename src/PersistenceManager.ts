import { type SaveState } from './constants.ts';

// ─── PersistenceManager ───────────────────────────────────────────────────────

export class PersistenceManager {
  private static readonly SAVE_KEY = 'cat-clicker-save';

  private storageAvailable = true;
  private autoSaveInterval: ReturnType<typeof setInterval> | null = null;
  private getState: (() => SaveState) | null = null;
  private onStorageError: (() => void) | null = null;

  constructor() {
    // Register beforeunload to flush synchronously before page unloads
    window.addEventListener('beforeunload', () => this.flush());
  }

  /** Inject the state getter (called by main.ts after GameEngine is ready) */
  setStateGetter(getter: () => SaveState): void {
    this.getState = getter;
  }

  /** Inject a callback for when storage becomes unavailable */
  setStorageErrorCallback(cb: () => void): void {
    this.onStorageError = cb;
  }

  /**
   * Load and validate save data from localStorage.
   * Returns null on any failure (missing keys, invalid types, parse error, storage unavailable).
   */
  load(): SaveState | null {
    try {
      const raw = localStorage.getItem(PersistenceManager.SAVE_KEY);
      if (raw === null) {
        return null;
      }

      const parsed: unknown = JSON.parse(raw);

      if (!this.validate(parsed)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Synchronously write current state to localStorage.
   * On write failure, marks storage as unavailable and stops auto-saves.
   */
  flush(): void {
    if (!this.storageAvailable) {
      return;
    }

    const state = this.getState?.();
    if (state === undefined) {
      return;
    }

    try {
      const serialized = JSON.stringify(state);
      localStorage.setItem(PersistenceManager.SAVE_KEY, serialized);
    } catch {
      this.storageAvailable = false;
      this.stopAutoSave();
      this.onStorageError?.();
    }
  }

  /**
   * Schedule periodic auto-saves at the given interval.
   * Interval is capped at 30000ms. Clears any existing interval first.
   */
  scheduleAutoSave(intervalMs: number): void {
    this.stopAutoSave();

    const clampedInterval = Math.min(intervalMs, 30000);

    this.autoSaveInterval = setInterval(() => {
      this.flush();
    }, clampedInterval);
  }

  /**
   * Remove the save entry from localStorage.
   */
  clear(): void {
    try {
      localStorage.removeItem(PersistenceManager.SAVE_KEY);
    } catch {
      // Storage unavailable — nothing to clear
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private stopAutoSave(): void {
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * Schema validator: checks all required keys exist and all numeric fields are finite.
   * Returns true only if the data matches the SaveState shape.
   */
  private validate(data: unknown): data is SaveState {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Top-level numeric fields
    if (!Number.isFinite(obj['version'])) return false;
    if (!Number.isFinite(obj['savedAt'])) return false;

    // state object
    if (typeof obj['state'] !== 'object' || obj['state'] === null) {
      return false;
    }

    const state = obj['state'] as Record<string, unknown>;

    // Required numeric fields in state
    const numericFields: string[] = [
      'purrs',
      'currentPurrs',
      'clickValue',
      'purrsPerSecond',
      'ambienceVolume',
      'lastSaveTime',
      'lastActiveTime',
    ];

    for (const field of numericFields) {
      if (!Number.isFinite(state[field])) {
        return false;
      }
    }

    // Required array fields in state
    const arrayFields: string[] = ['unlockedAmbience', 'unlockedSkins', 'notifications'];

    for (const field of arrayFields) {
      if (!Array.isArray(state[field])) {
        return false;
      }
    }

    // Required object fields in state
    const objectFields: string[] = ['upgrades', 'milestones', 'settings'];

    for (const field of objectFields) {
      if (typeof state[field] !== 'object' || state[field] === null || Array.isArray(state[field])) {
        return false;
      }
    }

    return true;
  }
}
