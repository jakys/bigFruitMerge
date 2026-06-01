export const GAME_CONFIG = {
  width: 400,
  height: 600,
  wallThickness: 40,
  gravity: 1.2,
  dropLineY: 80,
  dangerLineY: 140,
  dangerDurationMs: 2000,
  mergeCooldownMs: 80,
  mergeContactSlop: 12,
  mergeScanSlop: 8,
  dropCooldownMs: 350,
  maxPhysicsStepsPerFrame: 3,
  minCustomImages: 2,
  maxCustomImages: 15,
  minRadius: 18,
  maxRadius: 65,
  spawnTierMax: 4,
  dropPreviewY: 50,
} as const;

export const SCORE_TABLE: Record<number, number> = {
  0: 2,
  1: 4,
  2: 6,
  3: 8,
  4: 10,
  5: 12,
  6: 14,
  7: 16,
  8: 18,
  9: 20,
  10: 22,
};

export function getMergeScore(tierIndex: number): number {
  if (tierIndex in SCORE_TABLE) return SCORE_TABLE[tierIndex];
  return 10 + tierIndex * 2;
}

export function getMaxTierBonus(tierIndex: number): number {
  return 50 + tierIndex * 10;
}
