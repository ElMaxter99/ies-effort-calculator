import { Injectable, computed, signal } from '@angular/core';
import { DEFAULT_REGION_ID, REGIONS, availableRegions, isRegionId } from './registry';
import { RegionConfig, RegionId } from './region.types';

const STORAGE_KEY = 'ies_region';

/**
 * Región activa. Es la fuente única de la que cuelgan el parser, el dataset de
 * centros, la geocodificación y el descubrimiento de PDFs oficiales.
 */
@Injectable({ providedIn: 'root' })
export class RegionService {
  private readonly id = signal<RegionId>(this.restore());

  readonly current = computed<RegionConfig>(() => REGIONS[this.id()]);
  readonly currentId = this.id.asReadonly();
  readonly all = availableRegions();

  select(id: RegionId) {
    if (id === this.id()) return;
    this.id.set(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage lleno o no disponible: la elección dura la sesión.
    }
  }

  private restore(): RegionId {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isRegionId(stored)) return stored;
    } catch {
      // localStorage inaccesible (modo privado estricto).
    }
    return DEFAULT_REGION_ID;
  }
}
