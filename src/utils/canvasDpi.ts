/** 高 DPI Canvas 设置，保证移动端清晰 */
export function setupCanvasDpi(canvas: HTMLCanvasElement, logicalWidth: number, logicalHeight: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(logicalWidth * dpr);
  canvas.height = Math.round(logicalHeight * dpr);
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  }
  return dpr;
}

export function setupPreviewCanvasDpi(canvas: HTMLCanvasElement, logicalSize: number): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(logicalSize * dpr);
  canvas.height = Math.round(logicalSize * dpr);
  canvas.style.width = `${logicalSize}px`;
  canvas.style.height = `${logicalSize}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
}

/** 将屏幕坐标映射到游戏逻辑坐标 */
export function clientXToGameX(canvas: HTMLCanvasElement, clientX: number, logicalWidth: number): number {
  const rect = canvas.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * logicalWidth;
}
