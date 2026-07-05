import { Component, effect, signal, computed, ViewChild, ElementRef, afterNextRender, OnDestroy } from '@angular/core';
import { IesRow, IesCenter, ProcesInfo, Origen, EffortThresholds } from './types';
import { PdfParserService } from './services/pdf-parser.service';
import { GeocodingService } from './services/geocoding.service';
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

  focussarInputLocalitat() {
    setTimeout(() => this.inputLocalitatRef?.nativeElement?.focus(), 50);
  }

  tancarDropdownLocalitat() {
    setTimeout(() => this.mostrarDropdownLocalitats.set(false), 200);
  }

  tancarDropdownModalitats() {
    setTimeout(() => this.mostrarDropdownModalitats.set(false), 200);
  }

  step = signal<'landing' | 'modalitats' | 'origen' | 'main'>('landing');
  pdfCarregat = signal(false);
  dragging = signal(false);
  proces = signal<ProcesInfo | null>(null);
  centres = signal<IesCenter[]>([]);
  centresFiltrats = signal<IesCenter[]>([]);
  error = signal('');
  filtreNivell = signal<string>('');
  ordenarPer = signal<string>('distancia');
  cercaText = signal('');
  filtreLocalitat = signal<string>('');
  filtreItinerants = signal<boolean>(false);
  cercaLocalitat = signal('');
  mostrarDropdownLocalitats = signal(false);
  modalitatsDisponibles = computed(() => {
    const set = new Set<string>();
    for (const c of this.centres()) {
      for (const m of c.modalitats ?? []) set.add(m);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });
  filtreModalitats = signal<Set<string>>(new Set());
  cercaModalitat = signal('');
  mostrarDropdownModalitats = signal(false);

  thresholds = signal<EffortThresholds>({ baix: 5, moderat: 15, alt: 30 });
  mostrarConfig = signal(false);

  geoProgress = signal({ actual: 0, total: 0, missatge: '' });

  localitats = computed(() => {
    const set = new Set<string>();
    for (const c of this.centres()) {
      if (c.localitat) set.add(c.localitat);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  });

  viewActual = signal<ViewType>('map');

  origins = signal<Origen[]>([
    { id: '1', nom: 'Casa (València)' },
    { id: '2', nom: 'Estació Nord' },
  ]);
  originActiu = signal<string>('1');
  nouOriginNom = signal('');

  geocodificant = signal(false);
  calculant = signal(false);

  totalCentres = computed(() => this.centres().length);
  totalPlaces = computed(() => this.centres().reduce((acc, c) => acc + c.places.length, 0));
  totalItinerants = computed(() => this.centres().reduce((acc, c) => acc + (c.totalItinerants ?? 0), 0));

  private registresBruts: IesRow[] = [];
  map: L.Map | null = null;
  private originMarker: L.Marker | null = null;
  private centreMarkers: L.Marker[] = [];
  private circles: L.Circle[] = [];

  constructor(
    private pdfParser: PdfParserService,
    public geo: GeocodingService
  ) {
    this.proces = this.pdfParser.proces;

    effect(() => {
      const p = this.proces();
      if (p && p.percentatge === 100 && this.registresBruts.length > 0) {
        this.onParseComplet();
      }
    });

    effect(() => {
      this.geo.thresholds = this.thresholds();
      this.aplicarFiltre();
      this.updateMapCircles();
    });

    afterNextRender(() => {
      this.initMap();
    });
  }

  ngOnDestroy() {
    this.map?.remove();
  }

  private initMap() {
    if (!this.mapContainer?.nativeElement || this.map) return;

    this.map = L.map(this.mapContainer.nativeElement, { zoomControl: false }).setView([39.4699, -0.3763], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(this.map);

    L.control.zoom({ position: 'topright' }).addTo(this.map);

    this.updateMap();
    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  private updateMap() {
    if (!this.map) return;
    this.updateMapMarkers();
    this.updateMapCircles();
  }

  private updateMapCircles() {
    if (!this.map) return;
    this.circles.forEach((c) => this.map?.removeLayer(c));
    this.circles = [];

    const origin = this.origins().find((o) => o.id === this.originActiu());
    if (!origin?.coordenades) return;

    const { lat, lng } = origin.coordenades;
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

    const origin = this.origins().find((o) => o.id === this.originActiu());

    if (origin?.coordenades) {
      const { lat, lng } = origin.coordenades;

      const originIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="w-4 h-4" style="background:var(--color-primary);border:2px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(0,35,111,0.2)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      this.originMarker = L.marker([lat, lng], { icon: originIcon }).addTo(this.map);
    }

    for (const c of this.centresFiltrats()) {
      if (!c.coordenades) continue;
      const color = this.geo.colorNivell(c.nivellEsforc || '');

      const centerIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="flex flex-col items-center">
                <div class="w-3 h-3 bg-white border-2 rounded-full shadow-sm" style="border-color:${color}"></div>
                <div class="w-0.5 h-1.5" style="background:${color}"></div>
               </div>`,
        iconSize: [12, 18],
        iconAnchor: [6, 18],
      });

      const marker = L.marker([c.coordenades.lat, c.coordenades.lng], { icon: centerIcon }).addTo(this.map);
      marker.bindPopup(
        `<strong>${c.nom}</strong><br>${c.localitat}<br>${c.distanciaKm ? c.distanciaKm + ' km' : '—'}<br>${c.nivellEsforc ? this.geo.etiquetaNivell(c.nivellEsforc) : ''}`,
      );
      this.centreMarkers.push(marker);
    }

    const allCoords: [number, number][] = [];
    if (origin?.coordenades) allCoords.push([origin.coordenades.lat, origin.coordenades.lng]);
    for (const c of this.centresFiltrats()) {
      if (c.coordenades) allCoords.push([c.coordenades.lat, c.coordenades.lng]);
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
      this.processarFitxer(file);
    } else {
      this.error.set('Arrossega un fitxer PDF vàlid');
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.processarFitxer(input.files[0]);
    input.value = '';
  }

  private async processarFitxer(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      this.error.set('Selecciona un fitxer PDF vàlid');
      return;
    }

    this.error.set('');
    this.pdfCarregat.set(false);
    this.centres.set([]);
    this.centresFiltrats.set([]);

    try {
      this.registresBruts = await this.pdfParser.parsearPdf(file);
      this.pdfCarregat.set(true);
    } catch (e: any) {
      this.error.set('Error al processar el PDF: ' + e.message);
    }
  }

  private onParseComplet() {
    const agrupats = this.pdfParser.agruparPerCentre(this.registresBruts);
    const centresArr: IesCenter[] = [];

    for (const [, c] of agrupats) {
      const modalitats = [...new Set(c.places.map((p) => p.modalitat).filter(Boolean))] as string[];
      centresArr.push({
        codiCentre: c.codiCentre,
        nom: c.nom,
        localitat: c.localitat,
        places: c.places,
        totalItinerants: c.totalItinerants,
        modalitats,
      });
    }

    this.centres.set(centresArr);
    this.centresFiltrats.set(centresArr);
    this.filtreModalitats.set(new Set(this.modalitatsDisponibles()));
    this.step.set('modalitats');
  }

  continuarAmbModalitats() {
    if (this.filtreModalitats().size === 0) {
      this.error.set('Selecciona almenys una modalitat');
      return;
    }
    this.error.set('');
    this.step.set('origen');
  }

  async continuarAmbOrigen() {
    const origin = this.origins().find((o) => o.id === this.originActiu());
    if (!origin?.coordenades) {
      this.error.set('Afig un origen de comparació');
      return;
    }
    this.error.set('');
    this.step.set('main');

    const centresFiltrats = this.centresFiltrats();
    const localitatsUniques = [...new Set(centresFiltrats.map((c) => c.localitat.replace(/ - .*$/, '').trim().toLowerCase()))];
    if (localitatsUniques.length === 0) return;

    this.geocodificant.set(true);
    this.calculant.set(true);

    const results = await this.geo.geocodificaBatch(localitatsUniques);

    this.geoProgress.set({ actual: 0, total: centresFiltrats.length, missatge: `Calculant distàncies per a ${centresFiltrats.length} centres...` });

    for (let i = 0; i < centresFiltrats.length; i++) {
      const c = centresFiltrats[i];
      const clau = c.localitat.replace(/ - .*$/, '').trim().toLowerCase();
      const geoCentre = results.get(clau);

      if (geoCentre) {
        c.coordenades = { lat: geoCentre.lat, lng: geoCentre.lng };
        c.distanciaKm = parseFloat(
          this.geo.distanciaHaversine(origin.coordenades.lat, origin.coordenades.lng, geoCentre.lat, geoCentre.lng).toFixed(1),
        );
        c.nivellEsforc = this.geo.nivellEsforc(c.distanciaKm);
      }

      if (i % 50 === 0) {
        this.centres.set([...this.centres()]);
        this.geoProgress.set({ actual: i + 1, total: centresFiltrats.length, missatge: `Calculant distàncies... ${i + 1}/${centresFiltrats.length}` });
      }
    }

    this.centres.set([...this.centres()]);
    this.aplicarFiltre();
    this.updateMap();

    this.geocodificant.set(false);
    this.calculant.set(false);
    this.geoProgress.set({ actual: 0, total: 0, missatge: '' });
  }

  private async localitzarCentres() {
    const localitats = [...new Set(this.centres().map((c) => c.localitat.replace(/ - .*$/, '').trim().toLowerCase()))];
    if (localitats.length === 0) return;

    this.geoProgress.set({ actual: 0, total: localitats.length, missatge: `Localitzant ${localitats.length} centres...` });

    const results = await this.geo.geocodificaBatch(localitats);

    const centresActuals = this.centres();
    for (const c of centresActuals) {
      const clau = c.localitat.replace(/ - .*$/, '').trim().toLowerCase();
      const geo = results.get(clau);
      if (geo) {
        c.coordenades = { lat: geo.lat, lng: geo.lng };
      }
    }

    this.centres.set([...centresActuals]);
    this.updateMap();
    this.geoProgress.set({ actual: 0, total: 0, missatge: '' });
  }

  canviarVista(vista: ViewType) {
    this.viewActual.set(vista);
    setTimeout(() => this.map?.invalidateSize(), 50);
  }

  async afegirOrigen() {
    const nom = this.nouOriginNom().trim();
    if (!nom) return;

    this.nouOriginNom.set('');
    this.error.set('');
    this.geocodificant.set(true);
    this.calculant.set(true);
    this.geoProgress.set({ actual: 0, total: 0, missatge: 'Geocodificant origen...' });

    const geoOrigen = await this.geo.geocodifica(nom);
    if (!geoOrigen) {
      this.error.set(`No s'ha pogut geocodificar "${nom}". Prova amb un nom de població.`);
      this.geocodificant.set(false);
      this.calculant.set(false);
      return;
    }

    const id = Date.now().toString();
    const nouOrigen: Origen = {
      id,
      nom,
      coordenades: { lat: geoOrigen.lat, lng: geoOrigen.lng },
    };

    this.origins.update((o) => [...o, nouOrigen]);
    this.originActiu.set(id);

    if (this.step() !== 'origen') {
      await this.calcularDistanciesPerOrigen(nouOrigen);
    }

    this.geocodificant.set(false);
    if (this.step() !== 'origen') this.calculant.set(false);
    this.geoProgress.set({ actual: 0, total: 0, missatge: '' });
  }

  async seleccionarOrigen(id: string) {
    this.originActiu.set(id);
    const origin = this.origins().find((o) => o.id === id);
    if (origin?.coordenades) {
      await this.calcularDistanciesPerOrigen(origin);
    }
    this.updateMap();
  }

  eliminarOrigen(id: string) {
    this.origins.update((o) => o.filter((x) => x.id !== id));
    if (this.originActiu() === id) {
      const restants = this.origins();
      this.originActiu.set(restants.length > 0 ? restants[restants.length - 1].id : '');
    }
    this.updateMap();
  }

  async calcularDistanciesPerOrigen(origen: Origen) {
    if (!origen.coordenades) return;

    const centresActuals = this.step() === 'main' ? this.centresFiltrats() : this.centres();
    const localitatsUniques = [...new Set(centresActuals.map((c) => c.localitat.replace(/ - .*$/, '').trim().toLowerCase()))];

    if (localitatsUniques.length === 0) return;

    // Only geocode localities that don't have coordinates yet
    const pendents = localitatsUniques.filter((loc) => {
      const c = centresActuals.find((x) => x.localitat.replace(/ - .*$/, '').trim().toLowerCase() === loc);
      return !c?.coordenades;
    });

    if (pendents.length > 0) {
      this.geoProgress.set({ actual: 0, total: pendents.length, missatge: `Geocodificant ${pendents.length} localitats noves...` });
      await this.geo.geocodificaBatch(pendents);
    }

    this.geoProgress.set({ actual: 0, total: centresActuals.length, missatge: `Calculant distàncies per a ${centresActuals.length} centres...` });

    for (let i = 0; i < centresActuals.length; i++) {
      const c = centresActuals[i];
      const clau = c.localitat.replace(/ - .*$/, '').trim().toLowerCase();
      const geoCentre = this.geo.consultaCache(clau);

      if (geoCentre) {
        c.coordenades = { lat: geoCentre.lat, lng: geoCentre.lng };
        c.distanciaKm = parseFloat(
          this.geo.distanciaHaversine(origen.coordenades.lat, origen.coordenades.lng, geoCentre.lat, geoCentre.lng).toFixed(1),
        );
        c.nivellEsforc = this.geo.nivellEsforc(c.distanciaKm);
      }

      if (i % 50 === 0) {
        this.centres.set([...this.centres()]);
        this.geoProgress.set({ actual: i + 1, total: centresActuals.length, missatge: `Calculant distàncies... ${i + 1}/${centresActuals.length}` });
      }
    }

    this.centres.set([...this.centres()]);
    this.aplicarFiltre();
    this.updateMap();
  }

  async toggleModalitat(m: string) {
    this.filtreModalitats.update((s) => {
      const nou = new Set(s);
      if (nou.has(m)) nou.delete(m); else nou.add(m);
      return nou;
    });
    this.aplicarFiltre();

    if (this.step() === 'main') {
      const centresVisibles = this.centresFiltrats();
      const localitatsSenseGeo = [...new Set(
        centresVisibles
          .filter((c) => !c.coordenades)
          .map((c) => c.localitat.replace(/ - .*$/, '').trim().toLowerCase())
      )];
      if (localitatsSenseGeo.length > 0) {
        const results = await this.geo.geocodificaBatch(localitatsSenseGeo);
        for (const c of this.centres()) {
          if (c.coordenades) continue;
          const clau = c.localitat.replace(/ - .*$/, '').trim().toLowerCase();
          const geo = results.get(clau);
          if (geo) {
            c.coordenades = { lat: geo.lat, lng: geo.lng };
          }
        }
        this.centres.set([...this.centres()]);
        this.aplicarFiltre();
        this.updateMap();
      }
    }
  }

  modalitatSeleccionada(m: string): boolean {
    return this.filtreModalitats().has(m);
  }

  aplicarFiltre() {
    let resultats = [...this.centres()];

    const cerca = this.cercaText().toLowerCase().trim();
    if (cerca) {
      resultats = resultats.filter(
        (c) => c.nom.toLowerCase().includes(cerca) || c.localitat.toLowerCase().includes(cerca),
      );
    }

    if (this.filtreLocalitat()) {
      resultats = resultats.filter((c) => c.localitat === this.filtreLocalitat());
    }

    if (this.filtreNivell()) {
      resultats = resultats.filter((c) => c.nivellEsforc === this.filtreNivell());
    }

    if (this.filtreItinerants()) {
      resultats = resultats.filter((c) => (c.totalItinerants ?? 0) > 0);
    }

    if (this.filtreModalitats().size > 0) {
      resultats = resultats.filter((c) => c.modalitats?.some((m) => this.filtreModalitats().has(m)));
    }

    if (this.ordenarPer() === 'distancia') {
      resultats.sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity));
    } else {
      resultats.sort((a, b) => a.nom.localeCompare(b.nom));
    }

    this.centresFiltrats.set(resultats);
    this.updateMap();
  }

  getColorNivell(nivell?: string): string {
    return this.geo.colorNivell(nivell || '');
  }

  getEtiquetaNivell(nivell?: string): string {
    return this.geo.etiquetaNivell(nivell || '');
  }

  getDescripcioNivell(nivell?: string): string {
    return this.geo.descripcioNivell(nivell || '');
  }

  tornarALanding() {
    this.step.set('landing');
    this.pdfCarregat.set(false);
    this.centres.set([]);
    this.centresFiltrats.set([]);
    this.error.set('');
  }

  carregarPdfExemple() {
    this.error.set('');
    this.pdfCarregat.set(false);
    this.centres.set([]);
    this.centresFiltrats.set([]);

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
      .catch((e) => this.error.set('Error carregant el PDF: ' + e.message));
  }
}
