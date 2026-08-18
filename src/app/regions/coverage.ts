import { Lang } from '../services/i18n.service';
import { RegionId } from './region.types';

/**
 * Estado de soporte de una administración educativa.
 *
 * - `stable`: verificada de principio a fin, con directorio de centros propio.
 * - `beta`: funciona sobre documentos reales, pero con alguna limitación.
 * - `pending`: todavía no soportada. La nota dice qué falta.
 * - `blocked`: verificada y descartada por ahora, con un obstáculo concreto.
 */
export type CoverageStatus = 'stable' | 'beta' | 'pending' | 'blocked';

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
    name: { ca: 'Aragó', es: 'Aragón' },
    status: 'pending',
    note: { ca: 'Pendent de verificar.', es: 'Pendiente de verificar.' },
  },
  {
    name: { ca: 'Astúries', es: 'Asturias' },
    status: 'pending',
    note: {
      ca: "El llistat de vacants sí és parsejable i porta codi de centre, però el seu directori de centres està darrere d'un accés autenticat: caldria una altra font de coordenades.",
      es: 'El listado de vacantes sí es parseable y trae código de centro, pero su directorio de centros está detrás de un acceso autenticado: haría falta otra fuente de coordenadas.',
    },
  },
  {
    name: { ca: 'Cantàbria', es: 'Cantabria' },
    status: 'pending',
    note: {
      ca: "El llistat no porta codi de centre, i el 'directori de centres' oficial resulta ser estadística per municipi. Caldria creuar per nom i localitat.",
      es: "El listado no trae código de centro, y el 'directorio de centros' oficial resulta ser estadística por municipio. Habría que cruzar por nombre y localidad.",
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
    status: 'pending',
    note: {
      ca: "Publica vacants, però repartides en tres circuits amb tres maquetes diferents i cap cobreix totes les places. La consulta de resultats demana identificació digital.",
      es: 'Publica vacantes, pero repartidas en tres circuitos con tres maquetas distintas y ninguno cubre todas las plazas. La consulta de resultados pide identificación digital.',
    },
  },
  {
    name: { ca: 'Extremadura', es: 'Extremadura' },
    status: 'pending',
    note: { ca: 'Pendent de verificar.', es: 'Pendiente de verificar.' },
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
    note: { ca: 'Pendent de verificar.', es: 'Pendiente de verificar.' },
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
    name: { ca: 'La Rioja', es: 'La Rioja' },
    status: 'pending',
    note: { ca: 'Pendent de verificar.', es: 'Pendiente de verificar.' },
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
  const summary: Record<CoverageStatus, number> = { stable: 0, beta: 0, pending: 0, blocked: 0 };
  for (const entry of COVERAGE) summary[entry.status]++;
  return summary;
}
