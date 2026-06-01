import './style.css';
import { audioManager } from './audio/AudioManager.ts';
import { GAME_CONFIG } from './config/gameConfig.ts';
import { buildCustomFruitTiers, getDefaultFruitTiers } from './config/defaultFruits.ts';
import { GameEngine } from './game/GameEngine.ts';
import { loadCustomFruitSet } from './storage/imageStore.ts';
import type { CustomImageEntry, FruitTier, MergeEvent } from './types/index.ts';
import { createGameHUD } from './ui/GameHUD.ts';
import { showGameOverModal, removeGameOverModal } from './ui/GameOverModal.ts';
import { createMainMenu, removeScreen } from './ui/MainMenu.ts';
import { createUploadPanel } from './ui/UploadPanel.ts';
import { setupCanvasDpi } from './utils/canvasDpi.ts';

const app = document.querySelector<HTMLDivElement>('#app')!;
let screenEl: HTMLElement | null = null;
let gameOverEl: HTMLElement | null = null;
let gameEngine: GameEngine | null = null;
let hudController: ReturnType<typeof createGameHUD> | null = null;
let canvasEl: HTMLCanvasElement | null = null;
let fruitTiers: FruitTier[] = getDefaultFruitTiers();
let hasCustomSet = false;

async function init(): Promise<void> {
  const saved = await loadCustomFruitSet();
  hasCustomSet = saved !== null && saved.images.length >= 2;
  showMenu();
}

function clearGame(): void {
  audioManager.stopBgm();
  gameEngine?.destroy();
  gameEngine = null;
  canvasEl = null;
  hudController = null;
  removeGameOverModal(gameOverEl);
  gameOverEl = null;
}

function showMenu(): void {
  clearGame();
  app.innerHTML = '';
  screenEl = createMainMenu(app, {
    hasCustomSet,
    onDefaultMode: () => {
      fruitTiers = getDefaultFruitTiers();
      startGame();
    },
    onCustomMode: () => showUpload(),
    onContinueCustom: () => {
      void startCustomGameFromStorage();
    },
  });
}

function showUpload(): void {
  clearGame();
  removeScreen(screenEl);
  app.innerHTML = '';
  screenEl = createUploadPanel(app, {
    onBack: showMenu,
    onConfirm: (entries) => {
      void startCustomGame(entries);
    },
  });
}

async function startCustomGameFromStorage(): Promise<void> {
  const saved = await loadCustomFruitSet();
  if (!saved) {
    showUpload();
    return;
  }
  await startCustomGame(saved.images);
}

async function startCustomGame(entries: CustomImageEntry[]): Promise<void> {
  const bitmaps = new Map<number, ImageBitmap>();
  for (const entry of entries) {
    const bitmap = await createImageBitmap(entry.blob);
    bitmaps.set(entry.sortIndex, bitmap);
  }

  fruitTiers = buildCustomFruitTiers(
    entries.map((e) => ({
      width: e.width,
      height: e.height,
      name: e.name,
      imageBitmap: bitmaps.get(e.sortIndex),
    })),
  );
  hasCustomSet = true;
  startGame();
}

function startGame(): void {
  clearGame();
  removeScreen(screenEl);
  app.innerHTML = '';

  const gameScreen = document.createElement('div');
  gameScreen.className = 'game-screen';

  hudController = createGameHUD(gameScreen, {
    onBack: () => {
      if (confirm('确定返回主菜单？当前进度将丢失。')) showMenu();
    },
  });

  const gameWrap = document.createElement('div');
  gameWrap.className = 'game-wrap';

  canvasEl = document.createElement('canvas');
  canvasEl.className = 'game-canvas';
  setupCanvasDpi(canvasEl, GAME_CONFIG.width, GAME_CONFIG.height);

  gameWrap.appendChild(canvasEl);
  gameScreen.appendChild(gameWrap);

  const hint = document.createElement('p');
  hint.className = 'game-hint';
  hint.textContent = '手指按住定位 · 松手释放';
  gameScreen.appendChild(hint);

  app.appendChild(gameScreen);

  gameEngine = new GameEngine(canvasEl, {
    onScoreChange: (score) => updateHUD(score),
    onGameOver: (score) => {
      audioManager.playGameOver();
      audioManager.stopBgm();
      gameOverEl = showGameOverModal(app, score, {
        onRestart: () => startGame(),
        onMenu: showMenu,
      });
    },
    onMerge: (event: MergeEvent) => {
      audioManager.playMerge(event.tierIndex, event.isMaxTier);
      updateHUD();
    },
  });

  setupInput(canvasEl);

  const hudLoop = () => {
    if (!gameEngine || !hudController) return;
    const hudState = gameEngine.shouldUpdateHud();
    if (hudState) {
      hudController.update({
        score: hudState.score,
        nextTier: fruitTiers[hudState.tierIndex] ?? null,
      });
    }
    if (gameEngine.getPhysics()) requestAnimationFrame(hudLoop);
  };
  requestAnimationFrame(hudLoop);

  gameEngine.start(fruitTiers);
  updateHUD(0);
}

function updateHUD(score?: number): void {
  if (!hudController || !gameEngine) return;
  const physics = gameEngine.getPhysics();
  const currentScore = score ?? gameEngine.getScoreManager().getScore();
  const tierIndex = physics?.getCurrentDropTier() ?? 0;
  hudController.update({
    score: currentScore,
    nextTier: fruitTiers[tierIndex] ?? null,
  });
}

function setupInput(canvas: HTMLCanvasElement): void {
  let lastTouchEnd = 0;

  /** 首次交互启动 BGM，之后只恢复上下文，不重头播放 */
  const startBgmOnce = () => {
    void audioManager.startBgm();
  };

  const onMove = (clientX: number) => gameEngine?.handlePointerMove(clientX, 0);
  const onDrop = () => {
    void audioManager.resumeContext();
    audioManager.playDrop();
    gameEngine?.handleDrop();
  };

  canvas.addEventListener('mousemove', (e) => onMove(e.clientX));
  canvas.addEventListener('mousedown', (e) => {
    startBgmOnce();
    onMove(e.clientX);
  });
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startBgmOnce();
    if (e.touches[0]) onMove(e.touches[0].clientX);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches[0]) onMove(e.touches[0].clientX);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    lastTouchEnd = Date.now();
    onDrop();
  });
  canvas.addEventListener('click', () => {
    if (Date.now() - lastTouchEnd < 400) return;
    startBgmOnce();
    onDrop();
  });
}

void init();
