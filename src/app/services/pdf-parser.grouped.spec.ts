import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem, ParseState } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { IesRow } from '../types';
import { CLM } from '../regions/clm';

import fixture from './__fixtures__/clm-secundaria.json';

interface FixturePage {
  page: number;
  items: { s: string; x: number; y: number }[];
}

function toItems(page: FixturePage): PdfTextItem[] {
  return page.items.map((i) => ({ str: i.s, transform: [1, 0, 0, 1, i.x, i.y] }));
}

function parseFixture(): IesRow[] {
  const parser = new PdfParserService(new I18nService());
  const rows: IesRow[] = [];
  let state: ParseState = {};

  for (const page of fixture as FixturePage[]) {
    const result = parser.parsePage(toItems(page), CLM.parserHints, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return rows;
}

describe('Castilla-La Mancha (listado agrupado por centro)', () => {
  const rows = parseFixture();

  it('extrae plazas del PDF real', () => {
    expect(rows.length).toBeGreaterThan(20);
  });

  it('cada plaza tiene centro, localidad y código de centro', () => {
    expect(rows.filter((r) => !r.centre)).toEqual([]);
    expect(rows.filter((r) => !r.locality)).toEqual([]);
    expect(rows.every((r) => /^\d{6,8}$/.test(r.code))).toBe(true);
  });

  it('lee correctamente el primer bloque de centro del documento', () => {
    // Primer centro real del PDF de Ciudad Real:
    //   Centro  13012465  ABENOJAR / CRA N.º 11
    //   0590018 - 018  PSICOLOGIA Y PEDAGOGIA   1   0
    expect(rows[0]).toMatchObject({
      number: 1,
      code: '13012465',
      locality: 'ABENOJAR',
      centre: 'CRA N.º 11',
      isItinerant: false,
    });
    expect(rows[0].modality).toContain('PSICOLOGIA Y PEDAGOGIA');
  });

  it('no confunde el rótulo del bloque con el nombre del centro', () => {
    // "Centro", "Provincia" y "Total:" son estructura, no datos.
    expect(rows.some((r) => /^(Centro|Provincia|Total)/i.test(r.centre))).toBe(false);
    expect(rows.some((r) => /^(Centro|Provincia|Total)/i.test(r.locality))).toBe(false);
  });

  it('numera las plazas de forma correlativa y sin huecos', () => {
    expect(rows.map((r) => r.number)).toEqual(rows.map((_, i) => i + 1));
  });

  it('agrupa varias plazas bajo el mismo centro', () => {
    const parser = new PdfParserService(new I18nService());
    const centres = parser.groupByCentre(rows);

    expect(centres.size).toBeGreaterThan(5);
    for (const [, centre] of centres) {
      expect(centre.positions.length).toBeGreaterThan(0);
      expect(centre.code).toMatch(/^\d{6,8}$/);
    }
  });

  it('expande los recuentos en una plaza por vacante', () => {
    const parser = new PdfParserService(new I18nService());

    const page: PdfTextItem[] = [
      { str: 'Centro', transform: [1, 0, 0, 1, 224, 712] },
      { str: '13000001', transform: [1, 0, 0, 1, 284, 712] },
      { str: 'TOMELLOSO', transform: [1, 0, 0, 1, 384, 712] },
      { str: 'IES DE PRUEBA', transform: [1, 0, 0, 1, 274, 697] },
      { str: 'Función - Especialidad', transform: [1, 0, 0, 1, 89, 672] },
      { str: 'Vacantes', transform: [1, 0, 0, 1, 426, 672] },
      { str: 'Vacantes It.', transform: [1, 0, 0, 1, 484, 672] },
      // 3 ordinarias y 2 itinerantes => 5 plazas
      { str: '0590004 - 004', transform: [1, 0, 0, 1, 108, 655] },
      { str: 'MATEMATICAS', transform: [1, 0, 0, 1, 268, 655] },
      { str: '3', transform: [1, 0, 0, 1, 442, 655] },
      { str: '2', transform: [1, 0, 0, 1, 504, 655] },
      { str: 'Total:', transform: [1, 0, 0, 1, 365, 635] },
      { str: '3', transform: [1, 0, 0, 1, 442, 635] },
      { str: '2', transform: [1, 0, 0, 1, 504, 635] },
    ];

    const { rows: parsed } = parser.parsePage(page, CLM.parserHints);

    expect(parsed).toHaveLength(5);
    expect(parsed.filter((r) => r.isItinerant)).toHaveLength(2);
    expect(parsed.every((r) => r.centre === 'IES DE PRUEBA' && r.locality === 'TOMELLOSO')).toBe(true);
    expect(parsed[0].modality).toBe('004 - MATEMATICAS');
  });

  it('continúa un bloque de centro partido por un salto de página', () => {
    const parser = new PdfParserService(new I18nService());

    const first: PdfTextItem[] = [
      { str: 'Centro', transform: [1, 0, 0, 1, 224, 712] },
      { str: '45000096', transform: [1, 0, 0, 1, 284, 712] },
      { str: 'TALAVERA', transform: [1, 0, 0, 1, 384, 712] },
      { str: 'IES CORTADO', transform: [1, 0, 0, 1, 274, 697] },
      { str: 'Función - Especialidad', transform: [1, 0, 0, 1, 89, 672] },
      { str: 'Vacantes', transform: [1, 0, 0, 1, 426, 672] },
      { str: 'Vacantes It.', transform: [1, 0, 0, 1, 484, 672] },
      { str: '0590008 - 008', transform: [1, 0, 0, 1, 108, 655] },
      { str: 'GEOGRAFIA E HISTORIA', transform: [1, 0, 0, 1, 268, 655] },
      { str: '1', transform: [1, 0, 0, 1, 442, 655] },
      { str: '0', transform: [1, 0, 0, 1, 504, 655] },
    ];

    // La página siguiente arranca con más especialidades del mismo centro,
    // sin repetir su rótulo.
    const second: PdfTextItem[] = [
      { str: '0590011 - 011', transform: [1, 0, 0, 1, 108, 700] },
      { str: 'INGLES', transform: [1, 0, 0, 1, 268, 700] },
      { str: '2', transform: [1, 0, 0, 1, 442, 700] },
      { str: '0', transform: [1, 0, 0, 1, 504, 700] },
    ];

    const page1 = parser.parsePage(first, CLM.parserHints);
    const page2 = parser.parsePage(second, CLM.parserHints, page1.state);

    expect(page1.rows).toHaveLength(1);
    expect(page2.rows).toHaveLength(2);
    expect(page2.rows.every((r) => r.code === '45000096' && r.centre === 'IES CORTADO')).toBe(true);
    // La numeración continúa donde la dejó la página anterior.
    expect(page2.rows.map((r) => r.number)).toEqual([2, 3]);
  });

  it('cierra el bloque al llegar al total, sin arrastrar el centro', () => {
    const parser = new PdfParserService(new I18nService());

    const page: PdfTextItem[] = [
      { str: 'Centro', transform: [1, 0, 0, 1, 224, 712] },
      { str: '16000001', transform: [1, 0, 0, 1, 284, 712] },
      { str: 'CUENCA', transform: [1, 0, 0, 1, 384, 712] },
      { str: 'IES UNO', transform: [1, 0, 0, 1, 274, 697] },
      { str: 'Función - Especialidad', transform: [1, 0, 0, 1, 89, 672] },
      { str: 'Vacantes', transform: [1, 0, 0, 1, 426, 672] },
      { str: 'Vacantes It.', transform: [1, 0, 0, 1, 484, 672] },
      { str: '0590004 - 004', transform: [1, 0, 0, 1, 108, 655] },
      { str: 'MATEMATICAS', transform: [1, 0, 0, 1, 268, 655] },
      { str: '1', transform: [1, 0, 0, 1, 442, 655] },
      { str: '0', transform: [1, 0, 0, 1, 504, 655] },
      { str: 'Total:', transform: [1, 0, 0, 1, 365, 635] },
      { str: '1', transform: [1, 0, 0, 1, 442, 635] },
      { str: '0', transform: [1, 0, 0, 1, 504, 635] },
      // Un pie de página con dos números no debe convertirse en una plaza.
      { str: 'Resumen', transform: [1, 0, 0, 1, 108, 600] },
      { str: 'algo', transform: [1, 0, 0, 1, 268, 600] },
      { str: '9', transform: [1, 0, 0, 1, 442, 600] },
      { str: '9', transform: [1, 0, 0, 1, 504, 600] },
    ];

    const { rows: parsed, state } = parser.parsePage(page, CLM.parserHints);

    expect(parsed).toHaveLength(1);
    expect(state.centre).toBeNull();
  });
});
