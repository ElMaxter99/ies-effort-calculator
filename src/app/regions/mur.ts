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
 * No hay descarga automática. Los listados no cuelgan de ninguna página índice:
 * cada acto de adjudicación telemático publica los suyos dentro de su propia
 * entrada, en otro dominio (carm.es) y con enlaces sin rótulo, un icono por
 * toda pista. Rastrear eso pediría seguir dos saltos y adivinar qué documento
 * es cuál, así que el docente abre el acto y sube el PDF.
 */
export const MUR: RegionConfig = {
  id: 'mur',
  name: { ca: 'Regió de Múrcia', es: 'Región de Murcia', eu: 'Murtziako Eskualdea', gl: 'Rexión de Murcia', oc: 'Region de Murcia' },
  authority: {
    ca: "la Conselleria d'Educació de la Regió de Múrcia",
    es: 'la Consejería de Educación de la Región de Murcia',
    eu: 'Murtziako Eskualdeko Hezkuntza Kontseilaritza',
    gl: 'a Consellería de Educación da Rexión de Murcia',
    oc: "era Conselharia d'Educacion dera Region de Murcia",
  },
  status: 'manual-only',

  geocodeSuffix: 'Región de Murcia, Spain',
  mapBounds: [
    [37.3, -2.4],
    [38.8, -0.6],
  ],
  defaultOrigins: ['MURCIA', 'CARTAGENA', 'LORCA'],

  loadCentres: () => import('../data/centres/mur.json').then((m) => m.default),

  portalHubUrl: 'https://rrhheducacion.carm.es/servicio-de-personal-docente/',

  parserHints: {
    strategy: 'transposed',
    transposedGap: 25,
  },
};
