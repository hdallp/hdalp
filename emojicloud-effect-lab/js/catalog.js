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
  if (!currentActiveCategory || currentActiveCategory === '__all') {
    for (let i = 0; i < numAtlasEmojis; i++) {
      excludedIndicesSet.add(i);
    }
    syncExcludedTextFromSet();
    rebuildColorLUT();
    updateCategoryChipsUI();
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    showToast('Bloqueados todos os 1.944 emojis.');
    return;
  }

  const indices = categoryIndicesMap[currentActiveCategory] || [];
  for (let i = 0; i < indices.length; i++) {
    excludedIndicesSet.add(indices[i]);
  }
  syncExcludedTextFromSet();
  rebuildColorLUT();
  updateCategoryChipsUI();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  const def = CATEGORY_DEFINITIONS.find(d => d.id === currentActiveCategory);
  showToast(`Bloqueados todos os emojis de: ${def ? def.label : currentActiveCategory}`);
}

function unblockAllCurrentCategory() {
  if (!atlasMetadata || !atlasMetadata.emojis) return;
  if (!currentActiveCategory || currentActiveCategory === '__all') {
    excludedIndicesSet.clear();
    syncExcludedTextFromSet();
    rebuildColorLUT();
    updateCategoryChipsUI();
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    showToast('Liberados todos os emojis.');
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
  let indices = [];
  if (!currentActiveCategory || currentActiveCategory === '__all') {
    indices = Array.from({ length: numAtlasEmojis }, (_, i) => i);
  } else {
    indices = categoryIndicesMap[currentActiveCategory] || [];
  }

  forcedIndicesSet = new Set(indices);
  params.useForced = true;
  syncForcedTextFromSet();

  if (typeof guiControllers !== 'undefined' && guiControllers.useForced) guiControllers.useForced.setValue(true);

  const headerToggle = document.getElementById('emoji-modal-use-forced-toggle');
  if (headerToggle) headerToggle.checked = true;

  rebuildColorLUT();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  const def = CATEGORY_DEFINITIONS.find(d => d.id === currentActiveCategory);
  showToast(`Restrito aos emojis de: ${def ? def.label : 'Todos'}`);
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

  if (typeof guiControllers !== 'undefined' && guiControllers.gradientMap3D) guiControllers.gradientMap3D.setValue(true);

  rebuildColorLUT(params.excludedText, params.forcedText, params.useForced);
  refreshGradientWidget();
  renderCustomGradientsList();
  const presetLib = document.getElementById('modalGradientLibrary');
  if (presetLib) presetLib.querySelectorAll('.gradient-lib-item').forEach(el => el.classList.remove('active'));

  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  showToast(`Gradiente: ${item.name}`);
}

// State for 2D Color Picker
let currentColorHue = 0;
let currentColorSat = 1.0;
let currentColorVal = 1.0;
let isColorFilterActive = false;
let selectedHexColor = '';
let currentActiveModalTag = '';
let currentActiveModalColor = '';

// State for Gradient Map Mode
let gradientEngine = typeof GradientEngine !== 'undefined' ? new GradientEngine() : null;
let activeGradientPresetId = 'purple-white';
let activeGradientPresetName = 'Roxo Neon';

let currentMatchedList = [];
let renderedEmojiCount = 0;
const EMOJI_BATCH_SIZE = 120;

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
}

function setColorFromHsv(h, s, v, triggerFilter = true) {
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
      rebuildColorLUT(params.excludedText, params.forcedText, params.useForced);
    }
  }

  if (triggerFilter) {
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  }
}

function setColorFromHex(hex, triggerFilter = true) {
  const rgb = hexToRgb(hex);
  if (!rgb) return;
  const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  setColorFromHsv(h, s, v, triggerFilter);
}

function resetColorFilter() {
  isColorFilterActive = false;
  currentActiveModalColor = '';
  selectedHexColor = '';
  updateCrosshairUI();

  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, '');
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
    rebuildColorLUT(params.excludedText, params.forcedText, params.useForced);
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

      rebuildColorLUT(params.excludedText, params.forcedText, params.useForced);
      refreshGradientWidget();

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
  params.useForced = true;
  syncForcedTextFromSet();

  if (typeof guiControllers !== 'undefined' && guiControllers.useForced) guiControllers.useForced.setValue(true);

  const headerToggle = document.getElementById('emoji-modal-use-forced-toggle');
  if (headerToggle) headerToggle.checked = true;

  rebuildColorLUT();

  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);

  showToast(`Restrito a ${selectedIndices.size} emojis do gradiente.`);
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

    let badgeClass = 'badge-idle';
    let badgeText = 'Ativo';
    if (isBlocked) {
      badgeClass = 'badge-blocked';
      badgeText = 'Bloqueado';
    } else if (isForced) {
      badgeClass = 'badge-forced';
      badgeText = 'Restrito';
    }

    let cardClass = 'emoji-grid-card';
    if (isBlocked) cardClass += ' is-blocked';
    if (isForced) cardClass += ' is-forced';

    let gradTagHtml = '';
    if (item.gradBestT !== undefined && gradientEngine) {
      const pct = Math.round(item.gradBestT * 100);
      gradTagHtml = `<span class="emoji-grad-badge" title="Posição no gradiente: ${pct}%">${pct}%</span>`;
    }

    const card = document.createElement('div');
    card.className = cardClass;
    card.dataset.idx = idx;

    if (pendingPinPoint) {
      card.style.cursor = 'pointer';
      card.onclick = () => window.__selectEmojiForPin(idx);
      card.innerHTML = `
        <div class="emoji-card-header">
          <span class="emoji-color-dot" style="background-color: ${hex};" title="Cor: ${hex}"></span>
          ${gradTagHtml}
          <span class="emoji-badge ${badgeClass}">${badgeText}</span>
        </div>
        <img class="emoji-grid-img" src="emojis/${e.filename}" alt="${e.name}" loading="lazy" />
        <div class="emoji-grid-name" title="${e.name} (${hex})">${e.name}</div>
        <div class="emoji-grid-actions">
          <button class="emoji-btn-primary" style="background: #1a324b; color: #79b8ff; border-color: #24517d;" onclick="event.stopPropagation(); window.__selectEmojiForPin(${idx})">Fixar na Seleção</button>
        </div>
      `;
    } else {
      card.onclick = () => window.__toggleSingleEmoji(idx);
      card.innerHTML = `
        <div class="emoji-card-header">
          <span class="emoji-color-dot" style="background-color: ${hex};" title="Cor: ${hex}"></span>
          ${gradTagHtml}
          <span class="emoji-badge ${badgeClass}">${badgeText}</span>
        </div>
        <img class="emoji-grid-img" src="emojis/${e.filename}" alt="${e.name}" loading="lazy" />
        <div class="emoji-grid-name" title="${e.name} (${hex})">${e.name}</div>
        <div class="emoji-grid-actions">
          <button class="emoji-btn-primary ${isBlocked ? 'btn-unblock' : 'btn-block'}" onclick="event.stopPropagation(); window.__toggleSingleEmoji(${idx})" title="${isBlocked ? 'Liberar este emoji' : 'Bloquear este emoji'}">
            ${isBlocked ? 'Liberar' : 'Bloquear'}
          </button>
          <button class="emoji-btn-force-icon ${isForced ? 'btn-active' : ''}" onclick="event.stopPropagation(); window.__toggleSingleForced(${idx})" title="${isForced ? 'Remover restrição deste emoji' : 'Restringir render a este emoji'}">
            ${isForced ? 'Restrito' : 'Restringir'}
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
    ? '<span style="color: #7ee787; font-weight: 600;">[Restritos: ATIVO]</span>'
    : '<span style="color: #888; font-weight: 600;">[Restritos: DESATIVADO]</span>';

  let modeIndicator = '';
  if (params.gradientMap3D) {
    modeIndicator = `<span style="color: #58a6ff; font-weight: 600;">[Gradiente 3D: ${activeGradientPresetName}]</span>`;
  } else if (isColorFilterActive && selectedHexColor) {
    modeIndicator = `<span style="color: #58a6ff; font-weight: 600;">[Cor: ${selectedHexColor}]</span>`;
  }

  const loadedText = renderedEmojiCount < currentMatchedList.length
    ? `Exibindo <strong>${renderedEmojiCount}</strong> de <strong>${currentMatchedList.length}</strong> (role para ver mais)`
    : `<strong>${currentMatchedList.length}</strong> emojis (total: ${numAtlasEmojis})`;

  status.innerHTML = `
    <span>${loadedText}</span>
    ${modeIndicator}
    <span style="color: #ff7b72;">Bloqueados: <strong>${excludedIndicesSet.size}</strong></span>
    <span style="color: #7ee787;">Restritos: <strong>${forcedIndicesSet.size}</strong></span>
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

  if (isColorFilterActive) {
    const hexMatch = q.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      const rgb = hexToRgb(hexMatch[0]);
      if (rgb) targetLabColor = rgbToLab(...rgb);
    } else if (colorFilter && colorFilter.startsWith('#')) {
      const rgb = hexToRgb(colorFilter);
      if (rgb) targetLabColor = rgbToLab(...rgb);
    }

    const cleanQ = q.replace(/^cor:\s*/i, '').trim();
    if (COLOR_NAMES_MAP[cleanQ]) {
      queryColorCategory = COLOR_NAMES_MAP[cleanQ];
    }
  }

  let gradientSamples = null;
  if (gradientEngine) {
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
    }

    if (isColorFilterActive && colorFilter && !colorFilter.startsWith('#')) {
      if (emojiCat !== colorFilter) continue;
    }

    if (q) {
      let matchQuery = name.includes(q) || surrogates.includes(q) || codepoint.includes(q) || allNames.some(n => n.includes(q));
      if (!matchQuery && queryColorCategory) {
        if (emojiCat === queryColorCategory) matchQuery = true;
      }
      if (!matchQuery && targetLabColor) {
        matchQuery = true;
      }
      if (!matchQuery) continue;
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

  if (targetLabColor) {
    matched.sort((a, b) => a.colorDist - b.colorDist);
  } else if (params.gradientMap3D) {
    matched.sort((a, b) => {
      if (Math.abs(a.gradBestT - b.gradBestT) > 0.001) {
        return a.gradBestT - b.gradBestT;
      }
      return a.gradMinDist - b.gradMinDist;
    });
  }

  currentMatchedList = matched;
  renderedEmojiCount = 0;
  grid.innerHTML = '';

  const activeBar = document.getElementById('active-category-bar');
  const activeName = document.getElementById('active-category-name');
  const activeCount = document.getElementById('active-category-count');
  if (activeBar && activeName && activeCount) {
    if (activeCatDef) {
      activeBar.style.display = 'flex';
      activeName.textContent = activeCatDef.label;
      activeCount.textContent = `(${matched.length} emojis)`;
    } else if (currentActiveCategory === '__blocked') {
      activeBar.style.display = 'flex';
      activeName.textContent = 'Emojis Bloqueados';
      activeCount.textContent = `(${matched.length} emojis)`;
    } else if (currentActiveCategory === '__forced') {
      activeBar.style.display = 'flex';
      activeName.textContent = 'Emojis Restritos';
      activeCount.textContent = `(${matched.length} emojis)`;
    } else {
      activeBar.style.display = 'none';
    }
  }

  if (matched.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px 0; font-size: 11px;">Nenhum emoji encontrado com os filtros atuais.</div>';
    updateStatusCounter();
  } else {
    renderNextBatch();
  }
}

window.__toggleSingleEmoji = function (atlasIndex) {
  if (typeof atlasIndex !== 'number' || atlasIndex < 0 || atlasIndex >= numAtlasEmojis) return;
  if (excludedIndicesSet.has(atlasIndex)) {
    excludedIndicesSet.delete(atlasIndex);
  } else {
    excludedIndicesSet.add(atlasIndex);
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
    params.useForced = true;
    if (typeof guiControllers !== 'undefined' && guiControllers.useForced) guiControllers.useForced.setValue(true);
    const toggle = document.getElementById('emoji-modal-use-forced-toggle');
    if (toggle) toggle.checked = true;
  }
  syncForcedTextFromSet();
  rebuildColorLUT();
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
    for (const idx of indices) excludedIndicesSet.add(idx);
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
    for (const idx of indices) forcedIndicesSet.add(idx);
    params.useForced = true;
    if (typeof guiControllers !== 'undefined' && guiControllers.useForced) guiControllers.useForced.setValue(true);
    const toggle = document.getElementById('emoji-modal-use-forced-toggle');
    if (toggle) toggle.checked = true;
  }
  syncForcedTextFromSet();
  rebuildColorLUT();
  const searchInput = document.getElementById('emoji-modal-search-input');
  renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
};

window.__selectEmojiForPin = function (atlasIndex) {
  if (!pendingPinPoint || !atlasMetadata || !atlasMetadata.emojis) {
    return;
  }
  const emoji = atlasMetadata.emojis[atlasIndex];
  if (!emoji) return;

  const rad = (pendingPinPoint.radius !== undefined) ? pendingPinPoint.radius : (params.pinRadius || 0.035);

  const pin = addOrUpdatePinnedPoint(
    pendingPinPoint.x, pendingPinPoint.y, pendingPinPoint.z, emoji, rad,
    pendingPinPoint.indices || null, pendingPinPoint.pinId
  );
  if (pin) pendingPinPoint.pinId = pin.id;

  const pinBanner = document.getElementById('modal-pin-banner');
  const pinBannerText = document.getElementById('modal-pin-banner-text');
  if (pinBanner && pinBannerText && pendingPinPoint.indices) {
    pinBanner.style.display = 'flex';
    pinBannerText.innerHTML = `<strong>${emoji.surrogates ? emoji.surrogates + ' ' : ''}${emoji.name}</strong> aplicado em <code>${pendingPinPoint.indices.length.toLocaleString('pt-BR')}</code> pontos. Clique em outro emoji para trocar, ou em Cancelar para encerrar.`;
  }
};

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
        updateCategoryChipsUI();
      }
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
  const categoryStrip = document.getElementById('unified-category-strip');
  const headerToggle = document.getElementById('emoji-modal-use-forced-toggle');
  const grid = document.getElementById('emoji-modal-grid');

  const boxContainer = document.getElementById('color-box-container');
  const hueContainer = document.getElementById('hue-bar-container');
  const resetBtn = document.getElementById('color-reset-btn');
  const swatchesGrid = document.getElementById('sidebar-swatches-grid');
  const unblockAllBtn = document.getElementById('sidebar-unblock-all-btn');
  const clearForcedBtn = document.getElementById('sidebar-clear-forced-btn');

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
  renderGradientLibrary();
  renderCustomGradientsList();
  updateCategoryChipsUI();
  refreshGradientWidget();

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
      if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 300) {
        renderNextBatch();
      }
    });
  }

  let isDraggingBox = false;
  let isDraggingHue = false;

  const handleBoxMove = (clientX, clientY) => {
    if (!boxContainer) return;
    const rect = boxContainer.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const s = x / rect.width;
    const v = 1 - (y / rect.height);
    setColorFromHsv(currentColorHue, s, v, true);
  };

  const handleHueMove = (clientX) => {
    if (!hueContainer) return;
    const rect = hueContainer.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const h = (x / rect.width) * 360;
    setColorFromHsv(h, currentColorSat, currentColorVal, true);
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

  window.addEventListener('mousemove', (e) => {
    if (isDraggingBox) handleBoxMove(e.clientX, e.clientY);
    if (isDraggingHue) handleHueMove(e.clientX);
  });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
      if (isDraggingBox) handleBoxMove(e.touches[0].clientX, e.touches[0].clientY);
      if (isDraggingHue) handleHueMove(e.touches[0].clientX);
    }
  }, { passive: true });

  window.addEventListener('mouseup', () => {
    isDraggingBox = false;
    isDraggingHue = false;
  });

  window.addEventListener('touchend', () => {
    isDraggingBox = false;
    isDraggingHue = false;
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
      showToast('Limpas todas as restrições.');
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
      renderEmojiModal('', currentActiveModalTag, currentActiveModalColor);
      searchInput.focus();
    });
  }

  let searchDebounce = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        renderEmojiModal(e.target.value, currentActiveModalTag, currentActiveModalColor);
      }, 50);
    });
  }
}
