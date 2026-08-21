import { Injectable, inject } from '@angular/core';
import { RegionConfig, RegionId } from '../regions/region.types';
import { RegionService } from '../regions/region.service';

/** Artículos que los registros oficiales posponen entre paréntesis. */
const TRAILING_ARTICLE = /^(.+)\s+(el|la|los|las|els|les|l|s|sa|ses|es|o|a)$/;

/**
 * Clave con la que se indexan y consultan las localidades.
 *
 * Concilia dos discrepancias reales entre los listados de vacantes y los
 * registros oficiales de centros y municipios:
 *
 * 1. Mayúsculas y acentos: los listados escriben "ALCAZAR DE SAN JUAN" y el
 *    registro "Alcázar de San Juan".
 * 2. Posición del artículo: no hay un criterio común ni siquiera entre
 *    comunidades. Los PDFs de Castilla-La Mancha ponen "ROBLEDO (EL)" y su
 *    registro "El Robledo"; en la Comunitat Valenciana pasa justo al revés.
 *    Se canoniza siempre a artículo delante.
 */
export function localityKey(name: string): string {
  const flat = String(name ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const match = TRAILING_ARTICLE.exec(flat);
  return match ? `${match[2]} ${match[1]}` : flat;
}

const LEADING_ARTICLE = /^(el|la|los|las|els|les|l|s|sa|ses|es|o|a)\s+/;

/** Clave sin artículo, para el segundo intento de búsqueda. */
export function looseLocalityKey(name: string): string {
  return localityKey(name).replace(LEADING_ARTICLE, '');
}

/**
 * Nombres con los que una misma localidad puede aparecer en un listado.
 *
 * Los registros de las comunidades bilingües guardan el topónimo en las dos
 * lenguas —"Pamplona / Iruña", "Estella-Lizarra"— o con el municipio detrás
 * entre paréntesis —"Lekaroz (Baztan)"—, mientras que el listado de vacantes
 * imprime una sola de las formas. Sin desdoblarlas, más de la mitad de las
 * plazas navarras de secundaria se quedaban sin situar.
 *
 * Devuelve las claves ya canonizadas, empezando por el nombre completo.
 */
export function localityAliases(name: string): string[] {
  const raw = String(name ?? '').replace(/\s*\([^)]*\)\s*$/, '');
  const aliases = [localityKey(name), localityKey(raw)];

  for (const part of raw.split(/\s*[\/-]\s*/)) {
    const key = localityKey(part);
    if (key.length > 2) aliases.push(key);
  }

  return [...new Set(aliases.filter(Boolean))];
}

/**
 * Índice de nombres alternativos, con la misma cautela que el índice sin
 * artículo: un alias al que llegan dos localidades distintas se descarta, para
 * no situar la plaza en el municipio equivocado.
 */
function buildAliasIndex(
  named: { name: string; coords: { lat: number; lng: number } }[],
  byLocality: Map<string, { lat: number; lng: number }>,
): Map<string, { lat: number; lng: number }> {
  const candidates = new Map<string, { lat: number; lng: number }[]>();

  for (const { name, coords } of named) {
    for (const alias of localityAliases(name)) {
      if (byLocality.has(alias)) continue;
      const arr = candidates.get(alias) ?? [];
      arr.push(coords);
      candidates.set(alias, arr);
    }
  }

  const index = new Map<string, { lat: number; lng: number }>();
  for (const [alias, coords] of candidates) {
    const distinct = new Set(coords.map((c) => `${c.lat},${c.lng}`));
    if (distinct.size > 1) continue;
    index.set(alias, coords[0]);
  }
  return index;
}

/**
 * Índice auxiliar sin artículo.
 *
 * Los listados a veces añaden un artículo que el registro oficial no lleva
 * ("CALZADA DE OROPESA (LA)" frente a "Calzada de Oropesa"). Se descartan las
 * claves a las que llegan dos municipios distintos: es preferible no resolver
 * la localidad —y geocodificarla— que situarla en el municipio equivocado.
 */
function buildLooseIndex(
  byLocality: Map<string, { lat: number; lng: number }>,
): Map<string, { lat: number; lng: number }> {
  const candidates = new Map<string, { lat: number; lng: number }[]>();

  for (const [key, coords] of byLocality) {
    const loose = key.replace(LEADING_ARTICLE, '');
    if (loose === key) continue;
    const arr = candidates.get(loose) ?? [];
    arr.push(coords);
    candidates.set(loose, arr);
  }

  const index = new Map<string, { lat: number; lng: number }>();
  for (const [loose, coords] of candidates) {
    if (byLocality.has(loose) || coords.length > 1) continue;
    index.set(loose, coords[0]);
  }
  return index;
}

/**
 * Índice de centros geolocalizados de la región activa.
 *
 * El dataset se carga en diferido (`import()` por región) para que un usuario
 * solo descargue los centros de su comunidad y no los de toda España.
 */
@Injectable({ providedIn: 'root' })
export class CentresDatabaseService {
  private readonly region = inject(RegionService);

  private byCode = new Map<string, { lat: number; lng: number }>();
  private localityByCode = new Map<string, string>();
  private byLocality = new Map<string, { lat: number; lng: number }>();
  private byLocalityLoose = new Map<string, { lat: number; lng: number }>();
  private byLocalityAlias = new Map<string, { lat: number; lng: number }>();

  private loadedId: RegionId | null = null;
  private loadingId: RegionId | null = null;
  private loading: Promise<void> | null = null;

  /**
   * Garantiza que el dataset de la región activa está indexado.
   *
   * Se llama desde varios sitios y puede coincidir en el tiempo, así que las
   * llamadas concurrentes para la misma región comparten una única carga.
   */
  async ensureLoaded(): Promise<void> {
    const region = this.region.current();
    if (this.loadedId === region.id) return;

    if (this.loading && this.loadingId === region.id) {
      await this.loading;
      return;
    }

    this.loadingId = region.id;
    this.loading = this.load(region.id, region);

    try {
      await this.loading;
    } finally {
      if (this.loadingId === region.id) {
        this.loading = null;
        this.loadingId = null;
      }
    }
  }

  private async load(id: RegionId, region: RegionConfig): Promise<void> {
    // Hay comunidades sin directorio de centros descargable: sin él la app
    // sigue siendo usable, con coordenadas a nivel de municipio.
    const centres = await this.safely(region.loadCentres);
    const localities = await this.safely(region.loadLocalities);

    const byCode = new Map<string, { lat: number; lng: number }>();
    const locGroups = new Map<string, { lat: number; lng: number }[]>();

    const localityByCode = new Map<string, string>();
    const localityNames = new Map<string, string>();

    for (const rec of centres) {
      if (!byCode.has(rec.code)) {
        byCode.set(rec.code, { lat: rec.lat, lng: rec.lng });
        if (rec.locality) localityByCode.set(rec.code, rec.locality);
      }

      const key = localityKey(rec.locality);
      const arr = locGroups.get(key) ?? [];
      arr.push({ lat: rec.lat, lng: rec.lng });
      locGroups.set(key, arr);
      // El nombre tal cual lo escribe el registro, para poder desdoblarlo.
      if (rec.locality) localityNames.set(key, rec.locality);
    }

    const byLocality = new Map<string, { lat: number; lng: number }>();

    // El centroide del municipio es el punto de partida...
    for (const rec of localities) {
      byLocality.set(localityKey(rec.name), { lat: rec.lat, lng: rec.lng });
      localityNames.set(localityKey(rec.name), rec.name);
    }

    // ...pero si conocemos los centros de esa localidad, su promedio la sitúa
    // mejor: es donde están de verdad los destinos, no el centro geométrico
    // del término municipal.
    for (const [key, coords] of locGroups) {
      const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
      const avgLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
      byLocality.set(key, { lat: avgLat, lng: avgLng });
    }

    this.byCode = byCode;
    this.localityByCode = localityByCode;
    const named = [...byLocality].map(([key, coords]) => ({
      name: localityNames.get(key) ?? key,
      coords,
    }));

    this.byLocality = byLocality;
    this.byLocalityLoose = buildLooseIndex(byLocality);
    this.byLocalityAlias = buildAliasIndex(named, byLocality);
    this.loadedId = id;
  }

  private async safely<T>(loader?: () => Promise<T[]>): Promise<T[]> {
    if (!loader) return [];
    try {
      return await loader();
    } catch {
      return [];
    }
  }

  getCoordinates(code: string): { lat: number; lng: number } | null {
    return this.byCode.get(code) ?? null;
  }

  /**
   * Localidad del centro segun el directorio oficial.
   *
   * Hay listados que no traen columna de localidad —el anexo de vacantes de
   * Canarias es solo centro y recuentos—, y sin ella el filtro por localidad
   * queda inservible.
   */
  getCentreLocality(code: string): string | null {
    return this.localityByCode.get(code) ?? null;
  }

  /**
   * Busca en tres pasos, cada uno más permisivo que el anterior, porque el
   * artículo del topónimo puede sobrar en cualquiera de los dos lados:
   *
   * 1. Coincidencia exacta de la clave canónica.
   * 2. El listado añade un artículo que el registro no lleva
   *    ("CALZADA DE OROPESA (LA)" -> "Calzada de Oropesa").
   * 3. El registro lo lleva y el listado no ("Robledo" -> "El Robledo"),
   *    siempre que no haya dos municipios candidatos.
   * 4. Uno de los dos escribe el topónimo bilingüe entero y el otro solo una de
   *    sus mitades ("PAMPLONA" -> "Pamplona / Iruña").
   */
  getLocalityCoordinates(locality: string): { lat: number; lng: number } | null {
    const exact = this.byLocality.get(localityKey(locality));
    if (exact) return exact;

    const stripped = looseLocalityKey(locality);
    const loose = this.byLocality.get(stripped) ?? this.byLocalityLoose.get(stripped);
    if (loose) return loose;

    for (const alias of localityAliases(locality)) {
      const hit = this.byLocality.get(alias) ?? this.byLocalityAlias.get(alias);
      if (hit) return hit;
    }

    return null;
  }
}
