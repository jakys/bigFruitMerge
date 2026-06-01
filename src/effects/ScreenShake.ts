import { getShakeParams } from '../config/effectConfig.ts';

export class ScreenShake {
  private remainingMs = 0;
  private intensity = 0;
  private offsetX = 0;
  private offsetY = 0;

  trigger(tierIndex: number, isMaxTier: boolean): void {
    const params = getShakeParams(tierIndex, isMaxTier);
    if (!params) return;
    this.remainingMs = params.durationMs;
    this.intensity = params.intensity;
  }

  update(dt: number): void {
    if (this.remainingMs <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    this.remainingMs -= dt;
    const fade = this.remainingMs > 0 ? this.remainingMs / 200 : 0;
    const amp = this.intensity * Math.min(1, fade);
    this.offsetX = (Math.random() - 0.5) * amp * 2;
    this.offsetY = (Math.random() - 0.5) * amp * 2;
  }

  getOffset(): { x: number; y: number } {
    return { x: this.offsetX, y: this.offsetY };
  }

  reset(): void {
    this.remainingMs = 0;
    this.offsetX = 0;
    this.offsetY = 0;
  }
}
