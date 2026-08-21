import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem, ParseState } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { IesRow } from '../types';
import { CAN } from '../regions/can';

import fixture from './__fixtures__/can-secundaria.json';

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
    const result = parser.parsePage(toItems(page), CAN.parserHints, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return rows;
}

describe('Canarias (anexo de vacantes iniciales)', () => {
  const rows = parseFixture();

  it('extrae plazas del anexo real', () => {
    expect(rows.length).toBeGreaterThan(50);
  });

  it('separa el código del nombre, que comparten celda', () => {
    // En el PDF la celda es "35000082 IES Joaquín Artiles".
    expect(rows.every((r) => /^\d{8}$/.test(r.code))).toBe(true);
    expect(rows.some((r) => r.centre === 'IES Joaquín Artiles')).toBe(true);
    expect(rows.some((r) => /^\d/.test(r.centre))).toBe(false);
  });

  it('reconoce la especialidad y no la firma digital del documento', () => {
    // El patrón por defecto casaba con "RP001-0007E0/ajdSt..." incrustado por
    // la firma electrónica, y toda la salida quedaba con esa "modalidad".
    expect(rows.some((r) => r.modality?.startsWith('201 Filosofía'))).toBe(true);
    expect(rows.some((r) => r.modality?.includes('=='))).toBe(false);
  });

  it('descarta los títulos del anexo, que caen en la banda de la columna', () => {
    expect(rows.some((r) => /Anexo II|Ordenado por|Vacantes Iniciales/i.test(r.centre))).toBe(false);
  });

  it('expande el recuento en una plaza por vacante', () => {
    const parser = new PdfParserService(new I18nService());

    const page: PdfTextItem[] = [
      { str: '201 Filosofía', transform: [1, 0, 0, 1, 267, 731] },
      { str: 'CENTRO', transform: [1, 0, 0, 1, 203, 689] },
      { str: 'VAC.', transform: [1, 0, 0, 1, 524, 689] },
      // El recuento va 3 pt por encima del nombre del centro.
      { str: '3', transform: [1, 0, 0, 1, 530, 682.63] },
      { str: '35000082 IES De Prueba', transform: [1, 0, 0, 1, 45, 679.62] },
    ];

    const { rows: parsed } = parser.parsePage(page, CAN.parserHints);

    expect(parsed).toHaveLength(3);
    expect(parsed.every((r) => r.code === '35000082' && r.centre === 'IES De Prueba')).toBe(true);
    expect(parsed[0].modality).toBe('201 Filosofía');
  });

  it('no junta el recuento con la fila de al lado', () => {
    const parser = new PdfParserService(new I18nService());

    // Dos centros consecutivos: sus filas distan ~9,6 pt, y la tolerancia de
    // Canarias es 4, así que deben seguir separados.
    const page: PdfTextItem[] = [
      { str: 'CENTRO', transform: [1, 0, 0, 1, 203, 689] },
      { str: 'VAC.', transform: [1, 0, 0, 1, 524, 689] },
      { str: '1', transform: [1, 0, 0, 1, 530, 682.63] },
      { str: '35000082 IES Uno', transform: [1, 0, 0, 1, 45, 679.62] },
      { str: '2', transform: [1, 0, 0, 1, 530, 673.03] },
      { str: '35000288 IES Dos', transform: [1, 0, 0, 1, 45, 670.01] },
    ];

    const { rows: parsed } = parser.parsePage(page, CAN.parserHints);

    expect(parsed.filter((r) => r.code === '35000082')).toHaveLength(1);
    expect(parsed.filter((r) => r.code === '35000288')).toHaveLength(2);
  });
});
