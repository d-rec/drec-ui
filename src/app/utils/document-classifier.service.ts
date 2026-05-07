import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { DocumentType } from './drec.enum';
import {
  ClassificationResult,
  classifyByKeywords,
  CLASSIFIABLE_TYPES,
} from './document-keywords';

/**
 * Zero-shot document classifier.
 *
 * Tier 1: OCR first page with Tesseract.js + pdfjs-dist, then keyword match.
 * Tier 2 (future): CLIP via @xenova/transformers for visual documents.
 *
 * Both Tesseract and pdfjs are already project dependencies and are
 * dynamically imported to avoid impacting initial bundle size.
 */
@Injectable({ providedIn: 'root' })
export class DocumentClassifierService {
  /**
   * Classify a file and suggest a DocumentType.
   * Returns null if confidence is too low.
   */
  classify(file: File): Observable<ClassificationResult | null> {
    if (!this.isClassifiable(file)) return of(null);
    return from(this.classifyAsync(file));
  }

  private isClassifiable(file: File): boolean {
    const type = file.type || '';
    const name = file.name.toLowerCase();
    return (
      type.startsWith('image/') ||
      type === 'application/pdf' ||
      name.endsWith('.pdf')
    );
  }

  private async classifyAsync(
    file: File,
  ): Promise<ClassificationResult | null> {
    // Tier 0: filename heuristics (instant, no OCR needed)
    const fnResult = this.classifyByFilename(file.name);
    if (fnResult) return fnResult;

    try {
      // For generated PDFs, the text layer is lossless — read it
      // directly and skip OCR. OCR-on-rasterized-text mangles
      // apostrophes, ligatures, and tight kerning, which can drop
      // the keyword score below threshold even on perfect input.
      let text = '';
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        text = await this.extractPdfTextLayer(file);
      }
      if (!text || text.trim().length < 10) {
        const canvas = await this.renderFirstPage(file);
        text = await this.ocrCanvas(canvas);
      }
      if (!text || text.trim().length < 10) {
        // OCR failed — for images, default to PROJECT_PHOTOS
        if (file.type.startsWith('image/')) {
          return {
            suggestedType: DocumentType.PROJECT_PHOTOS,
            confidence: 0.4,
            method: 'keywords',
            alternatives: [],
          };
        }
        return null;
      }
      const kwResult = classifyByKeywords(text);

      // Images that only match the OTHER_DOCUMENTS fallback are almost
      // certainly site photos — real "other" docs are PDFs/scans with text.
      if (
        kwResult &&
        kwResult.suggestedType === DocumentType.OTHER_DOCUMENTS &&
        file.type.startsWith('image/')
      ) {
        return {
          suggestedType: DocumentType.PROJECT_PHOTOS,
          confidence: 0.45,
          method: 'keywords',
          alternatives: [],
        };
      }

      return kwResult;
    } catch (err) {
      console.warn('[DocumentClassifier] classification failed:', err);
      return null;
    }
  }

  /**
   * Tier 0: classify based on filename patterns.
   * Fast, runs before OCR. Returns null if no strong filename match.
   *
   * NOTE on word boundaries: JS treats `_` as a word character, so
   * `\bsld\b` does not match `_sld_`. Real-world filenames almost
   * always separate tokens with `_`, ` `, `-`, or `.`. We use explicit
   * character-class lookarounds `(?<![a-z0-9])X(?![a-z0-9])` so the
   * heuristic still rejects substrings inside other words but matches
   * any non-alphanumeric separator.
   */
  private classifyByFilename(name: string): ClassificationResult | null {
    const lower = name.toLowerCase();

    if (/boundar/i.test(lower)) {
      return {
        suggestedType: DocumentType.FACILITY_BOUNDARY,
        confidence: 0.8,
        method: 'keywords',
        alternatives: [],
      };
    }
    if (/(?<![a-z0-9])sld(?![a-z0-9])|single.?line/i.test(lower)) {
      return {
        suggestedType: DocumentType.SINGLE_LINE_DIAGRAM,
        confidence: 0.8,
        method: 'keywords',
        alternatives: [],
      };
    }
    if (
      /(?<![a-z0-9])sf.?02c?(?![a-z0-9])/i.test(lower) &&
      /owner|declaration/i.test(lower)
    ) {
      return {
        suggestedType: DocumentType.SF_02C_OWNERS_DECLARATION,
        confidence: 0.8,
        method: 'keywords',
        alternatives: [],
      };
    }
    // "Proof of Ownership" is a deed / lease / purchase contract, not
    // the OD letter — file it under OTHER_DOCUMENTS until we add a
    // dedicated slot. Match before the OD heuristic below so it doesn't
    // get pulled into the declaration bucket.
    if (/proof.{0,3}of.{0,3}ownership/i.test(lower)) {
      return {
        suggestedType: DocumentType.OTHER_DOCUMENTS,
        confidence: 0.8,
        method: 'keywords',
        alternatives: [],
      };
    }
    // "OD" (uppercase, standalone token) is the field abbreviation for
    // Owner's Declaration — e.g. "Atsawa_OD letter.pdf". Match against
    // the original-case filename so we don't false-positive on substrings
    // of common lowercase words ("good", "mood", "body", …).
    if (/(?<![A-Za-z0-9])OD(?![A-Za-z0-9])/.test(name)) {
      return {
        suggestedType: DocumentType.SF_02C_OWNERS_DECLARATION,
        confidence: 0.75,
        method: 'keywords',
        alternatives: [],
      };
    }
    if (/(?<![a-z0-9])sf.?02c(?![a-z0-9])/i.test(lower)) {
      return {
        suggestedType: DocumentType.SF_02C,
        confidence: 0.8,
        method: 'keywords',
        alternatives: [],
      };
    }
    if (/(?<![a-z0-9])sf.?02(?![a-z0-9])/i.test(lower)) {
      return {
        suggestedType: DocumentType.FORM_SF_02,
        confidence: 0.8,
        method: 'keywords',
        alternatives: [],
      };
    }
    if (/(?<![a-z0-9])cod(?![a-z0-9])|commission/i.test(lower)) {
      return {
        suggestedType: DocumentType.COD_PROOF,
        confidence: 0.7,
        method: 'keywords',
        alternatives: [],
      };
    }
    if (/meter|kwh|mwh|reading|screenshot/i.test(lower)) {
      return {
        suggestedType: DocumentType.METERING_EVIDENCE,
        confidence: 0.7,
        method: 'keywords',
        alternatives: [],
      };
    }
    if (/owner.?s?.?decl|proof.?of.?own/i.test(lower)) {
      return {
        suggestedType: DocumentType.SF_02C_OWNERS_DECLARATION,
        confidence: 0.8,
        method: 'keywords',
        alternatives: [],
      };
    }
    if (/(?<![a-z0-9])od(?![a-z0-9]).{0,8}letter/i.test(lower)) {
      return {
        suggestedType: DocumentType.SF_02C_OWNERS_DECLARATION,
        confidence: 0.7,
        method: 'keywords',
        alternatives: [],
      };
    }

    return null;
  }

  /**
   * Render the first page of a PDF or an image to a canvas element.
   */
  private async renderFirstPage(file: File): Promise<HTMLCanvasElement> {
    if (file.type.startsWith('image/')) {
      return this.imageToCanvas(file);
    }
    return this.pdfFirstPageToCanvas(file);
  }

  private async imageToCanvas(file: File): Promise<HTMLCanvasElement> {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = url;
      });

      const maxDim = 2048;
      const scale = Math.min(
        1,
        maxDim / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Pull the embedded text layer from the first 2 pages of a PDF.
   * Generated PDFs (letters, exports) ship lossless text — no need to
   * raster + OCR it. Returns '' if the text layer is empty / scanned.
   */
  private async extractPdfTextLayer(file: File): Promise<string> {
    try {
      let pdfjs = (window as any).pdfjsLib;
      if (!pdfjs) {
        pdfjs = await import('pdfjs-dist' as any);
      }
      pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({
        data: new Uint8Array(arrayBuffer),
      }).promise;
      const pageCount = Math.min(pdf.numPages, 2);
      const chunks: string[] = [];
      for (let p = 1; p <= pageCount; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const pageText = tc.items
          .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
          .join(' ');
        chunks.push(pageText);
      }
      return chunks.join('\n');
    } catch (err) {
      console.warn('[DocumentClassifier] text-layer extract failed:', err);
      return '';
    }
  }

  private async pdfFirstPageToCanvas(
    file: File,
  ): Promise<HTMLCanvasElement> {
    let pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) {
      pdfjs = await import('pdfjs-dist' as any);
    }
    pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise;

    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas;
  }

  /**
   * OCR a canvas using Tesseract.js.
   * Uses a short-lived worker to avoid holding memory.
   */
  private async ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
    const Tesseract = await import('tesseract.js' as any);
    const createWorker =
      Tesseract.createWorker || Tesseract.default?.createWorker;

    const worker = await createWorker('eng', 1);
    try {
      const {
        data: { text },
      } = await worker.recognize(canvas);
      return text;
    } finally {
      await worker.terminate();
    }
  }
}
