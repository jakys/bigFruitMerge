import { GAME_CONFIG } from '../config/gameConfig.ts';
import { clientXToGameX } from '../utils/canvasDpi.ts';
import type { FruitTier, GameCallbacks, MergeEvent } from '../types/index.ts';
import { ParticleSystem } from '../effects/ParticleSystem.ts';
import { ScreenShake } from '../effects/ScreenShake.ts';
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
  private particles = new ParticleSystem();
  private screenShake = new ScreenShake();
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
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.bgCanvas.width = Math.round(GAME_CONFIG.width * dpr);
    this.bgCanvas.height = Math.round(GAME_CONFIG.height * dpr);
    const bgCtx = this.bgCanvas.getContext('2d');
    if (!bgCtx) throw new Error('Background canvas unavailable');
    bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    this.particles.clear();
    this.screenShake.reset();
    this.callbacks.onScoreChange(0);
    this.physics?.destroy();

    const wrappedCallbacks: GameCallbacks = {
      onScoreChange: this.callbacks.onScoreChange,
      onGameOver: this.callbacks.onGameOver,
      onMerge: (event) => this.handleMerge(event),
    };

    this.physics = new PhysicsWorld(tiers, wrappedCallbacks, this.scoreManager);
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
    this.particles.clear();
    this.screenShake.reset();
  }

  getPhysics(): PhysicsWorld | null {
    return this.physics;
  }

  getScoreManager(): ScoreManager {
    return this.scoreManager;
  }

  handlePointerMove(clientX: number, _clientY: number): void {
    const x = clientXToGameX(this.canvas, clientX, GAME_CONFIG.width);
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

  private handleMerge(event: MergeEvent): void {
    const tier = this.tiers[event.tierIndex];
    this.particles.emit(event, tier?.color ?? '#e74c3c');
    this.screenShake.trigger(event.tierIndex, event.isMaxTier);
    this.callbacks.onMerge(event);
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

    this.particles.update(frameDt);
    this.screenShake.update(frameDt);
    this.render();
    this.animationId = requestAnimationFrame(this.loop);
  };

  private drawStaticBackground(): void {
    const { bgCtx } = this;
    const { width, height } = GAME_CONFIG;

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

    const shake = this.screenShake.getOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    ctx.drawImage(this.bgCanvas, 0, 0, GAME_CONFIG.width, GAME_CONFIG.height);

    const bodies = physics.getFruitBodies();
    for (let i = 0; i < bodies.length; i++) {
      const body = bodies[i];
      const tierIndex = physics.getBodyTierIndex(body);
      if (tierIndex === null) continue;
      const tier = tiers[tierIndex];
      if (!tier) continue;
      this.drawFruit(body.position.x, body.position.y, tier, false);
    }

    this.particles.draw(ctx);

    if (!physics.getIsDropping()) {
      const previewTier = tiers[physics.getCurrentDropTier()];
      if (previewTier) {
        this.drawFruit(physics.getDropX(), GAME_CONFIG.dropPreviewY, previewTier, true);
      }
    }

    ctx.restore();
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
