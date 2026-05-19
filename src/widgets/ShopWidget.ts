import { GameEngine } from '../GameEngine.ts';
import { UPGRADES } from '../constants.ts';
import type { GameState } from '../constants.ts';

// ─── ShopWidget ───────────────────────────────────────────────────────────────
//
// Renders a scrollable list of all upgrades with name, description, cost, and
// owned count. Tracks affordability on each stateChange and handles the full
// purchase flow including keyboard support and insufficient-Purrs feedback.

export class ShopWidget {
  private container: HTMLElement;
  private engine: GameEngine;
  private upgradeRows: Map<string, HTMLElement> = new Map();
  private purrsPerSecLabel!: HTMLElement;
  private insufficientMsg!: HTMLElement;
  private insufficientMsgTimer: ReturnType<typeof setTimeout> | null = null;
  private boundOnStateChange: (state: Readonly<GameState>) => void;

  // Per-row click and keydown handlers stored so they can be removed
  private clickHandlers: Map<string, (e: MouseEvent) => void> = new Map();
  private keyHandlers: Map<string, (e: KeyboardEvent) => void> = new Map();

  constructor(container: HTMLElement, engine: GameEngine) {
    this.container = container;
    this.engine = engine;

    this.boundOnStateChange = (state: Readonly<GameState>) => {
      this.updateAffordability(state);
    };

    this.render();

    // Subscribe to state changes
    this.engine.on('stateChange', this.boundOnStateChange);

    // Sync initial affordability
    this.updateAffordability(this.engine.getState());
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  private render(): void {
    this.container.id = 'shop-widget';
    this.container.className = 'shop-widget';

    // Purrs/sec label
    this.purrsPerSecLabel = document.createElement('div');
    this.purrsPerSecLabel.className = 'shop-purrs-per-sec';
    this.purrsPerSecLabel.textContent = `${this.engine.getPurrsPerSecond()} Purrs/sec`;
    this.container.appendChild(this.purrsPerSecLabel);

    // Insufficient Purrs message (hidden by default)
    this.insufficientMsg = document.createElement('div');
    this.insufficientMsg.className = 'shop-insufficient-msg';
    this.insufficientMsg.setAttribute('role', 'alert');
    this.insufficientMsg.setAttribute('aria-live', 'polite');
    this.insufficientMsg.textContent = 'Not enough Purrs!';
    this.insufficientMsg.style.display = 'none';
    this.container.appendChild(this.insufficientMsg);

    // Scrollable upgrade list
    const list = document.createElement('ul');
    list.className = 'upgrade-list';
    list.setAttribute('role', 'list');

    for (const upgrade of UPGRADES) {
      const row = this.renderUpgradeRow(upgrade.id);
      this.upgradeRows.set(upgrade.id, row);
      list.appendChild(row);
    }

    this.container.appendChild(list);
  }

  private renderUpgradeRow(upgradeId: string): HTMLElement {
    const def = UPGRADES.find((u) => u.id === upgradeId);
    if (!def) throw new Error(`Unknown upgrade id: ${upgradeId}`);

    const cost = this.engine.getNextUpgradeCost(upgradeId);
    const owned = this.engine.getState().upgrades[upgradeId]?.owned ?? 0;

    const row = document.createElement('li');
    row.dataset.upgradeId = upgradeId;
    row.className = 'upgrade-row';
    row.setAttribute('role', 'button');
    row.tabIndex = 0;
    row.setAttribute('aria-label', `${def.name} — costs ${cost} Purrs`);
    row.setAttribute('aria-disabled', 'false');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'upgrade-name';
    nameSpan.textContent = def.name;

    const descSpan = document.createElement('span');
    descSpan.className = 'upgrade-desc';
    descSpan.textContent = def.description;

    const costSpan = document.createElement('span');
    costSpan.className = 'upgrade-cost';
    costSpan.textContent = `${cost} Purrs`;

    const ownedSpan = document.createElement('span');
    ownedSpan.className = 'upgrade-owned';
    ownedSpan.textContent = `Owned: ${owned}`;

    row.appendChild(nameSpan);
    row.appendChild(descSpan);
    row.appendChild(costSpan);
    row.appendChild(ownedSpan);

    // Attach click handler
    const clickHandler = (_e: MouseEvent) => this.handleUpgradeClick(upgradeId);
    this.clickHandlers.set(upgradeId, clickHandler);
    row.addEventListener('click', clickHandler);

    // Attach keyboard handler (Enter / Space)
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.handleUpgradeClick(upgradeId);
      }
    };
    this.keyHandlers.set(upgradeId, keyHandler);
    row.addEventListener('keydown', keyHandler);

    return row;
  }

  // ─── Affordability Update ──────────────────────────────────────────────────

  private updateAffordability(state: Readonly<GameState>): void {
    // Update Purrs/sec label
    this.purrsPerSecLabel.textContent = `${this.engine.getPurrsPerSecond()} Purrs/sec`;

    for (const [upgradeId, row] of this.upgradeRows) {
      const cost = this.engine.getNextUpgradeCost(upgradeId);
      const canAfford = state.currentPurrs >= cost;

      // Update cost display (cost changes after each purchase)
      const costSpan = row.querySelector('.upgrade-cost');
      if (costSpan) {
        costSpan.textContent = `${cost} Purrs`;
      }

      // Update aria-label with current cost
      const def = UPGRADES.find((u) => u.id === upgradeId);
      if (def) {
        row.setAttribute('aria-label', `${def.name} — costs ${cost} Purrs`);
      }

      if (canAfford) {
        row.classList.remove('upgrade-row--disabled');
        row.setAttribute('aria-disabled', 'false');

        // Re-attach click handler if not already present
        if (!this.clickHandlers.has(upgradeId)) {
          const clickHandler = (_e: MouseEvent) => this.handleUpgradeClick(upgradeId);
          this.clickHandlers.set(upgradeId, clickHandler);
          row.addEventListener('click', clickHandler);
        }
      } else {
        row.classList.add('upgrade-row--disabled');
        row.setAttribute('aria-disabled', 'true');

        // Remove click handler when disabled
        const existingClickHandler = this.clickHandlers.get(upgradeId);
        if (existingClickHandler) {
          row.removeEventListener('click', existingClickHandler);
          this.clickHandlers.delete(upgradeId);
        }
      }
    }
  }

  // ─── Purchase Flow ─────────────────────────────────────────────────────────

  private handleUpgradeClick(upgradeId: string): void {
    // Re-validate affordability at click time
    const state = this.engine.getState();
    const cost = this.engine.getNextUpgradeCost(upgradeId);

    if (state.currentPurrs < cost) {
      this.showInsufficientMessage();
      return;
    }

    const result = this.engine.purchaseUpgrade(upgradeId);

    if (result.success) {
      // Update the row's cost and owned count immediately
      const row = this.upgradeRows.get(upgradeId);
      if (row) {
        const newCost = this.engine.getNextUpgradeCost(upgradeId);
        const newOwned = this.engine.getState().upgrades[upgradeId]?.owned ?? 0;

        const costSpan = row.querySelector('.upgrade-cost');
        if (costSpan) costSpan.textContent = `${newCost} Purrs`;

        const ownedSpan = row.querySelector('.upgrade-owned');
        if (ownedSpan) ownedSpan.textContent = `Owned: ${newOwned}`;

        const def = UPGRADES.find((u) => u.id === upgradeId);
        if (def) {
          row.setAttribute('aria-label', `${def.name} — costs ${newCost} Purrs`);
        }
      }
    } else {
      this.showInsufficientMessage();
    }
  }

  // ─── Insufficient Message ──────────────────────────────────────────────────

  private showInsufficientMessage(): void {
    // Clear any existing timer
    if (this.insufficientMsgTimer !== null) {
      clearTimeout(this.insufficientMsgTimer);
      this.insufficientMsgTimer = null;
    }

    this.insufficientMsg.style.display = 'block';

    this.insufficientMsgTimer = setTimeout(() => {
      this.insufficientMsg.style.display = 'none';
      this.insufficientMsgTimer = null;
    }, 2000);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.engine.off('stateChange', this.boundOnStateChange);

    // Remove all event listeners from rows
    for (const [upgradeId, row] of this.upgradeRows) {
      const clickHandler = this.clickHandlers.get(upgradeId);
      if (clickHandler) {
        row.removeEventListener('click', clickHandler);
      }

      const keyHandler = this.keyHandlers.get(upgradeId);
      if (keyHandler) {
        row.removeEventListener('keydown', keyHandler);
      }
    }

    this.clickHandlers.clear();
    this.keyHandlers.clear();

    // Clear any pending timer
    if (this.insufficientMsgTimer !== null) {
      clearTimeout(this.insufficientMsgTimer);
      this.insufficientMsgTimer = null;
    }

    // Clear container
    this.container.innerHTML = '';
  }
}
