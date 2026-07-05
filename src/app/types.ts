export interface IesRow {
  num: number;
  centre: string;
  localitat: string;
  codiCentre: string;
  codiLloc: string;
  observacions: string;
  itinerant?: boolean;
  centreItinerant?: string;
  hores?: string;
  modalitat?: string;
}

export interface EffortThresholds {
  baix: number;
  moderat: number;
  alt: number;
}

export interface IesCenter {
  codiCentre: string;
  nom: string;
  localitat: string;
  coordenades?: { lat: number; lng: number };
  places: IesRow[];
  distanciaKm?: number;
  nivellEsforc?: string;
  totalItinerants?: number;
  modalitats?: string[];
}

export interface ProcesInfo {
  paginaActual: number;
  totalPagines: number;
  percentatge: number;
  missatge: string;
}

export type NivellEsforc = 'baix' | 'moderat' | 'alt' | 'molt alt';

export interface Origen {
  id: string;
  nom: string;
  coordenades?: { lat: number; lng: number };
}
