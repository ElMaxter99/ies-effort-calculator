import { Component, effect, signal, computed, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { IesRow, IesCenter, ProcessInfo, Origin, EffortThresholds } from './types';
import { PdfParserService } from './services/pdf-parser.service';
import { GeocodingService } from './services/geocoding.service';
import { I18nService } from './services/i18n.service';
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

  focusLocalityInput() {
    setTimeout(() => this.inputLocalitatRef?.nativeElement?.focus(), 50);
  }

  closeLocalityDropdown() {
    setTimeout(() => this.showLocalityDropdown.set(false), 200);
  }

  closeModalityDropdown() {
    setTimeout(() => this.showModalityDropdown.set(false), 200);
  }

  step = signal<'landing' | 'modalities' | 'origin' | 'main'>('landing');
  pdfLoaded = signal(false);
  dragging = signal(false);
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

  thresholds = signal<EffortThresholds>({ baix: 5, moderat: 15, alt: 30 });
  showConfig = signal(false);

  geoProgress = signal({ current: 0, total: 0, message: '' });

  t = computed(() => this.i18n.t());

  localities = computed(() => {
    const set = new Set<string>();
    for (const c of this.centres()) {
      if (c.locality) set.add(c.locality);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });

  currentView = signal<ViewType>('map');

  origins = signal<Origin[]>([
    { id: '1', name: 'València' },
    { id: '2', name: 'Castelló' },
    { id: '3', name: 'Alacant' },
  ]);
  activeOrigin = signal<string>('1');
  newOriginName = signal('');

  geocoding = signal(false);
  calculating = signal(false);

  totalCenters = computed(() => this.centres().length);
  totalPositions = computed(() => this.centres().reduce((acc, c) => acc + c.positions.length, 0));
  totalItinerants = computed(() => this.centres().reduce((acc, c) => acc + (c.totalItinerants ?? 0), 0));

  private rawRecords: IesRow[] = [];
  map: L.Map | null = null;
  private originMarker: L.Marker | null = null;
  private centreMarkers: L.Marker[] = [];
  private circles: L.Circle[] = [];

  constructor(
    private pdfParser: PdfParserService,
    public geo: GeocodingService,
    public i18n: I18nService
  ) {
    this.process = this.pdfParser.process;

    effect(() => {
      const p = this.process();
      if (p && p.percentage === 100 && this.rawRecords.length > 0) {
        this.onParseComplete();
      }
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

  }

  ngOnDestroy() {
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
      marker.bindPopup(
        `<strong>${c.name}</strong><br>${c.locality}<br>${c.distanceKm ? c.distanceKm + ' km' : '—'}<br>${c.effortLevel ? this.geo.levelLabel(c.effortLevel) : ''}`,
      );
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
      this.error.set(this.i18n.t().selectValidPDF);
      return;
    }

    this.error.set('');
    this.pdfLoaded.set(false);
    this.centres.set([]);
    this.filteredCentres.set([]);

    try {
      this.rawRecords = await this.pdfParser.parsePdf(file);
      this.pdfLoaded.set(true);
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
    const uniqueLocalities = [...new Set(filteredCentres.map((c) => c.locality.replace(/ - .*$/, '').trim().toLowerCase()))];
    if (uniqueLocalities.length === 0) return;

    this.geocoding.set(true);
    this.calculating.set(true);

    const results = await this.geo.geocodeBatch(uniqueLocalities);
    const t = this.i18n.t();

    this.geoProgress.set({ current: 0, total: filteredCentres.length, message: t.calculatingForCentres(filteredCentres.length) });

    for (let i = 0; i < filteredCentres.length; i++) {
      const c = filteredCentres[i];
      const key = c.locality.replace(/ - .*$/, '').trim().toLowerCase();
      const geoCentre = results.get(key);

      if (geoCentre) {
        c.coordinates = { lat: geoCentre.lat, lng: geoCentre.lng };
        c.distanceKm = parseFloat(
          this.geo.haversineDistance(origin.coordinates.lat, origin.coordinates.lng, geoCentre.lat, geoCentre.lng).toFixed(1),
        );
        c.effortLevel = this.geo.effortLevel(c.distanceKm);
      }

      this.geoProgress.set({ current: i + 1, total: filteredCentres.length, message: t.calculatingProgress(i + 1, filteredCentres.length) });

      if (i % 50 === 0) {
        this.centres.set([...this.centres()]);
      }
    }

    this.centres.set([...this.centres()]);
    this.applyFilter();
    this.updateMap();

    this.geocoding.set(false);
    this.calculating.set(false);
    this.geoProgress.set({ current: 0, total: 0, message: '' });
  }

  changeView(view: ViewType) {
    this.currentView.set(view);
    setTimeout(() => this.map?.invalidateSize(), 50);
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

    const geoOrigin = await this.geo.geocode(name);
    if (!geoOrigin) {
      this.error.set(t.couldNotGeocode(name));
      this.geocoding.set(false);
      this.calculating.set(false);
      return;
    }

    const id = Date.now().toString();
    const newOrigin: Origin = {
      id,
      name,
      coordinates: { lat: geoOrigin.lat, lng: geoOrigin.lng },
    };

    this.origins.update((o) => [...o, newOrigin]);
    this.activeOrigin.set(id);

    if (this.step() !== 'origin') {
      await this.calculateDistancesForOrigin(newOrigin);
    }

    this.geocoding.set(false);
    if (this.step() !== 'origin') this.calculating.set(false);
    this.geoProgress.set({ current: 0, total: 0, message: '' });
  }

  async selectOrigin(id: string) {
    this.activeOrigin.set(id);
    const origin = this.origins().find((o) => o.id === id);
    if (!origin) return;

    if (!origin.coordinates) {
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

    if (origin.coordinates) {
      if (this.step() === 'main') {
        await this.calculateDistancesForOrigin(origin);
      }
      this.updateMap();
    }
  }

  removeOrigin(id: string) {
    this.origins.update((o) => o.filter((x) => x.id !== id));
    if (this.activeOrigin() === id) {
      const remaining = this.origins();
      this.activeOrigin.set(remaining.length > 0 ? remaining[remaining.length - 1].id : '');
    }
    this.updateMap();
  }

  async calculateDistancesForOrigin(origin: Origin) {
    if (!origin.coordinates) return;

    const currentCentres = this.step() === 'main' ? this.filteredCentres() : this.centres();
    const uniqueLocalities = [...new Set(currentCentres.map((c) => c.locality.replace(/ - .*$/, '').trim().toLowerCase()))];

    if (uniqueLocalities.length === 0) return;

    // Only geocode localities without coordinates yet
    const pending = uniqueLocalities.filter((loc) => {
      const c = currentCentres.find((x) => x.locality.replace(/ - .*$/, '').trim().toLowerCase() === loc);
      return !c?.coordinates;
    });

    const t2 = this.i18n.t();
    if (pending.length > 0) {
      this.geoProgress.set({ current: 0, total: pending.length, message: t2.geocodingNew(pending.length) });
      await this.geo.geocodeBatch(pending);
    }

    this.geoProgress.set({ current: 0, total: currentCentres.length, message: t2.calculatingForCentres(currentCentres.length) });

    for (let i = 0; i < currentCentres.length; i++) {
      const c = currentCentres[i];
      const key = c.locality.replace(/ - .*$/, '').trim().toLowerCase();
      const geoCentre = this.geo.getCached(key);

      if (geoCentre) {
        c.coordinates = { lat: geoCentre.lat, lng: geoCentre.lng };
        c.distanceKm = parseFloat(
          this.geo.haversineDistance(origin.coordinates.lat, origin.coordinates.lng, geoCentre.lat, geoCentre.lng).toFixed(1),
        );
        c.effortLevel = this.geo.effortLevel(c.distanceKm);
      }

      this.geoProgress.set({ current: i + 1, total: currentCentres.length, message: t2.calculatingProgress(i + 1, currentCentres.length) });

      if (i % 50 === 0) {
        this.centres.set([...this.centres()]);
      }
    }

    this.centres.set([...this.centres()]);
    this.applyFilter();
    this.updateMap();
  }

  async toggleModality(m: string) {
    this.modalityFilter.update((s) => {
      const updated = new Set(s);
      if (updated.has(m)) updated.delete(m); else updated.add(m);
      return updated;
    });
    this.applyFilter();

    if (this.step() === 'main') {
      const visibleCentres = this.filteredCentres();
      const localitiesWithoutGeo = [...new Set(
        visibleCentres
          .filter((c) => !c.coordinates)
          .map((c) => c.locality.replace(/ - .*$/, '').trim().toLowerCase())
      )];
      if (localitiesWithoutGeo.length > 0) {
        const results = await this.geo.geocodeBatch(localitiesWithoutGeo);
        for (const c of this.centres()) {
          if (c.coordinates) continue;
          const key = c.locality.replace(/ - .*$/, '').trim().toLowerCase();
          const geo = results.get(key);
          if (geo) {
            c.coordinates = { lat: geo.lat, lng: geo.lng };
          }
        }
        this.centres.set([...this.centres()]);
        this.applyFilter();
        this.updateMap();
      }
    }
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
      results = results.filter((c) => (c.totalItinerants ?? 0) > 0);
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
        results.sort((a, b) => dir * ((a.totalItinerants ?? 0) - (b.totalItinerants ?? 0)));
        break;
    }

    this.filteredCentres.set(results);
    this.updateMap();
  }

  getLevelColor(level?: string): string {
    return this.geo.levelColor(level || '');
  }

  getLevelLabel(level?: string): string {
    return this.geo.levelLabel(level || '');
  }

  getLevelDescription(level?: string): string {
    return this.geo.levelDescription(level || '');
  }

  backToLanding() {
    this.step.set('landing');
    this.pdfLoaded.set(false);
    this.centres.set([]);
    this.filteredCentres.set([]);
    this.error.set('');
  }

  loadSamplePdf() {
    this.error.set('');
    this.pdfLoaded.set(false);
    this.centres.set([]);
    this.filteredCentres.set([]);

    fetch('Vacants_Supr_Despl_Secundaria_2.pdf')
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], 'Vacants_Supr_Despl_Secundaria_2.pdf', { type: 'application/pdf' });
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.getElementById('pdfInput') as HTMLInputElement;
        if (input) {
          const list = dt.files;
          Object.defineProperty(input, 'files', { value: list, writable: false });
          input.dispatchEvent(new Event('change'));
        }
      })
      .catch((e) => this.error.set(this.i18n.t().errorLoadingPDF(e.message)));
  }
}
