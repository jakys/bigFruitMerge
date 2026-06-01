import type { MergeEvent } from '../types/index.ts';
import { getParticleParams } from '../config/effectConfig.ts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  active: boolean;
}

interface Ring {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
  active: boolean;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private pool: Particle[] = [];
  private ringPool: Ring[] = [];

  emit(event: MergeEvent, color: string): void {
    const params = getParticleParams(event.tierIndex, event.isMaxTier);

    for (let i = 0; i < params.count; i++) {
      const angle = (Math.PI * 2 * i) / params.count + Math.random() * 0.5;
      const speed = params.speed * (0.6 + Math.random() * 0.8);
      const p = this.acquireParticle();
      p.x = event.x;
      p.y = event.y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 1;
      p.life = params.lifeMs;
      p.maxLife = params.lifeMs;
      p.size = params.size * (0.7 + Math.random() * 0.6);
      p.color = color;
      p.active = true;
    }

    if (params.showRing) {
      const ring = this.acquireRing();
      ring.x = event.x;
      ring.y = event.y;
      ring.radius = 4;
      ring.maxRadius = params.ringRadius;
      ring.life = params.lifeMs * 1.2;
      ring.maxLife = params.lifeMs * 1.2;
      ring.color = color;
      ring.active = true;
    }

    if (params.extraBurst) {
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = params.speed * 1.8;
        const p = this.acquireParticle();
        p.x = event.x;
        p.y = event.y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = params.lifeMs * 1.3;
        p.maxLife = params.lifeMs * 1.3;
        p.size = params.size * 1.2;
        p.color = '#fff';
        p.active = true;
      }
    }
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.x += p.vx * dt * 0.06;
      p.y += p.vy * dt * 0.06;
      p.vy += 0.08 * dt * 0.06;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      const t = 1 - r.life / r.maxLife;
      r.radius = 4 + (r.maxRadius - 4) * t;
      r.life -= dt;
      if (r.life <= 0) r.active = false;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      const alpha = Math.max(0, (r.life / r.maxLife) * 0.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  clear(): void {
    for (const p of this.particles) p.active = false;
    for (const r of this.rings) r.active = false;
  }

  private acquireParticle(): Particle {
    const idle = this.particles.find((p) => !p.active);
    if (idle) return idle;
    const p: Particle = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 2, color: '#fff', active: false };
    this.particles.push(p);
    this.pool.push(p);
    return p;
  }

  private acquireRing(): Ring {
    const idle = this.rings.find((r) => !r.active);
    if (idle) return idle;
    const r: Ring = { x: 0, y: 0, radius: 0, maxRadius: 0, life: 0, maxLife: 0, color: '#fff', active: false };
    this.rings.push(r);
    this.ringPool.push(r);
    return r;
  }
}
