import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const emojisDir = path.join(__dirname, 'emojis');
const manifestPath = path.join(__dirname, 'emojis_manifest.json');
const outputAtlasPng = path.join(__dirname, 'emoji_atlas.png');
const outputAtlasJson = path.join(__dirname, 'emoji_atlas.json');
const outputColorLutJson = path.join(__dirname, 'emoji_color_lut.json');

const COLS = 64;
const ROWS = 32;
const TILE_SIZE = 64;
const PADDING = 3;
const TILE_INNER_SIZE = TILE_SIZE - PADDING * 2; // 58 px
const ATLAS_WIDTH = COLS * TILE_SIZE;  // 4096 px
const ATLAS_HEIGHT = ROWS * TILE_SIZE; // 2048 px

// 1. Funcoes de Conversao de Cores (RGB -> HSL e RGB -> CIELAB)
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // acromatico
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function rgbToLab(r, g, b) {
  // sRGB para Linear RGB
  let [rL, gL, bL] = [r / 255, g / 255, b / 255].map(v => 
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  );

  // Linear RGB para XYZ (D65)
  let x = rL * 0.4124 + gL * 0.3576 + bL * 0.1805;
  let y = rL * 0.2126 + gL * 0.7152 + bL * 0.0722;
  let z = rL * 0.0193 + gL * 0.1192 + bL * 0.9505;

  x /= 0.95047;
  y /= 1.00000;
  z /= 1.08883;

  const f = v => v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + (16 / 116);
  let fx = f(x), fy = f(y), fz = f(z);

  let L = (116 * fy) - 16;
  let a = 500 * (fx - fy);
  let bVal = 200 * (fy - fz);

  return [L, a, bVal];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

// Distancia Perceptual Delta E (CIELAB)
function deltaE(labA, labB) {
  const dL = labA[0] - labB[0];
  const da = labA[1] - labB[1];
  const db = labA[2] - labB[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

async function processAll() {
  console.log('========================================================');
  console.log('[Atlas Builder] Iniciando Processamento de Cores e Atlas');
  console.log('========================================================');

  const files = fs.readdirSync(emojisDir).filter(f => f.endsWith('.svg') || f.endsWith('.png'));
  console.log(`[Atlas Builder] ${files.length} arquivos encontrados na pasta 'emojis/'`);

  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  const emojiList = [];

  console.log('[Atlas Builder] 1/4: Rasterizando e calculando cores medias ponderadas...');
  let processed = 0;

  for (const file of files) {
    const filePath = path.join(emojisDir, file);
    try {
      // Rasteriza para 64x64 RGBA
      const imgBuffer = await sharp(filePath)
        .resize(TILE_SIZE, TILE_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels = imgBuffer.data;
      let rSum = 0, gSum = 0, bSum = 0, aSum = 0;

      for (let i = 0; i < pixels.length; i += 4) {
        const a = pixels[i + 3];
        if (a > 15) { // Ignora pixels quase transparentes
          rSum += pixels[i] * a;
          gSum += pixels[i + 1] * a;
          bSum += pixels[i + 2] * a;
          aSum += a;
        }
      }

      let avgR = 128, avgG = 128, avgB = 128;
      if (aSum > 0) {
        avgR = Math.round(rSum / aSum);
        avgG = Math.round(gSum / aSum);
        avgB = Math.round(bSum / aSum);
      }

      const hsl = rgbToHsl(avgR, avgG, avgB);
      const lab = rgbToLab(avgR, avgG, avgB);
      const hex = rgbToHex(avgR, avgG, avgB);

      const name = file.replace(/\.(svg|png)$/, '');
      const meta = manifest.find(m => m.filename === file || m.name === name) || {};

      emojiList.push({
        name: meta.name || name,
        allNames: meta.allNames || [name],
        surrogates: meta.surrogates || '',
        codepoint: meta.codepoint || '',
        filename: file,
        filePath: filePath,
        avgColor: {
          r: avgR,
          g: avgG,
          b: avgB,
          hex: hex,
          hsl: [Math.round(hsl[0]), Math.round(hsl[1] * 100), Math.round(hsl[2] * 100)],
          lab: [parseFloat(lab[0].toFixed(2)), parseFloat(lab[1].toFixed(2)), parseFloat(lab[2].toFixed(2))]
        },
        _sortHue: hsl[0],
        _sortSat: hsl[1],
        _sortLight: hsl[2]
      });

      processed++;
      if (processed % 200 === 0 || processed === files.length) {
        process.stdout.write(`\rProcessados: ${processed}/${files.length}`);
      }
    } catch (err) {
      console.warn(`\n[Aviso] Falha ao processar ${file}: ${err.message}`);
    }
  }

  console.log(`\n\n[Atlas Builder] 2/4: Ordenando ${emojiList.length} emojis por Matiz Perceptual (Hue & Lightness)...`);

  // Ordena os emojis por cor para criar um Atlas harmonico e otimizado:
  // Escala de cinza / neutros primeiro (por brilho), seguidos pelas cores em arco-iris (por Hue e depois brilho)
  emojiList.sort((a, b) => {
    const isGrayA = a._sortSat < 0.18 || a._sortLight < 0.12 || a._sortLight > 0.90;
    const isGrayB = b._sortSat < 0.18 || b._sortLight < 0.12 || b._sortLight > 0.90;

    if (isGrayA && !isGrayB) return -1;
    if (!isGrayA && isGrayB) return 1;
    if (isGrayA && isGrayB) return a._sortLight - b._sortLight;

    const hueDiff = a._sortHue - b._sortHue;
    if (Math.abs(hueDiff) > 8) return hueDiff;
    return a._sortLight - b._sortLight;
  });

  console.log('[Atlas Builder] 3/4: Criando composite do Texture Atlas PNG (4096x2048)...');

  const compositeOperations = [];
  const atlasMetadata = {
    grid: {
      cols: COLS,
      rows: ROWS,
      tileSize: TILE_SIZE,
      atlasWidth: ATLAS_WIDTH,
      atlasHeight: ATLAS_HEIGHT,
      totalSlots: COLS * ROWS,
      totalEmojis: emojiList.length
    },
    emojis: []
  };

  for (let idx = 0; idx < emojiList.length; idx++) {
    const item = emojiList[idx];
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);

    const x = col * TILE_SIZE;
    const y = row * TILE_SIZE;

    // Converte SVG/PNG para buffer 58x58 contido dentro de tile 64x64 com 3px de borda transparente
    const resizedBuffer = await sharp(item.filePath)
      .resize(TILE_INNER_SIZE, TILE_INNER_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: PADDING,
        bottom: PADDING,
        left: PADDING,
        right: PADDING,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    compositeOperations.push({
      input: resizedBuffer,
      left: x,
      top: y
    });

    // Calcula coordenadas UV normalizadas no atlas [0.0 a 1.0]
    const uMin = col / COLS;
    const vMin = row / ROWS;
    const uMax = (col + 1) / COLS;
    const vMax = (row + 1) / ROWS;

    atlasMetadata.emojis.push({
      id: idx,
      name: item.name,
      allNames: item.allNames,
      surrogates: item.surrogates,
      codepoint: item.codepoint,
      filename: item.filename,
      slot: { col, row },
      uvBounds: [
        parseFloat(uMin.toFixed(6)),
        parseFloat(vMin.toFixed(6)),
        parseFloat(uMax.toFixed(6)),
        parseFloat(vMax.toFixed(6))
      ],
      avgColor: item.avgColor
    });
  }

  // Gera o Canvas transparente base de 4096x2048 e aplica a composicao
  const baseCanvas = sharp({
    create: {
      width: ATLAS_WIDTH,
      height: ATLAS_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  console.log('[Atlas Builder] Renderizando imagem final...');
  await baseCanvas
    .composite(compositeOperations)
    .png({ compressionLevel: 8 })
    .toFile(outputAtlasPng);

  const atlasFileSizeMB = (fs.statSync(outputAtlasPng).size / (1024 * 1024)).toFixed(2);
  console.log(`[OK] Texture Atlas PNG salvo: ${outputAtlasPng} (${atlasFileSizeMB} MB)`);

  // Salva o JSON com os metadados e coordenadas UV
  fs.writeFileSync(outputAtlasJson, JSON.stringify(atlasMetadata, null, 2), 'utf8');
  console.log(`[OK] Metadados salvos: ${outputAtlasJson}`);

  // 4. Gera a 3D Color LUT (Grade 16x16x16 RGB para busca de cores instantanea)
  console.log('[Atlas Builder] 4/4: Gerando 3D Color LUT (Grade RGB de correspondencia de cores)...');
  const LUT_RES = 16;
  const lutTable = [];

  for (let r = 0; r < LUT_RES; r++) {
    for (let g = 0; g < LUT_RES; g++) {
      for (let b = 0; b < LUT_RES; b++) {
        const queryR = Math.round((r / (LUT_RES - 1)) * 255);
        const queryG = Math.round((g / (LUT_RES - 1)) * 255);
        const queryB = Math.round((b / (LUT_RES - 1)) * 255);
        const queryLab = rgbToLab(queryR, queryG, queryB);

        // Encontra o emoji mais proximo usando Delta E (CIELAB)
        let closestId = 0;
        let minDiff = Infinity;

        for (let i = 0; i < atlasMetadata.emojis.length; i++) {
          const eLab = atlasMetadata.emojis[i].avgColor.lab;
          const diff = deltaE(queryLab, eLab);
          if (diff < minDiff) {
            minDiff = diff;
            closestId = i;
          }
        }

        const matchedEmoji = atlasMetadata.emojis[closestId];
        lutTable.push({
          rgb: [queryR, queryG, queryB],
          emojiId: closestId,
          name: matchedEmoji.name,
          slot: matchedEmoji.slot,
          uvBounds: matchedEmoji.uvBounds
        });
      }
    }
  }

  const lutData = {
    resolution: LUT_RES,
    totalEntries: lutTable.length,
    lut: lutTable
  };

  fs.writeFileSync(outputColorLutJson, JSON.stringify(lutData, null, 2), 'utf8');
  console.log(`[OK] Color LUT JSON salvo: ${outputColorLutJson}`);

  console.log('\n========================================================');
  console.log('[Atlas Builder] SUCESSO COMPLETO!');
  console.log(`- Total de emojis no Atlas: ${atlasMetadata.emojis.length}`);
  console.log(`- Atlas PNG: ${outputAtlasPng} (${atlasFileSizeMB} MB)`);
  console.log(`- Atlas JSON: ${outputAtlasJson}`);
  console.log(`- Color LUT JSON: ${outputColorLutJson}`);
  console.log('========================================================\n');
}

processAll();
