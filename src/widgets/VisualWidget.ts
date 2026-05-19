import { GameEngine } from '../GameEngine.ts';
import type { GameState } from '../constants.ts';

// ─── VisualWidget ─────────────────────────────────────────────────────────────
//
// Manages three visual systems:
//   1. Mood_Meter — tracks clicks in a rolling 60s window; applies body.mood--happy
//      when ≥ 50 clicks in the last 60 seconds.
//   2. Idle animations — cycles cat--blink / cat--tail-sway on the cat sprite
//      when the user hasn't clicked for > 3 seconds.
//   3. Decorative cat walk — injects a walking cat div at random 30–120s intervals.

export class VisualWidget {
  private engine: GameEngine;

  // Mood meter: timestamps of recent clicks (ms)
  private clickTimestamps: number[] = [];
  private lastPurrs = 0;

  // Idle animation
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private lastClickTime = Date.now();
  private idleClasses = ['cat--blink', 'cat--tail-sway'];
  private currentIdleIndex = 0;
  private isIdle = false;

  // Decorative cat walk
  private catWalkTimeout: ReturnType<typeof setTimeout> | null = null;

  // Bound references
  private boundOnStateChange: (state: Readonly<GameState>) => void;

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.boundOnStateChange = (s: Readonly<GameState>) => this.onStateChange(s);
    this.engine.on('stateChange', this.boundOnStateChange);

    // Seed lastPurrs from initial state
    this.lastPurrs = this.engine.getState().purrs;

    // Start idle check loop
    this.idleCheckInterval = setInterval(() => this.checkIdle(), 3000);

    // Schedule first cat walk
    this.scheduleCatWalk();
  }

  // ─── State Change Handler ─────────────────────────────────────────────────

  private onStateChange(state: Readonly<GameState>): void {
    // Detect a click by checking if purrs increased
    if (state.purrs > this.lastPurrs) {
      const now = Date.now();
      this.clickTimestamps.push(now);
      this.lastClickTime = now;
      this.lastPurrs = state.purrs;

      // Remove click timestamps older than 60 seconds
      const cutoff = now - 60_000;
      this.clickTimestamps = this.clickTimestamps.filter((t) => t >= cutoff);

      // Update mood
      this.updateMood();

      // Clear idle state on click
      if (this.isIdle) {
        this.clearIdleAnimation();
      }
    } else {
      this.lastPurrs = state.purrs;
    }
  }

  // ─── Mood Meter ───────────────────────────────────────────────────────────

  private updateMood(): void {
    const now = Date.now();
    const cutoff = now - 60_000;
    const recentClicks = this.clickTimestamps.filter((t) => t >= cutoff).length;

    if (recentClicks >= 50) {
      document.body.classList.add('mood--happy');
    } else {
      document.body.classList.remove('mood--happy');
    }
  }

  // ─── Idle Animation ───────────────────────────────────────────────────────

  private checkIdle(): void {
    const now = Date.now();
    const timeSinceClick = now - this.lastClickTime;

    if (timeSinceClick > 3000) {
      this.applyNextIdleAnimation();
    }
  }

  private applyNextIdleAnimation(): void {
    const catSprite = document.getElementById('cat-sprite');
    if (!catSprite) return;

    // Remove all idle classes first
    for (const cls of this.idleClasses) {
      catSprite.classList.remove(cls);
    }

    // Apply next idle class in cycle
    const cls = this.idleClasses[this.currentIdleIndex % this.idleClasses.length];
    catSprite.classList.add(cls);
    this.currentIdleIndex++;
    this.isIdle = true;
  }

  private clearIdleAnimation(): void {
    const catSprite = document.getElementById('cat-sprite');
    if (!catSprite) return;

    for (const cls of this.idleClasses) {
      catSprite.classList.remove(cls);
    }
    this.isIdle = false;
  }

  // ─── Decorative Cat Walk ──────────────────────────────────────────────────

  private scheduleCatWalk(): void {
    // Random interval between 30s and 120s
    const delay = 30_000 + Math.random() * 90_000;

    this.catWalkTimeout = setTimeout(() => {
      this.spawnCatWalk();
      // Schedule the next one
      this.scheduleCatWalk();
    }, delay);
  }

  private spawnCatWalk(): void {
    const cat = document.createElement('div');
    cat.className = 'cat-walk';
    cat.textContent = '🐱';
    cat.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cat);

    // Remove after 5 seconds
    setTimeout(() => {
      cat.remove();
    }, 5000);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.engine.off('stateChange', this.boundOnStateChange);

    if (this.idleCheckInterval !== null) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    if (this.catWalkTimeout !== null) {
      clearTimeout(this.catWalkTimeout);
      this.catWalkTimeout = null;
    }

    this.clearIdleAnimation();
    document.body.classList.remove('mood--happy');
  }
}
