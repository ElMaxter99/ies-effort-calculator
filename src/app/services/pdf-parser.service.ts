import { Injectable, signal } from '@angular/core';
import { IesRow, ProcessInfo } from '../types';
import { I18nService } from './i18n.service';
import {
  ColumnField,
  HeaderColumn,
  TextRow,
  assignColumn,
  detectHeaderRow,
  normalizeHeader,
} from './column-dictionary';

/** Item de texto tal como lo entrega pdfjs (solo lo que necesitamos). */
export interface PdfTextItem {
  str: string;
  transform: number[];
}

/**
 * Ajustes de parseo específicos de una comunidad, para los casos en que la
 * detección automática de cabecera no basta.
 */
export interface ParserHints {
  /**
   * Cómo está maquetado el listado:
   * - `columns` (por defecto): una tabla plana, una fila por plaza, con una
   *   cabecera de columnas reconocible. Es el caso de la Comunitat Valenciana.
   * - `grouped`: bloques por centro, cada uno con una subtabla de
   *   especialidades y sus recuentos de vacantes. Es el caso de
   *   Castilla-La Mancha.
   */
  strategy?: 'columns' | 'grouped';
  /**
   * Rangos [min, max] de coordenada X por campo. Si se indican, tienen
   * prioridad sobre la detección de cabecera. Es la vía de escape para PDFs
   * cuya cabecera no se reconoce.
   */
  columnOverrides?: Partial<Record<ColumnField, [number, number]>>;
  /**
   * Activa el tratamiento de plazas itinerantes con marcadores tipográficos
   * (ü / º) en su propia fila, tal como los maqueta la Generalitat Valenciana.
   */
  itinerantMarkers?: boolean;
  /** Rótulos que delimitan los bloques cuando `strategy` es `grouped`. */
  grouped?: GroupedHints;
  /**
   * Separación máxima en puntos para considerar que dos items están en la
   * misma fila. Por defecto 2, que sirve para la mayoría.
   *
   * Hay generadores que alinean las cifras con una línea base distinta de la
   * del texto: en el anexo de vacantes de Canarias los recuentos van 3 pt por
   * encima del nombre del centro, así que necesita un valor mayor.
   */
  rowTolerance?: number;
  /**
   * El código del centro va pegado a su nombre en la misma celda
   * ("35000082 IES Joaquín Artiles"). Se separa el prefijo numérico.
   */
  splitCodeFromCentre?: boolean;
  /**
   * La fila indica cuántas vacantes hay en ese centro en lugar de repetirse
   * una vez por plaza. Se expande a una fila por vacante para que el recuento
   * de posiciones por centro siga siendo correcto.
   */
  expandVacancies?: boolean;
  /**
   * Patrón (como texto) del rótulo que identifica la modalidad —cuerpo y
   * especialidad— que encabeza cada tabla.
   *
   * Por defecto reconoce el formato bilingüe de la Generalitat Valenciana
   * ("201 - FILOSOFIA / FILOSOFÍA"). Conviene ajustarlo por comunidad: ese
   * patrón, aplicado al anexo de Canarias, casaba con la cadena de la firma
   * digital del documento en lugar de con la especialidad.
   */
  modalityPattern?: string;
}

/**
 * Rótulos que estructuran un listado agrupado por centro.
 *
 * Se comparan ya normalizados (mayúsculas, sin acentos ni puntuación), así que
 * basta con escribirlos de forma natural.
 */
export interface GroupedHints {
  /** Abre un bloque de centro; en su misma fila van el código y la localidad. */
  centreMarker: string;
  /** Abre la subtabla de especialidades del centro en curso. */
  itemHeader: string;
  /** Cierra el bloque de centro. */
  totalMarker: string;
  /** Rótulo de la provincia, que encabeza el documento. */
  provinceMarker?: string;
}

/**
 * Estado que se arrastra de una página a la siguiente.
 *
 * Los listados no son autocontenidos por página: la cabecera de columnas suele
 * imprimirse solo la primera vez, y un bloque de centro puede quedar cortado
 * por un salto de página.
 */
export interface ParseState {
  /** Última cabecera de columnas detectada (estrategia `columns`). */
  columns?: HeaderColumn[] | null;
  /** Centro cuyo bloque está abierto (estrategia `grouped`). */
  centre?: { code: string; name: string; locality: string } | null;
  /** Si estamos dentro de la subtabla de especialidades (estrategia `grouped`). */
  inItems?: boolean;
  /** Contador correlativo de plazas, para numerarlas al vuelo. */
  counter?: number;
}

/**
 * Tolerancia en puntos para considerar que dos items pertenecen a la misma fila.
 *
 * Los generadores de PDF no alinean exactamente la línea base de todas las
 * celdas: en el listado de la GVA una misma fila reparte sus items entre tres
 * valores de Y dentro de un margen de ~0,5 pt, mientras que dos filas
 * consecutivas distan ~13,7 pt. Con 2 pt hay holgura de sobra dentro de la
 * fila sin acercarse a la fila siguiente.
 */
const DEFAULT_ROW_TOLERANCE = 2;

@Injectable({ providedIn: 'root' })
export class PdfParserService {
  process = signal<ProcessInfo>({ currentPage: 0, totalPages: 0, percentage: 0, message: '' });

  constructor(private i18n: I18nService) {}

  async parsePdf(file: File, hints: ParserHints = {}): Promise<IesRow[]> {
    const pdfjsLib = await import('pdfjs-dist');
    const worker = new Worker('/pdf.worker.min.mjs', { type: 'module' });
    pdfjsLib.GlobalWorkerOptions.workerPort = worker;
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const t = this.i18n.t();
    this.process.set({ currentPage: 0, totalPages: pdf.numPages, percentage: 0, message: t.processingPDF });

    const allRows: IesRow[] = [];
    // El estado cruza páginas: una tabla puede continuar sin repetir la
    // cabecera, y un bloque de centro puede partirse por un salto de página.
    let state: ParseState = {};

    try {
      for (let i = 1; i <= pdf.numPages; i++) {
        this.process.set({
          currentPage: i,
          totalPages: pdf.numPages,
          percentage: Math.round((i / pdf.numPages) * 100),
          message: t.pdfProcessingMessage(i, pdf.numPages),
        });

        const page = await pdf.getPage(i);
        const content = await page.getTextContent();

        const result = this.parsePage(content.items as PdfTextItem[], hints, state);
        state = result.state;
        allRows.push(...result.rows);
      }
    } finally {
      worker.terminate();
    }

    this.process.set({
      currentPage: pdf.numPages,
      totalPages: pdf.numPages,
      percentage: 100,
      message: t.completeRows(allRows.length),
    });

    return allRows;
  }

  /**
   * Parsea una página. Función pura: no toca señales ni pdfjs, para poder
   * ejercitarla en tests con items sintéticos o grabados.
   *
   * El `state` devuelto debe realimentarse en la llamada de la página
   * siguiente: las tablas continúan entre páginas sin repetir la cabecera y un
   * bloque de centro puede quedar partido por un salto de página.
   */
  parsePage(
    items: PdfTextItem[],
    hints: ParserHints = {},
    state: ParseState = {},
  ): { rows: IesRow[]; state: ParseState } {
    const rows = this.toTextRows(items, hints.rowTolerance);

    if (hints.strategy === 'grouped') {
      return this.parseGroupedPage(rows, hints, state);
    }

    const modality = this.detectModality(items, hints);
    const usesOverrides = !!hints.columnOverrides && Object.keys(hints.columnOverrides).length > 0;

    let columns = state.columns ?? null;
    let dataRows = rows;

    if (!usesOverrides) {
      const header = detectHeaderRow(rows);
      if (header) {
        columns = header.columns;
        // Solo las filas por debajo de la cabecera son datos; lo de arriba son
        // membretes y títulos.
        dataRows = rows.filter((r) => r.y < header.row.y);
      }
      if (!columns) return { rows: [], state: { ...state, columns: null } };
    }

    return {
      rows: this.extractRows(dataRows, modality, hints, columns),
      state: { ...state, columns },
    };
  }

  /**
   * Extrae un listado agrupado por centro.
   *
   * La maqueta es una jerarquía, no una tabla:
   *
   *     Provincia   CIUDAD REAL
   *       Centro    13012465   ABENOJAR
   *         CRA N.º 11
   *         Función - Especialidad          Vacantes   Vacantes It.
   *         0590018 - 018   PSICOLOGIA Y PEDAGOGIA    1    0
   *         Total:                                    1    0
   *
   * Se recorre de arriba abajo llevando el centro en curso, y cada línea de
   * especialidad se expande en tantas plazas como indiquen sus recuentos, para
   * que la aplicación pueda seguir contando posiciones por centro.
   */
  private parseGroupedPage(
    rows: TextRow[],
    hints: ParserHints,
    state: ParseState,
  ): { rows: IesRow[]; state: ParseState } {
    const grouped = hints.grouped;
    if (!grouped) return { rows: [], state };

    const centreMarker = normalizeHeader(grouped.centreMarker);
    const itemHeader = normalizeHeader(grouped.itemHeader);
    const totalMarker = normalizeHeader(grouped.totalMarker);
    const provinceMarker = grouped.provinceMarker ? normalizeHeader(grouped.provinceMarker) : null;

    const out: IesRow[] = [];
    let centre = state.centre ?? null;
    let inItems = state.inItems ?? false;
    let counter = state.counter ?? 0;
    let awaitingName = false;

    for (const row of rows) {
      const first = normalizeHeader(row.items[0]?.str ?? '');
      const rest = row.items.slice(1);

      if (provinceMarker && first === provinceMarker) {
        inItems = false;
        continue;
      }

      if (first === centreMarker) {
        const code = rest.find((i) => /^\d{6,8}$/.test(i.str.trim()));
        const locality = rest.find((i) => i !== code && i.str.trim().length > 1);
        centre = {
          code: code?.str.trim() ?? '',
          locality: locality?.str.trim() ?? '',
          name: '',
        };
        awaitingName = true;
        inItems = false;
        continue;
      }

      if (first === itemHeader) {
        awaitingName = false;
        inItems = true;
        continue;
      }

      if (first.startsWith(totalMarker)) {
        inItems = false;
        centre = null;
        continue;
      }

      // La línea inmediatamente posterior al rótulo del centro es su nombre.
      if (awaitingName && centre) {
        centre.name = row.items.map((i) => i.str.trim()).join(' ').trim();
        awaitingName = false;
        continue;
      }

      if (!inItems || !centre) continue;

      const position = this.parseGroupedItem(row);
      if (!position) continue;

      for (let i = 0; i < position.ordinary; i++) {
        out.push(this.groupedRow(++counter, centre, position, false));
      }
      for (let i = 0; i < position.itinerant; i++) {
        out.push(this.groupedRow(++counter, centre, position, true));
      }
    }

    return { rows: out, state: { ...state, centre, inItems, counter } };
  }

  /**
   * Lee una línea de especialidad: código, descripción y los dos recuentos
   * (ordinarias e itinerantes), que van siempre al final de la fila.
   */
  private parseGroupedItem(
    row: TextRow,
  ): { code: string; description: string; ordinary: number; itinerant: number } | null {
    if (row.items.length < 3) return null;

    const last = row.items[row.items.length - 1].str.trim();
    const secondLast = row.items[row.items.length - 2].str.trim();
    if (!/^\d+$/.test(last) || !/^\d+$/.test(secondLast)) return null;

    const code = row.items[0].str.trim();
    const description = row.items
      .slice(1, -2)
      .map((i) => i.str.trim())
      .join(' ')
      .trim();

    if (!description) return null;

    return { code, description, ordinary: parseInt(secondLast, 10), itinerant: parseInt(last, 10) };
  }

  private groupedRow(
    number: number,
    centre: { code: string; name: string; locality: string },
    position: { code: string; description: string },
    isItinerant: boolean,
  ): IesRow {
    // El código de especialidad viene como "0590018 - 018"; para la modalidad
    // basta la parte corta, que es como la rotulan el resto de comunidades.
    const short = position.code.split('-').pop()?.trim() || position.code;

    return {
      number,
      centre: centre.name,
      locality: centre.locality,
      code: centre.code,
      locationCode: position.code,
      observations: '',
      isItinerant,
      modality: `${short} - ${position.description}`,
    };
  }

  /**
   * Agrupa items en filas por su coordenada Y, de arriba abajo.
   *
   * Agrupa por cercanía a un ancla, no redondeando a una rejilla fija: una
   * rejilla parte por la mitad las filas que caen sobre una de sus fronteras
   * (dos items separados por 0,12 pt pueden acabar en filas distintas), y al
   * desgajarse pierden la localidad o el número de orden.
   *
   * El ancla es siempre el primer item de la fila —el más alto—, de modo que
   * una sucesión de items poco separados no puede encadenarse hasta formar una
   * fila arbitrariamente alta.
   */
  private toTextRows(items: PdfTextItem[], tolerance = DEFAULT_ROW_TOLERANCE): TextRow[] {
    const entries = items
      .filter((item) => item.str && item.str.trim())
      .map((item) => ({ y: item.transform[5], x: Math.round(item.transform[4]), str: item.str }))
      .sort((a, b) => b.y - a.y);

    const rows: TextRow[] = [];
    let anchor = Infinity;

    for (const entry of entries) {
      if (anchor - entry.y > tolerance) {
        anchor = entry.y;
        rows.push({ y: anchor, items: [] });
      }
      rows[rows.length - 1].items.push({ x: entry.x, str: entry.str });
    }

    for (const row of rows) {
      row.items.sort((a, b) => a.x - b.x);
    }

    return rows;
  }

  /** La modalidad (cuerpo/especialidad) va en un rótulo suelto sobre la tabla. */
  private detectModality(items: PdfTextItem[], hints: ParserHints): string {
    const pattern = hints.modalityPattern
      ? new RegExp(hints.modalityPattern)
      : /^[\dA-Za-z]+\s*-\s*.+\s*\/\s*.+/;
    const minLength = hints.modalityPattern ? 1 : 10;

    for (const item of items) {
      const txt = item.str.trim();
      if (txt.length >= minLength && pattern.test(txt)) {
        return txt;
      }
    }
    return '';
  }

  /** Resuelve a qué campo pertenece un item por su coordenada X. */
  private fieldFor(
    x: number,
    hints: ParserHints,
    columns: HeaderColumn[] | null,
  ): ColumnField | null {
    const overrides = hints.columnOverrides;
    if (overrides) {
      for (const [field, range] of Object.entries(overrides)) {
        if (range && x >= range[0] && x <= range[1]) return field as ColumnField;
      }
      return null;
    }
    return columns ? assignColumn(x, columns) : null;
  }

  private extractRows(
    textRows: TextRow[],
    modality: string,
    hints: ParserHints,
    columns: HeaderColumn[] | null,
  ): IesRow[] {
    const hasNumberColumn = columns
      ? columns.some((c) => c.field === 'number')
      : !!hints.columnOverrides?.number;

    const rows: IesRow[] = [];
    let lastRow: IesRow | null = null;

    for (const textRow of textRows) {
      let num = 0;
      let centre = '';
      let locality = '';
      let code = '';
      let locationCode = '';
      let observations = '';
      let isItinerant = false;
      let vacancies = 1;

      for (const item of textRow.items) {
        const text = item.str;
        const field = this.fieldFor(item.x, hints, columns);

        switch (field) {
          case 'number':
            if (/^\d+$/.test(text)) num = parseInt(text, 10);
            break;
          case 'code':
            if (/^\d{6,8}$/.test(text)) code = text;
            break;
          case 'locationCode':
            if (/^\d{4,8}$/.test(text)) locationCode = text;
            break;
          case 'locality':
            if (text.trim().length > 2) locality = this.append(locality, text);
            break;
          case 'centre':
            if (text.trim().length > 2) centre = this.append(centre, text);
            break;
          case 'vacancies':
            if (/^\d+$/.test(text)) vacancies = parseInt(text, 10);
            break;
          case 'observations':
            observations = this.append(observations, text);
            break;
        }

        if (hints.itinerantMarkers && /ITIN|itinerant|ü|º/u.test(text)) {
          isItinerant = true;
        }
      }

      if (hints.splitCodeFromCentre) {
        // "35000082 IES Joaquín Artiles" -> código + nombre.
        const split = /^(\d{6,8})\s+(.+)$/.exec(centre.trim());
        if (split) {
          code = code || split[1];
          centre = split[2];
        }
      }

      // Cuando la comunidad declara que el código va dentro de la celda del
      // centro, una fila sin código es un título o un pie, no una plaza.
      const codeRequired = !!hints.splitCodeFromCentre;
      const isValid =
        !!(centre || locality) && (!hasNumberColumn || num > 0) && (!codeRequired || !!code);

      if (isValid) {
        const cleanObservations = observations.replace(/[üº]/g, '').trim();
        // Sin expansión, una fila es una plaza; con ella, la fila dice cuántas.
        const copies = hints.expandVacancies ? vacancies : 1;

        for (let i = 0; i < copies; i++) {
          const row: IesRow = {
            number: hints.expandVacancies ? rows.length + 1 : num,
            centre,
            locality,
            code,
            locationCode,
            observations: cleanObservations,
            isItinerant,
            modality,
          };
          if (isItinerant) this.enrichItinerant(row);
          rows.push(row);
          lastRow = row;
        }
      } else if (hints.itinerantMarkers && isItinerant && lastRow && !lastRow.isItinerant) {
        // El marcador de itinerancia viene en una fila propia, ligeramente por
        // debajo de la plaza a la que pertenece.
        const hasMarker = textRow.items.some((i) => /[üº]/.test(i.str));
        if (hasMarker) {
          lastRow.isItinerant = true;
          const clean = observations.replace(/[üº]/g, '').trim();
          if (clean) lastRow.observations = this.append(lastRow.observations, clean);
          this.enrichItinerant(lastRow);
        }
      }
    }

    rows.sort((a, b) => a.number - b.number);
    return rows;
  }

  /** Deduce centro de itinerancia y horas a partir de las observaciones. */
  private enrichItinerant(row: IesRow) {
    const obs = row.observations || '';

    const matchHours = obs.match(/(\d+[,.]?\d*)/);
    if (matchHours) row.hours = matchHours[1];

    const parts = obs.replace(/-\s*\d+[,.]?\d*/, '').trim();
    if (parts && /IES|CENTRE|COL\.?|CEIP/i.test(parts)) {
      row.itinerantCentre = parts.replace(/[üº]/g, '').trim();
    }
  }

  private append(current: string, text: string): string {
    return current ? `${current} ${text}` : text;
  }

  groupByCentre(records: IesRow[]): Map<string, { name: string; locality: string; code: string; positions: IesRow[]; totalItinerants: number }> {
    const centres = new Map<string, { name: string; locality: string; code: string; positions: IesRow[]; totalItinerants: number }>();

    for (const r of records) {
      if (!r.centre && !r.code) continue;

      const key = r.code || r.centre;
      if (!centres.has(key)) {
        centres.set(key, { name: r.centre, locality: r.locality, code: r.code, positions: [], totalItinerants: 0 });
      }

      const existing = centres.get(key)!;
      if (!existing.name && r.centre) existing.name = r.centre;
      if (!existing.locality && r.locality) existing.locality = r.locality;
      if (r.isItinerant) existing.totalItinerants++;
      existing.positions.push(r);
    }

    return centres;
  }
}
