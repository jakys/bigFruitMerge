import type { FruitTier } from '../types/index.ts';
import { audioManager } from '../audio/AudioManager.ts';
import type { BgmPresetId, SfxPresetId } from '../audio/audioTypes.ts';
import { setupPreviewCanvasDpi } from '../utils/canvasDpi.ts';

const NEXT_PREVIEW_SIZE = 48;

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
  el.className = 'game-toolbar';
  el.innerHTML = `
    <div class="toolbar-row toolbar-main">
      <button class="btn btn-ghost btn-sm" data-action="back">← 菜单</button>
      <div class="score-display">得分: <span id="score-value">0</span></div>
      <div class="next-preview">
        <span>下一个</span>
        <canvas id="next-canvas"></canvas>
      </div>
      <div class="toolbar-actions">
        <button class="btn btn-toggle btn-sm" data-action="sfx" title="音效开关">🔊</button>
        <button class="btn btn-toggle btn-sm" data-action="music" title="音乐开关">🎵</button>
      </div>
    </div>
    <div class="toolbar-row toolbar-settings">
      <label class="hud-select-label">
        <span>BGM</span>
        <select id="bgm-preset" class="hud-select"></select>
      </label>
      <label class="hud-select-label">
        <span>音效</span>
        <select id="sfx-preset" class="hud-select"></select>
      </label>
    </div>
  `;

  const scoreEl = el.querySelector('#score-value') as HTMLElement;
  const nextCanvas = el.querySelector('#next-canvas') as HTMLCanvasElement;
  setupPreviewCanvasDpi(nextCanvas, NEXT_PREVIEW_SIZE);

  const sfxBtn = el.querySelector('[data-action="sfx"]') as HTMLButtonElement;
  const musicBtn = el.querySelector('[data-action="music"]') as HTMLButtonElement;
  const bgmSelect = el.querySelector('#bgm-preset') as HTMLSelectElement;
  const sfxSelect = el.querySelector('#sfx-preset') as HTMLSelectElement;

  for (const p of audioManager.getBgmPresets()) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    bgmSelect.appendChild(opt);
  }
  for (const p of audioManager.getSfxPresets()) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    sfxSelect.appendChild(opt);
  }

  function syncAudioToggles(): void {
    sfxBtn.classList.toggle('off', !audioManager.isSfxEnabled());
    sfxBtn.textContent = audioManager.isSfxEnabled() ? '🔊' : '🔇';
    musicBtn.classList.toggle('off', !audioManager.isMusicEnabled());
    musicBtn.textContent = audioManager.isMusicEnabled() ? '🎵' : '🔕';
    bgmSelect.value = audioManager.getBgmPresetId();
    sfxSelect.value = audioManager.getSfxPresetId();
  }

  sfxBtn.addEventListener('click', () => {
    audioManager.toggleSfx();
    syncAudioToggles();
  });

  musicBtn.addEventListener('click', () => {
    audioManager.toggleMusic();
    syncAudioToggles();
  });

  bgmSelect.addEventListener('change', () => {
    audioManager.setBgmPreset(bgmSelect.value as BgmPresetId);
    syncAudioToggles();
  });

  sfxSelect.addEventListener('change', () => {
    audioManager.setSfxPreset(sfxSelect.value as SfxPresetId);
    syncAudioToggles();
  });

  el.querySelector('[data-action="back"]')?.addEventListener('click', callbacks.onBack);

  function update(state: GameHUDState): void {
    scoreEl.textContent = String(state.score);
    const ctx = nextCanvas.getContext('2d');
    if (!ctx) return;
    const size = NEXT_PREVIEW_SIZE;
    ctx.clearRect(0, 0, size, size);
    if (!state.nextTier) return;

    const tier = state.nextTier;
    const r = Math.min(size * 0.42, tier.radius * 0.55);
    const cx = size / 2;
    const cy = size / 2;

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
