const STORAGE_SFX = 'daxigua-sfx-enabled';
const STORAGE_MUSIC = 'daxigua-music-enabled';

/** 音符频率表 */
const NOTE: Record<string, number> = {
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
};

/** 魔性循环：短促大调琶音 + 低音脉冲 */
const BGM_MELODY = [
  { note: 'C5', dur: 0.12 }, { note: 'E5', dur: 0.12 }, { note: 'G5', dur: 0.12 }, { note: 'E5', dur: 0.12 },
  { note: 'C5', dur: 0.12 }, { note: 'G4', dur: 0.12 }, { note: 'E5', dur: 0.12 }, { note: 'G5', dur: 0.24 },
  { note: 'D5', dur: 0.12 }, { note: 'F4', dur: 0.12 }, { note: 'A4', dur: 0.12 }, { note: 'F4', dur: 0.12 },
  { note: 'D5', dur: 0.12 }, { note: 'A4', dur: 0.12 }, { note: 'D5', dur: 0.12 }, { note: 'G5', dur: 0.24 },
];

const BGM_BASS = [
  { note: 'C4', dur: 0.48 }, { note: 'C4', dur: 0.48 }, { note: 'G4', dur: 0.48 }, { note: 'G4', dur: 0.48 },
];

const MERGE_NOTES = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'G5'];

export class AudioManager {
  private static instance: AudioManager | null = null;
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmStep = 0;
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
    void this.playTone(400, 0.08, 'sine', 0.15, -800);
  }

  playMerge(tierIndex: number, isMaxTier: boolean): void {
    if (!this.sfxEnabled) return;
    const note = MERGE_NOTES[Math.min(tierIndex, MERGE_NOTES.length - 1)];
    const freq = NOTE[note] ?? 440;
    void this.playTone(freq, isMaxTier ? 0.25 : 0.12, 'triangle', isMaxTier ? 0.3 : 0.2);
    if (isMaxTier) {
      void this.playTone(freq * 1.25, 0.2, 'sine', 0.15, 0, 0.05);
      void this.playTone(freq * 1.5, 0.2, 'sine', 0.12, 0, 0.08);
    }
  }

  playGameOver(): void {
    if (!this.sfxEnabled) return;
    void this.playTone(350, 0.4, 'sawtooth', 0.2, -600);
  }

  private async ensureContext(): Promise<AudioContext> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.18;
      this.sfxGain.gain.value = 0.35;
      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private startBgmLoop(): void {
    this.stopBgmLoop();
    if (!this.musicEnabled || !this.bgmRunning) return;

    const tick = () => {
      if (!this.bgmRunning || !this.musicEnabled) return;
      const mel = BGM_MELODY[this.bgmStep % BGM_MELODY.length];
      const bass = BGM_BASS[Math.floor(this.bgmStep / 4) % BGM_BASS.length];
      void this.playBgmNote(NOTE[mel.note] ?? 440, mel.dur, 'square', 0.06);
      if (this.bgmStep % 2 === 0) {
        void this.playBgmNote(NOTE[bass.note] ?? 130, bass.dur, 'triangle', 0.1);
      }
      this.bgmStep++;
    };

    tick();
    this.bgmTimer = setInterval(tick, 120);
  }

  private stopBgmLoop(): void {
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private async playBgmNote(freq: number, dur: number, type: OscillatorType, volume: number): Promise<void> {
    const ctx = await this.ensureContext();
    if (!this.bgmGain || ctx.state !== 'running') return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.bgmGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private async playTone(
    freq: number,
    dur: number,
    type: OscillatorType,
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
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqSlide !== 0) {
      osc.frequency.linearRampToValueAtTime(Math.max(50, freq + freqSlide), t + dur);
    }
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
}

export const audioManager = AudioManager.getInstance();
