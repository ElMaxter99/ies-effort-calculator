import { RegionConfig } from './region.types';

/**
 * Comunitat Valenciana — la comunidad original de la aplicación.
 *
 * Sus PDFs sí traen cabecera reconocible ("NUM. | LLOC | LOCALITAT / LOCALIDAD
 * | CENTRE / CENTRO | CODI | ITIN. | OBSERVACIONS"), así que no necesita
 * columnOverrides: la detección automática la resuelve.
 */
export const VAL: RegionConfig = {
  id: 'val',
  name: { ca: 'Comunitat Valenciana', es: 'Comunitat Valenciana' },
  authority: {
    ca: "la Conselleria d'Educació de la Generalitat Valenciana",
    es: "la Conselleria d'Educació de la Generalitat Valenciana",
  },
  status: 'stable',

  geocodeSuffix: 'Comunitat Valenciana, Spain',
  mapBounds: [
    [37.8, -1.6],
    [40.8, 0.7],
  ],
  defaultOrigins: ['València', 'Castelló de la Plana', 'Alacant'],

  loadCentres: () => import('../data/centres/val.json').then((m) => m.default),

  portalHubUrl: 'https://ceice.gva.es/va/web/rrhh-educacion',

  officialSource: {
    proxyPath: '/api/val',
    baseUrl: 'https://ceice.gva.es',
    pages: [
      { cos: 'secundaria', path: '/va/web/rrhh-educacion/vacantes1', contentId: '393689004' },
      { cos: 'primaria', path: '/va/web/rrhh-educacion/plazas', contentId: '162946306' },
    ],
  },

  parserHints: {
    // La GVA marca las plazas itinerantes con un glifo (ü) en su propia fila.
    itinerantMarkers: true,
  },
};
