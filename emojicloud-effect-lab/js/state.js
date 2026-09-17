/**
 * Effect Lab - State & Global Parameter Definitions
 */

// PlayCanvas & Scene References
let app = null;
let cameraEntity = null;
let splatPivot = null;
let splatEntity = null;
let currentAsset = null;
let modelRadius = 0.5;
let modelCenter = { x: 0, y: 0, z: 0 };
let splatCenters = null;

// Texture Atlas & LUT References
let atlasTexture = null;
let lutTexture = null;
let atlasMetadata = null;

let numAtlasEmojis = 0;
let emojiLabL = null;
let emojiLabA = null;
let emojiLabB = null;
let emojiCols = null;
let emojiRows = null;
let emojiNamesList = [];
let emojiSurrogatesList = [];
let emojiAllNamesList = [];
let emojiCodepointsList = [];
let slotEmojiMap = new Map();
let excludedIndicesSet = new Set();
let forcedIndicesSet = new Set();
let categoryIndicesMap = {};

// LUT Constants & Buffers
const LUT_RES = 16;
const voxelLabL = new Float32Array(4096);
const voxelLabA = new Float32Array(4096);
const voxelLabB = new Float32Array(4096);
const lutBuffer = new Uint8Array(256 * 16 * 4);

// Active Tool State
let currentActiveTool = 'navigate';
let isPickerActive = false;
let isLassoActive = false;

// Modal & Color State
let currentActiveModalTag = '';
let currentActiveModalColor = '#ff0000';
let isColorFilterActive = true;
let selectedHexColor = '#ff0000';
let currentColorHue = 0;
let currentColorSat = 1.0;
let currentColorVal = 1.0;
let activeColorMode = 'wheel';
let hideBlockedEmojis = false;

// Render Mode Map
const renderModeMap = {
  'Colorido': 0,
  'Tintado': 1,
  'Original': 2
};

// Distribution Mode Map (Fidelidade de Cor, Luminância / Sombra, Aleatório / Mosaico)
const distModeMap = {
  'Fidelidade de Cor': 0,
  'Luminância / Sombra': 1,
  'Aleatório / Mosaico': 2
};

// Main Lab Parameter Object
const params = {
  useEmojis: true,
  renderModeText: 'Colorido',
  renderMode: 0,
  distModeText: 'Fidelidade de Cor',
  distMode: 0,
  emojiVariety: 0.0,
  tintIntensity: 0.6,
  alphaCutoff: 0.10,

  lockSH: false,
  hueShift: 0.0,
  saturation: 1.0,
  brightness: 0.0,
  contrast: 1.0,
  gamma: 1.0,
  resetColors: function () {
    params.lockSH = false;
    params.hueShift = 0.0;
    params.saturation = 1.0;
    params.brightness = 0.0;
    params.contrast = 1.0;
    params.gamma = 1.0;
    params.distModeText = 'Fidelidade de Cor';
    params.distMode = 0;
    params.emojiVariety = 0.5;
    if (guiControllers.lockSH) guiControllers.lockSH.updateDisplay();
    if (guiControllers.hueShift) guiControllers.hueShift.updateDisplay();
    if (guiControllers.saturation) guiControllers.saturation.updateDisplay();
    if (guiControllers.brightness) guiControllers.brightness.updateDisplay();
    if (guiControllers.contrast) guiControllers.contrast.updateDisplay();
    if (guiControllers.gamma) guiControllers.gamma.updateDisplay();
    if (guiControllers.distModeText) guiControllers.distModeText.updateDisplay();
    if (guiControllers.emojiVariety) guiControllers.emojiVariety.updateDisplay();
    rebuildColorLUT(params.excludedText, params.forcedText, params.useForced);
    applyShaderParams();
  },

  gradientMap3D: false,
  gradientPreset: 'Roxo Neon',

  openEmojiModal: function (forceOpen) {
    const panel = document.getElementById('emoji-catalog-panel');
    if (panel) {
      if (forceOpen === true) {
        panel.style.display = 'flex';
      } else if (forceOpen === false) {
        panel.style.display = 'none';
        return;
      } else {
        panel.style.display = (panel.style.display === 'none' || panel.style.display === '') ? 'flex' : 'none';
      }

      if (panel.style.display === 'flex') {
        panel.classList.remove('minimized');
        const minBtn = document.getElementById('emoji-panel-min-btn');
        if (minBtn) minBtn.innerHTML = '&minus;';

        const toggle = document.getElementById('emoji-modal-use-forced-toggle');
        if (toggle) toggle.checked = params.useForced;

        const chkGrad3d = document.getElementById('chk-gradient-map-3d');
        if (chkGrad3d) chkGrad3d.checked = params.gradientMap3D;

        if (typeof drawColorBox === 'function') {
          drawColorBox(currentColorHue);
          updateCrosshairUI();
        }
        if (typeof updateHsbUi === 'function') {
          updateHsbUi(currentColorHue, currentColorSat, currentColorVal);
        }
        if (typeof renderGradientLibrary === 'function') {
          renderGradientLibrary();
          refreshGradientWidget();
        }

        const searchInput = document.getElementById('emoji-modal-search-input');
        if (typeof renderEmojiModal === 'function') {
          renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
        }
        if (searchInput) {
          searchInput.focus();
        }
      }
    }
  },

  excludedText: '',
  excludeFlagsPreset: function () {
    const flagsIndices = categoryIndicesMap['flags'] || [];
    for (let i = 0; i < flagsIndices.length; i++) {
      excludedIndicesSet.add(flagsIndices[i]);
    }
    syncExcludedTextFromSet();
    rebuildColorLUT();
    updateCategoryChipsUI();
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  },
  clearExclusions: function () {
    excludedIndicesSet.clear();
    params.excludedText = '';
    if (guiControllers.excludedText) guiControllers.excludedText.setValue('');
    rebuildColorLUT();
    updateCategoryChipsUI();
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  },

  useForced: true,
  forcedText: '',
  clearForced: function () {
    forcedIndicesSet.clear();
    params.forcedText = '';
    if (guiControllers.forcedText) guiControllers.forcedText.setValue('');
    rebuildColorLUT();
    const searchInput = document.getElementById('emoji-modal-search-input');
    renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
  },

  activeEmojisCount: '1944 / 1944',
  excludedCount: '0',
  forcedCount: '0',

  // Presets
  selectedPreset: 'Padrão',
  savePresetAction: function () {
    promptAndSavePreset();
  },
  loadPresetAction: function () {
    loadPreset(params.selectedPreset);
  },
  deletePresetAction: function () {
    deletePreset(params.selectedPreset);
  },
  exportPresetAction: function () {
    exportPresetJSON();
  },
  importPresetAction: function () {
    const input = document.getElementById('preset-file-input');
    if (input) input.click();
  },

  // Pins de Emojis
  pinRadius: 0.035,
  pinEmojiScale: 1,
  surfaceOrient: false,
  surfaceSkew: false,
  bakeRotation: false,
  bakeColors: false,

  // Capture: marcadores gerados em esfera ao redor de um ponto
  captureShow: false,
  captureX: 0,
  captureY: 0,
  captureZ: 0,
  captureCount: 8,
  captureRadius: 0.9,
  captureSize: 0.08,
  captureStartId: 0,
  captureExportId: 0,
  captureFaceFlip: false,
  captureFaceOutward: false,
  pinnedCountDisplay: '0 / 16 pins',
  clearAllPinsAction: function () {
    clearAllPinnedPoints();
  },

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
  resetCamera: function () {
    orbit.targetYaw = 25;
    orbit.targetPitch = 12;
    orbit.targetPan.set(0, 0, 0);
  },
  openFile: function () {
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.click();
  },
  splatCount: '0',
  fileName: 'head.sog'
};

let rawSplatCount = 511771;

function updateSplatCountDisplay() {
  if (!guiControllers.splatCount) return;
  if (params.density < 100) {
    const active = Math.round(rawSplatCount * (params.density / 100));
    params.splatCount = `${active.toLocaleString()} / ${rawSplatCount.toLocaleString()}`;
  } else {
    params.splatCount = rawSplatCount.toLocaleString();
  }
  guiControllers.splatCount.updateDisplay();
}

// Orbit Camera State
const orbit = {
  yaw: 25,
  pitch: 12,
  distance: 1.8,
  targetYaw: 25,
  targetPitch: 12,
  targetDistance: 1.8,
  minDistance: 0.05,
  maxDistance: 40.0,
  panTarget: (typeof pc !== 'undefined' && pc.Vec3) ? new pc.Vec3(0, 0, 0) : { x: 0, y: 0, z: 0, set: function(x,y,z){ this.x=x; this.y=y; this.z=z; }, lerp: function(){} },
  targetPan: (typeof pc !== 'undefined' && pc.Vec3) ? new pc.Vec3(0, 0, 0) : { x: 0, y: 0, z: 0, set: function(x,y,z){ this.x=x; this.y=y; this.z=z; } }
};
