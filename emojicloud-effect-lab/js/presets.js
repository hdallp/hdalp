/**
 * Effect Lab - Presets Manager (localStorage, JSON Export & Import)
 */

const PRESET_STORAGE_KEY = 'emojicloud_presets_v2';
let savedPresets = {};

const defaultPresets = {
  'Padrão': {
    name: 'Padrão',
    params: {
      useEmojis: true,
      renderModeText: 'Colorido',
      renderMode: 0,
      tintIntensity: 0.6,
      alphaCutoff: 0.10,
      lockSH: false,
      hueShift: 0.0,
      saturation: 1.0,
      brightness: 0.0,
      contrast: 1.0,
      gamma: 1.0,
      squareSize: 0.004,
      density: 100,
      evenDensity: false,
      minOpacity: 0.0,
      depthThreshold: 1.0,
      autoSpin: false,
      spinSpeed: 18,
      invertX: true,
      invertPitch: false,
      invertYaw: false,
      excludedText: '',
      forcedText: '',
      useForced: true,
      pinRadius: 0.035,
      pinEmojiScale: 1,
      surfaceOrient: false,
      surfaceSkew: false
    },
    pinnedPoints: []
  },
  'Cyber Neon': {
    name: 'Cyber Neon',
    params: {
      useEmojis: true,
      renderModeText: 'Colorido',
      renderMode: 0,
      tintIntensity: 0.75,
      alphaCutoff: 0.15,
      lockSH: true,
      hueShift: 135.0,
      saturation: 1.8,
      brightness: 0.04,
      contrast: 1.45,
      gamma: 1.05,
      squareSize: 0.0055,
      density: 100,
      evenDensity: false,
      minOpacity: 0.12,
      depthThreshold: 1.0,
      autoSpin: true,
      spinSpeed: 6,
      invertX: true,
      invertPitch: false,
      invertYaw: false,
      excludedText: '',
      forcedText: '',
      useForced: true,
      pinRadius: 0.035,
      pinEmojiScale: 1,
      surfaceOrient: false,
      surfaceSkew: false
    },
    pinnedPoints: []
  },
  'Retrô / Pastel': {
    name: 'Retrô / Pastel',
    params: {
      useEmojis: true,
      renderModeText: 'Colorido',
      renderMode: 0,
      tintIntensity: 0.35,
      alphaCutoff: 0.08,
      lockSH: false,
      hueShift: -25.0,
      saturation: 0.65,
      brightness: 0.08,
      contrast: 0.9,
      gamma: 1.35,
      squareSize: 0.0048,
      density: 95,
      evenDensity: false,
      minOpacity: 0.08,
      depthThreshold: 1.0,
      autoSpin: false,
      spinSpeed: 10,
      invertX: true,
      invertPitch: false,
      invertYaw: false,
      excludedText: '',
      forcedText: '',
      useForced: true,
      pinRadius: 0.035,
      pinEmojiScale: 1,
      surfaceOrient: false,
      surfaceSkew: false
    },
    pinnedPoints: []
  },
  'Esparso High-Tech': {
    name: 'Esparso High-Tech',
    params: {
      useEmojis: true,
      renderModeText: 'Colorido',
      renderMode: 0,
      tintIntensity: 0.5,
      alphaCutoff: 0.18,
      lockSH: true,
      hueShift: 200.0,
      saturation: 1.3,
      brightness: -0.02,
      contrast: 1.25,
      gamma: 0.95,
      squareSize: 0.0075,
      density: 35,
      evenDensity: true,
      minOpacity: 0.2,
      depthThreshold: 1.0,
      autoSpin: true,
      spinSpeed: 4,
      invertX: true,
      invertPitch: false,
      invertYaw: false,
      excludedText: '',
      forcedText: '',
      useForced: true,
      pinRadius: 0.035,
      pinEmojiScale: 1,
      surfaceOrient: false,
      surfaceSkew: false
    },
    pinnedPoints: []
  }
};

function initPresets() {
  try {
    const raw = localStorage.getItem(PRESET_STORAGE_KEY);
    if (raw) {
      savedPresets = JSON.parse(raw);
    } else {
      savedPresets = JSON.parse(JSON.stringify(defaultPresets));
      localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(savedPresets));
    }
  } catch (err) {
    console.warn('[Effect Lab] Erro ao carregar presets do localStorage:', err);
    savedPresets = JSON.parse(JSON.stringify(defaultPresets));
  }
}

function savePresetsToStorage() {
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(savedPresets));
  } catch (err) {
    console.error('[Effect Lab] Erro ao gravar presets no localStorage:', err);
  }
}

function promptAndSavePreset() {
  const current = params.selectedPreset || 'Novo Preset';
  const name = window.prompt('Digite o nome do preset:', current);
  if (!name || !name.trim()) return;
  saveCurrentPreset(name.trim());
}

function saveCurrentPreset(name) {
  if (!name || !name.trim()) {
    showToast('Digite um nome para o preset.');
    return;
  }
  const cleanName = name.trim();

  const presetObj = {
    name: cleanName,
    createdAt: Date.now(),
    params: {
      useEmojis: params.useEmojis,
      renderModeText: params.renderModeText,
      renderMode: params.renderMode,
      distModeText: params.distModeText,
      distMode: params.distMode,
      emojiVariety: params.emojiVariety,
      tintIntensity: params.tintIntensity,
      alphaCutoff: params.alphaCutoff,
      lockSH: params.lockSH,
      hueShift: params.hueShift,
      saturation: params.saturation,
      brightness: params.brightness,
      contrast: params.contrast,
      gamma: params.gamma,
      squareSize: params.squareSize,
      density: params.density,
      evenDensity: params.evenDensity,
      minOpacity: params.minOpacity,
      depthThreshold: params.depthThreshold,
      autoSpin: params.autoSpin,
      spinSpeed: params.spinSpeed,
      invertX: params.invertX,
      invertPitch: params.invertPitch,
      invertYaw: params.invertYaw,
      excludedText: params.excludedText,
      forcedText: params.forcedText,
      useForced: params.useForced,
      pinRadius: params.pinRadius,
      pinEmojiScale: params.pinEmojiScale,
      surfaceOrient: params.surfaceOrient,
      surfaceSkew: params.surfaceSkew
    }
  };

  savedPresets[cleanName] = presetObj;
  savePresetsToStorage();
  params.selectedPreset = cleanName;
  updatePresetDropdownUI();
  showToast(`Preset "${cleanName}" salvo localmente.`);
}

function loadPreset(name) {
  const preset = savedPresets[name];
  if (!preset) {
    showToast(`Preset "${name}" não encontrado.`);
    return;
  }

  const p = preset.params;
  if (p) {
    if (p.useEmojis !== undefined) params.useEmojis = p.useEmojis;
    if (p.renderModeText !== undefined) {
      if (p.renderModeText === 'Emojis Coloridos') params.renderModeText = 'Colorido';
      else if (p.renderModeText === 'Emojis Tintados') params.renderModeText = 'Tintado';
      else if (p.renderModeText === 'Cores Originais') params.renderModeText = 'Original';
      else params.renderModeText = p.renderModeText;
    }
    if (p.renderMode !== undefined) params.renderMode = p.renderMode;
    if (p.distModeText !== undefined) params.distModeText = p.distModeText;
    if (p.distMode !== undefined) params.distMode = p.distMode;
    if (p.emojiVariety !== undefined) params.emojiVariety = p.emojiVariety;
    if (p.tintIntensity !== undefined) params.tintIntensity = p.tintIntensity;
    if (p.alphaCutoff !== undefined) params.alphaCutoff = p.alphaCutoff;
    if (p.lockSH !== undefined) params.lockSH = p.lockSH;
    if (p.hueShift !== undefined) params.hueShift = p.hueShift;
    if (p.saturation !== undefined) params.saturation = p.saturation;
    if (p.brightness !== undefined) params.brightness = p.brightness;
    if (p.contrast !== undefined) params.contrast = p.contrast;
    if (p.gamma !== undefined) params.gamma = p.gamma;
    if (p.squareSize !== undefined) params.squareSize = p.squareSize;
    if (p.density !== undefined) params.density = p.density;
    if (p.evenDensity !== undefined) params.evenDensity = p.evenDensity;
    if (p.minOpacity !== undefined) params.minOpacity = p.minOpacity;
    if (p.depthThreshold !== undefined) params.depthThreshold = p.depthThreshold;
    if (p.autoSpin !== undefined) params.autoSpin = p.autoSpin;
    if (p.spinSpeed !== undefined) params.spinSpeed = p.spinSpeed;
    if (p.invertX !== undefined) params.invertX = p.invertX;
    if (p.invertPitch !== undefined) params.invertPitch = p.invertPitch;
    if (p.invertYaw !== undefined) params.invertYaw = p.invertYaw;
    if (p.excludedText !== undefined) params.excludedText = p.excludedText;
    if (p.forcedText !== undefined) params.forcedText = p.forcedText;
    if (p.useForced !== undefined) params.useForced = p.useForced;
    if (p.pinRadius !== undefined) params.pinRadius = p.pinRadius;
    if (p.pinEmojiScale !== undefined) params.pinEmojiScale = p.pinEmojiScale;
    if (p.surfaceOrient !== undefined) params.surfaceOrient = p.surfaceOrient;
    if (p.surfaceSkew !== undefined) params.surfaceSkew = p.surfaceSkew;
    if (p.bakeRotation !== undefined) params.bakeRotation = p.bakeRotation;
  }

  lockSHCamPos = computeLockSHCamPos();
  computeBakeBasis();

  params.selectedPreset = name;

  if (splatEntity) {
    splatEntity.setLocalEulerAngles(params.invertX ? 180 : 0, 0, 0);
  }

  rebuildColorLUT(params.excludedText, params.forcedText, params.useForced);
  applyShaderParams();
  updatePinnedUniforms();
  updateSplatCountDisplay();

  if (typeof guiControllers !== 'undefined') {
    Object.keys(guiControllers).forEach(key => {
      if (guiControllers[key] && typeof guiControllers[key].updateDisplay === 'function') {
        guiControllers[key].updateDisplay();
      }
    });
  }

  const searchInput = document.getElementById('emoji-modal-search-input');
  const headerToggle = document.getElementById('emoji-modal-use-forced-toggle');
  if (headerToggle) headerToggle.checked = params.useForced;
  if (typeof renderEmojiModal === 'function') {
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  }

  showToast(`Preset "${name}" carregado.`);
}

function deletePreset(name) {
  if (!savedPresets[name]) {
    showToast(`Preset "${name}" não existe.`);
    return;
  }
  delete savedPresets[name];
  savePresetsToStorage();

  const remaining = Object.keys(savedPresets);
  params.selectedPreset = remaining.length > 0 ? remaining[0] : '';
  updatePresetDropdownUI();
  showToast(`Preset "${name}" excluído.`);
}

function updatePresetDropdownUI() {
  if (typeof guiControllers === 'undefined' || !guiControllers.selectedPreset) return;
  const names = Object.keys(savedPresets);
  if (names.length === 0) names.push('(Nenhum salvo)');

  guiControllers.selectedPreset.options(names);
  if (names.includes(params.selectedPreset)) {
    guiControllers.selectedPreset.setValue(params.selectedPreset);
  } else {
    params.selectedPreset = names[0];
    guiControllers.selectedPreset.setValue(names[0]);
  }
}

function exportPresetJSON() {
  const curPresetName = params.selectedPreset || 'Meu Preset';
  const exportData = {
    appName: 'EmojiCloud Effect Lab',
    version: '2.0',
    preset: {
      name: curPresetName,
      createdAt: new Date().toISOString(),
      params: {
        useEmojis: params.useEmojis,
        renderModeText: params.renderModeText,
        renderMode: params.renderMode,
        tintIntensity: params.tintIntensity,
        alphaCutoff: params.alphaCutoff,
        lockSH: params.lockSH,
        hueShift: params.hueShift,
        saturation: params.saturation,
        brightness: params.brightness,
        contrast: params.contrast,
        gamma: params.gamma,
        squareSize: params.squareSize,
        density: params.density,
        evenDensity: params.evenDensity,
        minOpacity: params.minOpacity,
        depthThreshold: params.depthThreshold,
        autoSpin: params.autoSpin,
        spinSpeed: params.spinSpeed,
        invertX: params.invertX,
        invertPitch: params.invertPitch,
        invertYaw: params.invertYaw,
        excludedText: params.excludedText,
        forcedText: params.forcedText,
        useForced: params.useForced,
        pinRadius: params.pinRadius,
        pinEmojiScale: params.pinEmojiScale,
        surfaceOrient: params.surfaceOrient,
        surfaceSkew: params.surfaceSkew
      }
    }
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `preset_${curPresetName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.json`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exportado como "${filename}".`);
}

function importPresetJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const pData = data.preset || data;
      const name = pData.name || file.name.replace(/\.json$/i, '');
      savedPresets[name] = pData;
      savePresetsToStorage();
      params.selectedPreset = name;
      updatePresetDropdownUI();
      loadPreset(name);
      showToast(`Preset "${name}" importado com sucesso.`);
    } catch (err) {
      console.error('[Effect Lab] Falha ao importar JSON:', err);
      showToast('Erro: Arquivo JSON de preset inválido.');
    }
  };
  reader.readAsText(file);
}
