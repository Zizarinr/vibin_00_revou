import './styles.css';

import { GameEngine } from './GameEngine.ts';
import { PersistenceManager } from './PersistenceManager.ts';
import { AudioManager } from './AudioManager.ts';
import { ClickerWidget } from './widgets/ClickerWidget.ts';
import { ShopWidget } from './widgets/ShopWidget.ts';
import { AmbientPlayerWidget } from './widgets/AmbientPlayerWidget.ts';
import { MilestoneWidget } from './widgets/MilestoneWidget.ts';
import { VisualWidget } from './widgets/VisualWidget.ts';
import type { SaveState } from './constants.ts';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

// 1. Persistence — load any existing save
const persistence = new PersistenceManager();
const savedState: SaveState | null = persistence.load();

// 2. Game engine — restore from save or start fresh
const engine = new GameEngine(savedState);

// 3. Audio
const audio = new AudioManager();
if (!audio.isSupported()) {
  // Mark sound as disabled in game state
  engine.getState(); // ensure state is initialised
}
engine.setAudioManager(audio);
engine.setPersistenceManager(persistence);

// 4. Wire persistence → engine state getter
persistence.setStateGetter(() => ({
  version: 1,
  savedAt: Date.now(),
  state: { ...engine.getState() },
}));

// 5. Notify user if storage is unavailable
persistence.setStorageErrorCallback(() => {
  const banner = document.getElementById('save-error-banner');
  if (banner) banner.style.display = 'block';
});

// 6. Apply offline purrs (must happen before widgets render)
engine.applyOfflinePurrs();

// 7. Mount widgets into their containers
const clickerContainer = document.getElementById('clicker-widget')!;
const shopContainer = document.getElementById('shop-widget')!;
const ambientContainer = document.getElementById('ambient-widget')!;
const milestoneContainer = document.getElementById('milestone-widget')!;

new ClickerWidget(clickerContainer, engine, audio);
new ShopWidget(shopContainer, engine);
new AmbientPlayerWidget(ambientContainer, engine, audio);
new MilestoneWidget(milestoneContainer, engine, audio);
new VisualWidget(engine);

// 8. Start passive tick and auto-save
engine.startPassiveTick();
persistence.scheduleAutoSave(30_000);

// 9. Reset button
const resetBtn = document.getElementById('reset-btn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.style.display = 'flex';
  });
}

const confirmResetBtn = document.getElementById('confirm-reset-btn');
if (confirmResetBtn) {
  confirmResetBtn.addEventListener('click', () => {
    engine.resetProgress();
    const modal = document.getElementById('reset-modal');
    if (modal) modal.style.display = 'none';
  });
}

const cancelResetBtn = document.getElementById('cancel-reset-btn');
if (cancelResetBtn) {
  cancelResetBtn.addEventListener('click', () => {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.style.display = 'none';
  });
}
