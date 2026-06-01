export type BgmPresetId =
  | 'alphaSleep'
  | 'whiteNoise'
  | 'pentatonic'
  | 'lofi'
  | 'ambient'
  | 'classicV1'
  | 'suikaPop'
  | 'hyperMerge'
  | 'chipDance'
  | 'funkyLoop';

export type SfxPresetId = 'soft' | 'asmr' | 'bubble' | 'zen' | 'retro';

export interface BgmPresetInfo {
  id: BgmPresetId;
  label: string;
}

export interface SfxPresetInfo {
  id: SfxPresetId;
  label: string;
}

export const BGM_PRESETS: BgmPresetInfo[] = [
  { id: 'alphaSleep', label: '助眠阿尔法' },
  { id: 'whiteNoise', label: '白噪音' },
  { id: 'pentatonic', label: '五声悠扬' },
  { id: 'lofi', label: 'Lo-Fi 慢节奏' },
  { id: 'ambient', label: '空境环境' },
  { id: 'classicV1', label: '经典魔性V1' },
  { id: 'suikaPop', label: '合成Pop' },
  { id: 'hyperMerge', label: '超魔性循环' },
  { id: 'chipDance', label: '芯片舞曲' },
  { id: 'funkyLoop', label: '放克律动' },
];

export const SFX_PRESETS: SfxPresetInfo[] = [
  { id: 'soft', label: '柔和' },
  { id: 'asmr', label: 'ASMR' },
  { id: 'bubble', label: '气泡' },
  { id: 'zen', label: '禅意磬' },
  { id: 'retro', label: '复古轻音' },
];

export interface BgmSession {
  stop: () => void;
}

export interface SfxContext {
  ctx: AudioContext;
  destination: AudioNode;
}

export interface SfxPreset {
  playDrop(api: SfxContext): void;
  playMerge(api: SfxContext, tierIndex: number, isMaxTier: boolean): void;
  playGameOver(api: SfxContext): void;
}
