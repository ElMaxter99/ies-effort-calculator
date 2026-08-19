import { describe, it, expect } from 'vitest';
import { readSheet } from './xlsx-reader';

/**
 * Construye un .xlsx de verdad —ZIP con sus dos cabeceras y su directorio
 * central— para poder ejercitar el lector sin meter un binario en el
 * repositorio.
 *
 * Comprime con `CompressionStream`, que es el reflejo exacto de lo que el
 * lector usa para descomprimir.
 */
async function buildXlsx(files: Record<string, string>): Promise<Blob> {
  const encoder = new TextEncoder();
  const entries: { name: Uint8Array; data: Uint8Array; size: number; offset: number }[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const push = (bytes: Uint8Array) => {
    chunks.push(bytes);
    offset += bytes.length;
  };

  const u32 = (value: number) => new Uint8Array([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff]);
  const u16 = (value: number) => new Uint8Array([value & 0xff, (value >> 8) & 0xff]);

  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const source = new ReadableStream<BufferSource>({
      start(controller) {
        controller.enqueue(encoder.encode(content));
        controller.close();
      },
    });
    const deflated = new Uint8Array(
      await new Response(source.pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(),
    );

    const entryOffset = offset;
    push(u32(0x04034b50));
    push(u16(20));
    push(u16(0));
    push(u16(8));
    push(u32(0));
    push(u32(0));
    push(u32(deflated.length));
    push(u32(content.length));
    push(u16(nameBytes.length));
    push(u16(0));
    push(nameBytes);
    push(deflated);

    entries.push({ name: nameBytes, data: deflated, size: deflated.length, offset: entryOffset });
  }

  const directoryOffset = offset;
  for (const entry of entries) {
    push(u32(0x02014b50));
    push(u16(20));
    push(u16(20));
    push(u16(0));
    push(u16(8));
    push(u32(0));
    push(u32(0));
    push(u32(entry.size));
    push(u32(entry.size));
    push(u16(entry.name.length));
    push(u16(0));
    push(u16(0));
    push(u16(0));
    push(u16(0));
    push(u32(0));
    push(u32(entry.offset));
    push(entry.name);
  }

  const directorySize = offset - directoryOffset;
  push(u32(0x06054b50));
  push(u16(0));
  push(u16(0));
  push(u16(entries.length));
  push(u16(entries.length));
  push(u32(directorySize));
  push(u32(directoryOffset));
  push(u16(0));

  return new Blob(chunks as BlobPart[]);
}

const SHARED =
  '<?xml version="1.0"?><sst>' +
  '<si><t>Centro Educativo</t></si>' +
  '<si><t>Especialidad</t></si>' +
  '<si><t>Vacantes</t></si>' +
  '<si><t>IES. Enrique &amp; Nieto</t></si>' +
  '<si><r><t>Filosof</t></r><r><t>ía (0590-001)</t></r></si>' +
  '</sst>';

const SHEET =
  '<?xml version="1.0"?><worksheet><sheetData>' +
  '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="C2" t="s"><v>2</v></c></row>' +
  '<row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="s"><v>4</v></c><c r="C3"><v>2</v></c></row>' +
  '<row r="4"/>' +
  '</sheetData></worksheet>';

describe('lector de hojas de cálculo', () => {
  it('lee las filas de un .xlsx comprimido', async () => {
    const rows = await readSheet(
      await buildXlsx({ 'xl/sharedStrings.xml': SHARED, 'xl/worksheets/sheet1.xml': SHEET }),
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ A: 'Centro Educativo', B: 'Especialidad', C: 'Vacantes' });
    expect(rows[1]['C']).toBe('2');
  });

  it('junta los trozos de un texto con formato y deshace las entidades', async () => {
    // Excel parte una celda en varios <r> cuando cambia el formato a media
    // palabra, y escapa el ampersand.
    const rows = await readSheet(
      await buildXlsx({ 'xl/sharedStrings.xml': SHARED, 'xl/worksheets/sheet1.xml': SHEET }),
    );

    expect(rows[1]['A']).toBe('IES. Enrique & Nieto');
    expect(rows[1]['B']).toBe('Filosofía (0590-001)');
  });

  it('avisa cuando el fichero no es un .xlsx', async () => {
    await expect(readSheet(new Blob(['esto no es un zip']))).rejects.toThrow(/xlsx/i);
  });
});
