/**
 * Effect Lab - PlayCanvas 3D Viewer, Scene Lifecycle, Camera Orbit & Controls
 */

function createLUTTexture() {
  if (!app || !app.graphicsDevice || lutTexture) return;

  lutTexture = new pc.Texture(app.graphicsDevice, {
    width: 256,
    height: 16,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: false,
    minFilter: pc.FILTER_NEAREST,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE
  });
}

function handleResize() {
  if (!app) return;
  app.resizeCanvas(window.innerWidth, window.innerHeight);
  const lc = document.getElementById('lasso-canvas');
  if (lc) {
    lc.width = window.innerWidth;
    lc.height = window.innerHeight;
  }
}

function updateCamera() {
  if (!cameraEntity) return;
  const pc = window.pc;

  const radYaw = orbit.yaw * pc.math.DEG_TO_RAD;
  const radPitch = orbit.pitch * pc.math.DEG_TO_RAD;

  const xz = Math.cos(radPitch) * orbit.distance;
  const cx = Math.sin(radYaw) * xz;
  const cy = Math.sin(radPitch) * orbit.distance;
  const cz = Math.cos(radYaw) * xz;

  cameraEntity.setPosition(
    orbit.panTarget.x + cx,
    orbit.panTarget.y + cy,
    orbit.panTarget.z + cz
  );
  cameraEntity.lookAt(orbit.panTarget);
}

function applyShaderParams() {
  const camPos = cameraEntity ? cameraEntity.getPosition() : new pc.Vec3(0, 0, orbit.distance);
  const camDist = camPos.length();
  const radius = modelRadius > 0 ? modelRadius : 0.5;
  const minDepth = Math.max(0.01, camDist - radius);
  const maxDepth = camDist + radius;

  const activeRenderMode = params.useEmojis ? params.renderMode : 2;
  const centerArr = [modelCenter.x, modelCenter.y, modelCenter.z];

  const device = app ? app.graphicsDevice : null;
  if (device && device.scope) {
    device.scope.resolve('uSquareSize')?.setValue(params.squareSize);
    device.scope.resolve('uDensity')?.setValue(params.density / 100.0);
    device.scope.resolve('uEvenDensity')?.setValue(params.evenDensity ? 1.0 : 0.0);
    device.scope.resolve('uModelRadius')?.setValue(radius);
    device.scope.resolve('uModelCenter')?.setValue(centerArr);
    device.scope.resolve('uMinOpacity')?.setValue(params.minOpacity);
    device.scope.resolve('uDepthThreshold')?.setValue(params.depthThreshold);
    device.scope.resolve('uMinDepth')?.setValue(minDepth);
    device.scope.resolve('uMaxDepth')?.setValue(maxDepth);
    device.scope.resolve('uRenderMode')?.setValue(activeRenderMode);
    device.scope.resolve('uAlphaCutoff')?.setValue(params.alphaCutoff);
    device.scope.resolve('uTintIntensity')?.setValue(params.tintIntensity);
    device.scope.resolve('uLockSH')?.setValue(params.lockSH ? 1.0 : 0.0);
    device.scope.resolve('uLockSHCamPos')?.setValue(lockSHCamPos || [0, 0, 1]);
    device.scope.resolve('alphaClipForward')?.setValue(1e-12);
    device.scope.resolve('alphaClip')?.setValue(1e-12);

    device.scope.resolve('uHueShift')?.setValue(params.hueShift);
    device.scope.resolve('uSaturation')?.setValue(params.saturation);
    device.scope.resolve('uBrightness')?.setValue(params.brightness);
    device.scope.resolve('uContrast')?.setValue(params.contrast);
    device.scope.resolve('uGamma')?.setValue(params.gamma);

    if (atlasTexture) {
      device.scope.resolve('uEmojiAtlas')?.setValue(atlasTexture);
    }
    if (lutTexture) {
      device.scope.resolve('uColorLUT')?.setValue(lutTexture);
    }
  }

  if (splatEntity && splatEntity.gsplat) {
    try {
      splatEntity.gsplat.setParameter('uSquareSize', params.squareSize);
      splatEntity.gsplat.setParameter('uDensity', params.density / 100.0);
      splatEntity.gsplat.setParameter('uEvenDensity', params.evenDensity ? 1.0 : 0.0);
      splatEntity.gsplat.setParameter('uModelRadius', radius);
      splatEntity.gsplat.setParameter('uModelCenter', centerArr);
      splatEntity.gsplat.setParameter('uMinOpacity', params.minOpacity);
      splatEntity.gsplat.setParameter('uDepthThreshold', params.depthThreshold);
      splatEntity.gsplat.setParameter('uMinDepth', minDepth);
      splatEntity.gsplat.setParameter('uMaxDepth', maxDepth);
      splatEntity.gsplat.setParameter('uRenderMode', activeRenderMode);
      splatEntity.gsplat.setParameter('uAlphaCutoff', params.alphaCutoff);
      splatEntity.gsplat.setParameter('uTintIntensity', params.tintIntensity);
      splatEntity.gsplat.setParameter('uLockSH', params.lockSH ? 1.0 : 0.0);
      splatEntity.gsplat.setParameter('uLockSHCamPos', lockSHCamPos || [0, 0, 1]);
      splatEntity.gsplat.setParameter('alphaClipForward', 1e-12);
      splatEntity.gsplat.setParameter('alphaClip', 1e-12);
      splatEntity.gsplat.setParameter('uHueShift', params.hueShift);
      splatEntity.gsplat.setParameter('uSaturation', params.saturation);
      splatEntity.gsplat.setParameter('uBrightness', params.brightness);
      splatEntity.gsplat.setParameter('uContrast', params.contrast);
      splatEntity.gsplat.setParameter('uGamma', params.gamma);
      if (atlasTexture) splatEntity.gsplat.setParameter('uEmojiAtlas', atlasTexture);
      if (lutTexture) splatEntity.gsplat.setParameter('uColorLUT', lutTexture);
    } catch (e) {}

    try {
      if (splatEntity.gsplat.material) {
        const mat = splatEntity.gsplat.material;
        mat.setParameter('uSquareSize', params.squareSize);
        mat.setParameter('uDensity', params.density / 100.0);
        mat.setParameter('uEvenDensity', params.evenDensity ? 1.0 : 0.0);
        mat.setParameter('uModelRadius', radius);
        mat.setParameter('uModelCenter', centerArr);
        mat.setParameter('uMinOpacity', params.minOpacity);
        mat.setParameter('uDepthThreshold', params.depthThreshold);
        mat.setParameter('uMinDepth', minDepth);
        mat.setParameter('uMaxDepth', maxDepth);
        mat.setParameter('uRenderMode', activeRenderMode);
        mat.setParameter('uAlphaCutoff', params.alphaCutoff);
        mat.setParameter('uTintIntensity', params.tintIntensity);
        mat.setParameter('uLockSH', params.lockSH ? 1.0 : 0.0);
        mat.setParameter('uLockSHCamPos', lockSHCamPos || [0, 0, 1]);
        mat.setParameter('alphaClipForward', 1e-12);
        mat.setParameter('alphaClip', 1e-12);
        mat.setParameter('uHueShift', params.hueShift);
        mat.setParameter('uSaturation', params.saturation);
        mat.setParameter('uBrightness', params.brightness);
        mat.setParameter('uContrast', params.contrast);
        mat.setParameter('uGamma', params.gamma);
        if (atlasTexture) mat.setParameter('uEmojiAtlas', atlasTexture);
        if (lutTexture) mat.setParameter('uColorLUT', lutTexture);
        mat.blendType = pc.BLEND_NONE;
        mat.depthWrite = true;
      }
    } catch (e) {}
  }

  applyPinnedParams();
}

function showLoading(msg) {
  const loadingText = document.getElementById('loading-text');
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingText) loadingText.textContent = msg;
  if (loadingOverlay) loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

function loadSplatAsset(url, filename) {
  if (!app || !window.pc) return;
  const pc = window.pc;

  console.log('[Effect Lab] Iniciando carregamento do arquivo:', filename, 'URL:', url);
  showLoading('Carregando ' + filename + '...');

  if (splatEntity) {
    splatEntity.destroy();
    splatEntity = null;
  }

  if (currentAsset) {
    app.assets.remove(currentAsset);
    currentAsset = null;
  }

  const lowerName = (filename || url).toLowerCase();
  let parserType = 'ply';
  if (lowerName.includes('.sog')) parserType = 'sog';
  else if (lowerName.includes('.ply')) parserType = 'ply';
  else if (lowerName.includes('.json')) parserType = 'json';

  const gsplatHandler = app.loader ? app.loader.getHandler('gsplat') : null;
  if (gsplatHandler) {
    if (!gsplatHandler._origGetParser) {
      gsplatHandler._origGetParser = gsplatHandler._getParser.bind(gsplatHandler);
    }
    gsplatHandler._getParser = function (reqUrl) {
      const reqLower = (reqUrl || '').toLowerCase();
      if (reqLower.includes('.sog') || lowerName.includes('.sog')) return this.parsers.sog;
      if (reqLower.includes('.ply') || lowerName.includes('.ply')) return this.parsers.ply;
      if (reqLower.includes('.json') || lowerName.includes('.json')) return this.parsers.json;
      return this.parsers[parserType] || this._origGetParser(reqUrl);
    };
  }

  const asset = new pc.Asset('splat-' + Date.now(), 'gsplat', {
    url: url,
    filename: filename,
    original: filename
  });
  asset.file = { url: url, filename: filename, original: filename };

  currentAsset = asset;
  app.assets.add(asset);
  app.assets.load(asset);

  asset.ready(() => {
    console.log('[Effect Lab] Asset carregado pelo PlayCanvas.');
    splatEntity = new pc.Entity('SplatModel');
    splatEntity.addComponent('gsplat', { asset: asset });
    splatPivot.addChild(splatEntity);

    splatEntity.setLocalEulerAngles(params.invertX ? 180 : 0, 0, 0);

    const resource = asset.resource;
    let count = 0;

    if (resource) {
      if (resource.centers) {
        splatCenters = resource.centers;
      } else if (resource.gsplatData && typeof resource.gsplatData.getCenters === 'function') {
        splatCenters = resource.gsplatData.getCenters();
      } else if (resource.gsplatData && resource.gsplatData.centers) {
        splatCenters = resource.gsplatData.centers;
      }
      console.log('[Effect Lab] splatCenters carregado:', splatCenters ? `${splatCenters.length / 3} splats` : 'não disponível na CPU (usando fallback de tela)');

      if (resource.aabb) {
        const aabb = resource.aabb;
        modelRadius = Math.max(0.2, aabb.halfExtents.length());
        modelCenter.x = aabb.center.x;
        modelCenter.y = aabb.center.y;
        modelCenter.z = aabb.center.z;
        splatEntity.setLocalPosition(-aabb.center.x, -aabb.center.y, -aabb.center.z);

        const fovRad = (cameraEntity.camera.fov / 2) * (Math.PI / 180);
        const idealDist = Math.max(0.5, (modelRadius / Math.sin(fovRad)) * 1.15);
        orbit.distance = idealDist;
        orbit.targetDistance = idealDist;
        orbit.minDistance = Math.max(0.05, idealDist * 0.08);
        orbit.maxDistance = idealDist * 12;
      }

      if (resource.gsplatData && resource.gsplatData.numSplats) {
        count = resource.gsplatData.numSplats;
      } else if (resource.numSplats) {
        count = resource.numSplats;
      }
    }

    orbit.targetPan.set(0, 0, 0);
    orbit.panTarget.set(0, 0, 0);
    orbit.targetYaw = 25;
    orbit.targetPitch = 12;

    pinnedPointsList.forEach(p => { p._sphereCache = null; p._sphereRadius = undefined; });
    lockSHCamPos = computeLockSHCamPos();
    computeBakeBasis();
    buildCaptureMarkers();
    applySplatSHBands(resource, splatEntity);
    pinMapTexture = null;
    pinMapData = null;
    pinMapW = 0;
    pinMapH = 0;
    updatePinnedUniforms();

    applyShaderParams();

    params.fileName = filename;
    rawSplatCount = count || 511771;
    updateSplatCountDisplay();
    if (guiControllers.fileName) guiControllers.fileName.updateDisplay();

    hideLoading();
  });

  asset.on('error', (err) => {
    console.error('[Effect Lab] Erro ao carregar asset:', err);
    showLoading('Erro ao carregar ' + filename);
  });
}

function setupInteractionControls() {
  const canvas = document.getElementById('splat-canvas');
  if (!canvas) return;

  let isDragging = false;
  let isPanning = false;
  let lastX = 0;
  let lastY = 0;
  let startX = 0;
  let startY = 0;
  let lastPinchDist = null;

  canvas.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (currentActiveTool === 'lasso' && e.button === 0) {
      isDrawingLasso = true;
      lassoPoints = [{ x: e.clientX, y: e.clientY }];
      drawLassoPolygon(lassoPoints);
      return;
    }

    if (currentActiveTool === 'inspector' && e.button === 0) {
      return;
    }

    isDragging = true;
    isPanning = (e.button === 2 || e.shiftKey);
  });

  window.addEventListener('mousemove', (e) => {
    if (currentActiveTool === 'lasso' && isDrawingLasso) {
      const last = lassoPoints[lassoPoints.length - 1];
      const dist = last ? Math.hypot(e.clientX - last.x, e.clientY - last.y) : 999;
      if (dist > 3) {
        lassoPoints.push({ x: e.clientX, y: e.clientY });
        drawLassoPolygon(lassoPoints);
      }
      return;
    }

    if (currentActiveTool === 'inspector' && !isDragging) {
      updatePickerHover(e.clientX, e.clientY);
    }

    if (!isDragging) return;

    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (isPanning) {
      const panSpeed = orbit.distance * 0.0015;
      const right = cameraEntity.right;
      const up = cameraEntity.up;

      orbit.targetPan.x -= (right.x * dx - up.x * dy) * panSpeed;
      orbit.targetPan.y -= (right.y * dx - up.y * dy) * panSpeed;
      orbit.targetPan.z -= (right.z * dx - up.z * dy) * panSpeed;
    } else {
      const yawFactor = params.invertYaw ? 0.35 : -0.35;
      const pitchFactor = params.invertPitch ? -0.35 : 0.35;

      orbit.targetYaw += dx * yawFactor;
      orbit.targetPitch = Math.max(-89, Math.min(89, orbit.targetPitch + dy * pitchFactor));
    }
  });

  canvas.addEventListener('mouseleave', () => {
    if (currentActiveTool === 'inspector') {
      hidePickerHover();
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (currentActiveTool === 'lasso' && isDrawingLasso) {
      isDrawingLasso = false;
      if (lassoPoints.length >= 3) {
        drawLassoPolygon(lassoPoints);
        const region = sampleLassoRegion(lassoPoints);
        clearLassoCanvas();
        if (region) {
          pendingPinPoint = region;
          openEmojiModalForPin();
        } else {
          showToast('Nenhum ponto 3D detectado na seleção.');
        }
      } else {
        clearLassoCanvas();
      }
      return;
    }

    const moveDist = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (currentActiveTool === 'inspector' && moveDist < 6 && e.button === 0) {
      handlePickerClick(e);
    }

    isDragging = false;
    isPanning = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    orbit.targetDistance = Math.max(
      orbit.minDistance,
      Math.min(orbit.maxDistance, orbit.targetDistance * zoomFactor)
    );
  }, { passive: false });

  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      isPanning = false;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;
      startX = lastX;
      startY = lastY;
    } else if (e.touches.length === 2) {
      isDragging = false;
      lastPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - lastX;
      const dy = e.touches[0].clientY - lastY;
      lastX = e.touches[0].clientX;
      lastY = e.touches[0].clientY;

      const yawFactor = params.invertYaw ? 0.4 : -0.4;
      const pitchFactor = params.invertPitch ? -0.4 : 0.4;

      orbit.targetYaw += dx * yawFactor;
      orbit.targetPitch = Math.max(-89, Math.min(89, orbit.targetPitch + dy * pitchFactor));
    } else if (e.touches.length === 2 && lastPinchDist) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const pinchFactor = lastPinchDist / currentDist;
      orbit.targetDistance = Math.max(
        orbit.minDistance,
        Math.min(orbit.maxDistance, orbit.targetDistance * pinchFactor)
      );
      lastPinchDist = currentDist;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', () => {
    isDragging = false;
    lastPinchDist = null;
  });

  const hudClose = document.getElementById('tool-hud-close-btn');
  if (hudClose) {
    hudClose.addEventListener('click', (e) => {
      e.stopPropagation();
      setActiveTool('navigate');
    });
  }

  const actionClose = document.getElementById('picker-action-close-btn');
  if (actionClose) {
    actionClose.addEventListener('click', (e) => {
      e.stopPropagation();
      hidePickerActionMenu();
    });
  }

  const btnPin = document.getElementById('picker-btn-pin');
  if (btnPin) {
    btnPin.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeActionMenuEmoji && activeActionMenuPos) {
        addOrUpdatePinnedPoint(activeActionMenuPos.x, activeActionMenuPos.y, activeActionMenuPos.z, activeActionMenuEmoji, params.pinRadius);
      }
      hidePickerActionMenu();
    });
  }

  const btnChoose = document.getElementById('picker-btn-choose');
  if (btnChoose) {
    btnChoose.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!activeActionMenuPos) {
        showToast('Não consegui pegar a posição 3D desse ponto. Tente clicar de novo.');
        hidePickerActionMenu();
        return;
      }

      try {
        const hex = (activeActionMenuEmoji && activeActionMenuEmoji.avgColor && activeActionMenuEmoji.avgColor.hex) || '';
        if (hex) setColorFromHex(hex, false);
      } catch (err) {
        try { resetColorFilter(); } catch (e2) {}
      }

      pendingPinPoint = activeActionMenuPos;
      hidePickerActionMenu();
      openEmojiModalForPin();

      const grid = document.getElementById('emoji-modal-grid');
      if (grid && grid.querySelectorAll('img').length === 0) {
        showToast('Nenhum emoji nessa cor — mostrando todos.');
        try { resetColorFilter(); } catch (e3) {}
        openEmojiModalForPin();
      }
    });
  }

  const btnBlock = document.getElementById('picker-btn-block');
  if (btnBlock) {
    btnBlock.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeActionMenuEmoji) {
        window.__toggleExclusion(activeActionMenuEmoji.name);
      }
      hidePickerActionMenu();
    });
  }

  const btnForce = document.getElementById('picker-btn-force');
  if (btnForce) {
    btnForce.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeActionMenuEmoji) {
        window.__toggleForced(activeActionMenuEmoji.name);
      }
      hidePickerActionMenu();
    });
  }

  const btnUnpin = document.getElementById('picker-btn-unpin');
  if (btnUnpin) {
    btnUnpin.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeActionMenuPos) {
        const near = findPinnedPointNear(activeActionMenuPos);
        if (near) removePinnedPoint(near.point.id);
      }
      hidePickerActionMenu();
    });
  }

  const pinCancelBtn = document.getElementById('modal-pin-cancel-btn');
  if (pinCancelBtn) {
    pinCancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pendingPinPoint = null;
      const pinBanner = document.getElementById('modal-pin-banner');
      if (pinBanner) pinBanner.style.display = 'none';
      const searchInput = document.getElementById('emoji-modal-search-input');
      renderEmojiModal(searchInput ? searchInput.value : '', currentActiveModalTag, currentActiveModalColor);
    });
  }

  const presetFileInput = document.getElementById('preset-file-input');
  if (presetFileInput) {
    presetFileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        importPresetJSON(file);
        e.target.value = '';
      }
    });
  }

  window.addEventListener('keydown', (e) => {
    const isInputFocused = ['input', 'textarea', 'select'].includes(document.activeElement?.tagName?.toLowerCase());

    if (e.key === 'Escape') {
      if (isInputFocused) {
        document.activeElement.blur();
        return;
      }
      hidePickerActionMenu();
      clearLassoCanvas();
      isDrawingLasso = false;
      setActiveTool('navigate');

      pendingPinPoint = null;
      const pinBanner = document.getElementById('modal-pin-banner');
      if (pinBanner) pinBanner.style.display = 'none';
      const panel = document.getElementById('emoji-catalog-panel');
      if (panel && panel.style.display !== 'none') {
        panel.style.display = 'none';
      }
      return;
    }

    if (isInputFocused || e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key.toLowerCase();
    if (key === 'h') {
      document.body.classList.toggle('ui-hidden');
      const isHidden = document.body.classList.contains('ui-hidden');
      showToast(isHidden ? 'Interface oculta (H para restaurar)' : 'Interface visível');
    } else if (key === 'v') {
      setActiveTool('navigate');
    } else if (key === 'i') {
      setActiveTool(currentActiveTool === 'inspector' ? 'navigate' : 'inspector');
    } else if (key === 'l') {
      setActiveTool(currentActiveTool === 'lasso' ? 'navigate' : 'lasso');
    } else if (key === 'c') {
      params.openEmojiModal();
    } else if (key === 'r') {
      params.resetCamera();
    }
  });
}

function initPlayCanvas() {
  const pc = window.pc;
  if (!pc) {
    console.error('[Effect Lab] PlayCanvas não encontrado no escopo global.');
    return;
  }

  const canvas = document.getElementById('splat-canvas');
  if (!canvas) return;

  try {
    app = new pc.Application(canvas, {
      graphicsDeviceOptions: {
        deviceTypes: ['webgl2', 'webgl1'],
        alpha: false,
        antialias: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true
      }
    });
  } catch (e) {
    app = new pc.Application(canvas, {
      graphicsDeviceOptions: { preserveDrawingBuffer: true }
    });
  }

  if (pc.ShaderChunks) {
    try {
      const glslChunks = pc.ShaderChunks.get(app.graphicsDevice, 'glsl');
      if (glslChunks) {
        glslChunks.set('gsplatVS', customVSGLSL);
        glslChunks.set('gsplatCornerVS', customCornerVSGLSL);
        glslChunks.set('gsplatPS', customPSGLSL);
      }
      const wgslChunks = pc.ShaderChunks.get(app.graphicsDevice, 'wgsl');
      if (wgslChunks) {
        wgslChunks.set('gsplatCornerVS', customCornerVSWGSL);
        wgslChunks.set('gsplatPS', customPSWGSL);
      }
    } catch (e) {
      console.warn('[Effect Lab] Falha ao registrar chunks globais:', e);
    }
  }

  if (app.scene && app.scene.gsplat) {
    app.scene.gsplat.alphaClipForward = 0.0;
    app.scene.gsplat.alphaClip = 0.0;
    app.scene.gsplat.minPixelSize = 0.0;
  }

  if (app.systems.gsplat) {
    app.systems.gsplat.on('material:created', (material) => {
      if (gsplatMaterials.indexOf(material) === -1) gsplatMaterials.push(material);
      try {
        if (material.shaderChunks && material.shaderChunks.glsl) {
          material.shaderChunks.glsl.set('gsplatVS', customVSGLSL);
          material.shaderChunks.glsl.set('gsplatCornerVS', customCornerVSGLSL);
          material.shaderChunks.glsl.set('gsplatPS', customPSGLSL);
        }
        material.setParameter('alphaClipForward', 0.0);
        material.setParameter('alphaClip', 0.0);
        material.blendType = pc.BLEND_NONE;
        material.depthWrite = true;
        material.update();
      } catch (err) {
        console.warn('[Effect Lab] Erro no setup do material:', err);
      }
    });
  }

  app.setCanvasFillMode(pc.FILLMODE_NONE);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);
  app.start();

  cameraEntity = new pc.Entity('MainCamera');
  cameraEntity.addComponent('camera', {
    clearColor: new pc.Color(1, 1, 1, 1),
    nearClip: 0.01,
    farClip: 500,
    fov: 45
  });
  app.root.addChild(cameraEntity);

  splatPivot = new pc.Entity('SplatPivot');
  app.root.addChild(splatPivot);

  window.addEventListener('resize', handleResize);
  handleResize();

  initPresets();
  loadEmojiAssets();
  setupEmojiModalEvents();

  app.on('update', (dt) => {
    const smooth = Math.min(1, dt * 10);

    if (params.autoSpin) {
      orbit.targetYaw -= dt * params.spinSpeed;
    }

    orbit.yaw += (orbit.targetYaw - orbit.yaw) * smooth;
    orbit.pitch += (orbit.targetPitch - orbit.pitch) * smooth;
    orbit.distance += (orbit.targetDistance - orbit.distance) * smooth;
    orbit.panTarget.lerp(orbit.panTarget, orbit.targetPan, smooth);

    updateCamera();
    applyShaderParams();
  });

  setupInteractionControls();
  setupGUI();
  updatePresetDropdownUI();

  loadSplatAsset('head.sog', 'head.sog');
}

window.addEventListener('DOMContentLoaded', initPlayCanvas);
