import { RegionConfig } from './region.types';

/**
 * Castilla-La Mancha.
 *
 * Diferencias respecto a la Comunitat Valenciana, comprobadas sobre PDFs
 * reales del curso 2026/2027:
 *
 * - El listado NO es una tabla plana, sino bloques por centro con una subtabla
 *   de especialidades ("Vacantes" / "Vacantes It."). Por eso usa la estrategia
 *   `grouped`. La maqueta es idéntica en Ciudad Real y en Toledo, así que la
 *   genera un mismo sistema para las cinco provincias.
 * - Cada provincia (Albacete, Ciudad Real, Cuenca, Guadalajara, Toledo)
 *   publica sus propios ficheros, y además se separan por cuerpo (0590, 0592,
 *   0594...). Un docente descarga el de su provincia y su cuerpo.
 * - NO existe dataset de centros descargable: el único recurso publicado en
 *   Datos Abiertos CLM es un buscador HTML, y el portal ArcGIS de la Junta no
 *   incluye centros educativos. Las coordenadas salen de geocodificar la
 *   localidad, que el propio listado sí trae.
 */
export const CLM: RegionConfig = {
  id: 'clm',
  name: { ca: 'Castella-la Manxa', es: 'Castilla-La Mancha' },
  authority: {
    ca: 'la Conselleria d\'Educació, Cultura i Esports de Castella-la Manxa',
    es: 'la Consejería de Educación, Cultura y Deportes de Castilla-La Mancha',
  },
  status: 'beta',

  geocodeSuffix: 'Castilla-La Mancha, Spain',
  mapBounds: [
    [38.0, -5.4],
    [41.4, -0.9],
  ],
  defaultOrigins: ['Toledo', 'Albacete', 'Ciudad Real'],

  // No hay directorio de centros, así que se sitúan por municipio: capa
  // oficial "Municipios" de la JCCM, con el núcleo de población del IGN.
  loadLocalities: () => import('../data/localities/clm.json').then((m) => m.default),

  portalHubUrl: 'https://educacion.castillalamancha.es/profesorado/gestiones-y-tramites',

  officialSource: {
    proxyPath: '/api/clm',
    baseUrl: 'https://educacion.castillalamancha.es',
    pages: [
      {
        cos: 'secundaria',
        // Una sola página publica los PDFs de las cinco provincias y de todos
        // los cuerpos; hay que quedarse con las vacantes de enseñanzas medias.
        // Se usan clases explícitas [0-9] en vez de \d: esto es una cadena, y
        // en un literal JS '\d' se colapsa a 'd'.
        path: '/profesorado/gestiones-y-tramites/asignaciones-de-profesorado-curso-20262027',
        match: '^(?=.*vacante)(?!.*maestro)(?=.*(eemm|secundaria|cuerpo 0|05[0-9]{2}))',
      },
      {
        cos: 'primaria',
        path: '/profesorado/gestiones-y-tramites/asignaciones-de-profesorado-curso-20262027',
        match: '^(?=.*vacante)(?=.*(maestro|primaria))',
      },
    ],
  },

  parserHints: {
    strategy: 'grouped',
    grouped: {
      centreMarker: 'Centro',
      itemHeader: 'Función - Especialidad',
      totalMarker: 'Total',
      provinceMarker: 'Provincia',
    },
  },
};
