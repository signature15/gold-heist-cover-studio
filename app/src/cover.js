const PANEL_GUTTER = 0.018;

export const PANEL_LAYOUT = [
  { x: 0, y: 0, w: 0.64, h: 0.62, label: 'Hero' },
  { x: 0.658, y: 0, w: 0.342, h: 0.302, label: 'Lookout' },
  { x: 0.658, y: 0.32, w: 0.342, h: 0.302, label: 'Getaway' },
  { x: 0, y: 0.64, w: 0.308, h: 0.36, label: 'Trace' },
  { x: 0.326, y: 0.64, w: 0.308, h: 0.36, label: 'Alibi' },
  { x: 0.658, y: 0.64, w: 0.342, h: 0.36, label: 'Witness' },
];

const GRADES = {
  archive: {
    name: 'Archive',
    dark: [8, 8, 7],
    light: [215, 171, 77],
    contrast: 1.12,
  },
  noir: {
    name: 'Noir',
    dark: [8, 9, 9],
    light: [218, 211, 192],
    contrast: 1.3,
  },
  xerox: {
    name: 'Xerox',
    dark: [9, 9, 8],
    light: [238, 230, 203],
    contrast: 1.52,
  },
  sunset: {
    name: 'Sunset',
    dark: [22, 8, 7],
    light: [222, 117, 65],
    contrast: 1.1,
  },
};

export function createDefaultPanelStates() {
  return PANEL_LAYOUT.map((_, index) => ({ imageIndex: index % 2, zoom: 1, panX: 0, panY: 0 }));
}

function imageCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function coverSourceRect(image, width, height, zoom, panX, panY) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const extraX = drawWidth - width;
  const extraY = drawHeight - height;
  const x = (width - drawWidth) / 2 + clamp(panX, -1, 1) * extraX * 0.5;
  const y = (height - drawHeight) / 2 + clamp(panY, -1, 1) * extraY * 0.5;
  return { x, y, width: drawWidth, height: drawHeight };
}

function gradePixels(context, grade) {
  const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
  const pixels = imageData.data;
  const { dark, light, contrast } = GRADES[grade] ?? GRADES.archive;
  for (let index = 0; index < pixels.length; index += 4) {
    const luma = (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
    const shaped = clamp((luma - 0.5) * contrast + 0.5, 0, 1);
    const ink = shaped * shaped * (3 - 2 * shaped);
    pixels[index] = dark[0] + (light[0] - dark[0]) * ink;
    pixels[index + 1] = dark[1] + (light[1] - dark[1]) * ink;
    pixels[index + 2] = dark[2] + (light[2] - dark[2]) * ink;
  }
  context.putImageData(imageData, 0, 0);
}

function drawPanel(context, image, box, panel, grade) {
  const width = Math.max(1, Math.round(box.width));
  const height = Math.max(1, Math.round(box.height));
  const scratch = imageCanvas(width, height);
  const scratchContext = scratch.getContext('2d', { willReadFrequently: true });
  const source = coverSourceRect(image, width, height, panel.zoom, panel.panX, panel.panY);
  scratchContext.imageSmoothingEnabled = true;
  scratchContext.imageSmoothingQuality = 'high';
  scratchContext.fillStyle = '#080807';
  scratchContext.fillRect(0, 0, width, height);
  scratchContext.drawImage(image, source.x, source.y, source.width, source.height);
  gradePixels(scratchContext, grade);
  context.drawImage(scratch, box.x, box.y, box.width, box.height);
}

function fitText(context, text, maxWidth, startSize, family) {
  let size = startSize;
  context.font = `900 ${size}px ${family}`;
  while (context.measureText(text).width > maxWidth && size > 18) {
    size -= 2;
    context.font = `900 ${size}px ${family}`;
  }
  return size;
}

function drawCoverType(context, size, caption) {
  const gold = '#d7ab4d';
  const ink = '#090908';
  const margin = size * 0.045;
  const titleSize = Math.max(18, Math.round(size * 0.034));
  context.save();
  context.fillStyle = gold;
  context.font = `800 ${titleSize}px Arial Narrow, Arial, sans-serif`;
  context.letterSpacing = `${Math.round(size * 0.004)}px`;
  context.fillText('GOLD HEIST', margin, margin + titleSize);
  context.font = `700 ${Math.max(10, Math.round(size * 0.011))}px Arial, sans-serif`;
  context.fillText('CASE FILE / 06 PANELS / LOCAL ONLY', margin, margin + titleSize * 1.85);

  const cleanCaption = caption.trim() || 'Sunset Heist';
  const captionSize = fitText(context, cleanCaption.toUpperCase(), size * 0.78, size * 0.13, 'Impact, Arial Narrow, sans-serif');
  const bandHeight = captionSize * 1.38;
  const bandY = size - margin - bandHeight;
  context.fillStyle = ink;
  context.fillRect(margin * 0.55, bandY, size - margin * 1.1, bandHeight);
  context.fillStyle = gold;
  context.font = `900 ${captionSize}px Impact, Arial Narrow, sans-serif`;
  context.letterSpacing = `${Math.round(size * 0.002)}px`;
  context.textBaseline = 'middle';
  context.fillText(cleanCaption.toUpperCase(), margin, bandY + bandHeight * 0.55);

  context.strokeStyle = gold;
  context.lineWidth = Math.max(2, size * 0.004);
  context.strokeRect(margin * 0.55, margin * 0.55, size - margin * 1.1, size - margin * 1.1);
  context.restore();
}

function drawSelection(context, size, activePanel) {
  if (!Number.isInteger(activePanel) || !PANEL_LAYOUT[activePanel]) return;
  const panel = PANEL_LAYOUT[activePanel];
  context.save();
  context.strokeStyle = '#f2c95d';
  context.lineWidth = Math.max(3, size * 0.006);
  context.strokeRect(panel.x * size + context.lineWidth, panel.y * size + context.lineWidth, panel.w * size - context.lineWidth * 2, panel.h * size - context.lineWidth * 2);
  context.restore();
}

export function renderCover({ canvas, images, panels, caption, grade = 'archive', activePanel = -1, size = 1080 }) {
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, size, size);
  context.fillStyle = '#080807';
  context.fillRect(0, 0, size, size);

  PANEL_LAYOUT.forEach((layout, index) => {
    const panel = panels[index] ?? { imageIndex: 0, zoom: 1, panX: 0, panY: 0 };
    const image = images[panel.imageIndex]?.image ?? images[0]?.image;
    if (!image) return;
    const box = {
      x: Math.round(layout.x * size),
      y: Math.round(layout.y * size),
      width: Math.round(layout.w * size),
      height: Math.round(layout.h * size),
    };
    drawPanel(context, image, box, panel, grade);
  });

  context.fillStyle = '#080807';
  const gutter = Math.max(2, Math.round(size * PANEL_GUTTER));
  context.fillRect(0, Math.round(size * 0.62), size, gutter);
  context.fillRect(0, Math.round(size * 0.32), size, gutter);
  context.fillRect(Math.round(size * 0.64), 0, gutter, size);
  context.fillRect(Math.round(size * 0.31), Math.round(size * 0.62), gutter, size * 0.38);
  context.fillRect(Math.round(size * 0.64), Math.round(size * 0.62), gutter, size * 0.38);

  drawCoverType(context, size, caption);
  drawSelection(context, size, activePanel);
  return canvas;
}

export function gradeName(grade) {
  return GRADES[grade]?.name ?? GRADES.archive.name;
}
