import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { detectHeaderRow, matchHeaderField, normalizeHeader } from './column-dictionary';
import type { ParseState } from './pdf-parser.service';
import { IesRow } from '../types';

import fixture from './__fixtures__/gva-secundaria.json';
import golden from './__fixtures__/gva-secundaria.golden.json';

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
    const result = parser.parsePage(toItems(page), { itinerantMarkers: true }, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return rows;
}

describe('normalizeHeader', () => {
  it('quita acentos, puntuación y colapsa espacios', () => {
    expect(normalizeHeader('CÓD. CENTRO')).toBe('COD CENTRO');
    expect(normalizeHeader('N.º')).toBe('N');
    expect(normalizeHeader('  OBSERVACIONS  ')).toBe('OBSERVACIONS');
  });
});

describe('matchHeaderField', () => {
  it('reconoce rótulos bilingües separados por barra', () => {
    expect(matchHeaderField('LOCALITAT / LOCALIDAD')).toBe('locality');
    expect(matchHeaderField('CENTRE / CENTRO')).toBe('centre');
    expect(matchHeaderField('OBSERVACIONS / OBSERVACIONES')).toBe('observations');
  });

  it('reconoce las variantes de cada comunidad', () => {
    expect(matchHeaderField('CONCELLO')).toBe('locality');      // Galicia
    expect(matchHeaderField('MUNICIPIO')).toBe('locality');     // Castilla-La Mancha
    expect(matchHeaderField('DENOMINACIÓN')).toBe('centre');
  });

  it('el sinónimo más largo gana sobre el más corto', () => {
    expect(matchHeaderField('CÓDIGO CENTRO')).toBe('code');
    expect(matchHeaderField('CÓDIGO PUESTO')).toBe('locationCode');
    expect(matchHeaderField('CENTRO')).toBe('centre');
  });

  it('devuelve null para texto que no es cabecera', () => {
    expect(matchHeaderField('IES CABO DE LA HUERTA')).toBeNull();
    expect(matchHeaderField('26/06/2026')).toBeNull();
  });
});

describe('detectHeaderRow', () => {
  it('encuentra la cabecera real del PDF de la GVA y no un título', () => {
    const parser = new PdfParserService(new I18nService());
    const rows = (parser as any).toTextRows(toItems((fixture as FixturePage[])[0]));
    const header = detectHeaderRow(rows);

    expect(header).not.toBeNull();
    expect(header!.columns.map((c) => c.field)).toEqual([
      'number',
      'locationCode',
      'locality',
      'centre',
      'code',
      'itinerant',
      'observations',
    ]);
  });

  it('ignora páginas sin tabla', () => {
    expect(detectHeaderRow([{ y: 500, items: [{ x: 100, str: 'RELACIÓN DE VACANTES' }] }])).toBeNull();
  });
});

describe('regresión Comunitat Valenciana', () => {
  const rows = parseFixture();
  const expected = golden as IesRow[];

  it('extrae exactamente las filas del golden', () => {
    expect(rows.length).toBe(expected.length);
    expect(rows).toEqual(expected);
  });

  it('ninguna fila con centro se queda sin localidad', () => {
    // El agrupado por rejilla desgajaba la localidad de su fila en ~10% de los
    // casos; con agrupado por ancla ya no ocurre. Sin localidad el centro no se
    // puede geocodificar cuando su código no está en el dataset.
    expect(rows.filter((r) => r.centre && !r.locality)).toEqual([]);
  });

  it('rellena locationCode en todas las filas', () => {
    // El parser original lo buscaba en x=70..89 cuando el dato está en x=55,
    // así que salía siempre vacío.
    expect(rows.every((r) => /^\d{4,8}$/.test(r.locationCode))).toBe(true);
  });

  it('conserva la detección de plazas itinerantes', () => {
    const itinerants = rows.filter((r) => r.isItinerant);
    expect(itinerants.length).toBeGreaterThan(0);
    expect(itinerants.some((r) => r.itinerantCentre && r.hours)).toBe(true);
  });
});

describe('parsePage', () => {
  it('hereda la cabecera cuando una página no la repite', () => {
    const parser = new PdfParserService(new I18nService());
    const first = parser.parsePage(toItems((fixture as FixturePage[])[0]), { itinerantMarkers: true });

    // Una página solo con datos, sin cabecera propia.
    const dataOnly: PdfTextItem[] = [
      { str: '99', transform: [1, 0, 0, 1, 33, 400] },
      { str: '123456', transform: [1, 0, 0, 1, 55, 400] },
      { str: 'ONTINYENT', transform: [1, 0, 0, 1, 107, 400] },
      { str: 'IES POU CLAR', transform: [1, 0, 0, 1, 243, 400] },
      { str: '46012345', transform: [1, 0, 0, 1, 485, 400] },
    ];

    const inherited = parser.parsePage(dataOnly, { itinerantMarkers: true }, first.state);

    expect(inherited.rows).toHaveLength(1);
    expect(inherited.rows[0]).toMatchObject({
      number: 99,
      locality: 'ONTINYENT',
      centre: 'IES POU CLAR',
      code: '46012345',
      locationCode: '123456',
    });
  });

  it('no inventa filas si nunca ha visto una cabecera', () => {
    const parser = new PdfParserService(new I18nService());
    const result = parser.parsePage([{ str: 'IES ALGO', transform: [1, 0, 0, 1, 243, 400] }]);

    expect(result.rows).toEqual([]);
    expect(result.state.columns).toBeNull();
  });

  it('mantiene unida una fila cuyos items caían a distinto lado de la rejilla', () => {
    const parser = new PdfParserService(new I18nService());
    const first = parser.parsePage(toItems((fixture as FixturePage[])[0]), { itinerantMarkers: true });

    // Valores reales de la fila 6 del PDF de la GVA. Con la rejilla anterior
    // (Math.round(y / 3) * 3) el "6" caía en 384 y el resto en 381, así que la
    // fila se partía en dos mitades y ninguna era válida: se perdía entera.
    const straddling: PdfTextItem[] = [
      { str: '6', transform: [1, 0, 0, 1, 35, 382.56] },
      { str: 'IES VIRGEN DEL REMEDIO', transform: [1, 0, 0, 1, 243, 382.44] },
      { str: '03010119', transform: [1, 0, 0, 1, 485, 382.44] },
      { str: '210396', transform: [1, 0, 0, 1, 55, 382.08] },
      { str: 'ALACANT', transform: [1, 0, 0, 1, 107, 382.08] },
    ];

    const result = parser.parsePage(straddling, { itinerantMarkers: true }, first.state);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      number: 6,
      centre: 'IES VIRGEN DEL REMEDIO',
      locality: 'ALACANT',
      code: '03010119',
      locationCode: '210396',
    });
  });

  it('no funde dos filas contiguas en una sola', () => {
    const parser = new PdfParserService(new I18nService());
    const first = parser.parsePage(toItems((fixture as FixturePage[])[0]), { itinerantMarkers: true });

    // Filas consecutivas reales distan ~13,7 pt: deben seguir separadas.
    const twoRows: PdfTextItem[] = [
      { str: '1', transform: [1, 0, 0, 1, 35, 396.72] },
      { str: 'IES UNO', transform: [1, 0, 0, 1, 243, 396.6] },
      { str: 'GANDIA', transform: [1, 0, 0, 1, 107, 396.24] },
      { str: '2', transform: [1, 0, 0, 1, 35, 382.56] },
      { str: 'IES DOS', transform: [1, 0, 0, 1, 243, 382.44] },
      { str: 'XATIVA', transform: [1, 0, 0, 1, 107, 382.08] },
    ];

    const result = parser.parsePage(twoRows, { itinerantMarkers: true }, first.state);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((r) => r.centre)).toEqual(['IES UNO', 'IES DOS']);
    expect(result.rows.map((r) => r.locality)).toEqual(['GANDIA', 'XATIVA']);
  });

  it('columnOverrides tiene prioridad sobre la detección de cabecera', () => {
    const parser = new PdfParserService(new I18nService());
    const items: PdfTextItem[] = [
      { str: '7', transform: [1, 0, 0, 1, 33, 400] },
      { str: 'BURJASSOT', transform: [1, 0, 0, 1, 107, 400] },
      { str: 'IES COMARCAL', transform: [1, 0, 0, 1, 243, 400] },
    ];

    const result = parser.parsePage(items, {
      columnOverrides: {
        number: [27, 45],
        locality: [95, 120],
        centre: [230, 260],
      },
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ number: 7, locality: 'BURJASSOT', centre: 'IES COMARCAL' });
  });
});
