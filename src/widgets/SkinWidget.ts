import { GameEngine } from '../GameEngine.ts';
import { SKIN_EMOJIS, type GameState } from '../constants.ts';

// ─── SkinWidget ───────────────────────────────────────────────────────────────
//
// Renders a list of unlocked skins and allows the user to select the active skin.

export class SkinWidget {
  private container: HTMLElement;
  private engine: GameEngine;

  // Bound reference for cleanup
  private boundOnStateChange: (state: Readonly<GameState>) => void;

  constructor(container: HTMLElement, engine: GameEngine) {
    this.container = container;
    this.engine = engine;

    this.boundOnStateChange = (s: Readonly<GameState>) => this.onStateChange(s);
    this.engine.on('stateChange', this.boundOnStateChange);

    this.render();
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  
  private render(): void {
    const state = this.engine.getState();
    const unlocked = ['default', ...state.unlockedSkins];
    
    this.container.id = 'skin-widget';
    this.container.className = 'skin-widget';
    this.container.innerHTML = '';

    const title = document.createElement('h3');
    title.textContent = 'Cat Skins';
    title.className = 'widget-title';
    this.container.appendChild(title);

    const list = document.createElement('div');
    list.className = 'skin-list';

    for (const skinId of unlocked) {
      const btn = document.createElement('button');
      btn.className = 'skin-btn';
      if (state.activeSkin === skinId) {
        btn.classList.add('skin-btn--active');
      }
      
      const emoji = SKIN_EMOJIS[skinId] || '🐱';
      btn.textContent = emoji;
      btn.setAttribute('aria-label', `Select ${skinId} skin`);
      
      btn.addEventListener('click', () => {
        this.engine.setActiveSkin(skinId);
      });
      
      list.appendChild(btn);
    }
    
    this.container.appendChild(list);
  }

  // ─── State Change Handler ─────────────────────────────────────────────────

  private onStateChange(state: Readonly<GameState>): void {
    // Re-render to update available skins and the active one
    this.render();
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.engine.off('stateChange', this.boundOnStateChange);
    this.container.innerHTML = '';
  }
}
