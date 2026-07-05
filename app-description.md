# Calculador d'Esforç de Desplaçament IES

App per calcular la distància i nivell d'esforç entre un origen i instituts de secundària (IES) de la Comunitat Valenciana a partir d'un PDF de vacants.

## Stack

- **Angular 22** standalone (sense NgModules)
- **pdfjs-dist 4.x** per parsejar PDFs
- **Nominatim API** (OpenStreetMap) per geocodificar adreces
- **Fórmula Haversine** per calcular distàncies
- **Vitest** per tests
- **Vite/esbuild** (via `@angular/build`)

## Com funciona

1. L'usuari puja un PDF amb llistat de places/vacants d'IES
2. El PDF es parseja amb pdfjs i s'extreu: codi centre, nom centre, localitat, codi lloc, observacions
3. Les files s'agrupen per centre escolar
4. L'usuari introdueix el seu origen (adreça o població)
5. L'app geocodifica l'origen i cada localitat dels centres
6. Calcula distància Haversine entre origen i cada centre
7. Assigna nivell d'esforç: Baix (<5km), Moderat (5-15km), Alt (15-30km), Molt alt (>30km)
8. Mostra taula amb tots els centres, distàncies i nivells, amb filtre per nivell i ordenació per distància/nom

## Estructura

```
src/
  main.ts                          # Punt d'entrada bootstrap
  index.html                       # Shell HTML (lang=ca)
  styles.css                       # Estils globals (fons gris clar)
  app/
    app.ts                         # Component principal (tota la lògica)
    app.html                       # Plantilla principal
    app.css                        # Estils del component
    app.config.ts                  # Providers (router, error handling)
    app.routes.ts                  # Rutes (buit, SPA sense navegació)
    types.ts                       # Interfaces: IesRow, IesCenter, ProcesInfo, NivellEsforc
    services/
      pdf-parser.service.ts        # Pujar + parsejar PDF amb pdfjs-dist
      geocoding.service.ts         # Geocodificar + Haversine + nivell d'esforç
```

## Estat actual

- **Pujada de PDF**: funcional (fitxer físic o PDF d'exemple incrustat)
- **Parseig**: funcional, agrupa per centre
- **Geocodificació**: funcional, amb cache per evitar crides repetides
- **Càlcul de distàncies**: funcional amb barra de progrés (actualitza cada 10 centres)
- **Filtrar i ordenar**: funcional (per nivell d'esforç i per nom/distància)
- **Responsive**: bàsic (CSS senzill sense framework)
- **Tests**: mínims (2 tests Vitest)

## Noves funcionalitats desitjades: Mapa de distàncies

Volem afegir un mapa interactiu on l'usuari puga:

1. **Veure tots els centres en un map** amb marcadors
2. **Comparar diversos orígens** (punt A, punt B, punt C...) i veure les distàncies a cada centre des de cada origen
3. **Seleccionar orígens al mapa** fent clic (a més d'escriure l'adreça)
4. **Veure cercles de distància** al voltant de cada origen (5km, 15km, 30km)
5. **Cintes de colors** als marcadors dels centres segons el nivell d'esforç
6. **Tooltip** en cada marcador amb: nom del centre, localitat, distància des de l'origen seleccionat, nivell d'esforç
7. **Canviar entre orígens** amb un selector i que el mapa s'actualitze

### Requisits tècnics per al mapa

- **Leaflet** (open source, lleuger, gratuït) amb `leaflet.markercluster` per agrupar marcadors si hi ha molts centres
- Projecció: OpenStreetMap tiles (gratuïtes)
- Dibuixar cercles: `L.circle` de Leaflet
- Coordenades: ja les tenim del servei de geocodificació (lat/lng)

### Possibles millores addicionals

- Desar orígens freqüents al localStorage
- Exportar resultats a CSV/Excel
- Vista combinada: taula i mapa side-by-side
- Impressió del mapa amb resultats
- Calcular rutes reals (amb OSRM o GraphHopper) en lloc de distància en línia recta
