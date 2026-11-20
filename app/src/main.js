import { PANEL_LAYOUT, createDefaultPanelStates, gradeName, renderCover } from './cover.js';

const canvas = document.querySelector('#coverCanvas');
const panelStrip = document.querySelector('#panelStrip');
const photoInput = document.querySelector('#photoInput');
const photoTray = document.querySelector('#photoTray');
const photoStatus = document.querySelector('#photoStatus');
const captionInput = document.querySelector('#captionInput');
const characterCount = document.querySelector('#characterCount');
const zoomRange = document.querySelector('#zoomRange');
const zoomValue = document.querySelector('#zoomValue');
const gradeGrid = document.querySelector('#gradeGrid');
const gradeLabel = document.querySelector('#gradeLabel');
const activePanelLabel = document.querySelector('#activePanelLabel');
const canvasDimensions = document.querySelector('#canvasDimensions');
const saveStatus = document.querySelector('#saveStatus');
const exportButton = document.querySelector('#exportButton');
const exportDialog = document.querySelector('#exportDialog');
const exportStatus = document.querySelector('#exportStatus');
const resetButton = document.querySelector('#resetButton');

const state = {
  images: [],
  panels: createDefaultPanelStates(),
  activePanel: 0,
  caption: captionInput.value,
  grade: 'archive',
};

let dragSession = null;

function loadImage(source, name) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, name });
    image.onerror = () => reject(new Error(`Could not load ${name}`));
    image.src = source;
  });
}

function setStatus(message) {
  const dot = saveStatus.querySelector('.status-dot');
  saveStatus.textContent = '';
  if (dot) saveStatus.append(dot);
  saveStatus.append(document.createTextNode(message));
}

function currentPanel() {
  return state.panels[state.activePanel];
}

function updateCaptionCount() {
  characterCount.textContent = `${state.caption.length} / 34`;
}

function updatePanelReadout() {
  const panel = PANEL_LAYOUT[state.activePanel];
  activePanelLabel.textContent = `${panel.label} / panel ${String(state.activePanel + 1).padStart(2, '0')}`;
  const active = currentPanel();
  const zoom = Math.round(active.zoom * 100);
  zoomRange.value = String(zoom);
  zoomValue.textContent = `${zoom}%`;
  canvasDimensions.textContent = '1080 × 1080';
}

function updateSlotSources() {
  panelStrip.querySelectorAll('.panel-slot').forEach((slot, index) => {
    const source = state.images[state.panels[index].imageIndex];
    const label = slot.querySelector('.slot-source');
    if (label) label.textContent = source?.name ?? 'No photo';
  });
}

function draw() {
  renderCover({
    canvas,
    images: state.images,
    panels: state.panels,
    caption: state.caption,
    grade: state.grade,
    activePanel: state.activePanel,
    size: 1080,
  });
}

function setActivePanel(index) {
  if (!PANEL_LAYOUT[index]) return;
  state.activePanel = index;
  panelStrip.querySelectorAll('.panel-slot').forEach((slot) => slot.classList.toggle('is-active', Number(slot.dataset.panel) === index));
  updatePanelReadout();
  renderPhotoTray();
  draw();
}

function renderPhotoTray() {
  photoTray.replaceChildren();
  state.images.forEach((source, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-thumb';
    button.classList.toggle('is-active', currentPanel().imageIndex === index);
    button.dataset.photo = String(index);
    button.setAttribute('aria-label', `Use ${source.name} in the active panel`);

    const image = document.createElement('img');
    image.src = source.image.src;
    image.alt = source.name;
    const label = document.createElement('span');
    label.textContent = source.name;
    button.append(image, label);
    button.addEventListener('click', () => {
      currentPanel().imageIndex = index;
      updateSlotSources();
      renderPhotoTray();
      setStatus('Draft updated');
      draw();
    });
    photoTray.append(button);
  });
}

function panelAtPoint(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  return PANEL_LAYOUT.findIndex((panel) => x >= panel.x && x <= panel.x + panel.w && y >= panel.y && y <= panel.y + panel.h);
}

function panBy(dx, dy) {
  const panel = currentPanel();
  panel.panX = Math.max(-1, Math.min(1, panel.panX + dx));
  panel.panY = Math.max(-1, Math.min(1, panel.panY + dy));
  setStatus('Draft updated');
  draw();
}

async function addPhotoFiles(files) {
  const incoming = Array.from(files);
  if (incoming.length === 0) return;
  photoStatus.textContent = 'Loading local photos…';
  const loaded = await Promise.all(incoming.map((file) => loadImage(URL.createObjectURL(file), file.name).catch(() => null)));
  const valid = loaded.filter(Boolean);
  state.images.push(...valid);
  if (valid.length > 0) {
    photoStatus.textContent = `${state.images.length} photos ready. Select one for the active panel.`;
    renderPhotoTray();
    updateSlotSources();
    setStatus('Draft updated');
    draw();
  } else {
    photoStatus.textContent = 'Those files could not be read. Try a JPEG, PNG, or WebP.';
  }
}

function updateGrade(grade) {
  state.grade = grade;
  gradeLabel.textContent = gradeName(grade);
  gradeGrid.querySelectorAll('.grade-button').forEach((button) => button.classList.toggle('is-active', button.dataset.grade === grade));
  setStatus('Draft updated');
  draw();
}

function slugifyCaption(value) {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'gold-heist-cover';
}

function renderExport(size) {
  const exportCanvas = document.createElement('canvas');
  renderCover({
    canvas: exportCanvas,
    images: state.images,
    panels: state.panels,
    caption: state.caption,
    grade: state.grade,
    size,
  });
  return new Promise((resolve) => exportCanvas.toBlob(resolve, 'image/png'));
}

async function downloadExport(size) {
  exportStatus.textContent = `Rendering ${size} × ${size}…`;
  const blob = await renderExport(size);
  if (!blob) {
    exportStatus.textContent = 'The browser could not create that image.';
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugifyCaption(state.caption)}-${size}.png`;
  link.click();
  URL.revokeObjectURL(url);
  exportStatus.textContent = `Saved ${size} × ${size} PNG.`;
  setStatus('Export saved');
}

panelStrip.addEventListener('click', (event) => {
  const slot = event.target.closest('[data-panel]');
  if (slot) setActivePanel(Number(slot.dataset.panel));
});

photoInput.addEventListener('change', () => {
  addPhotoFiles(photoInput.files);
  photoInput.value = '';
});

captionInput.addEventListener('input', () => {
  state.caption = captionInput.value;
  updateCaptionCount();
  setStatus('Draft updated');
  draw();
});

zoomRange.addEventListener('input', () => {
  currentPanel().zoom = Number(zoomRange.value) / 100;
  zoomValue.textContent = `${zoomRange.value}%`;
  setStatus('Draft updated');
  draw();
});

gradeGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-grade]');
  if (button) updateGrade(button.dataset.grade);
});

document.querySelectorAll('[data-pan]').forEach((button) => {
  button.addEventListener('click', () => {
    const amount = 0.08;
    const direction = button.dataset.pan;
    panBy(direction === 'left' ? -amount : direction === 'right' ? amount : 0, direction === 'up' ? -amount : direction === 'down' ? amount : 0);
  });
});

canvas.addEventListener('pointerdown', (event) => {
  const hit = panelAtPoint(event);
  if (hit < 0) return;
  setActivePanel(hit);
  dragSession = { x: event.clientX, y: event.clientY, panX: currentPanel().panX, panY: currentPanel().panY };
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragSession) return;
  const bounds = canvas.getBoundingClientRect();
  currentPanel().panX = Math.max(-1, Math.min(1, dragSession.panX + (event.clientX - dragSession.x) / bounds.width * 2));
  currentPanel().panY = Math.max(-1, Math.min(1, dragSession.panY + (event.clientY - dragSession.y) / bounds.height * 2));
  setStatus('Draft updated');
  draw();
});

canvas.addEventListener('pointerup', () => { dragSession = null; });
canvas.addEventListener('pointercancel', () => { dragSession = null; });
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  currentPanel().zoom = Math.max(1, Math.min(2.6, currentPanel().zoom + (event.deltaY < 0 ? 0.05 : -0.05)));
  updatePanelReadout();
  setStatus('Draft updated');
  draw();
}, { passive: false });

exportButton.addEventListener('click', () => {
  exportStatus.textContent = 'Choose a size to save.';
  if (typeof exportDialog.showModal === 'function') exportDialog.showModal();
});

document.querySelectorAll('[data-size]').forEach((button) => {
  button.addEventListener('click', () => downloadExport(Number(button.dataset.size)));
});

resetButton.addEventListener('click', () => {
  state.panels = createDefaultPanelStates();
  state.activePanel = 0;
  state.caption = 'Sunset Heist';
  state.grade = 'archive';
  captionInput.value = state.caption;
  updateCaptionCount();
  updateGrade(state.grade);
  updateSlotSources();
  setActivePanel(0);
  setStatus('Local draft');
});

async function boot() {
  const samples = await Promise.all([
    loadImage('./samples/pier.jpg', 'Pier'),
    loadImage('./samples/boulevard.jpg', 'Boulevard'),
  ]);
  state.images = samples;
  photoStatus.textContent = 'Two local samples are ready. Select a panel, then choose a photo.';
  updateCaptionCount();
  updateSlotSources();
  renderPhotoTray();
  updatePanelReadout();
  draw();
}

boot().catch(() => {
  photoStatus.textContent = 'The sample photos could not be loaded. You can still load local images.';
  updateCaptionCount();
  updatePanelReadout();
  draw();
});
