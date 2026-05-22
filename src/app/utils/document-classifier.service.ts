import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, firstValueFrom, from, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { DocumentType } from './drec.enum';
import {
  ClassificationResult,
  classifyByKeywords,
  CLASSIFIABLE_TYPES,
} from './document-keywords';

const HAIKU_FALLBACK_THRESHOLD = 0.6;
const SLD_MAX_LONG_EDGE_PX = 2048;
const SLD_MAX_PAGES = 2;

export interface ExtractedField<T> {
  value: T;
  confidence: number;
  /** Optional region pointer into the source document — 1-based page
   *  number plus a normalised bounding box (0..1, page treated as
   *  1x1). Set by the hybrid Tesseract pass when the value's literal
   *  string is locatable in the OCR output, or as a fallback by the
   *  model itself when prompted for one. Lets the UI's verify-source
   *  modal highlight the exact location to the registrant. */
  region?: {
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
  };
  /** 'tesseract' when the bbox came from a pixel-exact OCR token
   *  match; 'model' when we fell back to Haiku's estimate. The verify
   *  dialog styles the two differently (solid vs. dashed) so the
   *  user knows which to trust. */
  regionSource?: 'tesseract' | 'model';
  /** One-line justification — what specifically in the doc the model
   *  used to derive this value. Surfaced in the verify dialog so the
   *  registrant can scan the diagram for the basis even when the
   *  bbox is approximate. */
  reasoning?: string;
}

export interface CodExtractedFields {
  commissioningDate?: ExtractedField<string>;
  facilityName?: ExtractedField<string>;
  acCapacityKw?: ExtractedField<number>;
  ownerName?: ExtractedField<string>;
  utilityOrIssuer?: ExtractedField<string>;
  country?: ExtractedField<string>;
  offTakerName?: ExtractedField<string>;
  measurementIds?: ExtractedField<string[]>;
  reasoning: string;
}

export interface MeterIdsExtractedFields {
  measurementIds?: ExtractedField<string[]>;
  inverterMakeModel?: ExtractedField<string>;
  reasoning: string;
}

export interface Sf02ExtractedFields {
  facilityName?: ExtractedField<string>;
  acCapacityKw?: ExtractedField<number>;
  commissioningDate?: ExtractedField<string>;
  deviceTypeCode?: ExtractedField<string>;
  ownerLegalName?: ExtractedField<string>;
  ownerAddress?: ExtractedField<string>;
  ownerCountry?: ExtractedField<string>;
  latitude?: ExtractedField<number>;
  longitude?: ExtractedField<number>;
  inverterCount?: ExtractedField<number>;
  moduleCount?: ExtractedField<number>;
  networkOwner?: ExtractedField<string>;
  reasoning: string;
}

export interface Sf02cExtractedFields {
  projectName?: ExtractedField<string>;
  ownerLegalName?: ExtractedField<string>;
  ownerAddress?: ExtractedField<string>;
  ownerCountry?: ExtractedField<string>;
  signingDate?: ExtractedField<string>;
  signatoryName?: ExtractedField<string>;
  signatoryEmail?: ExtractedField<string>;
  reasoning: string;
}

export interface SourceAccessModeSuggestion {
  /** One of the SourceAccessMode enum *keys* (Mode1_DirectAPI /
   *  Mode2_PortalAccess / Mode3_FileSubmission) or null when Haiku
   *  can't map the document to a mode (Mode 4 territory or
   *  ambiguous). The caller is responsible for translating the key
   *  into the display string the form expects. */
  suggestedMode?: ExtractedField<string>;
  /** Human-readable description of the document shape Haiku saw —
   *  surfaced in the apply-to-form modal so the registrant can sanity
   *  check the suggestion. */
  evidenceShape?: ExtractedField<string>;
  reasoning: string;
}

export interface SldExtractedFields {
  networkOwner?: ExtractedField<string>;
  hasNetworkMeter?: ExtractedField<boolean>;
  gridExportType?: ExtractedField<string>;
  hasAuxiliaryEnergySources?: ExtractedField<boolean>;
  auxiliaryEnergySourceDetails?: ExtractedField<string>;
  hasCaptiveConsumer?: ExtractedField<boolean>;
  acCapacityKw?: ExtractedField<number>;
  dcCapacityKwp?: ExtractedField<number>;
  inverterCount?: ExtractedField<number>;
  inverterCapacityKw?: ExtractedField<number>;
  inverterMakeModel?: ExtractedField<string>;
  moduleCount?: ExtractedField<number>;
  moduleWattage?: ExtractedField<number>;
  gridVoltage?: ExtractedField<string>;
  gridTied?: ExtractedField<boolean>;
  zeroExport?: ExtractedField<boolean>;
  transformerKva?: ExtractedField<number>;
  reasoning: string;
}

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
  constructor(private http: HttpClient) {}

  /** SHA-256 of the file bytes, hex-encoded. Used as the cache key
   *  on every AI extraction call so a re-uploaded document hits the
   *  backend's response cache instead of re-running OCR + Haiku. */
  private async sha256OfFile(file: File): Promise<string> {
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buf);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return '';
    }
  }

  /**
   * Classify a file and suggest a DocumentType.
   * Returns null if confidence is too low.
   *
   * `onProgress` is called with a short human-readable substep label
   * at each transition so the caller can render granular progress
   * during the slow phases (OCR on a photo can take 30 s; Haiku
   * round-trip 1-3 s).
   */
  classify(
    file: File,
    onProgress?: (step: string) => void,
  ): Observable<ClassificationResult | null> {
    if (!this.isClassifiable(file)) return of(null);
    return from(this.classifyAsync(file, onProgress));
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
    onProgress?: (step: string) => void,
  ): Promise<ClassificationResult | null> {
    const tick = (s: string) => onProgress?.(s);
    // Tier 0: filename heuristics (instant, no OCR needed)
    tick('checking filename');
    const fnResult = this.classifyByFilename(file.name);
    if (fnResult) return fnResult;

    try {
      let text = '';
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        tick('reading PDF text layer');
        text = await this.extractPdfTextLayer(file);
      } else if (/\.(xlsx?|csv)$/i.test(file.name)) {
        // Excel / CSV monthly meter reports were silently routed to
        // PROJECT_PHOTOS because OCR on a non-renderable spreadsheet
        // yielded nothing and the classifier had only the filename
        // ("MM_YYYY_Plant_…xls") to work with. Pull the column
        // headers + first ~15 rows so the keyword pass can latch on
        // to "PV(kWh) / Sell(kWh) / Buy(kWh) / Meter / kWh / Plant"
        // signals before falling back to Haiku.
        tick('reading spreadsheet');
        text = await this.extractSpreadsheetText(file);
      }
      if (!text || text.trim().length < 10) {
        tick(
          file.type.startsWith('image/')
            ? 'OCR on image (slow)…'
            : 'OCR fallback (slow)…',
        );
        const canvas = await this.renderFirstPage(file);
        text = await this.ocrCanvas(canvas);
      }
      if (!text || text.trim().length < 10) {
        if (file.type.startsWith('image/')) {
          // Even when OCR was thin, a screenshot of a meter portal
          // sometimes leaks just enough characters to clear the
          // meter-signal bar — re-check before defaulting to photos.
          if (this.hasMeterSignals(text)) {
            return {
              suggestedType: DocumentType.METERING_EVIDENCE,
              confidence: 0.55,
              method: 'keywords',
              alternatives: [],
            };
          }
          return {
            suggestedType: DocumentType.PROJECT_PHOTOS,
            confidence: 0.4,
            method: 'keywords',
            alternatives: [],
          };
        }
        return null;
      }
      tick('keyword scoring');
      const kwResult = classifyByKeywords(text);

      if (
        kwResult &&
        kwResult.suggestedType === DocumentType.OTHER_DOCUMENTS &&
        file.type.startsWith('image/')
      ) {
        // Same trapdoor as above: keyword classifier didn't strongly
        // pick a category, but the OCR'd text has unambiguous meter-
        // portal vocabulary. Don't silently file as Site Photo.
        if (this.hasMeterSignals(text)) {
          return {
            suggestedType: DocumentType.METERING_EVIDENCE,
            confidence: 0.6,
            method: 'keywords',
            alternatives: [],
          };
        }
        return {
          suggestedType: DocumentType.PROJECT_PHOTOS,
          confidence: 0.45,
          method: 'keywords',
          alternatives: [],
        };
      }

      // Spreadsheet meter-signal trapdoor: same idea as the image one,
      // but spreadsheets/CSVs aren't image types. A CSV with row after
      // row of "kWh" column values (the Atsawa export shape:
      // "timestamp,Solar Yield,PV to grid,…" with units "kWh,kWh,…")
      // gets flagged as METERING_EVIDENCE rather than dropped into
      // OTHER_DOCUMENTS or routed to Haiku as a coin flip.
      if (
        /\.(xlsx?|csv)$/i.test(file.name) &&
        (!kwResult ||
          kwResult.suggestedType === DocumentType.OTHER_DOCUMENTS ||
          kwResult.confidence < 0.6) &&
        this.hasMeterSignals(text)
      ) {
        return {
          suggestedType: DocumentType.METERING_EVIDENCE,
          confidence: 0.7,
          method: 'keywords',
          alternatives: [],
        };
      }

      if (
        !file.type.startsWith('image/') &&
        (!kwResult || kwResult.confidence < HAIKU_FALLBACK_THRESHOLD)
      ) {
        tick('asking Haiku…');
        const hash = await this.sha256OfFile(file);
        const haiku = await this.classifyViaHaiku(file.name, text, hash);
        if (haiku && (!kwResult || haiku.confidence > kwResult.confidence)) {
          return this.applyJpegMeteringGate(file, haiku, text);
        }
      }

      return this.applyJpegMeteringGate(file, kwResult, text);
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
  /**
   * JPEG is USUALLY a site photo (camera/aerial) rather than a
   * meter screenshot — meter portals typically export PNG/PDF. So
   * when the classifier picks METERING_EVIDENCE on a .jpg/.jpeg we
   * normally downgrade to PROJECT_PHOTOS.
   *
   * Exception: if the OCR'd text contains hard structural meter
   * signals (column-header words like "kWh", "PV", "Sell", "Buy",
   * "Meter", or a "Monthly Report" / "Plant" tabular header), trust
   * the classifier. Real meter screenshots saved as JPEG (browser
   * screenshot tools, mobile captures of inverter portals) DO exist
   * and shouldn't get silently filed under Project Photos.
   */
  private applyJpegMeteringGate(
    file: File,
    result: ClassificationResult | null,
    ocrText: string = '',
  ): ClassificationResult | null {
    if (!result) return result;
    if (result.suggestedType !== DocumentType.METERING_EVIDENCE) return result;
    const isJpeg =
      file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
    if (!isJpeg) return result;

    // Strong-meter signal in OCR text → keep METERING, skip the
    // photo-downgrade.
    if (this.hasMeterSignals(ocrText)) {
      return result;
    }

    return {
      ...result,
      suggestedType: DocumentType.PROJECT_PHOTOS,
      confidence: Math.min(result.confidence ?? 0.5, 0.6),
      alternatives: [
        ...(result.alternatives ?? []),
        {
          type: DocumentType.METERING_EVIDENCE,
          confidence: result.confidence ?? 0.5,
        },
      ],
    };
  }

  private classifyByFilename(name: string): ClassificationResult | null {
    const lower = name.toLowerCase();
    const isImage = /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(name);

    // Strong filename hints that an image is a site / project photo —
    // catches the common "detected panels.jpg", "site photo 2.jpg",
    // "drone view.png" cases before the Haiku vision pass guesses
    // wrong (e.g. nudges toward Metering Evidence at 25 % conf).
    if (
      isImage &&
      /\b(panels?|site\b|photo|picture|drone|aerial|exterior|installation|view|setup)\b/i.test(
        lower,
      )
    ) {
      return {
        suggestedType: DocumentType.PROJECT_PHOTOS,
        confidence: 0.85,
        method: 'keywords',
        alternatives: [],
      };
    }

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
    // Proof of Ownership (deed / lease / PPA) — match BEFORE the OD-letter
    // patterns so a filename like "proof of ownership.pdf" lands in the
    // PROOF_OF_OWNERSHIP slot, not in the SF-02c (OD letter) slot.
    if (/proof.{0,3}of.{0,3}own/i.test(lower)) {
      return {
        suggestedType: DocumentType.PROOF_OF_OWNERSHIP,
        confidence: 0.85,
        method: 'keywords',
        alternatives: [],
      };
    }
    if (/title.{0,3}deed|lease.{0,5}agreement|ppa\b|purchase.{0,5}agreement|land.{0,3}registry/i.test(lower)) {
      return {
        suggestedType: DocumentType.PROOF_OF_OWNERSHIP,
        confidence: 0.8,
        method: 'keywords',
        alternatives: [],
      };
    }
    // SF-02c filename + owner/declaration tokens → the I-REC OD letter.
    if (
      /(?<![a-z0-9])sf.?02c?(?![a-z0-9])/i.test(lower) &&
      /owner|declaration/i.test(lower)
    ) {
      return {
        suggestedType: DocumentType.SF_02C,
        confidence: 0.85,
        method: 'keywords',
        alternatives: [],
      };
    }
    // "OD" (uppercase, standalone token) is the in-house abbreviation for
    // Owner's Declaration — e.g. "Atsawa_OD letter.pdf". Case-sensitive
    // against the raw name so we don't false-positive on substrings of
    // lowercase words ("good", "mood", "body", …).
    if (/(?<![A-Za-z0-9])OD(?![A-Za-z0-9])/.test(name)) {
      return {
        suggestedType: DocumentType.SF_02C,
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
    if (/owner.?s?.?decl/i.test(lower)) {
      return {
        suggestedType: DocumentType.SF_02C,
        confidence: 0.8,
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
   * Strong meter-portal vocabulary check on OCR'd text. Used to
   * keep JPEG/PNG screenshots of monthly reports from being
   * silently filed under Site Photos. Matches >=2 of:
   *   - "kWh" (column header, repeated in data rows)
   *   - "PV(kWh)" / "PV kWh"
   *   - "Sell(kWh)" / "Buy(kWh)" / "Import(kWh)" / "Export(kWh)"
   *   - "Monthly Report"
   *   - "Meter Reading" / "Meter ID" / "Meter SN" / "Meter Serial"
   */
  private hasMeterSignals(text: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    const meterHits =
      (t.match(/\bkwh\b/g) || []).length +
      (/\bpv\s*\(?kwh\)?/.test(t) ? 1 : 0) +
      (/\b(sell|buy|import|export)\s*\(?kwh\)?/.test(t) ? 1 : 0) +
      (/\bmonthly\s+report\b/.test(t) ? 1 : 0) +
      (/\bmeter\s*(reading|id|sn|serial)/.test(t) ? 1 : 0);
    return meterHits >= 2;
  }

  /**
   * Read the first sheet of an .xls / .xlsx / .csv as a flat string
   * — column headers + first ~15 rows — for the keyword classifier
   * to scan. SheetJS already lives in the bundle for the Excel
   * export feature.
   */
  private async extractSpreadsheetText(file: File): Promise<string> {
    try {
      const XLSX = await import('xlsx' as any);
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) return '';
      const sheet = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        blankrows: false,
        defval: '',
      }) as any[][];
      // Cap at first 15 rows × 12 cols — enough for column headers
      // ("PV(kWh)", "Sell(kWh)", "Plant", "Date", etc.) plus a few
      // sample rows.
      return rows
        .slice(0, 15)
        .map((r) => (r || []).slice(0, 12).map((c) => String(c ?? '')).join(' '))
        .join('\n')
        .trim();
    } catch (err) {
      console.warn('[DocumentClassifier] xlsx parse failed:', err);
      return '';
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

  /**
   * Vision-based field extraction from an SLD. Renders the first page
   * to canvas, downsamples so the long edge is ≤ 1600px (keeps the
   * payload under Anthropic's per-image limit and keeps token cost
   * sane), encodes as PNG base64, and posts to /ai/extract-sld-fields.
   * Returns null on any error so the upload flow doesn't break.
   */
  async extractSldFields(
    file: File,
    deviceId?: number,
  ): Promise<SldExtractedFields | null> {
    try {
      const canvases = await this.renderFirstNPages(file, SLD_MAX_PAGES);
      if (!canvases.length) return null;
      const images = canvases.map((c) => {
        const ds = this.downsampleToLongEdge(c, SLD_MAX_LONG_EDGE_PX);
        return {
          base64: ds.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''),
          mimeType: 'image/png' as const,
        };
      });
      // Vector SLDs (CAD exports) embed every label as real text.
      // Send the text layer alongside the rasterised image so Haiku
      // can read labels its vision pass might miss (small text in
      // dense schematics, e.g. "HUAWEI SUN2000-30KTL-M3").
      let text = '';
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        text = await this.extractPdfTextLayer(file);
      }
      const contentHash = await this.sha256OfFile(file);
      const res = await firstValueFrom(
        this.http.post<SldExtractedFields>(
          `${environment.API_URL}ai/extract-sld-fields`,
          {
            filename: file.name,
            images,
            ...(text && text.trim().length >= 20 ? { text } : {}),
            ...(deviceId ? { deviceId } : {}),
            ...(contentHash ? { contentHash } : {}),
          },
        ),
      );
      if (!res) return null;
      // Hybrid bbox: Tesseract finds the exact pixel location of each
      // value's literal string on the rendered canvases; we patch the
      // model's region (which is just an estimate at best) with that
      // when a match is found. Falls back to the model's region — or
      // none — when Tesseract can't locate the token. This is what
      // makes the verify-source UI's highlights pixel-accurate rather
      // than off-by-rows-of-text.
      try {
        const tokenMap = await this.buildTesseractTokenMap(canvases);
        this.patchRegionsFromTesseract(res, tokenMap);
      } catch (err) {
        console.warn('[DocumentClassifier] Tesseract bbox pass failed:', err);
      }
      return res;
    } catch (err) {
      console.warn('[DocumentClassifier] SLD extract failed:', err);
      return null;
    }
  }

  /** Per-page word-level OCR of a stack of canvases. Returns a map
   *  keyed by normalised token text → array of { page, x, y, w, h }
   *  bboxes (x/y/w/h normalised 0..1 against the canvas size, so the
   *  region travels with whatever scaling the UI ends up rendering at).
   *  Multiple entries per key when the same word appears more than
   *  once on a page; the matcher picks the longest contiguous span. */
  private async buildTesseractTokenMap(
    canvases: HTMLCanvasElement[],
  ): Promise<Map<string, Array<{ page: number; x: number; y: number; w: number; h: number }>>> {
    const map = new Map<string, Array<{ page: number; x: number; y: number; w: number; h: number }>>();
    const Tesseract = await import('tesseract.js' as any);
    const createWorker = Tesseract.createWorker || Tesseract.default?.createWorker;
    const worker = await createWorker('eng', 1);
    try {
      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        const result = await worker.recognize(canvas);
        const words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> =
          (result?.data?.words as any) ?? [];
        const W = canvas.width || 1;
        const H = canvas.height || 1;
        for (const w of words) {
          const text = (w.text || '').trim().toLowerCase();
          if (!text) continue;
          const bbox = w.bbox;
          if (!bbox) continue;
          const entry = {
            page: i + 1,
            x: bbox.x0 / W,
            y: bbox.y0 / H,
            w: (bbox.x1 - bbox.x0) / W,
            h: (bbox.y1 - bbox.y0) / H,
          };
          const existing = map.get(text);
          if (existing) existing.push(entry);
          else map.set(text, [entry]);
        }
      }
    } finally {
      await worker.terminate();
    }
    return map;
  }

  /** Walk every ExtractedField on the SLD result and patch its region
   *  with the Tesseract-derived bbox when the value's literal string
   *  appears in the OCR token map. Tags each region with
   *  regionSource: 'tesseract' (pixel-exact, value literally found) or
   *  'model' (Haiku's estimate, approximate — value likely derived /
   *  symbol-only / OCR-missed) so the UI can show whether the
   *  highlight is trustworthy. */
  /** Generic across SLD / SF-02c / COD / SF-02 — walks any object,
   *  patching every ExtractedField-shaped property with a Tesseract-
   *  derived bbox when its value (or reasoning) matches a unique-
   *  enough OCR token. Mutates in place. */
  private patchRegionsFromTesseract(
    result: Record<string, any>,
    tokenMap: Map<string, Array<{ page: number; x: number; y: number; w: number; h: number }>>,
  ): void {
    if (!result || typeof result !== 'object') return;
    // Short tokens (1-2 chars) are too risky to trust as exact matches
    // — a value of "2" (e.g. inverterCount) hits ANY stray digit on
    // the diagram (Fuse 2A, 3xCT split as ["3","x","CT"], etc.) and
    // the resulting "exact" highlight points at unrelated parts of
    // the SLD. Require ≥3 chars for the candidate AND the matched
    // token, AND require the matched token to be unique on its page
    // (one occurrence) so we don't pick the first of many "250a"s
    // when the value is a bare "250".
    const MIN_TOKEN_LEN = 3;
    for (const key of Object.keys(result)) {
      const field = (result as any)[key];
      if (!field || typeof field !== 'object' || !('value' in field)) continue;
      if (field.value == null) continue;
      const candidate = String(field.value).trim().toLowerCase();
      if (!candidate || candidate.length < MIN_TOKEN_LEN) {
        // Too short to safely match — fall through to model bbox.
        if (field.region) field.regionSource = 'model';
        continue;
      }
      // A "distinctive" token has letters AND is ≥5 chars — those
      // are safe to match even when they appear multiple times on
      // the page (e.g. "3p-125kw" labels two identical inverters;
      // either bbox is a valid highlight for the inverterCapacityKw
      // value). Pure-numeric / short tokens still require uniqueness
      // to prevent "250" matching one of N "250A" MCCB labels.
      const isDistinctive = (t: string) =>
        /[a-z]/.test(t) && t.length >= 5;
      const acceptHits = (
        t: string,
        hits: Array<{ page: number; x: number; y: number; w: number; h: number }>,
      ) => hits.length === 1 || (hits.length > 0 && isDistinctive(t));

      // Exact-token match
      const direct = tokenMap.get(candidate);
      if (direct && acceptHits(candidate, direct)) {
        field.region = direct[0];
        field.regionSource = 'tesseract';
        continue;
      }
      // Multi-word split
      const parts = candidate
        .split(/\s+/)
        .filter((p) => p.length >= MIN_TOKEN_LEN);
      const candidates = parts
        .map((p) => ({ token: p, hits: tokenMap.get(p) ?? [] }))
        .filter((c) => acceptHits(c.token, c.hits));
      if (candidates.length) {
        const best =
          candidates.find((c) => isDistinctive(c.token)) ?? candidates[0];
        field.region = best.hits[0];
        field.regionSource = 'tesseract';
        continue;
      }
      // Reasoning-guided match: when the value isn't a literal token
      // (booleans, derived numbers), the model's per-field reasoning
      // usually names the specific labels in the diagram that
      // justify the value — e.g. "ZERO EXPORT SMART METER label
      // below the busbar". Those words ARE in the OCR output. Pull
      // tokens ≥4 chars from the reasoning, look up each, and use
      // the first one that matches a unique Tesseract token.
      const reasoning = (field.reasoning ?? '') as string;
      if (reasoning) {
        const reasoningTokens = reasoning
          .toLowerCase()
          .split(/[^a-z0-9-]+/)
          .filter((t) => t.length >= 4);
        for (const t of reasoningTokens) {
          const hits = tokenMap.get(t);
          if (!hits?.length) continue;
          // Same rule: accept multi-hit tokens only when distinctive
          // (letters + ≥5 chars). "smart" appearing once is fine;
          // "3p-125kw" appearing twice is still good (both labels
          // are valid matches for the same value).
          if (hits.length === 1 || (/[a-z]/.test(t) && t.length >= 5)) {
            field.region = hits[0];
            field.regionSource = 'tesseract';
            break;
          }
        }
        if (field.regionSource === 'tesseract') continue;
      }
      // No safe literal token match in either the value or the
      // reasoning. Fall back to model bbox if any, flagged so the
      // UI can hide it (since model bbox for derived values is
      // unreliable enough that we don't draw an arrow).
      if (field.region) {
        field.regionSource = 'model';
      }
    }
  }

  /** Send a METERING_EVIDENCE document to Haiku and ask which
   *  SourceAccessMode the document's *shape* implies (portal
   *  screenshot → Mode 2, API payload → Mode 1, source-linked CSV →
   *  Mode 3, hand-compiled spreadsheet → null Mode-4-candidate).
   *  Returns null on error so the upload flow doesn't break.
   *
   *  Renders the first 2 pages of a PDF; passes a single image
   *  through unchanged for PNG/JPEG. CSV/XLSX render badly via pdf.js
   *  so we bail early — those don't yield useful classifications. */
  async classifySourceAccessMode(
    file: File,
    deviceId?: number,
  ): Promise<SourceAccessModeSuggestion | null> {
    try {
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      if (['csv', 'xlsx', 'xls'].includes(ext)) {
        // Tabular formats — the shape doesn't classify visually.
        return null;
      }
      const canvases = await this.renderFirstNPages(file, SLD_MAX_PAGES);
      if (!canvases.length) return null;
      const images = canvases.map((c) => {
        const ds = this.downsampleToLongEdge(c, SLD_MAX_LONG_EDGE_PX);
        return {
          base64: ds.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''),
          mimeType: 'image/png' as const,
        };
      });
      let text = '';
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        text = await this.extractPdfTextLayer(file);
      }
      const contentHash = await this.sha256OfFile(file);
      const res = await firstValueFrom(
        this.http.post<SourceAccessModeSuggestion>(
          `${environment.API_URL}ai/classify-source-access-mode`,
          {
            filename: file.name,
            images,
            ...(text && text.trim().length >= 20 ? { text } : {}),
            ...(deviceId ? { deviceId } : {}),
            ...(contentHash ? { contentHash } : {}),
          },
        ),
      );
      return res ?? null;
    } catch (err) {
      console.warn('[DocumentClassifier] source-access-mode classify failed:', err);
      return null;
    }
  }

  async extractCodFields(
    file: File,
    deviceId?: number,
    siteName?: string,
  ): Promise<CodExtractedFields | null> {
    return this.runDocExtractionFE<CodExtractedFields>(
      'ai/extract-cod-fields',
      file,
      deviceId,
      false,
      siteName ? { siteName } : undefined,
    );
  }

  /** Tier 1 tesseract → Tier 3 Haiku-vision fallback.
   *  Most metering portals (Goodwe SemsPortal, SolarEdge Monitoring,
   *  Huawei FusionSolar) render clean digital text — Tesseract reads
   *  the SN candidates locally for $0. We only fall through to Haiku
   *  vision when the regex filter on the OCR'd text yields nothing
   *  (noisy photo, scanned nameplate, unusual font). */
  async extractMeterIds(
    file: File,
    deviceId?: number,
  ): Promise<MeterIdsExtractedFields | null> {
    try {
      const canvas = await this.renderFirstPage(file);
      const text = await this.ocrCanvas(canvas);
      const ids = this.extractSnCandidatesFromText(text);
      if (ids.length) {
        return {
          measurementIds: { value: ids, confidence: 0.7 },
          reasoning: `${ids.length} SN candidate(s) read via Tesseract`,
        };
      }
    } catch (err) {
      console.warn('[meter-ids] Tesseract pre-pass failed:', err);
    }
    return this.runDocExtractionFE<MeterIdsExtractedFields>(
      'ai/extract-meter-ids-fields',
      file,
      deviceId,
      /* preferVision */ true,
    );
  }

  /** Tokenise OCR'd text and keep only strings that look like a real
   *  hardware SN: contiguous alphanumeric 8-24 chars, mixing at
   *  least one letter AND one digit, no dashes, no kW/kWp unit
   *  suffix. Common dictionary words (Dashboard, Settings,
   *  Notifications…) fail the letter+digit rule even though they
   *  pass the length range — observed when monitoring portals
   *  OCR-leak their UI labels into the bag of tokens. */
  private extractSnCandidatesFromText(text: string): string[] {
    if (!text) return [];
    const SN_RE = /^[A-Za-z0-9]{8,24}$/;
    const UNIT_TAIL_RE = /(kw|kwp|kva|hz|v)$/i;
    const tokens = text.split(/[\s\n\r,;:|\t()/\\[\]{}<>]+/);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of tokens) {
      const t = raw.trim();
      if (!SN_RE.test(t) || UNIT_TAIL_RE.test(t)) continue;
      // Real hardware SNs almost always mix letters with digits
      // (e.g. ES2340051281, GW50K012345, 7E12345ABCD). Pure-letter
      // strings are dictionary words; pure-digit short strings are
      // dates / totals.
      const hasLetter = /[A-Za-z]/.test(t);
      const hasDigit = /\d/.test(t);
      if (!hasLetter || !hasDigit) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
    }
    return out;
  }

  async extractSf02Fields(
    file: File,
    deviceId?: number,
  ): Promise<Sf02ExtractedFields | null> {
    return this.runDocExtractionFE<Sf02ExtractedFields>(
      'ai/extract-sf02-fields',
      file,
      deviceId,
    );
  }

  /** Shared text-or-vision extraction client used by COD / SF-02 /
   *  SF-02c / meter-ids. `preferVision` flips the order so metering
   *  screenshots (which are usually images) skip the PDF text-layer
   *  branch. */
  private async runDocExtractionFE<T>(
    endpointPath: string,
    file: File,
    deviceId: number | undefined,
    preferVision = false,
    extras?: Record<string, any>,
  ): Promise<T | null> {
    try {
      let text = '';
      if (
        !preferVision &&
        (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))
      ) {
        text = await this.extractPdfTextLayer(file);
      }
      const payload: any = { filename: file.name };
      if (deviceId) payload.deviceId = deviceId;
      if (extras) Object.assign(payload, extras);
      const contentHash = await this.sha256OfFile(file);
      if (contentHash) payload.contentHash = contentHash;
      if (text && text.trim().length >= 40) {
        payload.text = text;
      } else {
        const canvases = await this.renderFirstNPages(file, 2);
        payload.images = canvases.map((c) => {
          const ds = this.downsampleToLongEdge(c, 2048);
          return {
            base64: ds.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''),
            mimeType: 'image/png' as const,
          };
        });
      }
      const res = await firstValueFrom(
        this.http.post<T>(`${environment.API_URL}${endpointPath}`, payload),
      );
      if (!res) return null;
      // Phase 2: Tesseract bbox pass for verify-source. Skip for the
      // meter-ids endpoint — its result shape is a string[] list, not
      // individual ExtractedFields that benefit from per-field bboxes
      // (the per-id docs are already tracked separately in the UI).
      if (!endpointPath.includes('meter-ids')) {
        try {
          const canvases = await this.renderFirstNPages(file, 2);
          const tokenMap = await this.buildTesseractTokenMap(canvases);
          this.patchRegionsFromTesseract(res as any, tokenMap);
        } catch (err) {
          console.warn(`[DocumentClassifier] ${endpointPath} Tesseract pass failed:`, err);
        }
      }
      return res;
    } catch (err) {
      console.warn(`[DocumentClassifier] ${endpointPath} failed:`, err);
      return null;
    }
  }

  /**
   * Text-first extraction of SF-02c fields. Tries the embedded PDF
   * text layer (cheap path) and falls back to vision pages if the
   * layer is empty (true scans). Returns null on error so the upload
   * flow doesn't break.
   */
  async extractSf02cFields(
    file: File,
    deviceId?: number,
  ): Promise<Sf02cExtractedFields | null> {
    try {
      let text = '';
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        text = await this.extractPdfTextLayer(file);
      }
      const payload: any = { filename: file.name };
      if (deviceId) payload.deviceId = deviceId;
      if (text && text.trim().length >= 40) {
        payload.text = text;
      } else {
        // True scan / no text layer — fall back to up to 2 page images.
        const canvases = await this.renderFirstNPages(file, 2);
        payload.images = canvases.map((c) => {
          const ds = this.downsampleToLongEdge(c, 2048);
          return {
            base64: ds.toDataURL('image/png').replace(/^data:image\/png;base64,/, ''),
            mimeType: 'image/png' as const,
          };
        });
      }
      const res = await firstValueFrom(
        this.http.post<Sf02cExtractedFields>(
          `${environment.API_URL}ai/extract-sf02c-fields`,
          payload,
        ),
      );
      if (!res) return null;
      // Phase 2: hybrid Tesseract bbox pass. Even for text-layer PDFs
      // we render the canvas once so the verify-source UI can
      // highlight the literal token positions, since the model's
      // bbox estimates without OCR backup tend to drift.
      try {
        const canvases = await this.renderFirstNPages(file, 2);
        const tokenMap = await this.buildTesseractTokenMap(canvases);
        this.patchRegionsFromTesseract(res, tokenMap);
      } catch (err) {
        console.warn('[DocumentClassifier] SF-02c Tesseract pass failed:', err);
      }
      return res;
    } catch (err) {
      console.warn('[DocumentClassifier] SF-02c extract failed:', err);
      return null;
    }
  }

  /** Render the first N pages of a PDF (or one page if image). Falls
   *  back to a single page on any error in the multi-page path. */
  private async renderFirstNPages(
    file: File,
    n: number,
  ): Promise<HTMLCanvasElement[]> {
    if (file.type.startsWith('image/')) {
      return [await this.imageToCanvas(file)];
    }
    try {
      let pdfjs = (window as any).pdfjsLib;
      if (!pdfjs) {
        pdfjs = await import('pdfjs-dist' as any);
      }
      pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';
      const buf = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
      const pageCount = Math.min(pdf.numPages, n);
      const canvases: HTMLCanvasElement[] = [];
      for (let p = 1; p <= pageCount; p++) {
        const page = await pdf.getPage(p);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        canvases.push(canvas);
      }
      return canvases;
    } catch (err) {
      console.warn('[DocumentClassifier] multi-page render failed, falling back to page 1:', err);
      return [await this.renderFirstPage(file)];
    }
  }

  private downsampleToLongEdge(
    src: HTMLCanvasElement,
    maxLongEdgePx: number,
  ): HTMLCanvasElement {
    const longEdge = Math.max(src.width, src.height);
    if (longEdge <= maxLongEdgePx) return src;
    const scale = maxLongEdgePx / longEdge;
    const out = document.createElement('canvas');
    out.width = Math.round(src.width * scale);
    out.height = Math.round(src.height * scale);
    const ctx = out.getContext('2d')!;
    ctx.drawImage(src, 0, 0, out.width, out.height);
    return out;
  }

  /**
   * Tier 3: backend-mediated Haiku classification. Returns null on any
   * error so the keyword result still wins instead of failing the
   * whole classify call.
   */
  private async classifyViaHaiku(
    filename: string,
    text: string,
    contentHash?: string,
  ): Promise<ClassificationResult | null> {
    try {
      const res = await firstValueFrom(
        this.http.post<{
          suggestedType: string;
          confidence: number;
          reasoning: string;
        }>(`${environment.API_URL}ai/classify-document`, {
          filename,
          text,
          validTypes: CLASSIFIABLE_TYPES,
          ...(contentHash ? { contentHash } : {}),
        }),
      );
      if (!res || !res.suggestedType) return null;
      return {
        suggestedType: res.suggestedType as DocumentType,
        confidence: res.confidence,
        method: 'haiku',
        alternatives: [],
      };
    } catch (err) {
      console.warn('[DocumentClassifier] Haiku tier failed:', err);
      return null;
    }
  }
}
