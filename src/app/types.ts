/** Cuerpo docente al que corresponde un listado de vacantes. */
export type Cos = 'secundaria' | 'primaria';

/** Enlace a un PDF oficial descubierto en el portal de una administración. */
export interface OfficialPdfLink {
  label: string;
  url: string;
}

/** Centro educativo ya geolocalizado, tal como se guarda en los datasets. */
export interface CentreRecord {
  code: string;
  name: string;
  locality: string;
  lat: number;
  lng: number;
}

/**
 * Municipio geolocalizado por su centroide.
 *
 * Es el recurso de última instancia para las comunidades que no publican un
 * directorio de centros: sitúa la plaza en su municipio, no en su edificio.
 */
export interface LocalityRecord {
  /** Código INE del municipio. */
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export interface IesRow {
  number: number;
  centre: string;
  locality: string;
  code: string;
  locationCode: string;
  observations: string;
  isItinerant?: boolean;
  itinerantCentre?: string;
  hours?: string;
  modality?: string;
}

export interface EffortThresholds {
  baix: number;
  moderat: number;
  alt: number;
}

export interface RouteData {
  distanceKm: number;
  durationMin: number;
}

export interface IesCenter {
  code: string;
  name: string;
  locality: string;
  coordinates?: { lat: number; lng: number };
  positions: IesRow[];
  distanceKm?: number;
  effortLevel?: string;
  totalItinerants?: number;
  modalities?: string[];
  route?: Partial<Record<TransportMode, RouteData>>;
}

export interface ProcessInfo {
  currentPage: number;
  totalPages: number;
  percentage: number;
  message: string;
}

export type EffortLevel = 'baix' | 'moderat' | 'alt' | 'molt alt';

export type TransportMode = 'car' | 'public' | 'walking' | 'bicycle';

export interface Origin {
  id: string;
  name: string;
  coordinates?: { lat: number; lng: number };
}
