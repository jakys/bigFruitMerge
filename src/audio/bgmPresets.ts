import type { BgmSession } from './audioTypes.ts';
import { startAsmrItemsLoopBgm } from './asmrItemBgm.ts';

const NOTE: Record<string, number> = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
};

const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
const MELODY_PATTERN = [0, 2, 4, 3, 4, 2, 1, 0, 2, 4, 5, 4, 2, 0];

/** 短促 blip（魔性循环用） */
function playBlip(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  durSec: number,
  type: OscillatorType,
  vol: number,
): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = type === 'square' ? 2800 : 2000;
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + durSec);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + durSec + 0.02);
}

function playKick(ctx: AudioContext, dest: AudioNode, vol = 0.08): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.08);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + 0.12);
}

function playPad(ctx: AudioContext, dest: AudioNode, freq: number, holdMs: number, vol = 0.05): void {
  const t = ctx.currentTime;
  const dur = holdMs / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.3);
  gain.gain.linearRampToValueAtTime(0.001, t + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function playPulse(ctx: AudioContext, dest: AudioNode, vol = 0.06): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 160;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(68, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.15);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + 0.22);
}

function createWhiteNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function createAlphaLayer(ctx: AudioContext, dest: AudioNode, carrier: number, beatHz: number, vol: number): BgmSession {
  const t = ctx.currentTime;
  const merger = ctx.createChannelMerger(2);
  const layerGain = ctx.createGain();
  layerGain.gain.value = vol;
  const left = ctx.createOscillator();
  const right = ctx.createOscillator();
  left.type = 'sine';
  right.type = 'sine';
  left.frequency.value = carrier;
  right.frequency.value = carrier + beatHz;
  left.connect(merger, 0, 0);
  right.connect(merger, 0, 1);
  merger.connect(layerGain);
  layerGain.connect(dest);
  left.start(t);
  right.start(t);
  const lfo = ctx.createOscillator();
  lfo.frequency.value = beatHz;
  const lfoG = ctx.createGain();
  lfoG.gain.value = vol * 0.35;
  lfo.connect(lfoG);
  lfoG.connect(layerGain.gain);
  lfo.start(t);
  return {
    stop: () => {
      const s = ctx.currentTime + 0.05;
      try { left.stop(s); right.stop(s); lfo.stop(s); } catch { /* */ }
    },
  };
}

/** 1. 助眠阿尔法：8Hz 差频 + 超低 drone */
export function startAlphaSleepBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const alpha = createAlphaLayer(ctx, dest, 174, 8, 0.04);
  const t = ctx.currentTime;
  const d1 = ctx.createOscillator();
  const d2 = ctx.createOscillator();
  const dg = ctx.createGain();
  const df = ctx.createBiquadFilter();
  df.type = 'lowpass';
  df.frequency.value = 280;
  dg.gain.value = 0.02;
  d1.frequency.value = 110;
  d2.frequency.value = 164.81;
  d1.type = 'sine';
  d2.type = 'sine';
  d1.connect(df);
  d2.connect(df);
  df.connect(dg);
  dg.connect(dest);
  d1.start(t);
  d2.start(t);
  let melodyTimer: ReturnType<typeof setInterval> | null = null;
  let step = 0;
  melodyTimer = setInterval(() => {
    playPad(ctx, dest, PENTATONIC[step % 3] * 0.5, 4000, 0.025);
    step++;
  }, 4000);
  return {
    stop: () => {
      if (melodyTimer) clearInterval(melodyTimer);
      alpha.stop();
      const s = ctx.currentTime + 0.05;
      try { d1.stop(s); d2.stop(s); } catch { /* */ }
    },
  };
}

/** 2. 白噪音：循环噪 + 海浪式起伏 */
export function startWhiteNoiseBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = createWhiteNoiseBuffer(ctx, 3);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  const gain = ctx.createGain();
  gain.gain.value = 0.06;
  const swell = ctx.createOscillator();
  swell.frequency.value = 0.08;
  const swellG = ctx.createGain();
  swellG.gain.value = 0.025;
  swell.connect(swellG);
  swellG.connect(gain.gain);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(t);
  swell.start(t);
  return {
    stop: () => {
      const s = ctx.currentTime + 0.05;
      try { src.stop(s); swell.stop(s); } catch { /* */ }
    },
  };
}

/** 3. 五声悠扬：五声旋律 + 轻柔心跳 */
export function startPentatonicBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  let step = 0;
  const beat = 720;
  const melodyTimer = setInterval(() => {
    const idx = MELODY_PATTERN[step % MELODY_PATTERN.length];
    playPad(ctx, dest, PENTATONIC[idx], beat * 2.5, 0.05);
    step++;
  }, beat * 2);
  const pulseTimer = setInterval(() => playPulse(ctx, dest), beat);
  playPad(ctx, dest, PENTATONIC[0], beat * 2.5);
  playPulse(ctx, dest);
  return {
    stop: () => {
      clearInterval(melodyTimer);
      clearInterval(pulseTimer);
    },
  };
}

/** 4. Lo-Fi：慢鼓 + 爵士七和弦垫音 */
export function startLofiBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const chords = [[261.63, 329.63, 392, 493.88], [293.66, 369.99, 440, 554.37], [329.63, 415.3, 493.88, 587.33]];
  let chordIdx = 0;
  const chordTimer = setInterval(() => {
    const ch = chords[chordIdx % chords.length];
    ch.forEach((f, i) => playPad(ctx, dest, f * 0.5, 3200, 0.022 - i * 0.002));
    chordIdx++;
  }, 3200);
  const drumTimer = setInterval(() => {
    playPulse(ctx, dest, 0.05);
    setTimeout(() => playPad(ctx, dest, 80, 80, 0.035), 400);
  }, 900);
  return {
    stop: () => {
      clearInterval(chordTimer);
      clearInterval(drumTimer);
    },
  };
}

/** 5. 空境环境：慢 arpeggio + 长 reverb 感 pad */
export function startAmbientBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const arp = [261.63, 392, 523.25, 659.25, 523.25, 392];
  let step = 0;
  const arpTimer = setInterval(() => {
    playPad(ctx, dest, arp[step % arp.length], 2800, 0.038);
    step++;
  }, 1400);
  const t = ctx.currentTime;
  const drone = ctx.createOscillator();
  const dg = ctx.createGain();
  const df = ctx.createBiquadFilter();
  df.frequency.value = 500;
  dg.gain.value = 0.018;
  drone.frequency.value = 65.41;
  drone.type = 'sine';
  drone.connect(df);
  df.connect(dg);
  dg.connect(dest);
  drone.start(t);
  return {
    stop: () => {
      clearInterval(arpTimer);
      const s = ctx.currentTime + 0.05;
      try { drone.stop(s); } catch { /* */ }
    },
  };
}

/** 6. 经典魔性 V1：第一版快节奏大调琶音 + 低音脉冲 */
export function startClassicV1Bgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const melody = [
    'C5', 'E5', 'G5', 'E5', 'C5', 'G4', 'E5', 'G5',
    'D5', 'F4', 'A4', 'F4', 'D5', 'A4', 'D5', 'G5',
  ] as const;
  const bass = ['C4', 'C4', 'G4', 'G4'] as const;
  let step = 0;
  const tick = () => {
    const note = melody[step % melody.length];
    playBlip(ctx, dest, NOTE[note], 0.11, 'square', 0.055);
    if (step % 2 === 0) {
      const b = bass[Math.floor(step / 4) % bass.length];
      playBlip(ctx, dest, NOTE[b], 0.2, 'triangle', 0.09);
    }
    step++;
  };
  tick();
  const timer = setInterval(tick, 120);
  return { stop: () => clearInterval(timer) };
}

/** 7. 合成 Pop：日式休闲明亮三和弦弹跳 */
export function startSuikaPopBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const hook = [
    [523.25, 659.25, 783.99],
    [587.33, 739.99, 880.0],
    [659.25, 830.61, 987.77],
    [587.33, 739.99, 880.0],
  ];
  let step = 0;
  const beat = 200;
  const timer = setInterval(() => {
    const chord = hook[Math.floor(step / 2) % hook.length];
    chord.forEach((f, i) => playBlip(ctx, dest, f, 0.14, 'triangle', 0.04 - i * 0.008));
    if (step % 2 === 0) playKick(ctx, dest, 0.06);
    if (step % 4 === 0) playBlip(ctx, dest, 1046.5, 0.08, 'square', 0.035);
    step++;
  }, beat);
  playKick(ctx, dest, 0.06);
  return { stop: () => clearInterval(timer) };
}

/** 8. 超魔性循环：极短 hook 高密度重复（停不下来） */
export function startHyperMergeBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const seq = [659.25, 783.99, 880.0, 783.99];
  let step = 0;
  const timer = setInterval(() => {
    playBlip(ctx, dest, seq[step % seq.length], 0.09, 'square', 0.05);
    if (step % 2 === 0) playBlip(ctx, dest, 196.0, 0.12, 'triangle', 0.07);
    if (step % 4 === 3) playBlip(ctx, dest, 523.25, 0.06, 'square', 0.06);
    step++;
  }, 95);
  return { stop: () => clearInterval(timer) };
}

/** 9. 芯片舞曲：16 分音符 arpeggio */
export function startChipDanceBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const arp = [523.25, 659.25, 783.99, 1046.5, 783.99, 659.25];
  let step = 0;
  const timer = setInterval(() => {
    playBlip(ctx, dest, arp[step % arp.length], 0.07, 'square', 0.045);
    if (step % 8 === 0) playKick(ctx, dest, 0.07);
    if (step % 8 === 4) playBlip(ctx, dest, 130.81, 0.15, 'triangle', 0.08);
    step++;
  }, 110);
  return { stop: () => clearInterval(timer) };
}

/** 10. 放克律动：切分低音 + 短促 staccato 和弦 */
export function startFunkyLoopBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const bassLine = [98, 98, 123.47, 98, 146.83, 123.47];
  const stabs = [[392, 493.88, 587.33], [440, 554.37, 659.25]];
  let step = 0;
  const timer = setInterval(() => {
    playBlip(ctx, dest, bassLine[step % bassLine.length], 0.18, 'triangle', 0.085);
    if (step % 3 === 0) {
      const ch = stabs[Math.floor(step / 6) % stabs.length];
      ch.forEach((f) => playBlip(ctx, dest, f, 0.06, 'square', 0.03));
    }
    if (step % 6 === 2) playKick(ctx, dest, 0.055);
    step++;
  }, 160);
  return { stop: () => clearInterval(timer) };
}

export type BgmStarter = (ctx: AudioContext, dest: AudioNode) => BgmSession;

export const BGM_STARTERS: Record<string, BgmStarter> = {
  alphaSleep: startAlphaSleepBgm,
  whiteNoise: startWhiteNoiseBgm,
  pentatonic: startPentatonicBgm,
  lofi: startLofiBgm,
  ambient: startAmbientBgm,
  classicV1: startClassicV1Bgm,
  suikaPop: startSuikaPopBgm,
  hyperMerge: startHyperMergeBgm,
  chipDance: startChipDanceBgm,
  funkyLoop: startFunkyLoopBgm,
  asmrItems: startAsmrItemsLoopBgm,
};
