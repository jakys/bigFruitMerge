export type GameMode = 'default' | 'custom';

export type AppScreen = 'menu' | 'upload' | 'game';

export type GamePhase = 'playing' | 'gameover';

export interface FruitTier {
  index: number;
  name: string;
  radius: number;
  color: string;
  emoji: string;
  imageUrl?: string;
  imageBitmap?: ImageBitmap;
}

export interface CustomImageEntry {
  blob: Blob;
  width: number;
  height: number;
  sortIndex: number;
  name: string;
}

export interface CustomFruitSet {
  id: 'current';
  images: CustomImageEntry[];
  createdAt: number;
}

export interface FruitBodyMeta {
  tierIndex: number;
  mergeCooldownUntil: number;
  bodyId: number;
}

export interface MergeEvent {
  tierIndex: number;
  x: number;
  y: number;
  isMaxTier: boolean;
}

export interface GameCallbacks {
  onScoreChange: (score: number) => void;
  onGameOver: (score: number) => void;
  onMerge: (event: MergeEvent) => void;
}
