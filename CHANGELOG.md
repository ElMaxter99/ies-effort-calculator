# Changelog

## [1.2.5] - 2026-07-11

### Security

- Upgraded `pdfjs-dist` from `4.4.168` to `4.10.38` to eliminate all transitive vulnerabilities reported by Snyk.

### Removed

- Removed vulnerable dependency chain: `canvas@2.x` → `@mapbox/node-pre-gyp@1.0.11` → `tar@6.2.1` (and associated packages `rimraf@3`, `glob@7`, `inflight@1`, `minimatch@3`, `brace-expansion@1`).

### Fixed CVEs

- **tar** — 13 issues including: SNYK-JS-TAR-17909152 (Allocation of Resources Without Limits or Throttling, CVE-2026-59873, CVSS 8.7), SNYK-JS-TAR-17909068 (Infinite loop, CVE-2026-59874, CVSS 8.7), SNYK-JS-TAR-15307072 (Directory Traversal, CVE-2026-26960, CVSS 8.4), SNYK-JS-TAR-15456201 (Symlink Attack, CVE-2026-31802, CVSS 8.2), SNYK-JS-TAR-15416075 (Symlink Attack, CVE-2026-29786, CVSS 8.2), SNYK-JS-TAR-17342362 (Interpretation Conflict, CVE-2026-53655, CVSS 6.9), SNYK-JS-TAR-17909104 (Incorrect Type Conversion, CVE-2026-59871, CVSS 6.9), SNYK-JS-TAR-17909225 (Uncaught Exception, CVE-2026-59875, CVSS 6.9), SNYK-JS-TAR-15038581 (Improper Unicode Handling, CVE-2026-23950, CVSS 6.4), SNYK-JS-TAR-15032660 (Directory Traversal, CVE-2026-23745, CVSS 6.0), SNYK-JS-TAR-15127355 (Directory Traversal, CVE-2026-24842, CVSS 6.2)
- **brace-expansion** — SNYK-JS-BRACEEXPANSION-17706650 (Inefficient Algorithmic Complexity, CVE-2026-13149, CVSS 8.7)
- **inflight** — SNYK-JS-INFLIGHT-6095116 (Missing Release of Resource, CVSS 6.2)

## [1.2.4]

- Previous release.
