// ─── TypeScript Interfaces ────────────────────────────────────────────────────

export interface UserSettings {
  reducedMotion: boolean;
  soundEnabled: boolean;
}

export interface Notification {
  id: string;
  type: 'milestone' | 'offline_purrs' | 'corrupt_save' | 'save_error';
  message: string;
  timestamp: number;
}

export type UpgradeEffect =
  | { type: 'click_multiplier'; multiplier: number }
  | { type: 'passive_generator'; purrsPerSecond: number }
  | { type: 'ambience_unlock'; trackId: string };

export interface UpgradeDefinition {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  effect: UpgradeEffect;
}

export interface UpgradeState {
  owned: number;
}

export interface Milestone {
  id: string;
  threshold: number;
  skinId: string;
  soundId: string;
  label: string;
}

export interface GameState {
  purrs: number;
  currentPurrs: number;
  clickValue: number;
  purrsPerSecond: number;
  upgrades: Record<string, UpgradeState>;
  unlockedAmbience: string[];
  milestones: Record<string, boolean>;
  unlockedSkins: string[];
  activeSkin: string;
  lastSaveTime: number;
  lastActiveTime: number;
  activeAmbienceTrack: string | null;
  ambienceVolume: number;
  notifications: Notification[];
  settings: UserSettings;
}

export interface SaveState {
  version: number;
  savedAt: number;
  state: GameState;
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export const MILESTONES: Milestone[] = [
  { id: 'milestone_100', threshold: 100, skinId: 'skin_sleepy', soundId: 'sfx_milestone_1', label: 'First Hundred Purrs' },
  { id: 'milestone_500', threshold: 500, skinId: 'skin_playful', soundId: 'sfx_milestone_2', label: 'Five Hundred Purrs' },
  { id: 'milestone_1000', threshold: 1000, skinId: 'skin_regal', soundId: 'sfx_milestone_3', label: 'One Thousand Purrs' },
  { id: 'milestone_10000', threshold: 10000, skinId: 'skin_cosmic', soundId: 'sfx_milestone_4', label: 'Ten Thousand Purrs' },
  { id: 'milestone_100000', threshold: 100000, skinId: 'skin_legendary', soundId: 'sfx_milestone_5', label: 'One Hundred Thousand Purrs' },
  { id: 'milestone_1000000', threshold: 1000000, skinId: 'skin_mythic', soundId: 'sfx_milestone_6', label: 'One Million Purrs' },
];

// ─── Upgrades ─────────────────────────────────────────────────────────────────

export const UPGRADES: UpgradeDefinition[] = [
  // Click multipliers
  {
    id: 'upgrade_soft_paws',
    name: 'Soft Paws',
    description: 'Your cat\'s paws are extra soft. +1 purr per click.',
    baseCost: 10,
    effect: { type: 'click_multiplier', multiplier: 1 },
  },
  {
    id: 'upgrade_loud_purr',
    name: 'Loud Purr',
    description: 'A thunderous purr that doubles your click value.',
    baseCost: 50,
    effect: { type: 'click_multiplier', multiplier: 2 },
  },
  {
    id: 'upgrade_turbo_paws',
    name: 'Turbo Paws',
    description: 'Lightning-fast paws. +5 purrs per click.',
    baseCost: 200,
    effect: { type: 'click_multiplier', multiplier: 5 },
  },
  // Passive generators
  {
    id: 'upgrade_sleeping_cat',
    name: 'Sleeping Cat',
    description: 'A cat napping in a sunbeam generates purrs passively.',
    baseCost: 15,
    effect: { type: 'passive_generator', purrsPerSecond: 0.1 },
  },
  {
    id: 'upgrade_yarn_ball',
    name: 'Yarn Ball',
    description: 'A yarn ball keeps the cat entertained and purring.',
    baseCost: 100,
    effect: { type: 'passive_generator', purrsPerSecond: 0.5 },
  },
  {
    id: 'upgrade_cat_cafe',
    name: 'Cat Café',
    description: 'A whole café of cats purring in harmony.',
    baseCost: 1100,
    effect: { type: 'passive_generator', purrsPerSecond: 4 },
  },
  // Ambience unlocks
  {
    id: 'upgrade_forest_rain',
    name: 'Forest Rain',
    description: 'Unlock the soothing Forest Rain ambience track.',
    baseCost: 500,
    effect: { type: 'ambience_unlock', trackId: 'track_forest_rain' },
  },
  {
    id: 'upgrade_ocean_waves',
    name: 'Ocean Waves',
    description: 'Unlock the calming Ocean Waves ambience track.',
    baseCost: 2500,
    effect: { type: 'ambience_unlock', trackId: 'track_ocean_waves' },
  },
];

// ─── Ambience Tracks ──────────────────────────────────────────────────────────

export interface AmbienceTrack {
  id: string;
  name: string;
  locked: boolean;
  unlockCost?: number;
}

export const AMBIENCE_TRACKS: AmbienceTrack[] = [
  { id: 'track_rainy_window', name: 'Rainy Window', locked: false },
  { id: 'track_sunny_nap', name: 'Sunny Nap', locked: false },
  { id: 'track_cozy_fireplace', name: 'Cozy Fireplace', locked: false },
  { id: 'track_forest_rain', name: 'Forest Rain', locked: true, unlockCost: 500 },
  { id: 'track_ocean_waves', name: 'Ocean Waves', locked: true, unlockCost: 2500 },
];

export const DEFAULT_UNLOCKED_AMBIENCE = ['track_rainy_window', 'track_sunny_nap', 'track_cozy_fireplace'];

// ─── Skins ────────────────────────────────────────────────────────────────────

export const SKIN_EMOJIS: Record<string, string> = {
  'default': '🐱',
  'skin_sleepy': '😴',
  'skin_playful': '🧶',
  'skin_regal': '👑',
  'skin_cosmic': '👽',
  'skin_legendary': '🦁',
  'skin_mythic': '🦄',
};
