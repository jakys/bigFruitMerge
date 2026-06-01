const STORAGE_SFX = 'daxigua-sfx-enabled';
const STORAGE_MUSIC = 'daxigua-music-enabled';

/** 五声音阶（舒缓不刺耳） */
const PENTATONIC = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

/** 阿尔法节拍差频 10Hz，载体音 220Hz */
const ALPHA_BEAT_HZ = 10;
const ALPHA_CARRIER = 220;

/** 舒缓旋律循环（C 大调五声，每音 2 拍） */
const MELODY_PATTERN = [0, 2, 4, 3, 4, 2, 1, 0, 2, 4, 5, 4, 2, 0];

const BEAT_MS = 720;
const MERGE_NOTES = PENTATONIC;

interface BgmLayer {
  stop: () => void;
}

export class AudioManager {
  private static instance: AudioManager | null = null;
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private bgmMasterFilter: BiquadFilterNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmLayer: BgmLayer | null = null;
  private melodyTimer: ReturnType<typeof setInterval> | null = null;
  private pulseTimer: ReturnType<typeof setInterval> | null = null;
  private melodyStep = 0;
  private bgmRunning = false;
  private sfxEnabled = true;
  private musicEnabled = true;

  private constructor() {
    this.sfxEnabled = localStorage.getItem(STORAGE_SFX) !== 'false';
    this.musicEnabled = localStorage.getItem(STORAGE_MUSIC) !== 'false';
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  isSfxEnabled(): boolean {
    return this.sfxEnabled;
  }

  isMusicEnabled(): boolean {
    return this.musicEnabled;
  }

  setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
    localStorage.setItem(STORAGE_SFX, String(enabled));
  }

  setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
    localStorage.setItem(STORAGE_MUSIC, String(enabled));
    if (enabled && this.bgmRunning) {
      void this.ensureContext().then(() => this.startBgmLoop());
    } else {
      this.stopBgmLoop();
    }
  }

  toggleSfx(): boolean {
    this.setSfxEnabled(!this.sfxEnabled);
    return this.sfxEnabled;
  }

  toggleMusic(): boolean {
    this.setMusicEnabled(!this.musicEnabled);
    return this.musicEnabled;
  }

  async unlock(): Promise<void> {
    const ctx = await this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }

  async startBgm(): Promise<void> {
    if (!this.musicEnabled) return;
    await this.unlock();
    this.bgmRunning = true;
    this.startBgmLoop();
  }

  stopBgm(): void {
    this.bgmRunning = false;
    this.stopBgmLoop();
  }

  playDrop(): void {
    if (!this.sfxEnabled) return;
    void this.playSoftTone(240, 0.1, 0.06, -80);
  }

  playMerge(tierIndex: number, isMaxTier: boolean): void {
    if (!this.sfxEnabled) return;
    const idx = Math.min(tierIndex, MERGE_NOTES.length - 1);
    const freq = MERGE_NOTES[idx];
    void this.playSoftTone(freq, isMaxTier ? 0.35 : 0.18, isMaxTier ? 0.1 : 0.07);
    if (isMaxTier) {
      void this.playSoftTone(freq * 1.5, 0.28, 0.05, 0, 0.06);
    }
  }

  playGameOver(): void {
    if (!this.sfxEnabled) return;
    void this.playSoftTone(220, 0.5, 0.08, -120);
    void this.playSoftTone(180, 0.6, 0.06, -80, 0.15);
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.bgmMasterFilter = this.ctx.createBiquadFilter();
      this.bgmMasterFilter.type = 'lowpass';
      this.bgmMasterFilter.frequency.value = 1400;
      this.bgmMasterFilter.Q.value = 0.4;

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.22;
      this.bgmGain.connect(this.bgmMasterFilter);
      this.bgmMasterFilter.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.2;
      const sfxFilter = this.ctx.createBiquadFilter();
      sfxFilter.type = 'lowpass';
      sfxFilter.frequency.value = 2000;
      this.sfxGain.connect(sfxFilter);
      sfxFilter.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private startBgmLoop(): void {
    this.stopBgmLoop();
    if (!this.musicEnabled || !this.bgmRunning) return;

    void this.ensureContext().then((ctx) => {
      if (!this.bgmGain || !this.bgmRunning) return;

      this.bgmLayer = this.createAlphaBinauralLayer(ctx);
      this.melodyStep = 0;

      const playMelody = () => {
        if (!this.bgmRunning || !this.musicEnabled) return;
        const noteIdx = MELODY_PATTERN[this.melodyStep % MELODY_PATTERN.length];
        const freq = PENTATONIC[noteIdx] ?? 440;
        void this.playBgmPad(freq, BEAT_MS * 2.5);
        this.melodyStep++;
      };

      const playPulse = () => {
        if (!this.bgmRunning || !this.musicEnabled) return;
        void this.playBgmPulse();
      };

      playMelody();
      playPulse();
      this.melodyTimer = setInterval(playMelody, BEAT_MS * 2);
      this.pulseTimer = setInterval(playPulse, BEAT_MS);
    });
  }

  /** 持续阿尔法双声拍层 + 柔和环境垫音 */
  private createAlphaBinauralLayer(ctx: AudioContext): BgmLayer {
    const t = ctx.currentTime;
    const merger = ctx.createChannelMerger(2);
    const layerGain = ctx.createGain();
    layerGain.gain.value = 0.035;

    const left = ctx.createOscillator();
    left.type = 'sine';
    left.frequency.value = ALPHA_CARRIER;

    const right = ctx.createOscillator();
    right.type = 'sine';
    right.frequency.value = ALPHA_CARRIER + ALPHA_BEAT_HZ;

    left.connect(merger, 0, 0);
    right.connect(merger, 0, 1);
    merger.connect(layerGain);
    layerGain.connect(this.bgmGain!);

    left.start(t);
    right.start(t);

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.025;
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = 400;

    const drone1 = ctx.createOscillator();
    drone1.type = 'sine';
    drone1.frequency.value = 130.81;
    const drone2 = ctx.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 196.0;

    drone1.connect(droneFilter);
    drone2.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.bgmGain!);
    drone1.start(t);
    drone2.start(t);

    const alphaLfo = ctx.createOscillator();
    alphaLfo.type = 'sine';
    alphaLfo.frequency.value = ALPHA_BEAT_HZ;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.012;
    alphaLfo.connect(lfoGain);
    lfoGain.connect(layerGain.gain);
    alphaLfo.start(t);

    return {
      stop: () => {
        const stopT = ctx.currentTime + 0.05;
        try {
          left.stop(stopT);
          right.stop(stopT);
          drone1.stop(stopT);
          drone2.stop(stopT);
          alphaLfo.stop(stopT);
        } catch { /* already stopped */ }
      },
    };
  }

  private stopBgmLoop(): void {
    if (this.melodyTimer) {
      clearInterval(this.melodyTimer);
      this.melodyTimer = null;
    }
    if (this.pulseTimer) {
      clearInterval(this.pulseTimer);
      this.pulseTimer = null;
    }
    this.bgmLayer?.stop();
    this.bgmLayer = null;
  }

  /** 柔和垫音 */
  private async playBgmPad(freq: number, holdMs: number): Promise<void> {
    const ctx = await this.ensureContext();
    if (!this.bgmGain || ctx.state !== 'running' || !this.bgmRunning) return;

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
    gain.gain.linearRampToValueAtTime(0.055, t + 0.25);
    gain.gain.setValueAtTime(0.045, t + dur * 0.6);
    gain.gain.linearRampToValueAtTime(0.001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** 节拍脉冲（类似轻柔心跳） */
  private async playBgmPulse(): Promise<void> {
    const ctx = await this.ensureContext();
    if (!this.bgmGain || ctx.state !== 'running' || !this.bgmRunning) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(72, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.12);

    gain.gain.setValueAtTime(0.07, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** 柔和音效（低通 + 正弦，无刺耳波形） */
  private async playSoftTone(
    freq: number,
    dur: number,
    volume: number,
    freqSlide = 0,
    delay = 0,
  ): Promise<void> {
    const ctx = await this.ensureContext();
    if (!this.sfxGain) return;
    if (ctx.state === 'suspended') await ctx.resume();

    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;
    filter.Q.value = 0.5;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (freqSlide !== 0) {
      osc.frequency.linearRampToValueAtTime(Math.max(60, freq + freqSlide), t + dur);
    }

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

export const audioManager = AudioManager.getInstance();
