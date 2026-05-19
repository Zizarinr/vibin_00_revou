import { GameEngine } from '../GameEngine.ts';
import { AudioManager } from '../AudioManager.ts';
import type { GameState, Milestone } from '../constants.ts';

// ─── MilestoneWidget ──────────────────────────────────────────────────────────
//
// Renders a progress bar toward the next milestone threshold.
// On milestone events: shows a full-screen celebration overlay, plays SFX,
// and temporarily disables pointer events on the cat sprite.

export class MilestoneWidget {
  private container: HTMLElement;
  private engine: GameEngine;
  private audioManager: AudioManager;

  // DOM references
  private milestoneLabel!: HTMLElement;
  private milestoneBar!: HTMLProgressElement;

  // Bound references for cleanup
  private boundOnStateChange: (state: Readonly<GameState>) => void;
  private boundOnMilestone: (milestone: Milestone) => void;

  constructor(container: HTMLElement, engine: GameEngine, audioManager: AudioManager) {
    this.container = container;
    this.engine = engine;
    this.audioManager = audioManager;

    this.boundOnStateChange = (s: Readonly<GameState>) => this.onStateChange(s);
    this.boundOnMilestone = (m: Milestone) => this.onMilestone(m);

    this.render();
    this.engine.on('stateChange', this.boundOnStateChange);
    this.engine.on('milestone', this.boundOnMilestone);

    // Sync initial state
    const initialState = this.engine.getState();
    this.syncProgress(initialState);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  private render(): void {
    this.container.id = 'milestone-widget';
    this.container.className = 'milestone-widget';

    const progressWrapper = document.createElement('div');
    progressWrapper.className = 'milestone-progress';

    this.milestoneLabel = document.createElement('span');
    this.milestoneLabel.className = 'milestone-label';
    this.milestoneLabel.textContent = 'Next: 100 Purrs';

    this.milestoneBar = document.createElement('progress');
    this.milestoneBar.className = 'milestone-bar';
    this.milestoneBar.value = 0;
    this.milestoneBar.max = 100;

    progressWrapper.appendChild(this.milestoneLabel);
    progressWrapper.appendChild(this.milestoneBar);
    this.container.appendChild(progressWrapper);
  }

  // ─── Progress Sync ────────────────────────────────────────────────────────

  private syncProgress(state: Readonly<GameState>): void {
    const nextMilestone = this.engine.getNextMilestone();

    if (nextMilestone === null) {
      // All milestones reached
      this.milestoneLabel.textContent = 'Max Milestone Reached';
      this.milestoneBar.value = this.milestoneBar.max;
      return;
    }

    this.milestoneLabel.textContent = `Next: ${nextMilestone.threshold} Purrs`;
    this.milestoneBar.max = nextMilestone.threshold;
    this.milestoneBar.value = Math.min(state.purrs, nextMilestone.threshold);
  }

  // ─── Milestone Celebration ────────────────────────────────────────────────

  private onMilestone(milestone: Milestone): void {
    // Play milestone SFX
    this.audioManager.playSfx(milestone.soundId as any);

    // Disable pointer events on cat sprite
    const catSprite = document.getElementById('cat-sprite');
    if (catSprite) {
      catSprite.style.pointerEvents = 'none';
    }

    // Inject full-screen overlay
    const overlay = document.createElement('div');
    overlay.className = 'milestone-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.setAttribute('aria-label', 'Milestone reached!');
    overlay.textContent = '🎉 Milestone Reached! 🎉';
    document.body.appendChild(overlay);

    // Remove overlay and restore pointer events after 1.5s
    setTimeout(() => {
      overlay.remove();
      if (catSprite) {
        catSprite.style.pointerEvents = '';
      }
    }, 1500);
  }

  // ─── State Change Handler ─────────────────────────────────────────────────

  private onStateChange(state: Readonly<GameState>): void {
    this.syncProgress(state);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.engine.off('stateChange', this.boundOnStateChange);
    this.engine.off('milestone', this.boundOnMilestone);
    this.container.innerHTML = '';
  }
}
