import { RegionConfig, RegionId } from './region.types';
import { VAL } from './val';
import { CLM } from './clm';
import { CAN } from './can';
import { MUR } from './mur';

/**
 * Comunidades soportadas.
 *
 * Añadir una nueva debería ser: crear su fichero de configuración, registrarlo
 * aquí, generar su dataset con `node scripts/build-centres.mjs <id>` y añadir
 * su ruta de proxy en vercel.json y proxy.conf.json.
 */
export const REGIONS: Record<RegionId, RegionConfig> = {
  val: VAL,
  clm: CLM,
  can: CAN,
  mur: MUR,
} as Record<RegionId, RegionConfig>;

/** Región por defecto cuando el usuario aún no ha elegido ninguna. */
export const DEFAULT_REGION_ID: RegionId = 'val';

/** Regiones disponibles, para poblar el selector. */
export function availableRegions(): RegionConfig[] {
  return Object.values(REGIONS);
}

export function isRegionId(value: string | null): value is RegionId {
  return !!value && value in REGIONS;
}
