import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem, ParseState } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { IesRow } from '../types';
import { AST } from '../regions/ast';

import fixture from './__fixtures__/ast-oferta.json';

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
    const result = parser.parsePage(items, AST.parserHints, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return rows;
}

describe('Asturias (bloques por centro, una fila por plaza)', () => {
  const rows = parseFixture();

  it('lee todas las plazas del documento', () => {
    // La oferta completa del 05-06-2026: 9 páginas, 51 centros y los 59
    // recuentos que el propio PDF declara en sus rótulos "Por centro hay ...".
    expect(rows).toHaveLength(59);
    expect(new Set(rows.map((r) => r.code)).size).toBe(51);
  });

  it('no deja ninguna plaza sin centro, localidad ni especialidad', () => {
    expect(rows.filter((r) => !r.centre)).toHaveLength(0);
    expect(rows.filter((r) => !r.locality)).toHaveLength(0);
    expect(rows.filter((r) => !r.modality)).toHaveLength(0);
    expect(rows.every((r) => /^33\d{6}$/.test(r.code))).toBe(true);
  });

  it('abre el bloque con el código del centro, sin ningún rótulo', () => {
    const first = rows[0];

    expect(first.code).toBe('33027345');
    expect(first.centre).toBe('C.P.E.B. de Pola de Allande');
    expect(first.locationCode).toBe('024296');
  });

  it('toma la localidad de la fila de encima, no el concejo', () => {
    // Esa fila trae los dos: "ALLANDE" a la izquierda y "POLA DE ALLANDE" a la
    // derecha. La de la derecha es donde está el centro de verdad.
    expect(rows[0].locality).toBe('POLA DE ALLANDE');
  });

  it('compone la especialidad con el cuerpo, que va en otra columna', () => {
    // El código corto se repite entre cuerpos: el 036 de maestros y el 036 de
    // secundaria no son la misma especialidad.
    expect(rows[0].modality).toBe('0590018 - ORIENTACION EDUCATIVA');
    expect(rows[1].modality).toBe('0597036 - PEDAGOGÍA TERAPÉUTICA');
  });

  it('junta la especialidad que se parte en dos líneas', () => {
    const partida = rows.filter((r) => r.modality?.endsWith('DE FLUIDOS'));

    expect(partida).toHaveLength(1);
    expect(partida[0].modality).toBe(
      '0590205 - INSTALACION Y MANTENIMIENTO DE EQUIPOS TERMICOS Y DE FLUIDOS',
    );
    // La continuación no puede colarse como una plaza más.
    expect(partida[0].locationCode).toBe('024331');
  });

  it('lee la itinerancia de su columna', () => {
    expect(rows.filter((r) => r.isItinerant)).toHaveLength(5);
    expect(rows[0].isItinerant).toBe(true);
    expect(rows[1].isItinerant).toBe(false);
  });

  it('recoge jornada y función tal cual en las observaciones', () => {
    // Son marcas propias de Asturias —"J", "BB", el dígito de bilingüe— sin
    // equivalente en el resto de comunidades, así que se guardan sin
    // interpretar en vez de descartarlas.
    const bilingue = rows.find((r) => r.locationCode === '024300');
    const conMarca = rows.find((r) => r.locationCode === '771823');

    expect(bilingue!.observations).toBe('2');
    expect(conMarca!.observations).toBe('BB J');
  });

  it('no cuela el membrete ni el pie de página como plazas', () => {
    expect(rows.every((r) => /^\d{6}$/.test(r.locationCode))).toBe(true);
    expect(rows.some((r) => /Página|Bilingüe|Principado/.test(r.centre))).toBe(false);
  });
});
