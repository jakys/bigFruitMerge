import type { FruitTier } from '../types/index.ts';
import { GAME_CONFIG } from './gameConfig.ts';

const DEFAULT_FRUITS: Omit<FruitTier, 'index'>[] = [
  { name: '樱桃', radius: 18, color: '#e74c3c', emoji: '🍒' },
  { name: '草莓', radius: 24, color: '#ff6b81', emoji: '🍓' },
  { name: '葡萄', radius: 30, color: '#9b59b6', emoji: '🍇' },
  { name: '杨桃', radius: 36, color: '#f1c40f', emoji: '⭐' },
  { name: '橙子', radius: 42, color: '#e67e22', emoji: '🍊' },
  { name: '苹果', radius: 48, color: '#c0392b', emoji: '🍎' },
  { name: '梨', radius: 54, color: '#d4e157', emoji: '🍐' },
  { name: '桃子', radius: 60, color: '#ffb6c1', emoji: '🍑' },
  { name: '菠萝', radius: 66, color: '#f39c12', emoji: '🍍' },
  { name: '哈密瓜', radius: 72, color: '#2ecc71', emoji: '🍈' },
  { name: '大西瓜', radius: 78, color: '#27ae60', emoji: '🍉' },
];

export function getDefaultFruitTiers(): FruitTier[] {
  return DEFAULT_FRUITS.map((fruit, index) => ({
    ...fruit,
    index,
  }));
}

export function buildCustomFruitTiers(entries: { width: number; height: number; imageBitmap?: ImageBitmap; imageUrl?: string; name: string }[]): FruitTier[] {
  const count = entries.length;
  const { minRadius, maxRadius } = GAME_CONFIG;
  const colors = ['#e74c3c', '#ff6b81', '#9b59b6', '#f1c40f', '#e67e22', '#c0392b', '#d4e157', '#ffb6c1', '#f39c12', '#2ecc71', '#27ae60', '#3498db', '#1abc9c', '#e84393', '#fd79a8'];

  return entries.map((entry, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    const radius = minRadius + (maxRadius - minRadius) * t;
    return {
      index,
      name: entry.name || `等级 ${index + 1}`,
      radius,
      color: colors[index % colors.length],
      emoji: `${index + 1}`,
      imageUrl: entry.imageUrl,
      imageBitmap: entry.imageBitmap,
    };
  });
}

export function randomSpawnTier(maxTier: number): number {
  const cap = Math.min(GAME_CONFIG.spawnTierMax, maxTier);
  const weights = [0.4, 0.25, 0.2, 0.1, 0.05];
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i <= cap; i++) {
    acc += weights[i] ?? 0.05;
    if (r <= acc) return i;
  }
  return 0;
}
