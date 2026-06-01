import './style.css';
import { GAME_CONFIG } from './config/gameConfig.ts';
import { buildCustomFruitTiers, getDefaultFruitTiers } from './config/defaultFruits.ts';
import { GameEngine } from './game/GameEngine.ts';
import { loadCustomFruitSet } from './storage/imageStore.ts';
import type { CustomImageEntry, FruitTier } from './types/index.ts';
import { bindBackButton, createGameHUD } from './ui/GameHUD.ts';
import { showGameOverModal, removeGameOverModal } from './ui/GameOverModal.ts';
import { createMainMenu, removeScreen } from './ui/MainMenu.ts';
import { createUploadPanel } from './ui/UploadPanel.ts';

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

  const gameWrap = document.createElement('div');
  gameWrap.className = 'game-wrap';

  canvasEl = document.createElement('canvas');
  canvasEl.width = GAME_CONFIG.width;
  canvasEl.height = GAME_CONFIG.height;
  canvasEl.className = 'game-canvas';

  gameWrap.appendChild(canvasEl);
  app.appendChild(gameWrap);

  hudController = createGameHUD(app);
  bindBackButton(hudController.el, () => {
    if (confirm('确定返回主菜单？当前进度将丢失。')) showMenu();
  });

  gameEngine = new GameEngine(canvasEl, {
    onScoreChange: (score) => updateHUD(score),
    onGameOver: (score) => {
      gameOverEl = showGameOverModal(app, score, {
        onRestart: () => startGame(),
        onMenu: showMenu,
      });
    },
    onMerge: () => updateHUD(),
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
  const onMove = (clientX: number) => gameEngine?.handlePointerMove(clientX, 0);
  const onDrop = () => gameEngine?.handleDrop();

  canvas.addEventListener('mousemove', (e) => onMove(e.clientX));
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches[0]) onMove(e.touches[0].clientX);
  }, { passive: false });
  canvas.addEventListener('click', onDrop);
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    onDrop();
  });
}

void init();
