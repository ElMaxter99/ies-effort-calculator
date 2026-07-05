import { Injectable, signal } from '@angular/core';
import { IesRow, ProcessInfo } from '../types';
import { I18nService } from './i18n.service';

@Injectable({ providedIn: 'root' })
export class PdfParserService {
  process = signal<ProcessInfo>({ currentPage: 0, totalPages: 0, percentage: 0, message: '' });

  constructor(private i18n: I18nService) {}

  async parsePdf(file: File): Promise<IesRow[]> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    const t = this.i18n.t();
    this.process.set({ currentPage: 0, totalPages: pdf.numPages, percentage: 0, message: t.processingPDF });

    const allRows: IesRow[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      this.process.set({
        currentPage: i,
        totalPages: pdf.numPages,
        percentage: Math.round((i / pdf.numPages) * 100),
        message: t.pdfProcessingMessage(i, pdf.numPages),
      });

      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const modality = this.detectModality(content.items);
      const pageRows = this.groupByRow(content.items, modality);
      allRows.push(...pageRows);
    }

    this.process.set({
      currentPage: pdf.numPages,
      totalPages: pdf.numPages,
      percentage: 100,
      message: t.completeRows(allRows.length),
    });

    return allRows;
  }

  private detectModality(items: any[]): string {
    for (const item of items) {
      const txt = item.str.trim();
      if (txt.length > 10 && /^[\dA-Za-z]+\s*-\s*.+\s*\/\s*.+/.test(txt)) {
        return txt;
      }
    }
    return '';
  }

  private groupByRow(items: any[], modality: string): IesRow[] {
    const TOL = 3;
    const groups = new Map<number, any[]>();

    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / TOL) * TOL;
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y)!.push(item);
    }

    const rows: IesRow[] = [];
    const ySorted = [...groups.keys()].sort((a, b) => b - a);

    for (const y of ySorted) {
      const items = groups.get(y)!;

      let num = 0;
      let centre = '';
      let locality = '';
      let code = '';
      let locationCode = '';
      let observations = '';

      let isItinerant = false;

      for (const item of items) {
        const x = Math.round(item.transform[4]);
        const text = item.str;

        if (x >= 485 && /^\d{8}$/.test(text)) {
          code = text;
        } else if (x >= 485 && text.length >= 6 && /^\d{6,8}$/.test(text)) {
          code = text;
        } else if (x >= 70 && x <= 89 && /^\d{6,8}$/.test(text)) {
          locationCode = text;
        } else if (x >= 27 && x <= 45 && /^\d+$/.test(text)) {
          num = parseInt(text, 10);
        } else if (x >= 95 && x <= 120 && text.length > 2) {
          locality = text;
        } else if (x >= 230 && x <= 260 && text.length > 2) {
          centre = text;
        } else if (x >= 550) {
          observations = (observations ? observations + ' ' : '') + text;
        }

        if (/ITIN|itinerant|ü|º/u.test(text)) {
          isItinerant = true;
        }
      }

      if ((centre || locality) && !centre.startsWith('CENTRE') && !locality.startsWith('LOCALITAT') && num > 0) {
        const cleanObservations = observations.replace(/[üº]/g, '').trim();
        let itinerantCentre: string | undefined;
        let hours: string | undefined;

        if (isItinerant) {
          const obsClean = cleanObservations;
          const matchHours = obsClean.match(/(\d+[,.]?\d*)/);
          if (matchHours) hours = matchHours[1];

          const parts = obsClean.replace(/-\s*\d+[,.]?\d*/, '').trim();
          if (parts && /IES|CENTRE|COL\.?|CEIP/i.test(parts)) {
            itinerantCentre = parts.replace(/[üº]/g, '').trim();
          }
        }

        rows.push({ number: num, centre, locality, code, locationCode, observations: cleanObservations, isItinerant, itinerantCentre, hours, modality });
      }
    }

    rows.sort((a, b) => a.number - b.number);
    return rows;
  }

  groupByCentre(records: IesRow[]): Map<string, { name: string; locality: string; code: string; positions: IesRow[]; totalItinerants: number }> {
    const centres = new Map<string, { name: string; locality: string; code: string; positions: IesRow[]; totalItinerants: number }>();

    for (const r of records) {
      if (!r.centre && !r.code) continue;

      const key = r.code || r.centre;
      if (!centres.has(key)) {
        centres.set(key, { name: r.centre, locality: r.locality, code: r.code, positions: [], totalItinerants: 0 });
      }

      const existing = centres.get(key)!;
      if (!existing.name && r.centre) existing.name = r.centre;
      if (!existing.locality && r.locality) existing.locality = r.locality;
      if (r.isItinerant) existing.totalItinerants++;
      existing.positions.push(r);
    }

    return centres;
  }
}
