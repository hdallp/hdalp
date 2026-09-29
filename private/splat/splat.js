import { SPLATS, DEFAULT_SPLAT_ID, INREF } from './splats-config.js';

// Hash SHA-256 da senha da página "gesla@2026"
const AUTH_PASSWORD_HASH = '6b41b044a79d6fdbf4c61d49bd4d3f0b52bd716c431f97e4cff594b49f297f8a';

// Hash SHA-256 padrão para splats bloqueados (senha: "781975")
const DEFAULT_LOCKED_SPLATS_HASH = '395d8c817d4e9577d849ac5fd592652df94f34e439101cd7b079f3680331169a';

let currentViewer = null;
let currentSplatId = null;
let isUnlocked = false;
let unlockedSplats = new Set();
let pendingSplatToUnlock = null;
let removeFloorGrid = null;

// Configuração completa e válida dos settings do SuperSplat Viewer
const BASE_SETTINGS = {
  version: 2,
  tonemapping: 'neutral',
  highPrecisionRendering: false,
  background: {
    color: [1, 1, 1] // Branco puro
  },
  postEffectSettings: {
    sharpness: { enabled: false, amount: 0 },
    bloom:     { enabled: false, intensity: 0.1, blurLevel: 2 },
    grading:   { enabled: false, brightness: 1, contrast: 1, saturation: 1, tint: [1, 1, 1] },
    vignette:  { enabled: false, intensity: 0.5, inner: 0.3, outer: 0.75, curvature: 1 },
    fringing:  { enabled: false, intensity: 0.5 }
  },
  animTracks: [],
  cameras: [
    {
      initial: {
        position: [0, 0, 1.8],
        target: [0, 0, 0],
        fov: 60
      }
    }
  ],
  annotations: [],
  startMode: 'default'
};

// Função auxiliar para calcular SHA-256
async function sha256(message) {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return null;
  }
}

// Extrai a contagem exata de pontos (splats) da instância do SuperSplat / PlayCanvas
function getDynamicSplatCount(viewer) {
  if (!viewer) return null;

  // 1. Acesso direto nas propriedades do viewer
  if (viewer.splat && typeof viewer.splat.numSplats === 'number') {
    return viewer.splat.numSplats;
  }
  if (typeof viewer.numSplats === 'number') {
    return viewer.numSplats;
  }

  const app = viewer.app;
  if (!app) return null;

  try {
    // 2. Registro de Assets do PlayCanvas
    if (app.assets) {
      const gsplatAssets = app.assets.findByType('gsplat');
      for (const a of gsplatAssets) {
        if (a.resource) {
          if (typeof a.resource.numSplats === 'number') return a.resource.numSplats;
          if (a.resource.meta && typeof a.resource.meta.count === 'number') return a.resource.meta.count;
          if (a.resource.splatData && typeof a.resource.splatData.numSplats === 'number') return a.resource.splatData.numSplats;
        }
      }
    }

    // 3. Hierarquia de entidades na cena (componente gsplat)
    if (app.root) {
      const gsplatComps = app.root.findComponents ? app.root.findComponents('gsplat') : [];
      for (const comp of gsplatComps) {
        if (comp.instance) {
          if (comp.instance.splat && typeof comp.instance.splat.numSplats === 'number') {
            return comp.instance.splat.numSplats;
          }
          if (typeof comp.instance.numSplats === 'number') {
            return comp.instance.numSplats;
          }
        }
      }
    }

    // 4. Draw calls na cena
    if (app.scene && app.scene.drawCalls) {
      for (const dc of app.scene.drawCalls) {
        if (dc.splat && typeof dc.splat.numSplats === 'number') {
          return dc.splat.numSplats;
        }
        if (dc._gsplat && typeof dc._gsplat.numSplats === 'number') {
          return dc._gsplat.numSplats;
        }
      }
    }
  } catch (e) {
    console.debug('Aguardando carregamento dos pontos 3D...', e);
  }

  return null;
}

// Cria e renderiza o grid 3D de referência do chão (XZ) sob o modelo
function attachWorldFloorGrid(viewer, customOptions = {}) {
  const app = viewer.app;
  if (!app) return null;

  let groundY = customOptions.y !== undefined ? customOptions.y : 0;
  const size = customOptions.size || 20;    // Tamanho total do grid em unidades do mundo
  const step = customOptions.step || 0.5;   // Espaçamento entre as linhas (0.5m)

  // Função para recalcular a altura do chão baseado no limite inferior da cena 3D (AABB)
  const computeGroundY = () => {
    try {
      if (app.root) {
        const comps = app.root.findComponents ? app.root.findComponents('gsplat') : [];
        for (const comp of comps) {
          if (comp.instance && comp.instance.aabb) {
            const min = comp.instance.aabb.getMin();
            if (min && typeof min.y === 'number' && isFinite(min.y)) {
              return min.y;
            }
          }
        }
      }
    } catch (e) {}
    return 0;
  };

  let positionsArray = null;
  let colorsArray = null;

  const buildGridGeometry = (yLevel) => {
    const positions = [];
    const colors = [];
    const half = size / 2;

    // Cores sutis para não competir com a renderização dos pontos
    const colSecondary = [225, 225, 225, 140]; // Linhas secundárias
    const colMajor = [170, 170, 170, 200];     // Linhas mestras a cada 5 passos
    const colX = [230, 80, 80, 220];           // Eixo X
    const colZ = [80, 120, 240, 220];          // Eixo Z

    for (let pos = -half; pos <= half; pos += step) {
      const isCenter = Math.abs(pos) < 0.001;
      const isMajor = Math.abs(Math.round(pos / step)) % 5 === 0;

      // Linhas paralelas ao eixo Z
      positions.push(pos, yLevel, -half, pos, yLevel, half);
      let col = isCenter ? colZ : (isMajor ? colMajor : colSecondary);
      colors.push(...col, ...col);

      // Linhas paralelas ao eixo X
      positions.push(-half, yLevel, pos, half, yLevel, pos);
      col = isCenter ? colX : (isMajor ? colMajor : colSecondary);
      colors.push(...col, ...col);
    }

    positionsArray = new Float32Array(positions);
    colorsArray = new Uint8Array(colors);
  };

  buildGridGeometry(groundY);

  let checkedAABB = false;

  const onUpdate = () => {
    if (!viewer || !viewer.app) return;

    // Ajusta dinamicamente a altura para a base do modelo assim que o AABB for calculado
    if (!checkedAABB) {
      const modelY = computeGroundY();
      if (Math.abs(modelY - groundY) > 0.01) {
        groundY = modelY;
        buildGridGeometry(groundY);
        checkedAABB = true;
      }
    }

    try {
      if (typeof app.drawLineArrays === 'function' && positionsArray && colorsArray) {
        // depthTest = true garante que o modelo 3D fique POR CIMA do grid
        app.drawLineArrays(positionsArray, colorsArray, true);
      }
    } catch (e) {}
  };

  app.on('update', onUpdate);

  return () => {
    try {
      if (app && app.off) app.off('update', onUpdate);
    } catch (e) {}
  };
}

// Configura o formulário do modal de senha da página
function initGate() {
  const gateOverlay = document.getElementById('gate-overlay');
  const gateForm = document.getElementById('gate-form');
  const gateInput = document.getElementById('gate-password');
  const gateError = document.getElementById('gate-error');

  if (gateInput) {
    setTimeout(() => gateInput.focus(), 200);
  }

  if (gateForm) {
    gateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const enteredPassword = gateInput.value.trim();
      if (!enteredPassword) return;

      const enteredHash = await sha256(enteredPassword);

      if (enteredHash === AUTH_PASSWORD_HASH) {
        isUnlocked = true;
        gateError.textContent = '';
        gateInput.classList.remove('error');
        unlockExperience();
      } else {
        gateInput.classList.add('error');
        gateError.textContent = 'Senha incorreta.';
        gateInput.value = '';
        gateInput.focus();
        setTimeout(() => gateInput.classList.remove('error'), 400);
      }
    });
  }
}

// Configura o modal de senha para splats bloqueados individualmente
function initSplatLockModal() {
  const modal = document.getElementById('splat-lock-modal');
  const form = document.getElementById('splat-lock-form');
  const input = document.getElementById('splat-lock-password');
  const error = document.getElementById('splat-lock-error');
  const closeBtn = document.getElementById('splat-lock-close');

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (modal) modal.classList.remove('active');
      pendingSplatToUnlock = null;
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!pendingSplatToUnlock) return;

      const entered = input.value.trim();
      if (!entered) return;

      const hash = await sha256(entered);
      const expectedHash = pendingSplatToUnlock.passwordHash || DEFAULT_LOCKED_SPLATS_HASH;

      if (hash === expectedHash) {
        unlockedSplats.add(pendingSplatToUnlock.id);
        if (window.SPLAT_ASIDE) {
          window.SPLAT_ASIDE.unlockItem(pendingSplatToUnlock.id, pendingSplatToUnlock.title);
        }
        modal.classList.remove('active');
        input.value = '';
        error.textContent = '';
        const targetId = pendingSplatToUnlock.id;
        pendingSplatToUnlock = null;
        loadSplat(targetId);
      } else {
        input.classList.add('error');
        error.textContent = 'Senha incorreta.';
        input.value = '';
        input.focus();
        setTimeout(() => input.classList.remove('error'), 400);
      }
    });
  }
}

function promptSplatUnlock(splat) {
  pendingSplatToUnlock = splat;
  const modal = document.getElementById('splat-lock-modal');
  const input = document.getElementById('splat-lock-password');
  const error = document.getElementById('splat-lock-error');

  if (error) error.textContent = '';
  if (input) {
    input.value = '';
    input.classList.remove('error');
  }
  if (modal) {
    modal.classList.add('active');
    setTimeout(() => {
      if (input) input.focus();
    }, 200);
  }
}

// Desbloqueia a visualização e inicia os componentes
function unlockExperience() {
  const gateOverlay = document.getElementById('gate-overlay');
  if (gateOverlay) {
    gateOverlay.classList.add('hidden');
  }

  // Inicializa o Aside com a lista de splats
  if (window.SPLAT_ASIDE) {
    const asideItems = SPLATS.map(s => ({
      id: s.id,
      title: s.title,
      locked: !!s.locked,
      unlocked: unlockedSplats.has(s.id),
      stretch: 96
    }));

    const urlParams = new URLSearchParams(window.location.search);
    const requestedModel = urlParams.get('model') || DEFAULT_SPLAT_ID;
    const initialSplat = SPLATS.find(s => s.id === requestedModel) || SPLATS[0];

    window.SPLAT_ASIDE.setItems(asideItems, initialSplat.id);
    window.SPLAT_ASIDE.enter(); // Dispara a animação fluida de entrada do aside
  }

  // Carrega o Splat inicial (se não for bloqueado)
  const urlParams = new URLSearchParams(window.location.search);
  const requestedModel = urlParams.get('model') || DEFAULT_SPLAT_ID;
  const initial = SPLATS.find(s => s.id === requestedModel) || SPLATS[0];

  if (initial && initial.locked && !unlockedSplats.has(initial.id)) {
    // Se o primeiro for bloqueado, tenta carregar o primeiro desbloqueado ou pede senha
    const firstUnlocked = SPLATS.find(s => !s.locked);
    if (firstUnlocked) {
      loadSplat(firstUnlocked.id);
    } else {
      promptSplatUnlock(initial);
    }
  } else {
    loadSplat(requestedModel);
  }
}

// Função para alternar entre os splats
async function loadSplat(splatId) {
  if (!isUnlocked) return;

  const targetSplat = SPLATS.find(s => s.id === splatId) || SPLATS[0];
  if (!targetSplat) return;

  // Se o splat for bloqueado e não foi desbloqueado nesta sessão, solicita senha
  if (targetSplat.locked && !unlockedSplats.has(targetSplat.id)) {
    promptSplatUnlock(targetSplat);
    return;
  }

  if (currentSplatId === targetSplat.id && currentViewer) {
    if (typeof currentViewer.resetCamera === 'function') {
      currentViewer.resetCamera();
    }
    return;
  }

  currentSplatId = targetSplat.id;

  // Atualiza URL sem recarregar a página
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.set('model', targetSplat.id);
  window.history.pushState({ model: targetSplat.id }, '', newUrl.toString());

  // Atualiza estado visual no Aside
  if (window.SPLAT_ASIDE) {
    window.SPLAT_ASIDE.setActive(targetSplat.id);
  }

  // Atualiza informações técnicas (INREF e quantidade de pontos/splats)
  const inrefEl = document.getElementById('info-inref');
  const countEl = document.getElementById('info-count');
  if (inrefEl) inrefEl.textContent = targetSplat.inref || INREF || '---';

  const formatPoints = (val) => {
    if (typeof val === 'number') {
      return new Intl.NumberFormat('pt-BR').format(val);
    }
    return val || '---';
  };

  if (countEl) {
    countEl.textContent = formatPoints(targetSplat.splats || targetSplat.points);
  }

  // Exibe loading overlay
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) loadingOverlay.classList.add('visible');

  const container = document.getElementById('viewer-container');

  // Destrói instância anterior para liberar memória GPU/WebGL
  if (removeFloorGrid) {
    removeFloorGrid();
    removeFloorGrid = null;
  }

  if (currentViewer) {
    try {
      if (typeof currentViewer.destroy === 'function') {
        currentViewer.destroy();
      }
    } catch (e) {
      console.warn('Erro ao destruir viewer anterior:', e);
    }
    currentViewer = null;
    container.innerHTML = '';
  }

  try {
    // Importa o visualizador dinamicamente após desbloqueio
    const module = await import('https://cdn.jsdelivr.net/npm/@playcanvas/supersplat-viewer/public/index.js');
    const { createViewer } = module;

    // Constrói objeto de settings completo com validação
    const viewerSettings = JSON.parse(JSON.stringify(BASE_SETTINGS));

    if (targetSplat.settings) {
      if (targetSplat.settings.camera) {
        viewerSettings.cameras = [{ initial: targetSplat.settings.camera }];
      }
      if (targetSplat.settings.background) {
        viewerSettings.background = targetSplat.settings.background;
      }
    }

    const viewerOptions = {
      container: container,
      contentUrl: targetSplat.file,
      ui: true,              // Controles visíveis da interface do SuperSplat
      reticle: true,         // Grid / retícula no visualizador
      renderer: 'webgpu',    // WebGPU com fallback automático para WebGL
      hpr: true,
      settings: viewerSettings,
      exposeGlobals: true
    };

    currentViewer = await createViewer(viewerOptions);

    // Grid 3D do mundo no chão desativado (comentado a pedido)
    // removeFloorGrid = attachWorldFloorGrid(currentViewer);

    // Detecção dinâmica dos pontos (splats) do arquivo 3D carregado
    const updateDynamicCount = () => {
      if (!countEl) return;
      const points = getDynamicSplatCount(currentViewer);
      if (typeof points === 'number' && points > 0) {
        countEl.textContent = formatPoints(points);
        return true;
      }
      return false;
    };

    // Tenta obter de imediato
    if (!updateDynamicCount()) {
      let attempts = 0;
      const pollInterval = setInterval(() => {
        attempts++;
        if (updateDynamicCount() || attempts > 20) {
          clearInterval(pollInterval);
        }
      }, 200);

      if (currentViewer.events && typeof currentViewer.events.on === 'function') {
        currentViewer.events.on('state.loaded:changed', updateDynamicCount);
      }
    }
  } catch (err) {
    console.error('Falha ao inicializar SuperSplat Viewer:', err);
  } finally {
    if (loadingOverlay) {
      setTimeout(() => loadingOverlay.classList.remove('visible'), 250);
    }
  }
}

// Renderiza a lista de splats no modal mobile
function renderMobileSplatsList() {
  const listEl = document.getElementById('splat-mobile-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  SPLATS.forEach(splat => {
    const isLocked = splat.locked && !unlockedSplats.has(splat.id);
    const isActive = splat.id === currentSplatId;

    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    itemBtn.className = 'mobile-splat-item' + (isActive ? ' is-active' : '');

    const left = document.createElement('div');
    left.className = 'item-left';

    if (isLocked) {
      left.innerHTML = '<svg class="lock-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg><span class="redacted-box"></span>';
    } else {
      left.textContent = splat.title;
    }

    const inref = document.createElement('span');
    inref.className = 'item-inref';
    inref.textContent = splat.inref || INREF || '';

    itemBtn.appendChild(left);
    if (splat.inref || INREF) itemBtn.appendChild(inref);

    itemBtn.addEventListener('click', () => {
      const mobileOverlay = document.getElementById('splat-mobile-overlay');
      if (mobileOverlay) mobileOverlay.classList.remove('active');

      if (isLocked) {
        promptSplatUnlock(splat);
      } else {
        loadSplat(splat.id);
      }
    });

    listEl.appendChild(itemBtn);
  });
}

function initMobileMenu() {
  const overlay = document.getElementById('splat-mobile-overlay');
  const closeBtn = document.getElementById('splat-mobile-close');

  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('active');
    });
  }

  window.openMobileSplatsMenu = function () {
    renderMobileSplatsList();
    if (overlay) overlay.classList.add('active');
  };
}

// Suporte para navegação pelo histórico (botão voltar/avançar do navegador)
window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  const modelId = params.get('model') || DEFAULT_SPLAT_ID;
  if (isUnlocked) {
    loadSplat(modelId);
  }
});

// Expõe a função para o aside-splat.js
window.selectSplat = loadSplat;

// Inicializa no carregamento da página
document.addEventListener('DOMContentLoaded', () => {
  initGate();
  initSplatLockModal();
  initMobileMenu();
});
