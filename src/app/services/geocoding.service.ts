import { Injectable, signal } from '@angular/core';
import { EffortThresholds } from '../types';

interface GeoResult {
  lat: number;
  lng: number;
  displayName: string;
}

const CACHE_KEY = 'ies_geo_cache';

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  thresholds: EffortThresholds = { baix: 5, moderat: 15, alt: 30 };
  progress = signal({ actual: 0, total: 0, missatge: '' });

  private cache = new Map<string, GeoResult>();
  private lastRequestTime = 0;
  private requestLock = Promise.resolve();

  constructor() {
    this.loadCache();
  }

  private loadCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as [string, { lat: number; lng: number; displayName: string }][];
        for (const [clau, val] of data) {
          this.cache.set(clau, val);
        }
      }
    } catch {
      // ignore corrupt cache
    }
  }

  private saveCache() {
    try {
      const data = Array.from(this.cache.entries());
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable
    }
  }

  async geocodifica(lloc: string): Promise<GeoResult | null> {
    const clau = lloc.toLowerCase().trim();
    if (this.cache.has(clau)) return this.cache.get(clau)!;

    for (let intent = 0; intent < 3; intent++) {
      await this.rateLimit();

      const query = encodeURIComponent(`${lloc}, Comunitat Valenciana, Spain`);
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=ca`;

      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'ies-effort-calculator/1.0' },
        });

        if (res.status === 429) {
          const espera = 2000 * (intent + 1);
          await new Promise((r) => setTimeout(r, espera));
          this.lastRequestTime = 0;
          continue;
        }

        const dades = await res.json();

        if (dades && dades.length > 0) {
          const resultat: GeoResult = {
            lat: parseFloat(dades[0].lat),
            lng: parseFloat(dades[0].lon),
            displayName: dades[0].display_name,
          };
          this.cache.set(clau, resultat);
          this.saveCache();
          return resultat;
        }
        return null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async geocodificaBatch(localitats: string[]): Promise<Map<string, GeoResult | null>> {
    const uniques = [...new Set(localitats.map((l) => l.replace(/ - .*$/, '').trim().toLowerCase()))];
    const results = new Map<string, GeoResult | null>();
    const pendents: string[] = [];

    for (const loc of uniques) {
      const cached = this.cache.get(loc);
      if (cached) {
        results.set(loc, cached);
      } else {
        pendents.push(loc);
      }
    }

    this.progress.set({ actual: 0, total: pendents.length, missatge: `Geocodificant localitats...` });

    for (let i = 0; i < pendents.length; i++) {
      const loc = pendents[i];
      const result = await this.geocodifica(loc);
      results.set(loc, result);
      this.progress.set({ actual: i + 1, total: pendents.length, missatge: `Geocodificant ${i + 1} de ${pendents.length} localitats...` });
    }

    this.progress.set({ actual: pendents.length, total: pendents.length, missatge: `Geocodificació completada (${pendents.length} localitats)` });
    return results;
  }

  private async rateLimit() {
    this.requestLock = this.requestLock.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < 1100) {
        await new Promise((r) => setTimeout(r, 1100 - elapsed));
      }
      this.lastRequestTime = Date.now();
    });
    await this.requestLock;
  }

  distanciaHaversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  nivellEsforc(distanciaKm: number): string {
    if (distanciaKm < this.thresholds.baix) return 'baix';
    if (distanciaKm < this.thresholds.moderat) return 'moderat';
    if (distanciaKm < this.thresholds.alt) return 'alt';
    return 'molt alt';
  }

  colorNivell(nivell: string): string {
    switch (nivell) {
      case 'baix': return '#4caf50';
      case 'moderat': return '#ff9800';
      case 'alt': return '#f44336';
      case 'molt alt': return '#b71c1c';
      default: return '#9e9e9e';
    }
  }

  etiquetaNivell(nivell: string): string {
    switch (nivell) {
      case 'baix': return 'Baix';
      case 'moderat': return 'Moderat';
      case 'alt': return 'Alt';
      case 'molt alt': return 'Molt Alt';
      default: return 'Desconegut';
    }
  }

  descripcioNivell(nivell: string): string {
    switch (nivell) {
      case 'baix': return `< ${this.thresholds.baix} km - Desplaçament còmode`;
      case 'moderat': return `${this.thresholds.baix}-${this.thresholds.moderat} km - Desplaçament raonable`;
      case 'alt': return `${this.thresholds.moderat}-${this.thresholds.alt} km - Desplaçament llarg`;
      case 'molt alt': return `> ${this.thresholds.alt} km - Desplaçament molt llarg`;
      default: return '';
    }
  }

  esborraCache() {
    this.cache.clear();
    localStorage.removeItem(CACHE_KEY);
  }

  private toRad(valor: number): number {
    return (valor * Math.PI) / 180;
  }
}
