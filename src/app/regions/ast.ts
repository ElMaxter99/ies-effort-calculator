import { RegionConfig } from './region.types';

/**
 * Principado de Asturias.
 *
 * Su listado va agrupado por centro, pero sin ningún rótulo que abra el
 * bloque: lo abre el propio código del centro, con el concejo y la localidad
 * en la fila de encima. Debajo, una subtabla con una fila por plaza.
 *
 * El documento es uno solo para todos los cuerpos —maestros, secundaria y
 * FP van mezclados—, así que los dos botones de descarga llevan al mismo
 * sitio.
 *
 * Alcance: esto es la oferta de plazas que se publica antes de cada
 * adjudicación semanal, no la adjudicación de inicio de curso, que Asturias no
 * publica como documento sino dentro de una consulta web.
 */
export const AST: RegionConfig = {
  id: 'ast',
  name: { ca: 'Astúries', es: 'Asturias', eu: 'Asturias', gl: 'Asturias', oc: 'Asturies' },
  authority: {
    ca: "la Conselleria d'Educació del Principat d'Astúries",
    es: 'la Consejería de Educación del Principado de Asturias',
    eu: 'Asturiasko Printzerriko Hezkuntza Kontseilaritza',
    gl: 'a Consellería de Educación do Principado de Asturias',
    oc: "era Conselharia d'Educacion deth Principat d'Asturies",
  },
  status: 'beta',

  geocodeSuffix: 'Asturias, Spain',
  mapBounds: [
    [42.85, -7.25],
    [43.72, -4.45],
  ],
  defaultOrigins: ['OVIEDO', 'GIJÓN', 'AVILÉS'],

  loadCentres: () => import('../data/centres/ast.json').then((m) => m.default),

  portalHubUrl: 'https://www.educastur.es/profesorado/funcion-publica-interina/convocatoria-adjudicacion',

  officialSource: {
    proxyPath: '/api/ast',
    baseUrl: 'https://www.educastur.es',
    pages: [
      {
        cos: 'secundaria',
        path: '/profesorado/funcion-publica-interina/convocatoria-adjudicacion',
        // La misma página guarda la convocatoria de 2021, rotulada "documento
        // PDF de oferta de plazas"; anclar el rótulo deja fuera esa y cualquier
        // otra que solo mencione la oferta de pasada.
        match: '^oferta de plazas',
      },
      {
        cos: 'primaria',
        path: '/profesorado/funcion-publica-interina/convocatoria-adjudicacion',
        match: '^oferta de plazas',
      },
    ],
  },

  parserHints: {
    strategy: 'blocks',
    blocks: {
      centrePattern: '^[0-9]{8}$',
      itemHeader: 'Código',
      totalMarker: 'Por centro hay',
      localityAbove: true,
    },
  },
};
