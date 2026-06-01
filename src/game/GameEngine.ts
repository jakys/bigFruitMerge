import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { FruitTier, GameCallbacks } from '../types/index.ts';
import { PhysicsWorld } from './PhysicsWorld.ts';
import { ScoreManager } from './ScoreManager.ts';

const FIXED_DT = 1000 / 60;

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private physics: PhysicsWorld | null = null;
  private scoreManager = new ScoreManager();
  private animationId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private tiers: FruitTier[] = [];
  private callbacks: GameCallbacks;
  private isRunning = false;
  private lastHudTier = -1;
  private lastHudScore = -1;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    this.bgCanvas = document.createElement('canvas');
    this.bgCanvas.width = GAME_CONFIG.width;
    this.bgCanvas.height = GAME_CONFIG.height;
    const bgCtx = this.bgCanvas.getContext('2d');
    if (!bgCtx) throw new Error('Background canvas unavailable');
    this.bgCtx = bgCtx;
    this.drawStaticBackground();

    this.callbacks = callbacks;
  }

  start(tiers: FruitTier[]): void {
    this.stop();
    this.tiers = tiers;
    this.scoreManager.reset();
    this.lastHudTier = -1;
    this.lastHudScore = -1;
    this.accumulator = 0;
    this.callbacks.onScoreChange(0);
    this.physics?.destroy();
    this.physics = new PhysicsWorld(tiers, this.callbacks, this.scoreManager);
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  destroy(): void {
    this.stop();
    this.physics?.destroy();
    this.physics = null;
  }

  getPhysics(): PhysicsWorld | null {
    return this.physics;
  }

  getScoreManager(): ScoreManager {
    return this.scoreManager;
  }

  handlePointerMove(clientX: number, _clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const x = (clientX - rect.left) * scaleX;
    this.physics?.setDropX(x);
  }

  handleDrop(): void {
    this.physics?.drop();
  }

  shouldUpdateHud(): { score: number; tierIndex: number } | null {
    if (!this.physics) return null;
    const score = this.scoreManager.getScore();
    const tierIndex = this.physics.getCurrentDropTier();
    if (score === this.lastHudScore && tierIndex === this.lastHudTier) return null;
    this.lastHudScore = score;
    this.lastHudTier = tierIndex;
    return { score, tierIndex };
  }

  private loop = (time: number): void => {
    if (!this.isRunning || !this.physics) return;

    const frameDt = Math.min(time - this.lastTime, 50);
    this.lastTime = time;
    this.accumulator += frameDt;

    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < GAME_CONFIG.maxPhysicsStepsPerFrame) {
      this.physics.step(FIXED_DT, 1);
      this.accumulator -= FIXED_DT;
      steps++;
    }

    this.render();
    this.animationId = requestAnimationFrame(this.loop);
  };

  private drawStaticBackground(): void {
    const { bgCtx, bgCanvas } = this;
    const { width, height } = bgCanvas;

    bgCtx.fillStyle = '#fff8e7';
    bgCtx.fillRect(0, 0, width, height);

    bgCtx.strokeStyle = 'rgba(231, 76, 60, 0.5)';
    bgCtx.setLineDash([6, 4]);
    bgCtx.lineWidth = 2;
    bgCtx.beginPath();
    bgCtx.moveTo(0, GAME_CONFIG.dangerLineY);
    bgCtx.lineTo(width, GAME_CONFIG.dangerLineY);
    bgCtx.stroke();

    bgCtx.strokeStyle = 'rgba(52, 152, 219, 0.3)';
    bgCtx.setLineDash([]);
    bgCtx.beginPath();
    bgCtx.moveTo(0, GAME_CONFIG.dropLineY);
    bgCtx.lineTo(width, GAME_CONFIG.dropLineY);
    bgCtx.stroke();
  }

  private render(): void {
    const { ctx, physics, tiers } = this;
    if (!physics) return;

    ctx.drawImage(this.bgCanvas, 0, 0);

    const bodies = physics.getFruitBodies();
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const tierIndex = physics.getBodyTierIndex(body);
      if (tierIndex === null) continue;
      const tier = tiers[tierIndex];
      if (!tier) continue;
      this.drawFruit(body.position.x, body.position.y, tier, false);
    }

    if (!physics.getIsDropping()) {
      const previewTier = tiers[physics.getCurrentDropTier()];
      if (previewTier) {
        this.drawFruit(physics.getDropX(), GAME_CONFIG.dropPreviewY, previewTier, true);
      }
    }
  }

  private drawFruit(x: number, y: number, tier: FruitTier, isPreview: boolean): void {
    const { ctx } = this;
    const r = tier.radius;

    ctx.save();
    if (isPreview) ctx.globalAlpha = 0.75;

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();

    if (tier.imageBitmap) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(tier.imageBitmap, x - r, y - r, r * 2, r * 2);
      ctx.restore();
    } else {
      ctx.fillStyle = tier.color;
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.floor(r * 1.1)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tier.emoji, x, y + 2);
    }

    ctx.strokeStyle = isPreview ? 'rgba(52,152,219,0.6)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = isPreview ? 2 : 1;
    ctx.stroke();

    ctx.restore();
  }
}
