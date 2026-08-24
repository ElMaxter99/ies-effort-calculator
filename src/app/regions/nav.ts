import { ParserHints } from '../services/pdf-parser.service';
import { RegionConfig } from './region.types';

/** Ruta del acto de adjudicación telemática, que lleva el curso en la URL. */
const ATPF_PATH =
  '/es/tramites/on/-/line/actos-de-adjudicacion-telematica-de-destinos-provisionales-en-practicas-' +
  'y-en-comision-de-servicios-al-personal-funcionario-docente-para-el-curso-2026-2027-atpf--1';

/**
 * Maqueta de maestros: una tabla con código de centro y las necesidades
 * repartidas en cuatro columnas —completas y horas sueltas, ordinarias e
 * itinerantes—.
 *
 * Las horas itinerantes no se leen: la columna existe pero está a cero en todo
 * el listado, y darle un rango obligaría a inventar cómo se combina con las
 * otras tres sin ningún caso real que lo respalde.
 */
const MAESTROS: ParserHints = {
  columnOverrides: {
    code: [10, 60],
    centre: [62, 290],
    locality: [292, 410],
    vacancies: [412, 436],
    hours: [438, 466],
    itinerantVacancies: [468, 492],
    observations: [516, 760],
  },
  // Toda plaza trae código; lo que no lo trae es la cabecera o el membrete.
  requireCode: true,
  mergeWrappedRows: true,
  expandVacancies: true,
  modalityLabel: 'ESPECIALIDAD/ESPEZIALITATEA',
};

/**
 * Maqueta de secundaria, conservatorio y artes: no hay columna de código y la
 * localidad va pegada al nombre del centro ("I.E.S. SIERRA LEYRE- SANGUESA").
 *
 * Sin código, la plaza se sitúa por su localidad, así que la distancia sale al
 * núcleo del municipio y no al edificio.
 */
const SECUNDARIA: ParserHints = {
  columnOverrides: {
    centre: [25, 250],
    vacancies: [252, 300],
    hours: [302, 330],
    observations: [332, 460],
  },
  splitLocalityFromCentre: true,
  mergeWrappedRows: true,
  expandVacancies: true,
  modalityLabel: 'ESPECIALIDAD',
  // Los rótulos del bloque ocupan la columna del centro ellos solos, así que
  // sin apartarlos se unirían a la plaza anterior como si la continuaran.
  ignoreRowPattern: '^(CUERPO|C[ÓO]DIGO|TOTAL|NECESIDADES DE PROFESORADO|CENTRO COMPLETAS)',
};

/**
 * Comunidad Foral de Navarra.
 *
 * Publica las vacantes en abierto, pero en dos maquetas que no se parecen: la
 * de maestros es una tabla con código de centro, y la de secundaria no lo trae
 * y pega la localidad al nombre. Como el docente sube una u otra sin decir
 * cuál, la maqueta se reconoce al abrir el documento.
 *
 * Ambas cuentan las necesidades en lugar de repetir una fila por plaza, y
 * separan las jornadas completas de las horas sueltas: un centro con 0
 * completas y 15 horas sigue ofreciendo una plaza, solo que parcial.
 */
export const NAV: RegionConfig = {
  id: 'nav',
  name: { ca: 'Navarra', es: 'Navarra', eu: 'Nafarroa', gl: 'Navarra', oc: 'Navarra' },
  authority: {
    ca: "el Departament d'Educació del Govern de Navarra",
    es: 'el Departamento de Educación del Gobierno de Navarra',
    eu: 'Nafarroako Gobernuko Hezkuntza Departamentua',
    gl: 'o Departamento de Educación do Goberno de Navarra',
    oc: "eth Departament d'Educacion deth Govèrn de Navarra",
  },
  status: 'beta',

  geocodeSuffix: 'Navarra, Spain',
  mapBounds: [
    [41.9, -2.55],
    [43.35, -0.7],
  ],
  defaultOrigins: ['PAMPLONA', 'TUDELA', 'ESTELLA'],

  loadCentres: () => import('../data/centres/nav.json').then((m) => m.default),

  portalHubUrl: `https://tramitespersonal.navarra.es${ATPF_PATH}`,

  officialSource: {
    proxyPath: '/api/nav',
    baseUrl: 'https://tramitespersonal.navarra.es',
    pages: [
      { cos: 'secundaria', path: ATPF_PATH, match: 'vacantes.+(secundaria|conservatorio)' },
      { cos: 'primaria', path: ATPF_PATH, match: 'vacantes.+maestros' },
    ],
  },

  parserHints: {
    ...SECUNDARIA,
    // "Espezialitatea" solo lo imprime la maqueta de maestros, que es bilingüe.
    variants: [{ marker: 'ESPEZIALITATEA', hints: MAESTROS }],
  },
};
