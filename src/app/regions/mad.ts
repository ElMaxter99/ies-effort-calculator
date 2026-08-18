import { RegionConfig } from './region.types';

/**
 * Comunidad de Madrid.
 *
 * Publica un "Anexo. Vacantes utilizadas en la asignación" en tabla plana, con
 * cabecera "Centro | Localidad | Especialidad | Vacantes | Tipo". El código y
 * el nombre del centro van en columnas contiguas bajo el mismo rótulo, así que
 * se capturan juntos y se separan después.
 *
 * Las columnas se declaran a mano en lugar de detectar la cabecera para que la
 * columna "Tipo" —un código de dos cifras— no se confunda con el recuento de
 * vacantes, que está justo al lado.
 */
export const MAD: RegionConfig = {
  id: 'mad',
  name: { ca: 'Madrid', es: 'Madrid' },
  authority: {
    ca: "la Conselleria d'Educació de la Comunitat de Madrid",
    es: 'la Consejería de Educación de la Comunidad de Madrid',
  },
  status: 'beta',

  geocodeSuffix: 'Comunidad de Madrid, Spain',
  mapBounds: [
    [39.8, -4.7],
    [41.3, -3.0],
  ],
  defaultOrigins: ['Madrid', 'Alcalá de Henares', 'Getafe'],

  loadCentres: () => import('../data/centres/mad.json').then((m) => m.default),

  portalHubUrl: 'https://sede.comunidad.madrid/oferta-empleo/puestos-docentes-profesores-2026',

  officialSource: {
    proxyPath: '/api/mad',
    baseUrl: 'https://sede.comunidad.madrid',
    pages: [
      { cos: 'secundaria', path: '/oferta-empleo/puestos-docentes-profesores-2026', match: 'vacante' },
      { cos: 'primaria', path: '/oferta-empleo/puestos-docentes-maestros-2026', match: 'vacante' },
    ],
  },

  parserHints: {
    splitCodeFromCentre: true,
    expandVacancies: true,
    columnOverrides: {
      centre: [15, 290],
      locality: [295, 450],
      modality: [455, 700],
      vacancies: [710, 760],
    },
  },
};
