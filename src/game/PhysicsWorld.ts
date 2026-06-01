import Matter from 'matter-js';
import { GAME_CONFIG } from '../config/gameConfig.ts';
import { randomSpawnTier } from '../config/defaultFruits.ts';
import type { FruitBodyMeta, FruitTier, GameCallbacks, MergeEvent } from '../types/index.ts';
import { ScoreManager } from './ScoreManager.ts';

const { Engine, World, Bodies, Body, Events, Composite, Sleeping } = Matter;

const bodyMetaMap = new WeakMap<Matter.Body, FruitBodyMeta>();

function pairKey(idA: number, idB: number): string {
  return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
}

export class PhysicsWorld {
  readonly engine: Matter.Engine;
  private tiers: FruitTier[];
  private callbacks: GameCallbacks;
  private scoreManager: ScoreManager;
  private pendingMergeKeys = new Set<string>();
  private mergingBodyIds = new Set<number>();
  private nextBodyId = 1;
  private dangerTimer = 0;
  private isGameOver = false;
  private currentDropTier = 0;
  private dropX = GAME_CONFIG.width / 2;
  private isDropping = false;
  private dropCooldownUntil = 0;
  private fruitBodiesCache: Matter.Body[] = [];
  private fruitBodiesDirty = true;
  private pendingCallbacks: (() => void)[] = [];

  constructor(tiers: FruitTier[], callbacks: GameCallbacks, scoreManager: ScoreManager) {
    this.tiers = tiers;
    this.callbacks = callbacks;
    this.scoreManager = scoreManager;
    this.engine = Engine.create({
      gravity: { x: 0, y: GAME_CONFIG.gravity },
      positionIterations: 6,
      velocityIterations: 4,
      constraintIterations: 2,
      enableSleeping: false,
    });
    this.setupWalls();
    this.setupCollisionHandlers();
    this.pickNextTier();
  }

  getBodyTierIndex(body: Matter.Body): number | null {
    return bodyMetaMap.get(body)?.tierIndex ?? null;
  }

  getTiers(): FruitTier[] {
    return this.tiers;
  }

  getCurrentDropTier(): number {
    return this.currentDropTier;
  }

  getDropX(): number {
    return this.dropX;
  }

  getIsDropping(): boolean {
    return this.isDropping;
  }

  getIsGameOver(): boolean {
    return this.isGameOver;
  }

  setDropX(x: number): void {
    if (this.isGameOver) return;
    const tier = this.tiers[this.currentDropTier];
    const minX = tier.radius + 2;
    const maxX = GAME_CONFIG.width - tier.radius - 2;
    this.dropX = Math.max(minX, Math.min(maxX, x));
  }

  drop(): void {
    if (this.isDropping || this.isGameOver) return;
    const now = this.engine.timing.timestamp;
    if (now < this.dropCooldownUntil) return;

    this.isDropping = true;
    this.dropCooldownUntil = now + GAME_CONFIG.dropCooldownMs;

    const body = this.createFruitBody(this.currentDropTier, this.dropX, GAME_CONFIG.dropLineY, false);
    Composite.add(this.engine.world, body);
    this.fruitBodiesDirty = true;
    this.pickNextTier();
  }

  step(fixedDt: number, steps: number): void {
    if (this.isGameOver) return;

    for (let i = 0; i < steps; i++) {
      Engine.update(this.engine, fixedDt);
    }

    this.resolveMerges();

    if (this.isDropping && this.engine.timing.timestamp >= this.dropCooldownUntil) {
      this.isDropping = false;
    }

    this.flushCallbacks();
    this.checkDangerLine(fixedDt * steps);
  }

  reset(tiers: FruitTier[]): void {
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.engine.gravity.y = GAME_CONFIG.gravity;
    this.engine.enableSleeping = false;
    this.tiers = tiers;
    this.pendingMergeKeys.clear();
    this.mergingBodyIds.clear();
    this.pendingCallbacks = [];
    this.nextBodyId = 1;
    this.dangerTimer = 0;
    this.isGameOver = false;
    this.isDropping = false;
    this.dropCooldownUntil = 0;
    this.fruitBodiesCache = [];
    this.fruitBodiesDirty = true;
    this.setupWalls();
    this.setupCollisionHandlers();
    this.pickNextTier();
  }

  destroy(): void {
    World.clear(this.engine.world, false);
    Engine.clear(this.engine);
    this.pendingCallbacks = [];
  }

  getFruitBodies(): Matter.Body[] {
    if (this.fruitBodiesDirty) {
      this.fruitBodiesCache = Composite.allBodies(this.engine.world).filter(
        (b) => b.label === 'fruit' && !b.isStatic,
      );
      this.fruitBodiesDirty = false;
    }
    return this.fruitBodiesCache;
  }

  private setupWalls(): void {
    const { width, height, wallThickness } = GAME_CONFIG;
    const wallOpts = { isStatic: true, render: { visible: false }, label: 'wall' };
    const ground = Bodies.rectangle(width / 2, height + wallThickness / 2 - 4, width + wallThickness * 2, wallThickness, wallOpts);
    const left = Bodies.rectangle(-wallThickness / 2 + 4, height / 2, wallThickness, height * 2, wallOpts);
    const right = Bodies.rectangle(width + wallThickness / 2 - 4, height / 2, wallThickness, height * 2, wallOpts);
    Composite.add(this.engine.world, [ground, left, right]);
  }

  private setupCollisionHandlers(): void {
    Events.off(this.engine, 'collisionStart');
    Events.off(this.engine, 'collisionActive');

    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        this.tryQueueMerge(pair.bodyA, pair.bodyB, true);
      }
    });
  }

  private tryQueueMerge(bodyA: Matter.Body, bodyB: Matter.Body, fromCollision: boolean): void {
    if (bodyA.label !== 'fruit' || bodyB.label !== 'fruit') return;

    const metaA = bodyMetaMap.get(bodyA);
    const metaB = bodyMetaMap.get(bodyB);
    if (!metaA || !metaB) return;
    if (metaA.tierIndex !== metaB.tierIndex) return;
    if (!this.canMerge(metaA, metaB)) return;
    if (!this.shouldMerge(bodyA, bodyB, metaA.tierIndex, fromCollision)) return;

    this.pendingMergeKeys.add(pairKey(metaA.bodyId, metaB.bodyId));
  }

  private canMerge(metaA: FruitBodyMeta, metaB: FruitBodyMeta): boolean {
    const now = this.engine.timing.timestamp;
    if (metaA.mergeCooldownUntil > now || metaB.mergeCooldownUntil > now) return false;
    if (this.mergingBodyIds.has(metaA.bodyId) || this.mergingBodyIds.has(metaB.bodyId)) return false;
    return true;
  }

  /** 碰撞/contact 时允许略大于相切距离，避免物理分离后漏合成 */
  private shouldMerge(a: Matter.Body, b: Matter.Body, tierIndex: number, fromCollision: boolean): boolean {
    const radius = this.tiers[tierIndex]?.radius ?? 20;
    const touchDist = radius * 2;
    const maxDist = fromCollision
      ? touchDist + GAME_CONFIG.mergeContactSlop
      : touchDist + GAME_CONFIG.mergeScanSlop;
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    return dx * dx + dy * dy <= maxDist * maxDist;
  }

  private scanOverlapsForMerge(): void {
    const fruits = this.getFruitBodies();
    const count = fruits.length;
    if (count < 2) return;

    for (let i = 0; i < count; i++) {
      const a = fruits[i];
      const metaA = bodyMetaMap.get(a);
      if (!metaA || this.mergingBodyIds.has(metaA.bodyId)) continue;

      for (let j = i + 1; j < count; j++) {
        const b = fruits[j];
        const metaB = bodyMetaMap.get(b);
        if (!metaB || metaA.tierIndex !== metaB.tierIndex) continue;
        if (!this.canMerge(metaA, metaB)) continue;
        if (!this.shouldMerge(a, b, metaA.tierIndex, false)) continue;

        this.pendingMergeKeys.add(pairKey(metaA.bodyId, metaB.bodyId));
      }
    }
  }

  /** 每帧最多处理若干次合并，支持连锁合成 */
  private resolveMerges(): void {
    const maxPasses = 4;
    for (let pass = 0; pass < maxPasses; pass++) {
      this.scanOverlapsForMerge();
      if (!this.processMerges()) break;
    }
  }

  private processMerges(): boolean {
    if (this.pendingMergeKeys.size === 0) return false;

    this.fruitBodiesDirty = true;
    const fruits = Composite.allBodies(this.engine.world).filter(
      (b) => b.label === 'fruit' && !b.isStatic,
    );
    const bodyByMetaId = new Map<number, Matter.Body>();
    for (const body of fruits) {
      const meta = bodyMetaMap.get(body);
      if (meta) bodyByMetaId.set(meta.bodyId, body);
    }

    const keys = [...this.pendingMergeKeys];
    this.pendingMergeKeys.clear();

    const processedIds = new Set<number>();
    let merged = false;

    for (const key of keys) {
      const [idAStr, idBStr] = key.split(':');
      const idA = Number(idAStr);
      const idB = Number(idBStr);
      if (processedIds.has(idA) || processedIds.has(idB)) continue;

      const a = bodyByMetaId.get(idA);
      const b = bodyByMetaId.get(idB);
      if (!a || !b) continue;

      const metaA = bodyMetaMap.get(a);
      const metaB = bodyMetaMap.get(b);
      if (!metaA || !metaB || metaA.tierIndex !== metaB.tierIndex) continue;
      if (!this.canMerge(metaA, metaB)) continue;
      if (!this.shouldMerge(a, b, metaA.tierIndex, true)) continue;

      processedIds.add(idA);
      processedIds.add(idB);
      this.executeMerge(a, b, metaA.tierIndex);
      merged = true;
    }

    return merged;
  }

  private executeMerge(a: Matter.Body, b: Matter.Body, tierIndex: number): void {
    const metaA = bodyMetaMap.get(a)!;
    const metaB = bodyMetaMap.get(b)!;
    this.mergingBodyIds.add(metaA.bodyId);
    this.mergingBodyIds.add(metaB.bodyId);

    const x = (a.position.x + b.position.x) / 2;
    const y = (a.position.y + b.position.y) / 2;
    const avgVx = (a.velocity.x + b.velocity.x) / 2;
    const avgVy = (a.velocity.y + b.velocity.y) / 2;

    Composite.remove(this.engine.world, [a, b]);
    bodyMetaMap.delete(a);
    bodyMetaMap.delete(b);
    this.fruitBodiesDirty = true;

    const maxTier = this.tiers.length - 1;
    const isMaxTier = tierIndex >= maxTier;

    if (!isMaxTier) {
      const newBody = this.createFruitBody(tierIndex + 1, x, y, true);
      Body.setVelocity(newBody, { x: avgVx * 0.25, y: Math.min(avgVy * 0.25, 1) });
      Composite.add(this.engine.world, newBody);
    }

    this.mergingBodyIds.delete(metaA.bodyId);
    this.mergingBodyIds.delete(metaB.bodyId);

    const event: MergeEvent = { tierIndex, x, y, isMaxTier };
    const score = this.scoreManager.addMergeScore(tierIndex, isMaxTier);
    this.pendingCallbacks.push(() => {
      this.callbacks.onMerge(event);
      this.callbacks.onScoreChange(score);
    });
  }

  private flushCallbacks(): void {
    if (this.pendingCallbacks.length === 0) return;
    const batch = this.pendingCallbacks;
    this.pendingCallbacks = [];
    for (const cb of batch) cb();
  }

  private createFruitBody(tierIndex: number, x: number, y: number, fromMerge: boolean): Matter.Body {
    const tier = this.tiers[tierIndex];
    const body = Bodies.circle(x, y, tier.radius, {
      restitution: 0.1,
      friction: 0.3,
      frictionStatic: 0.5,
      frictionAir: 0.02,
      density: 0.001,
      slop: 0.05,
      label: 'fruit',
    });

    Sleeping.set(body, false);

    const meta: FruitBodyMeta = {
      tierIndex,
      mergeCooldownUntil: fromMerge
        ? this.engine.timing.timestamp + GAME_CONFIG.mergeCooldownMs
        : 0,
      bodyId: this.nextBodyId++,
    };
    bodyMetaMap.set(body, meta);

    return body;
  }

  private pickNextTier(): void {
    this.currentDropTier = randomSpawnTier(this.tiers.length - 1);
  }

  private checkDangerLine(dt: number): void {
    const bodies = this.getFruitBodies();
    let overLine = false;

    for (const body of bodies) {
      const meta = bodyMetaMap.get(body);
      if (!meta) continue;
      const tier = this.tiers[meta.tierIndex];
      if (body.position.y - tier.radius < GAME_CONFIG.dangerLineY) {
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        if (speed < 0.5) {
          overLine = true;
          break;
        }
      }
    }

    if (overLine) {
      this.dangerTimer += dt;
      if (this.dangerTimer >= GAME_CONFIG.dangerDurationMs) {
        this.isGameOver = true;
        this.callbacks.onGameOver(this.scoreManager.getScore());
      }
    } else {
      this.dangerTimer = 0;
    }
  }
}
