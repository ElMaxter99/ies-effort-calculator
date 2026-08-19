import { CentreRecord, Cos, LocalityRecord } from '../types';
import { Lang } from '../services/i18n.service';
import { ParserHints } from '../services/pdf-parser.service';

/**
 * Identificador de comunidad autónoma. Se usa como clave de configuración, de
 * dataset, de caché y de ruta de proxy, así que conviene que sea corto y
 * estable: cambiarlo invalida las cachés de los usuarios.
 */
export type RegionId =
  | 'val' // Comunitat Valenciana
  | 'clm' // Castilla-La Mancha
  | 'gal' // Galicia
  | 'can' // Canarias
  | 'bal' // Illes Balears
  | 'mur' // Región de Murcia
  | 'cyl' // Castilla y León
  | 'mad' // Comunidad de Madrid
  | 'ara' // Aragón
  | 'rio' // La Rioja
  | 'cnt' // Cantabria
  | 'ast' // Principado de Asturias
  | 'nav' // Comunidad Foral de Navarra
  | 'ext'; // Extremadura

/**
 * Hasta dónde llega el soporte de una comunidad.
 *
 * - `stable`: parser validado con un PDF oficial real y dataset de centros propio.
 * - `beta`: funciona, pero sin validar a fondo; se avisa al usuario.
 * - `manual-only`: sin auto-descarga (portal cerrado, con login o anti-bot);
 *   el usuario tiene que subir el PDF a mano.
 */
export type RegionStatus = 'stable' | 'beta' | 'manual-only';

/** Página de un portal oficial donde buscar enlaces a PDFs de vacantes. */
export interface OfficialSourcePage {
  cos: Cos;
  path: string;
  /** Ancla el rastreo a un contenedor concreto, si el portal lo permite. */
  contentId?: string;
  /**
   * Expresión regular (como texto) para quedarse solo con los enlaces
   * relevantes. Hace falta cuando una misma página publica los documentos de
   * todos los cuerpos y trámites mezclados: Castilla-La Mancha cuelga más de
   * cien PDFs (calendarios, actas, adjudicaciones) en una sola página.
   *
   * Se prueba contra el rótulo del enlace y contra su URL.
   */
  match?: string;
}

/** Cómo descubrir automáticamente los PDFs oficiales de una comunidad. */
export interface OfficialSource {
  /** Prefijo de proxy, que debe existir en vercel.json y proxy.conf.json. */
  proxyPath: string;
  /** Origen real, para resolver los href relativos que devuelve el portal. */
  baseUrl: string;
  pages: OfficialSourcePage[];
}

export interface RegionConfig {
  id: RegionId;
  name: Record<Lang, string>;
  /** Administración que publica los listados, tal como se cita en la interfaz. */
  authority: Record<Lang, string>;
  status: RegionStatus;

  /** Sufijo que se añade a las consultas de geocodificación para desambiguar. */
  geocodeSuffix: string;

  /** Encuadre inicial del mapa: [[sur, oeste], [norte, este]]. */
  mapBounds: [[number, number], [number, number]];

  /** Orígenes propuestos al empezar (nombres de localidad de la comunidad). */
  defaultOrigins: string[];

  /**
   * Carga diferida del dataset de centros: solo se descarga su región.
   *
   * Opcional: hay comunidades que no publican ningún directorio descargable
   * (Castilla-La Mancha). Sin dataset, las coordenadas se resuelven
   * geocodificando la localidad que trae el propio listado.
   */
  loadCentres?: () => Promise<CentreRecord[]>;

  /**
   * Carga diferida de los municipios de la comunidad con su centroide.
   *
   * Solo hace falta cuando no hay directorio de centros: da coordenadas a
   * nivel de municipio, suficiente para estimar el esfuerzo del
   * desplazamiento, y evita geocodificar en tiempo real contra Nominatim.
   */
  loadLocalities?: () => Promise<LocalityRecord[]>;

  /** Portal oficial al que enviar al usuario cuando no hay auto-descarga. */
  portalHubUrl: string;

  officialSource?: OfficialSource;
  parserHints?: ParserHints;
}
