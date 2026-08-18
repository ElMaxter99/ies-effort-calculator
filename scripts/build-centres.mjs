/**
 * Construye los datasets de centros por comunidad.
 *
 * Cada comunidad publica su directorio de centros en su portal de datos
 * abiertos, con formatos y nombres de columna distintos. Aquí se descarga, se
 * normaliza a un formato común y se escribe en src/app/data/centres/<id>.json.
 *
 * Los JSON resultantes se commitean al repositorio a propósito: así el build
 * no depende de la red ni de que el portal de turno esté caído.
 *
 * Uso:
 *   node scripts/build-centres.mjs            # todas las comunidades
 *   node scripts/build-centres.mjs can bal    # solo las indicadas
 *   node scripts/build-centres.mjs --check    # no escribe, solo comprueba
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../src/app/data/centres');
const LOC_DIR = path.resolve(__dirname, '../src/app/data/localities');

const UA = 'ies-effort-calculator/build-centres (+https://github.com/ElMaxter99)';

// --------------------------------------------------------------------------
// Utilidades
// --------------------------------------------------------------------------

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

/**
 * Parseo de CSV suficiente para estos ficheros: soporta comillas dobles,
 * separadores dentro de comillas y saltos de línea CRLF.
 */
function parseCsv(text, delimiter = ',') {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }

  if (field || row.length) { row.push(field); rows.push(row); }

  const header = rows.shift()?.map((h) => h.trim().replace(/^﻿/, '')) ?? [];
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/** Convierte "28,0937" o "28.0937" a número; devuelve NaN si no es utilizable. */
function toNumber(value) {
  if (value === undefined || value === null || value === '') return NaN;
  return parseFloat(String(value).replace(',', '.'));
}

/**
 * Los registros oficiales posponen el artículo del topónimo ("VILA JOIOSA
 * (LA)", "ALCORA (L')"), pero los listados de vacantes lo escriben delante
 * ("LA VILA JOIOSA", "L'ALCORA"). Se normaliza a la forma natural para que la
 * búsqueda por localidad —el respaldo cuando el código de centro no está en el
 * dataset— encuentre el municipio.
 */
const TRAILING_ARTICLE = /^(.+?)\s+\((EL|LA|LOS|LAS|ELS|LES|L'|S'|SA|ES)\)$/i;

function normalizeLocality(name) {
  const raw = String(name ?? '').trim();
  const match = TRAILING_ARTICLE.exec(raw);
  if (!match) return raw;

  const [, body, article] = match;
  // "L'" y "S'" se pegan al nombre; el resto lleva espacio.
  return article.endsWith("'") ? `${article}${body}` : `${article} ${body}`;
}

/**
 * Convierte UTM a latitud/longitud sobre el elipsoide WGS84.
 *
 * Hay registros que solo publican coordenadas proyectadas —Madrid da UTM_X y
 * UTM_Y en el huso 30N—, y sin convertirlas los centros caerían en mitad del
 * Atlántico. Se implementa aquí en lugar de añadir proj4 como dependencia:
 * es la fórmula inversa estándar y solo hace falta en tiempo de construcción.
 *
 * La diferencia de datum (ED50 frente a ETRS89) es de unos 100 m, despreciable
 * para estimar distancias de desplazamiento en kilómetros.
 */
function utmToLatLng(easting, northing, zone = 30, northernHemisphere = true) {
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const k0 = 0.9996;

  const e2 = f * (2 - f);
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));

  const x = easting - 500000;
  const y = northernHemisphere ? northing : northing - 10000000;

  const m = y / k0;
  const mu = m / (a * (1 - e2 / 4 - (3 * e2 * e2) / 64 - (5 * e2 ** 3) / 256));

  const phi1 =
    mu +
    ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
    ((21 * e1 * e1) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
    ((151 * e1 ** 3) / 96) * Math.sin(6 * mu);

  const sin1 = Math.sin(phi1);
  const cos1 = Math.cos(phi1);
  const tan1 = Math.tan(phi1);

  const ep2 = e2 / (1 - e2);
  const c1 = ep2 * cos1 * cos1;
  const t1 = tan1 * tan1;
  const n1 = a / Math.sqrt(1 - e2 * sin1 * sin1);
  const r1 = (a * (1 - e2)) / Math.pow(1 - e2 * sin1 * sin1, 1.5);
  const d = x / (n1 * k0);

  const lat =
    phi1 -
    ((n1 * tan1) / r1) *
      ((d * d) / 2 -
        ((5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d ** 4) / 24 +
        ((61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d ** 6) / 720);

  const lng =
    (d -
      ((1 + 2 * t1 + c1) * d ** 3) / 6 +
      ((5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d ** 5) / 120) /
    cos1;

  const lngOrigin = (zone - 1) * 6 - 180 + 3;

  return { lat: (lat * 180) / Math.PI, lng: lngOrigin + (lng * 180) / Math.PI };
}

/** Límites aproximados de España (incluye Canarias) para descartar basura. */
const SPAIN_BOUNDS = { minLat: 27.5, maxLat: 43.9, minLng: -18.3, maxLng: 4.4 };

function isPlausible(lat, lng) {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= SPAIN_BOUNDS.minLat && lat <= SPAIN_BOUNDS.maxLat &&
    lng >= SPAIN_BOUNDS.minLng && lng <= SPAIN_BOUNDS.maxLng
  );
}

/** Normaliza, descarta registros inservibles y deduplica por código. */
function normalize(records, id) {
  const seen = new Set();
  const out = [];
  const dropped = { noCode: 0, noCoords: 0, outOfBounds: 0, duplicate: 0 };

  for (const rec of records) {
    const code = String(rec.code ?? '').trim();
    if (!code) { dropped.noCode++; continue; }

    const lat = toNumber(rec.lat);
    const lng = toNumber(rec.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { dropped.noCoords++; continue; }
    if (!isPlausible(lat, lng)) { dropped.outOfBounds++; continue; }
    if (seen.has(code)) { dropped.duplicate++; continue; }

    seen.add(code);
    out.push({
      code,
      name: String(rec.name ?? '').trim(),
      locality: normalizeLocality(rec.locality),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    });
  }

  out.sort((a, b) => a.code.localeCompare(b.code));
  console.log(
    `  ${id}: ${out.length} centros ` +
    `(descartados: ${dropped.noCode} sin código, ${dropped.noCoords} sin coordenadas, ` +
    `${dropped.outOfBounds} fuera de España, ${dropped.duplicate} duplicados)`,
  );
  return out;
}

/**
 * Centroide de un polígono por la fórmula del área con signo.
 *
 * Se queda con el anillo de mayor área: así ignora los huecos y, en municipios
 * con varias partes, elige la principal.
 */
function polygonCentroid(rings) {
  let best = null;
  let bestArea = 0;

  for (const ring of rings ?? []) {
    if (!ring || ring.length < 3) continue;

    let area = 0;
    let cx = 0;
    let cy = 0;

    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      const cross = x1 * y2 - x2 * y1;
      area += cross;
      cx += (x1 + x2) * cross;
      cy += (y1 + y2) * cross;
    }

    area /= 2;
    if (Math.abs(area) <= Math.abs(bestArea)) continue;

    bestArea = area;
    best = Math.abs(area) < 1e-12
      // Polígono degenerado: sirve la media de los vértices.
      ? [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length]
      : [cx / (6 * area), cy / (6 * area)];
  }

  return best;
}

/**
 * Geocodificador de municipios contra CartoCiudad (IGN).
 *
 * El centroide geométrico de un término municipal puede caer muy lejos de su
 * casco urbano cuando el término es grande o alargado —en Cuenca son más de
 * 20 km—, y con umbrales de esfuerzo de 10/45/75 km eso cambia el resultado.
 * CartoCiudad devuelve el núcleo de población, que es donde están los centros.
 *
 * Las respuestas se guardan en caché en disco: el fichero se commitea para que
 * regenerar el dataset no repita miles de peticiones al IGN.
 */
const CARTOCIUDAD_CACHE = path.resolve(__dirname, 'cache/cartociudad.json');

function loadGeocodeCache() {
  try {
    return JSON.parse(fs.readFileSync(CARTOCIUDAD_CACHE, 'utf8'));
  } catch {
    return {};
  }
}

function saveGeocodeCache(cache) {
  fs.mkdirSync(path.dirname(CARTOCIUDAD_CACHE), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(CARTOCIUDAD_CACHE, JSON.stringify(sorted, null, 1));
}

/**
 * Sitúa un municipio en su núcleo de población.
 *
 * Devuelve null si CartoCiudad no responde o si lo que devuelve no es el
 * municipio pedido: se valida contra el código INE, así que un homónimo de
 * otra provincia nunca cuela.
 */
async function geocodeMunicipality(name, ineCode, cache) {
  const key = `${ineCode}|${name}`;
  if (key in cache) return cache[key];

  const url =
    'https://www.cartociudad.es/geocoder/api/geocoder/findJsonp?q=' +
    encodeURIComponent(name);

  let result = null;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) {
      const text = await res.text();
      const json = JSON.parse(text.replace(/^\s*callback\(/, '').replace(/\)\s*;?\s*$/, ''));
      if (json.muniCode === ineCode && Number.isFinite(json.lat) && Number.isFinite(json.lng)) {
        result = { lat: json.lat, lng: json.lng };
      }
    }
  } catch {
    result = null;
  }

  cache[key] = result;
  return result;
}

/** Descarga todas las entidades de una capa ArcGIS, paginando. */
async function fetchArcgisLayer(baseUrl, { outFields, maxAllowableOffset = 0.01 }) {
  const features = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const url =
      `${baseUrl}/query?where=1%3D1&outFields=${encodeURIComponent(outFields)}` +
      `&returnGeometry=true&outSR=4326&geometryPrecision=5` +
      `&maxAllowableOffset=${maxAllowableOffset}` +
      `&resultOffset=${offset}&resultRecordCount=${pageSize}&f=json`;

    const page = await fetchJson(url);
    if (page.error) throw new Error(`ArcGIS: ${page.error.message ?? 'error desconocido'}`);

    const batch = page.features ?? [];
    features.push(...batch);

    if (batch.length < pageSize || !page.exceededTransferLimit) break;
  }

  return features;
}

// --------------------------------------------------------------------------
// Adaptadores por comunidad
//
// Cada adaptador devuelve registros {code, name, locality, lat, lng} en crudo;
// de validar y deduplicar se encarga normalize().
// --------------------------------------------------------------------------

const ADAPTERS = {
  /**
   * Comunitat Valenciana — Dades Obertes GVA, "Centros docentes de la
   * Comunitat Valenciana" (CKAN, dataset edu-centros).
   *
   * CSV con separador ';', codificación UTF-8 y coordenadas ya en WGS84.
   * Incluye todos los tipos de centro (CEIP, IES, FP, EOI, conservatorios...),
   * no solo institutos.
   */
  val: {
    label: 'Comunitat Valenciana',
    source:
      'https://dadesobertes.gva.es/dataset/68eb1d94-76d3-4305-8507-e1aab7717d0e/' +
      'resource/1aa53c3a-4639-41aa-ac85-d58254c428c0/download/' +
      'centros-docentes-de-la-comunitat-valenciana.csv',
    async fetch() {
      const csv = await fetchText(this.source);
      return parseCsv(csv, ';').map((r) => ({
        code: r.codigo,
        name: r.denominacion || r.denominacion_especifica,
        locality: r.localidad,
        lat: r.latitud,
        lng: r.longitud,
      }));
    },
  },

  /**
   * Canarias — datos.canarias.es, "Centros educativos de Canarias".
   *
   * CSV con separador ',' y coordenadas en columnas propias. El código es el
   * mismo de 8 dígitos que usan los anexos de vacantes, así que la búsqueda
   * por código resuelve el centro exacto.
   *
   * Se indexa por municipio y no por la columna Localidad: el anexo de
   * vacantes no trae localidad, y el municipio es la unidad con la que se
   * corresponden los topónimos del resto del sistema.
   */
  /**
   * Región de Murcia — API del Mapa Escolar (murciaeduca).
   *
   * Es la única comunidad que publica sus centros como servicio en vivo con
   * las coordenadas ya calculadas, así que no hay que geocodificar nada. Aun
   * así se vuelca a un JSON estático: la aplicación no debe depender de que la
   * API responda.
   */
  mur: {
    label: 'Región de Murcia',
    source: 'https://mapaescolar.murciaeduca.es/mapaescolar-api/api/centros',
    async fetch() {
      const data = await fetchJson(this.source);
      const list = Array.isArray(data) ? data : (data.content ?? []);

      return list.map((c) => ({
        code: c.codcen,
        name: c.dencen,
        locality: c.muncen || c.loccen,
        lat: c['geo-referencia']?.lat,
        lng: c['geo-referencia']?.lon,
      }));
    },
  },

  /**
   * Castilla y León — "Directorio de Centros Docentes" (OpenDataSoft).
   *
   * Trae latitud y longitud directas y el código de centro de 8 dígitos. El
   * dataset incluye varios cursos académicos, así que se ordena por curso
   * descendente y normalize() se queda con la primera aparición de cada código.
   */
  cyl: {
    label: 'Castilla y León',
    source:
      'https://analisis.datosabiertos.jcyl.es/api/explore/v2.1/catalog/datasets/' +
      'directorio-de-centros-docentes/exports/json',
    async fetch() {
      const data = await fetchJson(this.source);

      return data
        .filter((r) => r.situacion !== 'BAJA')
        .sort((a, b) => String(b.curso_academico ?? '').localeCompare(String(a.curso_academico ?? '')))
        .map((r) => ({
          code: r.codigo,
          name: r.denominacion_especifica,
          locality: r.localidad || r.municipio,
          lat: r.coord_latitud,
          lng: r.coord_longitud,
        }));
    },
  },

  /**
   * Comunidad de Madrid — "Centros educativos" (portal de datos abiertos).
   *
   * CSV con separador ';'. Publica las coordenadas en UTM huso 30N, no en
   * latitud/longitud, así que hay que reproyectarlas. Se descartan los centros
   * dados de baja.
   */
  mad: {
    label: 'Comunidad de Madrid',
    source:
      'https://datos.comunidad.madrid/catalogo/dataset/c750856d-3166-4dac-8e80-d1b824c968b5/' +
      'resource/28d60557-1d73-4281-ab08-6cfd3b2f5f83/download/centros_educativos.csv',
    async fetch() {
      const csv = await fetchText(this.source);

      return parseCsv(csv, ';')
        .filter((r) => (r['SITUACIÓN'] ?? r.SITUACION ?? '').toUpperCase() !== 'BAJA')
        .map((r) => {
          const x = toNumber(r.UTM_X);
          const y = toNumber(r.UTM_Y);
          const point = Number.isFinite(x) && Number.isFinite(y) ? utmToLatLng(x, y, 30) : null;

          return {
            code: r.CODIGO,
            name: r.CENTRO,
            locality: r.MUNICIPIO,
            lat: point?.lat,
            lng: point?.lng,
          };
        });
    },
  },

  can: {
    label: 'Canarias',
    source:
      'https://datos.canarias.es/catalogos/general/dataset/f6b15811-014b-46f7-a858-fe48b062ed05/' +
      'resource/b5e08adf-841b-4ba5-a599-4339e772d792/download/centros.csv',
    async fetch() {
      const csv = await fetchText(this.source);
      return parseCsv(csv, ',').map((r) => ({
        code: r.Codigo,
        name: r.Denominacion,
        locality: r.Municipio || r.Localidad,
        lat: r.Latitud,
        lng: r.Longitud,
      }));
    },
  },
};

/**
 * Adaptadores de municipios.
 *
 * Solo hacen falta donde no hay directorio de centros: dan coordenadas a nivel
 * de municipio para no tener que geocodificar en tiempo real.
 */
const LOCALITY_ADAPTERS = {
  /**
   * Castilla-La Mancha — capa oficial "Municipios" del portal de datos
   * abiertos cartográficos de la JCCM (ArcGIS Feature Server).
   *
   * Se usa porque CLM no publica ningún directorio de centros descargable: el
   * recurso de Datos Abiertos CLM es un buscador HTML y el portal ArcGIS no
   * incluye centros educativos.
   *
   * El NATCODE del INSPIRE acaba en el código INE del municipio
   * ("34080202001" -> "02001").
   */
  clm: {
    label: 'Castilla-La Mancha (municipios)',
    source: 'https://services-eu1.arcgis.com/LVA9E9zjh6QfM7Mo/arcgis/rest/services/Municipios/FeatureServer/0',
    async fetch() {
      const features = await fetchArcgisLayer(this.source, { outFields: 'NAMEUNIT,NATCODE' });
      const cache = loadGeocodeCache();

      const out = [];
      let geocoded = 0;

      for (const f of features) {
        const code = String(f.attributes?.NATCODE ?? '').slice(-5);
        const name = f.attributes?.NAMEUNIT ?? '';
        const centroid = polygonCentroid(f.geometry?.rings);

        // El núcleo de población es mejor referencia que el centro geométrico
        // del término; si el IGN no lo resuelve, se usa el centroide.
        const town = await geocodeMunicipality(name, code, cache);
        if (town) geocoded++;

        out.push({
          code,
          name,
          lat: town ? town.lat : centroid?.[1],
          lng: town ? town.lng : centroid?.[0],
        });
      }

      saveGeocodeCache(cache);
      console.log(`  núcleo de población resuelto en ${geocoded}/${features.length}; el resto usa el centroide del término`);

      return out;
    },
  },
};

/** Normaliza municipios: como normalize(), pero sin campo `locality`. */
function normalizeLocalities(records, id) {
  const seen = new Set();
  const out = [];
  const dropped = { noCode: 0, noCoords: 0, outOfBounds: 0, duplicate: 0 };

  for (const rec of records) {
    const code = String(rec.code ?? '').trim();
    if (!code) { dropped.noCode++; continue; }

    const lat = toNumber(rec.lat);
    const lng = toNumber(rec.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { dropped.noCoords++; continue; }
    if (!isPlausible(lat, lng)) { dropped.outOfBounds++; continue; }
    if (seen.has(code)) { dropped.duplicate++; continue; }

    seen.add(code);
    out.push({
      code,
      name: normalizeLocality(rec.name),
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
    });
  }

  out.sort((a, b) => a.code.localeCompare(b.code));
  console.log(
    `  ${id}: ${out.length} municipios ` +
    `(descartados: ${dropped.noCode} sin código, ${dropped.noCoords} sin coordenadas, ` +
    `${dropped.outOfBounds} fuera de España, ${dropped.duplicate} duplicados)`,
  );
  return out;
}

// --------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const wanted = args.filter((a) => !a.startsWith('--'));
  const known = [...new Set([...Object.keys(ADAPTERS), ...Object.keys(LOCALITY_ADAPTERS)])];
  const ids = wanted.length ? wanted : known;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(LOC_DIR, { recursive: true });

  let failed = 0;

  for (const id of ids) {
    // Una comunidad puede tener directorio de centros, municipios, o ambos.
    const jobs = [
      ADAPTERS[id] && { adapter: ADAPTERS[id], dir: OUT_DIR, rel: 'centres', run: normalize },
      LOCALITY_ADAPTERS[id] && { adapter: LOCALITY_ADAPTERS[id], dir: LOC_DIR, rel: 'localities', run: normalizeLocalities },
    ].filter(Boolean);

    if (jobs.length === 0) {
      console.error(`✖ ${id}: sin adaptador. Disponibles: ${known.join(', ')}`);
      failed++;
      continue;
    }

    for (const job of jobs) {
      console.log(`\n▸ ${id} — ${job.adapter.label}`);
      console.log(`  fuente: ${job.adapter.source}`);

      try {
        const raw = await job.adapter.fetch();
        const records = job.run(raw, id);

        if (records.length === 0) throw new Error('el adaptador no produjo ningún registro válido');

        if (check) {
          console.log('  --check: no se escribe nada');
        } else {
          fs.writeFileSync(path.join(job.dir, `${id}.json`), JSON.stringify(records));
          console.log(`  escrito src/app/data/${job.rel}/${id}.json`);
        }
      } catch (err) {
        console.error(`  ✖ ${err.message}`);
        failed++;
      }
    }
  }

  if (failed) {
    console.error(`\n${failed} comunidad(es) fallaron.`);
    process.exit(1);
  }
  console.log('\nHecho.');
}

// Solo se ejecuta al invocarlo directamente: los tests y otros scripts
// importan las utilidades de este fichero y no deben disparar descargas.
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
}

export { parseCsv, normalize, normalizeLocality, fetchText, fetchJson, isPlausible, utmToLatLng, polygonCentroid };
