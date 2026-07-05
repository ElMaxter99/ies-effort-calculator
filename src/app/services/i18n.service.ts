import { Injectable, signal, computed } from '@angular/core';

export type Lang = 'ca' | 'es';

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

  selectModalities: string;
  selectModalitiesDesc: string;
  searchModality: string;
  noResults: string;

  back: string;
  continue: string;

  addOrigin: string;
  addOriginDesc: string;
  enterLocation: string;
  calculate: string;

  uploadPDF: string;
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

  selectAtLeastOneModality: string;
  addComparisonOrigin: string;
  dropValidPDF: string;
  selectValidPDF: string;
  errorProcessingPDF: (msg: string) => string;
  errorLoadingPDF: (msg: string) => string;
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
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  lang = signal<Lang>('ca');

  toggleLang() {
    this.lang.update(l => l === 'ca' ? 'es' : 'ca');
  }

  t = computed(() => this.lang() === 'ca' ? CA : ES);
}

const CA: I18nTranslations = {
  appTitle: 'Calculador d\'Esforç de Desplaçament IES',
  landingDescription: 'Puja el fitxer PDF de vacants per a visualitzar en un mapa interactiu la ubicació dels centres educatius i calcular la distància i l\'esforç de desplaçament des dels teus orígens.',
  processingPDF: 'Processant PDF...',
  dropPDF: 'Deixa anar el PDF ací o fes clic per a seleccionar',
  validPDFOnly: 'Només fitxers PDF vàlids',
  orTrySample: 'o prova amb un fitxer d\'exemple',
  loadSample: 'Carregar PDF d\'exemple',
  interactiveMap: 'Mapa interactiu',
  dataTable: 'Taula de dades',
  distanceCalculation: 'Càlcul de distància',

  selectModalities: 'Selecciona modalitats',
  selectModalitiesDesc: 'Tria les modalitats que t\'interessen per a filtrar les places disponibles.',
  searchModality: 'Buscar modalitat...',
  noResults: 'Sense resultats',

  back: 'Tornar',
  continue: 'Continuar',

  addOrigin: 'Afig el teu origen',
  addOriginDesc: 'Introdueix la teua ubicació per a calcular distàncies i nivells d\'esforç cap als centres seleccionats.',
  enterLocation: 'Introdueix una ubicació (p. ex. Alacant)',
  calculate: 'Calcular',

  uploadPDF: 'Pujar PDF',
  views: 'Vistes',
  dataConfig: 'Configuració de dades',
  map: 'Mapa',
  table: 'Taula',
  splitView: 'Vista dividida',
  comparisonOrigins: 'Orígens de comparació',
  addNewOrigin: 'Afegir nou origen...',
  effortLegend: 'Llegenda d\'esforç',
  low: 'Baix',
  moderate: 'Moderat',
  high: 'Alt',
  veryHigh: 'Molt Alt',
  km: 'km',
  filterByName: 'Filtrar centres per nom o localitat...',
  all: 'Totes',
  filterByLocality: 'Filtrar per localitat...',
  filterByModality: 'Filtrar per modalitat...',
  showOnlyItinerant: 'Mostrar només itinerants',
  modality: 'Modalitat',
  ies: 'IES',
  locality: 'Localitat',
  distance: 'Distància',
  effort: 'Esforç',
  itin: 'ITIN',
  addOriginPrompt: 'Afig un origen al panell lateral per a calcular distàncies.',
  uploadPDFPrompt: 'Puja un PDF per a començar.',
  total: 'Total',
  centres: 'centres',
  name: 'Nom',
  exportCSV: 'Exportar CSV',
  origin: 'Origen',
  notSelected: 'No seleccionat',
  useSamplePDF: 'Utilitzar PDF d\'exemple',
  zoomIn: 'Ampliar',
  zoomOut: 'Reduir',
  help: 'Ajuda',
  langToggle: 'Castellano',

  selectAtLeastOneModality: 'Selecciona almenys una modalitat',
  addComparisonOrigin: 'Afig un origen de comparació',
  dropValidPDF: 'Deixa anar un fitxer PDF vàlid',
  selectValidPDF: 'Selecciona un fitxer PDF vàlid',
  errorProcessingPDF: (msg: string) => `Error en processar el PDF: ${msg}`,
  errorLoadingPDF: (msg: string) => `Error en carregar el PDF: ${msg}`,
  couldNotGeocode: (name: string) => `No s'ha pogut geocodificar "${name}". Prova amb un nom de municipi.`,

  processingPage: (page: number, total: number) => `Processant pàgina ${page} de ${total}...`,
  completeRows: (n: number) => `Completat! ${n} files processades.`,

  geocodingOrigin: 'Geocodificant origen...',
  geocodingLocalities: 'Geocodificant centres...',
  geocodingProgress: (current: number, total: number) => `Geocodificant ${current} de ${total} centres...`,
  geocodingComplete: (total: number) => `Geocodificació completa (${total} centres)`,
  calculatingForCentres: (n: number) => `Calculant distàncies per a ${n} centres...`,
  calculatingProgress: (i: number, n: number, name: string) => `Calculant distància: ${name} (${i}/${n})`,
  geocodingNew: (n: number) => `Geocodificant ${n} nous centres...`,

  positionsInCentres: (positions: number, centres: number) => `${positions} places en ${centres} centres`,
  itinerantCount: (n: number) => `(${n} itinerant)`,
  totalCentres: (n: number) => `Total: ${n} centres`,
  itinerantPositions: (n: number) => `${n} plaça/és itinerant/s`,

  levelLabelBaix: 'Baix',
  levelLabelModerat: 'Moderat',
  levelLabelAlt: 'Alt',
  levelLabelMoltAlt: 'Molt Alt',
  levelLabelUnknown: 'Desconegut',
  levelDescBaix: (km: number) => `< ${km} km - Desplaçament còmode`,
  levelDescModerat: (baix: number, moderat: number) => `${baix}-${moderat} km - Desplaçament raonable`,
  levelDescAlt: (moderat: number, alt: number) => `${moderat}-${alt} km - Desplaçament llarg`,
  levelDescMoltAlt: (alt: number) => `> ${alt} km - Desplaçament molt llarg`,

  pdfProcessingMessage: (page: number, total: number) => `Processant pàgina ${page} de ${total}...`,
  filterLocalitiesPlaceholder: '',
};

const ES: I18nTranslations = {
  appTitle: 'Calculador de Esfuerzo de Desplazamiento IES',
  landingDescription: 'Sube el archivo PDF de vacantes para visualizar en un mapa interactivo la ubicación de los centros educativos y calcular la distancia y el esfuerzo de desplazamiento desde tus orígenes.',
  processingPDF: 'Procesando PDF...',
  dropPDF: 'Suelta el PDF aquí o haz clic para seleccionar',
  validPDFOnly: 'Solo archivos PDF válidos',
  orTrySample: 'o prueba con un archivo de ejemplo',
  loadSample: 'Cargar PDF de ejemplo',
  interactiveMap: 'Mapa interactivo',
  dataTable: 'Tabla de datos',
  distanceCalculation: 'Cálculo de distancia',

  selectModalities: 'Selecciona modalidades',
  selectModalitiesDesc: 'Elige las modalidades que te interesen para filtrar las plazas disponibles.',
  searchModality: 'Buscar modalidad...',
  noResults: 'Sin resultados',

  back: 'Volver',
  continue: 'Continuar',

  addOrigin: 'Añade tu origen',
  addOriginDesc: 'Introduce tu ubicación para calcular distancias y niveles de esfuerzo hacia los centros seleccionados.',
  enterLocation: 'Introduce una ubicación (p. ej. Alicante)',
  calculate: 'Calcular',

  uploadPDF: 'Subir PDF',
  views: 'Vistas',
  dataConfig: 'Configuración de datos',
  map: 'Mapa',
  table: 'Tabla',
  splitView: 'Vista dividida',
  comparisonOrigins: 'Orígenes de comparación',
  addNewOrigin: 'Añadir nuevo origen...',
  effortLegend: 'Leyenda de esfuerzo',
  low: 'Bajo',
  moderate: 'Moderado',
  high: 'Alto',
  veryHigh: 'Muy Alto',
  km: 'km',
  filterByName: 'Filtrar centros por nombre o localidad...',
  all: 'Todas',
  filterByLocality: 'Filtrar por localidad...',
  filterByModality: 'Filtrar por modalidad...',
  showOnlyItinerant: 'Mostrar solo itinerantes',
  modality: 'Modalidad',
  ies: 'IES',
  locality: 'Localidad',
  distance: 'Distancia',
  effort: 'Esfuerzo',
  itin: 'ITIN',
  addOriginPrompt: 'Añade un origen en el panel lateral para calcular distancias.',
  uploadPDFPrompt: 'Sube un PDF para empezar.',
  total: 'Total',
  centres: 'centros',
  name: 'Nombre',
  exportCSV: 'Exportar CSV',
  origin: 'Origen',
  notSelected: 'No seleccionado',
  useSamplePDF: 'Usar PDF de ejemplo',
  zoomIn: 'Ampliar',
  zoomOut: 'Reducir',
  help: 'Ayuda',
  langToggle: 'Valencià',

  selectAtLeastOneModality: 'Selecciona al menos una modalidad',
  addComparisonOrigin: 'Añade un origen de comparación',
  dropValidPDF: 'Suelta un archivo PDF válido',
  selectValidPDF: 'Selecciona un archivo PDF válido',
  errorProcessingPDF: (msg: string) => `Error al procesar el PDF: ${msg}`,
  errorLoadingPDF: (msg: string) => `Error al cargar el PDF: ${msg}`,
  couldNotGeocode: (name: string) => `No se ha podido geocodificar "${name}". Prueba con un nombre de municipio.`,

  processingPage: (page: number, total: number) => `Procesando página ${page} de ${total}...`,
  completeRows: (n: number) => `¡Completado! ${n} filas procesadas.`,

  geocodingOrigin: 'Geocodificando origen...',
  geocodingLocalities: 'Geocodificando centros...',
  geocodingProgress: (current: number, total: number) => `Geocodificando ${current} de ${total} centros...`,
  geocodingComplete: (total: number) => `Geocodificación completa (${total} centros)`,
  calculatingForCentres: (n: number) => `Calculando distancias para ${n} centros...`,
  calculatingProgress: (i: number, n: number, name: string) => `Calculando distancia: ${name} (${i}/${n})`,
  geocodingNew: (n: number) => `Geocodificando ${n} nuevos centros...`,

  positionsInCentres: (positions: number, centres: number) => `${positions} plazas en ${centres} centros`,
  itinerantCount: (n: number) => `(${n} itinerante)`,
  totalCentres: (n: number) => `Total: ${n} centros`,
  itinerantPositions: (n: number) => `${n} plaza/s itinerante/s`,

  levelLabelBaix: 'Bajo',
  levelLabelModerat: 'Moderado',
  levelLabelAlt: 'Alto',
  levelLabelMoltAlt: 'Muy Alto',
  levelLabelUnknown: 'Desconocido',
  levelDescBaix: (km: number) => `< ${km} km - Desplazamiento cómodo`,
  levelDescModerat: (baix: number, moderat: number) => `${baix}-${moderat} km - Desplazamiento razonable`,
  levelDescAlt: (moderat: number, alt: number) => `${moderat}-${alt} km - Desplazamiento largo`,
  levelDescMoltAlt: (alt: number) => `> ${alt} km - Desplazamiento muy largo`,

  pdfProcessingMessage: (page: number, total: number) => `Procesando página ${page} de ${total}...`,
  filterLocalitiesPlaceholder: '',
};
