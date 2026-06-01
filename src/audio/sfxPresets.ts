import type { SfxContext, SfxPreset } from './audioTypes.ts';

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

function softTone(api: SfxContext, freq: number, dur: number, vol: number, slide = 0, delay = 0): void {
  const { ctx, destination } = api;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1600;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.linearRampToValueAtTime(Math.max(60, freq + slide), t + dur);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noiseBurst(api: SfxContext, dur: number, vol: number, lowPass: number, delay = 0): void {
  const { ctx, destination } = api;
  const t = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowPass;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  src.start(t);
}

/** 1. 柔和（默认） */
const softPreset: SfxPreset = {
  playDrop: (api) => softTone(api, 240, 0.1, 0.06, -80),
  playMerge: (api, tier, max) => {
    const f = PENTATONIC[Math.min(tier, PENTATONIC.length - 1)];
    softTone(api, f, max ? 0.35 : 0.18, max ? 0.1 : 0.07);
    if (max) softTone(api, f * 1.5, 0.28, 0.05, 0, 0.06);
  },
  playGameOver: (api) => {
    softTone(api, 220, 0.5, 0.08, -120);
    softTone(api, 180, 0.6, 0.06, -80, 0.15);
  },
};

/** 2. ASMR：轻触、脆 pop、气声 */
const asmrPreset: SfxPreset = {
  playDrop: (api) => {
    noiseBurst(api, 0.04, 0.12, 3200);
    softTone(api, 120, 0.06, 0.08);
    noiseBurst(api, 0.08, 0.06, 6000, 0.01);
  },
  playMerge: (api, tier, max) => {
    noiseBurst(api, 0.05, 0.1 + tier * 0.008, 4000 + tier * 200);
    softTone(api, 180 + tier * 25, 0.08, 0.06);
    noiseBurst(api, 0.12, 0.05, 2500, 0.02);
    if (max) {
      noiseBurst(api, 0.2, 0.08, 5000, 0.04);
      softTone(api, 440, 0.25, 0.05, -100, 0.05);
    }
  },
  playGameOver: (api) => {
    noiseBurst(api, 0.6, 0.04, 1200);
    softTone(api, 200, 0.8, 0.04, -150);
  },
};

/** 3. 气泡：plop / bloop */
const bubblePreset: SfxPreset = {
  playDrop: (api) => {
    softTone(api, 400, 0.12, 0.07, -200);
    softTone(api, 200, 0.08, 0.05, -80, 0.02);
  },
  playMerge: (api, tier, max) => {
    const base = 350 + tier * 30;
    softTone(api, base, 0.15, 0.08, -180);
    softTone(api, base * 0.6, 0.1, 0.05, -60, 0.03);
    if (max) softTone(api, base * 1.2, 0.2, 0.07, -220, 0.05);
  },
  playGameOver: (api) => {
    softTone(api, 300, 0.4, 0.06, -250);
    softTone(api, 150, 0.5, 0.05, -100, 0.1);
  },
};

/** 4. 禅意磬：衰减 bell */
const zenPreset: SfxPreset = {
  playDrop: (api) => bell(api, 880, 0.4, 0.06),
  playMerge: (api, tier, max) => {
    bell(api, 660 + tier * 40, max ? 0.6 : 0.35, 0.07 + tier * 0.005);
    if (max) bell(api, 990, 0.5, 0.05, 0.08);
  },
  playGameOver: (api) => {
    bell(api, 523, 0.8, 0.06);
    bell(api, 392, 1.0, 0.04, 0.2);
  },
};

function bell(api: SfxContext, freq: number, dur: number, vol: number, delay = 0): void {
  const { ctx, destination } = api;
  const t = ctx.currentTime + delay;
  [1, 2.4, 3.8].forEach((harm) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * harm;
    const v = vol / (harm * 1.2);
    gain.gain.setValueAtTime(v, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  });
}

/** 5. 复古轻音：柔和方波（低音量+滤波） */
const retroPreset: SfxPreset = {
  playDrop: (api) => chiptone(api, 523, 0.08, 0.05, 'square'),
  playMerge: (api, tier, max) => {
    chiptone(api, 440 + tier * 35, max ? 0.2 : 0.1, 0.06, 'square');
    if (max) chiptone(api, 880, 0.15, 0.05, 'square', 0.05);
  },
  playGameOver: (api) => {
    chiptone(api, 392, 0.15, 0.05, 'square');
    chiptone(api, 330, 0.2, 0.04, 'square', 0.1);
    chiptone(api, 262, 0.25, 0.03, 'square', 0.2);
  },
};

function chiptone(
  api: SfxContext,
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType,
  delay = 0,
): void {
  const { ctx, destination } = api;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

export const SFX_PRESETS: Record<string, SfxPreset> = {
  soft: softPreset,
  asmr: asmrPreset,
  bubble: bubblePreset,
  zen: zenPreset,
  retro: retroPreset,
};
