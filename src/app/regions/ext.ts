import { RegionConfig } from './region.types';

/**
 * Extremadura.
 *
 * Alcance: esto es la **plantilla orgánica**, no la oferta de interinidades.
 * Las vacantes de las adjudicaciones se consultan dentro de PROFEX, con
 * identificación, y no se publican como documento. La plantilla sí dice, centro
 * a centro y especialidad a especialidad, cuántos puestos hay ("Pl") y cuántos
 * están vacantes ("Va"); esos últimos son los que se leen aquí.
 *
 * La maqueta reparte dos centros por página, uno al lado del otro, con dos
 * hilos de bloques que no se hablan entre sí. Cada bloque se abre con la
 * localidad y el código del centro, sin ningún rótulo que lo anuncie.
 *
 * El mismo ajuste vale para los dos documentos —maestros y resto de cuerpos—:
 * solo se diferencian en que el de maestros marca las especialidades
 * itinerantes con un código que empieza por "IT" y añade sub-bloques de
 * itinerancia que cierran la subtabla.
 */
export const EXT: RegionConfig = {
  id: 'ext',
  name: { ca: 'Extremadura', es: 'Extremadura', eu: 'Extremadura', gl: 'Estremadura', oc: 'Extremadura' },
  authority: {
    ca: "la Conselleria d'Educació de la Junta d'Extremadura",
    es: 'la Consejería de Educación de la Junta de Extremadura',
    eu: 'Extremadurako Juntako Hezkuntza Kontseilaritza',
    gl: 'a Consellería de Educación da Xunta de Estremadura',
    oc: "era Conselharia d'Educacion dera Junta d'Extremadura",
  },
  status: 'beta',

  geocodeSuffix: 'Extremadura, Spain',
  mapBounds: [
    [37.9, -7.6],
    [40.5, -4.6],
  ],
  defaultOrigins: ['BADAJOZ', 'CÁCERES', 'MÉRIDA'],

  loadCentres: () => import('../data/centres/ext.json').then((m) => m.default),

  portalHubUrl: 'https://profex.educarex.es/plantillas/plantilla-organica',

  officialSource: {
    proxyPath: '/api/ext',
    baseUrl: 'https://profex.educarex.es',
    pages: [
      {
        cos: 'secundaria',
        path: '/plantillas/plantilla-organica',
        // La misma página cuelga la versión provisional y la definitiva, y sus
        // rótulos son la resolución entera: hay que distinguirlas por la ruta.
        match: 'res.def.+secundaria',
      },
      { cos: 'primaria', path: '/plantillas/plantilla-organica', match: 'res.def.+maestros' },
    ],
  },

  parserHints: {
    strategy: 'blocks',
    // Los dos centros de cada página se separan antes de agrupar las filas.
    panelSplitX: 293,
    // Los recuentos van hasta 2 pt por encima del nombre de su especialidad.
    rowTolerance: 4,
    ignoreRowPattern: '^(ANEXO|INSTITUTOS DE|COLEGIOS|PROVINCIA|PLANTILLA ORG)',
    blocks: {
      // Los códigos de centro empiezan por la provincia; los de especialidad,
      // que también son de ocho cifras, empiezan por ceros o por "IT".
      centrePattern: '^(06|10)[0-9]{6}$',
      itemHeader: 'Especialidad',
      vacancyHeader: 'Va',
      localityAbove: true,
      itinerantPattern: '^IT',
      // Los sub-bloques de itinerancia se rotulan "Itinera hacia:" en unos
      // centros y "Itinera desde:" en otros, y ambos cierran la subtabla.
      totalMarker: 'Itinera',
    },
  },
};
