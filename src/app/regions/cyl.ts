import { RegionConfig } from './region.types';

/**
 * Castilla y León.
 *
 * Su listado (AIVI) no es una tabla con cabecera, sino bloques con los rótulos
 * en línea. Cada plaza ocupa tres filas y solo la primera trae los datos que
 * interesan:
 *
 *     Especialidad: 001  FILOSOFIA
 *     Loc.  092090011  MEDINA DE POMAR    Centro:  09003605  IES CASTELLA VETULA
 *     Provincia: 09   Nº Vacante: 14138   Horas Contrato: 10
 *     Tipo Vacante: PARCIAL
 *
 * Por eso se declaran las columnas a mano y se exige código de centro: así las
 * dos filas de detalle se descartan en lugar de colarse como plazas fantasma.
 * La especialidad se arrastra desde su rótulo hasta el siguiente.
 */
export const CYL: RegionConfig = {
  id: 'cyl',
  name: { ca: 'Castella i Lleó', es: 'Castilla y León' },
  authority: {
    ca: "la Conselleria d'Educació de la Junta de Castella i Lleó",
    es: 'la Consejería de Educación de la Junta de Castilla y León',
  },
  status: 'beta',

  geocodeSuffix: 'Castilla y León, Spain',
  mapBounds: [
    [39.8, -7.1],
    [43.3, -1.7],
  ],
  defaultOrigins: ['VALLADOLID', 'BURGOS', 'SALAMANCA'],

  loadCentres: () => import('../data/centres/cyl.json').then((m) => m.default),

  portalHubUrl: 'https://www.educa.jcyl.es/profesorado/es/interinos',

  officialSource: {
    proxyPath: '/api/cyl',
    baseUrl: 'https://www.educa.jcyl.es',
    pages: [
      {
        cos: 'secundaria',
        path:
          '/profesorado/es/interinos/interinos-cuerpo-profesores-ensenanza-secundaria-cuerpos/' +
          'interinos-pes-cuerpos-curso-2026-2027/interinos-curso-2026-2027-aivi-aisi-aisi-semanal/' +
          'interinos-pes-cuerpos-curso-2026-2027-aivi/interinos-pes-cuerpos-curso-2026-2027-aivi-vacantes',
        match: '^(?=.*vacantes)(?!.*manual)',
      },
      {
        cos: 'primaria',
        path:
          '/profesorado/es/interinos/interinos-cuerpo-maestros/' +
          'maestros-interinos-curso-2026-2027-aivi-aisi-aisi-semanal/' +
          'maestros-interinos-curso-2026-2027-aivi-vacantes',
        match: '^(?=.*vacantes)(?!.*manual)',
      },
    ],
  },

  parserHints: {
    requireCode: true,
    modalityLabel: 'Especialidad:',
    columnOverrides: {
      locationCode: [50, 70],
      locality: [110, 260],
      code: [305, 340],
      centre: [350, 470],
    },
  },
};
