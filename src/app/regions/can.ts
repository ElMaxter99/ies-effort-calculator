import { RegionConfig } from './region.types';

/**
 * Canarias.
 *
 * Es la comunidad que más se parece a la Comunitat Valenciana: publica un
 * "Anexo II Vacantes Iniciales" en tabla plana. Pero con tres particularidades,
 * comprobadas sobre el anexo real del curso 2026/2027:
 *
 * - Los recuentos van 3 pt por encima del nombre del centro, así que la
 *   tolerancia de fila por defecto los separaría en filas distintas.
 * - El código y el nombre comparten celda ("35000082 IES Joaquín Artiles").
 * - No hay columna de localidad, y la fila indica cuántas vacantes hay en el
 *   centro en lugar de repetirse. La localidad sale del directorio de centros,
 *   que sí la trae y comparte el código de 8 dígitos.
 *
 * La cabecera (CENTRO | COMP. | PLANT. | OCUP. | VAC.) solo tiene dos rótulos
 * que el diccionario reconozca, por debajo del mínimo que exige la detección
 * automática, así que se declaran las columnas explícitamente.
 */
export const CAN: RegionConfig = {
  id: 'can',
  name: { ca: 'Canàries', es: 'Canarias' },
  authority: {
    ca: "la Conselleria d'Educació del Govern de Canàries",
    es: 'la Consejería de Educación del Gobierno de Canarias',
  },
  status: 'beta',

  geocodeSuffix: 'Canarias, Spain',
  mapBounds: [
    [27.5, -18.3],
    [29.5, -13.3],
  ],
  defaultOrigins: ['LAS PALMAS DE GRAN CANARIA', 'SANTA CRUZ DE TENERIFE', 'ARRECIFE'],

  loadCentres: () => import('../data/centres/can.json').then((m) => m.default),

  portalHubUrl:
    'https://www.gobiernodecanarias.org/educacion/web/personal/docente/procedimientos/adjudicacion-destinos/',

  officialSource: {
    proxyPath: '/api/can',
    baseUrl: 'https://www.gobiernodecanarias.org',
    pages: [
      {
        cos: 'secundaria',
        path:
          '/educacion/web/personal/docente/procedimientos/adjudicacion-destinos/' +
          'maestros-secundaria-restocuerpos/2026-27/listado-definitivo-cuerpo-secundaria-resto-cuerpos/',
        match: '^(?=.*vac)(?=.*secun)',
      },
      {
        cos: 'primaria',
        path:
          '/educacion/web/personal/docente/procedimientos/adjudicacion-destinos/' +
          'maestros-secundaria-restocuerpos/2026-27/listado_definitivo_cuerpo_maestros/',
        match: '^(?=.*vac)(?=.*(maestro|prim))',
      },
    ],
  },

  parserHints: {
    rowTolerance: 4,
    splitCodeFromCentre: true,
    expandVacancies: true,
    // "201 Filosofía": código de especialidad de tres cifras y su nombre.
    // Clases explícitas, no \d: esto es una cadena y '\d' se colapsaría a 'd'.
    modalityPattern: '^[0-9]{3}[ ]+[^0-9]{3,}$',
    columnOverrides: {
      // Los datos empiezan en x=45; los títulos del anexo caen en x>=200.
      centre: [35, 150],
      vacancies: [520, 545],
    },
  },
};
