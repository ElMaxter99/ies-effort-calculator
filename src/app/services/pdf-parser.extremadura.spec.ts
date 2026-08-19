import { describe, it, expect } from 'vitest';
import { PdfParserService, PdfTextItem, ParseState } from './pdf-parser.service';
import { I18nService } from './i18n.service';
import { IesRow } from '../types';
import { EXT } from '../regions/ext';

import secundaria from './__fixtures__/ext-secundaria.json';
import maestros from './__fixtures__/ext-maestros.json';

interface FixturePage {
  page: number;
  items: { s: string; x: number; y: number }[];
}

function parseFixture(fixture: unknown): IesRow[] {
  const parser = new PdfParserService(new I18nService());
  const rows: IesRow[] = [];
  let state: ParseState = {};

  for (const page of fixture as FixturePage[]) {
    const items: PdfTextItem[] = page.items.map((i) => ({ str: i.s, transform: [1, 0, 0, 1, i.x, i.y] }));
    const result = parser.parsePage(items, EXT.parserHints, state);
    state = result.state;
    rows.push(...result.rows);
  }

  return rows;
}

describe('Extremadura (dos centros por página, con recuentos)', () => {
  const sec = parseFixture(secundaria);
  const mae = parseFixture(maestros);

  it('cuenta las vacantes, no los puestos de la plantilla', () => {
    // Las dos páginas declaran 2.987 puestos y solo 15 vacantes: leer la
    // columna equivocada llenaría el mapa de destinos ocupados.
    expect(sec).toHaveLength(15);
    expect(mae).toHaveLength(7);
  });

  it('no mezcla los dos centros que van uno al lado del otro', () => {
    // El panel izquierdo y el derecho no alinean sus líneas base, así que sin
    // separarlos los recuentos de uno acaban en el centro del otro.
    const barros = sec.filter((r) => r.code === '06000356');
    const vera = sec.filter((r) => r.code === '06006905');

    expect(barros.every((r) => r.centre === 'I.E.S. TIERRA DE BARROS')).toBe(true);
    expect(vera.every((r) => r.centre === 'I.E.S. FRANCISCO VERA')).toBe(true);
    expect(sec.every((r) => /^(06|10)\d{6}$/.test(r.code))).toBe(true);
  });

  it('abre el bloque con el código del centro y coge la localidad de encima', () => {
    const vera = sec.find((r) => r.code === '06006905');

    expect(vera).toBeDefined();
    expect(vera!.locality).toBe('ALCONCHEL');
    expect(sec.filter((r) => !r.locality)).toHaveLength(0);
    expect(mae.filter((r) => !r.locality)).toHaveLength(0);
  });

  it('no se traga la especialidad siguiente al leer una fila sin vacantes', () => {
    // La mayoría de especialidades están cubiertas y no dan plaza; tomarlas por
    // la continuación de la anterior le pegaba media tabla al nombre.
    expect(sec.every((r) => /^\d{8} - \S/.test(r.modality ?? ''))).toBe(true);
    expect(mae.every((r) => /^(\d{8}|IT\d{6}) - \S/.test(r.modality ?? ''))).toBe(true);
  });

  it('reconoce la itinerancia por el código de la especialidad', () => {
    // No hay columna que lo diga: el código empieza por "IT" en lugar de por
    // ceros.
    const itinerantes = mae.filter((r) => r.isItinerant);

    expect(itinerantes).toHaveLength(2);
    expect(itinerantes.every((r) => r.modality?.startsWith('IT'))).toBe(true);
    expect(sec.filter((r) => r.isItinerant)).toHaveLength(0);
  });

  it('descarta el membrete y los sub-bloques de itinerancia', () => {
    const basura = /ANEXO|PROVINCIA|Itinera|PLANTILLA/i;

    expect(sec.filter((r) => basura.test(r.centre))).toHaveLength(0);
    expect(mae.filter((r) => basura.test(r.centre))).toHaveLength(0);
    expect(mae.every((r) => !!r.centre)).toBe(true);
  });
});
