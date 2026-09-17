/**
 * Effect Lab - GUI, Toolbar, Toast & Inspector Action Menu Controllers
 */

const guiControllers = {};

let toastTimeout = null;
function showToast(msg, duration = 2400) {
  const toast = document.getElementById('lab-toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

let activeActionMenuEmoji = null;
let activeActionMenuPos = null;

function showPickerActionMenu(clientX, clientY, emoji, localPos) {
  activeActionMenuEmoji = emoji;
  activeActionMenuPos = localPos;

  const card = document.getElementById('picker-action-card');
  const img = document.getElementById('picker-action-img');
  const nameEl = document.getElementById('picker-action-name');
  const dot = document.getElementById('picker-action-dot');
  const hexEl = document.getElementById('picker-action-hex');
  const badge = document.getElementById('picker-action-badge');
  const coordsEl = document.getElementById('picker-action-coords');
  const unpinBtn = document.getElementById('picker-btn-unpin');

  if (!card) return;

  const hex = emoji.avgColor ? emoji.avgColor.hex : '#888888';
  if (img) img.src = `emojis/${emoji.filename}`;
  if (nameEl) nameEl.textContent = emoji.surrogates ? `${emoji.surrogates} ${emoji.name}` : emoji.name;
  if (dot) dot.style.backgroundColor = hex;
  if (hexEl) hexEl.textContent = hex;

  if (coordsEl && localPos) {
    coordsEl.textContent = `XYZ: [${localPos.x.toFixed(3)}, ${localPos.y.toFixed(3)}, ${localPos.z.toFixed(3)}]`;
  }

  const nearPinned = localPos ? findPinnedPointNear(localPos) : null;
  const excludedIndices = parseTokenIndices(params.excludedText);
  const forcedIndices = parseTokenIndices(params.forcedText);
  const isBlocked = emoji._atlasIndex !== undefined ? excludedIndices.has(emoji._atlasIndex) : false;
  const isForced = emoji._atlasIndex !== undefined ? forcedIndices.has(emoji._atlasIndex) : false;

  if (badge) {
    if (nearPinned) {
      badge.className = 'emoji-badge badge-forced';
      badge.textContent = 'Fixado';
    } else if (isBlocked) {
      badge.className = 'emoji-badge badge-blocked';
      badge.textContent = 'Bloqueado';
    } else if (isForced) {
      badge.className = 'emoji-badge badge-forced';
      badge.textContent = 'Exclusivo';
    } else {
      badge.className = 'emoji-badge badge-idle';
      badge.textContent = 'Ativo';
    }
  }

  if (unpinBtn) {
    unpinBtn.style.display = nearPinned ? 'flex' : 'none';
  }

  const menuW = 270;
  const menuH = 190;
  let mx = clientX + 16;
  let my = clientY + 16;

  if (mx + menuW > window.innerWidth - 330) {
    mx = clientX - menuW - 16;
  }
  if (my + menuH > window.innerHeight - 20) {
    my = clientY - menuH - 16;
  }

  card.style.left = `${Math.max(10, mx)}px`;
  card.style.top = `${Math.max(10, my)}px`;
  card.style.display = 'flex';
}

function hidePickerActionMenu() {
  const card = document.getElementById('picker-action-card');
  if (card) card.style.display = 'none';
  activeActionMenuEmoji = null;
  activeActionMenuPos = null;
}

function setActiveTool(tool) {
  currentActiveTool = tool;
  isPickerActive = (tool === 'inspector');
  isLassoActive = (tool === 'lasso');

  document.querySelectorAll('.gui-tool-btn').forEach(btn => {
    const bTool = btn.getAttribute('data-tool');
    btn.classList.toggle('active', bTool === tool);
  });

  const canvas = document.getElementById('splat-canvas');
  if (canvas) {
    if (tool === 'inspector' || tool === 'lasso') {
      canvas.style.cursor = 'crosshair';
      canvas.classList.add('picker-active');
    } else {
      canvas.style.cursor = 'default';
      canvas.classList.remove('picker-active');
    }
  }

  const hudBanner = document.getElementById('tool-hud-banner');
  const hudText = document.getElementById('tool-hud-text');
  if (hudBanner && hudText) {
    if (tool === 'inspector') {
      hudText.textContent = 'Inspetor Ativo: Passe o mouse para analisar ou clique para inspecionar e fixar';
      hudBanner.classList.add('visible');
    } else if (tool === 'lasso') {
      hudText.textContent = 'Laço de Fixação Ativo: Desenhe um contorno na tela para fixar um emoji na região';
      hudBanner.classList.add('visible');
    } else {
      hudBanner.classList.remove('visible');
    }
  }

  if (tool !== 'inspector') {
    hidePickerHover();
    hidePickerActionMenu();
  }
  if (tool !== 'lasso') {
    clearLassoCanvas();
    isDrawingLasso = false;
  }
}

function setPickerState(active) {
  setActiveTool(active ? 'inspector' : 'navigate');
}

function handlePickerClick(e) {
  if (!isPickerActive || !app || !app.graphicsDevice || !atlasMetadata) return;

  const pickedEmoji = samplePickerAt(e.clientX, e.clientY);
  const localPos = samplePositionAt(e.clientX, e.clientY);

  if (!pickedEmoji) {
    hidePickerActionMenu();
    return;
  }

  if (e.shiftKey) {
    hidePickerActionMenu();
    window.__toggleExclusion(pickedEmoji.name);
    return;
  }

  showPickerActionMenu(e.clientX, e.clientY, pickedEmoji, localPos);
}

function setupToolbar(rootEl) {
  if (!rootEl) return;
  const titleEl = rootEl.querySelector('.tp-rotv_b');
  const toolbar = document.createElement('div');
  toolbar.id = 'gui-toolbar';
  toolbar.className = 'gui-toolbar';

  toolbar.innerHTML = `
    <button id="tool-btn-navigate" class="gui-tool-btn active" title="Navegação e Órbita 3D (V)" data-tool="navigate">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
        <path d="M13 13l6 6"/>
      </svg>
      <span>Navegar</span>
    </button>
    <button id="tool-btn-inspector" class="gui-tool-btn" title="Inspetor de Ponto 3D (I)" data-tool="inspector">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="2" x2="12" y2="6"/>
        <line x1="12" y1="18" x2="12" y2="22"/>
        <line x1="2" y1="12" x2="6" y2="12"/>
        <line x1="18" y1="12" x2="22" y2="12"/>
        <circle cx="12" cy="12" r="2" fill="currentColor"/>
      </svg>
      <span>Inspetor</span>
    </button>
    <button id="tool-btn-lasso" class="gui-tool-btn" title="Laço de Região 3D (L)" data-tool="lasso">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 18c-2-2-3-5-3-8 0-4.4 3.6-8 8-8s8 3.6 8 8c0 4-3 7-7 8"/>
        <circle cx="12" cy="18" r="3"/>
        <path d="M14 20l4 2"/>
      </svg>
      <span>Laço</span>
    </button>
    <button id="tool-btn-catalog" class="gui-tool-btn" title="Catálogo de Emojis (C)" data-tool="catalog">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      </svg>
      <span>Catálogo</span>
    </button>
    <button id="tool-btn-reset-cam" class="gui-tool-btn" title="Centralizar Câmera (R)" data-tool="reset-cam">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      <span>Câmera</span>
    </button>
  `;

  const host = (titleEl && titleEl.parentElement) ? titleEl.parentElement : rootEl;
  if (titleEl && titleEl.nextSibling && titleEl.nextSibling.parentElement === host) {
    host.insertBefore(toolbar, titleEl.nextSibling);
  } else {
    host.insertBefore(toolbar, titleEl || host.firstChild);
  }

  toolbar.querySelector('#tool-btn-navigate')?.addEventListener('click', () => setActiveTool('navigate'));
  toolbar.querySelector('#tool-btn-inspector')?.addEventListener('click', () => setActiveTool('inspector'));
  toolbar.querySelector('#tool-btn-lasso')?.addEventListener('click', () => setActiveTool('lasso'));
  toolbar.querySelector('#tool-btn-catalog')?.addEventListener('click', () => params.openEmojiModal());
  toolbar.querySelector('#tool-btn-reset-cam')?.addEventListener('click', () => params.resetCamera());
}

function setupGUI() {
  if (typeof Tweakpane === 'undefined' || !Tweakpane.Pane) {
    console.warn('[Effect Lab] Tweakpane não encontrado: GUI desativada.');
    return;
  }

  const pane = new Tweakpane.Pane({ title: 'Configurações' });
  const refresh = () => { try { pane.refresh(); } catch (e) {} };
  const addLabelOptions = (obj) => {
    const opts = {};
    obj.forEach(v => { opts[v] = v; });
    return opts;
  };

  const shim = (key, binding) => ({
    _binding: binding,
    updateDisplay() { refresh(); return this; },
    refresh() { refresh(); return this; },
    setValue(v) {
      params[key] = v;
      refresh();
      return this;
    },
    options() { return this; },
    name() { return this; },
    listen() { return this; },
    disable() { return this; },
    onChange() { return this; },
    onFinishChange() { return this; }
  });

  const bindControl = (folder, key, opts, cb) => {
    const binding = folder.addBinding(params, key, opts || {});
    if (cb) binding.on('change', (ev) => cb(ev.value));
    guiControllers[key] = shim(key, binding);
    return binding;
  };

  const addAction = (folder, title, cb) => {
    const btn = folder.addButton({ title });
    btn.on('click', () => cb());
    return btn;
  };

  setupToolbar(pane.element);

  // ================= Abas =================
  const tabs = pane.addTab({
    pages: [
      { title: 'Emojis' },
      { title: 'Pins' },
      { title: 'Capture' },
      { title: 'Cena' },
      { title: 'Presets' }
    ]
  });
  const pageEmojis = tabs.pages[0];
  const pagePins = tabs.pages[1];
  const pageCapture = tabs.pages[2];
  const pageScene = tabs.pages[3];
  const pagePresets = tabs.pages[4];
  tabs.selectedIndex = 0;

  // Superfície & Bake
  const surfFolder = pagePins.addFolder({ title: 'Superfície & Bake' });

  // Capture
  const capFolder = pageCapture.addFolder({ title: 'Marcadores ao redor do ponto' });

  bindControl(capFolder, 'captureShow', { label: 'Mostrar Marcadores' }, () => buildCaptureMarkers());

  addAction(capFolder, 'Usar centro do modelo', () => {
    params.captureX = modelCenter.x;
    params.captureY = modelCenter.y;
    params.captureZ = modelCenter.z;
    refresh();
    buildCaptureMarkers();
  });

  capFolder.addBinding(params, 'captureX', { label: 'Centro X' }).on('change', () => buildCaptureMarkers());
  capFolder.addBinding(params, 'captureY', { label: 'Centro Y' }).on('change', () => buildCaptureMarkers());
  capFolder.addBinding(params, 'captureZ', { label: 'Centro Z' }).on('change', () => buildCaptureMarkers());
  capFolder.addBinding(params, 'captureCount', { label: 'Quantidade', min: 1, max: 64, step: 1 }).on('change', () => buildCaptureMarkers());
  capFolder.addBinding(params, 'captureRadius', { label: 'Raio da Esfera', min: 0.05, max: 4, step: 0.01 }).on('change', () => buildCaptureMarkers());
  capFolder.addBinding(params, 'captureSize', { label: 'Tamanho do Marcador', min: 0.005, max: 0.8, step: 0.005 }).on('change', () => buildCaptureMarkers());
  capFolder.addBinding(params, 'captureStartId', { label: 'ID Inicial', min: 0, max: 999, step: 1 }).on('change', () => buildCaptureMarkers());
  capFolder.addBinding(params, 'captureExportId', { label: 'ID p/ exportar', min: 0, max: 999, step: 1 });
  addAction(capFolder, 'Salvar imagem do marcador (PNG)', () => exportCaptureMarker(Math.round(params.captureExportId || 0), false));
  addAction(capFolder, 'Ver imagem do marcador', () => exportCaptureMarker(Math.round(params.captureExportId || 0), true));
  capFolder.addBinding(params, 'captureFaceFlip', { label: 'Girar 180° no plano' }).on('change', () => buildCaptureMarkers());
  capFolder.addBinding(params, 'captureFaceOutward', { label: 'Normal para FORA (inverter)' }).on('change', () => buildCaptureMarkers());

  // Presets Folder
  const presetFolder = pagePresets.addFolder({ title: 'Presets' });

  let presetBinding = null;
  let presetNames = ['(Nenhum salvo)'];
  const rebuildPresetList = (names, value) => {
    if (Array.isArray(names) && names.length) presetNames = names.slice();
    if (value !== undefined) params.selectedPreset = value;
    if (!presetNames.includes(params.selectedPreset)) params.selectedPreset = presetNames[0];
    if (presetBinding) { try { presetBinding.dispose(); } catch (e) {} presetBinding = null; }
    presetBinding = presetFolder.addBinding(params, 'selectedPreset', {
      label: 'Selecionar',
      options: addLabelOptions(presetNames)
    });
  };

  const initialPresetNames = Object.keys(savedPresets).length > 0 ? Object.keys(savedPresets) : ['Padrão'];
  rebuildPresetList(initialPresetNames);

  guiControllers.selectedPreset = {
    options(names) { rebuildPresetList(names); return this; },
    setValue(v) { rebuildPresetList(null, v); return this; },
    updateDisplay() { refresh(); return this; }
  };

  addAction(presetFolder, 'Salvar Preset...', () => params.savePresetAction());
  addAction(presetFolder, 'Carregar Preset', () => params.loadPresetAction());
  addAction(presetFolder, 'Excluir Preset', () => params.deletePresetAction());
  addAction(presetFolder, 'Exportar JSON', () => params.exportPresetAction());
  addAction(presetFolder, 'Importar JSON', () => params.importPresetAction());

  // Estilo & Renderização
  const effectFolder = pageEmojis.addFolder({ title: 'Estilo & Renderização' });

  bindControl(effectFolder, 'useEmojis', { label: 'Exibir Emojis' }, () => applyShaderParams());

  bindControl(effectFolder, 'renderModeText', {
    label: 'Modo',
    options: addLabelOptions(['Colorido', 'Tintado', 'Original'])
  }, (val) => {
    params.renderMode = renderModeMap[val];
    params.useEmojis = (val !== 'Original');
    refresh();
    applyShaderParams();
  });

  bindControl(effectFolder, 'tintIntensity', { label: 'Intensidade Tint', min: 0.0, max: 1.0, step: 0.05 }, () => applyShaderParams());
  bindControl(effectFolder, 'alphaCutoff', { label: 'Corte Alpha', min: 0.01, max: 0.8, step: 0.01 }, () => applyShaderParams());
  bindControl(effectFolder, 'gradientMap3D', { label: 'Mapa Gradiente 3D' }, (val) => {
    toggleGradientMap3D(val);
  });

  const allGradientPresets = (typeof GradientEngine !== 'undefined') ? GradientEngine.getPresets() : [];
  const presetNamesList = allGradientPresets.map(p => p.name);
  const presetNameToId = {};
  allGradientPresets.forEach(p => { presetNameToId[p.name] = p.id; });

  bindControl(effectFolder, 'gradientPreset', {
    label: 'Preset Gradiente',
    options: addLabelOptions(presetNamesList)
  }, (val) => {
    const presetId = presetNameToId[val] || 'purple-white';
    activeGradientPresetId = presetId;
    activeGradientPresetName = val;
    if (gradientEngine) {
      gradientEngine.setPreset(presetId);
    }
    params.gradientMap3D = true;
    const chkGrad3d = document.getElementById('chk-gradient-map-3d');
    if (chkGrad3d) chkGrad3d.checked = true;
    if (guiControllers.gradientMap3D) guiControllers.gradientMap3D.setValue(true);

    rebuildColorLUT(params.excludedText, params.forcedText, params.useForced);
    refreshGradientWidget();
    showToast(`Gradiente: ${val}`);
  });

  const orientBinding = surfFolder.addBinding(params, 'surfaceOrient', { label: 'Orientar pela Normal (para fora)' });
  guiControllers.surfaceOrient = shim('surfaceOrient', orientBinding);

  const skewBinding = surfFolder.addBinding(params, 'surfaceSkew', { label: 'Deitar na Superfície (skew)' });
  guiControllers.surfaceSkew = shim('surfaceSkew', skewBinding);
  skewBinding.disabled = !params.surfaceOrient;

  const rotBakeBinding = surfFolder.addBinding(params, 'bakeRotation', { label: 'Fixar Rotação dos Emojis (bake)' });
  guiControllers.bakeRotation = shim('bakeRotation', rotBakeBinding);
  rotBakeBinding.disabled = !params.surfaceOrient;

  orientBinding.on('change', (ev) => {
    skewBinding.disabled = !ev.value;
    rotBakeBinding.disabled = !ev.value;
    applyShaderParams();
  });
  skewBinding.on('change', () => applyShaderParams());

  const bakeColorsBinding = surfFolder.addBinding(params, 'bakeColors', { label: 'Bake de Cor/Emoji (congelar)' });
  guiControllers.bakeColors = shim('bakeColors', bakeColorsBinding);
  bakeColorsBinding.on('change', (ev) => {
    if (ev.value) {
      const ok = bakeEmojiColors();
      if (!ok) params.bakeColors = false;
    }
    refresh();
    applyPinnedParams();
  });
  rotBakeBinding.on('change', () => {
    computeBakeBasis();
    applyShaderParams();
  });

  // Correção de Cor
  const colorFolder = pageEmojis.addFolder({ title: 'Correção de Cor' });

  bindControl(surfFolder, 'lockSH', { label: 'Fixar Harmônicos' }, () => {
    lockSHCamPos = computeLockSHCamPos();
    applyShaderParams();
  });
  bindControl(colorFolder, 'hueShift', { label: 'Matiz', min: -180, max: 180, step: 1 }, () => applyShaderParams());
  bindControl(colorFolder, 'saturation', { label: 'Saturação', min: 0.0, max: 3.0, step: 0.05 }, () => applyShaderParams());
  bindControl(colorFolder, 'brightness', { label: 'Brilho', min: -0.5, max: 0.5, step: 0.02 }, () => applyShaderParams());
  bindControl(colorFolder, 'contrast', { label: 'Contraste', min: 0.2, max: 3.0, step: 0.05 }, () => applyShaderParams());
  bindControl(colorFolder, 'gamma', { label: 'Gama', min: 0.4, max: 2.5, step: 0.05 }, () => applyShaderParams());

  addAction(colorFolder, 'Redefinir Cores', () => params.resetColors());

  // Pins de Emojis
  const pinFolder = pagePins.addFolder({ title: 'Pins de Emojis' });

  bindControl(pinFolder, 'pinnedCountDisplay', { label: 'Status', readonly: true });
  bindControl(pinFolder, 'pinRadius', { label: 'Raio do Pin (Inspetor)', min: 0.005, max: 0.12, step: 0.005 }, () => updatePinnedUniforms());
  bindControl(pinFolder, 'pinEmojiScale', { label: 'Escala do Emoji Fixado', min: 1, max: 16, step: 0.5 }, () => applyPinnedParams());

  addAction(pinFolder, 'Limpar Todos os Pins', () => params.clearAllPinsAction());

  // Filtragem & Restrições
  const filterFolder = pageEmojis.addFolder({ title: 'Filtragem & Restrições' });

  addAction(filterFolder, 'Catálogo de Emojis', () => params.openEmojiModal());
  addAction(filterFolder, 'Restringir ao Gradiente', () => restrictEmojisToGradient());

  const onFilterTextChange = () => {
    rebuildColorLUT(params.excludedText, params.forcedText, params.useForced);
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  };

  bindControl(filterFolder, 'excludedText', { label: 'Excluir Emojis' }, () => onFilterTextChange());

  addAction(filterFolder, 'Excluir Bandeiras', () => params.excludeFlagsPreset());
  addAction(filterFolder, 'Limpar Exclusões', () => params.clearExclusions());

  bindControl(filterFolder, 'useForced', { label: 'Ativar Restrição' }, (val) => {
    const headerToggle = document.getElementById('emoji-modal-use-forced-toggle');
    if (headerToggle) headerToggle.checked = val;
    rebuildColorLUT(params.excludedText, params.forcedText, val);
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  });

  bindControl(filterFolder, 'forcedText', { label: 'Emojis Exclusivos' }, (val) => {
    rebuildColorLUT(params.excludedText, val, params.useForced);
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  });

  addAction(filterFolder, 'Limpar Exclusivos', () => params.clearForced());

  bindControl(filterFolder, 'activeEmojisCount', { label: 'Total Ativo', readonly: true });
  bindControl(filterFolder, 'excludedCount', { label: 'Bloqueados', readonly: true });
  bindControl(filterFolder, 'forcedCount', { label: 'Exclusivos', readonly: true });

  // Geometria & Densidade
  const geoFolder = pageScene.addFolder({ title: 'Geometria & Densidade' });

  bindControl(geoFolder, 'squareSize', { label: 'Escala', min: 0.0005, max: 0.03, step: 0.0002 }, () => applyShaderParams());
  bindControl(geoFolder, 'density', { label: 'Densidade (%)', min: 1, max: 100, step: 1 }, () => {
    applyShaderParams();
    updateSplatCountDisplay();
  });
  bindControl(geoFolder, 'evenDensity', { label: 'Distribuição Uniforme' }, () => applyShaderParams());
  bindControl(geoFolder, 'minOpacity', { label: 'Opacidade Mínima', min: 0.0, max: 0.95, step: 0.02 }, () => applyShaderParams());
  bindControl(geoFolder, 'depthThreshold', { label: 'Profundidade', min: 0.05, max: 1.0, step: 0.01 }, () => applyShaderParams());
  bindControl(geoFolder, 'autoSpin', { label: 'Rotação Automática' });
  bindControl(geoFolder, 'spinSpeed', { label: 'Velocidade de Giro', min: 1, max: 60, step: 1 });
  bindControl(geoFolder, 'invertX', { label: 'Inverter Eixo X' }, (val) => {
    if (splatEntity) {
      splatEntity.setLocalEulerAngles(val ? 180 : 0, 0, 0);
    }
  });

  // Navegação
  const controlsFolder = pageScene.addFolder({ title: 'Navegação' });
  bindControl(controlsFolder, 'invertPitch', { label: 'Inverter Pitch (Y)' });
  bindControl(controlsFolder, 'invertYaw', { label: 'Inverter Yaw (X)' });

  // Ações da Cena
  addAction(pagePresets, 'Centralizar Câmera', () => params.resetCamera());
  addAction(pagePresets, 'Carregar .sog', () => params.openFile());

  // Propriedades
  const infoFolder = pageScene.addFolder({ title: 'Propriedades' });
  bindControl(infoFolder, 'fileName', { label: 'Arquivo', readonly: true });
  bindControl(infoFolder, 'splatCount', { label: 'Splats', readonly: true });

  window.__tpPane = pane;
  applyShaderParams();
  updatePinnedUniforms();
  updateSplatCountDisplay();

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('file-input');

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dropzone) dropzone.classList.add('active');
  });

  window.addEventListener('dragleave', (e) => {
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      if (dropzone) dropzone.classList.remove('active');
    }
  });

  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dropzone) dropzone.classList.remove('active');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const blobUrl = URL.createObjectURL(file);
      loadSplatAsset(blobUrl, file.name);
    }
  });

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const blobUrl = URL.createObjectURL(file);
        loadSplatAsset(blobUrl, file.name);
      }
    });
  }
}
