import { Injectable, inject } from '@angular/core';
import { Cos, OfficialPdfLink } from '../types';
import { RegionService } from '../regions/region.service';
import { OfficialSource } from '../regions/region.types';

export type { Cos, OfficialPdfLink } from '../types';

interface CachedEntry {
  timestamp: number;
  links: OfficialPdfLink[];
}

const KEYWORD_HINT = /vacant|vacante|llistat|listado|resoluci|adxudicaci|adjudicaci/i;
const CACHE_PREFIX = 'ies_pdf_source_';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Rastrea el portal oficial de la comunidad activa en busca de enlaces a los
 * PDFs de vacantes.
 *
 * Es un extra, no el mecanismo principal: las administraciones cambian sus
 * URLs cada curso, así que cuando esto falla el usuario siempre puede subir el
 * PDF a mano. Por eso todos los fallos se tragan y devuelven lista vacía.
 */
@Injectable({ providedIn: 'root' })
export class PdfSourceService {
  private readonly region = inject(RegionService);
  private memoryCache = new Map<string, CachedEntry>();

  async fetchOfficialPdfs(cos: Cos): Promise<OfficialPdfLink[]> {
    const region = this.region.current();
    const source = region.officialSource;
    if (!source) return [];

    const cacheId = `${region.id}_${cos}`;
    const cached = this.getCached(cacheId);
    if (cached) return cached;

    const page = source.pages.find((p) => p.cos === cos);
    if (!page) return [];

    try {
      const res = await fetch(`${source.proxyPath}${page.path}`);
      if (!res.ok) return [];

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const container = page.contentId
        ? (doc.querySelector(`.journal-content-article[data-analytics-asset-id="${page.contentId}"]`) ?? doc)
        : doc;

      let links = this.extractPdfLinks(container, source);
      if (links.length === 0 && container !== doc) {
        links = this.extractPdfLinks(doc, source).filter((l) => KEYWORD_HINT.test(l.label));
      }

      if (page.match) {
        try {
          const filter = new RegExp(page.match, 'i');
          links = links.filter((l) => filter.test(l.label) || filter.test(decodeURIComponent(l.url)));
        } catch {
          // malformed match pattern → skip filter, return all links
        }
      }

      this.setCached(cacheId, links);
      return links;
    } catch {
      return [];
    }
  }

  private extractPdfLinks(root: ParentNode, source: OfficialSource): OfficialPdfLink[] {
    const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href]'));
    let isDocument: RegExp | null = null;
    try {
      isDocument = source.documentPattern ? new RegExp(source.documentPattern, 'i') : null;
    } catch {
      // malicious or malformed pattern → treat as "no extra document filter"
    }
    const seen = new Set<string>();
    const links: OfficialPdfLink[] = [];

    for (const a of anchors) {
      const href = a.getAttribute('href');
      const label = a.textContent?.trim();
      if (!href || !label) continue;

      // La extensión es la señal habitual, pero hay portales que sirven el PDF
      // desde una URL amistosa que no la lleva.
      if (!href.includes('.pdf') && !isDocument?.test(href)) continue;

      let url: string;
      try {
        url = new URL(href, source.baseUrl).toString();
      } catch {
        continue;
      }

      if (seen.has(url)) continue;
      seen.add(url);
      links.push({ label, url });
    }

    return links;
  }

  private getCached(cacheId: string): OfficialPdfLink[] | null {
    const inMemory = this.memoryCache.get(cacheId);
    if (inMemory && Date.now() - inMemory.timestamp < CACHE_TTL_MS) {
      return inMemory.links;
    }

    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + cacheId);
      if (!raw) return null;
      const entry = JSON.parse(raw) as CachedEntry;
      if (Date.now() - entry.timestamp >= CACHE_TTL_MS) return null;
      this.memoryCache.set(cacheId, entry);
      return entry.links;
    } catch {
      return null;
    }
  }

  private setCached(cacheId: string, links: OfficialPdfLink[]) {
    const entry: CachedEntry = { timestamp: Date.now(), links };
    this.memoryCache.set(cacheId, entry);
    try {
      sessionStorage.setItem(CACHE_PREFIX + cacheId, JSON.stringify(entry));
    } catch {
      // sessionStorage full or unavailable
    }
  }
}
