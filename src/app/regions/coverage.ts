import { Lang } from '../services/i18n.service';
import { RegionId } from './region.types';

/**
 * Estado de soporte de una administración educativa.
 *
 * - `stable`: verificada de principio a fin, con directorio de centros propio.
 * - `beta`: funciona sobre documentos reales, pero con alguna limitación.
 * - `manual-only`: el listado se parsea bien, pero su portal no deja
 *   descargarlo automáticamente; el docente sube el PDF a mano.
 * - `pending`: todavía no soportada. La nota dice qué falta.
 * - `blocked`: verificada y descartada por ahora, con un obstáculo concreto.
 */
export type CoverageStatus = 'stable' | 'beta' | 'manual-only' | 'pending' | 'blocked';

export interface RegionCoverage {
  /** Identificador de región, solo si está implementada. */
  id?: RegionId;
  name: Record<Lang, string>;
  status: CoverageStatus;
  /** Qué la limita o qué falta. Es lo que se muestra en la tabla. */
  note: Record<Lang, string>;
}

/**
 * Cobertura de las 17 comunidades autónomas y las 2 ciudades autónomas.
 *
 * Es la única fuente de verdad de lo que la aplicación soporta, y se muestra
 * tal cual en la portada.
 *
 * Las notas describen lo comprobado sobre los documentos oficiales reales de
 * cada administración, no lo que cabría esperar: varias comunidades que
 * parecían sencillas resultaron publicar sus vacantes en formatos muy
 * distintos, o directamente no publicarlas. Donde todavía pone "pendiente de
 * verificar" es que no se ha abierto ningún documento suyo, y por tanto no hay
 * nada que dar por sentado.
 */
export const COVERAGE: RegionCoverage[] = [
  {
    id: 'val',
    name: { ca: 'Comunitat Valenciana', es: 'Comunitat Valenciana' },
    status: 'stable',
    note: {
      ca: 'Llistat de vacants en PDF i directori complet de centres amb coordenades.',
      es: 'Listado de vacantes en PDF y directorio completo de centros con coordenadas.',
    },
  },
  {
    id: 'can',
    name: { ca: 'Canàries', es: 'Canarias' },
    status: 'beta',
    note: {
      ca: "Annex de vacants inicials. Alguns centres singulars —aules hospitalàries o penitenciàries— no són al directori i es queden sense situar.",
      es: 'Anexo de vacantes iniciales. Algunos centros singulares —aulas hospitalarias o penitenciarias— no están en el directorio y se quedan sin situar.',
    },
  },
  {
    id: 'clm',
    name: { ca: 'Castella-la Manxa', es: 'Castilla-La Mancha' },
    status: 'beta',
    note: {
      ca: 'No publica directori de centres, així que les distàncies es calculen al nucli del municipi, no a l\'edifici.',
      es: 'No publica directorio de centros, así que las distancias se calculan al núcleo del municipio, no al edificio.',
    },
  },
  {
    id: 'mur',
    name: { ca: 'Regió de Múrcia', es: 'Región de Murcia' },
    status: 'beta',
    note: {
      ca: 'Llistat de vacants per acte d\'adjudicació, i centres amb coordenades del Mapa Escolar.',
      es: 'Listado de vacantes por acto de adjudicación, y centros con coordenadas del Mapa Escolar.',
    },
  },
  {
    name: { ca: 'Galícia', es: 'Galicia' },
    status: 'blocked',
    note: {
      ca: 'No publica llistats de vacants: només participants i destinacions ja adjudicades. La tria de plaça es fa dins d\'una aplicació web.',
      es: 'No publica listados de vacantes: solo participantes y destinos ya adjudicados. La elección de plaza ocurre dentro de una aplicación web.',
    },
  },
  {
    name: { ca: 'Illes Balears', es: 'Illes Balears' },
    status: 'blocked',
    note: {
      ca: 'Les pàgines públiques d\'adjudicacions no contenen documents; el tràmit va per intranet amb autenticació.',
      es: 'Las páginas públicas de adjudicaciones no contienen documentos; el trámite va por intranet con autenticación.',
    },
  },
  {
    name: { ca: 'Andalusia', es: 'Andalucía' },
    status: 'blocked',
    note: {
      ca: "No publica cap document amb les vacants: només es poden consultar dins d'una aplicació web. Caldria una via d'entrada diferent de la de pujar un PDF.",
      es: 'No publica ningún documento con las vacantes: solo se pueden consultar dentro de una aplicación web. Haría falta una vía de entrada distinta a la de subir un PDF.',
    },
  },
  {
    id: 'ara',
    name: { ca: 'Aragó', es: 'Aragón' },
    status: 'manual-only',
    note: {
      ca: "Fitxes de vacant amb jornada, durada i causa, i directori de centres amb coordenades. El seu servidor no presenta la cadena completa del certificat, així que no es poden descarregar els PDF automàticament: cal pujar-los a mà.",
      es: 'Fichas de vacante con jornada, duración y causa, y directorio de centros con coordenadas. Su servidor no presenta la cadena completa del certificado, así que no se pueden descargar los PDF automáticamente: hay que subirlos a mano.',
    },
  },
  {
    name: { ca: 'Astúries', es: 'Asturias' },
    status: 'pending',
    note: {
      ca: "L'oferta setmanal es publica en obert, porta codi de centre i el servei cartogràfic del Principat en dona les coordenades. El que no publica com a document és l'adjudicació d'inici de curs, que és la que mou més places.",
      es: 'La oferta semanal se publica en abierto, trae código de centro y el servicio cartográfico del Principado da sus coordenadas. Lo que no publica como documento es la adjudicación de inicio de curso, que es la que mueve más plazas.',
    },
  },
  {
    id: 'cnt',
    name: { ca: 'Cantàbria', es: 'Cantabria' },
    status: 'beta',
    note: {
      ca: "Publica les vacants en obert i en un sol document, amb la taula girada com la de Múrcia. El codi del centre no té columna pròpia: va dins del codi del lloc. Les coordenades surten del cercador de centres oficial.",
      es: 'Publica las vacantes en abierto y en un solo documento, con la tabla girada como la de Murcia. El código del centro no tiene columna propia: va dentro del código del puesto. Las coordenadas salen del buscador de centros oficial.',
    },
  },
  {
    id: 'cyl',
    name: { ca: 'Castella i Lleó', es: 'Castilla y León' },
    status: 'beta',
    note: {
      ca: "Llistat AIVI de vacants, amb directori de centres amb coordenades.",
      es: 'Listado AIVI de vacantes, con directorio de centros con coordenadas.',
    },
  },
  {
    name: { ca: 'Catalunya', es: 'Cataluña' },
    status: 'blocked',
    note: {
      ca: "L'adjudicació d'estiu no publica cap llista de vacants: es demanen centres a cegues i el resultat només es veu amb identificació digital. L'únic que es publica són llistes marginals per servei territorial, cadascuna amb la seua maqueta.",
      es: 'La adjudicación de verano no publica ninguna lista de vacantes: se piden centros a ciegas y el resultado solo se ve con identificación digital. Lo único que se publica son listas marginales por servicio territorial, cada una con su maqueta.',
    },
  },
  {
    name: { ca: 'Extremadura', es: 'Extremadura' },
    status: 'pending',
    note: {
      ca: "Les vacants d'interinitats demanen identificació. L'única alternativa pública és la plantilla orgànica, que diu on hi ha lloc però no és la mateixa oferta, i que a més maqueta dos centres costat per costat a cada pàgina. Les coordenades dels centres sí que existeixen.",
      es: 'Las vacantes de interinidades piden identificación. La única alternativa pública es la plantilla orgánica, que dice dónde hay hueco pero no es la misma oferta, y que además maqueta dos centros lado a lado en cada página. Las coordenadas de los centros sí existen.',
    },
  },
  {
    id: 'mad',
    name: { ca: 'Madrid', es: 'Madrid' },
    status: 'beta',
    note: {
      ca: "Annex de vacants utilitzades en l'assignació, amb directori de centres complet.",
      es: 'Anexo de vacantes utilizadas en la asignación, con directorio de centros completo.',
    },
  },
  {
    name: { ca: 'Navarra', es: 'Navarra' },
    status: 'pending',
    note: {
      ca: "Publica les vacants sense demanar identificació i el seu directori de centres té coordenades. El llistat de mestres porta codi de centre i creua sencer; el de secundària no el porta, i encertar el centre pel nom és cosa que l'aplicació encara no sap fer.",
      es: 'Publica las vacantes sin pedir identificación y su directorio de centros tiene coordenadas. El listado de maestros trae código de centro y cruza entero; el de secundaria no lo trae, y acertar el centro por el nombre es algo que la aplicación todavía no sabe hacer.',
    },
  },
  {
    name: { ca: 'País Basc', es: 'País Vasco' },
    status: 'blocked',
    note: {
      ca: "Les vacants només es publiquen dins de Hezigunea, amb autenticació; la pròpia resolució oficial ho diu. El directori de centres sí que és utilitzable.",
      es: 'Las vacantes solo se publican dentro de Hezigunea, con autenticación; lo dice la propia resolución oficial. El directorio de centros sí es utilizable.',
    },
  },
  {
    id: 'rio',
    name: { ca: 'La Rioja', es: 'La Rioja' },
    status: 'manual-only',
    note: {
      ca: "Un sol document recull les vacants de tots els cossos, amb columnes ben alineades, i hi ha coordenades per als centres. El seu portal, però, bloqueja les descàrregues automàtiques: el PDF s'hauria de pujar a mà.",
      es: 'Un solo documento recoge las vacantes de todos los cuerpos, con columnas bien alineadas, y hay coordenadas para los centros. Su portal, en cambio, bloquea las descargas automáticas: el PDF habría que subirlo a mano.',
    },
  },
  {
    name: { ca: 'Ceuta', es: 'Ceuta' },
    status: 'pending',
    note: {
      ca: "Només publica l'adjudicació nominal, no les vacants, i el seu directori de centres no porta coordenades.",
      es: 'Solo publica la adjudicación nominal, no las vacantes, y su directorio de centros no lleva coordenadas.',
    },
  },
  {
    name: { ca: 'Melilla', es: 'Melilla' },
    status: 'pending',
    note: {
      ca: 'Sí publica vacants per centre i especialitat, però en forma de matriu. Falta un directori de centres amb coordenades.',
      es: 'Sí publica vacantes por centro y especialidad, pero en forma de matriz. Falta un directorio de centros con coordenadas.',
    },
  },
];

/** Cuántas administraciones hay en cada estado, para el resumen de la tabla. */
export function coverageSummary(): Record<CoverageStatus, number> {
  const summary: Record<CoverageStatus, number> = {
    stable: 0,
    beta: 0,
    'manual-only': 0,
    pending: 0,
    blocked: 0,
  };
  for (const entry of COVERAGE) summary[entry.status]++;
  return summary;
}
