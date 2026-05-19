// Integration test for AudioManager crossfade
// Requirements: 4.4

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioManager } from '../../AudioManager';

// ─── Mock AudioContext with gain node tracking ────────────────────────────────

// We need to track each gain node created so we can verify crossfade ramp calls.
// Each call to createGain() returns a fresh mock with its own spy functions.

function makeMockGainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeMockOscillator() {
  return {
    type: 'sine' as OscillatorType,
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

describe('AudioManager — crossfade integration', () => {
  let createdGainNodes: ReturnType<typeof makeMockGainNode>[];
  let mockAudioContext: {
    currentTime: number;
    destination: object;
    createGain: ReturnType<typeof vi.fn>;
    createOscillator: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    createdGainNodes = [];

    mockAudioContext = {
      currentTime: 0,
      destination: {},
      createGain: vi.fn(() => {
        const node = makeMockGainNode();
        createdGainNodes.push(node);
        return node;
      }),
      createOscillator: vi.fn(() => makeMockOscillator()),
      resume: vi.fn(() => Promise.resolve()),
    };

    vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('calls linearRampToValueAtTime with correct values during crossfade', async () => {
    const manager = new AudioManager();

    // Play first track — this creates the first ambience gain node
    manager.playAmbience('track_rainy_window');

    // Wait for the resume() promise to resolve so _startAmbienceTrack is called
    await new Promise((resolve) => setTimeout(resolve, 0));

    // At this point, one ambience gain node has been created (plus the master gain node
    // created in the constructor). Reset the tracking so we can isolate the crossfade.
    const gainNodesAfterFirstTrack = [...createdGainNodes];

    // Play second track — this should trigger a crossfade
    manager.playAmbience('track_sunny_nap');

    // Wait for the resume() promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 0));

    // After the second playAmbience call, new gain nodes should have been created.
    // The gain nodes created during the second call are the ones after the first batch.
    const gainNodesAfterCrossfade = createdGainNodes.slice(gainNodesAfterFirstTrack.length);

    // There should be at least one new gain node for the new track
    expect(gainNodesAfterCrossfade.length).toBeGreaterThanOrEqual(1);

    const newGainNode = gainNodesAfterCrossfade[gainNodesAfterCrossfade.length - 1];
    const currentTime = mockAudioContext.currentTime;
    const crossfadeDuration = 1;

    // New gain node should ramp from 0 → 1 (fade in)
    expect(newGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1,
      currentTime + crossfadeDuration,
    );

    // The old gain node (last one from the first batch, which is the ambience gain)
    // should ramp to 0 (fade out).
    // The ambience gain node is the last one created during the first playAmbience call
    // (master gain is created in constructor, then ambience gain in _startAmbienceTrack).
    const oldAmbienceGainNode = gainNodesAfterFirstTrack[gainNodesAfterFirstTrack.length - 1];

    expect(oldAmbienceGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      currentTime + crossfadeDuration,
    );
  });

  it('does not crossfade when no track is currently playing (first play)', async () => {
    const manager = new AudioManager();

    manager.playAmbience('track_rainy_window');
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The ambience gain node is the last one created (master gain is first)
    const ambienceGainNode = createdGainNodes[createdGainNodes.length - 1];

    // On first play, there's no old track to fade out.
    // The new gain should ramp from 0 → 1 (standard fade-in).
    expect(ambienceGainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1,
      mockAudioContext.currentTime + 1,
    );
  });

  it('old track gain node ramps to 0 during crossfade', async () => {
    const manager = new AudioManager();

    // Start first track
    manager.playAmbience('track_rainy_window');
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Capture the ambience gain node from the first track
    const firstAmbienceGain = createdGainNodes[createdGainNodes.length - 1];

    // Start second track (triggers crossfade)
    manager.playAmbience('track_cozy_fireplace');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const currentTime = mockAudioContext.currentTime;

    // Old gain should fade out to 0
    expect(firstAmbienceGain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      currentTime + 1,
    );
  });
});
