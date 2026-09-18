/**
 * Effect Lab - Emoji Catalog, 2D Color Box, Gradient Widget & Category Filtering
 */

// Category Filter State
let currentActiveCategory = '__all';

function selectCategoryFilter(catId) {
  currentActiveCategory = catId || '__all';
  updateCategoryChipsUI();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
}

function clearCategoryFilter() {
  currentActiveCategory = '__all';
  updateCategoryChipsUI();
  const activeBar = document.getElementById('active-category-bar');
  if (activeBar) activeBar.style.display = 'none';
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
}

function blockAllCurrentCategory() {
  if (!atlasMetadata || !atlasMetadata.emojis) return;
  if (currentActiveCategory === '__blocked') return;

  if (!currentActiveCategory || currentActiveCategory === '__all') {
    for (let i = 0; i < numAtlasEmojis; i++) {
      excludedIndicesSet.add(i);
      forcedIndicesSet.delete(i);
    }
    syncExcludedTextFromSet();
    syncForcedTextFromSet();
    rebuildColorLUT();
    updateCategoryChipsUI();
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    showToast('Bloqueados todos os 1.944 emojis.');
    return;
  }

  const indices = categoryIndicesMap[currentActiveCategory] || [];
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    excludedIndicesSet.add(idx);
    forcedIndicesSet.delete(idx);
  }
  syncExcludedTextFromSet();
  syncForcedTextFromSet();
  rebuildColorLUT();
  updateCategoryChipsUI();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  const def = CATEGORY_DEFINITIONS.find(d => d.id === currentActiveCategory);
  showToast(`Bloqueados todos os emojis de: ${def ? def.label : currentActiveCategory}`);
}

function unblockAllCurrentCategory() {
  if (!atlasMetadata || !atlasMetadata.emojis) return;
  if (!currentActiveCategory || currentActiveCategory === '__all' || currentActiveCategory === '__blocked') {
    excludedIndicesSet.clear();
    syncExcludedTextFromSet();
    rebuildColorLUT();
    updateCategoryChipsUI();
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    showToast('Liberados todos os emojis bloqueados.');
    return;
  }

  if (currentActiveCategory === '__forced') {
    forcedIndicesSet.clear();
    params.forcedText = '';
    if (typeof guiControllers !== 'undefined' && guiControllers.forcedText) guiControllers.forcedText.setValue('');
    syncForcedTextFromSet();
    rebuildColorLUT();
    updateCategoryChipsUI();
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    showToast('Foco limpo em todos os emojis.');
    return;
  }

  const indices = categoryIndicesMap[currentActiveCategory] || [];
  for (let i = 0; i < indices.length; i++) {
    excludedIndicesSet.delete(indices[i]);
  }
  syncExcludedTextFromSet();
  rebuildColorLUT();
  updateCategoryChipsUI();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  const def = CATEGORY_DEFINITIONS.find(d => d.id === currentActiveCategory);
  showToast(`Liberados todos os emojis de: ${def ? def.label : currentActiveCategory}`);
}

function forceAllCurrentCategory() {
  if (!atlasMetadata || !atlasMetadata.emojis) return;
  if (currentActiveCategory === '__blocked') return;
  if (currentActiveCategory === '__forced') {
    unblockAllCurrentCategory();
    return;
  }

  let indices = [];
  if (!currentActiveCategory || currentActiveCategory === '__all') {
    indices = Array.from({ length: numAtlasEmojis }, (_, i) => i);
  } else {
    indices = categoryIndicesMap[currentActiveCategory] || [];
  }

  forcedIndicesSet = new Set(indices);
  for (let i = 0; i < indices.length; i++) {
    excludedIndicesSet.delete(indices[i]);
  }
  params.useForced = true;
  syncForcedTextFromSet();
  syncExcludedTextFromSet();

  if (typeof guiControllers !== 'undefined' && guiControllers.useForced) guiControllers.useForced.setValue(true);

  const headerToggle = document.getElementById('emoji-modal-use-forced-toggle');
  if (headerToggle) headerToggle.checked = true;

  rebuildColorLUT();
  updateCategoryChipsUI();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  const def = CATEGORY_DEFINITIONS.find(d => d.id === currentActiveCategory);
  showToast(`Foco aplicado aos emojis de: ${def ? def.label : 'Todos'}`);
}

function updateCategoryChipsUI() {
  const container = document.getElementById('unified-category-strip');
  if (!container || !atlasMetadata || !atlasMetadata.emojis) return;

  container.querySelectorAll('.cat-chip').forEach(chip => {
    const catId = chip.dataset.catId;
    const isCurrentActive = (currentActiveCategory === catId) || (!currentActiveCategory && catId === '__all');
    chip.classList.toggle('active', isCurrentActive);

    if (catId && !catId.startsWith('__')) {
      const indices = categoryIndicesMap[catId] || [];
      const isBlocked = indices.length > 0 && indices.every(i => excludedIndicesSet.has(i));
      chip.classList.toggle('is-blocked', isBlocked);
    } else if (catId === '__all') {
      const isAllBlocked = numAtlasEmojis > 0 && excludedIndicesSet.size >= numAtlasEmojis;
      chip.classList.toggle('is-blocked', isAllBlocked);
    }
  });
}

// Custom Gradients Local Storage Key
const CUSTOM_GRADS_STORAGE_KEY = 'emojicloud_custom_gradients';

function getStoredCustomGradients() {
  try {
    const raw = localStorage.getItem(CUSTOM_GRADS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveStoredCustomGradients(list) {
  try {
    localStorage.setItem(CUSTOM_GRADS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
}

function renderCustomGradientsList() {
  const listEl = document.getElementById('custom-gradients-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  const customList = getStoredCustomGradients();
  if (customList.length === 0) {
    listEl.innerHTML = '<div style="font-size: 9px; color: #666; padding: 2px 0;">Nenhum gradiente salvo.</div>';
    return;
  }
  customList.forEach(item => {
    const el = document.createElement('div');
    el.className = 'custom-grad-item' + (activeGradientPresetId === item.id ? ' active' : '');
    el.title = item.name;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'custom-grad-name';
    nameSpan.textContent = item.name;

    const bar = document.createElement('div');
    bar.className = 'custom-grad-bar';
    const sortedStops = [...item.stops].sort((a, b) => a.location - b.location);
    bar.style.background = `linear-gradient(90deg, ${sortedStops.map(s => `${s.color} ${Math.round(s.location * 100)}%`).join(', ')})`;

    const delBtn = document.createElement('button');
    delBtn.className = 'custom-grad-del';
    delBtn.innerHTML = '&times;';
    delBtn.title = 'Excluir gradiente';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCustomGradient(item.id);
    });

    el.append(nameSpan, bar, delBtn);

    el.addEventListener('click', () => {
      applyCustomGradient(item);
    });

    listEl.appendChild(el);
  });
}

function saveCurrentCustomGradient() {
  const nameInput = document.getElementById('custom-grad-name');
  const name = (nameInput ? nameInput.value : '').trim() || `Gradiente ${new Date().toLocaleTimeString()}`;
  if (!gradientEngine || !gradientEngine.colorStops || !gradientEngine.colorStops.length) return;

  const id = 'custom-' + Date.now();
  const stops = gradientEngine.colorStops.map(s => ({ location: s.location, color: s.color }));
  const customList = getStoredCustomGradients();
  customList.push({ id, name, stops });
  saveStoredCustomGradients(customList);

  if (nameInput) nameInput.value = '';
  activeGradientPresetId = id;
  activeGradientPresetName = name;
  renderCustomGradientsList();
  showToast(`Gradiente "${name}" salvo.`);
}

function deleteCustomGradient(id) {
  let customList = getStoredCustomGradients();
  customList = customList.filter(g => g.id !== id);
  saveStoredCustomGradients(customList);
  renderCustomGradientsList();
  showToast('Gradiente excluído.');
}

function applyCustomGradient(item) {
  if (!gradientEngine) return;
  activeGradientPresetId = item.id;
  activeGradientPresetName = item.name;
  params.gradientPreset = item.name;

  gradientEngine.colorStops = item.stops.map((s, idx) => ({
    id: idx + 1,
    location: s.location,
    color: s.color
  }));
  gradientEngine.selectedColorStop = gradientEngine.colorStops[0];

  params.gradientMap3D = true;
  const chkGrad3d = document.getElementById('chk-gradient-map-3d');
  if (chkGrad3d) chkGrad3d.checked = true;

  rebuildColorLUT();
  refreshGradientWidget();
  if (gradientEngine && gradientEngine.selectedColorStop) {
    setColorFromHex(gradientEngine.selectedColorStop.color, false);
  }
  renderCustomGradientsList();
  const presetLib = document.getElementById('modalGradientLibrary');
  if (presetLib) presetLib.querySelectorAll('.gradient-lib-item').forEach(el => el.classList.remove('active'));

  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  showToast(`Gradiente: ${item.name}`);
}

// State for Color Picker & Filters (Declared in state.js)
currentColorHue = 0;
currentColorSat = 1.0;
currentColorVal = 1.0;
isColorFilterActive = true;
selectedHexColor = '#ff0000';
currentActiveModalTag = '';
currentActiveModalColor = '#ff0000';
activeColorMode = 'wheel'; // 'wheel' (default) or 'box'

// State for Gradient Map Mode
let gradientEngine = typeof GradientEngine !== 'undefined' ? new GradientEngine() : null;
let activeGradientPresetId = 'purple-white';
let activeGradientPresetName = 'Roxo Neon';

let currentMatchedList = [];
let renderedEmojiCount = 0;
const EMOJI_BATCH_SIZE = 180;

// Progressive and Throttled Rendering State
let renderEmojiModalRafId = null;

function cancelProgressiveRender() {
  if (renderEmojiModalRafId) {
    cancelAnimationFrame(renderEmojiModalRafId);
    renderEmojiModalRafId = null;
  }
}

function requestEmojiModalRender(immediate = false) {
  if (immediate) {
    if (renderEmojiModalRafId) {
      cancelAnimationFrame(renderEmojiModalRafId);
      renderEmojiModalRafId = null;
    }
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    return;
  }

  if (renderEmojiModalRafId) return;

  renderEmojiModalRafId = requestAnimationFrame(() => {
    renderEmojiModalRafId = null;
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  });
}

function drawColorBox(hue) {
  const canvas = document.getElementById('color-box-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  const [r, g, b] = hsvToRgb(hue, 1, 1);
  const hueHex = rgbToHex(r, g, b);

  const gradH = ctx.createLinearGradient(0, 0, w, 0);
  gradH.addColorStop(0, '#ffffff');
  gradH.addColorStop(1, hueHex);
  ctx.fillStyle = gradH;
  ctx.fillRect(0, 0, w, h);

  const gradV = ctx.createLinearGradient(0, 0, 0, h);
  gradV.addColorStop(0, 'rgba(0,0,0,0)');
  gradV.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = gradV;
  ctx.fillRect(0, 0, w, h);
}

// Offscreen Caching for Color Wheel
let cachedRingCanvas = null;
let cachedTriCanvas = null;
let cachedTriHue = -1;

function getCachedRingCanvas() {
  if (cachedRingCanvas) return cachedRingCanvas;
  cachedRingCanvas = document.createElement('canvas');
  cachedRingCanvas.width = 200;
  cachedRingCanvas.height = 200;
  const ctx = cachedRingCanvas.getContext('2d');
  const cx = 100;
  const cy = 100;
  const rOut = 94;
  const rIn = 72;

  // 1. Draw Hue Spectrum Ring (Counter-Clockwise matching Photoshop reference)
  for (let angle = 0; angle < 360; angle += 1) {
    const startRad = -(angle + 1.8) * Math.PI / 180;
    const endRad = -(angle - 0.8) * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(cx, cy, (rOut + rIn) / 2, startRad, endRad);
    ctx.strokeStyle = `hsl(${angle}, 100%, 50%)`;
    ctx.lineWidth = (rOut - rIn);
    ctx.stroke();
  }

  // Ring outer & inner subtle border
  ctx.beginPath();
  ctx.arc(cx, cy, rOut + 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#383838';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, rIn - 0.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#383838';
  ctx.lineWidth = 1;
  ctx.stroke();

  return cachedRingCanvas;
}

function getCachedTriangleCanvas(hue) {
  const roundedHue = ((Math.round(hue) % 360) + 360) % 360;
  if (cachedTriCanvas && cachedTriHue === roundedHue) {
    return cachedTriCanvas;
  }
  if (!cachedTriCanvas) {
    cachedTriCanvas = document.createElement('canvas');
    cachedTriCanvas.width = 200;
    cachedTriCanvas.height = 200;
  }
  cachedTriHue = roundedHue;
  const ctx = cachedTriCanvas.getContext('2d');
  ctx.clearRect(0, 0, 200, 200);

  const cx = 100;
  const cy = 100;
  const rTri = 68;
  const pW = { x: cx - rTri * 0.5, y: cy - rTri * 0.866 }; // White (S=0, B=1)
  const pK = { x: cx - rTri * 0.5, y: cy + rTri * 0.866 }; // Black (B=0)
  const pC = { x: cx + rTri, y: cy };                      // Pure Hue (S=1, B=1)

  const [hr, hg, hb] = hsvToRgb(roundedHue, 1, 1);
  const imgData = ctx.createImageData(200, 200);
  const data32 = new Uint32Array(imgData.data.buffer);

  const minX = Math.floor(Math.min(pW.x, pK.x, pC.x));
  const maxX = Math.ceil(Math.max(pW.x, pK.x, pC.x));
  const minY = Math.floor(Math.min(pW.y, pK.y, pC.y));
  const maxY = Math.ceil(Math.max(pW.y, pK.y, pC.y));

  const denom = (pK.y - pC.y) * (pW.x - pC.x) + (pC.x - pK.x) * (pW.y - pC.y);

  for (let py = minY; py <= maxY; py++) {
    if (py < 0 || py >= 200) continue;
    const rowOffset = py * 200;
    for (let px = minX; px <= maxX; px++) {
      if (px < 0 || px >= 200) continue;

      const wW = ((pK.y - pC.y) * (px - pC.x) + (pC.x - pK.x) * (py - pC.y)) / denom;
      const wK = ((pC.y - pW.y) * (px - pC.x) + (pW.x - pC.x) * (py - pC.y)) / denom;
      const wC = 1 - wW - wK;

      if (wW >= 0 && wK >= 0 && wC >= 0) {
        const r = Math.round(wW * 255 + wC * hr);
        const g = Math.round(wW * 255 + wC * hg);
        const b = Math.round(wW * 255 + wC * hb);
        data32[rowOffset + px] = (255 << 24) | (b << 16) | (g << 8) | r;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Triangle outline
  ctx.beginPath();
  ctx.moveTo(pW.x, pW.y);
  ctx.lineTo(pC.x, pC.y);
  ctx.lineTo(pK.x, pK.y);
  ctx.closePath();
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 1;
  ctx.stroke();

  return cachedTriCanvas;
}

function drawColorWheelTriangle(hue, sat, val) {
  const canvas = document.getElementById('wheel-triangle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const rOut = 94;
  const rIn = 72;

  ctx.clearRect(0, 0, w, h);

  // 1. Draw cached ring (0ms cost)
  ctx.drawImage(getCachedRingCanvas(), 0, 0);

  // 2. Draw cached triangle (0ms cost for sat/val drag, ~0.15ms for hue drag)
  ctx.drawImage(getCachedTriangleCanvas(hue), 0, 0);

  // 3. Draw Hue reticle ring marker on wheel
  const hueRad = (hue % 360) * Math.PI / 180;
  const midR = (rOut + rIn) / 2;
  const hx = cx + midR * Math.cos(hueRad);
  const hy = cy - midR * Math.sin(hueRad); // Inverted Y for counter-clockwise!

  ctx.beginPath();
  ctx.arc(hx, hy, 5.5, 0, Math.PI * 2);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 4. Draw Saturation/Brightness Reticle Marker inside triangle
  const rTri = 68;
  const pW = { x: cx - rTri * 0.5, y: cy - rTri * 0.866 };
  const pK = { x: cx - rTri * 0.5, y: cy + rTri * 0.866 };
  const pC = { x: cx + rTri, y: cy };

  const wK_pos = 1 - val;
  const wC_pos = sat * val;
  const wW_pos = (1 - sat) * val;

  const markerX = wW_pos * pW.x + wK_pos * pK.x + wC_pos * pC.x;
  const markerY = wW_pos * pW.y + wK_pos * pK.y + wC_pos * pC.y;

  ctx.beginPath();
  ctx.arc(markerX, markerY, 5, 0, Math.PI * 2);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function updateHsbUi(hue, sat, val) {
  const thumbH = document.getElementById('hsb-thumb-h');
  const thumbS = document.getElementById('hsb-thumb-s');
  const thumbB = document.getElementById('hsb-thumb-b');

  const inputH = document.getElementById('hsb-input-h');
  const inputS = document.getElementById('hsb-input-s');
  const inputB = document.getElementById('hsb-input-b');

  const trackS = document.getElementById('hsb-track-s');
  const trackB = document.getElementById('hsb-track-b');
  const swatchCurrent = document.getElementById('hsb-swatch-current');

  if (thumbH) thumbH.style.left = `${(hue / 360) * 100}%`;
  if (thumbS) thumbS.style.left = `${sat * 100}%`;
  if (thumbB) thumbB.style.left = `${val * 100}%`;

  if (inputH && document.activeElement !== inputH) inputH.value = Math.round(hue);
  if (inputS && document.activeElement !== inputS) inputS.value = Math.round(sat * 100);
  if (inputB && document.activeElement !== inputB) inputB.value = Math.round(val * 100);

  const [hr, hg, hb] = hsvToRgb(hue, 1, 1);
  const pureHex = rgbToHex(hr, hg, hb);

  const [cr, cg, cb] = hsvToRgb(hue, sat, val);
  const currHex = rgbToHex(cr, cg, cb);

  if (trackS) trackS.style.background = `linear-gradient(to right, #ffffff, ${pureHex})`;
  if (trackB) trackB.style.background = `linear-gradient(to right, #000000, ${pureHex})`;
  if (swatchCurrent) swatchCurrent.style.backgroundColor = currHex;

  drawColorWheelTriangle(hue, sat, val);
}

function updateCrosshairUI() {
  const container = document.getElementById('color-box-container');
  const crosshairH = document.getElementById('crosshair-h');
  const crosshairV = document.getElementById('crosshair-v');
  const crosshairRing = document.getElementById('crosshair-ring');
  const hueContainer = document.getElementById('hue-bar-container');
  const hueCursor = document.getElementById('hue-cursor');
  const dot = document.getElementById('color-preview-dot');
  const hexLabel = document.getElementById('color-preview-hex');
  const resetBtn = document.getElementById('color-reset-btn');

  const boxW = container ? container.clientWidth || 210 : 210;
  const boxH = container ? container.clientHeight || 110 : 110;
  const hueW = hueContainer ? hueContainer.clientWidth || 210 : 210;

  const x = Math.round(currentColorSat * boxW);
  const y = Math.round((1 - currentColorVal) * boxH);
  const hueX = Math.round((currentColorHue / 360) * hueW);

  if (crosshairH) crosshairH.style.top = `${y}px`;
  if (crosshairV) crosshairV.style.left = `${x}px`;
  if (crosshairRing) {
    crosshairRing.style.left = `${x}px`;
    crosshairRing.style.top = `${y}px`;
  }
  if (hueCursor) hueCursor.style.left = `${hueX}px`;

  const [r, g, b] = hsvToRgb(currentColorHue, currentColorSat, currentColorVal);
  const hex = rgbToHex(r, g, b);

  if (dot) {
    dot.style.backgroundColor = hex;
    dot.style.opacity = isColorFilterActive ? '1' : '0.4';
  }

  if (hexLabel) {
    hexLabel.textContent = isColorFilterActive ? hex : 'Todas';
    hexLabel.style.color = isColorFilterActive ? '#ffffff' : '#888888';
  }

  if (resetBtn) {
    if (isColorFilterActive) {
      resetBtn.style.borderColor = '#58a6ff';
      resetBtn.style.color = '#58a6ff';
    } else {
      resetBtn.style.borderColor = '#383838';
      resetBtn.style.color = '#888888';
    }
  }

  updateHsbUi(currentColorHue, currentColorSat, currentColorVal);
}

function setColorFromHsv(h, s, v, triggerFilter = true, isDragging = false) {
  currentColorHue = Math.max(0, Math.min(360, h));
  currentColorSat = Math.max(0, Math.min(1, s));
  currentColorVal = Math.max(0, Math.min(1, v));
  isColorFilterActive = true;

  const [r, g, b] = hsvToRgb(currentColorHue, currentColorSat, currentColorVal);
  selectedHexColor = rgbToHex(r, g, b);
  currentActiveModalColor = selectedHexColor;

  drawColorBox(currentColorHue);
  updateCrosshairUI();

  if (gradientEngine && gradientEngine.selectedColorStop) {
    gradientEngine.selectedColorStop.color = selectedHexColor;
    const stopColorInput = document.getElementById('gradStopColorInput');
    if (stopColorInput) stopColorInput.value = selectedHexColor;

    const barPreview = document.getElementById('gradBarPreview');
    if (barPreview) barPreview.style.background = gradientEngine.getCssGradient();

    const colorStopsTrack = document.getElementById('gradColorStopsTrack');
    if (colorStopsTrack) {
      const activeBox = colorStopsTrack.querySelector('.ps-stop-marker.active .ps-stop-box');
      if (activeBox) activeBox.style.background = selectedHexColor;
    }

    if (params.gradientMap3D) {
      rebuildColorLUT();
    }
  }

  if (triggerFilter) {
    requestEmojiModalRender(!isDragging);
  }
}

function setColorFromHex(hex, triggerFilter = true) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  setColorFromHsv(h, s, v, triggerFilter, false);
}

function resetColorFilter() {
  isColorFilterActive = false;
  currentActiveModalColor = '';
  selectedHexColor = '';
  updateCrosshairUI();

  const searchInput = document.getElementById('emoji-modal-search-input');
  requestEmojiModalRender(true);
}

function refreshGradientWidget() {
  if (!gradientEngine) {
    if (typeof GradientEngine !== 'undefined') gradientEngine = new GradientEngine();
    else return;
  }

  const css = gradientEngine.getCssGradient();
  const barPreview = document.getElementById('gradBarPreview');
  if (barPreview) barPreview.style.background = css;

  const colorStopsTrack = document.getElementById('gradColorStopsTrack');
  if (colorStopsTrack) {
    colorStopsTrack.innerHTML = '';
    gradientEngine.colorStops
      .slice()
      .sort((a, b) => a.location - b.location)
      .forEach(stop => {
        const el = document.createElement('div');
        el.className = 'ps-stop-marker bottom-stop' + (gradientEngine.selectedColorStop?.id === stop.id ? ' active' : '');
        el.style.left = `${stop.location * 100}%`;

        const box = document.createElement('div');
        box.className = 'ps-stop-box';
        box.style.background = stop.color;
        el.appendChild(box);

        el.addEventListener('pointerdown', e => {
          e.stopPropagation();
          gradientEngine.selectedColorStop = stop;
          refreshGradientWidget();
          setColorFromHex(stop.color, false);
          startStopDrag(stop, colorStopsTrack);
        });
        colorStopsTrack.appendChild(el);
      });
  }

  const stopColorInput = document.getElementById('gradStopColorInput');
  const stopColorLocInput = document.getElementById('gradStopColorLocInput');
  if (gradientEngine.selectedColorStop) {
    if (stopColorInput) stopColorInput.value = gradientEngine.selectedColorStop.color;
    if (stopColorLocInput) stopColorLocInput.value = Math.round(gradientEngine.selectedColorStop.location * 100);
  }

  if (params.gradientMap3D) {
    rebuildColorLUT();
  }
}

function startStopDrag(stop, track) {
  const onMove = e => {
    const rect = track.getBoundingClientRect();
    if (rect.width === 0) return;
    stop.location = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    refreshGradientWidget();
  };
  const onUp = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

function renderGradientLibrary() {
  const libraryEl = document.getElementById('modalGradientLibrary');
  if (!libraryEl || typeof GradientEngine === 'undefined') return;
  libraryEl.innerHTML = '';

  const presets = GradientEngine.getPresets();
  presets.forEach(p => {
    const item = document.createElement('div');
    item.className = 'gradient-lib-item' + (activeGradientPresetId === p.id ? ' active' : '');
    item.dataset.presetId = p.id;

    const name = document.createElement('span');
    name.className = 'gradient-lib-name';
    name.textContent = p.name;
    name.title = p.name;

    const bar = document.createElement('div');
    bar.className = 'gradient-lib-bar';
    bar.style.background = `linear-gradient(90deg, ${p.stops})`;

    item.append(name, bar);

    item.addEventListener('click', () => {
      libraryEl.querySelectorAll('.gradient-lib-item').forEach(el => el.classList.remove('active'));
      item.classList.add('active');

      activeGradientPresetId = p.id;
      activeGradientPresetName = p.name;
      params.gradientPreset = p.name;
      if (gradientEngine) {
        gradientEngine.setPreset(p.id);
      }

      params.gradientMap3D = true;
      const chkGrad3d = document.getElementById('chk-gradient-map-3d');
      if (chkGrad3d) chkGrad3d.checked = true;

      if (typeof guiControllers !== 'undefined') {
        if (guiControllers.gradientMap3D) guiControllers.gradientMap3D.setValue(true);
        if (guiControllers.gradientPreset) guiControllers.gradientPreset.setValue(p.name);
      }

      rebuildColorLUT();
      refreshGradientWidget();
      if (gradientEngine && gradientEngine.selectedColorStop) {
        setColorFromHex(gradientEngine.selectedColorStop.color, false);
      }

      const customListEl = document.getElementById('custom-gradients-list');
      if (customListEl) customListEl.querySelectorAll('.custom-grad-item').forEach(el => el.classList.remove('active'));

      const searchInput = document.getElementById('emoji-modal-search-input');
      renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
      showToast(`Mapa de Gradiente: ${p.name}`);
    });

    libraryEl.appendChild(item);
  });
}

function restrictEmojisToGradient() {
  if (!atlasMetadata || !atlasMetadata.emojis || !gradientEngine) return;

  const SAMPLE_POINTS = 32;
  const selectedIndices = new Set();

  for (let s = 0; s <= SAMPLE_POINTS; s++) {
    const t = s / SAMPLE_POINTS;
    const [gr, gg, gb] = gradientEngine.getColorAt(t);
    const targetLab = rgbToLab(gr, gg, gb);

    const candidates = [];
    for (let i = 0; i < numAtlasEmojis; i++) {
      const e = atlasMetadata.emojis[i];
      if (!e.avgColor || !e.avgColor.lab) continue;
      const dL = e.avgColor.lab[0] - targetLab[0];
      const da = e.avgColor.lab[1] - targetLab[1];
      const db = e.avgColor.lab[2] - targetLab[2];
      const dist = dL * dL + da * da + db * db;
      candidates.push({ index: i, dist });
    }
    candidates.sort((a, b) => a.dist - b.dist);
    for (let c = 0; c < Math.min(4, candidates.length); c++) {
      selectedIndices.add(candidates[c].index);
    }
  }

  forcedIndicesSet = selectedIndices;
  for (const idx of selectedIndices) {
    excludedIndicesSet.delete(idx);
  }
  params.useForced = true;
  syncForcedTextFromSet();
  syncExcludedTextFromSet();

  if (typeof guiControllers !== 'undefined' && guiControllers.useForced) guiControllers.useForced.setValue(true);

  const headerToggle = document.getElementById('emoji-modal-use-forced-toggle');
  if (headerToggle) headerToggle.checked = true;

  rebuildColorLUT();
  updateCategoryChipsUI();

  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);

  showToast(`Exclusivo a ${selectedIndices.size} emojis do gradiente.`);
}

function toggleGradientMap3D(forceState) {
  if (forceState !== undefined) {
    params.gradientMap3D = forceState;
  } else {
    params.gradientMap3D = !params.gradientMap3D;
  }

  const chkGrad3d = document.getElementById('chk-gradient-map-3d');
  if (chkGrad3d) chkGrad3d.checked = params.gradientMap3D;

  if (typeof guiControllers !== 'undefined' && guiControllers.gradientMap3D) {
    guiControllers.gradientMap3D.setValue(params.gradientMap3D);
  }

  rebuildColorLUT();
  updateStatusCounter();

  showToast(params.gradientMap3D ? `Nuvem 3D: Gradiente ${activeGradientPresetName} aplicado.` : 'Nuvem 3D: Cores padrão restauradas.');
}

function renderNextBatch() {
  const grid = document.getElementById('emoji-modal-grid');
  if (!grid || renderedEmojiCount >= currentMatchedList.length) return;

  const nextCount = Math.min(renderedEmojiCount + EMOJI_BATCH_SIZE, currentMatchedList.length);
  const slice = currentMatchedList.slice(renderedEmojiCount, nextCount);

  const fragment = document.createDocumentFragment();
  for (const item of slice) {
    const e = item.emoji;
    const idx = item.index;
    const isBlocked = excludedIndicesSet.has(idx);
    const isForced = forcedIndicesSet.has(idx);
    const hex = e.avgColor ? e.avgColor.hex : '#888888';
    const col = (e.slot && typeof e.slot.col === 'number') ? e.slot.col : (emojiCols ? emojiCols[idx] : 0);
    const row = (e.slot && typeof e.slot.row === 'number') ? e.slot.row : (emojiRows ? emojiRows[idx] : 0);
    const spritePos = `background-position: -${col * 40}px -${row * 40}px;`;

    let badgeClass = 'badge-idle';
    let badgeText = 'Ativo';
    if (isBlocked) {
      badgeClass = 'badge-blocked';
      badgeText = 'Bloqueado';
    } else if (isForced) {
      badgeClass = 'badge-forced';
      badgeText = 'Foco';
    }

    let cardClass = 'emoji-grid-card';
    if (isBlocked) cardClass += ' is-blocked';
    if (isForced) cardClass += ' is-forced';

    const card = document.createElement('div');
    card.className = cardClass;
    card.dataset.idx = idx;

    if (emojiToReplaceGlobal) {
      card.style.cursor = 'pointer';
      card.onclick = () => window.__selectEmojiForGlobalReplacement(idx);
      card.innerHTML = `
        <div class="emoji-card-header">
          <span class="emoji-color-dot" style="background-color: ${hex};" title="Cor: ${hex}"></span>
          <span class="emoji-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="emoji-atlas-sprite" style="${spritePos}"></div>
        <div class="emoji-grid-name" title="${e.name} (${hex})">${e.name}</div>
        <div class="emoji-grid-actions">
          <button class="emoji-btn-pin-action" onclick="event.stopPropagation(); window.__selectEmojiForGlobalReplacement(${idx})">Substituir Global</button>
        </div>
      `;
    } else {
      card.onclick = () => window.__toggleSingleEmoji(idx);
      card.innerHTML = `
        <div class="emoji-card-header">
          <span class="emoji-color-dot" style="background-color: ${hex};" title="Cor: ${hex}"></span>
          <span class="emoji-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="emoji-atlas-sprite" style="${spritePos}"></div>
        <div class="emoji-grid-name" title="${e.name} (${hex})">${e.name}</div>
        <div class="emoji-grid-actions">
          <button class="emoji-action-btn emoji-btn-block ${isBlocked ? 'is-blocked' : ''}" onclick="event.stopPropagation(); window.__toggleSingleEmoji(${idx})" title="${isBlocked ? 'Liberar este emoji' : 'Bloquear este emoji'}">
            ${isBlocked ? 'Liberar' : 'Bloquear'}
          </button>
          <button class="emoji-action-btn emoji-btn-force ${isForced ? 'is-forced' : ''}" onclick="event.stopPropagation(); window.__toggleSingleForced(${idx})" title="${isForced ? 'Remover do foco' : 'Focar neste emoji'}">
            ${isForced ? 'Desfocar' : 'Focar'}
          </button>
        </div>
      `;
    }

    fragment.appendChild(card);
  }

  grid.appendChild(fragment);
  renderedEmojiCount = nextCount;

  updateStatusCounter();
}

function updateStatusCounter() {
  const status = document.getElementById('emoji-modal-status');
  const headerCount = document.getElementById('emoji-modal-header-count');
  if (!status) return;

  const forcedStatusHtml = params.useForced
    ? '<span style="color: #7ee787; font-weight: 600;">[Modo Foco: ATIVO]</span>'
    : '<span style="color: #888; font-weight: 600;">[Modo Foco: DESATIVADO]</span>';

  let modeIndicator = '';
  if (params.gradientMap3D) {
    modeIndicator = `<span style="color: #58a6ff; font-weight: 600;">[Gradiente 3D: ${activeGradientPresetName}]</span>`;
  } else if (isColorFilterActive && selectedHexColor) {
    modeIndicator = `<span style="color: #58a6ff; font-weight: 600;">[Cor: ${selectedHexColor}]</span>`;
  }

  const loadedText = renderedEmojiCount < currentMatchedList.length
    ? `Exibindo <strong>${renderedEmojiCount}</strong> de <strong>${currentMatchedList.length}</strong> (role para ver mais)`
    : `<strong>${currentMatchedList.length}</strong> emojis (total: ${numAtlasEmojis})`;

  const isSpecificCategory = currentActiveCategory && currentActiveCategory !== '__all';
  const blockedCountText = (hideBlockedEmojis && !isSpecificCategory)
    ? `<span style="color: #ff7b72;">Bloqueados: <strong>${excludedIndicesSet.size}</strong> (ocultos)</span>`
    : `<span style="color: #ff7b72;">Bloqueados: <strong>${excludedIndicesSet.size}</strong></span>`;

  const replacedCountText = (typeof globalEmojiReplacements !== 'undefined' && globalEmojiReplacements.size > 0)
    ? `<span style="color: #d2a8ff;">Substituídos: <strong>${globalEmojiReplacements.size}</strong></span>`
    : '';

  status.innerHTML = `
    <span>${loadedText}</span>
    ${modeIndicator}
    ${blockedCountText}
    <span style="color: #7ee787;">Focados: <strong>${forcedIndicesSet.size}</strong></span>
    ${replacedCountText}
    <span>${forcedStatusHtml}</span>
  `;

  if (headerCount) {
    headerCount.textContent = `${currentMatchedList.length} / ${numAtlasEmojis}`;
  }
}

function renderEmojiModal(query = '', categoryFilter = currentActiveModalTag, colorFilter = currentActiveModalColor) {
  const grid = document.getElementById('emoji-modal-grid');
  if (!grid || !atlasMetadata || !atlasMetadata.emojis) return;

  let q = (query || '').toLowerCase().trim();

  let queryColorCategory = null;
  let targetLabColor = null;

  if (q) {
    const hexMatch = q.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      const rgb = hexToRgb(hexMatch[0]);
      if (rgb) targetLabColor = rgbToLab(...rgb);
    } else {
      const cleanQ = q.replace(/^cor:\s*/i, '').trim();
      if (COLOR_NAMES_MAP[cleanQ]) {
        queryColorCategory = COLOR_NAMES_MAP[cleanQ];
      }
    }
  } else if (isColorFilterActive && colorFilter && colorFilter.startsWith('#')) {
    const rgb = hexToRgb(colorFilter);
    if (rgb) targetLabColor = rgbToLab(...rgb);
  }

  let gradientSamples = null;
  if (params.gradientMap3D && gradientEngine && !q) {
    const SAMPLE_COUNT = 64;
    gradientSamples = [];
    for (let s = 0; s <= SAMPLE_COUNT; s++) {
      const t = s / SAMPLE_COUNT;
      const [gr, gg, gb] = gradientEngine.getColorAt(t);
      const lab = rgbToLab(gr, gg, gb);
      gradientSamples.push({ t, lab });
    }
  }

  const activeCatDef = (currentActiveCategory && !currentActiveCategory.startsWith('__'))
    ? CATEGORY_DEFINITIONS.find(d => d.id === currentActiveCategory)
    : null;

  const allowedIndicesSet = activeCatDef && categoryIndicesMap[activeCatDef.id]
    ? new Set(categoryIndicesMap[activeCatDef.id])
    : null;

  const matched = [];
  for (let i = 0; i < numAtlasEmojis; i++) {
    const e = atlasMetadata.emojis[i];
    const name = emojiNamesList[i] || e.name.toLowerCase();
    const surrogates = emojiSurrogatesList[i] || '';
    const codepoint = emojiCodepointsList[i] || '';
    const allNames = emojiAllNamesList[i] || [];
    const emojiCat = getEmojiColorCategory(e);

    const isBlocked = excludedIndicesSet.has(i);
    const isForced = forcedIndicesSet.has(i);

    if (currentActiveCategory === '__blocked') {
      if (!isBlocked) continue;
    } else if (currentActiveCategory === '__forced') {
      if (!isForced) continue;
    } else if (allowedIndicesSet) {
      if (!allowedIndicesSet.has(i)) continue;
    } else {
      if (hideBlockedEmojis && isBlocked) continue;
    }

    if (q) {
      if (targetLabColor) {
        // Hex search - keep to calculate distance
      } else if (queryColorCategory) {
        if (emojiCat !== queryColorCategory) continue;
      } else {
        const matchQuery = name.includes(q) || surrogates.includes(q) || codepoint.includes(q) || allNames.some(n => n.includes(q));
        if (!matchQuery) continue;
      }
    } else {
      if (isColorFilterActive && colorFilter && !colorFilter.startsWith('#')) {
        if (emojiCat !== colorFilter) continue;
      }
    }

    let colorDist = 0;
    if (targetLabColor && e.avgColor && e.avgColor.lab) {
      const dL = e.avgColor.lab[0] - targetLabColor[0];
      const da = e.avgColor.lab[1] - targetLabColor[1];
      const db = e.avgColor.lab[2] - targetLabColor[2];
      colorDist = Math.sqrt(dL * dL + da * da + db * db);
    }

    let gradBestT = 0;
    let gradMinDist = 1e9;
    if (gradientSamples && e.avgColor && e.avgColor.lab) {
      const eLab = e.avgColor.lab;
      for (let s = 0; s < gradientSamples.length; s++) {
        const sample = gradientSamples[s];
        const dL = eLab[0] - sample.lab[0];
        const da = eLab[1] - sample.lab[1];
        const db = eLab[2] - sample.lab[2];
        const dist = dL * dL + da * da + db * db;
        if (dist < gradMinDist) {
          gradMinDist = dist;
          gradBestT = sample.t;
        }
      }
    }

    matched.push({ emoji: e, index: i, isBlocked, isForced, colorDist, gradBestT, gradMinDist });
  }

  if (params.gradientMap3D && gradientSamples) {
    matched.sort((a, b) => {
      if (Math.abs(a.gradBestT - b.gradBestT) > 0.001) {
        return a.gradBestT - b.gradBestT;
      }
      return a.gradMinDist - b.gradMinDist;
    });
  } else if (targetLabColor) {
    matched.sort((a, b) => a.colorDist - b.colorDist);
  }

  currentMatchedList = matched;
  renderedEmojiCount = 0;
  cancelProgressiveRender();
  grid.innerHTML = '';

  const activeBar = document.getElementById('active-category-bar');
  const activeName = document.getElementById('active-category-name');
  const activeCount = document.getElementById('active-category-count');
  const btnCatBlockAll = document.getElementById('btn-cat-block-all');
  const btnCatUnblockAll = document.getElementById('btn-cat-unblock-all');
  const btnCatForceAll = document.getElementById('btn-cat-force-all');
  const btnCatClearFilter = document.getElementById('btn-cat-clear-filter');

  if (activeBar && activeName && activeCount) {
    if (activeCatDef) {
      activeBar.style.display = 'flex';
      activeName.textContent = activeCatDef.label;
      activeCount.textContent = `(${matched.length} emojis)`;
      if (btnCatBlockAll) { btnCatBlockAll.style.display = 'inline-flex'; btnCatBlockAll.textContent = 'Bloquear Todos'; }
      if (btnCatUnblockAll) { btnCatUnblockAll.style.display = 'inline-flex'; btnCatUnblockAll.textContent = 'Liberar Todos'; }
      if (btnCatForceAll) { btnCatForceAll.style.display = 'inline-flex'; btnCatForceAll.textContent = 'Focar Categoria'; }
      if (btnCatClearFilter) { btnCatClearFilter.style.display = 'inline-flex'; btnCatClearFilter.textContent = 'Ver Todos'; }
    } else if (currentActiveCategory === '__blocked') {
      activeBar.style.display = 'flex';
      activeName.textContent = 'Emojis Bloqueados';
      activeCount.textContent = `(${matched.length} emojis)`;
      if (btnCatBlockAll) btnCatBlockAll.style.display = 'none';
      if (btnCatUnblockAll) { btnCatUnblockAll.style.display = 'inline-flex'; btnCatUnblockAll.textContent = 'Desbloquear Todos'; }
      if (btnCatForceAll) btnCatForceAll.style.display = 'none';
      if (btnCatClearFilter) { btnCatClearFilter.style.display = 'inline-flex'; btnCatClearFilter.textContent = 'Ver Todos'; }
    } else if (currentActiveCategory === '__forced') {
      activeBar.style.display = 'flex';
      activeName.textContent = 'Emojis Focados';
      activeCount.textContent = `(${matched.length} emojis)`;
      if (btnCatBlockAll) btnCatBlockAll.style.display = 'none';
      if (btnCatUnblockAll) { btnCatUnblockAll.style.display = 'inline-flex'; btnCatUnblockAll.textContent = 'Limpar Foco'; }
      if (btnCatForceAll) btnCatForceAll.style.display = 'none';
      if (btnCatClearFilter) { btnCatClearFilter.style.display = 'inline-flex'; btnCatClearFilter.textContent = 'Ver Todos'; }
    } else {
      activeBar.style.display = 'none';
    }
  }

  if (matched.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px 0; font-size: 11px;">Nenhum emoji encontrado com os filtros atuais.</div>';
    updateStatusCounter();
  } else {
    renderNextBatch();
    if (grid.clientHeight > 0 && grid.scrollHeight <= grid.clientHeight + 600 && renderedEmojiCount < currentMatchedList.length) {
      renderNextBatch();
    }
  }
}

window.__toggleSingleEmoji = function (atlasIndex) {
  if (typeof atlasIndex !== 'number' || atlasIndex < 0 || atlasIndex >= numAtlasEmojis) return;
  if (excludedIndicesSet.has(atlasIndex)) {
    excludedIndicesSet.delete(atlasIndex);
  } else {
    excludedIndicesSet.add(atlasIndex);
    // Strict mutual exclusion: cannot be blocked and exclusive at the same time
    if (forcedIndicesSet.has(atlasIndex)) {
      forcedIndicesSet.delete(atlasIndex);
      syncForcedTextFromSet();
    }
  }
  syncExcludedTextFromSet();
  rebuildColorLUT();
  updateCategoryChipsUI();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
};

window.__toggleSingleForced = function (atlasIndex) {
  if (typeof atlasIndex !== 'number' || atlasIndex < 0 || atlasIndex >= numAtlasEmojis) return;
  if (forcedIndicesSet.has(atlasIndex)) {
    forcedIndicesSet.delete(atlasIndex);
  } else {
    forcedIndicesSet.add(atlasIndex);
    // Strict mutual exclusion: cannot be blocked and exclusive at the same time
    if (excludedIndicesSet.has(atlasIndex)) {
      excludedIndicesSet.delete(atlasIndex);
      syncExcludedTextFromSet();
    }
    params.useForced = true;
    if (typeof guiControllers !== 'undefined' && guiControllers.useForced) guiControllers.useForced.setValue(true);
    const toggle = document.getElementById('emoji-modal-use-forced-toggle');
    if (toggle) toggle.checked = true;
  }
  syncForcedTextFromSet();
  rebuildColorLUT();
  updateCategoryChipsUI();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
};

window.__toggleExclusion = function (token) {
  if (typeof token === 'number') {
    return window.__toggleSingleEmoji(token);
  }
  const indices = parseTokenIndices(token);
  let allPresent = indices.size > 0;
  for (const idx of indices) {
    if (!excludedIndicesSet.has(idx)) {
      allPresent = false;
      break;
    }
  }
  if (allPresent) {
    for (const idx of indices) excludedIndicesSet.delete(idx);
  } else {
    for (const idx of indices) {
      excludedIndicesSet.add(idx);
      forcedIndicesSet.delete(idx);
    }
    syncForcedTextFromSet();
  }
  syncExcludedTextFromSet();
  rebuildColorLUT();
  updateCategoryChipsUI();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
};

window.__toggleForced = function (token) {
  if (typeof token === 'number') {
    return window.__toggleSingleForced(token);
  }
  const indices = parseTokenIndices(token);
  let allPresent = indices.size > 0;
  for (const idx of indices) {
    if (!forcedIndicesSet.has(idx)) {
      allPresent = false;
      break;
    }
  }
  if (allPresent) {
    for (const idx of indices) forcedIndicesSet.delete(idx);
  } else {
    for (const idx of indices) {
      forcedIndicesSet.add(idx);
      excludedIndicesSet.delete(idx);
    }
    syncExcludedTextFromSet();
    params.useForced = true;
    if (typeof guiControllers !== 'undefined' && guiControllers.useForced) guiControllers.useForced.setValue(true);
    const toggle = document.getElementById('emoji-modal-use-forced-toggle');
    if (toggle) toggle.checked = true;
  }
  syncForcedTextFromSet();
  rebuildColorLUT();
  updateCategoryChipsUI();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
};

function openEmojiModalForGlobalReplacement(targetEmoji) {
  params.openEmojiModal(true);
  const pinBanner = document.getElementById('modal-pin-banner');
  const pinBannerText = document.getElementById('modal-pin-banner-text');
  if (pinBanner && pinBannerText) {
    pinBanner.style.display = 'flex';
    const name = targetEmoji ? targetEmoji.name : 'este emoji';
    const surr = (targetEmoji && targetEmoji.surrogates) ? targetEmoji.surrogates + ' ' : '';
    pinBannerText.innerHTML = `Substituir: <strong>${surr}${name}</strong> globalmente`;
  }

  currentActiveCategory = '__all';
  isColorFilterActive = false;
  currentActiveModalColor = '';
  selectedHexColor = '';
  updateCategoryChipsUI();
  updateCrosshairUI();

  const searchInput = document.getElementById('emoji-modal-search-input');
  if (searchInput) {
    searchInput.value = '';
    const searchPill = document.getElementById('search-pill-container');
    if (searchPill) searchPill.classList.remove('has-value');
    setTimeout(() => { searchInput.focus(); }, 60);
  }
  renderEmojiModal('', '__all', '');
}

function openEmojiModalForPin(customTitle) {
  if (emojiToReplaceGlobal) {
    openEmojiModalForGlobalReplacement(emojiToReplaceGlobal);
    return;
  }
  params.openEmojiModal(true);
  const pinBanner = document.getElementById('modal-pin-banner');
  const pinBannerText = document.getElementById('modal-pin-banner-text');
  if (pinBanner && pinBannerText) {
    pinBanner.style.display = 'flex';
    if (customTitle) {
      pinBannerText.innerHTML = customTitle;
    } else if (activeActionMenuEmoji && activeActionMenuEmoji.name) {
      const surr = activeActionMenuEmoji.surrogates ? activeActionMenuEmoji.surrogates + ' ' : '';
      pinBannerText.innerHTML = `Substituir: <strong>${surr}${activeActionMenuEmoji.name}</strong> globalmente`;
    } else {
      pinBannerText.innerHTML = `Substituição global`;
    }
  }
}

window.__selectEmojiForGlobalReplacement = function (newAtlasIndex) {
  if (!emojiToReplaceGlobal || !atlasMetadata || !atlasMetadata.emojis || typeof newAtlasIndex !== 'number') {
    return;
  }
  const newEmoji = atlasMetadata.emojis[newAtlasIndex];
  if (!newEmoji) return;

  const oldIdx = (emojiToReplaceGlobal._atlasIndex !== undefined)
    ? emojiToReplaceGlobal._atlasIndex
    : atlasMetadata.emojis.findIndex(e => e.name === emojiToReplaceGlobal.name);

  if (oldIdx >= 0) {
    globalEmojiReplacements.set(oldIdx, newAtlasIndex);

    // Se o emoji antigo estava nos focados, transfere o foco para o novo emoji
    if (forcedIndicesSet.has(oldIdx)) {
      forcedIndicesSet.delete(oldIdx);
      forcedIndicesSet.add(newAtlasIndex);
      syncForcedTextFromSet();
    }

    // Garante que o novo emoji não esteja bloqueado
    if (excludedIndicesSet.has(newAtlasIndex)) {
      excludedIndicesSet.delete(newAtlasIndex);
      syncExcludedTextFromSet();
    }

    rebuildColorLUT();
    updateCategoryChipsUI();
  }

  const oldName = emojiToReplaceGlobal.name;
  const oldSurr = emojiToReplaceGlobal.surrogates ? emojiToReplaceGlobal.surrogates + ' ' : '';
  const newName = newEmoji.name;
  const newSurr = newEmoji.surrogates ? newEmoji.surrogates + ' ' : '';

  const pinBanner = document.getElementById('modal-pin-banner');
  const pinBannerText = document.getElementById('modal-pin-banner-text');
  if (pinBanner && pinBannerText) {
    pinBanner.style.display = 'flex';
    pinBannerText.innerHTML = `Substituído: <strong>${oldSurr}${oldName} → ${newSurr}${newName}</strong>`;
  }

  showToast(`"${oldName}" substituído por "${newName}".`);

  lastSampleTime = 0;
  if (typeof updatePickerHover === 'function') {
    updatePickerHover(lastHoverX, lastHoverY);
  }

  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
};

window.__selectEmojiForPin = window.__selectEmojiForGlobalReplacement;

window.__addExclusion = window.__toggleExclusion;
window.__addForced = window.__toggleForced;

function makeElementDraggable(elmnt, dragHandle) {
  if (!elmnt || !dragHandle) return;
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  dragHandle.style.cursor = 'grab';

  dragHandle.addEventListener('mousedown', dragMouseDown);
  dragHandle.addEventListener('touchstart', dragTouchStart, { passive: false });

  function dragMouseDown(e) {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('label')) return;
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    dragHandle.style.cursor = 'grabbing';
    document.addEventListener('mouseup', closeDragElement);
    document.addEventListener('mousemove', elementDrag);
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    let newTop = elmnt.offsetTop - pos2;
    let newLeft = elmnt.offsetLeft - pos1;

    const maxLeft = Math.max(10, window.innerWidth - elmnt.offsetWidth - 10);
    const maxTop = Math.max(10, window.innerHeight - 40);
    newLeft = Math.max(10, Math.min(maxLeft, newLeft));
    newTop = Math.max(10, Math.min(maxTop, newTop));

    elmnt.style.top = newTop + "px";
    elmnt.style.left = newLeft + "px";
    elmnt.style.bottom = "auto";
    elmnt.style.right = "auto";
  }

  function closeDragElement() {
    dragHandle.style.cursor = 'grab';
    document.removeEventListener('mouseup', closeDragElement);
    document.removeEventListener('mousemove', elementDrag);
  }

  function dragTouchStart(e) {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('label')) return;
    if (e.touches.length !== 1) return;
    pos3 = e.touches[0].clientX;
    pos4 = e.touches[0].clientY;
    document.addEventListener('touchend', closeTouchDrag);
    document.addEventListener('touchmove', elementTouchDrag, { passive: false });
  }

  function elementTouchDrag(e) {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    pos1 = pos3 - e.touches[0].clientX;
    pos2 = pos4 - e.touches[0].clientY;
    pos3 = e.touches[0].clientX;
    pos4 = e.touches[0].clientY;

    let newTop = elmnt.offsetTop - pos2;
    let newLeft = elmnt.offsetLeft - pos1;

    const maxLeft = Math.max(10, window.innerWidth - elmnt.offsetWidth - 10);
    const maxTop = Math.max(10, window.innerHeight - 40);
    newLeft = Math.max(10, Math.min(maxLeft, newLeft));
    newTop = Math.max(10, Math.min(maxTop, newTop));

    elmnt.style.top = newTop + "px";
    elmnt.style.left = newLeft + "px";
  }

  function closeTouchDrag() {
    document.removeEventListener('touchend', closeTouchDrag);
    document.removeEventListener('touchmove', elementTouchDrag);
  }
}

function loadEmojiAssets() {
  initColorLutTables();

  fetch('emoji_atlas.json')
    .then(res => res.json())
    .then(metadata => {
      atlasMetadata = metadata;
      numAtlasEmojis = metadata.emojis.length;

      emojiLabL = new Float32Array(numAtlasEmojis);
      emojiLabA = new Float32Array(numAtlasEmojis);
      emojiLabB = new Float32Array(numAtlasEmojis);
      emojiCols = new Uint8Array(numAtlasEmojis);
      emojiRows = new Uint8Array(numAtlasEmojis);

      emojiNamesList = [];
      emojiSurrogatesList = [];
      emojiAllNamesList = [];
      emojiCodepointsList = [];

      slotEmojiMap.clear();
      for (let i = 0; i < numAtlasEmojis; i++) {
        const e = metadata.emojis[i];
        e._atlasIndex = i;
        slotEmojiMap.set(e.slot.row * 64 + e.slot.col, e);

        emojiLabL[i] = e.avgColor.lab[0];
        emojiLabA[i] = e.avgColor.lab[1];
        emojiLabB[i] = e.avgColor.lab[2];
        emojiCols[i] = e.slot.col;
        emojiRows[i] = e.slot.row;

        emojiNamesList.push(e.name.toLowerCase());
        emojiSurrogatesList.push(e.surrogates || '');
        emojiAllNamesList.push((e.allNames || []).map(n => n.toLowerCase()));
        emojiCodepointsList.push(e.codepoint || '');
      }

      categoryIndicesMap = {};
      for (const def of CATEGORY_DEFINITIONS) {
        categoryIndicesMap[def.id] = [];
      }
      for (let i = 0; i < numAtlasEmojis; i++) {
        const e = metadata.emojis[i];
        for (const def of CATEGORY_DEFINITIONS) {
          if (matchEmojiToCategory(e, def)) {
            categoryIndicesMap[def.id].push(i);
          }
        }
      }

      console.log(`[Effect Lab] Metadados carregados: ${numAtlasEmojis} emojis disponíveis no Atlas.`);

      if (app && app.graphicsDevice) {
        createLUTTexture();
        rebuildColorLUT(params.excludedText, params.forcedText, params.useForced);
      }
      updateCategoryChipsUI();
      const searchInput = document.getElementById('emoji-modal-search-input');
      renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    })
    .catch(err => console.error('[Effect Lab] Erro ao carregar emoji_atlas.json:', err));

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = 'emoji_atlas.png';
  img.onload = () => {
    if (!app || !app.graphicsDevice) return;
    atlasTexture = new pc.Texture(app.graphicsDevice, {
      width: img.width,
      height: img.height,
      format: pc.PIXELFORMAT_RGBA8,
      mipmaps: true,
      minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
      magFilter: pc.FILTER_LINEAR,
      addressU: pc.ADDRESS_CLAMP_TO_EDGE,
      addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });
    atlasTexture.setSource(img);
    console.log('[Effect Lab] Texture Atlas carregado e instanciado na GPU.');
    applyShaderParams();
  };
}

function setupEmojiModalEvents() {
  const panel = document.getElementById('emoji-catalog-panel');
  const header = document.getElementById('emoji-panel-header');
  const minBtn = document.getElementById('emoji-panel-min-btn');
  const closeBtn = document.getElementById('emoji-modal-close-btn');
  const searchInput = document.getElementById('emoji-modal-search-input');
  const clearBtn = document.getElementById('emoji-modal-clear-search');
  const searchPillContainer = document.getElementById('search-pill-container');
  const categoryStrip = document.getElementById('unified-category-strip');
  const headerToggle = document.getElementById('emoji-modal-use-forced-toggle');
  const grid = document.getElementById('emoji-modal-grid');

  const btnModeBox = document.getElementById('btn-color-mode-box');
  const btnModeWheel = document.getElementById('btn-color-mode-wheel');
  const colorBoxView = document.getElementById('color-box-view');
  const colorWheelView = document.getElementById('color-wheel-view');

  const boxContainer = document.getElementById('color-box-container');
  const hueContainer = document.getElementById('hue-bar-container');
  const resetBtn = document.getElementById('color-reset-btn');
  const swatchesGrid = document.getElementById('sidebar-swatches-grid');
  const unblockAllBtn = document.getElementById('sidebar-unblock-all-btn');
  const clearForcedBtn = document.getElementById('sidebar-clear-forced-btn');

  const wheelCanvas = document.getElementById('wheel-triangle-canvas');
  const trackH = document.getElementById('hsb-track-h');
  const trackS = document.getElementById('hsb-track-s');
  const trackB = document.getElementById('hsb-track-b');
  const inputH = document.getElementById('hsb-input-h');
  const inputS = document.getElementById('hsb-input-s');
  const inputB = document.getElementById('hsb-input-b');

  const btnSaveCustomGrad = document.getElementById('btn-save-custom-grad');
  const inputCustomGradName = document.getElementById('custom-grad-name');

  const gradBarPreview = document.getElementById('gradBarPreview');
  const gradStopColorInput = document.getElementById('gradStopColorInput');
  const gradStopColorLocInput = document.getElementById('gradStopColorLocInput');
  const btnDeleteGradStop = document.getElementById('btnDeleteGradStop');
  const btnRestrictGrad = document.getElementById('btn-restrict-gradient');
  const btnReverseGrad = document.getElementById('btn-reverse-gradient');
  const chkGrad3d = document.getElementById('chk-gradient-map-3d');

  drawColorBox(currentColorHue);
  updateCrosshairUI();
  updateHsbUi(currentColorHue, currentColorSat, currentColorVal);
  renderGradientLibrary();
  renderCustomGradientsList();
  updateCategoryChipsUI();
  refreshGradientWidget();
  renderEmojiModal('', currentActiveModalTag, currentActiveModalColor);

  // Color Mode Tabs
  if (btnModeBox && btnModeWheel && colorBoxView && colorWheelView) {
    btnModeBox.addEventListener('click', () => {
      activeColorMode = 'box';
      btnModeBox.classList.add('active');
      btnModeWheel.classList.remove('active');
      colorBoxView.style.display = 'block';
      colorWheelView.style.display = 'none';
      drawColorBox(currentColorHue);
      updateCrosshairUI();
    });

    btnModeWheel.addEventListener('click', () => {
      activeColorMode = 'wheel';
      btnModeWheel.classList.add('active');
      btnModeBox.classList.remove('active');
      colorBoxView.style.display = 'none';
      colorWheelView.style.display = 'block';
      updateHsbUi(currentColorHue, currentColorSat, currentColorVal);
    });
  }

  if (panel && header) {
    makeElementDraggable(panel, header);
  }

  if (minBtn && panel) {
    minBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('minimized');
      const isMin = panel.classList.contains('minimized');
      minBtn.innerHTML = isMin ? '&#9633;' : '&minus;';
      minBtn.title = isMin ? 'Expandir Painel' : 'Minimizar Painel';
    });
  }

  if (chkGrad3d) {
    chkGrad3d.checked = params.gradientMap3D;
    chkGrad3d.addEventListener('change', (e) => {
      toggleGradientMap3D(e.target.checked);
    });
  }

  if (categoryStrip) {
    categoryStrip.addEventListener('click', (e) => {
      const chip = e.target.closest('.cat-chip');
      if (!chip) return;
      const catId = chip.dataset.catId;
      if (!catId) return;
      selectCategoryFilter(catId);
    });
  }

  const btnCatBlockAll = document.getElementById('btn-cat-block-all');
  const btnCatUnblockAll = document.getElementById('btn-cat-unblock-all');
  const btnCatForceAll = document.getElementById('btn-cat-force-all');
  const btnCatClearFilter = document.getElementById('btn-cat-clear-filter');

  if (btnCatBlockAll) {
    btnCatBlockAll.addEventListener('click', () => blockAllCurrentCategory());
  }
  if (btnCatUnblockAll) {
    btnCatUnblockAll.addEventListener('click', () => unblockAllCurrentCategory());
  }
  if (btnCatForceAll) {
    btnCatForceAll.addEventListener('click', () => forceAllCurrentCategory());
  }
  if (btnCatClearFilter) {
    btnCatClearFilter.addEventListener('click', () => clearCategoryFilter());
  }

  if (btnSaveCustomGrad) {
    btnSaveCustomGrad.addEventListener('click', () => {
      saveCurrentCustomGradient();
    });
  }

  if (inputCustomGradName) {
    inputCustomGradName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        saveCurrentCustomGradient();
      }
    });
  }

  if (gradBarPreview) {
    gradBarPreview.addEventListener('click', (e) => {
      if (!gradientEngine) return;
      const rect = gradBarPreview.getBoundingClientRect();
      const loc = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const [r, g, b] = gradientEngine.getColorAt(loc);
      const hex = rgbToHex(r, g, b);
      gradientEngine.addColorStop(loc, hex);
      activeGradientPresetId = 'custom';
      activeGradientPresetName = 'Personalizado';
      const lib = document.getElementById('modalGradientLibrary');
      if (lib) lib.querySelectorAll('.gradient-lib-item').forEach(el => el.classList.remove('active'));
      setColorFromHex(hex, false);
      refreshGradientWidget();
    });
  }

  if (gradStopColorInput) {
    gradStopColorInput.addEventListener('input', (e) => {
      if (gradientEngine && gradientEngine.selectedColorStop) {
        gradientEngine.selectedColorStop.color = e.target.value;
        activeGradientPresetId = 'custom';
        activeGradientPresetName = 'Personalizado';
        const lib = document.getElementById('modalGradientLibrary');
        if (lib) lib.querySelectorAll('.gradient-lib-item').forEach(el => el.classList.remove('active'));
        setColorFromHex(e.target.value, false);
        refreshGradientWidget();
      }
    });
  }

  if (gradStopColorLocInput) {
    gradStopColorLocInput.addEventListener('change', (e) => {
      if (gradientEngine && gradientEngine.selectedColorStop) {
        gradientEngine.selectedColorStop.location = Math.max(0, Math.min(100, +e.target.value)) / 100;
        gradientEngine.colorStops.sort((a, b) => a.location - b.location);
        refreshGradientWidget();
      }
    });
  }

  if (btnDeleteGradStop) {
    btnDeleteGradStop.addEventListener('click', () => {
      if (gradientEngine && gradientEngine.selectedColorStop) {
        if (gradientEngine.colorStops.length <= 2) {
          showToast('O gradiente precisa de no mínimo 2 paradas de cor.');
          return;
        }
        gradientEngine.removeColorStop(gradientEngine.selectedColorStop.id);
        refreshGradientWidget();
      }
    });
  }

  if (btnReverseGrad) {
    btnReverseGrad.addEventListener('click', () => {
      if (gradientEngine) {
        gradientEngine.reverseGradient();
        refreshGradientWidget();
        showToast('Gradiente invertido.');
      }
    });
  }

  if (btnRestrictGrad) {
    btnRestrictGrad.addEventListener('click', () => {
      restrictEmojisToGradient();
    });
  }

  if (grid) {
    grid.addEventListener('scroll', () => {
      if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 800) {
        renderNextBatch();
      }
    }, { passive: true });
  }

  // 2D Box Dragging State
  let isDraggingBox = false;
  let isDraggingHue = false;

  const handleBoxMove = (clientX, clientY) => {
    if (!boxContainer) return;
    const rect = boxContainer.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const s = x / rect.width;
    const v = 1 - (y / rect.height);
    setColorFromHsv(currentColorHue, s, v, true, true);
  };

  const handleHueMove = (clientX) => {
    if (!hueContainer) return;
    const rect = hueContainer.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const h = (x / rect.width) * 360;
    setColorFromHsv(h, currentColorSat, currentColorVal, true, true);
  };

  if (boxContainer) {
    boxContainer.addEventListener('mousedown', (e) => {
      isDraggingBox = true;
      handleBoxMove(e.clientX, e.clientY);
    });
    boxContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDraggingBox = true;
        handleBoxMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
  }

  if (hueContainer) {
    hueContainer.addEventListener('mousedown', (e) => {
      isDraggingHue = true;
      handleHueMove(e.clientX);
    });
    hueContainer.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        isDraggingHue = true;
        handleHueMove(e.touches[0].clientX);
      }
    }, { passive: true });
  }

  // Wheel & Triangle Dragging State
  let isDraggingWheelRing = false;
  let isDraggingWheelTri = false;

  const handleWheelPointer = (clientX, clientY) => {
    if (!wheelCanvas) return;
    const rect = wheelCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = wheelCanvas.width / rect.width;
    const scaleY = wheelCanvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const cx = wheelCanvas.width / 2;
    const cy = wheelCanvas.height / 2;
    const dx = x - cx;
    const dy = cy - y; // Counter-clockwise math (matching reference image)

    if (isDraggingWheelRing) {
      let angle = Math.atan2(dy, dx) * (180 / Math.PI);
      if (angle < 0) angle += 360;
      setColorFromHsv(Math.round(angle), currentColorSat, currentColorVal, true, true);
    } else if (isDraggingWheelTri) {
      const rTri = 68;
      const pW = { x: cx - rTri * 0.5, y: cy - rTri * 0.866 };
      const pK = { x: cx - rTri * 0.5, y: cy + rTri * 0.866 };
      const pC = { x: cx + rTri, y: cy };

      const denom = (pK.y - pC.y) * (pW.x - pC.x) + (pC.x - pK.x) * (pW.y - pC.y);
      let wW = ((pK.y - pC.y) * (x - pC.x) + (pC.x - pK.x) * (y - pC.y)) / denom;
      let wK = ((pC.y - pW.y) * (x - pC.x) + (pW.x - pC.x) * (y - pC.y)) / denom;
      let wC = 1 - wW - wK;

      wW = Math.max(0, wW);
      wK = Math.max(0, wK);
      wC = Math.max(0, wC);
      const sum = wW + wK + wC;
      if (sum > 0) {
        wW /= sum;
        wK /= sum;
        wC /= sum;
      }
      const val = Math.max(0, Math.min(1, 1 - wK));
      const sat = val > 0.001 ? Math.max(0, Math.min(1, wC / val)) : 0;

      setColorFromHsv(currentColorHue, sat, val, true, true);
    }
  };

  if (wheelCanvas) {
    const startWheelDrag = (clientX, clientY) => {
      const rect = wheelCanvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const scaleX = wheelCanvas.width / rect.width;
      const scaleY = wheelCanvas.height / rect.height;
      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;
      const cx = wheelCanvas.width / 2;
      const cy = wheelCanvas.height / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= 68) {
        isDraggingWheelRing = true;
        isDraggingWheelTri = false;
      } else {
        isDraggingWheelTri = true;
        isDraggingWheelRing = false;
      }
      handleWheelPointer(clientX, clientY);
    };

    wheelCanvas.addEventListener('mousedown', (e) => startWheelDrag(e.clientX, e.clientY));
    wheelCanvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) startWheelDrag(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
  }

  // HSB Sliders Dragging State
  let isDraggingTrackH = false;
  let isDraggingTrackS = false;
  let isDraggingTrackB = false;

  const handleTrackH = (clientX) => {
    if (!trackH) return;
    const rect = trackH.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const h = (x / rect.width) * 360;
    setColorFromHsv(h, currentColorSat, currentColorVal, true, true);
  };

  const handleTrackS = (clientX) => {
    if (!trackS) return;
    const rect = trackS.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const s = x / rect.width;
    setColorFromHsv(currentColorHue, s, currentColorVal, true, true);
  };

  const handleTrackB = (clientX) => {
    if (!trackB) return;
    const rect = trackB.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const b = x / rect.width;
    setColorFromHsv(currentColorHue, currentColorSat, b, true, true);
  };

  if (trackH) {
    trackH.addEventListener('mousedown', (e) => { isDraggingTrackH = true; handleTrackH(e.clientX); });
    trackH.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) { isDraggingTrackH = true; handleTrackH(e.touches[0].clientX); }
    }, { passive: true });
  }

  if (trackS) {
    trackS.addEventListener('mousedown', (e) => { isDraggingTrackS = true; handleTrackS(e.clientX); });
    trackS.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) { isDraggingTrackS = true; handleTrackS(e.touches[0].clientX); }
    }, { passive: true });
  }

  if (trackB) {
    trackB.addEventListener('mousedown', (e) => { isDraggingTrackB = true; handleTrackB(e.clientX); });
    trackB.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) { isDraggingTrackB = true; handleTrackB(e.touches[0].clientX); }
    }, { passive: true });
  }

  // HSB Numeric Inputs
  if (inputH) {
    inputH.addEventListener('input', (e) => {
      const val = Math.max(0, Math.min(360, parseInt(e.target.value) || 0));
      setColorFromHsv(val, currentColorSat, currentColorVal, true, false);
    });
  }

  if (inputS) {
    inputS.addEventListener('input', (e) => {
      const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
      setColorFromHsv(currentColorHue, val, currentColorVal, true, false);
    });
  }

  if (inputB) {
    inputB.addEventListener('input', (e) => {
      const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)) / 100;
      setColorFromHsv(currentColorHue, currentColorSat, val, true, false);
    });
  }

  // Global window pointer move & up
  window.addEventListener('mousemove', (e) => {
    if (isDraggingBox) handleBoxMove(e.clientX, e.clientY);
    if (isDraggingHue) handleHueMove(e.clientX);
    if (isDraggingWheelRing || isDraggingWheelTri) handleWheelPointer(e.clientX, e.clientY);
    if (isDraggingTrackH) handleTrackH(e.clientX);
    if (isDraggingTrackS) handleTrackS(e.clientX);
    if (isDraggingTrackB) handleTrackB(e.clientX);
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      if (isDraggingBox) handleBoxMove(e.touches[0].clientX, e.touches[0].clientY);
      if (isDraggingHue) handleHueMove(e.touches[0].clientX);
      if (isDraggingWheelRing || isDraggingWheelTri) handleWheelPointer(e.touches[0].clientX, e.touches[0].clientY);
      if (isDraggingTrackH) handleTrackH(e.touches[0].clientX);
      if (isDraggingTrackS) handleTrackS(e.touches[0].clientX);
      if (isDraggingTrackB) handleTrackB(e.touches[0].clientX);
    }
  }, { passive: true });

  window.addEventListener('mouseup', () => {
    const wasDragging = isDraggingBox || isDraggingHue || isDraggingWheelRing || isDraggingWheelTri || isDraggingTrackH || isDraggingTrackS || isDraggingTrackB;
    isDraggingBox = false;
    isDraggingHue = false;
    isDraggingWheelRing = false;
    isDraggingWheelTri = false;
    isDraggingTrackH = false;
    isDraggingTrackS = false;
    isDraggingTrackB = false;
    if (wasDragging) {
      requestEmojiModalRender(true);
    }
  });

  window.addEventListener('touchend', () => {
    const wasDragging = isDraggingBox || isDraggingHue || isDraggingWheelRing || isDraggingWheelTri || isDraggingTrackH || isDraggingTrackS || isDraggingTrackB;
    isDraggingBox = false;
    isDraggingHue = false;
    isDraggingWheelRing = false;
    isDraggingWheelTri = false;
    isDraggingTrackH = false;
    isDraggingTrackS = false;
    isDraggingTrackB = false;
    if (wasDragging) {
      requestEmojiModalRender(true);
    }
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => resetColorFilter());
  }

  if (swatchesGrid) {
    swatchesGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.swatch-btn');
      if (!btn) return;
      const color = btn.getAttribute('data-color');
      if (color) setColorFromHex(color, true);
    });
  }

  const clearReplacementsBtn = document.getElementById('sidebar-clear-replacements-btn');
  if (clearReplacementsBtn) {
    clearReplacementsBtn.addEventListener('click', () => {
      clearGlobalReplacements();
    });
  }

  if (unblockAllBtn) {
    unblockAllBtn.addEventListener('click', () => {
      excludedIndicesSet.clear();
      params.excludedText = '';
      if (typeof guiControllers !== 'undefined' && guiControllers.excludedText) guiControllers.excludedText.setValue('');
      rebuildColorLUT();
      updateCategoryChipsUI();
      const searchInput = document.getElementById('emoji-modal-search-input');
      renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
      showToast('Liberados todos os emojis.');
    });
  }

  if (clearForcedBtn) {
    clearForcedBtn.addEventListener('click', () => {
      forcedIndicesSet.clear();
      params.forcedText = '';
      if (typeof guiControllers !== 'undefined' && guiControllers.forcedText) guiControllers.forcedText.setValue('');
      rebuildColorLUT();
      const searchInput = document.getElementById('emoji-modal-search-input');
      renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
      showToast('Foco limpo em todos os emojis.');
    });
  }

  const hideBlockedToggle = document.getElementById('emoji-modal-hide-blocked-toggle');
  if (hideBlockedToggle) {
    hideBlockedToggle.checked = hideBlockedEmojis;
    hideBlockedToggle.addEventListener('change', (e) => {
      hideBlockedEmojis = e.target.checked;
      renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    });
  }

  if (headerToggle) {
    headerToggle.addEventListener('change', (e) => {
      params.useForced = e.target.checked;
      if (typeof guiControllers !== 'undefined' && guiControllers.useForced) {
        guiControllers.useForced.setValue(params.useForced);
      }
      rebuildColorLUT();
      renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    });
  }

  if (closeBtn && panel) {
    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });
  }

  if (clearBtn && searchInput) {
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      if (searchPillContainer) searchPillContainer.classList.remove('has-value');
      renderEmojiModal('', currentActiveModalTag, currentActiveModalColor);
      searchInput.focus();
    });
  }

  let searchDebounce = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      if (searchPillContainer) {
        searchPillContainer.classList.toggle('has-value', !!e.target.value.trim());
      }
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        renderEmojiModal(e.target.value, currentActiveModalTag, currentActiveModalColor);
      }, 50);
    });
  }
}
