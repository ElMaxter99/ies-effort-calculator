import { Injectable, signal, computed } from '@angular/core';
import esES from '../locales/es-ES.json';
import caES from '../locales/ca-ES.json';
import euES from '../locales/eu-ES.json';
import glES from '../locales/gl-ES.json';
import ocES from '../locales/oc-ES.json';

export type Lang = 'ca' | 'es' | 'eu' | 'gl' | 'oc';

/** Idiomas disponibles en el selector, en el orden en que se muestran. */
export const AVAILABLE_LANGS: { id: Lang; label: string }[] = [
  { id: 'es', label: 'Castellano' },
  { id: 'ca', label: 'Català' },
  { id: 'eu', label: 'Euskera' },
  { id: 'gl', label: 'Galego' },
  { id: 'oc', label: 'Occitan (Aranés)' },
];

export interface I18nTranslations {
  appTitle: string;
  landingDescription: string;
  processingPDF: string;
  dropPDF: string;
  validPDFOnly: string;
  orTrySample: string;
  loadSample: string;
  interactiveMap: string;
  dataTable: string;
  distanceCalculation: string;

  heroTitle: string;
  heroDescription: string;
  ctaStart: string;
  howItWorks: string;
  features: string;
  navStatus: string;
  howItWorksTitle: string;
  howItWorksDesc: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  featuresTitle: string;
  feature1Title: string;
  feature1Desc: string;
  feature2Title: string;
  feature2Desc: string;
  feature3Title: string;
  feature3Desc: string;
  feature4Title: string;
  feature4Desc: string;
  uploadTitle: string;
  uploadDesc: string;
  dropPrompt: string;
  dropHint: string;
  dropHintSheet: string;
  footerCopyright: string;
  footerPrivacy: string;
  footerTerms: string;

  selectModalities: string;
  selectModalitiesDesc: string;
  searchModality: string;
  noResults: string;
  stepModalities: string;
  stepOrigin: string;
  stepDestinations: string;
  stepSummary: string;
  configTitle: string;
  configSubtitle: string;

  back: string;
  continue: string;
  cancel: string;

  addOrigin: string;
  addOriginDesc: string;
  enterLocation: string;
  calculate: string;

  uploadPDF: string;
  resetProcess: string;
  views: string;
  dataConfig: string;
  map: string;
  table: string;
  splitView: string;
  comparisonOrigins: string;
  addNewOrigin: string;
  effortLegend: string;
  low: string;
  moderate: string;
  high: string;
  veryHigh: string;
  km: string;
  filterByName: string;
  all: string;
  filterByLocality: string;
  filterByModality: string;
  showOnlyItinerant: string;
  showOnlyObservations: string;
  modeCar: string;
  modePublic: string;
  modeWalking: string;
  modeBicycle: string;
  timeEstimate: string;
  transport: string;
  modality: string;
  ies: string;
  locality: string;
  distance: string;
  effort: string;
  itin: string;
  addOriginPrompt: string;
  uploadPDFPrompt: string;
  total: string;
  centres: string;
  name: string;
  exportCSV: string;
  origin: string;
  notSelected: string;
  useSamplePDF: string;
  zoomIn: string;
  zoomOut: string;
  help: string;
  langToggle: string;
  collapseSidebar: string;
  expandSidebar: string;
  filters: string;

  selectAtLeastOneModality: string;
  addComparisonOrigin: string;
  dropValidPDF: string;
  selectValidPDF: string;
  errorProcessingPDF: (msg: string) => string;
  errorLoadingPDF: (msg: string) => string;
  errorTitle: string;
  errorPDFFormat: string;
  errorNoValidRows: string;
  couldNotGeocode: (name: string) => string;

  processingPage: (page: number, total: number) => string;
  completeRows: (n: number) => string;

  geocodingOrigin: string;
  geocodingLocalities: string;
  geocodingProgress: (current: number, total: number) => string;
  geocodingComplete: (total: number) => string;
  calculatingForCentres: (n: number) => string;
  calculatingProgress: (i: number, n: number, name: string) => string;
  geocodingNew: (n: number) => string;

  routingProgress: (current: number, total: number) => string;
  positionsInCentres: (positions: number, centres: number) => string;
  itinerantCount: (n: number) => string;
  totalCentres: (n: number) => string;
  itinerantPositions: (n: number) => string;

  levelLabelBaix: string;
  levelLabelModerat: string;
  levelLabelAlt: string;
  levelLabelMoltAlt: string;
  levelLabelUnknown: string;
  levelDescBaix: (km: number) => string;
  levelDescModerat: (baix: number, moderat: number) => string;
  levelDescAlt: (moderat: number, alt: number) => string;
  levelDescMoltAlt: (alt: number) => string;

  pdfProcessingMessage: (page: number, total: number) => string;
  filterLocalitiesPlaceholder: string;
  regionDisclaimer: (region: string) => string;
  regionSelectorLabel: string;
  regionSelectorHint: string;
  regionCoverageLink: (total: number) => string;
  regionManualOnlyNotice: string;
  coverageTitle: string;
  coverageIntro: string;
  coverageColRegion: string;
  coverageColStatus: string;
  coverageColNote: string;
  coverageStable: string;
  coverageBeta: string;
  coverageManualOnly: string;
  coveragePending: string;
  coverageBlocked: string;
  coverageSummary: (working: number, total: number) => string;
  pdfFormatHint: (authority: string) => string;
  secundariaPdfLabel: string;
  primariaPdfLabel: string;
  officialPdfsEmpty: string;
  officialPdfsVerifyNotice: string;
  openPortalFallback: (authority: string) => string;
  openPortal: (authority: string) => string;
  sampleFileDisclaimer: string;
  selectAll: string;
  deselectAll: string;
  termsTitle: string;
  termsUpdated: string;
  privacyTitle: string;
  privacyUpdated: string;
  sourceTitle: string;
  sourceUpdated: string;
  sourceIntro: string;
  sourceWhatTitle: string;
  sourceWhatBody: (authority: string) => string;
  sourcePublisherTitle: string;
  sourcePublisherBody: (authority: string) => string;
  sourceStaleWarningTitle: string;
  sourceStaleWarning: string;
  sourceCtaLabel: (authority: string) => string;
  backToHome: string;
  observationsTitle: string;
  close: string;
  confirmReset: string;

  termsNatureTitle: string;
  termsNatureBody: string;
  termsNatureNotice: (authority: string) => string;
  termsPrivacyTitle: string;
  termsPrivacyCard1Title: string;
  termsPrivacyCard1Desc: string;
  termsPrivacyCard2Title: string;
  termsPrivacyCard2Desc: string;
  termsReliabilityTitle: string;
  termsReliabilityIntro: string;
  termsReliabilityLi1: string;
  termsReliabilityLi2: string;
  termsResponsibilityTitle: string;
  termsResponsibilityLabel: string;
  termsResponsibilityDesc: string;

  privacyTransparencyTitle: string;
  privacyTransparencyBody: string;
  privacyLocalTitle: string;
  privacyLocalBody: string;
  privacyLocalLi1: string;
  privacyLocalLi2: string;
  privacyTrackingTitle: string;
  privacyTrackingBody: string;
  privacyDataOriginTitle: string;
  privacyDataOriginBody: string;
  privacyStep1: string;
  privacyStep2: string;
  privacyStep3: string;

  viewItinerary: string;
  itineraryTitle: string;
  route: string;
  destination: string;
  metrics: string;
  openInGoogleMaps: string;
  minutes: string;
  arrivalAtDestination: string;

  stepRegion: string;
  stepLevel: string;
  stepFile: string;
  searchingPortal: string;
  viewFile: string;
  useThisFile: string;
  orUploadManually: string;
}

/**
 * Forma cruda de un fichero locales/<lang>-ES.json: todas las claves son
 * strings planos, incluidas las que en `I18nTranslations` son funciones (ahí
 * llevan el texto con placeholders `{param}` en lugar del valor ya
 * interpolado). El propio tipado de TypeScript exige que el JSON importado
 * tenga las 221 claves de la interfaz: si falta una, no compila.
 */
type I18nRaw = { [K in keyof I18nTranslations]: string };

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => (key in params ? String(params[key]) : match));
}

/** Convierte el diccionario plano del JSON en las traducciones tipadas, reconstruyendo las funciones con placeholders. */
function buildTranslations(raw: I18nRaw): I18nTranslations {
  return {
    ...raw,
    errorProcessingPDF: (msg) => interpolate(raw.errorProcessingPDF, { msg }),
    errorLoadingPDF: (msg) => interpolate(raw.errorLoadingPDF, { msg }),
    couldNotGeocode: (name) => interpolate(raw.couldNotGeocode, { name }),
    processingPage: (page, total) => interpolate(raw.processingPage, { page, total }),
    completeRows: (n) => interpolate(raw.completeRows, { n }),
    geocodingProgress: (current, total) => interpolate(raw.geocodingProgress, { current, total }),
    geocodingComplete: (total) => interpolate(raw.geocodingComplete, { total }),
    calculatingForCentres: (n) => interpolate(raw.calculatingForCentres, { n }),
    calculatingProgress: (i, n, name) => interpolate(raw.calculatingProgress, { i, n, name }),
    geocodingNew: (n) => interpolate(raw.geocodingNew, { n }),
    routingProgress: (current, total) => interpolate(raw.routingProgress, { current, total }),
    positionsInCentres: (positions, centres) => interpolate(raw.positionsInCentres, { positions, centres }),
    itinerantCount: (n) => interpolate(raw.itinerantCount, { n }),
    totalCentres: (n) => interpolate(raw.totalCentres, { n }),
    itinerantPositions: (n) => interpolate(raw.itinerantPositions, { n }),
    levelDescBaix: (km) => interpolate(raw.levelDescBaix, { km }),
    levelDescModerat: (baix, moderat) => interpolate(raw.levelDescModerat, { baix, moderat }),
    levelDescAlt: (moderat, alt) => interpolate(raw.levelDescAlt, { moderat, alt }),
    levelDescMoltAlt: (alt) => interpolate(raw.levelDescMoltAlt, { alt }),
    pdfProcessingMessage: (page, total) => interpolate(raw.pdfProcessingMessage, { page, total }),
    regionDisclaimer: (region) => interpolate(raw.regionDisclaimer, { region }),
    regionCoverageLink: (total) => interpolate(raw.regionCoverageLink, { total }),
    coverageSummary: (working, total) => interpolate(raw.coverageSummary, { working, total }),
    pdfFormatHint: (authority) => interpolate(raw.pdfFormatHint, { authority }),
    sourceWhatBody: (authority) => interpolate(raw.sourceWhatBody, { authority }),
    sourcePublisherBody: (authority) => interpolate(raw.sourcePublisherBody, { authority }),
    sourceCtaLabel: (authority) => interpolate(raw.sourceCtaLabel, { authority }),
    termsNatureNotice: (authority) => interpolate(raw.termsNatureNotice, { authority }),
    openPortalFallback: (authority) => interpolate(raw.openPortalFallback, { authority }),
    openPortal: (authority) => interpolate(raw.openPortal, { authority }),
  };
}

const TRANSLATIONS: Record<Lang, I18nTranslations> = {
  es: buildTranslations(esES as I18nRaw),
  ca: buildTranslations(caES as I18nRaw),
  eu: buildTranslations(euES as I18nRaw),
  gl: buildTranslations(glES as I18nRaw),
  oc: buildTranslations(ocES as I18nRaw),
};

@Injectable({ providedIn: 'root' })
export class I18nService {
  private static readonly LANG_KEY = 'ies_lang';

  /** Castellano por defecto; si el usuario ya eligió idioma, se recuerda. */
  private static loadLang(): Lang {
    try {
      const saved = localStorage.getItem(I18nService.LANG_KEY);
      if (saved && AVAILABLE_LANGS.some((l) => l.id === saved)) return saved as Lang;
    } catch {
      // localStorage bloqueado (modo privado): se queda en el idioma por defecto.
    }
    return 'es';
  }

  lang = signal<Lang>(I18nService.loadLang());

  setLang(lang: Lang) {
    this.lang.set(lang);
    try {
      localStorage.setItem(I18nService.LANG_KEY, lang);
    } catch {
      // Sin persistencia disponible: el idioma vale para esta sesión.
    }
  }

  t = computed(() => TRANSLATIONS[this.lang()]);
}
