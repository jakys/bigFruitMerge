import type { BgmSession } from './audioTypes.ts';

/** 程序化 ASMR 物品音效辅助 */
function at(ctx: AudioContext, offset = 0): number {
  return ctx.currentTime + offset;
}

function noiseBuffer(ctx: AudioContext, dur: number, decay = true): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = decay ? 1 - i / len : 1;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buf;
}

function playNoise(
  ctx: AudioContext,
  dest: AudioNode,
  dur: number,
  vol: number,
  lowPass: number,
  highPass = 0,
  start = 0,
): void {
  const t = at(ctx, start);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur);
  const chain: AudioNode[] = [src];
  if (highPass > 0) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = highPass;
    chain.push(hp);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = lowPass;
  chain.push(lp);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  chain.push(gain);
  for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
  gain.connect(dest);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function playTone(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
  slide = 0,
  start = 0,
): void {
  const t = at(ctx, start);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.min(8000, freq * 6);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function playThump(ctx: AudioContext, dest: AudioNode, freq: number, vol: number, start = 0): void {
  playTone(ctx, dest, freq, 0.08, vol, 'sine', -freq * 0.6, start);
}

function playPop(ctx: AudioContext, dest: AudioNode, vol: number, start = 0): void {
  playNoise(ctx, dest, 0.025, vol, 5000, 800, start);
  playTone(ctx, dest, 180 + Math.random() * 80, 0.04, vol * 0.6, 'sine', -120, start);
}

function playBell(ctx: AudioContext, dest: AudioNode, freq: number, vol: number, start = 0): void {
  [1, 2.2, 3.5].forEach((h, i) => {
    playTone(ctx, dest, freq * h, 0.5 + i * 0.1, vol * (1 - i * 0.25), 'sine', 0, start);
  });
}

type AsmrItem = { label: string; play: (ctx: AudioContext, dest: AudioNode) => void };

/** 30 种不同物品的 ASMR 音效 */
const ASMR_ITEMS: AsmrItem[] = [
  {
    label: '雨滴',
    play: (ctx, dest) => {
      for (let i = 0; i < 6; i++) {
        playPop(ctx, dest, 0.04, i * 0.18 + Math.random() * 0.08);
        playNoise(ctx, dest, 0.06, 0.025, 3200, 400, i * 0.18);
      }
    },
  },
  {
    label: '木块轻敲',
    play: (ctx, dest) => {
      [220, 195, 210, 185].forEach((f, i) => playThump(ctx, dest, f, 0.07, i * 0.22));
    },
  },
  {
    label: '毛刷',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 1.2, 0.035, 1800, 200);
      playNoise(ctx, dest, 1.2, 0.02, 900, 100, 0.05);
    },
  },
  {
    label: '纸张揉搓',
    play: (ctx, dest) => {
      for (let i = 0; i < 5; i++) {
        playNoise(ctx, dest, 0.15 + Math.random() * 0.1, 0.045, 4500, 600, i * 0.2);
      }
    },
  },
  {
    label: '气泡膜',
    play: (ctx, dest) => {
      for (let i = 0; i < 8; i++) playPop(ctx, dest, 0.05, i * 0.12 + Math.random() * 0.05);
    },
  },
  {
    label: '水滴',
    play: (ctx, dest) => {
      [880, 720, 950, 680, 820].forEach((f, i) => {
        playTone(ctx, dest, f, 0.12, 0.05, 'sine', -400, i * 0.25);
        playNoise(ctx, dest, 0.04, 0.02, 6000, 1000, i * 0.25);
      });
    },
  },
  {
    label: '风铃',
    play: (ctx, dest) => {
      playBell(ctx, dest, 784, 0.04);
      playBell(ctx, dest, 988, 0.035, 0.35);
      playBell(ctx, dest, 659, 0.03, 0.7);
    },
  },
  {
    label: '键盘按键',
    play: (ctx, dest) => {
      [0, 1, 2].forEach((i) => {
        playNoise(ctx, dest, 0.02, 0.06, 4000, 1200, i * 0.15);
        playThump(ctx, dest, 120 + i * 15, 0.05, i * 0.15 + 0.01);
      });
    },
  },
  {
    label: '羽毛刷',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 1.4, 0.028, 1200, 300);
      playNoise(ctx, dest, 1.4, 0.018, 600, 150, 0.08);
    },
  },
  {
    label: '沙粒倾泻',
    play: (ctx, dest) => {
      for (let i = 0; i < 20; i++) {
        playNoise(ctx, dest, 0.03, 0.018, 3500, 800, i * 0.06);
        if (i % 4 === 0) playTone(ctx, dest, 2000 + Math.random() * 500, 0.02, 0.012, 'sine', 0, i * 0.06);
      }
    },
  },
  {
    label: '冰块碰杯',
    play: (ctx, dest) => {
      [1200, 1450, 1100, 1380].forEach((f, i) => {
        playTone(ctx, dest, f, 0.2, 0.04, 'sine', 0, i * 0.18);
        playNoise(ctx, dest, 0.05, 0.025, 7000, 2000, i * 0.18);
      });
    },
  },
  {
    label: '布料摩擦',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 0.8, 0.04, 2200, 400);
      playNoise(ctx, dest, 0.6, 0.03, 1400, 200, 0.4);
    },
  },
  {
    label: '剪刀咔嚓',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 0.04, 0.07, 5500, 1500);
      playThump(ctx, dest, 280, 0.04, 0.05);
      playNoise(ctx, dest, 0.04, 0.06, 5500, 1500, 0.35);
      playThump(ctx, dest, 260, 0.035, 0.4);
    },
  },
  {
    label: '书页翻动',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 0.35, 0.05, 3800, 500);
      playNoise(ctx, dest, 0.25, 0.04, 2800, 300, 0.3);
      playNoise(ctx, dest, 0.2, 0.035, 3200, 400, 0.55);
    },
  },
  {
    label: '轻缓心跳',
    play: (ctx, dest) => {
      for (let i = 0; i < 3; i++) {
        playThump(ctx, dest, 55, 0.055, i * 0.55);
        playThump(ctx, dest, 48, 0.04, i * 0.55 + 0.12);
      }
    },
  },
  {
    label: '猫咪呼噜',
    play: (ctx, dest) => {
      const t = at(ctx);
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      osc.type = 'sawtooth';
      osc.frequency.value = 52;
      lfo.frequency.value = 24;
      lfoG.gain.value = 8;
      gain.gain.value = 0.022;
      lfo.connect(lfoG);
      lfoG.connect(osc.frequency);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      osc.start(t);
      lfo.start(t);
      osc.stop(t + 1.5);
      lfo.stop(t + 1.5);
    },
  },
  {
    label: '浴缸泡泡',
    play: (ctx, dest) => {
      for (let i = 0; i < 12; i++) {
        playPop(ctx, dest, 0.025 + Math.random() * 0.015, i * 0.1 + Math.random() * 0.08);
      }
    },
  },
  {
    label: '火柴擦燃',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 0.5, 0.04, 6000, 2000);
      playNoise(ctx, dest, 0.8, 0.015, 900, 100, 0.35);
    },
  },
  {
    label: '钢笔书写',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 1.0, 0.035, 4800, 1200);
      for (let i = 0; i < 4; i++) playThump(ctx, dest, 90, 0.02, i * 0.25);
    },
  },
  {
    label: '米粒倒入',
    play: (ctx, dest) => {
      for (let i = 0; i < 18; i++) {
        playTone(ctx, dest, 1800 + Math.random() * 800, 0.015, 0.015, 'sine', 0, i * 0.055);
        playNoise(ctx, dest, 0.025, 0.012, 4000, 1000, i * 0.055);
      }
    },
  },
  {
    label: '落叶轻踩',
    play: (ctx, dest) => {
      for (let i = 0; i < 4; i++) {
        playNoise(ctx, dest, 0.12, 0.04, 2800, 500, i * 0.28);
        playThump(ctx, dest, 140, 0.035, i * 0.28 + 0.05);
      }
    },
  },
  {
    label: '耳语气流',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 1.0, 0.03, 800, 80);
      playNoise(ctx, dest, 0.8, 0.022, 500, 60, 0.2);
    },
  },
  {
    label: '肥皂泡沫',
    play: (ctx, dest) => {
      for (let i = 0; i < 5; i++) {
        playTone(ctx, dest, 300 - i * 20, 0.15, 0.035, 'sine', -180, i * 0.22);
        playNoise(ctx, dest, 0.1, 0.025, 2000, 300, i * 0.22);
      }
    },
  },
  {
    label: '撕魔术贴',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 0.6, 0.045, 5000, 800);
      playNoise(ctx, dest, 0.4, 0.03, 3500, 500, 0.35);
    },
  },
  {
    label: '软木塞',
    play: (ctx, dest) => {
      playPop(ctx, dest, 0.08);
      playNoise(ctx, dest, 0.3, 0.025, 1500, 200, 0.08);
      playTone(ctx, dest, 160, 0.25, 0.03, 'sine', -80, 0.1);
    },
  },
  {
    label: '玻璃弹珠',
    play: (ctx, dest) => {
      [660, 740, 620, 700].forEach((f, i) => {
        playBell(ctx, dest, f, 0.035, i * 0.2);
        playTone(ctx, dest, f * 0.5, 0.15, 0.02, 'sine', 0, i * 0.2 + 0.05);
      });
    },
  },
  {
    label: '打字机键',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 0.03, 0.07, 4500, 1500);
      playThump(ctx, dest, 100, 0.06);
      playNoise(ctx, dest, 0.025, 0.05, 3500, 1000, 0.12);
      playThump(ctx, dest, 85, 0.045, 0.12);
    },
  },
  {
    label: '铁皮雨',
    play: (ctx, dest) => {
      for (let i = 0; i < 8; i++) {
        playTone(ctx, dest, 2200 + Math.random() * 600, 0.06, 0.03, 'sine', -800, i * 0.14);
        playNoise(ctx, dest, 0.04, 0.02, 5500, 1500, i * 0.14);
      }
    },
  },
  {
    label: '棉柔轻拍',
    play: (ctx, dest) => {
      for (let i = 0; i < 5; i++) {
        playThump(ctx, dest, 80 + i * 5, 0.045, i * 0.24);
        playNoise(ctx, dest, 0.06, 0.02, 600, 80, i * 0.24);
      }
    },
  },
  {
    label: '海螺海浪',
    play: (ctx, dest) => {
      playNoise(ctx, dest, 1.2, 0.035, 700, 60);
      playNoise(ctx, dest, 1.0, 0.025, 450, 40, 0.15);
      playTone(ctx, dest, 130, 1.0, 0.015, 'sine', -20, 0.2);
    },
  },
];

/** 极轻环境底噪，让循环更连贯 */
function startAsmrBed(ctx: AudioContext, dest: AudioNode): BgmSession {
  const t = ctx.currentTime;
  const buf = noiseBuffer(ctx, 4);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  const gain = ctx.createGain();
  gain.gain.value = 0.012;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start(t);
  return {
    stop: () => {
      try { src.stop(ctx.currentTime + 0.05); } catch { /* */ }
    },
  };
}

/** 11. ASMR 物语：30 种物品音效循环组合 */
export function startAsmrItemsLoopBgm(ctx: AudioContext, dest: AudioNode): BgmSession {
  const bed = startAsmrBed(ctx, dest);
  let step = 0;
  const gapMs = 2100;

  const tick = () => {
    ASMR_ITEMS[step % ASMR_ITEMS.length].play(ctx, dest);
    step++;
  };

  tick();
  const timer = setInterval(tick, gapMs);

  return {
    stop: () => {
      clearInterval(timer);
      bed.stop();
    },
  };
}

export const ASMR_ITEM_COUNT = ASMR_ITEMS.length;
