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
  progress = signal({ current: 0, total: 0, message: '' });

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
        for (const [key, val] of data) {
          this.cache.set(key, val);
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

  async geocode(place: string): Promise<GeoResult | null> {
    const key = place.toLowerCase().trim();
    if (this.cache.has(key)) return this.cache.get(key)!;

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.rateLimit();

      const query = encodeURIComponent(`${place}, Comunitat Valenciana, Spain`);
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&accept-language=ca`;

      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'ies-effort-calculator/1.0' },
        });

        if (res.status === 429) {
          const wait = 2000 * (attempt + 1);
          await new Promise((r) => setTimeout(r, wait));
          this.lastRequestTime = 0;
          continue;
        }

        const data = await res.json();

        if (data && data.length > 0) {
          const result: GeoResult = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
            displayName: data[0].display_name,
          };
          this.cache.set(key, result);
          this.saveCache();
          return result;
        }
        return null;
      } catch {
        return null;
      }
    }
    return null;
  }

  async geocodeBatch(places: string[]): Promise<Map<string, GeoResult | null>> {
    const unique = [...new Set(places.map((p) => p.replace(/ - .*$/, '').trim().toLowerCase()))];
    const results = new Map<string, GeoResult | null>();
    const pending: string[] = [];

    for (const loc of unique) {
      const cached = this.cache.get(loc);
      if (cached) {
        results.set(loc, cached);
      } else {
        pending.push(loc);
      }
    }

    this.progress.set({ current: 0, total: pending.length, message: `Geocoding localities...` });

    for (let i = 0; i < pending.length; i++) {
      const loc = pending[i];
      const result = await this.geocode(loc);
      results.set(loc, result);
      this.progress.set({ current: i + 1, total: pending.length, message: `Geocoding ${i + 1} of ${pending.length} localities...` });
    }

    this.progress.set({ current: pending.length, total: pending.length, message: `Geocoding complete (${pending.length} localities)` });
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

  getCached(key: string): GeoResult | undefined {
    return this.cache.get(key);
  }

  clearCache() {
    this.cache.clear();
    localStorage.removeItem(CACHE_KEY);
  }

  haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  effortLevel(distanceKm: number): string {
    if (distanceKm < this.thresholds.baix) return 'baix';
    if (distanceKm < this.thresholds.moderat) return 'moderat';
    if (distanceKm < this.thresholds.alt) return 'alt';
    return 'molt alt';
  }

  levelColor(level: string): string {
    switch (level) {
      case 'baix': return '#4caf50';
      case 'moderat': return '#ff9800';
      case 'alt': return '#f44336';
      case 'molt alt': return '#b71c1c';
      default: return '#9e9e9e';
    }
  }

  levelLabel(level: string): string {
    switch (level) {
      case 'baix': return 'Baix';
      case 'moderat': return 'Moderat';
      case 'alt': return 'Alt';
      case 'molt alt': return 'Molt Alt';
      default: return 'Unknown';
    }
  }

  levelDescription(level: string): string {
    switch (level) {
      case 'baix': return `< ${this.thresholds.baix} km - Comfortable commute`;
      case 'moderat': return `${this.thresholds.baix}-${this.thresholds.moderat} km - Reasonable commute`;
      case 'alt': return `${this.thresholds.moderat}-${this.thresholds.alt} km - Long commute`;
      case 'molt alt': return `> ${this.thresholds.alt} km - Very long commute`;
      default: return '';
    }
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }
}
