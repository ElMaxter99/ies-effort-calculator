import { RegionConfig } from './region.types';

/**
 * La Rioja.
 *
 * Comprobado sobre el listado real del curso 2026/2027 ("Destinos vacantes por
 * cuerpos-especialidades", 263 páginas):
 *
 * - Un único documento recoge TODOS los cuerpos, maestros incluidos, así que
 *   no hay separación por cuerpo ni por provincia: la comunidad es
 *   uniprovincial y publica un solo fichero.
 * - La rejilla de columnas es fija en las 263 páginas, pero su cabecera no se
 *   puede detectar: rotula dos veces "Localidad" y dos veces "Centro" —el
 *   código y el nombre de cada uno—, y la columna "N" de plaza no afín se
 *   confundiría con un número de orden. Por eso van rangos X explícitos.
 * - El código de centro lleva letra de control ("26003507C"); el parser se
 *   queda con la parte numérica, que es la que usa el directorio.
 * - La itinerancia va en columna propia, marcada con una "I", y NO se repite
 *   en las observaciones: hay plazas itinerantes cuya observación solo dice
 *   con qué centro se comparte.
 * - Cada plaza va seguida de una fila de detalle ("Horario:", "Prev Fin:",
 *   "Causa:") que no lleva código y que `requireCode` descarta.
 * - El portal está tras un desafío de Cloudflare que no se resuelve con
 *   cabeceras, así que no hay descarga automática: la región es `manual-only`.
 */
export const RIO: RegionConfig = {
  id: 'rio',
  name: { ca: 'La Rioja', es: 'La Rioja' },
  authority: {
    ca: "la Conselleria d'Educació i Ocupació del Govern de La Rioja",
    es: 'la Consejería de Educación y Empleo del Gobierno de La Rioja',
  },
  status: 'manual-only',

  geocodeSuffix: 'La Rioja, Spain',
  mapBounds: [
    [41.9, -3.2],
    [42.7, -1.6],
  ],
  defaultOrigins: ['Logroño', 'Calahorra', 'Haro'],

  loadCentres: () => import('../data/centres/rio.json').then((m) => m.default),

  portalHubUrl:
    'https://www.larioja.org/edu-recursos-humanos/es/destinos-comienzo-curso-1478a5/adjudicacion-destinos-provisionales',

  parserHints: {
    // Los rangos son estrechos a propósito: "I" (199), "N" (212) y "B" (226)
    // distan trece puntos, y ensancharlos mezclaría itinerancia con bilingüismo.
    columnOverrides: {
      code: [80, 100],
      itinerant: [195, 205],
      locality: [242, 300],
      centre: [430, 560],
      observations: [610, 780],
    },
    requireCode: true,
    modalityLabel: 'Especialidad',
  },
};
