import { GAME_CONFIG } from '../config/gameConfig.ts';
import type { CustomImageEntry } from '../types/index.ts';
import { clearCustomFruitSet, loadCustomFruitSet, saveCustomFruitSet, sortAndPrepareImages } from '../storage/imageStore.ts';

export interface UploadPanelCallbacks {
  onBack: () => void;
  onConfirm: (entries: CustomImageEntry[]) => void;
}

export function createUploadPanel(container: HTMLElement, callbacks: UploadPanelCallbacks): HTMLElement {
  const el = document.createElement('div');
  el.className = 'screen upload-screen';
  el.innerHTML = `
    <div class="upload-card">
      <h2>自定义合成链</h2>
      <p class="upload-desc">上传 2~${GAME_CONFIG.maxCustomImages} 张图片，系统将按图片像素面积从小到大自动排序为合成链</p>
      <div class="drop-zone" id="drop-zone">
        <input type="file" id="file-input" accept="image/*" multiple hidden />
        <p>点击或拖拽图片到此处</p>
        <p class="drop-zone-hint">支持 JPG / PNG / WebP / GIF</p>
      </div>
      <div class="preview-list" id="preview-list"></div>
      <div class="upload-actions">
        <button class="btn btn-ghost" data-action="back">返回</button>
        <button class="btn btn-danger-ghost" data-action="clear" style="display:none">清除已保存</button>
        <button class="btn btn-primary" data-action="confirm" disabled>确认并开始</button>
      </div>
    </div>
  `;

  let currentEntries: CustomImageEntry[] = [];
  const previewList = el.querySelector('#preview-list') as HTMLElement;
  const confirmBtn = el.querySelector('[data-action="confirm"]') as HTMLButtonElement;
  const clearBtn = el.querySelector('[data-action="clear"]') as HTMLButtonElement;
  const dropZone = el.querySelector('#drop-zone') as HTMLElement;
  const fileInput = el.querySelector('#file-input') as HTMLInputElement;

  async function handleFiles(files: FileList | File[]): Promise<void> {
    const arr = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (arr.length < GAME_CONFIG.minCustomImages) {
      alert(`请至少选择 ${GAME_CONFIG.minCustomImages} 张图片`);
      return;
    }
    if (arr.length > GAME_CONFIG.maxCustomImages) {
      alert(`最多支持 ${GAME_CONFIG.maxCustomImages} 张图片`);
      return;
    }
    currentEntries = await sortAndPrepareImages(arr);
    renderPreview();
    confirmBtn.disabled = false;
  }

  function renderPreview(): void {
    previewList.innerHTML = '';
    if (currentEntries.length === 0) return;

    const label = document.createElement('p');
    label.className = 'preview-label';
    label.textContent = `已排序（小 → 大），共 ${currentEntries.length} 级：`;
    previewList.appendChild(label);

    const row = document.createElement('div');
    row.className = 'preview-row';
    for (const entry of currentEntries) {
      const item = document.createElement('div');
      item.className = 'preview-item';
      const img = document.createElement('img');
      img.src = URL.createObjectURL(entry.blob);
      img.alt = entry.name;
      const cap = document.createElement('span');
      cap.textContent = `${entry.sortIndex + 1}. ${entry.name}`;
      item.appendChild(img);
      item.appendChild(cap);
      row.appendChild(item);
    }
    previewList.appendChild(row);
  }

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    if (fileInput.files) void handleFiles(fileInput.files);
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer?.files) void handleFiles(e.dataTransfer.files);
  });

  el.querySelector('[data-action="back"]')?.addEventListener('click', callbacks.onBack);
  clearBtn.addEventListener('click', async () => {
    await clearCustomFruitSet();
    clearBtn.style.display = 'none';
    alert('已清除保存的自定义图片');
  });
  confirmBtn.addEventListener('click', async () => {
    if (currentEntries.length < GAME_CONFIG.minCustomImages) return;
    await saveCustomFruitSet(currentEntries);
    callbacks.onConfirm(currentEntries);
  });

  void loadCustomFruitSet().then((saved) => {
    if (saved) clearBtn.style.display = 'inline-flex';
  });

  container.appendChild(el);
  return el;
}
