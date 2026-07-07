# Changelog

## v1.2.3 (2026-07-07)

### Fixed
- Removed duplicate zoom controls on map (`L.control.zoom` was double with custom HTML buttons)

## v1.2.2 (2026-07-07)

### Fixed
- OSRM routing requests no longer hang indefinitely — added `AbortController` timeout (30s default, 60s for walking/bicycle)
- Reduced batch size for walking/cycling OSRM table requests (30 instead of 100) to prevent timeouts
- Injected `@vercel/analytics` — analytics was never initialized

## v1.2.1 (2026-07-07)

### Changed
- `.gitignore` — ignore entire `.vscode/` directory; remove it from Git tracking

## v1.2.0 (2026-07-07)

### Added
- Fallback geocoding via Nominatim (OpenStreetMap) for centres not found in local JSON database
- Centres missing from `ies-coordinates.json` now resolve coordinates by locality name

## v1.1.1 (2026-07-07)

### Fixed
- Restored app version label in header (regression from responsive refactor)
- Mobile table cards not rendering due to `max-lg:hidden` on scroll container
- View switching inconsistency on mobile (`currentView` desync when using bottom nav)

### Added
- Mobile bottom navigation: Table, Map, Filters, Configuration
- Distance sort controls in mobile table header (nearest / farthest)
- Sort by distance option in mobile filter bottom sheet
- Responsive layout for mobile: full-screen modals, card-based table view

### Changed
- Bottom nav filter button label shortened to "Filtres" / "Filtros"
- Map view on mobile hides floating overlays for cleaner display
- Replaced redundant filter button in mobile table bar with sort toggles

## v1.0.4 (2026-07-06)

### Security
- Upgrade `pdfjs-dist` from 4.2.67 to 4.4.168 (fixes 9 transitive vulnerabilities via `tar`)

## v1.0.3 (2026-07-06)

### Fixed
- App version label no longer depends on domain name (`hostname.includes('vercel.app')`)
- Use Vercel environment variable (`VERCEL_ENV`) via generated `env.ts` instead
- Fixed TypeScript error with `APP_ENV` literal type narrowing (TS2367)

### Changed
- Migrated from `isDevMode()` + hostname check to build-time `VERCEL_ENV` injection via `scripts/prebuild.cjs`

## v1.0.2 (2026-07-06)

### Security
- Upgrade `pdfjs-dist` from 4.0.379 to 4.2.67 (Snyk vulnerability fix)
- Auto-sync PDF worker from installed `pdfjs-dist` version on build/serve

### Changed
- Removed vendored `public/pdf.worker.min.mjs` — now copied from `node_modules` at build time via `angular.json` assets and prebuild script
- Renamed `scripts/update-version.cjs` → `scripts/prebuild.cjs` with additional worker copy logic

## v1.0.1 (2026-07-06)

### Added
- Dynamic version display in navbar (shows `v1.0.1` in production, `PRE` on Vercel preview, `LOCAL` in dev mode)
- Auto-sync script (`scripts/update-version.cjs`) that generates `version.ts` from `package.json` on build/serve

### Changed
- Removed duplicate Leaflet zoom control (`L.control.zoom`) — custom HTML zoom buttons already handle zoom in/out

## v1.0.0 (2026-07-06)

### Added
- Initial release of Distància IES
- PDF upload and parsing of teacher vacancy listings
- Geocoding and Haversine distance calculations
- OSRM driving/transit/walking/bicycle route integration
- Interactive Leaflet map with color-coded markers and distance circles
- Sortable/filterable data table
- Multi-origin comparison
- Catalan and Spanish language support
- Social media meta tags (Open Graph, Twitter Card)
- PWA manifest with proper branding
- Vercel Analytics integration
