import type { FruitTier } from '../types/index.ts';
import { audioManager } from '../audio/AudioManager.ts';

export interface GameHUDState {
  score: number;
  nextTier: FruitTier | null;
}

export interface GameHUDCallbacks {
  onBack: () => void;
}

export function createGameHUD(container: HTMLElement, callbacks: GameHUDCallbacks): {
  el: HTMLElement;
  update: (state: GameHUDState) => void;
  syncAudioToggles: () => void;
} {
  const el = document.createElement('div');
  el.className = 'game-hud';
  el.innerHTML = `
    <div class="hud-top">
      <button class="btn btn-ghost btn-sm" data-action="back">← 菜单</button>
      <div class="hud-controls">
        <button class="btn btn-toggle btn-sm" data-action="sfx" title="音效开关">🔊 音效</button>
        <button class="btn btn-toggle btn-sm" data-action="music" title="音乐开关">🎵 音乐</button>
      </div>
      <div class="score-display">得分: <span id="score-value">0</span></div>
    </div>
    <div class="next-preview">
      <span>下一个</span>
      <canvas id="next-canvas" width="64" height="64"></canvas>
    </div>
    <p class="game-hint">手指按住定位 · 松手释放</p>
  `;

  const scoreEl = el.querySelector('#score-value') as HTMLElement;
  const nextCanvas = el.querySelector('#next-canvas') as HTMLCanvasElement;
  const sfxBtn = el.querySelector('[data-action="sfx"]') as HTMLButtonElement;
  const musicBtn = el.querySelector('[data-action="music"]') as HTMLButtonElement;

  function syncAudioToggles(): void {
    sfxBtn.classList.toggle('off', !audioManager.isSfxEnabled());
    sfxBtn.textContent = audioManager.isSfxEnabled() ? '🔊 音效' : '🔇 音效';
    musicBtn.classList.toggle('off', !audioManager.isMusicEnabled());
    musicBtn.textContent = audioManager.isMusicEnabled() ? '🎵 音乐' : '🔕 音乐';
  }

  sfxBtn.addEventListener('click', () => {
    audioManager.toggleSfx();
    syncAudioToggles();
  });

  musicBtn.addEventListener('click', () => {
    audioManager.toggleMusic();
    syncAudioToggles();
  });

  el.querySelector('[data-action="back"]')?.addEventListener('click', callbacks.onBack);

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

  syncAudioToggles();
  container.appendChild(el);
  return { el, update, syncAudioToggles };
}
