import { Injectable, signal } from '@angular/core';
import { EffortThresholds, TransportMode, RouteData } from '../types';
import { I18nService } from './i18n.service';

interface GeoResult {
  lat: number;
  lng: number;
  displayName: string;
}

interface OSRMResult {
  distance: number;
  duration: number;
}

const CACHE_KEY = 'ies_geo_cache';
const ROUTE_CACHE_KEY = 'ies_route_cache';

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  thresholds: EffortThresholds = { baix: 10, moderat: 45, alt: 75 };
  progress = signal({ current: 0, total: 0, message: '' });

  private cache = new Map<string, GeoResult>();
  private routeCache = new Map<string, OSRMResult>();
  private lastRequestTime = 0;
  private requestLock = Promise.resolve();

  constructor(public i18n: I18nService) {
    this.loadCache();
    this.loadRouteCache();
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

  private loadRouteCache() {
    try {
      const raw = localStorage.getItem(ROUTE_CACHE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as [string, { distance: number; duration: number }][];
        for (const [key, val] of data) {
          this.routeCache.set(key, val);
        }
      }
    } catch {
      // ignore corrupt cache
    }
  }

  private saveRouteCache() {
    try {
      const data = Array.from(this.routeCache.entries());
      localStorage.setItem(ROUTE_CACHE_KEY, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable
    }
  }

  private osrmBase(): string {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return host.includes('vercel.app') ? '/api/osrm' : 'https://router.project-osrm.org';
  }

  static readonly MODE_PROFILE: Record<TransportMode, string | null> = {
    car: 'driving',
    public: null,
    walking: 'walking',
    bicycle: 'cycling',
  };

  async fetchRoute(
    originLat: number, originLng: number,
    destLat: number, destLng: number,
    mode: TransportMode,
  ): Promise<RouteData | null> {
    const profile = GeocodingService.MODE_PROFILE[mode];
    if (!profile) return null;

    const cacheKey = `${originLat.toFixed(5)},${originLng.toFixed(5)}-${destLat.toFixed(5)},${destLng.toFixed(5)}-${mode}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached) return { distanceKm: parseFloat((cached.distance / 1000).toFixed(1)), durationMin: Math.round(cached.duration / 60) };

    const base = this.osrmBase();
    const url = `${base}/route/v1/${profile}/${originLng},${originLat};${destLng},${destLat}?overview=false`;

    const res = await this.fetchWithTimeout(url);
    if (!res?.ok) return null;

    try {
      const data = await res.json();
      if (!data?.routes?.[0]) return null;

      const route = data.routes[0] as { distance: number; duration: number };
      const result: OSRMResult = { distance: route.distance, duration: route.duration };

      this.routeCache.set(cacheKey, result);
      this.saveRouteCache();

      return { distanceKm: parseFloat((route.distance / 1000).toFixed(1)), durationMin: Math.round(route.duration / 60) };
    } catch {
      return null;
    }
  }

  async fetchRouteTable(
    originLat: number, originLng: number,
    destinations: { lat: number; lng: number }[],
    mode: TransportMode,
    onProgress?: (current: number, total: number) => void,
  ): Promise<(RouteData | null)[]> {
    const profile = GeocodingService.MODE_PROFILE[mode];
    if (!profile) return destinations.map(() => null);

    const results: (RouteData | null)[] = new Array(destinations.length).fill(null);
    const BATCH_SIZE = mode === 'walking' || mode === 'bicycle' ? 30 : 100;

    const uncached: number[] = [];
    for (let i = 0; i < destinations.length; i++) {
      const d = destinations[i];
      const cacheKey = `${originLat.toFixed(5)},${originLng.toFixed(5)}-${d.lat.toFixed(5)},${d.lng.toFixed(5)}-${mode}`;
      const cached = this.routeCache.get(cacheKey);
      if (cached) {
        results[i] = { distanceKm: parseFloat((cached.distance / 1000).toFixed(1)), durationMin: Math.round(cached.duration / 60) };
      } else {
        uncached.push(i);
      }
    }

    const base = this.osrmBase();
    let done = 0;

    for (let start = 0; start < uncached.length; start += BATCH_SIZE) {
      const batch = uncached.slice(start, start + BATCH_SIZE);
      const coords = [`${originLng},${originLat}`];
      for (const idx of batch) {
        coords.push(`${destinations[idx].lng},${destinations[idx].lat}`);
      }

      const url = `${base}/table/v1/${profile}/${coords.join(';')}?sources=0&annotations=distance,duration`;

      const res = await this.fetchWithTimeout(url, mode === 'walking' || mode === 'bicycle' ? 60000 : 30000);
      if (res?.ok) {
        try {
          const data = await res.json();
          if (data?.durations?.[0] && data?.distances?.[0]) {
            for (let j = 0; j < batch.length; j++) {
              const dist = data.distances[0][j + 1];
              const dur = data.durations[0][j + 1];
              if (dist !== null && dur !== null) {
                const idx = batch[j];
                const result: OSRMResult = { distance: dist, duration: dur };
                const d = destinations[idx];
                const cacheKey = `${originLat.toFixed(5)},${originLng.toFixed(5)}-${d.lat.toFixed(5)},${d.lng.toFixed(5)}-${mode}`;
                this.routeCache.set(cacheKey, result);
                results[idx] = { distanceKm: parseFloat((dist / 1000).toFixed(1)), durationMin: Math.round(dur / 60) };
              }
            }
          }
        } catch {
          // batch parse failed, results stay null
        }
      }

      done += batch.length;
      onProgress?.(done, uncached.length);
    }

    this.saveRouteCache();
    return results;
  }

  clearRouteCache() {
    this.routeCache.clear();
    localStorage.removeItem(ROUTE_CACHE_KEY);
  }

  private nominatimBase(): string {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return host.includes('vercel.app') ? '/api/nominatim' : 'https://nominatim.openstreetmap.org';
  }

  async geocode(place: string): Promise<GeoResult | null> {
    const key = place.toLowerCase().trim();
    if (this.cache.has(key)) return this.cache.get(key)!;

    for (let attempt = 0; attempt < 3; attempt++) {
      await this.rateLimit();

      const query = encodeURIComponent(`${place}, Comunitat Valenciana, Spain`);
      const base = this.nominatimBase();
      const url = `${base}/search?q=${query}&format=json&limit=1&accept-language=ca`;

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
    const unique = [...new Set(places.map((p) => p.trim().toLowerCase()))];
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

    const t = this.i18n.t();
    this.progress.set({ current: 0, total: pending.length, message: t.geocodingLocalities });

    for (let i = 0; i < pending.length; i++) {
      const loc = pending[i];
      const result = await this.geocode(loc);
      results.set(loc, result);
      this.progress.set({ current: i + 1, total: pending.length, message: t.geocodingProgress(i + 1, pending.length) });
    }

    this.progress.set({ current: pending.length, total: pending.length, message: t.geocodingComplete(pending.length) });
    return results;
  }

  private async fetchWithTimeout(url: string, timeoutMs = 30000): Promise<Response | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'ies-effort-calculator/1.0' },
      });
      return res;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
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

  getCachedRoute(originLat: number, originLng: number, destLat: number, destLng: number, mode: TransportMode): RouteData | undefined {
    const cacheKey = `${originLat.toFixed(5)},${originLng.toFixed(5)}-${destLat.toFixed(5)},${destLng.toFixed(5)}-${mode}`;
    const cached = this.routeCache.get(cacheKey);
    if (!cached) return undefined;
    return { distanceKm: parseFloat((cached.distance / 1000).toFixed(1)), durationMin: Math.round(cached.duration / 60) };
  }

  clearCache() {
    this.cache.clear();
    localStorage.removeItem(CACHE_KEY);
  }

  removeOriginRoutes(originLat: number, originLng: number) {
    const prefix = `${originLat.toFixed(5)},${originLng.toFixed(5)}-`;
    for (const key of this.routeCache.keys()) {
      if (key.startsWith(prefix)) {
        this.routeCache.delete(key);
      }
    }
    this.saveRouteCache();
  }

  clearAllCaches() {
    this.cache.clear();
    this.routeCache.clear();
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(ROUTE_CACHE_KEY);
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
    const t = this.i18n.t();
    switch (level) {
      case 'baix': return t.levelLabelBaix;
      case 'moderat': return t.levelLabelModerat;
      case 'alt': return t.levelLabelAlt;
      case 'molt alt': return t.levelLabelMoltAlt;
      default: return t.levelLabelUnknown;
    }
  }

  levelDescription(level: string): string {
    const t = this.i18n.t();
    switch (level) {
      case 'baix': return t.levelDescBaix(this.thresholds.baix);
      case 'moderat': return t.levelDescModerat(this.thresholds.baix, this.thresholds.moderat);
      case 'alt': return t.levelDescAlt(this.thresholds.moderat, this.thresholds.alt);
      case 'molt alt': return t.levelDescMoltAlt(this.thresholds.alt);
      default: return '';
    }
  }

  static readonly MODE_SPEEDS: Record<TransportMode, number> = {
    car: 50,
    public: 35,
    walking: 5,
    bicycle: 15,
  };

  static readonly MODE_MULTIPLIER: Record<TransportMode, number> = {
    car: 1.4,
    public: 1.5,
    walking: 1.3,
    bicycle: 1.3,
  };

  estimateTravelTime(distanceKm: number, mode: TransportMode): number {
    const roadKm = distanceKm * GeocodingService.MODE_MULTIPLIER[mode];
    const hours = roadKm / GeocodingService.MODE_SPEEDS[mode];
    return Math.round(hours * 60);
  }

  formatTravelTime(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }

  modeLabel(mode: TransportMode): string {
    const t = this.i18n.t();
    switch (mode) {
      case 'car': return t.modeCar;
      case 'public': return t.modePublic;
      case 'walking': return t.modeWalking;
      case 'bicycle': return t.modeBicycle;
    }
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }
}
