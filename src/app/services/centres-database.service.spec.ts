import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CentresDatabaseService, localityKey, looseLocalityKey } from './centres-database.service';
import { RegionService } from '../regions/region.service';

import valCentres from '../data/centres/val.json';
import clmLocalities from '../data/localities/clm.json';

describe('localityKey', () => {
  it('ignora mayúsculas, acentos y puntuación', () => {
    expect(localityKey('ALCAZAR DE SAN JUAN')).toBe(localityKey('Alcázar de San Juan'));
    expect(localityKey('CASTELLO DE LA PLANA')).toBe(localityKey('Castelló de la Plana'));
    expect(localityKey('  Toledo  ')).toBe('toledo');
  });

  it('canoniza el artículo pospuesto, lo escriba quien lo escriba', () => {
    // Castilla-La Mancha lo pospone en el PDF y lo antepone en su registro.
    expect(localityKey('ROBLEDO (EL)')).toBe(localityKey('El Robledo'));
    expect(localityKey('SOLANA (LA)')).toBe(localityKey('La Solana'));
    // La Comunitat Valenciana hace justo lo contrario.
    expect(localityKey('VILA JOIOSA (LA)')).toBe(localityKey('LA VILA JOIOSA'));
    expect(localityKey("ALCORA (L')")).toBe(localityKey("L'ALCORA"));
  });

  it('no confunde municipios distintos', () => {
    expect(localityKey('Toledo')).not.toBe(localityKey('Toledo de Abajo'));
    expect(localityKey('La Herrera')).not.toBe(localityKey('Herrera de la Mancha'));
  });
});

describe('looseLocalityKey', () => {
  it('quita el artículo inicial', () => {
    expect(looseLocalityKey('CALZADA DE OROPESA (LA)')).toBe('calzada de oropesa');
    expect(looseLocalityKey('El Robledo')).toBe('robledo');
  });

  it('deja intacto lo que no lleva artículo', () => {
    expect(looseLocalityKey('Toledo')).toBe('toledo');
  });
});

describe('coherencia de los datasets', () => {
  it('las claves de municipio de Castilla-La Mancha no colisionan', () => {
    // Una colisión situaría plazas en el municipio equivocado.
    const keys = new Map<string, string[]>();
    for (const loc of clmLocalities) {
      const key = localityKey(loc.name);
      keys.set(key, [...(keys.get(key) ?? []), loc.name]);
    }

    const collisions = [...keys.entries()].filter(([, names]) => names.length > 1);
    expect(collisions).toEqual([]);
    expect(keys.size).toBe(clmLocalities.length);
  });

  it('los municipios de Castilla-La Mancha tienen código INE de 5 dígitos', () => {
    expect(clmLocalities.every((l) => /^\d{5}$/.test(l.code))).toBe(true);
  });

  it('las localidades de la Comunitat Valenciana son buscables por su forma natural', () => {
    const index = new Set(valCentres.map((c) => localityKey(c.locality)));

    // Tal como aparecen escritas en el PDF oficial de vacantes.
    for (const written of ['LA VILA JOIOSA', 'VALENCIA', 'ALACANT', 'CASTELLO DE LA PLANA', "L'ALCORA"]) {
      expect(index.has(localityKey(written)), `no se encuentra ${written}`).toBe(true);
    }
  });
});

describe('búsqueda de localidades sobre los datasets reales', () => {
  let db: CentresDatabaseService;
  let regions: RegionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    db = TestBed.inject(CentresDatabaseService);
    regions = TestBed.inject(RegionService);
  });

  it('Castilla-La Mancha: resuelve las localidades tal como las escribe el PDF', async () => {
    regions.select('clm');
    await db.ensureLoaded();

    // Formas literales tomadas de los PDFs oficiales de Ciudad Real y Toledo.
    for (const written of [
      'ABENOJAR',                 // sin acento en el PDF, con él en el registro
      'ALCAZAR DE SAN JUAN',
      'SOLANA (LA)',              // artículo pospuesto en el PDF
      'CALZADA DE OROPESA (LA)',  // artículo que el registro no lleva
      'TALAVERA DE LA REINA',
      'ALCAUDETE DE LA JARA',
    ]) {
      const coords = db.getLocalityCoordinates(written);
      expect(coords, `no se resuelve ${written}`).not.toBeNull();
      expect(coords!.lat).toBeGreaterThan(38);
      expect(coords!.lat).toBeLessThan(41.5);
    }
  });

  it('no inventa coordenadas para entidades submunicipales', () => {
    // Pedanías, urbanizaciones y barrios no están en el registro de municipios:
    // deben quedar sin resolver para que se geocodifiquen en tiempo real, en
    // lugar de acabar situados en un municipio parecido.
    expect(db.getLocalityCoordinates('SEÑORIO DE ILLESCAS (EL)')).toBeNull();
    expect(db.getLocalityCoordinates('HERRERA DE LA MANCHA')).toBeNull();
  });

  it('cambiar de comunidad reemplaza el índice', async () => {
    regions.select('clm');
    await db.ensureLoaded();
    expect(db.getLocalityCoordinates('TOLEDO')).not.toBeNull();

    regions.select('val');
    await db.ensureLoaded();
    expect(db.getLocalityCoordinates('TOLEDO')).toBeNull();
    expect(db.getLocalityCoordinates('ALACANT')).not.toBeNull();
    // La Comunitat Valenciana sí tiene directorio de centros: búsqueda por código.
    expect(db.getCoordinates('03010119')).not.toBeNull();
  });
});
