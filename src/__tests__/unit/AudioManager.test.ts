// Unit tests for AudioManager
// Requirements: 1.7, 4.9

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioManager } from '../../AudioManager';

// ─── Mock AudioContext ────────────────────────────────────────────────────────

const mockGainNode = {
  gain: { value: 0.7, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockOscillator = {
  type: 'sine' as OscillatorType,
  frequency: { setValueAtTime: vi.fn() },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};

const mockAudioContext = {
  currentTime: 0,
  destination: {},
  createGain: vi.fn(() => ({ ...mockGainNode })),
  createOscillator: vi.fn(() => ({ ...mockOscillator })),
  resume: vi.fn(() => Promise.resolve()),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AudioManager', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ─── isSupported() ──────────────────────────────────────────────────────────

  describe('isSupported()', () => {
    it('returns true when AudioContext is present', () => {
      const manager = new AudioManager();
      expect(manager.isSupported()).toBe(true);
    });

    it('returns false when AudioContext is absent', () => {
      // Remove both AudioContext and webkitAudioContext
      vi.unstubAllGlobals();
      const win = window as Window & { AudioContext?: unknown; webkitAudioContext?: unknown };
      const originalAudioContext = win.AudioContext;
      const originalWebkitAudioContext = win.webkitAudioContext;

      delete win.AudioContext;
      delete win.webkitAudioContext;

      const manager = new AudioManager();
      expect(manager.isSupported()).toBe(false);

      // Restore
      if (originalAudioContext !== undefined) win.AudioContext = originalAudioContext as typeof AudioContext;
      if (originalWebkitAudioContext !== undefined) win.webkitAudioContext = originalWebkitAudioContext;
    });

    it('returns true when only webkitAudioContext is present', () => {
      vi.unstubAllGlobals();
      const win = window as Window & { AudioContext?: unknown; webkitAudioContext?: unknown };
      const originalAudioContext = win.AudioContext;

      delete win.AudioContext;
      win.webkitAudioContext = vi.fn(() => mockAudioContext);

      const manager = new AudioManager();
      expect(manager.isSupported()).toBe(true);

      // Restore
      if (originalAudioContext !== undefined) win.AudioContext = originalAudioContext as typeof AudioContext;
      delete win.webkitAudioContext;
    });
  });

  // ─── playSfx() ──────────────────────────────────────────────────────────────

  describe('playSfx()', () => {
    it('is a no-op when AudioContext is absent — no errors thrown, no AudioContext calls', () => {
      vi.unstubAllGlobals();
      const win = window as Window & { AudioContext?: unknown; webkitAudioContext?: unknown };
      const originalAudioContext = win.AudioContext;
      const originalWebkitAudioContext = win.webkitAudioContext;

      delete win.AudioContext;
      delete win.webkitAudioContext;

      const manager = new AudioManager();

      // Should not throw
      expect(() => manager.playSfx('meow')).not.toThrow();
      expect(() => manager.playSfx('purr')).not.toThrow();
      expect(() => manager.playSfx('milestone')).not.toThrow();

      // Restore
      if (originalAudioContext !== undefined) win.AudioContext = originalAudioContext as typeof AudioContext;
      if (originalWebkitAudioContext !== undefined) win.webkitAudioContext = originalWebkitAudioContext;
    });

    it('calls createOscillator and createGain when supported', () => {
      const manager = new AudioManager();
      manager.playSfx('meow');
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });
  });

  // ─── isAutoplayBlocked() ────────────────────────────────────────────────────

  describe('isAutoplayBlocked()', () => {
    it('returns false initially', () => {
      const manager = new AudioManager();
      expect(manager.isAutoplayBlocked()).toBe(false);
    });

    it('returns true after AudioContext.resume() rejects (autoplay blocked)', async () => {
      // Override resume to reject
      mockAudioContext.resume.mockReturnValueOnce(Promise.reject(new Error('Autoplay blocked')));

      const manager = new AudioManager();
      manager.playAmbience('track_rainy_window');

      // Wait for the promise to settle
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(manager.isAutoplayBlocked()).toBe(true);
    });
  });

  // ─── setAmbienceVolume() ────────────────────────────────────────────────────

  describe('setAmbienceVolume()', () => {
    it('clamps negative values to 0', () => {
      const manager = new AudioManager();
      // masterGain.gain.setValueAtTime is called during construction and setAmbienceVolume
      const setValueAtTimeCalls: number[] = [];
      mockAudioContext.createGain.mockImplementation(() => ({
        ...mockGainNode,
        gain: {
          value: 0.7,
          setValueAtTime: vi.fn((val: number) => setValueAtTimeCalls.push(val)),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));

      const manager2 = new AudioManager();
      manager2.setAmbienceVolume(-0.5);

      // The last setValueAtTime call should be with 0 (clamped)
      const lastCall = setValueAtTimeCalls[setValueAtTimeCalls.length - 1];
      expect(lastCall).toBe(0);
    });

    it('clamps values greater than 1 to 1', () => {
      const setValueAtTimeCalls: number[] = [];
      mockAudioContext.createGain.mockImplementation(() => ({
        ...mockGainNode,
        gain: {
          value: 0.7,
          setValueAtTime: vi.fn((val: number) => setValueAtTimeCalls.push(val)),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));

      const manager = new AudioManager();
      manager.setAmbienceVolume(1.5);

      const lastCall = setValueAtTimeCalls[setValueAtTimeCalls.length - 1];
      expect(lastCall).toBe(1);
    });

    it('passes valid values (0–1) through unchanged', () => {
      const setValueAtTimeCalls: number[] = [];
      mockAudioContext.createGain.mockImplementation(() => ({
        ...mockGainNode,
        gain: {
          value: 0.7,
          setValueAtTime: vi.fn((val: number) => setValueAtTimeCalls.push(val)),
          linearRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      }));

      const manager = new AudioManager();
      manager.setAmbienceVolume(0.6);

      const lastCall = setValueAtTimeCalls[setValueAtTimeCalls.length - 1];
      expect(lastCall).toBe(0.6);
    });

    it('is a no-op when AudioContext is absent', () => {
      vi.unstubAllGlobals();
      const win = window as Window & { AudioContext?: unknown; webkitAudioContext?: unknown };
      const originalAudioContext = win.AudioContext;
      const originalWebkitAudioContext = win.webkitAudioContext;

      delete win.AudioContext;
      delete win.webkitAudioContext;

      const manager = new AudioManager();
      expect(() => manager.setAmbienceVolume(0.5)).not.toThrow();

      // Restore
      if (originalAudioContext !== undefined) win.AudioContext = originalAudioContext as typeof AudioContext;
      if (originalWebkitAudioContext !== undefined) win.webkitAudioContext = originalWebkitAudioContext;
    });
  });
});
