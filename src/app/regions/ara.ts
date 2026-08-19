import { RegionConfig } from './region.types';

/**
 * Aragón.
 *
 * Comprobado sobre los listados reales del curso 2026/2027 (oferta semanal de
 * secundaria y vacantes no adjudicadas de maestros):
 *
 * - El listado no es una tabla, sino una ficha por plaza: cada una reimprime
 *   sus propios rótulos ("- Vacante -", "- Jornada -", "- Causa -"). De ahí la
 *   estrategia `records`, que Aragón estrena.
 * - El código del centro va entre paréntesis delante de su nombre, y coincide
 *   con el `idcentrorc` del directorio de Aragón Open Data, así que las
 *   coordenadas se cruzan directamente sin geocodificar.
 * - La ficha trae mucho más que el centro —jornada, duración, causa, horas
 *   lectivas, requisitos de perfil—, y todo eso acaba en las observaciones:
 *   para elegir plaza importa tanto dónde está como si es media jornada o una
 *   sustitución de tres semanas.
 * - El servidor de educa.aragon.es no envía la cadena completa de su
 *   certificado, así que la descarga automática falla en Node y en el proxy
 *   aunque el navegador la acepte. Por eso la región es `manual-only`: se
 *   enlaza el portal y el docente sube el PDF.
 */
export const ARA: RegionConfig = {
  id: 'ara',
  name: { ca: 'Aragó', es: 'Aragón' },
  authority: {
    ca: "el Departament d'Educació, Ciència i Universitats del Govern d'Aragó",
    es: 'el Departamento de Educación, Ciencia y Universidades del Gobierno de Aragón',
  },
  status: 'manual-only',

  geocodeSuffix: 'Aragón, Spain',
  mapBounds: [
    [39.8, -2.2],
    [42.95, 0.9],
  ],
  defaultOrigins: ['Zaragoza', 'Huesca', 'Teruel'],

  loadCentres: () => import('../data/centres/ara.json').then((m) => m.default),

  // La página de 'Oferta de Vacantes'; el slug lleva acentos y espacios, y sin
  // codificar devuelve 404.
  portalHubUrl: 'https://educa.aragon.es/-/Menu%20Provisi%C3%B3n%20Cobertura',

  parserHints: {
    strategy: 'records',
    records: {
      startMarker: 'Vacante',
      // Los rótulos van envueltos entre guiones, y el grupo captura el nombre.
      // Se escriben clases explícitas en vez de \s: esto es una cadena, y en un
      // literal JS un solo '\' delante de una letra se pierde sin dar error.
      labelPattern: '^-[ ]+(.+?)[ ]+-$',
      // El pie repite fecha y paginación dentro de la última ficha de la hoja.
      ignorePattern: 'P[aá]gina [0-9]+ de [0-9]+',
    },
  },
};
