import { Injectable } from '@angular/core';
import { IesRow } from '../types';
import { readSheet, SheetRow } from './xlsx-reader';

/**
 * Cómo está montada la hoja de cálculo de vacantes de una comunidad.
 *
 * Va aparte de `ParserHints` porque no comparte nada con ella: en un PDF hay
 * que deducir las columnas de las coordenadas de cada letra, y aquí las columnas
 * vienen dadas y basta con decir cómo se llaman.
 */
export interface SheetHints {
  /** Rótulos de la cabecera, tal como los escribe el listado. */
  columns: { centre: string; modality: string; vacancies: string };
  /**
   * Código de centro por su nombre en el listado.
   *
   * El listado nombra los centros a su manera ("IES. Enrique Nieto") y el
   * registro oficial a la suya ("ENRIQUE NIETO"), y hay dos centros distintos
   * que comparten nombre y solo se distinguen por el tipo, así que la
   * correspondencia se escribe entera en lugar de adivinarla.
   */
  centreCodes: Record<string, string>;
  /** Localidad de todas las plazas, cuando el listado no trae columna. */
  locality?: string;
}

/** Compara rótulos sin depender de mayúsculas, acentos ni espacios de más. */
function labelKey(text: string): string {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/**
 * Lee un listado de vacantes publicado como hoja de cálculo.
 *
 * Melilla dejó el PDF en el curso 2026-2027 y pasó a publicar una tabla plana
 * —centro, especialidad y número de vacantes—, que es el formato más limpio de
 * todo el proyecto: no hay que deducir columnas de coordenadas ni recomponer
 * nombres partidos en dos líneas.
 */
@Injectable({ providedIn: 'root' })
export class SheetParserService {
  async parseSheet(file: File, hints: SheetHints): Promise<IesRow[]> {
    // Sin barra de progreso: son un par de cientos de filas y se leen de golpe,
    // al contrario que un PDF de mil páginas.
    return this.extractRows(await readSheet(file), hints);
  }

  /**
   * Función pura, para poder ejercitarla con filas sintéticas.
   *
   * La cabecera no está en la primera fila —encima va el título del listado—,
   * así que se busca la fila que trae los tres rótulos.
   */
  extractRows(rows: SheetRow[], hints: SheetHints): IesRow[] {
    const wanted = {
      centre: labelKey(hints.columns.centre),
      modality: labelKey(hints.columns.modality),
      vacancies: labelKey(hints.columns.vacancies),
    };

    let columns: { centre: string; modality: string; vacancies: string } | null = null;
    const out: IesRow[] = [];

    for (const row of rows) {
      if (!columns) {
        const found: Record<string, string> = {};
        for (const [letter, value] of Object.entries(row)) {
          for (const [field, label] of Object.entries(wanted)) {
            if (labelKey(value) === label) found[field] = letter;
          }
        }
        if (found['centre'] && found['modality'] && found['vacancies']) {
          columns = found as { centre: string; modality: string; vacancies: string };
        }
        continue;
      }

      const centre = (row[columns.centre] ?? '').trim();
      const modality = (row[columns.modality] ?? '').trim();
      const count = parseFloat((row[columns.vacancies] ?? '').replace(',', '.'));
      if (!centre || !modality || !Number.isFinite(count) || count <= 0) continue;

      const code = hints.centreCodes[centre] ?? '';
      const whole = Math.floor(count);

      for (let i = 0; i < whole; i++) {
        out.push(this.row(out.length + 1, centre, code, modality, hints, ''));
      }

      // Media plaza es una plaza compartida con otro centro, no media persona:
      // se cuenta, pero avisando de que no es jornada entera.
      if (count > whole) {
        const fraction = String(count - whole).replace('.', ',');
        out.push(this.row(out.length + 1, centre, code, modality, hints, fraction));
      }
    }

    return out;
  }

  private row(
    number: number,
    centre: string,
    code: string,
    modality: string,
    hints: SheetHints,
    fraction: string,
  ): IesRow {
    // "Filosofía (0590-001)" -> "0590001 - Filosofía". Hay especialidades sin
    // código, y entonces se queda el nombre a secas.
    const parsed = /^(.*?)\s*\(+\s*([0-9]{4})-([A-Za-z0-9]+)\)?\s*$/.exec(modality);

    return {
      number,
      centre,
      locality: hints.locality ?? '',
      code,
      locationCode: '',
      observations: fraction ? `${fraction} de jornada` : '',
      isItinerant: false,
      modality: parsed ? `${parsed[2]}${parsed[3]} - ${parsed[1].trim()}` : modality,
    };
  }
}
