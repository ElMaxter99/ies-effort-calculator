import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem, ParseState } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { IesRow } from '../types';
import { MUR } from '../regions/mur';

import fixture from './__fixtures__/mur-secundaria.json';

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
    const result = parser.parsePage(toItems(page), MUR.parserHints, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return rows;
}

describe('Murcia (listado con la tabla girada)', () => {
  const rows = parseFixture();

  it('extrae plazas del listado real', () => {
    expect(rows.length).toBeGreaterThan(10);
  });

  it('cada plaza tiene código, centro, localidad y especialidad', () => {
    expect(rows.every((r) => /^\d{8}$/.test(r.code))).toBe(true);
    expect(rows.filter((r) => !r.centre)).toEqual([]);
    expect(rows.filter((r) => !r.locality)).toEqual([]);
    expect(rows.filter((r) => !r.modality)).toEqual([]);
  });

  it('lee la primera plaza del documento', () => {
    expect(rows[0]).toMatchObject({
      code: '30012276',
      centre: 'IES MEDITERRÁNEO',
      locality: 'CARTAGENA',
    });
    expect(rows[0].modality).toContain('LENGUA CASTELLANA');
  });

  it('no toma los rótulos de campo como si fueran datos', () => {
    const labels = /^(Cod\.? Centro|Nombre Centro|Localidad|Función|Obs\.?|Perfil|Cupo|Jornada)$/i;
    expect(rows.some((r) => labels.test(r.centre))).toBe(false);
    expect(rows.some((r) => labels.test(r.locality))).toBe(false);
  });

  it('recompone los valores partidos en varias líneas', () => {
    // "EOI ESCUELA OFICIAL DE IDIOMAS DE MURCIA" y los conservatorios se
    // imprimen en dos líneas ligeramente desplazadas en X.
    const largo = rows.find((r) => r.centre.length > 30);
    expect(largo, 'ningún nombre largo recompuesto').toBeDefined();
    expect(largo!.centre.split(' ').length).toBeGreaterThan(3);
  });

  it('lee los dos paneles de la página, plantilla y sustitución', () => {
    // El segundo panel arranca en x=411 con su propia columna de rótulos; si
    // se ignorara, se perderían sus plazas.
    const page1 = new PdfParserService(new I18nService()).parsePage(
      toItems((fixture as FixturePage[])[0]),
      MUR.parserHints,
    );

    const codes = page1.rows.map((r) => r.code);
    expect(codes).toContain('30012276'); // panel izquierdo
    expect(codes).toContain('30018205'); // panel derecho
  });

  it('separa plazas contiguas y no las funde', () => {
    const parser = new PdfParserService(new I18nService());

    const page: PdfTextItem[] = [
      { str: 'Función', transform: [1, 0, 0, 1, 127, 395] },
      { str: '0590001 FILOSOFIA', transform: [1, 0, 0, 1, 148, 395] },
      { str: '0590004 LENGUA', transform: [1, 0, 0, 1, 197, 395] },
      { str: 'Localidad', transform: [1, 0, 0, 1, 127, 307] },
      { str: 'LORCA', transform: [1, 0, 0, 1, 148, 307] },
      { str: 'YECLA', transform: [1, 0, 0, 1, 197, 307] },
      { str: 'Nombre Centro', transform: [1, 0, 0, 1, 127, 85] },
      { str: 'IES UNO', transform: [1, 0, 0, 1, 148, 85] },
      { str: 'IES DOS', transform: [1, 0, 0, 1, 197, 85] },
      { str: 'Cod. Centro', transform: [1, 0, 0, 1, 127, 38] },
      { str: '30000001', transform: [1, 0, 0, 1, 148, 38] },
      { str: '30000002', transform: [1, 0, 0, 1, 197, 38] },
    ];

    const { rows: parsed } = parser.parsePage(page, MUR.parserHints);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ code: '30000001', centre: 'IES UNO', locality: 'LORCA' });
    expect(parsed[1]).toMatchObject({ code: '30000002', centre: 'IES DOS', locality: 'YECLA' });
  });

  it('descarta columnas sin código de centro', () => {
    const parser = new PdfParserService(new I18nService());

    const page: PdfTextItem[] = [
      { str: 'Localidad', transform: [1, 0, 0, 1, 127, 307] },
      { str: 'MURCIA', transform: [1, 0, 0, 1, 148, 307] },
      { str: 'Nombre Centro', transform: [1, 0, 0, 1, 127, 85] },
      { str: 'IES SIN CODIGO', transform: [1, 0, 0, 1, 148, 85] },
    ];

    expect(parser.parsePage(page, MUR.parserHints).rows).toEqual([]);
  });
});
