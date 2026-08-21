import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem, ParseState } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { IesRow } from '../types';
import { CNT } from '../regions/cnt';

import fixture from './__fixtures__/cnt-secundaria.json';

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
    const result = parser.parsePage(items, CNT.parserHints, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return rows;
}

describe('Cantabria (tabla girada con rótulo de bloque)', () => {
  const rows = parseFixture();

  it('lee una plaza por columna, sin perder ninguna', () => {
    // Dos páginas del listado definitivo por especialidad, con 14 y 5
    // códigos de puesto impresos.
    expect(rows).toHaveLength(19);
  });

  it('saca el código del centro del código del puesto', () => {
    // No hay columna de código: "C39011441 0590007 0N004" lo lleva dentro.
    const foramontanos = rows.find((r) => r.centre === 'FORAMONTANOS');

    expect(foramontanos).toBeDefined();
    expect(foramontanos!.code).toBe('39011441');
    expect(foramontanos!.locationCode).toBe('C3901144105900070N004');
    expect(rows.every((r) => /^39\d{6}$/.test(r.code))).toBe(true);
  });

  it('aplica a toda la página la especialidad que la encabeza', () => {
    // Va anunciada como "Especialidad:" y su valor se imprime en una fila
    // suelta aparte, no junto al rótulo.
    expect(rows.every((r) => !!r.modality)).toBe(true);
    expect(rows.map((r) => r.modality)).toContain('0590007 - FISICA Y QUIMICA');
  });

  it('no confunde un centro llamado "NÚMERO 1" con la columna de número', () => {
    // El diccionario reconoce "Número" como cabecera; tomarlo por rótulo dejaba
    // sin centro a todas las plazas de ese panel.
    expect(rows.every((r) => !!r.centre)).toBe(true);
  });

  it('toda plaza trae localidad', () => {
    expect(rows.every((r) => !!r.locality)).toBe(true);
  });

  it('recoge las observaciones, incluso partidas en dos líneas', () => {
    const cepa = rows.find((r) => r.centre === 'CEPA DE CASTRO URDIALES');

    expect(cepa!.observations).toBe('Ámbito científico matemático VOL.');
  });
});
