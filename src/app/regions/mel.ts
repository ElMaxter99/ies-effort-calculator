import { SheetHints } from '../services/sheet-parser.service';
import { RegionConfig } from './region.types';

/**
 * Correspondencia entre el nombre con que el listado llama a cada centro y su
 * código en el Registro Estatal de Centros Docentes.
 *
 * Se escribe entera, y no se deduce, por dos razones comprobadas sobre el
 * listado real: el registro guarda nombres más largos que los del listado
 * ("ANSELMO PARDO ALCAIDE" frente a "Anselmo Pardo") y hay dos centros que se
 * llaman igual —"Virgen de la Victoria" es a la vez un instituto y una escuela
 * infantil—, de modo que solo el tipo los distingue. Las 25 entradas están
 * verificadas una a una contra el registro.
 */
const CENTRE_CODES: Record<string, string> = {
  'CEA. Carmen Conde Abellán': '52000646',
  'CEE. Reina Sofía': '52004743',
  'CEIP. Anselmo Pardo': '52000051',
  'CEIP. Constitución': '52000634',
  'CEIP. Encarna León': '52004871',
  'CEIP. España': '52000014',
  'CEIP. Hipódromo': '52000725',
  'CEIP. Juan Caro Romero': '52000038',
  'CEIP. León Solá': '52000361',
  'CEIP. Mediterráneo': '52000351',
  'CEIP. Pedro de Estopiñán': '52004809',
  'CEIP. Pintor Eduardo Morillas': '52004780',
  'CEIP. Real': '52000041',
  'CEIP. Reyes Católicos': '52000063',
  'CEIP. Velázquez': '52000026',
  'CIFP. Reina Victoria Eugenia': '52000403',
  Conservatorio: '52000506',
  'EA. Miguel Marmolejo': '52000373',
  'Escuela Oficial de Idiomas': '52000610',
  'IES. Enrique Nieto': '52000415',
  'IES. Juan Antonio Fernández': '52000661',
  'IES. Leopoldo Queipo': '52000397',
  'IES. Miguel Fernández': '52000658',
  'IES. Rusadir': '52000701',
  'IES. Virgen de la Victoria': '52000211',
};

const SHEET: SheetHints = {
  columns: { centre: 'Centro Educativo', modality: 'Especialidad', vacancies: 'Vacantes' },
  centreCodes: CENTRE_CODES,
  // Melilla es una sola ciudad: el listado no gasta una columna en repetirlo.
  locality: 'Melilla',
};

/** Página de la adjudicación, que lleva el curso en la ruta. */
const VACANTES_PATH =
  '/contenidos/ba/ceuta-melilla/melilla/portada/recursos-humanos/interinos/' +
  'adjudicacion-vacantes-26-27.html';

/**
 * Ciudad Autónoma de Melilla.
 *
 * Es la única administración que no publica sus vacantes en PDF: desde el curso
 * 2026-2027 las da en una hoja de cálculo con tres columnas —centro,
 * especialidad y número de vacantes—. Hasta 2025-2026 eran cuatro tablas en un
 * PDF, con las cabeceras giradas y una matriz por tipo de enseñanza.
 *
 * Su educación depende del ministerio, no de una consejería, y ni el ministerio
 * ni la ciudad publican un directorio de centros con coordenadas: las de este
 * dataset salen de geocodificar los domicilios del Registro Estatal de Centros
 * contra CartoCiudad del IGN.
 */
export const MEL: RegionConfig = {
  id: 'mel',
  name: { ca: 'Melilla', es: 'Melilla' },
  authority: {
    ca: "la Direcció Provincial del Ministeri d'Educació a Melilla",
    es: 'la Dirección Provincial del Ministerio de Educación en Melilla',
  },
  status: 'beta',

  geocodeSuffix: 'Melilla, Spain',
  mapBounds: [
    [35.26, -2.99],
    [35.33, -2.91],
  ],
  defaultOrigins: ['Melilla'],

  loadCentres: () => import('../data/centres/mel.json').then((m) => m.default),

  portalHubUrl: `https://www.educacionfpydeportes.gob.es${VACANTES_PATH}`,

  officialSource: {
    proxyPath: '/api/mel',
    baseUrl: 'https://www.educacionfpydeportes.gob.es',
    // Los ficheros cuelgan de una ruta con un identificador que cambia en cada
    // publicación, así que no se puede fijar su URL: hay que rastrear la página.
    documentPattern: '/dam/jcr:',
    pages: [
      // Un solo listado para todos los cuerpos: en la misma hoja van los
      // colegios y los institutos.
      { cos: 'secundaria', path: VACANTES_PATH, match: 'vacantes.+[.]xlsx' },
      { cos: 'primaria', path: VACANTES_PATH, match: 'vacantes.+[.]xlsx' },
    ],
  },

  sheetHints: SHEET,
};
