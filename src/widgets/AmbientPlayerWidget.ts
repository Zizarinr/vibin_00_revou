import { GameEngine } from '../GameEngine.ts';
import { AudioManager } from '../AudioManager.ts';
import { AMBIENCE_TRACKS } from '../constants.ts';
import type { GameState } from '../constants.ts';

// ─── AmbientPlayerWidget ──────────────────────────────────────────────────────
//
// Renders the ambient music player: track list (available + locked), play/stop
// controls, volume slider, animated waveform indicator, and autoplay-blocked banner.

export class AmbientPlayerWidget {
  private container: HTMLElement;
  private engine: GameEngine;
  private audioManager: AudioManager;

  // DOM references
  private trackListEl!: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private volumeSlider!: HTMLInputElement;
  private waveformIndicator!: HTMLElement;
  private autoplayBanner!: HTMLElement;

  // Widget state
  private selectedTrackId: string | null = null;
  private isPlaying = false;
  private volumeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Bound references for cleanup
  private boundOnStateChange: (state: Readonly<GameState>) => void;
  private boundOnPlayClick: () => void;
  private boundOnStopClick: () => void;
  private boundOnVolumeChange: () => void;
  private boundOnUserInteraction: () => void;

  constructor(container: HTMLElement, engine: GameEngine, audioManager: AudioManager) {
    this.container = container;
    this.engine = engine;
    this.audioManager = audioManager;

    this.boundOnStateChange = (s: Readonly<GameState>) => this.onStateChange(s);
    this.boundOnPlayClick = () => this.handlePlay();
    this.boundOnStopClick = () => this.handleStop();
    this.boundOnVolumeChange = () => this.handleVolumeChange();
    this.boundOnUserInteraction = () => this.handleUserInteraction();

    this.render();
    this.engine.on('stateChange', this.boundOnStateChange);

    // Sync initial state
    const initialState = this.engine.getState();
    this.syncTrackList(initialState.unlockedAmbience);
    this.volumeSlider.value = String(Math.round(initialState.ambienceVolume * 100));
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  private render(): void {
    this.container.id = 'ambient-player-widget';
    this.container.className = 'ambient-player-widget';

    // Track list
    this.trackListEl = document.createElement('div');
    this.trackListEl.className = 'track-list';

    // Player controls
    const controls = document.createElement('div');
    controls.className = 'player-controls';

    this.playBtn = document.createElement('button');
    this.playBtn.id = 'play-btn';
    this.playBtn.setAttribute('aria-label', 'Play ambience');
    this.playBtn.setAttribute('aria-pressed', 'false');
    this.playBtn.textContent = 'Play';
    this.playBtn.addEventListener('click', this.boundOnPlayClick);

    this.stopBtn = document.createElement('button');
    this.stopBtn.id = 'stop-btn';
    this.stopBtn.setAttribute('aria-label', 'Stop ambience');
    this.stopBtn.textContent = 'Stop';
    this.stopBtn.addEventListener('click', this.boundOnStopClick);

    this.volumeSlider = document.createElement('input');
    this.volumeSlider.type = 'range';
    this.volumeSlider.id = 'volume-slider';
    this.volumeSlider.min = '0';
    this.volumeSlider.max = '100';
    this.volumeSlider.value = '70';
    this.volumeSlider.setAttribute('aria-label', 'Ambience volume');
    this.volumeSlider.addEventListener('input', this.boundOnVolumeChange);

    this.waveformIndicator = document.createElement('div');
    this.waveformIndicator.className = 'waveform-indicator';
    this.waveformIndicator.setAttribute('aria-hidden', 'true');
    this.waveformIndicator.textContent = '▶▶▶';
    this.waveformIndicator.style.display = 'none';

    controls.appendChild(this.playBtn);
    controls.appendChild(this.stopBtn);
    controls.appendChild(this.volumeSlider);
    controls.appendChild(this.waveformIndicator);

    // Autoplay banner
    this.autoplayBanner = document.createElement('div');
    this.autoplayBanner.className = 'autoplay-banner';
    this.autoplayBanner.style.display = 'none';
    this.autoplayBanner.setAttribute('role', 'alert');
    this.autoplayBanner.textContent = 'Click anywhere to enable audio.';

    this.container.appendChild(this.trackListEl);
    this.container.appendChild(controls);
    this.container.appendChild(this.autoplayBanner);
  }

  // ─── Track List Rendering ─────────────────────────────────────────────────

  private syncTrackList(unlockedAmbience: string[]): void {
    this.trackListEl.innerHTML = '';

    for (const track of AMBIENCE_TRACKS) {
      const isUnlocked = unlockedAmbience.includes(track.id);

      if (isUnlocked) {
        const btn = document.createElement('button');
        btn.className = 'track-btn';
        btn.dataset.trackId = track.id;
        btn.textContent = track.name;
        if (this.selectedTrackId === track.id) {
          btn.classList.add('track-btn--selected');
          btn.setAttribute('aria-pressed', 'true');
        } else {
          btn.setAttribute('aria-pressed', 'false');
        }
        btn.addEventListener('click', () => this.selectTrack(track.id));
        this.trackListEl.appendChild(btn);
      } else {
        const div = document.createElement('div');
        div.className = 'track-locked';
        div.dataset.trackId = track.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'track-name';
        nameSpan.textContent = track.name;

        const costSpan = document.createElement('span');
        costSpan.className = 'track-cost';
        const cost = track.unlockCost ?? 0;
        costSpan.textContent = `${cost} Purrs to unlock`;

        div.appendChild(nameSpan);
        div.appendChild(costSpan);
        this.trackListEl.appendChild(div);
      }
    }
  }

  // ─── Track Selection ──────────────────────────────────────────────────────

  private selectTrack(trackId: string): void {
    this.selectedTrackId = trackId;
    // Update aria-pressed on all track buttons
    const buttons = this.trackListEl.querySelectorAll<HTMLButtonElement>('.track-btn');
    for (const btn of buttons) {
      const isSelected = btn.dataset.trackId === trackId;
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      btn.classList.toggle('track-btn--selected', isSelected);
    }
  }

  // ─── Play Handler ─────────────────────────────────────────────────────────

  private handlePlay(): void {
    if (this.selectedTrackId === null) return;

    this.engine.selectAmbience(this.selectedTrackId);
    this.audioManager.playAmbience(this.selectedTrackId);

    this.isPlaying = true;
    this.playBtn.setAttribute('aria-pressed', 'true');
    this.waveformIndicator.style.display = '';

    // Check for autoplay block after a short delay (AudioContext.resume is async)
    setTimeout(() => {
      this.syncAutoplayBanner();
    }, 200);
  }

  // ─── Stop Handler ─────────────────────────────────────────────────────────

  private handleStop(): void {
    this.audioManager.stopAmbience();
    this.isPlaying = false;
    this.playBtn.setAttribute('aria-pressed', 'false');
    this.waveformIndicator.style.display = 'none';
    this.syncAutoplayBanner();
  }

  // ─── Volume Handler (debounced to ≤100ms) ────────────────────────────────

  private handleVolumeChange(): void {
    if (this.volumeDebounceTimer !== null) {
      clearTimeout(this.volumeDebounceTimer);
    }
    this.volumeDebounceTimer = setTimeout(() => {
      const level = Number(this.volumeSlider.value) / 100;
      this.engine.setVolume(level);
      this.volumeDebounceTimer = null;
    }, 80); // well within 100ms
  }

  // ─── Autoplay Banner ──────────────────────────────────────────────────────

  private syncAutoplayBanner(): void {
    const blocked = this.audioManager.isAutoplayBlocked();
    if (blocked) {
      this.autoplayBanner.style.display = '';
      // Register a one-time user interaction listener to retry
      document.addEventListener('click', this.boundOnUserInteraction, { once: true });
      document.addEventListener('keydown', this.boundOnUserInteraction, { once: true });
    } else {
      this.autoplayBanner.style.display = 'none';
    }
  }

  private handleUserInteraction(): void {
    // Retry playback on next user interaction if a track is selected
    if (this.selectedTrackId !== null && this.isPlaying) {
      this.audioManager.playAmbience(this.selectedTrackId);
      setTimeout(() => this.syncAutoplayBanner(), 200);
    } else {
      this.autoplayBanner.style.display = 'none';
    }
  }

  // ─── State Change Handler ─────────────────────────────────────────────────

  private onStateChange(state: Readonly<GameState>): void {
    this.syncTrackList(state.unlockedAmbience);
    // Sync volume slider if changed externally
    const externalVolume = Math.round(state.ambienceVolume * 100);
    if (Number(this.volumeSlider.value) !== externalVolume) {
      this.volumeSlider.value = String(externalVolume);
    }
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────

  destroy(): void {
    this.engine.off('stateChange', this.boundOnStateChange);
    this.playBtn.removeEventListener('click', this.boundOnPlayClick);
    this.stopBtn.removeEventListener('click', this.boundOnStopClick);
    this.volumeSlider.removeEventListener('input', this.boundOnVolumeChange);
    document.removeEventListener('click', this.boundOnUserInteraction);
    document.removeEventListener('keydown', this.boundOnUserInteraction);

    if (this.volumeDebounceTimer !== null) {
      clearTimeout(this.volumeDebounceTimer);
      this.volumeDebounceTimer = null;
    }

    this.container.innerHTML = '';
  }
}
