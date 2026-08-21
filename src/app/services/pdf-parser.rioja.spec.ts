import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem, ParseState } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { IesRow } from '../types';
import { RIO } from '../regions/rio';

import fixture from './__fixtures__/rio-todos-cuerpos.json';

interface FixturePage {
  page: number;
  items: { s: string; x: number; y: number }[];
}

function parseFixture(): IesRow[] {
  const parser = new PdfParserService(new I18nService());
  const rows: IesRow[] = [];
  let state: ParseState = {};

  for (const page of fixture as FixturePage[]) {
    const items: PdfTextItem[] = page.items.map((i) => ({ str: i.s, transform: [1, 0, 0, 1, i.x, i.y] }));
    const result = parser.parsePage(items, RIO.parserHints, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return rows;
}

describe('La Rioja (listado de todos los cuerpos)', () => {
  const rows = parseFixture();

  it('extrae plazas del listado real', () => {
    expect(rows.length).toBeGreaterThan(10);
  });

  it('quita la letra de control del código de centro', () => {
    // El PDF imprime "26000579C"; el directorio de centros usa "26000579".
    expect(rows.every((r) => /^\d{8}$/.test(r.code))).toBe(true);
    expect(rows.map((r) => r.code)).toContain('26000579');
  });

  it('toda plaza trae centro y localidad', () => {
    for (const row of rows) {
      expect(row.centre, row.code).toBeTruthy();
      expect(row.locality, row.code).toBeTruthy();
    }
  });

  it('arrastra la especialidad anunciada sobre la tabla', () => {
    expect(rows.some((r) => r.modality === 'FRANCES')).toBe(true);
    expect(rows.every((r) => !!r.modality)).toBe(true);
  });

  it('lee la itinerancia de su columna, no del texto de observaciones', () => {
    // Estas plazas llevan la marca "I" pero su observación solo dice con qué
    // centro se comparte, así que sin leer la columna se darían por fijas.
    const conPradejon = rows.find((r) => r.observations.includes('CON PRADEJÓN'));

    expect(conPradejon, 'no se encontró la plaza de Calahorra con Pradejón').toBeDefined();
    expect(conPradejon!.isItinerant).toBe(true);
    expect(rows.some((r) => !r.isItinerant), 'no todas pueden ser itinerantes').toBe(true);
  });

  it('descarta la fila de detalle que sigue a cada plaza', () => {
    // "Horario: MATUTINO | Prev Fin: ... | Causa: VACANTE" no lleva código.
    expect(rows.every((r) => r.centre !== 'VACANTE')).toBe(true);
    expect(rows.every((r) => !r.centre.startsWith('Horario'))).toBe(true);
  });

  it('descarta la cabecera y la leyenda del pie', () => {
    expect(rows.every((r) => r.locality !== 'Localidad')).toBe(true);
    expect(rows.every((r) => !/Bilingüe|Jornada completa/.test(r.centre))).toBe(true);
  });
});

describe('rótulo de especialidad en blanco', () => {
  /**
   * El listado de La Rioja deja algún "Especialidad:" sin valor. Tomarlo al pie
   * de la letra dejaba sin especialidad a las plazas de debajo.
   */
  it('no borra la especialidad en curso', () => {
    const parser = new PdfParserService(new I18nService());
    const row = (y: number, cells: [number, string][]): PdfTextItem[] =>
      cells.map(([x, str]) => ({ str, transform: [1, 0, 0, 1, x, y] }));

    const items = [
      ...row(445, [[54, 'Especialidad:'], [125, 'FILOSOFIA']]),
      ...row(404, [[86, '26003507C'], [243, 'ALFARO'], [435, 'IES GONZALO DE BERCEO']]),
      ...row(380, [[54, 'Especialidad:']]),
      ...row(360, [[86, '26000270C'], [243, 'ARNEDO'], [435, 'IES CELSO DIAZ']]),
    ];

    const { rows } = parser.parsePage(items, RIO.parserHints, {});

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.modality)).toEqual(['FILOSOFIA', 'FILOSOFIA']);
  });
});
