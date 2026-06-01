import { BGM_STARTERS } from './bgmPresets.ts';
import { SFX_PRESETS } from './sfxPresets.ts';
import {
  BGM_PRESETS,
  SFX_PRESETS as SFX_PRESET_LIST,
  type BgmPresetId,
  type BgmSession,
  type SfxPresetId,
} from './audioTypes.ts';

const STORAGE_SFX = 'daxigua-sfx-enabled';
const STORAGE_MUSIC = 'daxigua-music-enabled';
const STORAGE_BGM_PRESET = 'daxigua-bgm-preset';
const STORAGE_SFX_PRESET = 'daxigua-sfx-preset';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private bgmMasterFilter: BiquadFilterNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmSession: BgmSession | null = null;
  private bgmActive = false;
  private bgmRunning = false;
  private sfxEnabled = true;
  private musicEnabled = true;
  private bgmPresetId: BgmPresetId = 'alphaSleep';
  private sfxPresetId: SfxPresetId = 'soft';

  private constructor() {
    this.sfxEnabled = localStorage.getItem(STORAGE_SFX) !== 'false';
    this.musicEnabled = localStorage.getItem(STORAGE_MUSIC) !== 'false';
    const savedBgm = localStorage.getItem(STORAGE_BGM_PRESET) as BgmPresetId | null;
    const savedSfx = localStorage.getItem(STORAGE_SFX_PRESET) as SfxPresetId | null;
    if (savedBgm && BGM_STARTERS[savedBgm]) this.bgmPresetId = savedBgm;
    if (savedSfx && SFX_PRESETS[savedSfx]) this.sfxPresetId = savedSfx;
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  getBgmPresetId(): BgmPresetId {
    return this.bgmPresetId;
  }

  getSfxPresetId(): SfxPresetId {
    return this.sfxPresetId;
  }

  getBgmPresets() {
    return BGM_PRESETS;
  }

  getSfxPresets() {
    return SFX_PRESET_LIST;
  }

  setBgmPreset(id: BgmPresetId): void {
    if (!BGM_STARTERS[id]) return;
    this.bgmPresetId = id;
    localStorage.setItem(STORAGE_BGM_PRESET, id);
    if (this.bgmRunning && this.musicEnabled) {
      void this.ensureContext().then(() => this.startBgmLoop());
    }
  }

  setSfxPreset(id: SfxPresetId): void {
    if (!SFX_PRESETS[id]) return;
    this.sfxPresetId = id;
    localStorage.setItem(STORAGE_SFX_PRESET, id);
  }

  cycleBgmPreset(): BgmPresetId {
    const list = BGM_PRESETS;
    const idx = list.findIndex((p) => p.id === this.bgmPresetId);
    const next = list[(idx + 1) % list.length].id;
    this.setBgmPreset(next);
    return next;
  }

  cycleSfxPreset(): SfxPresetId {
    const list = SFX_PRESET_LIST;
    const idx = list.findIndex((p) => p.id === this.sfxPresetId);
    const next = list[(idx + 1) % list.length].id;
    this.setSfxPreset(next);
    return next;
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
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async startBgm(): Promise<void> {
    if (!this.musicEnabled) return;
    await this.unlock();
    if (this.bgmActive) return;
    this.bgmRunning = true;
    this.startBgmLoop();
  }

  /** 仅恢复 AudioContext，不重启 BGM */
  async resumeContext(): Promise<void> {
    await this.unlock();
  }

  isBgmPlaying(): boolean {
    return this.bgmActive;
  }

  stopBgm(): void {
    this.bgmRunning = false;
    this.bgmActive = false;
    this.stopBgmLoop();
  }

  playDrop(): void {
    if (!this.sfxEnabled) return;
    void this.withSfx((api) => SFX_PRESETS[this.sfxPresetId].playDrop(api));
  }

  playMerge(tierIndex: number, isMaxTier: boolean): void {
    if (!this.sfxEnabled) return;
    void this.withSfx((api) => SFX_PRESETS[this.sfxPresetId].playMerge(api, tierIndex, isMaxTier));
  }

  playGameOver(): void {
    if (!this.sfxEnabled) return;
    void this.withSfx((api) => SFX_PRESETS[this.sfxPresetId].playGameOver(api));
  }

  private async withSfx(fn: (api: { ctx: AudioContext; destination: AudioNode }) => void): Promise<void> {
    const ctx = await this.ensureContext();
    if (!this.sfxGain) return;
    if (ctx.state === 'suspended') await ctx.resume();
    fn({ ctx, destination: this.sfxGain });
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
      sfxFilter.frequency.value = 2200;
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
      const starter = BGM_STARTERS[this.bgmPresetId];
      if (starter) {
        this.bgmSession = starter(ctx, this.bgmGain);
        this.bgmActive = true;
      }
    });
  }

  private stopBgmLoop(): void {
    this.bgmSession?.stop();
    this.bgmSession = null;
    this.bgmActive = false;
  }
}

export const audioManager = AudioManager.getInstance();
