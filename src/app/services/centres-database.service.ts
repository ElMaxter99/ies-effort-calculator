import { Injectable } from '@angular/core';
import centresData from '../data/ies-coordinates.json';

interface CentreRecord {
  code: string;
  name: string;
  locality: string;
  lat: number;
  lng: number;
}

@Injectable({ providedIn: 'root' })
export class CentresDatabaseService {
  private byCode = new Map<string, { lat: number; lng: number }>();
  private byLocality = new Map<string, { lat: number; lng: number }>();

  constructor() {
    const data = centresData as CentreRecord[];
    for (const rec of data) {
      if (!this.byCode.has(rec.code)) {
        this.byCode.set(rec.code, { lat: rec.lat, lng: rec.lng });
      }
    }

    const locGroups = new Map<string, { lat: number; lng: number }[]>();
    for (const rec of data) {
      const key = rec.locality.toLowerCase().trim();
      const arr = locGroups.get(key) ?? [];
      arr.push({ lat: rec.lat, lng: rec.lng });
      locGroups.set(key, arr);
    }
    for (const [key, coords] of locGroups) {
      const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
      const avgLng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
      this.byLocality.set(key, { lat: avgLat, lng: avgLng });
    }
  }

  getCoordinates(code: string): { lat: number; lng: number } | null {
    return this.byCode.get(code) ?? null;
  }

  getLocalityCoordinates(locality: string): { lat: number; lng: number } | null {
    return this.byLocality.get(locality.toLowerCase().trim()) ?? null;
  }
}
