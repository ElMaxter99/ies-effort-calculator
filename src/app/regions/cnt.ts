import { RegionConfig } from './region.types';

/**
 * Cantabria.
 *
 * Comprobado sobre los listados definitivos del curso 2026/2027:
 *
 * - La tabla está girada, como la de Murcia: cada columna es una plaza y cada
 *   fila un campo, con su rótulo a la izquierda.
 * - No hay columna de código de centro. El código va dentro del código del
 *   puesto ("C39011441 0590007 0N004"), y hay que sacarlo de ahí: el nombre
 *   del centro se imprime abreviado y sin el tipo ("FORAMONTANOS", no "IES
 *   Foramontanos"), así que cruzar por nombre sería frágil.
 * - Cada hoja encabeza con "Especialidad:" o "Centro:" el valor que vale para
 *   todas sus plazas, y lo imprime en una fila suelta aparte. De ahí el
 *   `transposedCaption`.
 * - Publica el mismo contenido dos veces, ordenado por especialidad y por
 *   centro; cualquiera de los dos sirve.
 * - Es uniprovincial, así que no hay desglose territorial: un fichero por
 *   cuerpo.
 */
export const CNT: RegionConfig = {
  id: 'cnt',
  name: { ca: 'Cantàbria', es: 'Cantabria' },
  authority: {
    ca: "la Conselleria d'Educació, FP i Universitats de Cantàbria",
    es: 'la Consejería de Educación, FP y Universidades de Cantabria',
  },
  status: 'beta',

  geocodeSuffix: 'Cantabria, Spain',
  mapBounds: [
    [42.7, -4.9],
    [43.55, -3.1],
  ],
  defaultOrigins: ['Santander', 'Torrelavega', 'Castro Urdiales'],

  loadCentres: () => import('../data/centres/cnt.json').then((m) => m.default),

  portalHubUrl: 'https://www.educantabria.es/profesorado/interinos',

  officialSource: {
    proxyPath: '/api/cnt',
    baseUrl: 'https://www.educantabria.es',
    // Los listados cuelgan de una URL amistosa sin extensión.
    documentPattern: '/documents/d/',
    pages: [
      {
        cos: 'secundaria',
        // El rótulo del enlace cambia con cada revisión del listado
        // ("MODIFICACIÓN 11 DE AGOSTO VACANTES..."), así que hay que rastrear
        // la página en vez de fijar la URL.
        //
        // El filtro va contra la ruta y no contra el rótulo a propósito: el
        // rótulo lleva acentos ("PRÁCTICAS") y la comparación no los ignora,
        // así que descartar por él dejaba pasar las plazas de funcionariado en
        // prácticas, que no son de interinos.
        path: '/profesorado/interinos',
        match: 'vacantes-resto-de-cuerpos-interinos',
      },
      {
        cos: 'primaria',
        // La misma página cuelga el manual de ayuda para solicitarlas, cuyo
        // nombre también menciona las vacantes.
        path: '/profesorado/interinos',
        match: '^(?=.*vacantes-maestros)(?!.*practica)(?!.*manual)',
      },
    ],
  },

  parserHints: {
    strategy: 'transposed',
    // Las plazas distan 28 pt y una línea continuada se desplaza 11, así que
    // 20 separa plazas sin partir un valor largo en dos.
    transposedGap: 20,
    transposedCaption: true,
    // El código del puesto es el único valor que hay una vez por plaza y que
    // nunca se parte en dos líneas, así que es de donde salen las columnas.
    transposedAnchorField: 'locationCode',
    codeFromLocationCode: '^[A-Z]([0-9]{8})',
  },
};
