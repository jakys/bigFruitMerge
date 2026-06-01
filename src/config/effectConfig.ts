export const EFFECT_CONFIG = {
  particle: {
    baseCount: 8,
    countPerTier: 6,
    baseSpeed: 1.5,
    speedPerTier: 0.4,
    baseSize: 2,
    sizePerTier: 0.6,
    baseLifeMs: 400,
    lifePerTierMs: 40,
    ringBaseRadius: 20,
    ringPerTier: 8,
  },
  shake: {
    tierThreshold: 3,
    baseIntensity: 2,
    intensityPerTier: 0.8,
    baseDurationMs: 120,
    durationPerTierMs: 15,
    maxTierBonus: 8,
  },
} as const;

export function getParticleParams(tierIndex: number, isMaxTier: boolean) {
  const { particle } = EFFECT_CONFIG;
  const tierBoost = isMaxTier ? 1.5 : 1;
  return {
    count: Math.floor((particle.baseCount + tierIndex * particle.countPerTier) * tierBoost),
    speed: particle.baseSpeed + tierIndex * particle.speedPerTier,
    size: particle.baseSize + tierIndex * particle.sizePerTier,
    lifeMs: particle.baseLifeMs + tierIndex * particle.lifePerTierMs,
    ringRadius: particle.ringBaseRadius + tierIndex * particle.ringPerTier,
    showRing: tierIndex >= 3 || isMaxTier,
    extraBurst: isMaxTier,
  };
}

export function getShakeParams(tierIndex: number, isMaxTier: boolean) {
  const { shake } = EFFECT_CONFIG;
  if (tierIndex < shake.tierThreshold && !isMaxTier) return null;
  const bonus = isMaxTier ? shake.maxTierBonus : 0;
  return {
    intensity: shake.baseIntensity + tierIndex * shake.intensityPerTier + bonus,
    durationMs: shake.baseDurationMs + tierIndex * shake.durationPerTierMs + (isMaxTier ? 80 : 0),
  };
}
