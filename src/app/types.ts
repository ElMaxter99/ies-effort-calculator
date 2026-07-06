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
