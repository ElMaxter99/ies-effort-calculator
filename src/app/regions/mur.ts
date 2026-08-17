import { RegionConfig } from './region.types';

/**
 * Región de Murcia.
 *
 * Su listado de vacantes es una tabla girada: cada plaza es una *columna* y
 * cada campo una *fila*, con el rótulo a la izquierda ("Cod. Centro",
 * "Nombre Centro", "Localidad", "Función"). Además imprime dos paneles por
 * página, "Vacantes de PLANTILLA" y "Vacantes de SUSTITUCIÓN", cada uno con su
 * propia columna de rótulos.
 *
 * Los listados se publican colgados de cada acto de adjudicación telemático,
 * con URLs de descarga que llevan un IDCONTENIDO distinto cada vez, así que la
 * auto-descarga rastrea la página del acto en lugar de guardar una URL fija.
 */
export const MUR: RegionConfig = {
  id: 'mur',
  name: { ca: 'Regió de Múrcia', es: 'Región de Murcia' },
  authority: {
    ca: "la Conselleria d'Educació de la Regió de Múrcia",
    es: 'la Consejería de Educación de la Región de Murcia',
  },
  status: 'beta',

  geocodeSuffix: 'Región de Murcia, Spain',
  mapBounds: [
    [37.3, -2.4],
    [38.8, -0.6],
  ],
  defaultOrigins: ['MURCIA', 'CARTAGENA', 'LORCA'],

  loadCentres: () => import('../data/centres/mur.json').then((m) => m.default),

  portalHubUrl: 'https://rrhheducacion.carm.es/servicio-de-personal-docente/',

  officialSource: {
    proxyPath: '/api/mur',
    baseUrl: 'https://rrhheducacion.carm.es',
    pages: [
      {
        cos: 'secundaria',
        path: '/category/direccion-general-de-recursos-humanos-y-riesgos-laborales/servicio-de-personal-docente/',
        match: '^(?=.*vacantes)(?=.*(sec|eoi))',
      },
      {
        cos: 'primaria',
        path: '/category/direccion-general-de-recursos-humanos-y-riesgos-laborales/servicio-de-personal-docente/',
        match: '^(?=.*vacantes)(?=.*(maestro|prim))',
      },
    ],
  },

  parserHints: {
    strategy: 'transposed',
    transposedGap: 25,
  },
};
