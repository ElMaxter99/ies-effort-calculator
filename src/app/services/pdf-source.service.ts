import { Injectable } from '@angular/core';

export type Cos = 'secundaria' | 'primaria';

export interface OfficialPdfLink {
  label: string;
  url: string;
}

interface CachedEntry {
  timestamp: number;
  links: OfficialPdfLink[];
}

const SOURCES: Record<Cos, { path: string; contentId: string }> = {
  secundaria: { path: '/va/web/rrhh-educacion/vacantes1', contentId: '393689004' },
  primaria: { path: '/va/web/rrhh-educacion/plazas', contentId: '162946306' },
};

const KEYWORD_HINT = /vacant|llistat|resoluci/i;
const CACHE_PREFIX = 'ies_pdf_source_';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class PdfSourceService {
  private memoryCache = new Map<Cos, CachedEntry>();

  async fetchOfficialPdfs(cos: Cos): Promise<OfficialPdfLink[]> {
    const cached = this.getCached(cos);
    if (cached) return cached;

    const source = SOURCES[cos];

    try {
      const res = await fetch(`/api/ceice${source.path}`);
      if (!res.ok) return [];

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const container =
        doc.querySelector(`.journal-content-article[data-analytics-asset-id="${source.contentId}"]`) ?? doc;

      let links = this.extractPdfLinks(container);
      if (links.length === 0 && container !== doc) {
        links = this.extractPdfLinks(doc).filter((l) => KEYWORD_HINT.test(l.label));
      }

      this.setCached(cos, links);
      return links;
    } catch {
      return [];
    }
  }

  private extractPdfLinks(root: ParentNode): OfficialPdfLink[] {
    const anchors = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href*=".pdf"]'));
    const seen = new Set<string>();
    const links: OfficialPdfLink[] = [];

    for (const a of anchors) {
      const href = a.getAttribute('href');
      const label = a.textContent?.trim();
      if (!href || !label) continue;

      let url: string;
      try {
        url = new URL(href, 'https://ceice.gva.es').toString();
      } catch {
        continue;
      }

      if (seen.has(url)) continue;
      seen.add(url);
      links.push({ label, url });
    }

    return links;
  }

  private getCached(cos: Cos): OfficialPdfLink[] | null {
    const inMemory = this.memoryCache.get(cos);
    if (inMemory && Date.now() - inMemory.timestamp < CACHE_TTL_MS) {
      return inMemory.links;
    }

    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + cos);
      if (!raw) return null;
      const entry = JSON.parse(raw) as CachedEntry;
      if (Date.now() - entry.timestamp >= CACHE_TTL_MS) return null;
      this.memoryCache.set(cos, entry);
      return entry.links;
    } catch {
      return null;
    }
  }

  private setCached(cos: Cos, links: OfficialPdfLink[]) {
    const entry: CachedEntry = { timestamp: Date.now(), links };
    this.memoryCache.set(cos, entry);
    try {
      sessionStorage.setItem(CACHE_PREFIX + cos, JSON.stringify(entry));
    } catch {
      // sessionStorage full or unavailable
    }
  }
}
