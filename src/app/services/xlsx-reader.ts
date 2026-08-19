/**
 * Lector mínimo de hojas de cálculo .xlsx.
 *
 * Un .xlsx es un ZIP con XML dentro, y el navegador ya sabe descomprimir
 * (`DecompressionStream`), así que leerlo no necesita ninguna librería: son dos
 * ficheros del ZIP —la tabla de cadenas y la hoja— y una pasada de expresiones
 * regulares. Traer una librería de hojas de cálculo entera para esto pesaría
 * más que el resto de la aplicación.
 *
 * Lee lo justo para un listado tabular: valores de celda como texto. No
 * interpreta formatos, fórmulas ni fechas, que estos listados no usan.
 */

/** Fila de la hoja: valor por letra de columna ("A", "B", "C"...). */
export type SheetRow = Record<string, string>;

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const EOCD = 0x06054b50;

interface ZipEntry {
  name: string;
  compressed: boolean;
  offset: number;
  size: number;
}

/**
 * Localiza las entradas del ZIP por su directorio central.
 *
 * Se lee el directorio y no los encabezados locales porque estos pueden dejar
 * el tamaño a cero y remitirlo a un descriptor posterior, que obligaría a
 * adivinar dónde acaban los datos.
 */
function readZipEntries(view: DataView): ZipEntry[] {
  let eocd = -1;
  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('No parece un fichero .xlsx');

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_HEADER) break;

    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);

    const name = new TextDecoder().decode(
      new Uint8Array(view.buffer, view.byteOffset + offset + 46, nameLength),
    );

    entries.push({ name, compressed: method === 8, offset: localOffset, size });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

async function readEntry(view: DataView, entry: ZipEntry): Promise<string> {
  if (view.getUint32(entry.offset, true) !== LOCAL_HEADER) {
    throw new Error(`Entrada dañada en el .xlsx: ${entry.name}`);
  }

  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  // Se copia a un buffer propio: la vista sobre el fichero completo no
  // satisface el tipo que piden los flujos.
  const raw = new Uint8Array(entry.size);
  raw.set(new Uint8Array(view.buffer, view.byteOffset + start, entry.size));

  if (!entry.compressed) return new TextDecoder().decode(raw);

  // Se alimenta el descompresor desde un flujo propio en vez de Blob.stream():
  // así no depende de qué partes de la API de ficheros tenga el entorno.
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(raw);
      controller.close();
    },
  });

  return new Response(source.pipeThrough(new DecompressionStream('deflate-raw'))).text();
}

/** Deshace las entidades XML que aparecen en el texto de las celdas. */
function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

/**
 * Lee la primera hoja de un .xlsx y devuelve sus filas.
 *
 * Los textos no se guardan en la hoja sino en una tabla común, y la celda
 * remite a ella con `t="s"`; los números sí van en la propia celda.
 */
export async function readSheet(file: File | Blob): Promise<SheetRow[]> {
  const view = new DataView(await file.arrayBuffer());
  const entries = readZipEntries(view);

  const sheetEntry =
    entries.find((e) => /^xl\/worksheets\/sheet1\.xml$/i.test(e.name)) ??
    entries.find((e) => /^xl\/worksheets\/.+\.xml$/i.test(e.name));
  if (!sheetEntry) throw new Error('El .xlsx no tiene ninguna hoja');

  const stringsEntry = entries.find((e) => /^xl\/sharedStrings\.xml$/i.test(e.name));
  const shared = stringsEntry
    ? [...(await readEntry(view, stringsEntry)).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, item]) =>
        decodeXml([...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(([, text]) => text).join('')),
      )
    : [];

  const sheet = await readEntry(view, sheetEntry);
  const rows: SheetRow[] = [];

  for (const [, body] of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: SheetRow = {};

    for (const cell of body.matchAll(/<c r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      const [, column, attributes, inner] = cell;
      const value = /<v>([\s\S]*?)<\/v>/.exec(inner);
      if (!value) continue;

      const raw = value[1];
      row[column] = /t="s"/.test(attributes) ? (shared[Number(raw)] ?? '') : decodeXml(raw);
    }

    if (Object.keys(row).length) rows.push(row);
  }

  return rows;
}
