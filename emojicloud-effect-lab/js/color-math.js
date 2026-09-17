/**
 * Effect Lab - Color Space Mathematics & 3D Color LUT Engine
 */

function rgbToLab(r, g, b) {
  let rL = r / 255;
  let gL = g / 255;
  let bL = b / 255;

  rL = rL <= 0.04045 ? rL / 12.92 : Math.pow((rL + 0.055) / 1.055, 2.4);
  gL = gL <= 0.04045 ? gL / 12.92 : Math.pow((gL + 0.055) / 1.055, 2.4);
  bL = bL <= 0.04045 ? bL / 12.92 : Math.pow((bL + 0.055) / 1.055, 2.4);

  let x = (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) / 0.95047;
  let y = (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) / 1.00000;
  let z = (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) / 1.08883;

  const f = (v) => v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + (16 / 116);
  let fx = f(x), fy = f(y), fz = f(z);

  return [(116 * fy) - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function initColorLutTables() {
  for (let b = 0; b < LUT_RES; b++) {
    for (let r = 0; r < LUT_RES; r++) {
      for (let g = 0; g < LUT_RES; g++) {
        const pIdx = b * 256 + (r * 16 + g);
        const qR = Math.round((r / 15) * 255);
        const qG = Math.round((g / 15) * 255);
        const qB = Math.round((b / 15) * 255);
        const lab = rgbToLab(qR, qG, qB);
        voxelLabL[pIdx] = lab[0];
        voxelLabA[pIdx] = lab[1];
        voxelLabB[pIdx] = lab[2];
      }
    }
  }
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  v = Math.max(0, Math.min(1, v));
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255)
  ];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return [h, s, v];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return null;
  let c = hex.replace('#', '').trim();
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  if (c.length !== 6) return null;
  const num = parseInt(c, 16);
  if (isNaN(num)) return null;
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rebuildColorLUT(exclusionInput, forcedInput, useForcedInput) {
  if (!lutTexture || !emojiLabL || numAtlasEmojis === 0) return;

  if (exclusionInput !== undefined && typeof exclusionInput === 'string') {
    excludedIndicesSet = parseTokenIndices(exclusionInput);
  }
  if (forcedInput !== undefined && typeof forcedInput === 'string') {
    forcedIndicesSet = parseTokenIndices(forcedInput);
  }
  if (useForcedInput !== undefined) {
    params.useForced = useForcedInput;
  }

  let pool = [];

  if (params.useForced && forcedIndicesSet.size > 0) {
    for (const idx of forcedIndicesSet) {
      if (!excludedIndicesSet.has(idx)) {
        pool.push(idx);
      }
    }
    if (pool.length === 0) {
      pool = Array.from(forcedIndicesSet);
    }
  } else {
    for (let i = 0; i < numAtlasEmojis; i++) {
      if (!excludedIndicesSet.has(i)) {
        pool.push(i);
      }
    }
    if (pool.length === 0) {
      pool = Array.from({ length: numAtlasEmojis }, (_, i) => i);
    }
  }

  const poolLen = pool.length;

  for (let pIdx = 0; pIdx < 4096; pIdx++) {
    let vL = voxelLabL[pIdx];
    let va = voxelLabA[pIdx];
    let vb = voxelLabB[pIdx];

    if (params.gradientMap3D && typeof gradientEngine !== 'undefined' && gradientEngine) {
      const r = Math.floor((pIdx % 256) / 16);
      const g = pIdx % 16;
      const b = Math.floor(pIdx / 256);
      const qR = r / 15;
      const qG = g / 15;
      const qB = b / 15;
      const lum = Math.max(0, Math.min(1, 0.299 * qR + 0.587 * qG + 0.114 * qB));
      const [gr, gg, gb] = gradientEngine.getColorAt(lum);
      const gLab = rgbToLab(gr, gg, gb);
      vL = gLab[0];
      va = gLab[1];
      vb = gLab[2];
    }

    let bestIdx = pool[0];
    let minD = 1e12;

    for (let p = 0; p < poolLen; p++) {
      const idx = pool[p];
      const dL = vL - emojiLabL[idx];
      const da = va - emojiLabA[idx];
      const db = vb - emojiLabB[idx];
      const dist = dL * dL + da * da + db * db;

      if (dist < minD) {
        minD = dist;
        bestIdx = idx;
      }
    }

    const byteOff = pIdx * 4;
    lutBuffer[byteOff] = emojiCols[bestIdx];
    lutBuffer[byteOff + 1] = emojiRows[bestIdx];
    lutBuffer[byteOff + 2] = 0;
    lutBuffer[byteOff + 3] = 255;
  }

  try {
    const pixels = lutTexture.lock();
    pixels.set(lutBuffer);
    lutTexture.unlock();
  } catch (err) {
    console.warn('[Effect Lab] Erro ao atualizar textura LUT:', err);
  }

  params.activeEmojisCount = `${poolLen} / ${numAtlasEmojis}`;
  params.excludedCount = `${excludedIndicesSet.size}`;
  params.forcedCount = `${forcedIndicesSet.size}${params.useForced ? '' : ' (desativado)'}`;

  if (typeof guiControllers !== 'undefined') {
    if (guiControllers.activeEmojisCount) guiControllers.activeEmojisCount.updateDisplay();
    if (guiControllers.excludedCount) guiControllers.excludedCount.updateDisplay();
    if (guiControllers.forcedCount) guiControllers.forcedCount.updateDisplay();
  }
}
