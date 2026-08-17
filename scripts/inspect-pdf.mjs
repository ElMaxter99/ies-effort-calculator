/**
 * Inspecciona un PDF de vacantes y vuelca sus items de texto con posición.
 *
 * Sirve para responder, ante el PDF real de una comunidad:
 *   - ¿Es PDF de texto o una imagen escaneada? (0 items => escaneado, descartar)
 *   - ¿Qué cabeceras literales usa?
 *   - ¿En qué coordenadas X caen las columnas?
 *
 * Uso:
 *   node scripts/inspect-pdf.mjs <ruta-o-url> [--page N] [--limit N] [--json salida.json]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const args = { source: '', page: 1, limit: 120, json: '', pages: '' };
  const rest = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--page') args.page = parseInt(argv[++i], 10);
    else if (arg === '--limit') args.limit = parseInt(argv[++i], 10);
    else if (arg === '--json') args.json = argv[++i];
    else if (arg === '--pages') args.pages = argv[++i];
    else rest.push(arg);
  }

  args.source = rest[0] ?? '';
  return args;
}

async function loadBytes(source) {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source, {
      headers: {
        // Varios portales autonómicos rechazan user-agents no navegador (La Rioja devolvió 403).
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'application/pdf,*/*',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} al descargar ${source}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  const abs = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
  return new Uint8Array(fs.readFileSync(abs));
}

/**
 * Agrupa items en filas por cercanía a un ancla, igual que toTextRows() en
 * pdf-parser.service.ts. Debe mantenerse en sintonía con ella: si divergen, el
 * diagnóstico deja de reflejar lo que la app ve de verdad.
 */
function groupRows(items, tol = 2) {
  const entries = items
    .filter((item) => item.str && item.str.trim())
    .map((item) => ({ y: item.transform[5], x: Math.round(item.transform[4]), str: item.str }))
    .sort((a, b) => b.y - a.y);

  const rows = [];
  let anchor = Infinity;

  for (const entry of entries) {
    if (anchor - entry.y > tol) {
      anchor = entry.y;
      rows.push({ y: Math.round(anchor * 100) / 100, items: [] });
    }
    rows[rows.length - 1].items.push({ x: entry.x, str: entry.str });
  }

  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.source) {
    console.error('Uso: node scripts/inspect-pdf.mjs <ruta-o-url> [--page N] [--limit N] [--json salida.json]');
    process.exit(1);
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = await loadBytes(args.source);

  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: true,
    standardFontDataUrl: path.join(__dirname, '../node_modules/pdfjs-dist/standard_fonts/'),
  }).promise;

  console.log(`Fichero:  ${args.source}`);
  console.log(`Páginas:  ${doc.numPages}`);

  const pageNum = Math.min(Math.max(args.page, 1), doc.numPages);
  const page = await doc.getPage(pageNum);
  const content = await page.getTextContent();

  console.log(`Página inspeccionada: ${pageNum}`);
  console.log(`Items de texto: ${content.items.length}`);

  if (content.items.length === 0) {
    console.log('\n⚠️  Sin items de texto: el PDF es probablemente una imagen escaneada.');
    console.log('   Requeriría OCR — esta comunidad no es viable con el parser actual.');
    process.exit(0);
  }

  const rows = groupRows(content.items);
  console.log(`Filas detectadas: ${rows.length}\n`);

  const shown = rows.slice(0, args.limit);
  for (const row of shown) {
    const cells = row.items.map((i) => `x=${String(i.x).padStart(4)} ${JSON.stringify(i.str)}`).join('  |  ');
    console.log(`y=${String(row.y).padStart(5)}  ${cells}`);
  }
  if (rows.length > shown.length) {
    console.log(`\n… ${rows.length - shown.length} filas más (usa --limit para ver más)`);
  }

  // Histograma de X: las columnas aparecen como picos.
  const xCount = new Map();
  for (const row of rows) {
    for (const item of row.items) {
      xCount.set(item.x, (xCount.get(item.x) ?? 0) + 1);
    }
  }
  const topX = [...xCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log('\nCoordenadas X más frecuentes (candidatas a inicio de columna):');
  for (const [x, count] of topX.sort((a, b) => a[0] - b[0])) {
    console.log(`  x=${String(x).padStart(4)}  ${count} items`);
  }

  if (args.json) {
    // Formato compacto {s, x, y}: los tests reconstruyen el `transform` completo.
    const [from, to] = args.pages
      ? args.pages.split('-').map((n) => parseInt(n, 10))
      : [pageNum, pageNum];

    const pages = [];
    for (let p = from; p <= Math.min(to || from, doc.numPages); p++) {
      const pg = await doc.getPage(p);
      const c = await pg.getTextContent();
      pages.push({
        page: p,
        items: c.items
          .filter((i) => i.str && i.str.trim())
          .map((i) => ({ s: i.str, x: Math.round(i.transform[4] * 100) / 100, y: Math.round(i.transform[5] * 100) / 100 })),
      });
    }

    const out = path.isAbsolute(args.json) ? args.json : path.resolve(process.cwd(), args.json);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(pages));
    console.log(`\nFixture de ${pages.length} página(s) escrito en ${out}`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
