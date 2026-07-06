# Changelog

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
