import { Injectable, signal } from '@angular/core';
import { IesRow, ProcessInfo } from '../types';
import { I18nService } from './i18n.service';
import {
  ColumnField,
  HeaderColumn,
  TextRow,
  assignColumn,
  detectHeaderRow,
  matchHeaderField,
  matchHeaderFieldExact,
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
   * - `transposed`: la tabla está girada. Cada *columna* es una plaza y cada
   *   *fila* un campo, con el rótulo del campo a la izquierda. Es el caso de
   *   Murcia, que además reparte las plazas en dos paneles por página.
   * - `records`: no hay tabla, sino una ficha por plaza que reimprime sus
   *   propios rótulos. Es el caso de Aragón.
   */
  strategy?: 'columns' | 'grouped' | 'transposed' | 'records';
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
  /** Rótulos que delimitan las fichas cuando `strategy` es `records`. */
  records?: RecordHints;
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
  /**
   * Separación mínima en X para considerar que dos valores pertenecen a plazas
   * distintas, en la estrategia `transposed`.
   *
   * Un valor largo se parte en varias líneas ligeramente desplazadas (unos
   * 10 pt en Murcia), mientras que dos plazas contiguas distan unos 50, así
   * que 25 separa bien sin partir un valor por la mitad.
   */
  transposedGap?: number;
  /**
   * Patrón (como texto) para sacar el código del centro del código del puesto,
   * cuando el listado no lo imprime en columna propia.
   *
   * Cantabria no publica ninguna columna de código de centro, pero su código
   * de puesto lo lleva dentro ("C39011441 0590007 0N004"): letra, código de
   * centro, especialidad y correlativo. Sin extraerlo no habría forma de
   * situar la plaza, porque el nombre del centro va abreviado y sin el tipo.
   */
  codeFromLocationCode?: string;
  /**
   * La página encabeza un valor que vale para todas sus plazas —la
   * especialidad, o el centro— con un rótulo propio a la izquierda del de la
   * columna, y lo imprime en una fila suelta a esa misma altura.
   *
   * Va detrás de un interruptor porque no es inocuo: en Múrcia hay filas
   * sueltas ("ADJUDICADO EL 03/11/25") que se tomarían por ese valor.
   */
  transposedCaption?: boolean;
  /**
   * Campo del que salen las columnas de la tabla girada, en lugar de deducirlas
   * de todos los valores de la página.
   *
   * Deducirlas de todo funciona mientras ningún valor se parta en dos líneas:
   * en Cantabria una observación larga se desplaza 11 pt y abre una columna
   * fantasma que, al estar a solo 6 pt de la plaza siguiente, se la traga. El
   * código del puesto, en cambio, es un valor por plaza y nunca se parte.
   */
  transposedAnchorField?: ColumnField;
  /**
   * Descarta las filas que no traigan código de centro.
   *
   * Hay maquetas donde cada plaza ocupa varias filas: la primera lleva el
   * centro y las siguientes solo detalles ("Provincia:", "Tipo Vacante:").
   * Sin este filtro, esas filas de detalle se colarían como plazas fantasma.
   */
  requireCode?: boolean;
  /**
   * Rótulo de la fila que anuncia la especialidad en curso.
   *
   * En Castilla y León cada tramo del listado empieza con
   * "Especialidad: 001 FILOSOFIA", y esa modalidad se aplica a todas las
   * plazas siguientes hasta el próximo rótulo. Se arrastra entre páginas.
   */
  modalityLabel?: string;
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
 * Rótulos que estructuran un listado en fichas, una por plaza.
 *
 * A diferencia de una tabla, aquí los rótulos se reimprimen dentro de cada
 * ficha, así que no vale localizar una cabecera y aplicarla al resto de la
 * página: la ficha misma es la unidad, y sus rótulos hay que reconocerlos uno
 * a uno.
 */
export interface RecordHints {
  /**
   * Rótulo que abre cada ficha.
   *
   * Su columna lleva el identificador de la plaza, así que se asigna a
   * `number` sin consultar el diccionario: en Aragón el rótulo es
   * "- Vacante -", que el diccionario leería como un recuento de vacantes.
   */
  startMarker: string;
  /**
   * Patrón (como texto) que reconoce un rótulo de la maqueta, con el nombre
   * del rótulo en su primer grupo de captura.
   *
   * Aragón los envuelve entre guiones ("- Jornada -"), lo que permite separar
   * rótulo de valor sin enumerarlos todos: los que no sirven para situar la
   * plaza —jornada, duración, causa— se recogen igualmente como observaciones,
   * que es donde el docente espera encontrarlos.
   */
  labelPattern: string;
  /**
   * Patrón (como texto) de las filas que no son datos, típicamente el pie de
   * página. Sin él, el pie caería dentro de la última ficha de cada página.
   */
  ignorePattern?: string;
}

/**
 * Ficha en construcción: sus columnas, el contenido de cada celda línea a
 * línea, y los pares rótulo/valor de sus sub-bloques.
 */
interface OpenRecord {
  columns: HeaderColumn[];
  cells: Partial<Record<ColumnField, string[]>>;
  details: { label: string; value: string }[];
  /** Rótulos del sub-bloque en curso, a la espera de sus valores. */
  pending: { label: string; x: number }[] | null;
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
  /** Especialidad en curso, cuando la anuncia una fila con rótulo. */
  modality?: string;
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

    if (hints.strategy === 'transposed') {
      return { rows: this.parseTransposedPage(rows, hints), state };
    }

    if (hints.strategy === 'records') {
      return this.parseRecordsPage(rows, hints, state);
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

    const extracted = this.extractRows(dataRows, modality || (state.modality ?? ''), hints, columns);

    return {
      rows: extracted.rows,
      state: { ...state, columns, modality: extracted.modality },
    };
  }

  /**
   * Extrae un listado con la tabla girada.
   *
   * Cada plaza es una *columna* y cada campo una *fila*, con el rótulo del
   * campo a la izquierda:
   *
   *     Función        0590004 LENGUA    0590013 ITALIANO   0592002 ARABE
   *     Localidad      CARTAGENA         MURCIA             MURCIA
   *     Nombre Centro  IES MEDITERRÁNEO  IES SAAVEDRA ...   EOI ...
   *     Cod. Centro    30012276          30006173           30009757
   *
   * Se localizan las filas cuyo primer texto es un rótulo conocido, y el resto
   * de sus items se agrupan en columnas por cercanía en X: cada columna es una
   * plaza. Los valores largos se parten en varias líneas ligeramente
   * desplazadas, y por eso se agrupa por hueco y no por coincidencia exacta.
   *
   * Murcia imprime dos paneles por página ("Vacantes de PLANTILLA" y "de
   * SUSTITUCIÓN"), cada uno con su propia columna de rótulos; como los rótulos
   * se excluyen del agrupado, ambos paneles se resuelven a la vez.
   */
  private parseTransposedPage(rows: TextRow[], hints: ParserHints): IesRow[] {
    const gap = hints.transposedGap ?? 25;

    // Fila etiquetada: su primer item es un rótulo que el diccionario conoce.
    const labelled: { field: ColumnField; values: { x: number; str: string }[] }[] = [];

    // Rótulo de bloque: describe un valor que vale para toda la página, no
    // para una plaza. Cantabria encabeza cada hoja con "Especialidad:" o
    // "Centro:", y su valor va aparte, en una fila suelta a esa misma altura.
    const captions: { field: ColumnField; x: number }[] = [];
    const looseItems: { x: number; str: string }[] = [];

    // Con rótulos de bloque la comparación tiene que ser estricta: los valores
    // conviven en la misma fila que los rótulos de los demás paneles, y un
    // parecido basta para tragarse un centro.
    const asLabel = hints.transposedCaption ? matchHeaderFieldExact : matchHeaderField;

    for (const row of rows) {
      const labels = row.items.filter((i) => asLabel(i.str));
      if (labels.length === 0) {
        if (hints.transposedCaption) looseItems.push(...row.items);
        continue;
      }

      const values = row.items.filter((i) => !labels.includes(i));
      const firstValueX = values.length ? values[0].x : Infinity;
      // Solo se miran los rótulos anteriores al primer valor cuando la maqueta
      // declara que antepone un rótulo de bloque. Sin ese aviso no se puede
      // distinguir un segundo rótulo de un valor que se le parece: Múrcia
      // escribe "INCORPORACIÓN AL CENTRO" como observación, y el diccionario
      // lo leería como la columna del centro.
      const leading = hints.transposedCaption
        ? labels.filter((l) => l.x < firstValueX)
        : [];

      // Con dos rótulos por delante, el primero es el del bloque y el segundo
      // el de la columna. Quedarse con el primero, como se hacía antes,
      // cambiaba el campo de toda la fila: en Cantabria los nombres de centro
      // acababan guardados como especialidad.
      const label = leading.length ? leading[leading.length - 1] : row.items[0];
      const field = asLabel(label.str);
      if (!field) continue;

      // Una página puede traer varios paneles, cada uno con su propio rótulo de
      // bloque delante del de la columna. Se reconocen por ir pegados: rótulo
      // de bloque, rótulo de columna, y a continuación los valores del panel.
      if (hints.transposedCaption) {
        for (let i = 0; i + 1 < labels.length; i++) {
          const captionField = asLabel(labels[i].str);
          if (!captionField || captionField === field) continue;
          if (asLabel(labels[i + 1].str) !== field) continue;
          if (labels[i + 1].x - labels[i].x > 40) continue;
          captions.push({ field: captionField, x: labels[i].x });
        }
      }

      labelled.push({ field, values });
    }

    if (labelled.length === 0) return [];

    // Las columnas salen de todas las X de valor vistas en la página, salvo que
    // la comunidad señale un campo del que fiarse.
    const anchorSource = hints.transposedAnchorField
      ? labelled.filter((l) => l.field === hints.transposedAnchorField)
      : labelled;
    const xs = (anchorSource.length ? anchorSource : labelled)
      .flatMap((l) => l.values.map((v) => v.x))
      .sort((a, b) => a - b);
    const anchors: number[] = [];
    for (const x of xs) {
      if (anchors.length === 0 || x - anchors[anchors.length - 1] > gap) anchors.push(x);
    }

    const columnOf = (x: number): number => {
      let best = 0;
      for (let i = 1; i < anchors.length; i++) {
        if (Math.abs(x - anchors[i]) < Math.abs(x - anchors[best])) best = i;
      }
      return best;
    };

    const records = anchors.map(() => new Map<ColumnField, string[]>());

    for (const { field, values } of labelled) {
      for (const value of values) {
        const record = records[columnOf(value.x)];
        record.set(field, [...(record.get(field) ?? []), value.str.trim()]);
      }
    }

    // Cada rótulo de bloque toma su valor de las filas sueltas que caen a su
    // misma altura, y vale para las plazas de su panel: las que quedan a su
    // derecha, hasta donde empiece el panel siguiente.
    const captionValues = captions
      .map((c) => ({
        ...c,
        value: looseItems
          .filter((i) => Math.abs(i.x - c.x) <= 6)
          .map((i) => i.str.trim())
          .join(' ')
          .trim(),
      }))
      .sort((a, b) => a.x - b.x);

    const captionFor = (x: number) => {
      let best: (typeof captionValues)[number] | null = null;
      for (const candidate of captionValues) {
        if (candidate.x <= x) best = candidate;
      }
      return best;
    };

    const out: IesRow[] = [];

    for (let column = 0; column < records.length; column++) {
      const record = records[column];
      const block = captionFor(anchors[column]);
      const read = (field: ColumnField) => {
        const own = (record.get(field) ?? []).join(' ').trim();
        return own || (block?.field === field ? block.value : '');
      };

      const locationCode = read('locationCode');
      let code = read('code');
      if (!code && hints.codeFromLocationCode) {
        const embedded = new RegExp(hints.codeFromLocationCode).exec(locationCode);
        if (embedded) code = embedded[1] ?? embedded[0];
      }

      const centre = read('centre');
      if (!/^\d{6,8}$/.test(code) || !centre) continue;

      const itinerant = read('itinerant').toUpperCase();

      out.push({
        number: out.length + 1,
        centre,
        locality: read('locality'),
        code,
        locationCode,
        observations: read('observations'),
        isItinerant: itinerant.startsWith('S'),
        modality: read('modality'),
      });
    }

    return out;
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

  /**
   * Extrae un listado maquetado como fichas, una por plaza.
   *
   * Aragón no imprime una tabla sino una ficha por vacante, con sus rótulos
   * repetidos dentro de cada una:
   *
   *     - Vacante -   - Cuerpo/Especialidad -              - Centro -
   *                   0590 - PROFESORES DE ENS. SECUNDARIA (44003223) IES SEGUNDO DE CHOMÓN
   *       13588       111 - ORGANIZACION Y PROCESOS DE     TERUEL (TERUEL)
   *                   MANTENIMIENTO DE VEHICULOS
   *     - Jornada -   - Duración -   - Obligación -   - Causa -
   *     Parcial       Sustitución    Voluntaria       Paternidad
   *
   * La ficha se abre con el rótulo de inicio, cuya fila da además las columnas.
   * Lo que sigue son los datos principales, hasta el primer sub-bloque: a
   * partir de ahí cada fila de rótulos se empareja por X con sus valores y
   * acaba en las observaciones.
   *
   * Una ficha nunca queda partida por un salto de página —el generador prefiere
   * dejar el hueco en blanco—, así que la ficha abierta se cierra al terminar
   * la página en vez de arrastrarse en el estado.
   */
  private parseRecordsPage(
    rows: TextRow[],
    hints: ParserHints,
    state: ParseState,
  ): { rows: IesRow[]; state: ParseState } {
    const config = hints.records;
    if (!config) return { rows: [], state };

    const startMarker = normalizeHeader(config.startMarker);
    const labelPattern = new RegExp(config.labelPattern);
    const ignorePattern = config.ignorePattern ? new RegExp(config.ignorePattern) : null;

    const out: IesRow[] = [];
    let counter = state.counter ?? 0;
    let open: OpenRecord | null = null;

    const close = () => {
      if (!open) return;
      const row = this.recordRow(open, counter + 1);
      if (row) {
        counter++;
        out.push(row);
      }
      open = null;
    };

    for (const row of rows) {
      if (ignorePattern && row.items.some((i) => ignorePattern.test(i.str))) continue;

      if (row.items.some((i) => normalizeHeader(i.str) === startMarker)) {
        close();
        open = {
          columns: row.items
            .map((item) => ({
              field:
                normalizeHeader(item.str) === startMarker
                  ? ('number' as ColumnField)
                  : matchHeaderField(item.str),
              x: item.x,
            }))
            .filter((c): c is HeaderColumn => !!c.field),
          cells: {},
          details: [],
          pending: null,
        };
        continue;
      }

      // Todo lo que hay antes de la primera ficha son membretes del documento.
      if (!open) continue;

      const labels = row.items.map((i) => labelPattern.exec(i.str.trim()));
      if (labels.every((m) => !!m)) {
        open.pending = row.items.map((item, i) => ({
          label: (labels[i]![1] ?? item.str).trim(),
          x: item.x,
        }));
        continue;
      }

      if (open.pending) {
        for (const item of row.items) {
          const label = this.nearestLabel(open.pending, item.x);
          const detail = open.details.find((d) => d.label === label);
          if (detail) detail.value = this.append(detail.value, item.str.trim());
          else open.details.push({ label, value: item.str.trim() });
        }
        continue;
      }

      for (const item of row.items) {
        const field = assignColumn(item.x, open.columns);
        if (!field) continue;
        (open.cells[field] ??= []).push(item.str.trim());
      }
    }

    close();

    return { rows: out, state: { ...state, counter } };
  }

  /** Rótulo del sub-bloque cuyo inicio cae más cerca del valor. */
  private nearestLabel(pending: { label: string; x: number }[], x: number): string {
    let best = pending[0];
    for (const candidate of pending) {
      if (Math.abs(candidate.x - x) < Math.abs(best.x - x)) best = candidate;
    }
    return best.label;
  }

  /**
   * Convierte una ficha ya recorrida en una plaza.
   *
   * Las celdas guardan sus líneas por separado porque su reparto es
   * significativo: en la de cuerpo/especialidad la primera línea es el cuerpo y
   * el resto la especialidad (que puede partirse en varias), y en la del centro
   * la última línea es la localidad con su provincia entre paréntesis.
   */
  private recordRow(open: OpenRecord, fallbackNumber: number): IesRow | null {
    const centreLines = open.cells.centre ?? [];
    if (centreLines.length === 0) return null;

    let locality = (open.cells.locality ?? []).join(' ').trim();
    let nameLines = centreLines;
    if (!locality && centreLines.length > 1) {
      nameLines = centreLines.slice(0, -1);
      // "TERUEL (TERUEL)" -> "TERUEL": el paréntesis es la provincia, y si se
      // deja, la localidad no casa con ningún municipio del directorio.
      locality = centreLines[centreLines.length - 1].replace(/\s*\([^)]*\)\s*$/, '').trim();
    }

    let centre = nameLines.join(' ').trim();
    let code = (open.cells.code ?? []).join('').trim();

    // "(44003223) IES SEGUNDO DE CHOMÓN" -> código + nombre.
    const split = /^\(?(\d{6,8})\)?\s+(.+)$/.exec(centre);
    if (split) {
      code = code || split[1];
      centre = split[2];
    }

    // Sin código no es una plaza: es un membrete que se ha colado en la ficha.
    if (!code) return null;

    const modalityLines = open.cells.modality ?? [];
    const modality = (modalityLines.length > 1 ? modalityLines.slice(1) : modalityLines)
      .join(' ')
      .trim();

    const numberText = (open.cells.number ?? []).find((t) => /^\d+$/.test(t));

    return {
      number: numberText ? parseInt(numberText, 10) : fallbackNumber,
      centre,
      locality,
      code,
      locationCode: '',
      observations: open.details.map((d) => `${d.label}: ${d.value}`).join(' · '),
      isItinerant: open.details.some((d) => /itinera/i.test(`${d.label} ${d.value}`)),
      modality,
    };
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
    initialModality: string,
    hints: ParserHints,
    columns: HeaderColumn[] | null,
  ): { rows: IesRow[]; modality: string } {
    // La especialidad puede venir anunciada por una fila con rótulo y aplicarse
    // a todas las plazas siguientes, incluso pasando de página.
    const modalityLabel = hints.modalityLabel ? normalizeHeader(hints.modalityLabel) : null;
    let modality = initialModality;
    const hasNumberColumn = columns
      ? columns.some((c) => c.field === 'number')
      : !!hints.columnOverrides?.number;

    const rows: IesRow[] = [];
    let lastRow: IesRow | null = null;

    for (const textRow of textRows) {
      if (modalityLabel && normalizeHeader(textRow.items[0]?.str ?? '') === modalityLabel) {
        const announced = textRow.items
          .slice(1)
          .map((i) => i.str.trim())
          .join(' ')
          .trim();
        // Un rótulo sin valor no anuncia un cambio de especialidad: es un
        // renglón que el generador ha dejado en blanco. Si se tomara al pie de
        // la letra, las plazas que vienen debajo se quedarían sin especialidad.
        if (announced) modality = announced;
        continue;
      }

      let num = 0;
      let centre = '';
      let locality = '';
      let code = '';
      let locationCode = '';
      let observations = '';
      let isItinerant = false;
      let vacancies = 1;
      // Hay listados que traen la especialidad como una columna más, en vez de
      // anunciarla en un rótulo por encima de la tabla.
      let rowModality = '';

      for (const item of textRow.items) {
        const text = item.str;
        const field = this.fieldFor(item.x, hints, columns);

        switch (field) {
          case 'number':
            if (/^\d+$/.test(text)) num = parseInt(text, 10);
            break;
          case 'code': {
            // La Rioja imprime el código con letra de control ("26003507C").
            // Se guarda solo la parte numérica, que es la que usan los
            // directorios de centros para cruzar.
            const withCheck = /^(\d{6,8})[A-Z]?$/.exec(text);
            if (withCheck) code = withCheck[1];
            break;
          }

          case 'locationCode':
            if (/^\d{4,10}$/.test(text)) locationCode = text;
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
          case 'modality':
            if (text.trim()) rowModality = this.append(rowModality, text);
            break;
          case 'observations':
            observations = this.append(observations, text);
            break;
          case 'itinerant':
            // Columna propia de itinerancia, marcada con una letra suelta.
            // La Rioja la rotula "I" y no lo repite en las observaciones, así
            // que sin leer la columna la plaza se daría por no itinerante.
            if (text.trim()) isItinerant = true;
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
      const codeRequired = !!hints.splitCodeFromCentre || !!hints.requireCode;
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
            modality: rowModality || modality,
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
    return { rows, modality };
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
