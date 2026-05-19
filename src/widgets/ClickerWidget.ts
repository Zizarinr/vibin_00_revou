import { GameEngine } from '../GameEngine.ts';
import { AudioManager } from '../AudioManager.ts';
import type { GameState } from '../constants.ts';
import { SKIN_EMOJIS } from '../constants.ts';

// ─── ClickerWidget ────────────────────────────────────────────────────────────
//
// Renders the main cat sprite button, purr counter, bounce animation,
// floating "+N Purrs" text, and a muted indicator when sound is disabled.

export class ClickerWidget {
  private container: HTMLElement;
  private engine: GameEngine;
  private audioManager: AudioManager;
  private catButton!: HTMLButtonElement;
  private purrCounter!: HTMLElement;
  private mutedIndicator!: HTMLElement;
  private isAnimating = false;
  private counterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Bound references kept so we can remove them in destroy()
  private boundHandleClick: (event: MouseEvent) => void;
  private boundOnStateChange: (state: Readonly<GameState>) => void;

  constructor(container: HTMLElement, engine: GameEngine, audioManager: AudioManager) {
    this.container = container;
    this.engine = engine;
    this.audioManager = audioManager;

    this.boundHandleClick = (e: MouseEvent) => this.handleClick(e);
    this.boundOnStateChange = (s: Readonly<GameState>) => this.onStateChange(s);

    this.render();

    // Subscribe to state changes
    this.engine.on('stateChange', this.boundOnStateChange);

    // Sync initial state
    const initialState = this.engine.getState();
    this.updateCounter(initialState.purrs);
    this.syncMutedIndicator(initialState.settings.soundEnabled);
    this.catButton.textContent = SKIN_EMOJIS[initialState.activeSkin] || '🐱';
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  private render(): void {
    // Cat sprite button
    this.catButton = document.createElement('button');
    this.catButton.id = 'cat-sprite';
    this.catButton.className = 'cat-sprite';
    this.catButton.setAttribute('aria-label', 'Click the cat');
    this.catButton.setAttribute('role', 'button');
    this.catButton.setAttribute('aria-pressed', 'false');
    this.catButton.style.minWidth = '100px';
    this.catButton.style.minHeight = '100px';
    this.catButton.addEventListener('click', this.boundHandleClick);

    // Purr counter
    this.purrCounter = document.createElement('div');
    this.purrCounter.className = 'purr-counter';
    this.purrCounter.textContent = '0 Purrs';

    // Muted indicator (hidden by default)
    this.mutedIndicator = document.createElement('span');
    this.mutedIndicator.className = 'muted-indicator';
    this.mutedIndicator.textContent = '🔇';
    this.mutedIndicator.setAttribute('aria-label', 'Sound unavailable');
    this.mutedIndicator.style.display = 'none';

    this.container.appendChild(this.catButton);
    this.container.appendChild(this.purrCounter);
    this.container.appendChild(this.mutedIndicator);
  }

  // ─── Click Handler ─────────────────────────────────────────────────────────

  private handleClick(event: MouseEvent): void {
    // 1. Advance game state
    this.engine.click();

    // 2. Play sound if enabled
    const state = this.engine.getState();
    if (state.settings.soundEnabled) {
      this.audioManager.playSfx('meow');
    }

    // 3. Bounce animation with mid-animation reset support
    if (this.isAnimating) {
      this.catButton.classList.remove('cat--bounce');
      requestAnimationFrame(() => {
        this.catButton.classList.add('cat--bounce');
      });
    } else {
      this.catButton.classList.add('cat--bounce');
      this.isAnimating = true;
    }
    this.catButton.addEventListener(
      'animationend',
      () => {
        this.catButton.classList.remove('cat--bounce');
        this.isAnimating = false;
      },
      { once: true },
    );

    // 4. Spawn floating "+N Purrs" text at click coordinates
    this.spawnFloatingText(event.clientX, event.clientY, state.clickValue);
  }

  // ─── Floating Text ─────────────────────────────────────────────────────────

  private spawnFloatingText(x: number, y: number, value: number): void {
    const span = document.createElement('span');
    span.className = 'floating-purrs';
    span.textContent = `+${value} Purrs`;

    // Position absolutely within 50px of the click point
    const offsetX = (Math.random() - 0.5) * 50; // ±25px horizontal jitter
    const offsetY = (Math.random() - 0.5) * 50; // ±25px vertical jitter

    span.style.position = 'fixed';
    span.style.left = `${x + offsetX}px`;
    span.style.top = `${y + offsetY}px`;
    span.style.pointerEvents = 'none';
    span.style.zIndex = '9999';

    document.body.appendChild(span);

    setTimeout(() => {
      span.remove();
    }, 800);
  }

  // ─── Counter (debounced) ───────────────────────────────────────────────────

  private updateCounter(purrs: number): void {
    if (this.counterDebounceTimer !== null) {
      clearTimeout(this.counterDebounceTimer);
    }
    this.counterDebounceTimer = setTimeout(() => {
      this.purrCounter.textContent = `${Math.floor(purrs)} Purrs`;
      this.counterDebounceTimer = null;
    }, 100);
  }

  // ─── Muted Indicator ──────────────────────────────────────────────────────

  private syncMutedIndicator(soundEnabled: boolean): void {
    this.mutedIndicator.style.display = soundEnabled ? 'none' : 'inline';
  }

  // ─── State Change Handler ─────────────────────────────────────────────────

  private onStateChange(state: Readonly<GameState>): void {
    this.updateCounter(state.purrs);
    this.syncMutedIndicator(state.settings.soundEnabled);
    this.catButton.textContent = SKIN_EMOJIS[state.activeSkin] || '🐱';
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.engine.off('stateChange', this.boundOnStateChange);
    this.catButton.removeEventListener('click', this.boundHandleClick);

    if (this.counterDebounceTimer !== null) {
      clearTimeout(this.counterDebounceTimer);
      this.counterDebounceTimer = null;
    }

    // Remove rendered elements
    this.catButton.remove();
    this.purrCounter.remove();
    this.mutedIndicator.remove();
  }
}
