import { Component, effect, signal, computed, untracked, ViewChild, ElementRef, OnDestroy, HostListener } from '@angular/core';
import { IesRow, IesCenter, ProcessInfo, Origin, EffortThresholds, TransportMode } from './types';
import { PdfParserService } from './services/pdf-parser.service';
import { GeocodingService } from './services/geocoding.service';
import { CentresDatabaseService } from './services/centres-database.service';
import { I18nService } from './services/i18n.service';
import { APP_VERSION } from './version';
import { APP_ENV } from './env';
import L from 'leaflet';

type ViewType = 'map' | 'table' | 'split';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLElement>;
  @ViewChild('inputLocalitat') inputLocalitatRef?: ElementRef<HTMLInputElement>;
  @ViewChild('modalityFilterContainer') modalityFilterContainer?: ElementRef<HTMLElement>;

  focusLocalityInput() {
    setTimeout(() => this.inputLocalitatRef?.nativeElement?.focus(), 50);
  }

  closeLocalityDropdown() {
    setTimeout(() => this.showLocalityDropdown.set(false), 200);
  }

  closeModalityDropdown() {
    this.showModalityDropdown.set(false);
    this.modalitySearch.set('');
  }

  toggleModalityDropdown() {
    this.showModalityDropdown.update(v => !v);
    if (!this.showModalityDropdown()) this.modalitySearch.set('');
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.showModalityDropdown()) return;
    const container = this.modalityFilterContainer?.nativeElement;
    if (container && !container.contains(event.target as Node)) {
      this.closeModalityDropdown();
    }
  }

  step = signal<'landing' | 'modalities' | 'origin' | 'main' | 'terms' | 'privacy'>('landing');
  pdfLoaded = signal(false);
  dragging = signal(false);
  headerShadow = signal(false);
  process = signal<ProcessInfo | null>(null);
  centres = signal<IesCenter[]>([]);
  filteredCentres = signal<IesCenter[]>([]);
  error = signal('');
  levelFilter = signal<string>('');
  sortBy = signal<string>('distance');
  sortDir = signal<'asc' | 'desc'>('asc');
  searchText = signal('');
  localityFilter = signal<string>('');
  itinerantFilter = signal<boolean>(false);
  observationsFilter = signal<boolean>(false);
  transportMode = signal<TransportMode>('car');
  localitySearch = signal('');
  showLocalityDropdown = signal(false);
  availableModalities = computed(() => {
    const set = new Set<string>();
    for (const c of this.centres()) {
      for (const m of c.modalities ?? []) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });
  modalityFilter = signal<Set<string>>(new Set());
  modalitySearch = signal('');
  showModalityDropdown = signal(false);
  private modalityDebounceTimer: ReturnType<typeof setTimeout> | undefined;

  thresholds = signal<EffortThresholds>({ baix: 10, moderat: 45, alt: 75 });
  showConfig = signal(false);

  geoProgress = signal({ current: 0, total: 0, message: '' });

  t = computed(() => this.i18n.t());

  appVersionLabel = computed(() => {
    if (APP_ENV === 'development') return 'LOCAL';
    if (APP_ENV === 'preview') return 'PRE';
    return 'v' + APP_VERSION;
  });

  localities = computed(() => {
    const set = new Set<string>();
    for (const c of this.centres()) {
      if (c.locality) set.add(c.locality);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });

  sidebarOpen = signal(true);
  currentView = signal<ViewType>('map');

  isMobile = signal(false);
  mobileView = signal<ViewType>('map');
  mobileDrawerOpen = signal(false);
  showMobileFilters = signal(false);

  origins = signal<Origin[]>([]);
  activeOrigin = signal<string>('1');
  newOriginName = signal('');

  geocoding = signal(false);
  calculating = signal(false);
  selectedCentre = signal<IesCenter | null>(null);
  showItineraryModal = signal(false);
  shownItinerantObservations = signal<string | null>(null);
  showResetConfirm = signal(false);
  originPanelHeight = signal('40vh');
  private resizing = false;

  totalCenters = computed(() => this.centres().length);
  totalPositions = computed(() => this.centres().reduce((acc, c) => acc + c.positions.length, 0));
  filteredItinerantCount = computed(() => this.filteredCentres().reduce((acc, c) => acc + this.getItinerantCount(c), 0));
  filteredObservationsCount = computed(() => this.filteredCentres().reduce((acc, c) => acc + (this.hasObservations(c) ? 1 : 0), 0));
  hasAnyObservations = computed(() => this.filteredCentres().some(c => this.hasObservations(c)));

  private rawRecords: IesRow[] = [];
  map: L.Map | null = null;
  private originMarker: L.Marker | null = null;
  private centreMarkers: L.Marker[] = [];
  private circles: L.Circle[] = [];
  private previewMap: L.Map | null = null;
  private previewMarker: L.Marker | null = null;

  constructor(
    private pdfParser: PdfParserService,
    public geo: GeocodingService,
    public centresDb: CentresDatabaseService,
    public i18n: I18nService
  ) {
    this.process = this.pdfParser.process;

    effect(() => {
      // process signal drives progress UI; completion handled in processFile
      void this.process();
    });

    effect(() => {
      this.geo.thresholds = this.thresholds();
      this.applyFilter();
      this.updateMapCircles();
    });

    effect(() => {
      document.documentElement.lang = this.i18n.lang();
    });

    effect(() => {
      if (this.step() === 'main') {
        setTimeout(() => this.updateMap(), 50);
      }
    });

    effect(() => {
      const mode = this.transportMode();
      const step = untracked(() => this.step());
      if (step !== 'main' || untracked(() => this.calculating()) || !GeocodingService.MODE_PROFILE[mode]) return;
      const origin = untracked(() => this.origins().find((o) => o.id === this.activeOrigin()));
      if (!origin?.coordinates) return;
      this.fetchRoutesForCurrentMode(origin).then(() => {
        this.applyFilter();
        this.updateMap();
      });
    });

    this.initDefaultOrigins();

    const mql = window.matchMedia('(max-width: 1023px)');
    this.isMobile.set(mql.matches);
    mql.addEventListener('change', (e: MediaQueryListEvent) => {
      this.isMobile.set(e.matches);
      if (!e.matches) {
        this.mobileDrawerOpen.set(false);
        this.showMobileFilters.set(false);
      }
    });
  }

  private initDefaultOrigins() {
    const defaults = [
      { id: '1', name: 'València' },
      { id: '2', name: 'Castelló de la Plana' },
      { id: '3', name: 'Alacant' },
    ];
    const origins: Origin[] = [];
    for (const d of defaults) {
      const coords = this.centresDb.getLocalityCoordinates(d.name);
      origins.push(coords ? { ...d, coordinates: coords } : d);
    }
    this.origins.set(origins);
  }

  ngOnDestroy() {
    clearTimeout(this.modalityDebounceTimer);
    this.map?.remove();
  }

  private ensureMap() {
    if (this.map) return;
    if (!this.mapContainer?.nativeElement) return;
    this.initMap();
  }

  private initMap() {
    const el = this.mapContainer!.nativeElement;

    this.map = L.map(el, { zoomControl: false }).setView([39.4699, -0.3763], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    this.updateMap();
    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  private updateMap() {
    this.ensureMap();
    if (!this.map) return;
    this.updateMapMarkers();
    this.updateMapCircles();
  }

  private updateMapCircles() {
    if (!this.map) return;
    this.circles.forEach((c) => this.map?.removeLayer(c));
    this.circles = [];

    const origin = this.origins().find((o) => o.id === this.activeOrigin());
    if (!origin?.coordinates) return;

    const { lat, lng } = origin.coordinates;
    const t = this.thresholds();

    this.circles.push(
      L.circle([lat, lng], { radius: t.baix * 1000, color: '#22c55e', weight: 1, fillOpacity: 0.03, dashArray: '5, 5' }).addTo(this.map),
      L.circle([lat, lng], { radius: t.moderat * 1000, color: '#eab308', weight: 1, fillOpacity: 0.02, dashArray: '5, 5' }).addTo(this.map),
      L.circle([lat, lng], { radius: t.alt * 1000, color: '#f97316', weight: 1, fillOpacity: 0.01, dashArray: '5, 5' }).addTo(this.map),
    );
  }

  private initPreviewMap() {
    const el = document.getElementById('previewMap');
    if (!el || this.previewMap) return;
    this.previewMap = L.map(el, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
    }).setView([39.4699, -0.3763], 7);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OSM contributors &copy; CARTO',
    }).addTo(this.previewMap);
  }

  private updatePreviewMap(origin: Origin | undefined) {
    if (this.previewMarker) {
      this.previewMap?.removeLayer(this.previewMarker);
      this.previewMarker = null;
    }
    if (!origin?.coordinates) return;
    this.initPreviewMap();
    if (!this.previewMap) return;
    const { lat, lng } = origin.coordinates;
    this.previewMarker = L.marker([lat, lng]).addTo(this.previewMap);
    this.previewMap.setView([lat, lng], 10);
  }

  private updateMapMarkers() {
    if (!this.map) return;

    if (this.originMarker) this.map.removeLayer(this.originMarker);
    this.centreMarkers.forEach((m) => this.map?.removeLayer(m));
    this.centreMarkers = [];

    const origin = this.origins().find((o) => o.id === this.activeOrigin());

    if (origin?.coordinates) {
      const { lat, lng } = origin.coordinates;

      const originIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="w-4 h-4" style="background:var(--color-primary);border:2px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(0,35,111,0.2)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      this.originMarker = L.marker([lat, lng], { icon: originIcon }).addTo(this.map);
    }

    for (const c of this.filteredCentres()) {
      if (!c.coordinates) continue;
      const color = this.geo.levelColor(c.effortLevel || '');

      const centerIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="flex flex-col items-center">
                <div class="w-3 h-3 bg-white border-2 rounded-full shadow-sm" style="border-color:${color}"></div>
                <div class="w-0.5 h-1.5" style="background:${color}"></div>
               </div>`,
        iconSize: [12, 18],
        iconAnchor: [6, 18],
      });

      const marker = L.marker([c.coordinates.lat, c.coordinates.lng], { icon: centerIcon }).addTo(this.map);
      marker.on('click', () => {
        this.selectedCentre.set(c);
      });
      this.centreMarkers.push(marker);
    }

    const allCoords: [number, number][] = [];
    if (origin?.coordinates) allCoords.push([origin.coordinates.lat, origin.coordinates.lng]);
    for (const c of this.filteredCentres()) {
      if (c.coordinates) allCoords.push([c.coordinates.lat, c.coordinates.lng]);
    }
    if (allCoords.length > 0) {
      this.map.fitBounds(allCoords, { padding: [50, 50] });
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.dragging.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      this.processFile(file);
    } else {
      this.error.set(this.i18n.t().dropValidPDF);
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.processFile(input.files[0]);
    input.value = '';
  }

  private async processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.error.set(this.i18n.t().errorPDFFormat);
      return;
    }

    this.error.set('');
    this.pdfLoaded.set(false);
    this.centres.set([]);
    this.filteredCentres.set([]);

    try {
      this.rawRecords = await this.pdfParser.parsePdf(file);
      this.pdfLoaded.set(true);

      if (this.rawRecords.length > 0) {
        this.onParseComplete();
      } else {
        this.pdfLoaded.set(false);
        this.error.set(this.i18n.t().errorNoValidRows);
      }
    } catch (e: any) {
      this.error.set(this.i18n.t().errorProcessingPDF(e.message));
    }
  }

  private onParseComplete() {
    const grouped = this.pdfParser.groupByCentre(this.rawRecords);
    const centresArr: IesCenter[] = [];

    for (const [, c] of grouped) {
      const modalities = [...new Set(c.positions.map((p) => p.modality).filter(Boolean))] as string[];
      centresArr.push({
        code: c.code,
        name: c.name,
        locality: c.locality,
        positions: c.positions,
        totalItinerants: c.totalItinerants,
        modalities,
      });
    }

    this.centres.set(centresArr);
    this.filteredCentres.set(centresArr);
    this.modalityFilter.set(new Set());
    this.step.set('modalities');
  }

  continueWithModalities() {
    if (this.modalityFilter().size === 0) {
      this.error.set(this.i18n.t().selectAtLeastOneModality);
      return;
    }
    this.error.set('');
    this.step.set('origin');
  }

  async continueWithOrigin() {
    const origin = this.origins().find((o) => o.id === this.activeOrigin());
    if (!origin?.coordinates) {
      this.error.set(this.i18n.t().addComparisonOrigin);
      return;
    }
    this.error.set('');
    this.step.set('main');

    const filteredCentres = this.filteredCentres();
    if (filteredCentres.length === 0) return;

    this.calculating.set(true);
    const t = this.i18n.t();

    this.geoProgress.set({ current: 0, total: filteredCentres.length, message: t.calculatingForCentres(filteredCentres.length) });

    for (let i = 0; i < filteredCentres.length; i++) {
      const c = filteredCentres[i];

      let coords = this.centresDb.getCoordinates(c.code);
      if (!coords) {
        const locality = c.locality.replace(/ - .*$/, '').trim();
        coords = this.centresDb.getLocalityCoordinates(locality);
      }

      if (coords) {
        c.coordinates = coords;
        c.distanceKm = parseFloat(
          this.geo.haversineDistance(origin.coordinates.lat, origin.coordinates.lng, coords.lat, coords.lng).toFixed(1),
        );
        c.effortLevel = this.geo.effortLevel(c.distanceKm);
      }

      this.geoProgress.set({ current: i + 1, total: filteredCentres.length, message: t.calculatingProgress(i + 1, filteredCentres.length, c.name) });

      if (i % 50 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    this.centres.set([...this.centres()]);
    this.applyFilter();
    this.updateMap();

    await this.fetchRoutesForCurrentMode(origin);
    this.applyFilter();
    this.updateMap();

    this.calculating.set(false);
    this.geoProgress.set({ current: 0, total: 0, message: '' });
  }

  changeView(view: ViewType) {
    this.currentView.set(view);
    if (this.isMobile()) {
      this.mobileView.set(view);
    }
    if (view !== 'table') {
      setTimeout(() => {
        this.updateMap();
        setTimeout(() => this.map?.invalidateSize(), 50);
      }, 50);
    }
  }

  async addOrigin() {
    const name = this.newOriginName().trim();
    if (!name) return;

    this.newOriginName.set('');
    this.error.set('');
    this.geocoding.set(true);
    this.calculating.set(true);
    const t = this.i18n.t();
    this.geoProgress.set({ current: 0, total: 0, message: t.geocodingOrigin });

    const dbCoords = this.centresDb.getLocalityCoordinates(name);
    let coords = dbCoords;

    if (!coords) {
      const geoOrigin = await this.geo.geocode(name);
      if (geoOrigin) {
        coords = { lat: geoOrigin.lat, lng: geoOrigin.lng };
      }
    }

    if (!coords) {
      this.error.set(t.couldNotGeocode(name));
      this.geocoding.set(false);
      this.calculating.set(false);
      return;
    }

    const id = Date.now().toString();
    const newOrigin: Origin = {
      id,
      name,
      coordinates: coords,
    };

    this.origins.update((o) => [...o, newOrigin]);
    this.activeOrigin.set(id);
    this.updatePreviewMap(newOrigin);

    if (this.step() !== 'origin') {
      this.geocoding.set(false);
      await this.calculateDistancesForOrigin(newOrigin);
    } else {
      this.geocoding.set(false);
      this.calculating.set(false);
      this.geoProgress.set({ current: 0, total: 0, message: '' });
    }
  }

  async selectOrigin(id: string) {
    this.activeOrigin.set(id);
    const origin = this.origins().find((o) => o.id === id);
    if (!origin) return;

    if (!origin.coordinates) {
      const dbCoords = this.centresDb.getLocalityCoordinates(origin.name);
      if (dbCoords) {
        origin.coordinates = dbCoords;
        this.origins.set([...this.origins()]);
      } else {
        const t = this.i18n.t();
        this.geocoding.set(true);
        this.geoProgress.set({ current: 0, total: 0, message: t.geocodingOrigin });
        const geo = await this.geo.geocode(origin.name);
        if (geo) {
          origin.coordinates = { lat: geo.lat, lng: geo.lng };
          this.origins.set([...this.origins()]);
        }
        this.geocoding.set(false);
        this.geoProgress.set({ current: 0, total: 0, message: '' });
      }
    }

    if (origin.coordinates) {
      if (this.step() === 'main') {
        await this.calculateDistancesForOrigin(origin);
      }
      this.updateMap();
      this.updatePreviewMap(origin);
    }
  }

  async removeOrigin(id: string) {
    const origin = this.origins().find((o) => o.id === id);
    if (origin?.coordinates) {
      this.geo.removeOriginRoutes(origin.coordinates.lat, origin.coordinates.lng);
    }
    this.origins.update((o) => o.filter((x) => x.id !== id));
    if (this.activeOrigin() === id) {
      const remaining = this.origins();
      if (remaining.length > 0) {
        await this.selectOrigin(remaining[remaining.length - 1].id);
      } else {
        this.activeOrigin.set('');
        this.updateMap();
      }
    } else {
      this.updateMap();
    }
  }

  async calculateDistancesForOrigin(origin: Origin) {
    if (!origin.coordinates) return;

    const currentCentres = this.step() === 'main' ? this.filteredCentres() : this.centres();
    if (currentCentres.length === 0) return;

    this.calculating.set(true);
    const t2 = this.i18n.t();
    this.geoProgress.set({ current: 0, total: currentCentres.length, message: t2.calculatingForCentres(currentCentres.length) });

    for (let i = 0; i < currentCentres.length; i++) {
      const c = currentCentres[i];

      if (!c.coordinates) {
        let coords = this.centresDb.getCoordinates(c.code);
        if (!coords) {
          const locality = c.locality.replace(/ - .*$/, '').trim();
          coords = this.centresDb.getLocalityCoordinates(locality);
        }
        if (coords) c.coordinates = coords;
      }

      if (c.coordinates) {
        c.distanceKm = parseFloat(
          this.geo.haversineDistance(origin.coordinates.lat, origin.coordinates.lng, c.coordinates.lat, c.coordinates.lng).toFixed(1),
        );
        c.effortLevel = this.geo.effortLevel(c.distanceKm);
      }

      this.geoProgress.set({ current: i + 1, total: currentCentres.length, message: t2.calculatingProgress(i + 1, currentCentres.length, c.name) });

      if (i % 50 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    this.centres.set([...this.centres()]);
    this.applyFilter();
    this.updateMap();

    await this.fetchRoutesForCurrentMode(origin);
    this.applyFilter();
    this.updateMap();
    this.calculating.set(false);
    this.geoProgress.set({ current: 0, total: 0, message: '' });
  }

  async toggleModality(m: string) {
    this.modalityFilter.update((s) => {
      const updated = new Set(s);
      if (updated.has(m)) updated.delete(m); else updated.add(m);
      return updated;
    });
    this.applyFilter();

    if (this.step() === 'main') {
      clearTimeout(this.modalityDebounceTimer);
      this.modalityDebounceTimer = setTimeout(() => this.flushModalityChanges(), 2000);
    }
  }

  toggleAllModalities(select: boolean) {
    if (select) {
      this.modalityFilter.set(new Set(this.availableModalities()));
    } else {
      this.modalityFilter.set(new Set());
    }
    this.applyFilter();

    if (this.step() === 'main') {
      clearTimeout(this.modalityDebounceTimer);
      this.modalityDebounceTimer = setTimeout(() => this.flushModalityChanges(), 2000);
    }
  }

  private async flushModalityChanges() {
    const origin = this.origins().find((o) => o.id === this.activeOrigin());
    if (!origin?.coordinates) return;

    const visibleCentres = this.filteredCentres();
    if (visibleCentres.length === 0) return;

    this.calculating.set(true);
    const t = this.i18n.t();

    const pending = visibleCentres.filter((c) => !c.coordinates);
    let changed = pending.length > 0;

    for (const c of pending) {
      let coords = this.centresDb.getCoordinates(c.code);
      if (!coords) {
        const locality = c.locality.replace(/ - .*$/, '').trim();
        coords = this.centresDb.getLocalityCoordinates(locality);
      }
      if (coords) c.coordinates = coords;
    }

    const noDistance = visibleCentres.filter((c) => c.coordinates && c.distanceKm === undefined);
    if (noDistance.length > 0) changed = true;

    this.geoProgress.set({ current: 0, total: noDistance.length, message: t.calculatingForCentres(noDistance.length) });

    for (let i = 0; i < noDistance.length; i++) {
      const c = noDistance[i];
      if (c.coordinates) {
        c.distanceKm = parseFloat(
          this.geo.haversineDistance(origin.coordinates.lat, origin.coordinates.lng, c.coordinates.lat, c.coordinates.lng).toFixed(1),
        );
        c.effortLevel = this.geo.effortLevel(c.distanceKm);
      }
      this.geoProgress.set({ current: i + 1, total: noDistance.length, message: t.calculatingProgress(i + 1, noDistance.length, c.name) });
      if (i % 50 === 0) await new Promise(r => setTimeout(r, 0));
    }

    if (changed) {
      this.centres.set([...this.centres()]);
      this.applyFilter();
      this.updateMap();
    }

    await this.fetchRoutesForCurrentMode(origin);
    this.applyFilter();
    this.updateMap();

    this.calculating.set(false);
    this.geoProgress.set({ current: 0, total: 0, message: '' });
  }

  setSort(column: string) {
    if (this.sortBy() === column) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortDir.set('asc');
    }
    this.applyFilter();
  }

  isModalitySelected(m: string): boolean {
    return this.modalityFilter().has(m);
  }

  applyFilter() {
    let results = [...this.centres()];

    const search = this.searchText().toLowerCase().trim();
    if (search) {
      results = results.filter(
        (c) => c.name.toLowerCase().includes(search) || c.locality.toLowerCase().includes(search),
      );
    }

    if (this.localityFilter()) {
      results = results.filter((c) => c.locality === this.localityFilter());
    }

    if (this.levelFilter()) {
      results = results.filter((c) => c.effortLevel === this.levelFilter());
    }

    if (this.itinerantFilter()) {
      results = results.filter((c) => this.getItinerantCount(c) > 0);
    }

    if (this.observationsFilter()) {
      results = results.filter((c) => this.hasObservations(c));
    }

    if (this.modalityFilter().size > 0) {
      results = results.filter((c) => c.modalities?.some((m) => this.modalityFilter().has(m)));
    }

    const dir = this.sortDir() === 'asc' ? 1 : -1;
    switch (this.sortBy()) {
      case 'distance':
        results.sort((a, b) => dir * ((a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)));
        break;
      case 'name':
        results.sort((a, b) => dir * a.name.localeCompare(b.name));
        break;
      case 'locality':
        results.sort((a, b) => dir * a.locality.localeCompare(b.locality));
        break;
      case 'effort': {
        const order: Record<string, number> = { baix: 0, moderat: 1, alt: 2, 'molt alt': 3 };
        results.sort((a, b) => dir * ((order[a.effortLevel ?? ''] ?? -1) - (order[b.effortLevel ?? ''] ?? -1)));
        break;
      }
      case 'itinerant':
        results.sort((a, b) => dir * (this.getItinerantCount(a) - this.getItinerantCount(b)));
        break;
    }

    this.filteredCentres.set(results);
    this.updateMap();
  }

  getLevelColor(level?: string): string {
    return this.geo.levelColor(level || '');
  }

  getLevelLabel(level?: string): string {
    return this.geo.levelLabel(level ?? '');
  }

  levelBorderColor(level: string): string {
    const map: Record<string, string> = { baix: 'border-green-500', moderat: 'border-yellow-500', alt: 'border-orange-500', 'molt alt': 'border-red-600' };
    return map[level] ?? 'border-outline';
  }

  levelBadgeClasses(level: string): string {
    const map: Record<string, string> = { baix: 'bg-green-100 text-green-800 border-green-200', moderat: 'bg-yellow-100 text-yellow-800 border-yellow-200', alt: 'bg-orange-100 text-orange-800 border-orange-200', 'molt alt': 'bg-red-100 text-red-800 border-red-200' };
    return map[level] ?? '';
  }

  getLevelDescription(level?: string): string {
    return this.geo.levelDescription(level || '');
  }

  updateThreshold(key: 'baix' | 'moderat' | 'alt', value: number) {
    if (isNaN(value) || value < 0) return;
    this.thresholds.update((t) => ({ ...t, [key]: value }));
  }

  getItinerantCount(c: IesCenter): number {
    const filtered = this.modalityFilter();
    if (filtered.size === 0) return c.totalItinerants ?? 0;
    return c.positions.filter((p) => p.isItinerant && filtered.has(p.modality ?? '')).length;
  }

  getObservations(c: IesCenter): string {
    const filtered = this.modalityFilter();
    return c.positions
      .filter((p) => {
        if (!p.observations) return false;
        return filtered.size === 0 || filtered.has(p.modality ?? '');
      })
      .map((p) => {
        let s = p.observations || '';
        if (p.modality) s = `[${p.modality}] ${s}`;
        return s;
      })
      .join('; ');
  }

  hasObservations(c: IesCenter): boolean {
    const filtered = this.modalityFilter();
    return c.positions.some((p) => {
      if (!p.observations) return false;
      return filtered.size === 0 || filtered.has(p.modality ?? '');
    });
  }

  transportIcon(mode: string): string {
    const icons: Record<string, string> = { car: 'directions_car', public: 'directions_bus', walking: 'directions_walk', bicycle: 'directions_bike' };
    return icons[mode] ?? 'directions_car';
  }

  selectedModalitiesFor(c: IesCenter): string[] {
    const filter = this.modalityFilter();
    if (filter.size === 0) return c.modalities ?? [];
    return (c.modalities ?? []).filter((m) => filter.has(m));
  }

  showObservations(c: IesCenter) {
    const obs = this.getObservations(c);
    if (obs) this.shownItinerantObservations.set(obs);
  }

  getItinerantTooltip(c: IesCenter): string {
    const filtered = this.modalityFilter();
    const items = c.positions.filter((p) => {
      if (!p.isItinerant) return false;
      return filtered.size === 0 || filtered.has(p.modality ?? '');
    });
    return items
      .map((p) => {
        let s = p.modality || '';
        if (p.itinerantCentre) s += ` → ${p.itinerantCentre}`;
        if (p.hours) s += ` (${p.hours}h)`;
        return s;
      })
      .join('\n');
  }

  private async fetchRoutesForCurrentMode(origin: Origin) {
    if (!origin.coordinates) return;
    const mode = this.transportMode();
    if (!GeocodingService.MODE_PROFILE[mode]) return;
    const centres = this.filteredCentres().filter(c => c.coordinates);
    if (centres.length === 0) return;

    const destCoords: { lat: number; lng: number }[] = [];
    const centreMap: number[] = [];

    for (let i = 0; i < centres.length; i++) {
      if (!centres[i].route?.[mode]) {
        destCoords.push(centres[i].coordinates!);
        centreMap.push(i);
      }
    }

    if (destCoords.length === 0) return;

    this.calculating.set(true);
    const t = this.i18n.t();
    this.geoProgress.set({ current: 0, total: destCoords.length, message: t.routingProgress(0, destCoords.length) });

    await this.geo.fetchRouteTable(
      origin.coordinates.lat, origin.coordinates.lng,
      destCoords,
      mode,
      (current, total) => {
        this.geoProgress.set({ current, total, message: t.routingProgress(current, total) });
      },
    );

    for (let i = 0; i < destCoords.length; i++) {
      const route = this.geo.getCachedRoute(origin.coordinates.lat, origin.coordinates.lng, destCoords[i].lat, destCoords[i].lng, mode);
      if (route) {
        const c = centres[centreMap[i]];
        c.route = { ...(c.route ?? {}), [mode]: route };
      }
    }

    this.centres.set([...this.centres()]);
    this.calculating.set(false);
    this.geoProgress.set({ current: 0, total: 0, message: '' });
  }

  getTravelTime(c: IesCenter): number | undefined {
    if (c.distanceKm === undefined) return undefined;
    const mode = this.transportMode();
    if (c.route?.[mode]?.durationMin) return c.route[mode].durationMin;
    return this.geo.estimateTravelTime(c.distanceKm, this.transportMode());
  }

  getTravelTimeForMode(c: IesCenter, mode: TransportMode): number | undefined {
    if (c.distanceKm === undefined) return undefined;
    if (c.route?.[mode]?.durationMin) return c.route[mode].durationMin;
    return this.geo.estimateTravelTime(c.distanceKm, mode);
  }

  openItineraryModal(c: IesCenter) {
    this.selectedCentre.set(c);
    this.showItineraryModal.set(true);
  }

  closeItineraryModal() {
    this.showItineraryModal.set(false);
  }

  closePopup() {
    this.selectedCentre.set(null);
  }

  focusCentre(c: IesCenter) {
    this.selectedCentre.set(c);
    if (!this.map || !c.coordinates) return;
    this.map.setView([c.coordinates.lat, c.coordinates.lng], this.map.getZoom());
  }

  exportCsv() {
    const rows = this.filteredCentres();
    const sep = ',';
    const header = ['Centre', 'Localitat', 'Distància (km)', 'Temps', 'Esforç', 'Itinerants', 'Observacions'].join(sep);
    const lines = rows.map((c) =>
      [
        `"${c.name}"`,
        `"${c.locality}"`,
        c.distanceKm !== undefined ? c.distanceKm : '',
        c.distanceKm !== undefined ? `"${this.geo.formatTravelTime(this.getTravelTime(c)!)}"` : '',
        c.effortLevel ? this.getLevelLabel(c.effortLevel) : '',
        this.getItinerantCount(c),
        `"${this.getObservations(c)}"`,
      ].join(sep),
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ies_esforc_desplacament.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  backToLanding() {
    this.step.set('landing');
    this.pdfLoaded.set(false);
    this.centres.set([]);
    this.filteredCentres.set([]);
    this.error.set('');
    this.rawRecords = [];
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    this.originMarker = null;
    this.centreMarkers = [];
    this.circles = [];
  }

  confirmReset() {
    this.showResetConfirm.set(false);
    this.geo.clearAllCaches();
    location.reload();
  }

  scrollToUpload() {
    const el = document.querySelector('#drop-zone');
    el?.scrollIntoView({ behavior: 'smooth' });
  }

  showTerms() {
    this.step.set('terms');
  }

  showPrivacy() {
    this.step.set('privacy');
  }

  backToStep(step: 'landing' | 'modalities' | 'origin' | 'main') {
    this.step.set(step);
  }

  onLandingScroll(event: Event) {
    const target = event.target as HTMLElement;
    this.headerShadow.set(target.scrollTop > 20);
  }

  startResize(event: MouseEvent) {
    event.preventDefault();
    this.resizing = true;
    const startY = event.clientY;
    const startHeight = parseFloat(this.originPanelHeight());
    const container = (event.target as HTMLElement).closest('[data-origin-split]') as HTMLElement | null;
    if (!container) return;
    const maxH = container.clientHeight - 200;

    const onMove = (e: MouseEvent) => {
      if (!this.resizing) return;
      const delta = e.clientY - startY;
      const newH = Math.max(150, Math.min(maxH, startHeight + delta));
      this.originPanelHeight.set(newH + 'px');
    };

    const onUp = () => {
      this.resizing = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setTimeout(() => this.previewMap?.invalidateSize(), 50);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }

}
