import { describe, it, expect } from 'vitest';
import { REGIONS, DEFAULT_REGION_ID, availableRegions, isRegionId } from './registry';
import { RegionConfig } from './region.types';
import { COVERAGE } from './coverage';

const regions = availableRegions();

describe('registro de regiones', () => {
  it('la región por defecto existe', () => {
    expect(REGIONS[DEFAULT_REGION_ID]).toBeDefined();
  });

  it('isRegionId acepta solo ids registrados', () => {
    expect(isRegionId('val')).toBe(true);
    expect(isRegionId('xx')).toBe(false);
    expect(isRegionId(null)).toBe(false);
  });

  it.each(regions.map((r) => [r.id, r] as [string, RegionConfig]))(
    '%s tiene una configuración coherente',
    (_id, region) => {
      expect(region.name.ca).toBeTruthy();
      expect(region.name.es).toBeTruthy();
      expect(region.geocodeSuffix).toMatch(/Spain$/);
      expect(region.portalHubUrl).toMatch(/^https:\/\//);
      expect(region.defaultOrigins.length).toBeGreaterThan(0);

      const [[south, west], [north, east]] = region.mapBounds;
      expect(south).toBeLessThan(north);
      expect(west).toBeLessThan(east);

      // Una comunidad sin fuente oficial debe declararse como manual-only,
      // para que la interfaz avise en lugar de ofrecer una descarga que no hay.
      if (!region.officialSource) {
        expect(region.status).toBe('manual-only');
      }
    },
  );
});

describe('expresiones regulares declaradas como texto', () => {
  /**
   * Estos patrones viven en literales de cadena, donde '\d' se colapsa a 'd' y
   * el patrón deja de casar nada sin dar ningún error. Ya ocurrió dos veces:
   * en el filtro de enlaces de Castilla-La Mancha y en el patrón de modalidad
   * de Canarias, donde además hizo que se tomara la firma digital del PDF como
   * si fuera la especialidad.
   */
  const suspicious = /(^|[^\\])\\[dswDSW]/;

  it('los filtros de enlaces compilan y no usan clases de escape', () => {
    for (const region of regions) {
      for (const page of region.officialSource?.pages ?? []) {
        if (!page.match) continue;

        expect(() => new RegExp(page.match!, 'i'), `${region.id}/${page.cos}`).not.toThrow();
        expect(page.match, `${region.id}/${page.cos}: escribe [0-9] en vez de \\d`).not.toMatch(suspicious);
      }
    }
  });

  it('los patrones de modalidad compilan y no usan clases de escape', () => {
    for (const region of regions) {
      const pattern = region.parserHints?.modalityPattern;
      if (!pattern) continue;

      expect(() => new RegExp(pattern), region.id).not.toThrow();
      expect(pattern, `${region.id}: escribe [0-9] en vez de \\d`).not.toMatch(suspicious);
    }
  });

  it('los patrones de fichas compilan y no usan clases de escape', () => {
    for (const region of regions) {
      const records = region.parserHints?.records;
      if (!records) continue;

      for (const [name, pattern] of Object.entries({
        labelPattern: records.labelPattern,
        ignorePattern: records.ignorePattern,
      })) {
        if (!pattern) continue;
        expect(() => new RegExp(pattern), region.id + "/" + name).not.toThrow();
        expect(pattern, region.id + "/" + name + ": usa clases explícitas").not.toMatch(suspicious);
      }
    }
  });

  it('el rótulo de ficha de Aragón captura el nombre y no casa con un valor', () => {
    const label = new RegExp(REGIONS.ara.parserHints!.records!.labelPattern);

    expect(label.exec('- Horas Lectivas -')?.[1]).toBe('Horas Lectivas');
    expect(label.exec('- Cuerpo/Especialidad -')?.[1]).toBe('Cuerpo/Especialidad');
    // Un valor no puede confundirse con un rótulo, o la ficha perdería datos.
    expect(label.test('0590 - PROFESORES DE ENSEÑANZA SECUNDARIA')).toBe(false);
    expect(label.test('(50008198) IES GOYA')).toBe(false);
    expect(label.test('Parcial')).toBe(false);
  });

  it('el patrón de modalidad de Canarias reconoce la especialidad y no la firma digital', () => {
    const pattern = new RegExp(REGIONS.can.parserHints!.modalityPattern!);

    expect(pattern.test('201 Filosofía')).toBe(true);
    expect(pattern.test('590 Matemáticas')).toBe(true);
    // Cadena real de la firma electrónica incrustada en el anexo.
    expect(pattern.test('RP001-0007E0/ajdSt346T39UR6CBTQ==')).toBe(false);
    expect(pattern.test('Anexo II Vacantes Iniciales (Secundaria)')).toBe(false);
  });

  it('Castilla-La Mancha separa secundaria de maestros entre sus 121 PDFs', () => {
    const pages = REGIONS.clm.officialSource!.pages;
    const secundaria = new RegExp(pages.find((p) => p.cos === 'secundaria')!.match!, 'i');
    const primaria = new RegExp(pages.find((p) => p.cos === 'primaria')!.match!, 'i');

    const deSecundaria = [
      'Vacantes cuerpo 0590 (Por centro) (2) - Asignaciones2026 16072026.pdf',
      'VACANTES PROVISIONALES CUERPO 0590 - Asignaciones2026 - TO.pdf',
      '0592 Vacantes actos públicos - Asignaciones2026 - CU.pdf',
      'Vacantes para Comisiones EEMM - Asignaciones20206 AB.pdf',
    ];
    const deMaestros = [
      'Vacantes provisionales maestros Albacete 2026_Asignaciones2026.pdf',
      'VACANTES MAESTROS. Cuenca  2026-2027_Asignaciones2026.pdf',
      'Vacantes Primaria_Guadalajara_Asignaciones2026.pdf',
    ];
    const niUnoNiOtro = [
      'Calendario de adjudicaciones maestros_Asignaciones2026.pdf',
      'Relación definitiva de asistentes al acto público EEMM AB - Asignaciones2026.pdf',
      'Cambios de provincia_Asignaciones2026.pdf',
    ];

    for (const f of deSecundaria) {
      expect(secundaria.test(f), `debería ser de secundaria: ${f}`).toBe(true);
      expect(primaria.test(f), `no debería ser de primaria: ${f}`).toBe(false);
    }
    for (const f of deMaestros) {
      expect(primaria.test(f), `debería ser de primaria: ${f}`).toBe(true);
      expect(secundaria.test(f), `no debería ser de secundaria: ${f}`).toBe(false);
    }
    for (const f of niUnoNiOtro) {
      expect(secundaria.test(f), `no es un listado de vacantes: ${f}`).toBe(false);
      expect(primaria.test(f), `no es un listado de vacantes: ${f}`).toBe(false);
    }
  });
});

describe('datasets de centros', () => {
  const withDataset = regions.filter((r) => r.loadCentres);

  it('hay al menos una región con dataset propio', () => {
    expect(withDataset.length).toBeGreaterThan(0);
  });

  it('una región sin directorio de centros no puede declararse estable', () => {
    // Sin directorio de centros solo se puede situar la plaza en su municipio;
    // es utilizable, pero no es precisión de "stable".
    for (const region of regions.filter((r) => !r.loadCentres)) {
      expect(region.status, `${region.id} sin directorio de centros`).not.toBe('stable');
    }
  });

  it('toda región tiene alguna fuente de coordenadas', () => {
    for (const region of regions) {
      const hasSource = !!region.loadCentres || !!region.loadLocalities;
      expect(hasSource, `${region.id} no tiene ni centros ni municipios`).toBe(true);
    }
  });

  it.each(
    regions.filter((r) => r.loadLocalities).map((r) => [r.id, r] as [string, RegionConfig]),
  )('%s: municipios dentro de sus límites y sin códigos repetidos', async (id, region) => {
    const localities = await region.loadLocalities!();
    expect(localities.length).toBeGreaterThan(0);

    const [[south, west], [north, east]] = region.mapBounds;
    const outOfBounds: string[] = [];
    const codes = new Set<string>();

    for (const l of localities) {
      expect(Number.isFinite(l.lat) && Number.isFinite(l.lng), `${id}/${l.code}`).toBe(true);
      if (l.lat < south || l.lat > north || l.lng < west || l.lng > east) {
        outOfBounds.push(`${l.code} ${l.name} (${l.lat}, ${l.lng})`);
      }
      codes.add(l.code);
    }

    expect(outOfBounds, `${id}: municipios fuera de mapBounds`).toEqual([]);
    expect(codes.size, `${id}: códigos de municipio duplicados`).toBe(localities.length);
  });

  it.each(withDataset.map((r) => [r.id, r] as [string, RegionConfig]))(
    '%s: coordenadas válidas, dentro de sus límites y códigos únicos',
    async (id, region) => {
      const centres = await region.loadCentres!();
      expect(centres.length).toBeGreaterThan(0);

      const [[south, west], [north, east]] = region.mapBounds;
      const codes = new Set<string>();
      const outOfBounds: string[] = [];

      for (const c of centres) {
        expect(c.code, `${id}: centro sin código`).toBeTruthy();
        expect(Number.isFinite(c.lat), `${id}/${c.code}: lat no numérica`).toBe(true);
        expect(Number.isFinite(c.lng), `${id}/${c.code}: lng no numérica`).toBe(true);

        // Detecta un fallo de reproyección (p. ej. UTM sin convertir a WGS84):
        // las coordenadas caerían lejísimos de la comunidad.
        if (c.lat < south || c.lat > north || c.lng < west || c.lng > east) {
          outOfBounds.push(`${c.code} ${c.name} (${c.lat}, ${c.lng})`);
        }

        codes.add(c.code);
      }

      expect(outOfBounds, `${id}: centros fuera de mapBounds`).toEqual([]);
      expect(codes.size, `${id}: hay códigos de centro duplicados`).toBe(centres.length);
    },
  );
});

describe('tabla de cobertura de la portada', () => {
  it('cubre las 17 comunidades y las 2 ciudades autónomas', () => {
    expect(COVERAGE).toHaveLength(19);
    expect(new Set(COVERAGE.map((c) => c.name.es)).size).toBe(19);
  });

  it('toda entrada tiene nombre y detalle en los dos idiomas', () => {
    for (const entry of COVERAGE) {
      expect(entry.name.ca, entry.name.es).toBeTruthy();
      expect(entry.name.es).toBeTruthy();
      expect(entry.note.ca, `${entry.name.es}: falta detall en català`).toBeTruthy();
      expect(entry.note.es, `${entry.name.es}: falta detalle en castellano`).toBeTruthy();
    }
  });

  it('no anuncia como operativa ninguna comunidad que no esté implementada', () => {
    // Es el error que haría mentir a la portada: prometer soporte inexistente.
    const operativas = COVERAGE.filter(
      (c) => c.status === 'stable' || c.status === 'beta' || c.status === 'manual-only',
    );
    for (const entry of operativas) {
      expect(entry.id, `${entry.name.es} se anuncia operativa sin región`).toBeDefined();
      expect(REGIONS[entry.id!], `${entry.name.es} apunta a una región inexistente`).toBeDefined();
    }
  });

  it('toda región implementada aparece en la tabla con su estado real', () => {
    for (const region of regions) {
      const entry = COVERAGE.find((c) => c.id === region.id);
      expect(entry, `${region.id} no aparece en la tabla de cobertura`).toBeDefined();
      expect(entry!.status, `${region.id}: el estado de la tabla no coincide`).toBe(region.status);
    }
  });

  it('una comunidad pendiente o bloqueada no puede apuntar a una región', () => {
    for (const entry of COVERAGE.filter((c) => c.status === 'pending' || c.status === 'blocked')) {
      expect(entry.id, `${entry.name.es} está ${entry.status} pero tiene región`).toBeUndefined();
    }
  });
});
