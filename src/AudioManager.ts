// ─── AudioManager ─────────────────────────────────────────────────────────────
//
// Wraps the Web Audio API for SFX playback and ambient track management.
// Designed to degrade gracefully in environments where AudioContext is absent
// (e.g., jsdom test environment, older browsers).

type SfxName = 'meow' | 'purr' | 'milestone';

interface SfxConfig {
  type: OscillatorType;
  frequency: number;
  duration: number; // seconds
}

const SFX_CONFIG: Record<SfxName, SfxConfig> = {
  meow:      { type: 'sine',     frequency: 800,  duration: 0.2 },
  purr:      { type: 'sawtooth', frequency: 150,  duration: 0.4 },
  milestone: { type: 'sine',     frequency: 1200, duration: 0.3 },
};

interface AmbienceConfig {
  type: OscillatorType;
  frequency: number;
}

const AMBIENCE_CONFIG: Record<string, AmbienceConfig> = {
  track_rainy_window:  { type: 'sawtooth', frequency: 200 },
  track_sunny_nap:     { type: 'sine',     frequency: 300 },
  track_cozy_fireplace:{ type: 'triangle', frequency: 100 },
};

const DEFAULT_AMBIENCE_CONFIG: AmbienceConfig = { type: 'sine', frequency: 250 };

// ─── AudioManager class ───────────────────────────────────────────────────────

export class AudioManager {
  private supported: boolean = false;
  private autoplayBlocked: boolean = false;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Currently playing ambient oscillator and its gain node
  private currentAmbienceOscillator: OscillatorNode | null = null;
  private currentAmbienceGain: GainNode | null = null;

  constructor() {
    if (!this.isSupported()) {
      this.supported = false;
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioContextClass: typeof AudioContext =
        (typeof window !== 'undefined' && ('AudioContext' in window
          ? (window as Window & typeof globalThis).AudioContext
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : (window as any).webkitAudioContext)) as typeof AudioContext;

      this.audioContext = new AudioContextClass();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.7; // default volume
      this.masterGain.connect(this.audioContext.destination);
      this.supported = true;
    } catch {
      this.supported = false;
    }
  }

  // ─── isSupported ────────────────────────────────────────────────────────────

  isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      ('AudioContext' in window || 'webkitAudioContext' in window)
    );
  }

  // ─── isAutoplayBlocked ──────────────────────────────────────────────────────

  isAutoplayBlocked(): boolean {
    return this.autoplayBlocked;
  }

  // ─── playSfx ────────────────────────────────────────────────────────────────

  playSfx(name: SfxName): void {
    if (!this.supported || !this.audioContext) return;

    const config = SFX_CONFIG[name];
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = config.type;
      oscillator.frequency.setValueAtTime(config.frequency, now);

      // Quick fade-out to avoid clicks at the end
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.linearRampToValueAtTime(0, now + config.duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start(now);
      oscillator.stop(now + config.duration);
    } catch {
      // Silently ignore playback errors
    }
  }

  // ─── playAmbience ───────────────────────────────────────────────────────────

  playAmbience(trackId: string): void {
    if (!this.supported || !this.audioContext || !this.masterGain) return;

    const ctx = this.audioContext;

    // Attempt to resume AudioContext (may be suspended due to autoplay policy)
    ctx.resume().then(() => {
      this.autoplayBlocked = false;
      this._startAmbienceTrack(trackId);
    }).catch(() => {
      this.autoplayBlocked = true;
    });
  }

  private _startAmbienceTrack(trackId: string): void {
    if (!this.audioContext || !this.masterGain) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const crossfadeDuration = 1; // seconds

    const config = AMBIENCE_CONFIG[trackId] ?? DEFAULT_AMBIENCE_CONFIG;

    // Create new oscillator and its gain node
    const newOscillator = ctx.createOscillator();
    const newGain = ctx.createGain();

    newOscillator.type = config.type;
    newOscillator.frequency.setValueAtTime(config.frequency, now);
    newOscillator.connect(newGain);
    newGain.connect(this.masterGain);

    if (this.currentAmbienceOscillator !== null && this.currentAmbienceGain !== null) {
      // Crossfade: fade out old, fade in new
      const oldGain = this.currentAmbienceGain;
      const oldOscillator = this.currentAmbienceOscillator;

      oldGain.gain.setValueAtTime(oldGain.gain.value, now);
      oldGain.gain.linearRampToValueAtTime(0, now + crossfadeDuration);

      newGain.gain.setValueAtTime(0, now);
      newGain.gain.linearRampToValueAtTime(1, now + crossfadeDuration);

      // Stop and disconnect old oscillator after crossfade completes
      oldOscillator.stop(now + crossfadeDuration);
      setTimeout(() => {
        try {
          oldGain.disconnect();
        } catch {
          // Already disconnected
        }
      }, crossfadeDuration * 1000 + 50);
    } else {
      // No existing track — start immediately at full volume
      newGain.gain.setValueAtTime(0, now);
      newGain.gain.linearRampToValueAtTime(1, now + crossfadeDuration);
    }

    newOscillator.start(now);

    this.currentAmbienceOscillator = newOscillator;
    this.currentAmbienceGain = newGain;
  }

  // ─── stopAmbience ───────────────────────────────────────────────────────────

  stopAmbience(): void {
    if (!this.supported || !this.audioContext) return;
    if (this.currentAmbienceOscillator === null || this.currentAmbienceGain === null) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const fadeDuration = 0.2; // 200ms

    const gain = this.currentAmbienceGain;
    const oscillator = this.currentAmbienceOscillator;

    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + fadeDuration);

    oscillator.stop(now + fadeDuration);

    setTimeout(() => {
      try {
        gain.disconnect();
      } catch {
        // Already disconnected
      }
    }, fadeDuration * 1000 + 50);

    this.currentAmbienceOscillator = null;
    this.currentAmbienceGain = null;
  }

  // ─── setAmbienceVolume ──────────────────────────────────────────────────────

  setAmbienceVolume(level: number): void {
    if (!this.supported || !this.audioContext || !this.masterGain) return;

    const clamped = Math.max(0, Math.min(1, level));
    this.masterGain.gain.setValueAtTime(clamped, this.audioContext.currentTime);
  }
}
