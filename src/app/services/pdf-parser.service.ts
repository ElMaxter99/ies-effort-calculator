import { Injectable, signal } from '@angular/core';
import { IesRow, ProcesInfo } from '../types';

@Injectable({ providedIn: 'root' })
export class PdfParserService {
  proces = signal<ProcesInfo>({ paginaActual: 0, totalPagines: 0, percentatge: 0, missatge: '' });

  async parsearPdf(file: File): Promise<IesRow[]> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;

    this.proces.set({ paginaActual: 0, totalPagines: pdf.numPages, percentatge: 0, missatge: 'Iniciant càrrega...' });

    const totesLesFiles: IesRow[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      this.proces.set({
        paginaActual: i,
        totalPagines: pdf.numPages,
        percentatge: Math.round((i / pdf.numPages) * 100),
        missatge: `Processant pàgina ${i} de ${pdf.numPages}...`
      });

      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const filesPagina = this.agruparPerFila(content.items);
      totesLesFiles.push(...filesPagina);
    }

    this.proces.set({
      paginaActual: pdf.numPages,
      totalPagines: pdf.numPages,
      percentatge: 100,
      missatge: `Complet! ${totesLesFiles.length} registres processats.`
    });

    return totesLesFiles;
  }

  private agruparPerFila(items: any[]): IesRow[] {
    const TOL = 3;
    const grups = new Map<number, any[]>();

    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / TOL) * TOL;
      if (!grups.has(y)) grups.set(y, []);
      grups.get(y)!.push(item);
    }

    const files: IesRow[] = [];
    const yOrdenades = [...grups.keys()].sort((a, b) => b - a);

    for (const y of yOrdenades) {
      const ítems = grups.get(y)!;

      let num = 0;
      let centre = '';
      let localitat = '';
      let codiCentre = '';
      let codiLloc = '';
      let observacions = '';

      let itinerant = false;

      for (const item of ítems) {
        const x = Math.round(item.transform[4]);
        const text = item.str;

        if (x >= 485 && /^\d{8}$/.test(text)) {
          codiCentre = text;
        } else if (x >= 485 && text.length >= 6 && /^\d{6,8}$/.test(text)) {
          codiCentre = text;
        } else if (x >= 70 && x <= 89 && /^\d{6,8}$/.test(text)) {
          codiLloc = text;
        } else if (x >= 27 && x <= 45 && /^\d+$/.test(text)) {
          num = parseInt(text, 10);
        } else if (x >= 95 && x <= 120 && text.length > 2) {
          localitat = text;
        } else if (x >= 230 && x <= 260 && text.length > 2) {
          centre = text;
        } else if (x >= 550) {
          observacions = (observacions ? observacions + ' ' : '') + text;
        }

        if (/ITIN|itinerant/i.test(text)) {
          itinerant = true;
        }
      }

      if ((centre || localitat) && !centre.startsWith('CENTRE') && !localitat.startsWith('LOCALITAT') && num > 0) {
        const observacionsNeta = observacions.replace(/[üº]/g, '').trim();
        let centreItinerant: string | undefined;
        let hores: string | undefined;

        if (itinerant) {
          const obsNeta = observacionsNeta;
          const matchHores = obsNeta.match(/(\d+[,.]?\d*)/);
          if (matchHores) hores = matchHores[1];

          const parts = obsNeta.replace(/-\s*\d+[,.]?\d*/, '').trim();
          if (parts && /IES|CENTRE|COL\.?|CEIP/i.test(parts)) {
            centreItinerant = parts.replace(/[üº]/g, '').trim();
          }
        }

        files.push({ num, centre, localitat, codiCentre, codiLloc, observacions: observacionsNeta, itinerant, centreItinerant, hores });
      }
    }

    files.sort((a, b) => a.num - b.num);
    return files;
  }

  agruparPerCentre(registres: IesRow[]): Map<string, { nom: string; localitat: string; codiCentre: string; places: IesRow[]; totalItinerants: number }> {
    const centres = new Map<string, { nom: string; localitat: string; codiCentre: string; places: IesRow[]; totalItinerants: number }>();

    for (const r of registres) {
      if (!r.centre && !r.codiCentre) continue;

      const clau = r.codiCentre || r.centre;
      if (!centres.has(clau)) {
        centres.set(clau, { nom: r.centre, localitat: r.localitat, codiCentre: r.codiCentre, places: [], totalItinerants: 0 });
      }

      const existent = centres.get(clau)!;
      if (!existent.nom && r.centre) existent.nom = r.centre;
      if (!existent.localitat && r.localitat) existent.localitat = r.localitat;
      if (r.itinerant) existent.totalItinerants++;
      existent.places.push(r);
    }

    return centres;
  }
}
