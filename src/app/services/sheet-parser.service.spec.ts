import { describe, it, expect } from 'vitest';
import { SheetParserService } from './sheet-parser.service';
import { SheetRow } from './xlsx-reader';
import { MEL } from '../regions/mel';
import centres from '../data/centres/mel.json';

const hints = MEL.sheetHints!;

/** Filas tal como salen del .xlsx real de Melilla, con sus rarezas. */
const rows: SheetRow[] = [
  { A: 'Número de vacantes de la primera adjudicación provisional de interinos para el curso 2026-2027' },
  { A: 'Centro Educativo', B: 'Especialidad', C: 'Vacantes' },
  { A: 'IES. Enrique Nieto', B: 'Filosofía (0590-001)', C: '1' },
  { A: 'IES. Enrique Nieto', B: 'Matemáticas (0590-006)', C: '4' },
  { A: 'CIFP. Reina Victoria Eugenia', B: 'Orientación Educativa (0590-018)', C: '0.5' },
  { A: 'IES. Rusadir', B: 'Equipos Electrónicos', C: '2' },
  { A: 'CEIP. España', B: 'Educación Primaria (0597-038)', C: '0' },
];

describe('Melilla (listado en hoja de cálculo)', () => {
  const parser = new SheetParserService();
  const parsed = parser.extractRows(rows, hints);

  it('encuentra la cabecera aunque no sea la primera fila', () => {
    // Encima va el título del listado, que no es una plaza.
    expect(parsed.some((r) => r.centre.startsWith('Número de vacantes'))).toBe(false);
  });

  it('expande el recuento a una plaza por vacante', () => {
    // 1 + 4 + media + 2, y la fila con 0 vacantes no da ninguna.
    expect(parsed).toHaveLength(8);
    expect(parsed.filter((r) => r.centre === 'IES. Enrique Nieto')).toHaveLength(5);
    expect(parsed.filter((r) => r.centre === 'CEIP. España')).toHaveLength(0);
  });

  it('cuenta la media plaza y avisa de que no es jornada entera', () => {
    const media = parsed.filter((r) => r.observations);

    expect(media).toHaveLength(1);
    expect(media[0].centre).toBe('CIFP. Reina Victoria Eugenia');
    expect(media[0].observations).toBe('0,5 de jornada');
  });

  it('saca el cuerpo y el código de dentro de la especialidad', () => {
    expect(parsed[0].modality).toBe('0590001 - Filosofía');
    // Hay especialidades que el listado escribe sin código.
    expect(parsed.find((r) => r.centre === 'IES. Rusadir')!.modality).toBe('Equipos Electrónicos');
  });

  it('pone el código de centro y la localidad, que el listado no trae', () => {
    expect(parsed[0].code).toBe('52000415');
    expect(parsed.every((r) => r.locality === 'Melilla')).toBe(true);
  });

  it('deja sin código el centro que no esté en la tabla, en vez de inventarlo', () => {
    const desconocido = parser.extractRows(
      [
        { A: 'Centro Educativo', B: 'Especialidad', C: 'Vacantes' },
        { A: 'IES. Que No Existe', B: 'Filosofía (0590-001)', C: '1' },
      ],
      hints,
    );

    expect(desconocido).toHaveLength(1);
    expect(desconocido[0].code).toBe('');
  });
});

describe('tabla de códigos de centro de Melilla', () => {
  it('todos los códigos existen en el directorio', () => {
    // La tabla se escribe a mano; si un código no está en el directorio, la
    // plaza se queda sin situar y no lo dice nadie.
    const known = new Set((centres as { code: string }[]).map((c) => c.code));
    const missing = Object.entries(hints.centreCodes)
      .filter(([, code]) => !known.has(code))
      .map(([name, code]) => `${name} -> ${code}`);

    expect(missing).toEqual([]);
  });

  it('no asigna el mismo centro a dos nombres', () => {
    const codes = Object.values(hints.centreCodes);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
