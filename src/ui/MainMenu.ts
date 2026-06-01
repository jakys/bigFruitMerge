export interface MainMenuCallbacks {
  onDefaultMode: () => void;
  onCustomMode: () => void;
  onContinueCustom: () => void;
  hasCustomSet: boolean;
}

export function createMainMenu(container: HTMLElement, callbacks: MainMenuCallbacks): HTMLElement {
  const el = document.createElement('div');
  el.className = 'screen menu-screen';
  el.innerHTML = `
    <div class="menu-card">
      <h1 class="title">合成大西瓜</h1>
      <p class="subtitle">相同等级的水果碰撞即可合成更大一级</p>
      <div class="menu-buttons">
        <button class="btn btn-primary" data-action="default">默认模式</button>
        <button class="btn btn-secondary" data-action="custom">自定义图片</button>
        ${callbacks.hasCustomSet ? '<button class="btn btn-accent" data-action="continue">继续自定义模式</button>' : ''}
      </div>
      <p class="hint">移动鼠标/手指控制位置，点击释放掉落</p>
    </div>
  `;

  el.querySelector('[data-action="default"]')?.addEventListener('click', callbacks.onDefaultMode);
  el.querySelector('[data-action="custom"]')?.addEventListener('click', callbacks.onCustomMode);
  el.querySelector('[data-action="continue"]')?.addEventListener('click', callbacks.onContinueCustom);

  container.appendChild(el);
  return el;
}

export function removeScreen(el: HTMLElement | null): void {
  el?.remove();
}
