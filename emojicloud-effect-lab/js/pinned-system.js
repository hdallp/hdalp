/**
 * Effect Lab - 3D Pinned Emojis, GPU Pin Map, Lasso Tool, Raycasting, Bake & Capture System
 */

// === Lasso Selection (Laço Poligonal / Freehand) ===
let lassoPoints = [];
let isDrawingLasso = false;

function clearLassoCanvas() {
  const lc = document.getElementById('lasso-canvas');
  if (!lc) return;
  const ctx = lc.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, lc.width, lc.height);
}

function drawLassoPolygon(points) {
  const lc = document.getElementById('lasso-canvas');
  if (!lc || !points || points.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const displayW = window.innerWidth;
  const displayH = window.innerHeight;

  if (lc.width !== Math.round(displayW * dpr) || lc.height !== Math.round(displayH * dpr)) {
    lc.width = Math.round(displayW * dpr);
    lc.height = Math.round(displayH * dpr);
  }
  const ctx = lc.getContext('2d');
  if (!ctx) return;

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, displayW, displayH);
  if (points.length < 2) {
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  if (points.length >= 3) {
    ctx.closePath();
    ctx.fillStyle = 'rgba(88, 166, 255, 0.20)';
    ctx.fill();
  }

  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([5, 5]);
  ctx.shadowColor = 'rgba(88, 166, 255, 0.85)';
  ctx.shadowBlur = 8;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.setLineDash([]);
  const step = Math.max(1, Math.floor(points.length / 15));
  for (let i = 0; i < points.length; i += step) {
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function isPointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Projeta um ponto de tela (CSS pixels) para coordenadas locais do modelo via raycasting
function screenToModelLocal(screenX, screenY, selectionRadiusPx) {
  if (!cameraEntity || !splatEntity) return null;

  const canvas = document.getElementById('splat-canvas');
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const canvasX = screenX - rect.left;
  const canvasY = screenY - rect.top;

  const rayWorldPoint = new pc.Vec3();
  cameraEntity.camera.screenToWorld(canvasX, canvasY, 1.0, rayWorldPoint);
  const rayOrigin = cameraEntity.getPosition();
  const rayDir = new pc.Vec3().sub2(rayWorldPoint, rayOrigin).normalize();

  const worldMat = splatEntity.getWorldTransform();
  const sphereWorldCenter = new pc.Vec3();
  worldMat.transformPoint(new pc.Vec3(modelCenter.x, modelCenter.y, modelCenter.z), sphereWorldCenter);
  const sphereRadius = modelRadius > 0 ? modelRadius : 0.5;

  const oc = new pc.Vec3().sub2(rayOrigin, sphereWorldCenter);
  const b = oc.dot(rayDir);
  const c = oc.dot(oc) - sphereRadius * sphereRadius;
  const disc = b * b - c;

  let t;
  if (disc >= 0) {
    const tFront = -b - Math.sqrt(disc);
    const tMid = -b;
    const isLargeSelection = selectionRadiusPx && (selectionRadiusPx > rect.height * 0.25);
    t = isLargeSelection ? tMid : Math.max(0.001, tFront + Math.min(sphereRadius * 0.1, 0.05));
  } else {
    t = Math.max(0.001, -b);
  }

  const hitWorld = new pc.Vec3(
    rayOrigin.x + rayDir.x * t,
    rayOrigin.y + rayDir.y * t,
    rayOrigin.z + rayDir.z * t
  );

  const invWorld = new pc.Mat4();
  invWorld.copy(worldMat);
  invWorld.invert();
  const hitLocal = new pc.Vec3();
  invWorld.transformPoint(hitWorld, hitLocal);

  return hitLocal;
}

function sampleLassoRegion(polygon) {
  if (!polygon || polygon.length < 3 || !cameraEntity || !splatEntity) return null;

  const canvas = document.getElementById('splat-canvas');
  if (!canvas) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polygon.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  });
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  if (boxW < 4 || boxH < 4) return null;

  const rect = canvas.getBoundingClientRect();

  let centers = splatCenters;
  if (!centers && splatEntity && splatEntity.gsplat) {
    const res = splatEntity.gsplat.asset ? splatEntity.gsplat.asset.resource : null;
    if (res) {
      centers = res.centers || (res.gsplatData && res.gsplatData.getCenters ? res.gsplatData.getCenters() : null) || (res.gsplatData ? res.gsplatData.centers : null);
    }
  }

  if (centers && centers.length > 0) {
    try {
      const cam = cameraEntity.camera;
      const worldMat = splatEntity.getWorldTransform();
      const vpMat = new pc.Mat4();
      vpMat.mul2(cam.projectionMatrix, cam.viewMatrix);
      const mvpMat = new pc.Mat4();
      mvpMat.mul2(vpMat, worldMat);
      const m = mvpMat.data;

      const totalSplats = Math.floor(centers.length / 3);
      const matched = [];

      for (let i = 0; i < totalSplats; i++) {
        const x = centers[i * 3];
        const y = centers[i * 3 + 1];
        const z = centers[i * 3 + 2];

        const w = m[3] * x + m[7] * y + m[11] * z + m[15];
        if (w <= 0.001) continue;

        const invW = 1.0 / w;
        const ndcX = (m[0] * x + m[4] * y + m[8] * z + m[12]) * invW;
        const ndcY = (m[1] * x + m[5] * y + m[9] * z + m[13]) * invW;

        const sx = (ndcX * 0.5 + 0.5) * rect.width + rect.left;
        const sy = (-ndcY * 0.5 + 0.5) * rect.height + rect.top;

        if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue;

        if (isPointInPolygon(sx, sy, polygon)) {
          matched.push(i, x, y, z, w);
        }
      }

      if (matched.length >= 5) {
        const numPts = matched.length / 5;
        const isWholeModel = (boxW > rect.width * 0.7) && (boxH > rect.height * 0.7);
        let keepIdx;

        if (!isWholeModel) {
          const order = new Array(numPts);
          for (let j = 0; j < numPts; j++) order[j] = j;
          order.sort((a, b) => matched[a * 5 + 4] - matched[b * 5 + 4]);

          const minW = matched[order[0] * 5 + 4];
          const maxDepthSpan = Math.max(0.08, (Math.max(boxW, boxH) / rect.height) * orbit.distance * 0.7);

          keepIdx = [];
          for (let j = 0; j < numPts; j++) {
            const p = order[j];
            if ((matched[p * 5 + 4] - minW) > maxDepthSpan) break;
            keepIdx.push(p);
          }
        } else {
          keepIdx = new Array(numPts);
          for (let j = 0; j < numPts; j++) keepIdx[j] = j;
        }

        if (keepIdx.length > 0) {
          let sumX = 0, sumY = 0, sumZ = 0;
          for (let j = 0; j < keepIdx.length; j++) {
            const p = keepIdx[j] * 5;
            sumX += matched[p + 1];
            sumY += matched[p + 2];
            sumZ += matched[p + 3];
          }
          const cx = sumX / keepIdx.length;
          const cy = sumY / keepIdx.length;
          const cz = sumZ / keepIdx.length;

          let maxDistSq = 0;
          for (let j = 0; j < keepIdx.length; j++) {
            const p = keepIdx[j] * 5;
            const dx = matched[p + 1] - cx;
            const dy = matched[p + 2] - cy;
            const dz = matched[p + 3] - cz;
            const dSq = dx * dx + dy * dy + dz * dz;
            if (dSq > maxDistSq) maxDistSq = dSq;
          }
          const radius = Math.max(0.02, Math.sqrt(maxDistSq) * 1.08);

          const indices = new Uint32Array(keepIdx.length);
          for (let j = 0; j < keepIdx.length; j++) indices[j] = matched[keepIdx[j] * 5];

          console.log('[Pin] Laço exato: ' + indices.length.toLocaleString('pt-BR') + ' splats selecionados (de ' +
            numPts.toLocaleString('pt-BR') + ' dentro do polígono) | Centroide:', cx.toFixed(3), cy.toFixed(3), cz.toFixed(3), '| raio:', radius.toFixed(3));

          return {
            x: cx,
            y: cy,
            z: cz,
            radius: radius,
            pointsCount: indices.length,
            indices: indices
          };
        }
      }
    } catch (err) {
      console.warn('[Pin] Erro no teste de splats:', err);
    }
  }

  // Fallback geométrico
  let sumX = 0, sumY = 0;
  polygon.forEach(p => { sumX += p.x; sumY += p.y; });
  const screenCX = sumX / polygon.length;
  const screenCY = sumY / polygon.length;

  const avgScreenRadiusPx = Math.max(boxW, boxH) * 0.5;
  const hitLocal = screenToModelLocal(screenCX, screenCY, avgScreenRadiusPx);
  if (!hitLocal) return null;

  const fov = cameraEntity.camera ? cameraEntity.camera.fov : 45;
  const fovRad = (fov / 2) * (Math.PI / 180);
  const screenRadius3D = (avgScreenRadiusPx / rect.height) * 2.0 * orbit.distance * Math.tan(fovRad);
  const finalRadius = Math.max(0.02, screenRadius3D);

  console.log('[Pin] Lasso fallback geométrico. Centroide:', hitLocal.x.toFixed(3), hitLocal.y.toFixed(3), hitLocal.z.toFixed(3), '| raio:', finalRadius.toFixed(3));

  return {
    x: hitLocal.x,
    y: hitLocal.y,
    z: hitLocal.z,
    radius: finalRadius,
    pointsCount: null
  };
}

// === Pinned Points (Fixação de Pontos 3D) ===
let pinnedPointsList = [];
let nextPinnedId = 1;
let pendingPinPoint = null;

let pinMapTexture = null;
let pinMapData = null;
let pinMapW = 0;
let pinMapH = 0;

const PIN_MAP_MAX_WIDTH = 2048;
const PIN_MAP_MAX_HEIGHT = 8192;

function splatCount() {
  return (splatCenters && splatCenters.length) ? Math.floor(splatCenters.length / 3) : 0;
}

function ensurePinMapTexture() {
  if (!app || !app.graphicsDevice) return false;
  const total = Math.max(1, splatCount());
  const w = Math.min(PIN_MAP_MAX_WIDTH, total);
  const h = Math.max(1, Math.min(PIN_MAP_MAX_HEIGHT, Math.ceil(total / w)));
  if (pinMapTexture && pinMapW === w && pinMapH === h) return true;

  if (pinMapTexture) {
    pinMapTexture.destroy();
    pinMapTexture = null;
  }
  pinMapW = w;
  pinMapH = h;
  pinMapData = new Uint8Array(w * h * 4);

  pinMapTexture = new pc.Texture(app.graphicsDevice, {
    name: 'pinMap',
    width: w,
    height: h,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: pc.FILTER_NEAREST,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE
  });
  return true;
}

function pinIndices(pin) {
  if (pin.indices && pin.indices.length) return pin.indices;

  const rad = pin.radius !== undefined ? pin.radius : (params.pinRadius || 0.035);
  if (pin._sphereCache && pin._sphereRadius === rad) return pin._sphereCache;

  const total = splatCount();
  if (total === 0) return null;

  const r2 = rad * rad;
  const out = [];
  let nearestSq = Infinity;
  for (let i = 0; i < total; i++) {
    const dx = splatCenters[i * 3] - pin.x;
    const dy = splatCenters[i * 3 + 1] - pin.y;
    const dz = splatCenters[i * 3 + 2] - pin.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d <= r2) out.push(i);
    else if (d < nearestSq) nearestSq = d;
  }

  if (out.length === 0 && nearestSq < Infinity) {
    const fallbackR2 = Math.max(r2, nearestSq * 4);
    for (let i = 0; i < total; i++) {
      const dx = splatCenters[i * 3] - pin.x;
      const dy = splatCenters[i * 3 + 1] - pin.y;
      const dz = splatCenters[i * 3 + 2] - pin.z;
      if (dx * dx + dy * dy + dz * dz <= fallbackR2) out.push(i);
    }
  }

  pin._sphereCache = Uint32Array.from(out);
  pin._sphereRadius = rad;
  return pin._sphereCache;
}

function pinnedSplatCount() {
  let n = 0;
  for (let i = 0; i < pinnedPointsList.length; i++) {
    const idx = pinIndices(pinnedPointsList[i]);
    if (idx) n += idx.length;
  }
  return n;
}

function serializePinnedPoints() {
  return pinnedPointsList.map(p => ({
    id: p.id,
    x: p.x,
    y: p.y,
    z: p.z,
    radius: p.radius,
    emojiName: p.emojiName,
    surrogates: p.surrogates,
    filename: p.filename,
    slot: p.slot,
    col: p.col,
    row: p.row
  }));
}

function rebuildPinMap() {
  if (!ensurePinMapTexture()) return;
  pinMapData.fill(0);

  for (let i = 0; i < pinnedPointsList.length; i++) {
    const pin = pinnedPointsList[i];
    const idxs = pinIndices(pin);
    if (!idxs) continue;
    const col = pin.col | 0;
    const row = pin.row | 0;
    for (let k = 0; k < idxs.length; k++) {
      const o = idxs[k] * 4;
      pinMapData[o] = col;
      pinMapData[o + 1] = row;
      pinMapData[o + 2] = 255;
      pinMapData[o + 3] = 255;
    }
  }

  try {
    const pixels = pinMapTexture.lock();
    pixels.set(pinMapData);
    pinMapTexture.unlock();
  } catch (err) {
    console.warn('[Pin] Erro ao atualizar o mapa de pins:', err);
  }
}

function applyPinnedParams() {
  const device = app ? app.graphicsDevice : null;
  if (!device) return;

  const w = pinMapW || 1;
  const h = pinMapH || 1;
  const mapParams = [w, h, 1 / w, 1 / h];
  const scale = Math.max(1, params.pinEmojiScale || 1);
  const orient = params.surfaceOrient ? 1.0 : 0.0;
  const skew = (params.surfaceOrient && params.surfaceSkew) ? 1.0 : 0.0;
  const rotBake = (params.surfaceOrient && params.bakeRotation) ? 1.0 : 0.0;
  const bakeOn = (params.bakeColors && bakeMapTexture) ? 1.0 : 0.0;
  const tex = pinMapTexture;

  if (device.scope) {
    if (tex) device.scope.resolve('uPinMap')?.setValue(tex);
    device.scope.resolve('uPinMapParams')?.setValue(mapParams);
    device.scope.resolve('uPinEmojiScale')?.setValue(scale);
    device.scope.resolve('uSurfaceOrient')?.setValue(orient);
    device.scope.resolve('uSurfaceSkew')?.setValue(skew);
    device.scope.resolve('uRotBake')?.setValue(rotBake);
    device.scope.resolve('uBakeRight')?.setValue(bakeRight);
    device.scope.resolve('uBakeUp')?.setValue(bakeUp);
    device.scope.resolve('uBakeOn')?.setValue(bakeOn);
    if (bakeMapTexture) device.scope.resolve('uBakeMap')?.setValue(bakeMapTexture);
  }

  const apply = (obj) => {
    if (!obj || typeof obj.setParameter !== 'function') return;
    try {
      if (tex) obj.setParameter('uPinMap', tex);
      obj.setParameter('uPinMapParams', mapParams);
      obj.setParameter('uPinEmojiScale', scale);
      obj.setParameter('uSurfaceOrient', orient);
      obj.setParameter('uSurfaceSkew', skew);
      obj.setParameter('uRotBake', rotBake);
      obj.setParameter('uBakeRight', bakeRight);
      obj.setParameter('uBakeUp', bakeUp);
      obj.setParameter('uBakeOn', bakeOn);
      if (bakeMapTexture) obj.setParameter('uBakeMap', bakeMapTexture);
    } catch (e) {}
  };

  if (splatEntity && splatEntity.gsplat) {
    apply(splatEntity.gsplat);
    apply(splatEntity.gsplat.material);
    if (splatEntity.gsplat.instance) apply(splatEntity.gsplat.instance.material);
  }
}

function findPinnedPointNear(pos, threshold = 0.04) {
  if (!pos) return null;
  for (let i = 0; i < pinnedPointsList.length; i++) {
    const p = pinnedPointsList[i];
    const dist = Math.hypot(p.x - pos.x, p.y - pos.y, p.z - pos.z);
    if (dist <= Math.min(threshold, (p.radius || 0.035) * 0.4)) {
      return { point: p, index: i, dist: dist };
    }
  }
  return null;
}

function addOrUpdatePinnedPoint(x, y, z, emoji, radius, indices, pinId) {
  if (!emoji) return null;
  const rad = radius !== undefined ? radius : (params.pinRadius || 0.035);
  const slot = { col: emoji.slot.col, row: emoji.slot.row };
  const exact = (indices && indices.length) ? indices : null;

  let target = null;
  if (pinId) target = pinnedPointsList.find(p => p.id === pinId) || null;
  if (!target && !exact) {
    const near = findPinnedPointNear({ x, y, z }, rad);
    if (near) target = near.point;
  }

  if (target) {
    target.x = x;
    target.y = y;
    target.z = z;
    target.emojiName = emoji.name;
    target.surrogates = emoji.surrogates || '';
    target.filename = emoji.filename || '';
    target.slot = slot;
    target.col = slot.col;
    target.row = slot.row;
    target.radius = rad;
    target.indices = exact;
    target._sphereCache = null;
    showToast(`Pin atualizado: "${emoji.surrogates ? emoji.surrogates + ' ' : ''}${emoji.name}"${exact ? ' em ' + exact.length.toLocaleString('pt-BR') + ' pontos' : ''}.`);
  } else {
    if (pinnedPointsList.length >= 16) {
      showToast('Limite de 16 pins atingido. Remova um pin antes.');
      return null;
    }
    target = {
      id: nextPinnedId++,
      x: x,
      y: y,
      z: z,
      emojiName: emoji.name,
      surrogates: emoji.surrogates || '',
      filename: emoji.filename || '',
      slot: slot,
      col: slot.col,
      row: slot.row,
      radius: rad,
      indices: exact
    };
    pinnedPointsList.push(target);
    showToast(`Pin criado: "${emoji.surrogates ? emoji.surrogates + ' ' : ''}${emoji.name}"${exact ? ' em ' + exact.length.toLocaleString('pt-BR') + ' pontos' : ''}.`);
  }

  updatePinnedUniforms();
  return target;
}

function removePinnedPoint(id) {
  const idx = pinnedPointsList.findIndex(p => p.id === id);
  if (idx !== -1) {
    const removed = pinnedPointsList.splice(idx, 1)[0];
    if (pendingPinPoint && pendingPinPoint.pinId === id) pendingPinPoint.pinId = undefined;
    updatePinnedUniforms();
    showToast(`Pin "${removed.emojiName}" removido.`);
  }
}

function clearAllPinnedPoints() {
  if (pinnedPointsList.length === 0) {
    showToast('Nenhum ponto fixado para limpar.');
    return;
  }
  const count = pinnedPointsList.length;
  pinnedPointsList = [];
  pendingPinPoint = null;
  updatePinnedUniforms();
  showToast(`${count} pin(s) removido(s).`);
}

function updatePinnedUniforms() {
  const pinCount = pinnedPointsList.length;
  rebuildPinMap();
  applyPinnedParams();

  const total = pinnedSplatCount();
  params.pinnedCountDisplay = pinCount === 0
    ? '0 / 16 pins'
    : `${pinCount} / 16 pins · ${total.toLocaleString('pt-BR')} pontos`;
  if (typeof guiControllers !== 'undefined' && guiControllers.pinnedCountDisplay) {
    guiControllers.pinnedCountDisplay.updateDisplay();
  }
}

// === Raycasting / Sampling ===
let hoverSampleRaf = null;
let lastHoverX = 0;
let lastHoverY = 0;
let lastSampleTime = 0;

function samplePickerAt(clientX, clientY) {
  if (!isPickerActive || !app || !app.graphicsDevice || !atlasMetadata) return null;
  const gl = app.graphicsDevice.gl;
  if (!gl) return null;

  const canvas = document.getElementById('splat-canvas');
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;

  if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;

  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  const centerX = Math.round(x * scaleX);
  const centerY = Math.round((rect.height - y) * scaleY);

  const radius = 3;
  const sampleSize = radius * 2 + 1;
  const startX = Math.max(0, Math.min(canvas.width - sampleSize, centerX - radius));
  const startY = Math.max(0, Math.min(canvas.height - sampleSize, centerY - radius));

  const activeRenderMode = params.useEmojis ? params.renderMode : 2;
  const device = app.graphicsDevice;

  if (device && device.scope) {
    device.scope.resolve('uRenderMode')?.setValue(3);
  }
  if (splatEntity && splatEntity.gsplat) {
    try { splatEntity.gsplat.setParameter('uRenderMode', 3); } catch (e) {}
    if (splatEntity.gsplat.material) {
      try { splatEntity.gsplat.material.setParameter('uRenderMode', 3); } catch (e) {}
    }
  }
  app.render();

  const pixelData = new Uint8Array(sampleSize * sampleSize * 4);
  try {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  } catch (err) {}
  gl.readPixels(startX, startY, sampleSize, sampleSize, gl.RGBA, gl.UNSIGNED_BYTE, pixelData);

  if (device && device.scope) {
    device.scope.resolve('uRenderMode')?.setValue(activeRenderMode);
  }
  if (splatEntity && splatEntity.gsplat) {
    try { splatEntity.gsplat.setParameter('uRenderMode', activeRenderMode); } catch (e) {}
    if (splatEntity.gsplat.material) {
      try { splatEntity.gsplat.material.setParameter('uRenderMode', activeRenderMode); } catch (e) {}
    }
  }
  app.render();

  let bestCol = -1;
  let bestRow = -1;
  let bestDistSq = 1e9;

  for (let dy = 0; dy < sampleSize; dy++) {
    for (let dx = 0; dx < sampleSize; dx++) {
      const off = (dy * sampleSize + dx) * 4;
      const r = pixelData[off];
      const g = pixelData[off + 1];
      const b = pixelData[off + 2];
      const a = pixelData[off + 3];

      if (a > 20 && !(r >= 250 && g >= 250 && b >= 250)) {
        const distSq = (dx - radius) * (dx - radius) + (dy - radius) * (dy - radius);
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestCol = r;
          bestRow = g;
        }
      }
    }
  }

  if (bestCol === -1 || bestRow === -1) return null;
  return slotEmojiMap ? slotEmojiMap.get(bestRow * 64 + bestCol) : null;
}

function samplePositionAt(clientX, clientY) {
  return screenToModelLocal(clientX, clientY);
}

function updatePickerHover(clientX, clientY) {
  lastHoverX = clientX;
  lastHoverY = clientY;

  const reticle = document.getElementById('picker-reticle');
  if (reticle && isPickerActive) {
    reticle.style.display = 'block';
    reticle.style.left = `${lastHoverX}px`;
    reticle.style.top = `${lastHoverY}px`;
  }

  const now = performance.now();
  if (now - lastSampleTime < 35) {
    if (!hoverSampleRaf) {
      hoverSampleRaf = requestAnimationFrame(() => {
        hoverSampleRaf = null;
        updatePickerHover(lastHoverX, lastHoverY);
      });
    }
    return;
  }
  lastSampleTime = now;

  if (!isPickerActive) {
    hidePickerHover();
    return;
  }

  const tooltip = document.getElementById('picker-tooltip');
  if (!reticle || !tooltip) return;

  const emoji = samplePickerAt(lastHoverX, lastHoverY);
  if (!emoji) {
    tooltip.style.display = 'none';
    reticle.classList.remove('is-locked');
    reticle.style.borderColor = 'rgba(150, 150, 150, 0.6)';
    reticle.style.boxShadow = '0 0 8px rgba(150, 150, 150, 0.3)';
    return;
  }

  reticle.classList.add('is-locked');
  const excludedIndices = parseTokenIndices(params.excludedText);
  const forcedIndices = parseTokenIndices(params.forcedText);
  const isBlocked = emoji._atlasIndex !== undefined ? excludedIndices.has(emoji._atlasIndex) : false;
  const isForced = emoji._atlasIndex !== undefined ? forcedIndices.has(emoji._atlasIndex) : false;

  const img = document.getElementById('picker-tooltip-img');
  const nameEl = document.getElementById('picker-tooltip-name');
  const dot = document.getElementById('picker-tooltip-dot');
  const hexEl = document.getElementById('picker-tooltip-hex');
  const badge = document.getElementById('picker-tooltip-badge');
  const hintText = document.getElementById('picker-tooltip-hint-text');

  const hex = emoji.avgColor ? emoji.avgColor.hex : '#888888';
  if (img) img.src = `emojis/${emoji.filename}`;
  if (nameEl) nameEl.textContent = emoji.surrogates ? `${emoji.surrogates} ${emoji.name}` : emoji.name;
  if (dot) dot.style.backgroundColor = hex;
  if (hexEl) hexEl.textContent = hex;

  if (badge && hintText) {
    if (isBlocked) {
      badge.className = 'emoji-badge badge-blocked';
      badge.textContent = 'Bloqueado';
      hintText.innerHTML = 'Clique para Opções';
      reticle.style.borderColor = '#ff7b72';
      reticle.style.boxShadow = '0 0 14px rgba(255, 123, 114, 0.8), inset 0 0 6px rgba(255, 123, 114, 0.4)';
    } else if (isForced) {
      badge.className = 'emoji-badge badge-forced';
      badge.textContent = 'Restrito';
      hintText.innerHTML = 'Clique para Opções';
      reticle.style.borderColor = '#7ee787';
      reticle.style.boxShadow = '0 0 14px rgba(126, 231, 135, 0.8), inset 0 0 6px rgba(126, 231, 135, 0.4)';
    } else {
      badge.className = 'emoji-badge badge-idle';
      badge.textContent = 'Ativo';
      hintText.innerHTML = 'Clique para Opções e Fixação';
      reticle.style.borderColor = '#58a6ff';
      reticle.style.boxShadow = '0 0 14px rgba(88, 166, 255, 0.8), inset 0 0 6px rgba(88, 166, 255, 0.4)';
    }
  }

  const tooltipW = 230;
  const tooltipH = 80;
  let tx = lastHoverX + 28;
  let ty = lastHoverY + 16;

  if (tx + tooltipW > window.innerWidth - 330) {
    tx = lastHoverX - tooltipW - 28;
  }
  if (ty + tooltipH > window.innerHeight - 20) {
    ty = lastHoverY - tooltipH - 16;
  }

  tooltip.style.left = `${Math.max(10, tx)}px`;
  tooltip.style.top = `${Math.max(10, ty)}px`;
  tooltip.style.display = 'flex';
}

function hidePickerHover() {
  const reticle = document.getElementById('picker-reticle');
  const tooltip = document.getElementById('picker-tooltip');
  if (reticle) {
    reticle.style.display = 'none';
    reticle.classList.remove('is-locked');
  }
  if (tooltip) tooltip.style.display = 'none';
}

// === Bake System ===
let bakeMapTexture = null;
let bakeMapData = null;
let bakeRenderTarget = null;

function ensureBakeTarget() {
  if (!app || !app.graphicsDevice) return false;
  if (!ensurePinMapTexture()) return false;
  if (bakeMapTexture && bakeMapTexture.width === pinMapW && bakeMapTexture.height === pinMapH) return true;

  if (bakeRenderTarget) { bakeRenderTarget.destroy(); bakeRenderTarget = null; }
  if (bakeMapTexture) { bakeMapTexture.destroy(); bakeMapTexture = null; }

  bakeMapData = new Uint8Array(pinMapW * pinMapH * 4);
  bakeMapTexture = new pc.Texture(app.graphicsDevice, {
    name: 'bakeMap',
    width: pinMapW,
    height: pinMapH,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: pc.FILTER_NEAREST,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE
  });
  bakeRenderTarget = new pc.RenderTarget({ colorBuffer: bakeMapTexture, depth: false });
  return true;
}

function bakeEmojiColors() {
  if (!app || !app.graphicsDevice || !cameraEntity || !splatEntity) return false;
  if (!ensureBakeTarget()) { showToast('Bake indisponível (modelo não carregado).'); return false; }

  const device = app.graphicsDevice;
  const gl = device.gl;
  const cam = cameraEntity.camera;
  const prevRT = cam.renderTarget || null;
  const setScope = (n, v) => { try { device.scope.resolve(n)?.setValue(v); } catch (e) {} };

  let ok = false;
  try {
    setScope('uBakePass', 1);
    setScope('uBakeOn', 0);
    setScope('uRenderMode', 0);
    device.setRenderTarget(bakeRenderTarget);
    device.clear({ color: [0, 0, 0, 0], depth: 1, stencil: 0, flags: pc.CLEARFLAG_COLOR });
    cam.renderTarget = bakeRenderTarget;
    app.render();

    const glRT = (bakeRenderTarget.impl && bakeRenderTarget.impl._glFrameBuffer) || null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, glRT);
    gl.readPixels(0, 0, pinMapW, pinMapH, gl.RGBA, gl.UNSIGNED_BYTE, bakeMapData);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    ok = true;
  } catch (err) {
    console.warn('[Bake] falhou:', err);
  } finally {
    cam.renderTarget = prevRT;
    device.setRenderTarget(null);
    setScope('uBakePass', 0);
    applyShaderParams();
  }
  if (!ok) { showToast('Bake falhou. Veja o console.'); return false; }

  try {
    const pixels = bakeMapTexture.lock();
    pixels.set(bakeMapData);
    bakeMapTexture.unlock();
  } catch (err) {
    console.warn('[Bake] erro ao subir textura:', err);
  }

  let valid = 0;
  for (let i = 3; i < bakeMapData.length; i += 4) if (bakeMapData[i] > 0) valid++;
  console.log('[Bake] splats congelados: ' + valid.toLocaleString('pt-BR') + ' de ' + splatCount().toLocaleString('pt-BR'));
  showToast('Bake concluído: ' + valid.toLocaleString('pt-BR') + ' emojis congelados.');
  return valid > 0;
}

let lockSHCamPos = null;

function computeLockSHCamPos() {
  if (!cameraEntity || !splatEntity) return [0, 0, 1];
  try {
    const inv = new pc.Mat4().copy(splatEntity.getWorldTransform());
    inv.invert();
    const p = new pc.Vec3();
    inv.transformPoint(cameraEntity.getPosition(), p);
    return [p.x, p.y, p.z];
  } catch (e) {
    return [0, 0, 1];
  }
}

let bakeRight = [1, 0, 0];
let bakeUp = [0, 1, 0];

function computeBakeBasis() {
  if (!cameraEntity || !splatEntity) return;
  try {
    const vm = new pc.Mat4().mul2(cameraEntity.camera.viewMatrix, splatEntity.getWorldTransform());
    const d = vm.data;
    const nrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
    bakeRight = nrm(d[0], d[4], d[8]);
    bakeUp = nrm(d[1], d[5], d[9]);
  } catch (e) {}
}

const gsplatMaterials = [];

function applySplatSHBands(resource, entity) {
  const bands = (resource && resource.gsplatData && resource.gsplatData.shBands)
    || (resource && resource.shBands)
    || 0;
  if (!bands) return 0;

  const apply = (m) => {
    if (!m || typeof m.setDefine !== 'function') return;
    try {
      m.setDefine('SH_BANDS', bands);
      m.update();
    } catch (e) {}
  };

  gsplatMaterials.forEach(apply);
  try {
    if (entity && entity.gsplat && entity.gsplat.material) apply(entity.gsplat.material);
    if (entity && entity.gsplat && entity.gsplat.instance && entity.gsplat.instance.material) apply(entity.gsplat.instance.material);
    if (resource && resource.meshInstance && resource.meshInstance.material) apply(resource.meshInstance.material);
  } catch (e) {}

  return bands;
}

// === Capture: marcadores gerados em esfera ao redor de um ponto ===
const captureEntities = [];
const captureTextures = new Map();

function makeCaptureTexture(id) {
  const key = 'm' + id;
  if (captureTextures.has(key)) return captureTextures.get(key);

  const CELL = 16;
  const N = 8;
  const cv = document.createElement('canvas');
  cv.width = N * CELL;
  cv.height = N * CELL;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#000000';
  ctx.fillRect(CELL, CELL, (N - 2) * CELL, (N - 2) * CELL);

  let h = ((id * 2654435761) ^ 0x9e3779b9) >>> 0;
  const nextBit = () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    return (h >>> 31) & 1;
  };
  ctx.fillStyle = '#ffffff';
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (nextBit()) ctx.fillRect((2 + c) * CELL, (2 + r) * CELL, CELL, CELL);
    }
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(2 * CELL, 2 * CELL, CELL, CELL);
  ctx.fillRect(5 * CELL, 2 * CELL, CELL, CELL);
  ctx.fillRect(2 * CELL, 5 * CELL, CELL, CELL);

  const tex = new pc.Texture(app.graphicsDevice, {
    name: 'captureMarker' + id,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: pc.FILTER_NEAREST,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE
  });
  tex.setSource(cv);
  captureTextures.set(key, tex);
  return tex;
}

function clearCaptureMarkers() {
  while (captureEntities.length) {
    const e = captureEntities.pop();
    try {
      if (e.render && e.render.material) e.render.material.destroy();
      e.destroy();
    } catch (err) {}
  }
}

function buildCaptureMarkers() {
  clearCaptureMarkers();
  if (!app || !splatEntity) return;
  if (!params.captureShow) { return; }

  const n = Math.max(1, Math.min(64, Math.round(params.captureCount || 8)));
  const rad = Math.max(0.01, params.captureRadius || 0.9);
  const size = Math.max(0.001, params.captureSize || 0.08);
  const startId = Math.round(params.captureStartId || 0);

  const center = new pc.Vec3(params.captureX || 0, params.captureY || 0, params.captureZ || 0);
  const worldCenter = new pc.Vec3();
  splatEntity.getWorldTransform().transformPoint(center, worldCenter);

  for (let i = 0; i < n; i++) {
    const y = (n === 1) ? 0 : 1 - (i / (n - 1)) * 2;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * Math.PI * (3 - Math.sqrt(5));
    const pos = new pc.Vec3(
      center.x + Math.cos(phi) * rr * rad,
      center.y + y * rad,
      center.z + Math.sin(phi) * rr * rad
    );

    const worldPos = new pc.Vec3();
    splatEntity.getWorldTransform().transformPoint(pos, worldPos);

    const mat = new pc.StandardMaterial();
    mat.diffuseMap = makeCaptureTexture(startId + i);
    mat.emissiveMap = mat.diffuseMap;
    mat.emissive = new pc.Color(1, 1, 1);
    mat.useLighting = false;
    mat.cull = pc.CULLFACE_NONE;
    mat.update();

    const e = new pc.Entity('capture-' + (startId + i));
    e.addComponent('render', { type: 'plane', material: mat });
    splatPivot.addChild(e);
    e.setLocalScale(size, size, size);
    e.setPosition(worldPos.x, worldPos.y, worldPos.z);

    const toCenter = new pc.Vec3().sub2(worldCenter, worldPos).normalize();
    const alignDir = params.captureFaceOutward ? toCenter.clone().mulScalar(-1) : toCenter;
    const upRef = pc.Vec3.UP;
    const d = alignDir.dot(upRef);
    let q;
    if (d > 0.9999) {
      q = new pc.Quat();
    } else if (d < -0.9999) {
      q = new pc.Quat().setFromAxisAngle(pc.Vec3.RIGHT, 180);
    } else {
      const axis = new pc.Vec3().cross(upRef, alignDir).normalize();
      q = new pc.Quat().setFromAxisAngle(axis, Math.acos(Math.max(-1, Math.min(1, d))) * pc.math.RAD_TO_DEG);
    }
    const localRot = q;
    if (params.captureFaceFlip) {
      localRot.mul(new pc.Quat().setFromAxisAngle(pc.Vec3.UP, 180));
    }
    e.setRotation(localRot);
    captureEntities.push(e);
  }
}

function buildMarkerCanvas(id, cell) {
  const c = cell || 64;
  const N = 8;
  const cv = document.createElement('canvas');
  cv.width = N * c; cv.height = N * c;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = '#000000'; ctx.fillRect(c, c, (N - 2) * c, (N - 2) * c);
  let h = ((id * 2654435761) ^ 0x9e3779b9) >>> 0;
  const nextBit = () => { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return (h >>> 31) & 1; };
  ctx.fillStyle = '#ffffff';
  for (let r = 0; r < 4; r++) for (let cc = 0; cc < 4; cc++) if (nextBit()) ctx.fillRect((2 + cc) * c, (2 + r) * c, c, c);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(2 * c, 2 * c, c, c);
  ctx.fillRect(5 * c, 2 * c, c, c);
  ctx.fillRect(2 * c, 5 * c, c, c);
  return cv;
}

function exportCaptureMarker(id, preview) {
  try {
    const cv = buildMarkerCanvas(id, 64);
    const url = cv.toDataURL('image/png');
    if (preview) {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write('<title>Marcador ' + id + '</title><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh">' +
          '<img src="' + url + '" style="image-rendering:pixelated;width:min(90vmin,512px);image-rendering:crisp-edges">' +
          '<div style="position:fixed;bottom:8px;color:#888;font:12px monospace">marcador ' + id + ' - 512x512 (face virada para o centro)</div></body>');
      }
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = 'marcador_' + id + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Imagem do marcador ' + id + ' gerada (512x512).');
  } catch (err) {
    console.warn('[Capture] falha ao exportar marcador:', err);
    showToast('Falha ao gerar a imagem do marcador.');
  }
}
