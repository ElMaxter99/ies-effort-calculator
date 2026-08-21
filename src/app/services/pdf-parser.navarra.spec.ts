import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem, ParseState, ParserHints } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { IesRow } from '../types';
import { NAV } from '../regions/nav';

import secundaria from './__fixtures__/nav-secundaria.json';
import maestros from './__fixtures__/nav-maestros.json';
import conservatorio from './__fixtures__/nav-conservatorio.json';

interface FixturePage {
  page: number;
  items: { s: string; x: number; y: number }[];
}

/**
 * Recorre el fichero como lo haría la aplicación: la maqueta se decide con la
 * primera página, no se le dice de antemano.
 */
function parseFixture(fixture: unknown): { rows: IesRow[]; hints: ParserHints } {
  const parser = new PdfParserService(new I18nService());
  const rows: IesRow[] = [];
  let state: ParseState = {};
  let hints = NAV.parserHints!;

  for (const page of fixture as FixturePage[]) {
    const items: PdfTextItem[] = page.items.map((i) => ({ str: i.s, transform: [1, 0, 0, 1, i.x, i.y] }));
    if (page.page === 1) hints = parser.selectVariant(items, hints);

    const result = parser.parsePage(items, hints, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return { rows, hints };
}

describe('Navarra (dos maquetas en una misma comunidad)', () => {
  const sec = parseFixture(secundaria);
  const mae = parseFixture(maestros);
  const cons = parseFixture(conservatorio);

  it('reconoce la maqueta de maestros por su rótulo en euskera', () => {
    // El listado de maestros es bilingüe y el de secundaria no; es lo único
    // que los distingue sin mirar dónde cae cada columna.
    expect(mae.hints.columnOverrides?.code).toBeDefined();
    expect(sec.hints.columnOverrides?.code).toBeUndefined();
    expect(cons.hints.columnOverrides?.code).toBeUndefined();
  });

  describe('maestros', () => {
    it('expande los recuentos a una plaza por vacante', () => {
      // 77 jornadas completas y 16 filas con horas sueltas en dos páginas.
      expect(mae.rows).toHaveLength(93);
    });

    it('cruza todas las plazas por código de centro', () => {
      expect(mae.rows.every((r) => /^31\d{6}$/.test(r.code))).toBe(true);
      expect(mae.rows.filter((r) => !r.locality)).toHaveLength(0);
    });

    it('marca como parcial la plaza que sale de las horas sueltas', () => {
      const parciales = mae.rows.filter((r) => r.hours);

      expect(parciales).toHaveLength(16);
      // Un centro con 1 completa y 17 horas ofrece dos plazas, no una.
      const huarte = mae.rows.filter((r) => r.code === '31002709');
      expect(huarte).toHaveLength(2);
      expect(huarte.filter((r) => r.hours).map((r) => r.hours)).toEqual(['17']);
    });

    it('no cuela la cabecera ni el rótulo de especialidad como plazas', () => {
      expect(mae.rows.some((r) => /^Centro$|^Código$/i.test(r.centre))).toBe(false);
      expect(mae.rows.every((r) => !!r.modality)).toBe(true);
      expect(mae.rows[0].modality).toContain('EDUCACIÓN INFANTIL');
    });
  });

  describe('secundaria', () => {
    it('expande los recuentos a una plaza por vacante', () => {
      // 22 jornadas completas y 16 filas con horas sueltas en dos páginas.
      expect(sec.rows).toHaveLength(38);
    });

    it('separa la localidad que va pegada al nombre del centro', () => {
      const first = sec.rows[0];

      expect(first.centre).toBe('I.E.S. DE BARAÑAIN');
      expect(first.locality).toBe('BARAÑAIN');
      expect(sec.rows.filter((r) => !r.locality)).toHaveLength(0);
      // Este listado no trae código: la plaza se sitúa por su localidad.
      expect(sec.rows.every((r) => r.code === '')).toBe(true);
    });

    it('recompone el nombre del centro que se parte en dos líneas', () => {
      // "ESCUELA DE ARTE Y SUPERIOR DE DISEÑO DE" continúa en
      // "CORELLA- CORELLA", y ahí es donde va la localidad.
      const arte = sec.rows.find((r) => r.centre.startsWith('ESCUELA DE ARTE'));

      expect(arte).toBeDefined();
      expect(arte!.centre).toBe('ESCUELA DE ARTE Y SUPERIOR DE DISEÑO DE CORELLA');
      expect(arte!.locality).toBe('CORELLA');
    });

    it('descarta el membrete, la cabecera y la fila de totales', () => {
      // Sin código de centro, lo único que distingue una plaza de un rótulo es
      // que su celda traiga la localidad detrás de un guion.
      const basura = /TOTAL|NECESIDADES DE PROFESORADO|^CENTRO$|CUERPO|Página/i;

      expect(sec.rows.filter((r) => basura.test(r.centre))).toHaveLength(0);
    });

    it('arrastra la especialidad que encabeza cada bloque', () => {
      expect(sec.rows.every((r) => !!r.modality)).toBe(true);
      expect(sec.rows[0].modality).toBe('FILOSOFÍA (CASTELLANO)');
    });
  });

  describe('conservatorio y artes', () => {
    it('cuenta las plazas de media hora', () => {
      // Los conservatorios reparten la carga en medias horas ("9,5"): leer solo
      // enteros dejaba fuera la mitad de sus plazas parciales.
      expect(cons.rows).toHaveLength(6);
      expect(cons.rows.filter((r) => r.hours).map((r) => r.hours)).toContain('9,5');
    });

    it('une la continuación aunque parta a la vez nombre y observaciones', () => {
      expect(cons.rows.every((r) => r.centre === 'CONSERVATORIO SUPERIOR DE MUSICA DE NAVARRA')).toBe(true);
      expect(cons.rows.every((r) => r.locality === 'PAMPLONA')).toBe(true);
    });
  });
});
