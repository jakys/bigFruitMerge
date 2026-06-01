import type { FruitTier } from '../types/index.ts';

export interface GameHUDState {
  score: number;
  nextTier: FruitTier | null;
}

export function createGameHUD(container: HTMLElement): {
  el: HTMLElement;
  update: (state: GameHUDState) => void;
} {
  const el = document.createElement('div');
  el.className = 'game-hud';
  el.innerHTML = `
    <div class="hud-top">
      <button class="btn btn-ghost btn-sm" data-action="back">← 菜单</button>
      <div class="score-display">得分: <span id="score-value">0</span></div>
    </div>
    <div class="next-preview">
      <span>下一个</span>
      <canvas id="next-canvas" width="64" height="64"></canvas>
    </div>
    <p class="game-hint">移动控制位置 · 点击释放</p>
  `;

  const scoreEl = el.querySelector('#score-value') as HTMLElement;
  const nextCanvas = el.querySelector('#next-canvas') as HTMLCanvasElement;

  function update(state: GameHUDState): void {
    scoreEl.textContent = String(state.score);
    const ctx = nextCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 64, 64);
    if (!state.nextTier) return;

    const tier = state.nextTier;
    const r = Math.min(28, tier.radius * 0.55);
    const cx = 32;
    const cy = 32;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (tier.imageBitmap) {
      ctx.drawImage(tier.imageBitmap, cx - r, cy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = tier.color;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      ctx.font = `${Math.floor(r * 1.2)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tier.emoji, cx, cy);
    }
    ctx.restore();
  }

  container.appendChild(el);
  return { el, update };
}

export function bindBackButton(hud: HTMLElement, onBack: () => void): void {
  hud.querySelector('[data-action="back"]')?.addEventListener('click', onBack);
}
