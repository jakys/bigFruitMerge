import { getMaxTierBonus, getMergeScore } from '../config/gameConfig.ts';

export class ScoreManager {
  private score = 0;

  reset(): void {
    this.score = 0;
  }

  getScore(): number {
    return this.score;
  }

  addMergeScore(tierIndex: number, isMaxTier: boolean): number {
    let points = getMergeScore(tierIndex);
    if (isMaxTier) {
      points += getMaxTierBonus(tierIndex);
    }
    this.score += points;
    return this.score;
  }
}
