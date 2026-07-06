# Changelog

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
