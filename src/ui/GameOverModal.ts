export interface GameOverModalCallbacks {
  onRestart: () => void;
  onMenu: () => void;
}

export function showGameOverModal(container: HTMLElement, score: number, callbacks: GameOverModalCallbacks): HTMLElement {
  const el = document.createElement('div');
  el.className = 'modal-overlay';
  el.innerHTML = `
    <div class="modal-card">
      <h2>游戏结束</h2>
      <p class="final-score">本局得分: <strong>${score}</strong></p>
      <div class="modal-actions">
        <button class="btn btn-primary" data-action="restart">再来一局</button>
        <button class="btn btn-secondary" data-action="menu">返回菜单</button>
      </div>
    </div>
  `;

  el.querySelector('[data-action="restart"]')?.addEventListener('click', () => {
    el.remove();
    callbacks.onRestart();
  });
  el.querySelector('[data-action="menu"]')?.addEventListener('click', () => {
    el.remove();
    callbacks.onMenu();
  });

  container.appendChild(el);
  return el;
}

export function removeGameOverModal(el: HTMLElement | null): void {
  el?.remove();
}
