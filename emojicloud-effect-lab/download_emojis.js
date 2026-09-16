import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const jsonPath = path.join(__dirname, 'discord_emojis.json');
const outputDir = path.join(__dirname, 'emojis');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

if (!fs.existsSync(jsonPath)) {
  console.error('[Downloader] Arquivo discord_emojis.json nao encontrado!');
  process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
console.log(`[Downloader] Total de entradas brutas no JSON: ${rawData.length}`);

// Filtro: Remove todas as variacoes de tom de pele (Fitzpatrick modifiers)
function isSkinTone(item) {
  const hasToneInName = item.names && item.names.some(n => /tone|skin/i.test(n));
  const hasToneInSurrogate = item.surrogates && /[\u{1F3FB}-\u{1F3FF}]/u.test(item.surrogates);
  const isDiversity = !!item.diversity;
  return hasToneInName || hasToneInSurrogate || isDiversity;
}

const baseEmojis = rawData.filter(item => !isSkinTone(item));
console.log(`[Downloader] Total de emojis padroes filtrados (SEM tom de pele): ${baseEmojis.length}`);

// Converte surrogate unicode em codepoint hex formato Twemoji
function toTwemojiCodepoint(surrogates) {
  const codePoints = [];
  for (const char of surrogates) {
    codePoints.push(char.codePointAt(0).toString(16));
  }
  // Remove variation selector 0xfe0f exceto se for sequencia ZWJ
  const clean = codePoints.filter((c, idx) => c !== 'fe0f' || (idx > 0 && codePoints[idx - 1] === '200d'));
  return (clean.length > 0 ? clean : codePoints).join('-');
}

const CDN_BASE = 'https://raw.githubusercontent.com/jdecked/twemoji/main/assets/svg';

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

async function run() {
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const concurrency = 30;

  const usedFilenames = new Set();
  const queue = [];
  const manifest = [];

  for (const emoji of baseEmojis) {
    if (!emoji || !emoji.names || !emoji.names.length) continue;

    let baseName = sanitizeFilename(emoji.names[0]);
    let finalName = baseName;
    let counter = 1;
    while (usedFilenames.has(finalName)) {
      finalName = `${baseName}_${counter++}`;
    }
    usedFilenames.add(finalName);

    const filename = `${finalName}.svg`;
    const codepoint = toTwemojiCodepoint(emoji.surrogates);

    queue.push({
      emoji,
      filename,
      codepoint,
      primaryName: emoji.names[0]
    });

    manifest.push({
      name: emoji.names[0],
      allNames: emoji.names,
      surrogates: emoji.surrogates,
      codepoint: codepoint,
      filename: filename
    });
  }

  console.log(`[Downloader] Baixando ${queue.length} SVGs em paralelo...`);

  async function worker() {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      const filePath = path.join(outputDir, task.filename);

      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) {
        skipped++;
        continue;
      }

      const url = `${CDN_BASE}/${task.codepoint}.svg`;

      try {
        let res = await fetch(url);
        if (res.ok) {
          const svg = await res.text();
          fs.writeFileSync(filePath, svg, 'utf8');
          downloaded++;
        } else {
          // Fallback sem remocao de fe0f
          const rawCode = Array.from(task.emoji.surrogates).map(c => c.codePointAt(0).toString(16)).join('-');
          const resFallback = await fetch(`${CDN_BASE}/${rawCode}.svg`);
          if (resFallback.ok) {
            const svg = await resFallback.text();
            fs.writeFileSync(filePath, svg, 'utf8');
            downloaded++;
          } else {
            failed++;
          }
        }
      } catch (err) {
        failed++;
      }

      const total = downloaded + skipped + failed;
      if (total % 100 === 0 || total === baseEmojis.length) {
        process.stdout.write(`\rProgresso: ${total}/${baseEmojis.length} (Baixados: ${downloaded}, Já existentes: ${skipped}, Falhas: ${failed})`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  fs.writeFileSync(path.join(__dirname, 'emojis_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`\n\n========================================`);
  console.log(`[Downloader] Download finalizado!`);
  console.log(`- Total de SVGs salvos na pasta 'emojis/': ${downloaded + skipped}`);
  console.log(`- Total com falha: ${failed}`);
  console.log(`- Manifesto criado: emojis_manifest.json`);
  console.log(`========================================\n`);
}

run();
