/**
 * Comprueba que los portales oficiales de cada comunidad siguen respondiendo y
 * que sus filtros de enlaces siguen encontrando los PDFs de vacantes.
 *
 * Es el punto más frágil de todo el proyecto: las administraciones reorganizan
 * sus webs cada curso y cambian las rutas, así que un listado que hoy se
 * descarga solo puede dejar de hacerlo sin que nada avise. La subida manual
 * sigue funcionando siempre, pero conviene enterarse.
 *
 * No se ejecuta en los tests: necesita red y depende de servidores ajenos.
 *
 * Uso:
 *   node scripts/check-sources.mjs [id-de-region ...]
 */

import { build } from 'esbuild';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMEOUT_MS = 30000;

/**
 * Carga el registro real de regiones en lugar de repetir aquí sus URLs.
 *
 * Se compila al vuelo porque los ficheros son TypeScript; sus imports de
 * Angular son solo de tipos, así que el bundle no arrastra el framework.
 */
async function loadRegions() {
  const outfile = path.join(os.tmpdir(), `ies-regions-${process.pid}.mjs`);

  await build({
    entryPoints: [path.join(ROOT, 'src/app/regions/registry.ts')],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'warning',
  });

  try {
    const module = await import(pathToFileURL(outfile).href);
    return Object.values(module.REGIONS);
  } finally {
    fs.rmSync(outfile, { force: true });
  }
}

/**
 * Descarga con un reintento.
 *
 * Sin él, un servidor lento —el de Canarias corta la conexión de vez en
 * cuando— se denuncia como si su listado hubiera desaparecido, y una alarma que
 * salta sola deja de mirarse.
 */
async function fetchText(url, attempt = 1) {
  try {
    return await fetchOnce(url);
  } catch (error) {
    if (attempt >= 2) throw error;
    await new Promise((resolve) => setTimeout(resolve, 2000));
    return fetchText(url, attempt + 1);
  }
}

async function fetchOnce(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      // Varios portales autonómicos rechazan user-agents que no parecen navegador.
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

/**
 * Extrae los enlaces a PDF de una página.
 *
 * Debe leer lo mismo que extractPdfLinks() en pdf-source.service.ts, que usa el
 * DOM del navegador; aquí no hay DOM, así que se recorre el HTML con una
 * expresión regular. Si divergen, este informe deja de reflejar lo que la
 * aplicación encuentra de verdad.
 */
/** Las pocas entidades que aparecen en los rótulos de estos portales. */
const ENTITIES = {
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  Aacute: 'Á', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
};

function extractPdfLinks(html, source) {
  // El href puede venir entre comillas dobles, simples o sin comillas: el
  // portal de Castilla-La Mancha escribe `href= /sites/...pdf download`, que el
  // navegador acepta y una expresión regular ingenua se salta.
  const anchors = html.matchAll(/<a[^>]*\shref=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>([\s\S]*?)<\/a>/gi);
  const isDocument = source.documentPattern ? new RegExp(source.documentPattern, 'i') : null;
  const seen = new Set();
  const links = [];

  for (const [, rawHref, inner] of anchors) {
    const href = rawHref.replace(/^["']|["']$/g, '');
    const label = inner
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
      .replace(/\s+/g, ' ')
      .trim();
    if (!label) continue;
    if (!href.includes('.pdf') && !isDocument?.test(href)) continue;

    let url;
    try {
      url = new URL(href.replace(/&amp;/g, '&'), source.baseUrl).toString();
    } catch {
      continue;
    }

    if (seen.has(url)) continue;
    seen.add(url);
    links.push({ label, url });
  }

  return links;
}

function applyMatch(links, match) {
  if (!match) return links;
  const filter = new RegExp(match, 'i');
  return links.filter((l) => filter.test(l.label) || filter.test(decodeURIComponent(l.url)));
}

async function checkRegion(region) {
  const problems = [];
  console.log(`
▸ ${region.id} — ${region.name.es} (${region.status})`);

  try {
    await fetchText(region.portalHubUrl);
    console.log(`  portal: ok`);
  } catch (error) {
    // No es motivo de fallo: hay portales que un navegador abre y Node no,
    // como el de Aragón, que no envía la cadena completa de su certificado.
    console.log(`  portal: NO RESPONDE (${error.message}) ${region.portalHubUrl}`);
  }

  if (!region.officialSource) {
    console.log('  sin descarga automática: el docente sube el PDF a mano');
    return problems;
  }

  const { baseUrl, pages } = region.officialSource;

  for (const page of pages) {
    const url = `${baseUrl}${page.path}`;

    try {
      const html = await fetchText(url);
      const all = extractPdfLinks(html, region.officialSource);
      const matched = applyMatch(all, page.match);

      if (matched.length === 0) {
        problems.push(`${region.id}/${page.cos}: 0 enlaces de ${all.length} PDFs en ${url}`);
        console.log(`  ${page.cos}: SIN RESULTADOS (${all.length} PDFs en la página)`);
      } else {
        console.log(`  ${page.cos}: ${matched.length} de ${all.length} PDFs`);
        for (const link of matched.slice(0, 3)) console.log(`      ${link.label.slice(0, 70)}`);
      }
    } catch (error) {
      problems.push(`${region.id}/${page.cos}: ${error.message} en ${url}`);
      console.log(`  ${page.cos}: ERROR ${error.message}`);
    }
  }

  return problems;
}

const wanted = process.argv.slice(2);
const regions = (await loadRegions()).filter((r) => !wanted.length || wanted.includes(r.id));

if (regions.length === 0) {
  console.error(`No hay ninguna región con esos ids: ${wanted.join(', ')}`);
  process.exit(1);
}

const problems = [];
for (const region of regions) problems.push(...(await checkRegion(region)));

console.log('');
if (problems.length) {
  console.log(`${problems.length} fuente(s) que ya no encuentran su listado:`);
  for (const problem of problems) console.log(`  - ${problem}`);
  process.exit(1);
}

console.log(`${regions.length} comunidad(es) comprobada(s); todas encuentran su listado.`);
