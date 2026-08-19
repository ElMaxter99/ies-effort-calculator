import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem, ParseState } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { IesRow } from '../types';
import { ARA } from '../regions/ara';

import secundaria from './__fixtures__/ara-secundaria.json';
import primaria from './__fixtures__/ara-primaria.json';

interface FixturePage {
  page: number;
  items: { s: string; x: number; y: number }[];
}

function toItems(page: FixturePage): PdfTextItem[] {
  return page.items.map((i) => ({ str: i.s, transform: [1, 0, 0, 1, i.x, i.y] }));
}

function parseFixture(pages: FixturePage[]): IesRow[] {
  const parser = new PdfParserService(new I18nService());
  const rows: IesRow[] = [];
  let state: ParseState = {};

  for (const page of pages) {
    const result = parser.parsePage(toItems(page), ARA.parserHints, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return rows;
}

describe('Aragón (listado en fichas, una por plaza)', () => {
  const rows = parseFixture(secundaria as FixturePage[]);

  it('extrae una plaza por ficha del listado real', () => {
    // Tres páginas de la oferta semanal de secundaria del 08/06/2026, que
    // imprimen 13 rótulos "- Vacante -".
    expect(rows.length).toBe(13);
  });

  it('toda plaza trae código de ocho dígitos, centro, localidad y especialidad', () => {
    for (const row of rows) {
      expect(row.code, row.centre).toMatch(/^\d{8}$/);
      expect(row.centre).toBeTruthy();
      expect(row.locality, row.centre).toBeTruthy();
      expect(row.modality, row.centre).toBeTruthy();
    }
  });

  it('separa el código del nombre del centro', () => {
    const goya = rows.find((r) => r.code === '50008198');

    expect(goya).toBeDefined();
    expect(goya!.centre).toBe('IES GOYA');
    expect(goya!.number).toBe(13615);
  });

  it('quita la provincia de la localidad, que si no no casa con el directorio', () => {
    // El listado escribe "ZARAGOZA (ZARAGOZA)" y "TERUEL (TERUEL)".
    expect(rows.every((r) => !r.locality.includes('('))).toBe(true);
    expect(rows.map((r) => r.locality)).toContain('TERUEL');
  });

  it('se queda con la especialidad y descarta el cuerpo', () => {
    const goya = rows.find((r) => r.code === '50008198');

    expect(goya!.modality).toBe('004 - LENGUA CASTELLANA Y LITERATURA');
    expect(rows.every((r) => !r.modality?.startsWith('0590 -'))).toBe(true);
  });

  it('recompone una especialidad partida en varias líneas', () => {
    const chomon = rows.find((r) => r.code === '44003223');

    expect(chomon!.modality).toBe(
      '111 - ORGANIZACION Y PROCESOS DE MANTENIMIENTO DE VEHICULOS',
    );
  });

  it('recoge jornada, duración y causa como observaciones', () => {
    const goya = rows.find((r) => r.code === '50008198');

    expect(goya!.observations).toContain('Jornada: Parcial');
    expect(goya!.observations).toContain('Causa: Paternidad');
    // Un valor partido en dos líneas se junta bajo su propio rótulo.
    expect(rows.find((r) => r.code === '50008514')!.observations).toContain(
      'Horas Lectivas: 10:00 horas (55.56%)',
    );
  });

  it('no cuela el pie de página como una plaza ni como observación', () => {
    expect(rows.every((r) => !/Página/.test(r.observations))).toBe(true);
    expect(rows.every((r) => !/Página/.test(r.centre))).toBe(true);
  });

  it('sirve igual para el listado de maestros', () => {
    const maestros = parseFixture(primaria as FixturePage[]);

    expect(maestros.length).toBeGreaterThan(0);
    expect(maestros.every((r) => /^\d{8}$/.test(r.code))).toBe(true);
    // En maestros la especialidad va con siglas, no con código numérico.
    expect(maestros.map((r) => r.modality)).toContain('AL - AUDICIÓN Y LENGUAJE');
  });
});
