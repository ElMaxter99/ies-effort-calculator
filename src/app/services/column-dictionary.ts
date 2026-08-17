/**
 * Diccionario de cabeceras de columna para los listados de vacantes docentes.
 *
 * Cada comunidad autónoma maqueta su PDF a su manera, pero todas rotulan las
 * columnas con alguna variante de las mismas palabras. Reconocer la cabecera
 * permite deducir dónde cae cada columna en lugar de codificar a mano los
 * rangos de coordenada X de un PDF concreto.
 */

/** Campos que sabemos reconocer en una cabecera. */
export type ColumnField =
  | 'number'
  | 'locationCode'
  | 'locality'
  | 'centre'
  | 'code'
  | 'itinerant'
  | 'vacancies'
  | 'observations';

/**
 * Sinónimos por campo, ya normalizados (mayúsculas, sin acentos ni puntuación).
 * Cubren castellano, catalán/valenciano y gallego; el euskera se añadirá si
 * llega a activarse el País Vasco.
 *
 * Ante solapamiento gana el sinónimo más largo: "CODIGO CENTRO" debe ganar a
 * "CENTRO", y "CODIGO PUESTO" a "CODIGO".
 */
const SYNONYMS: Record<ColumnField, string[]> = {
  number: ['NUM', 'N', 'NUMERO', 'ORDEN', 'ORDRE', 'NUM ORDEN', 'NUM ORDRE', 'ORDE'],
  locationCode: ['LLOC', 'PUESTO', 'POSTO', 'CODIGO PUESTO', 'COD PUESTO', 'CODI LLOC', 'PLAZA', 'PRAZA'],
  locality: ['LOCALITAT', 'LOCALIDAD', 'LOCALIDADE', 'MUNICIPIO', 'MUNICIPI', 'CONCELLO', 'POBLACION', 'POBLACIO'],
  centre: ['CENTRE', 'CENTRO', 'DENOMINACION', 'DENOMINACIO', 'NOM CENTRE', 'NOMBRE CENTRO', 'CENTRO EDUCATIVO'],
  code: ['CODI', 'CODIGO', 'COD', 'COD CENTRO', 'CODIGO CENTRO', 'CODI CENTRE', 'CODIGO DE CENTRO'],
  itinerant: ['ITIN', 'ITINERANT', 'ITINERANTE'],
  vacancies: ['VAC', 'VACANTES', 'VACANTS', 'VACANTE', 'PLAZAS', 'PLACES'],
  observations: ['OBSERVACIONS', 'OBSERVACIONES', 'OBS', 'NOTAS', 'NOTES'],
};

/** Índice sinónimo -> campo, ordenado por longitud descendente. */
const LOOKUP: { text: string; field: ColumnField }[] = Object.entries(SYNONYMS)
  .flatMap(([field, words]) => words.map((text) => ({ text, field: field as ColumnField })))
  .sort((a, b) => b.text.length - a.text.length);

/**
 * Normaliza un rótulo de cabecera: mayúsculas, sin acentos, sin puntuación y
 * con los espacios colapsados. "N.º" -> "N", "CÓD. CENTRO" -> "COD CENTRO".
 */
export function normalizeHeader(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Resuelve el campo de un rótulo de cabecera, o null si no lo reconoce.
 *
 * Los listados bilingües rotulan con barra ("LOCALITAT / LOCALIDAD",
 * "CENTRE / CENTRO"), así que se prueba el rótulo completo y luego cada mitad.
 */
export function matchHeaderField(text: string): ColumnField | null {
  const candidates = [text, ...text.split('/')].map(normalizeHeader).filter(Boolean);

  for (const candidate of candidates) {
    const exact = LOOKUP.find((entry) => entry.text === candidate);
    if (exact) return exact.field;
  }

  // Rótulos compuestos del tipo "CODIGO DEL CENTRO": buscar el sinónimo más
  // largo contenido en el texto, respetando límites de palabra.
  for (const candidate of candidates) {
    const partial = LOOKUP.find((entry) => new RegExp(`\\b${entry.text}\\b`).test(candidate));
    if (partial) return partial.field;
  }

  return null;
}

/** Una columna localizada en la cabecera, con la X donde empieza su rótulo. */
export interface HeaderColumn {
  field: ColumnField;
  x: number;
}

/** Fila de items de texto ya agrupados por coordenada Y. */
export interface TextRow {
  y: number;
  items: { x: number; str: string }[];
}

/**
 * Localiza la fila de cabecera de una página.
 *
 * Se exige un mínimo de columnas reconocidas y la presencia de centro o
 * localidad, para no confundir un título con una cabecera de tabla.
 */
export function detectHeaderRow(rows: TextRow[]): { row: TextRow; columns: HeaderColumn[] } | null {
  for (const row of rows) {
    const columns: HeaderColumn[] = [];
    const seen = new Set<ColumnField>();

    for (const item of row.items) {
      const field = matchHeaderField(item.str);
      if (field && !seen.has(field)) {
        seen.add(field);
        columns.push({ field, x: item.x });
      }
    }

    const meaningful = seen.has('centre') || seen.has('locality');
    if (columns.length >= 3 && meaningful) {
      return { row, columns: columns.sort((a, b) => a.x - b.x) };
    }
  }

  return null;
}

/**
 * Asigna un item de datos a una columna por proximidad al rótulo más cercano.
 *
 * Los rótulos y los datos no comparten X exacta (una columna numérica alineada
 * a la derecha empieza antes que su rótulo), pero sí quedan siempre más cerca
 * de su propio rótulo que del vecino, así que la vecindad basta y evita tener
 * que inferir los límites de columna.
 *
 * Devuelve null si el item cae claramente fuera de la tabla.
 */
export function assignColumn(x: number, columns: HeaderColumn[], maxDistance = 120): ColumnField | null {
  let best: ColumnField | null = null;
  let bestDistance = Infinity;

  for (const column of columns) {
    const distance = Math.abs(x - column.x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = column.field;
    }
  }

  return bestDistance <= maxDistance ? best : null;
}
