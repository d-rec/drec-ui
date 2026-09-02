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
const SLD_MAX_PAGES = 5;
/** Self-hosted PP-OCR field-box service (pixel-exact line boxes on dense
 *  SLDs, where tesseract.js fails). Stage prototype. */
const PADDLE_OCR_URL = 'https://paddleocr-stage.drecs.org';

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
  regionSource?: 'tesseract' | 'model' | 'paddleocr' | 'paddleocr-evidence';
  /** For derived values (a count, a boolean) there is no literal token to
   *  box. When PP-OCR can locate the lines that *evidence* the value —
   *  the three "INV 0n" labels behind "3 generating units" — they are
   *  listed here (normalised 0..1) so the verify view can highlight the
   *  basis instead of a meaningless estimated rectangle. */
  evidenceRegions?: Array<{
    page: number;
    x: number;
    y: number;
    w: number;
    h: number;
    text?: string;
  }>;
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
  stateProvince?: ExtractedField<string>;
  offTakerName?: ExtractedField<string>;
  measurementIds?: ExtractedField<string[]>;
  reasoning: string;
}

export interface MeterIdsExtractedFields {
  measurementIds?: ExtractedField<string[]>;
  inverterMakeModel?: ExtractedField<string>;
  // Portal "Info / Basic Information" overview fields (SolisCloud-style).
  capacityKwp?: ExtractedField<number>;
  commissioningDate?: ExtractedField<string>;
  plantType?: ExtractedField<string>;
  reasoning: string;
}

export interface Sf02ExtractedFields {
  facilityName?: ExtractedField<string>;
  facilityAddress?: ExtractedField<string>;
  acCapacityKw?: ExtractedField<number>;
  commissioningDate?: ExtractedField<string>;
  deviceTypeCode?: ExtractedField<string>;
  ownerLegalName?: ExtractedField<string>;
  ownerAddress?: ExtractedField<string>;
  ownerCountry?: ExtractedField<string>;
  ownerStateProvince?: ExtractedField<string>;
  latitude?: ExtractedField<number>;
  longitude?: ExtractedField<number>;
  inverterCount?: ExtractedField<number>;
  moduleCount?: ExtractedField<number>;
  networkOwner?: ExtractedField<string>;
  reasoning: string;
}

export interface Sf02cExtractedFields {
  projectName?: ExtractedField<string>;
  projectAddress?: ExtractedField<string>;
  ownerLegalName?: ExtractedField<string>;
  ownerAddress?: ExtractedField<string>;
  ownerCountry?: ExtractedField<string>;
  ownerStateProvince?: ExtractedField<string>;
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
      // Spreadsheets are classifiable too: classifyAsync reads their cells
      // (SheetJS) and, failing that, recognises them by filename via the AI /
      // Other-Documents fallback. Excluding them here meant classify() returned
      // null immediately, so they landed in "Other Document —" with no
      // confidence and could never be recognised.
      /\.(pdf|xlsx?|csv)$/i.test(name)
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
      const isSpreadsheet = /\.(xlsx?|csv)$/i.test(file.name);
      // OCR / PDF-render only makes sense for images and PDFs. A spreadsheet
      // has no rendered page — renderFirstPage() would try to parse the .xls
      // as a PDF and throw, which surfaced downstream as a null result
      // ("Other Document —") or an opaque ✗. Never render a spreadsheet.
      if ((!text || text.trim().length < 10) && !isSpreadsheet) {
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
          // OCR was useless — escalate to server-side Sonnet vision
          // instead of guessing from absence of text. The server picks
          // Sonnet automatically when an image is supplied with thin
          // text. Falls back to the prior binary heuristic only if the
          // vision call returns nothing.
          tick('asking vision model…');
          const visionImg = await this.fileToVisionImage(file);
          const hash = await this.sha256OfFile(file);
          if (visionImg) {
            const vision = await this.classifyViaHaiku(
              file.name,
              text || '',
              hash,
              [visionImg],
            );
            if (vision) return vision;
          }
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
        // A spreadsheet is always recognisable AS a spreadsheet, even when
        // SheetJS can't surface its cells in-browser. Let the AI recognise it
        // from the filename; failing that, file it in Other Documents with a
        // real confidence — never a null "—" or an opaque ✗ unrecognised.
        if (isSpreadsheet) {
          const hash = await this.sha256OfFile(file);
          const ai = await this.classifyViaHaiku(file.name, text || '', hash);
          if (ai) return ai;
          return {
            suggestedType: DocumentType.OTHER_DOCUMENTS,
            confidence: 0.6,
            method: 'keywords',
            alternatives: [],
          };
        }
        return null;
      }
      // Deterministic portal-signature short-circuit. If the OCR'd text
      // names a known monitoring portal or its device-list column
      // headers, classify METERING_EVIDENCE with high confidence and
      // skip the keyword/vision/Haiku ceremony. Saves a model round-
      // trip on the most-common misclassified case (Goodwe SemsPortal
      // screenshots landing in PROJECT_PHOTOS or OTHER_DOCUMENTS).
      if (this.hasPortalSignals(text)) {
        return {
          suggestedType: DocumentType.METERING_EVIDENCE,
          confidence: 0.95,
          method: 'keywords',
          alternatives: [],
        };
      }

      tick('keyword scoring');
      const kwResult = classifyByKeywords(text);

      if (
        file.type.startsWith('image/') &&
        (!kwResult ||
          kwResult.confidence < HAIKU_FALLBACK_THRESHOLD ||
          kwResult.suggestedType === DocumentType.OTHER_DOCUMENTS)
      ) {
        // Image with weak keyword evidence — defer to Sonnet vision
        // rather than the previous OCR-density heuristic. This is the
        // path that used to mis-route SemsPortal screenshots into
        // PROJECT_PHOTOS when their OCR text happened to be thin on
        // meter vocabulary.
        tick('asking vision model…');
        const visionImg = await this.fileToVisionImage(file);
        const hash = await this.sha256OfFile(file);
        if (visionImg) {
          const vision = await this.classifyViaHaiku(file.name, text, hash, [
            visionImg,
          ]);
          if (
            vision &&
            (!kwResult || vision.confidence >= kwResult.confidence)
          ) {
            return vision;
          }
        }
        if (this.hasMeterSignals(text)) {
          return {
            suggestedType: DocumentType.METERING_EVIDENCE,
            confidence: 0.6,
            method: 'keywords',
            alternatives: [],
          };
        }
        const wc = (text.match(/\b[\w-]{2,}\b/g) ?? []).length;
        if (wc >= 40 || text.trim().length >= 250) {
          return {
            suggestedType: DocumentType.OTHER_DOCUMENTS,
            confidence: 0.5,
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
      // Spreadsheets are essentially always meter / generation reports
      // in this app — monthly Plant_XXXX.xlsx, AppendixA meter data,
      // CSV exports from inverter portals, etc. Default the slot and
      // skip the Haiku-text fallback (which has been the source of
      // recurring misclassifications into OTHER_DOCUMENTS when SheetJS
      // text extraction didn't surface enough kWh/PV column hits).
      // Only deviate when the keyword classifier picked a non-meter,
      // non-OTHER slot with strong confidence.
      if (/\.(xlsx?|csv)$/i.test(file.name)) {
        const kwIsStrong =
          kwResult &&
          kwResult.confidence >= 0.75 &&
          kwResult.suggestedType !== DocumentType.OTHER_DOCUMENTS &&
          kwResult.suggestedType !== DocumentType.METERING_EVIDENCE;
        if (kwIsStrong) {
          return kwResult!;
        }
        return {
          suggestedType: DocumentType.METERING_EVIDENCE,
          confidence: this.hasMeterSignals(text) ? 0.85 : 0.7,
          method: 'keywords',
          alternatives: [],
        };
      }

      if (
        !file.type.startsWith('image/') &&
        (!kwResult || kwResult.confidence < HAIKU_FALLBACK_THRESHOLD)
      ) {
        const hash = await this.sha256OfFile(file);
        // Scanned / non-English PDFs (e.g. a Vietnamese EPC contract used
        // as proof of ownership) have no text layer and OCR to garbled
        // ASCII, so the English keyword dictionary matches nothing and
        // they land in Other Documents. Render page 1 and let the vision
        // model read it — it handles the language and classifies by
        // document shape, not keyword hits. Text-only fallback for
        // anything we can't render.
        const isPdf =
          file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
        const visionImg = isPdf ? await this.fileToVisionImage(file) : null;
        tick(visionImg ? 'asking vision model…' : 'asking Haiku…');
        const haiku = await this.classifyViaHaiku(
          file.name,
          text,
          hash,
          visionImg ? [visionImg] : undefined,
        );
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
    const isJpeg = file.type === 'image/jpeg' || /\.jpe?g$/i.test(file.name);
    if (!isJpeg) return result;

    // Strong-meter signal in OCR text → keep METERING, skip the
    // photo-downgrade.
    if (this.hasMeterSignals(ocrText)) {
      return result;
    }

    // Text-dense image (≥40 words / ≥250 chars of OCR) is clearly a
    // document / screenshot, not a real-world photo. Real site
    // photos OCR to a handful of stray glyphs at most. Keep
    // METERING — better wrong-bucket than a metering report landing
    // silently in Project Photos.
    const wordCount = (ocrText.match(/\b[\w-]{2,}\b/g) ?? []).length;
    if (wordCount >= 40 || ocrText.trim().length >= 250) {
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
    if (
      /title.{0,3}deed|lease.{0,5}agreement|ppa\b|purchase.{0,5}agreement|land.{0,3}registry/i.test(
        lower,
      )
    ) {
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

  /** Deterministic "this is a monitoring-portal screenshot" check.
   *  Matches any of the unmistakable strings that vendor portals
   *  always render on their device-list / plant-overview pages. Hits
   *  here short-circuit the model entirely — there's no value in
   *  asking Sonnet whether SemsPortal is METERING_EVIDENCE when the
   *  literal string "SemsPortal" is on screen. */
  private hasPortalSignals(text: string): boolean {
    if (!text) return false;
    const t = text.toLowerCase();
    // Monitoring-portal PRODUCT names only. Do NOT add registrant/company
    // names here: those appear in the contact details of every document a
    // customer submits (SF-02, SF-02C, ownership, COD…), so the short-
    // circuit would misfile all of them as Metering Evidence. 'powertrust'
    // was removed for exactly this — it matched "ricky@powertrust.com" in
    // an SF-02's Registrant Contact Details.
    const portalRe =
      /\b(semsportal|fusionsolar|solaredge\s+monitoring|enphase\s+enlighten|growatt\s+shinemonitor|huawei\s+fusionsolar|sungrow\s+isolarcloud|sma\s+sunny\s+portal|goodwe)\b/;
    if (portalRe.test(t)) return true;
    const tableCueRe =
      /\b(data\s*logger|inverter\s+sn|serial\s+no|plants\s+alarms\s+reports|station\s*info|device\s+list|inverter\s+replacement\s+history)\b/;
    return tableCueRe.test(t);
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
      // Scan up to 60 rows × 20 cols. Some monthly-report templates
      // park the "Monthly Report / PV(kWh) / Sell(kWh) / Plant"
      // headers around row 20 with cosmetic empty rows above (which
      // blankrows:false skips on the row axis but doesn't reorder).
      // 15-row window was too small — the classifier saw nothing and
      // silently filed the report under PROJECT_PHOTOS.
      return rows
        .slice(0, 60)
        .map((r) =>
          (r || [])
            .slice(0, 20)
            .map((c) => String(c ?? ''))
            .join(' '),
        )
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
      const pageCount = Math.min(pdf.numPages, 8);
      const chunks: string[] = [];
      for (let p = 1; p <= pageCount; p++) {
        const page = await pdf.getPage(p);
        const tc = await page.getTextContent();
        const pageText = tc.items
          .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
          .join(' ');
        chunks.push(pageText);
        // AcroForm field values aren't in the page content stream —
        // they live on Widget annotations. Without this, filled-in
        // SF-02 / SF-02c / etc forms come through as headers-only
        // (labels: "Facility name", "Facility address") with none of
        // the actual values, and Haiku quite reasonably reports
        // "no filled-in data fields".
        //
        // Wrap the annotations call in a hard timeout — pdf.js can
        // HANG (not throw) on certain widget trees, observed on
        // SF-02 forms with complex AcroForm hierarchies. Without the
        // timeout the whole extractPdfTextLayer hangs and the
        // upstream HTTP request never fires (silent fail).
        try {
          const anns = await Promise.race<any[]>([
            page.getAnnotations({ intent: 'display' }),
            new Promise<any[]>((_, reject) =>
              setTimeout(
                () => reject(new Error('pdf.js getAnnotations timeout')),
                5000,
              ),
            ),
          ]);
          const fieldLines: string[] = [];
          for (const a of anns ?? []) {
            if (a?.subtype !== 'Widget') continue;
            const name = (a.fieldName || '').trim();
            const valRaw = a.fieldValue;
            const val = Array.isArray(valRaw) ? valRaw.join(', ') : valRaw;
            if (val == null || val === '') continue;
            const valStr = String(val).trim();
            if (!valStr) continue;
            fieldLines.push(name ? `${name}: ${valStr}` : valStr);
          }
          if (fieldLines.length) {
            chunks.push(`[form fields p.${p}]\n${fieldLines.join('\n')}`);
          }
        } catch (err) {
          // pdf.js threw / timed out on annotations — fall through
          // with content-stream text only. Logged so the console
          // shows it.
          console.warn(
            `[DocumentClassifier] page ${p} annotations skipped:`,
            err,
          );
        }
      }
      return chunks.join('\n');
    } catch (err) {
      console.warn('[DocumentClassifier] text-layer extract failed:', err);
      return '';
    }
  }

  private async pdfFirstPageToCanvas(file: File): Promise<HTMLCanvasElement> {
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

    // Pre-process for Tesseract on a clone of the canvas so we don't
    // mutate the source (other callers — extractMeterIds, vision
    // classify — still need the full-colour image). Grayscale by
    // Rec. 601 luminance, then binarize at a fixed threshold so the
    // input Tesseract sees is identical regardless of OS-level color
    // management, ICC profile handling, or HiDPI resample paths —
    // those were silently shifting pixel values just enough to make
    // OCR on macOS Firefox much worse than the same JPEG on Linux.
    const prepared = this.binarizeForOcr(canvas);

    const worker = await createWorker('eng', 1);
    try {
      const {
        data: { text },
      } = await worker.recognize(prepared);
      return text;
    } finally {
      await worker.terminate();
    }
  }

  /** Return a black-and-white clone of the input canvas. Tesseract is
   *  most reliable on a 2-tone image; bypassing OS-level color
   *  management makes the result independent of which browser / OS
   *  the user is on. */
  private binarizeForOcr(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return canvas;
    ctx.drawImage(canvas, 0, 0);
    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, out.width, out.height);
    } catch {
      // tainted canvas (cross-origin image with no CORS) — fall back
      // to the un-processed canvas; better than throwing.
      return canvas;
    }
    const d = imageData.data;
    // Fixed threshold tuned for portal-screenshot text (white-on-
    // light-grey table cells with dark glyphs). Anything brighter
    // than 180/255 luminance becomes white, anything darker becomes
    // black. Stroke edges still survive because real glyphs are
    // <100 luminance even on Mac's contrast-compressed decode.
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = y > 180 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
    return out;
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
          base64: ds
            .toDataURL('image/png')
            .replace(/^data:image\/png;base64,/, ''),
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
      // Self-hosted PP-OCR: pixel-exact line boxes on dense SLDs where
      // tesseract.js fails. Overrides the region when it locates the
      // value (regionSource='paddleocr' = trusted, solid highlight).
      try {
        await this.patchRegionsFromPaddle(res, file);
      } catch (err) {
        console.warn('[DocumentClassifier] PaddleOCR bbox pass failed:', err);
      }
      return res;
    } catch (err) {
      console.warn('[DocumentClassifier] SLD extract failed:', err);
      return null;
    }
  }

  /** POST the SLD to the self-hosted PP-OCR service, then match each
   *  extracted value to the OCR line that contains it and overwrite the
   *  region with that pixel-exact box (regionSource='paddleocr'). The
   *  boxes are normalised 0..1 against the page, same convention as the
   *  tesseract/model regions, so they travel with the verify canvas.
   *  Best-effort — leaves the tesseract/model region if no line matches. */
  private async patchRegionsFromPaddle(
    res: SldExtractedFields,
    file: File,
  ): Promise<void> {
    const fd = new FormData();
    fd.append('file', file);
    const data = await firstValueFrom(
      this.http.post<{
        width: number;
        height: number;
        lines: Array<{ text: string; bbox: [number, number, number, number] }>;
      }>(`${PADDLE_OCR_URL}/ocr-fields`, fd),
    );
    if (!data?.lines?.length) return;
    const { width: W, height: H, lines } = data;
    const norm = (s: unknown) =>
      String(s ?? '').toUpperCase().replace(/[\s.,]/g, '');
    const findBox = (val: unknown) => {
      const q = norm(val);
      if (q.length < 3) return null; // avoid junk 1-2 char matches
      const hits = lines.filter((l) => norm(l.text).includes(q));
      if (!hits.length) return null;
      hits.sort((a, b) => norm(a.text).length - norm(b.text).length);
      const [x0, y0, x1, y1] = hits[0].bbox;
      return {
        page: 1,
        x: x0 / W,
        y: y0 / H,
        w: (x1 - x0) / W,
        h: (y1 - y0) / H,
      };
    };
    // Derived / boolean fields have no literal token to box. Highlight the
    // lines that evidence them instead (the three "INV 0n" labels behind
    // "3 generating units"), so the reviewer sees the basis rather than a
    // meaningless estimated rectangle.
    const EVIDENCE: Record<string, RegExp> = {
      inverterCount: /\bINV\s*0?\d+\b/i,
      moduleCount: /(MODULES|STRING)/i,
      moduleWattage: /\d+\s*W(p|P)?\b.*MODULE|MODULE.*\d+\s*W(p|P)?\b/i,
      hasNetworkMeter: /\b(kWh|METER)\b/i,
      hasAuxiliaryEnergySources: /\b(DIESEL|GENSET|GENERATOR|BATTERY|BESS)\b/i,
      gridInterconnection: /(SUPPLY\s*FROM|UTILITY|\bGRID\b|E\.?C\.?G)/i,
      gridExportType: /\b(EXPORT|BIDIRECTIONAL|kWh|METER)\b/i,
      hasCaptiveConsumer: /\b(LOAD|BUSBAR|CONSUMER)\b/i,
    };
    const toNorm = (bb: [number, number, number, number], text?: string) => ({
      page: 1,
      x: bb[0] / W,
      y: bb[1] / H,
      w: (bb[2] - bb[0]) / W,
      h: (bb[3] - bb[1]) / H,
      ...(text ? { text } : {}),
    });

    for (const key of Object.keys(res)) {
      const f = (res as Record<string, any>)[key];
      if (!f || typeof f !== 'object' || f.value == null || Array.isArray(f.value)) {
        continue;
      }
      const box = findBox(f.value);
      if (box) {
        f.region = box;
        f.regionSource = 'paddleocr';
        continue;
      }
      const rx = EVIDENCE[key];
      if (!rx) continue;
      const ev = lines
        .filter((l) => rx.test(l.text || ''))
        .slice(0, 8)
        .map((l) => toNorm(l.bbox, l.text));
      if (ev.length) {
        f.evidenceRegions = ev;
        f.regionSource = 'paddleocr-evidence';
        // Drop the model's misleading estimate — the evidence lines are
        // the honest answer for a derived value.
        delete f.region;
      }
    }
  }

  /** Per-page word-level OCR of a stack of canvases. Returns a map
   *  keyed by normalised token text → array of { page, x, y, w, h }
   *  bboxes (x/y/w/h normalised 0..1 against the canvas size, so the
   *  region travels with whatever scaling the UI ends up rendering at).
   *  Multiple entries per key when the same word appears more than
   *  once on a page; the matcher picks the longest contiguous span. */
  /** Scan a rendered canvas for tokens that match keywords from a
   *  reasoning string. Returns yellow-hint rects in 0..1 coords —
   *  used by the OC# walk to show "scan around here" hints for
   *  derived classifications that have no precise model bbox. */
  async findReasoningHints(
    canvas: HTMLCanvasElement,
    reasoning: string,
  ): Promise<Array<{ x: number; y: number; w: number; h: number }>> {
    if (!reasoning) return [];
    // Stoplist: keywords too generic to be useful as anchors.
    const STOP = new Set([
      'this',
      'that',
      'with',
      'from',
      'into',
      'over',
      'under',
      'than',
      'shows',
      'show',
      'showing',
      'shown',
      'where',
      'which',
      'while',
      'because',
      'doc',
      'document',
      'diagram',
      'sld',
      'value',
      'field',
      'about',
      'around',
      'system',
      'systems',
      'side',
      'sides',
      'left',
      'right',
      'above',
      'below',
      'inside',
      'outside',
    ]);
    const keywords = Array.from(
      new Set(
        reasoning
          .toLowerCase()
          // Split on hyphens too: "SUN2000-30KTL-M3" → ["sun2000",
          // "30ktl", "m3"]. Tesseract emits each token separately
          // even if the source uses hyphens, so a hyphen-joined
          // search string never hits.
          .split(/[^a-z0-9]+/)
          .filter((t) => t.length >= 4 && !STOP.has(t)),
      ),
    );
    if (!keywords.length) return [];
    const tokenMap = await this.buildTesseractTokenMap([canvas]);
    const hits: Array<{ x: number; y: number; w: number; h: number }> = [];
    for (const kw of keywords) {
      const entries = tokenMap.get(kw);
      if (!entries) continue;
      for (const e of entries) hits.push({ x: e.x, y: e.y, w: e.w, h: e.h });
    }
    return hits;
  }

  /** Public Tesseract sweep on a single canvas — used by the
   *  verify-source dialog to highlight a literal value on image
   *  documents (meter screenshots etc.) where pdf.js text-layer
   *  search doesn't apply. Returns 0..1 normalised bboxes matching
   *  the verifyTextMatches shape. */
  async findValueOnCanvas(
    canvas: HTMLCanvasElement,
    value: any,
  ): Promise<Array<{ x: number; y: number; w: number; h: number }>> {
    const v = String(value ?? '').trim();
    if (!v || v.length < 3) return [];
    const map = await this.buildTesseractTokenMap([canvas]);
    const norm = (s: string) => s.toLowerCase().trim();
    const target = norm(v);
    const out: Array<{ x: number; y: number; w: number; h: number }> = [];
    // Pass 1: direct token match, then substring-of-token (Tesseract
    // sometimes glues a value to neighbouring punctuation).
    for (const [tok, regs] of map.entries()) {
      if (tok === target || tok.includes(target) || target.includes(tok)) {
        for (const r of regs) out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
      }
    }
    if (out.length) return out;
    // Pass 2: OCR-confusion-tolerant match. Serials are exactly where
    // Tesseract confuses look-alikes (O↔0, I/l↔1, S↔5, B↔8, …), so an
    // exact-read region still fails Pass 1. Fold both sides to a canonical
    // form and match on that. A slightly-off yellow "look here" box is far
    // better than none for meter-ID confirmation. Gated to values ≥5 chars
    // so short/common tokens don't produce spurious boxes.
    if (target.replace(/[^a-z0-9]/g, '').length < 5) return out;
    const ct = this.foldOcrConfusables(target);
    for (const [tok, regs] of map.entries()) {
      const ck = this.foldOcrConfusables(tok);
      if (ck.length < 4) continue;
      if (ck === ct || ck.includes(ct) || ct.includes(ck)) {
        for (const r of regs) out.push({ x: r.x, y: r.y, w: r.w, h: r.h });
      }
    }
    return out;
  }

  /** Collapse OCR-confusable characters to a canonical alphanumeric form
   *  so a misread serial still matches its extracted value. */
  private foldOcrConfusables(s: string): string {
    return s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace(/[o]/g, '0')
      .replace(/[il|]/g, '1')
      .replace(/[s]/g, '5')
      .replace(/[b]/g, '8')
      .replace(/[z]/g, '2')
      .replace(/[g]/g, '6')
      .replace(/[q]/g, '9');
  }

  private async buildTesseractTokenMap(
    canvases: HTMLCanvasElement[],
  ): Promise<
    Map<
      string,
      Array<{ page: number; x: number; y: number; w: number; h: number }>
    >
  > {
    const map = new Map<
      string,
      Array<{ page: number; x: number; y: number; w: number; h: number }>
    >();
    const Tesseract = await import('tesseract.js' as any);
    const createWorker =
      Tesseract.createWorker || Tesseract.default?.createWorker;
    // Race the worker spawn against a short timeout. If the worker
    // can't initialise within 5s we bail out with an empty map rather
    // than letting the page block — historical incident 2026-05-26
    // saw FF freeze hard enough that DevTools (F12) wouldn't open
    // when the OCR initialisation hung.
    const worker = await Promise.race<any>([
      createWorker('eng', 1),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('tesseract worker spawn timeout')),
          5000,
        ),
      ),
    ]).catch((err) => {
      console.warn('[DocumentClassifier] tesseract worker init failed:', err);
      return null;
    });
    if (!worker) return map;
    try {
      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        // Yield to the event loop between pages so the browser can
        // paint the spinner / handle input even if OCR is heavy.
        await new Promise((r) => setTimeout(r, 0));
        const result = await Promise.race<any>([
          worker.recognize(canvas),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('tesseract recognise timeout')),
              20000,
            ),
          ),
        ]).catch((err) => {
          console.warn(
            `[DocumentClassifier] tesseract page ${i + 1} failed:`,
            err,
          );
          return null;
        });
        if (!result) continue;
        const words: Array<{
          text: string;
          bbox: { x0: number; y0: number; x1: number; y1: number };
        }> = (result?.data?.words as any) ?? [];
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
      try {
        await worker.terminate();
      } catch {
        // ignore
      }
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
    tokenMap: Map<
      string,
      Array<{ page: number; x: number; y: number; w: number; h: number }>
    >,
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
      const isDistinctive = (t: string) => /[a-z]/.test(t) && t.length >= 5;
      const acceptHits = (
        t: string,
        hits: Array<{
          page: number;
          x: number;
          y: number;
          w: number;
          h: number;
        }>,
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
      // (Reasoning-guided Tesseract token match removed 2026-05-26.
      // It tagged unrelated cover-page words as 'tesseract' regions
      // — e.g. an "(2) Address" extraction with reasoning "Facility
      // address field" would mark the word "Facility" on a doc's
      // title page as the source bbox. The user saw a confident red
      // outline on the wrong word. Value-match + word-split paths
      // above are kept; if those don't fire, fall through to the
      // model bbox.)
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
          base64: ds
            .toDataURL('image/png')
            .replace(/^data:image\/png;base64,/, ''),
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
      console.warn(
        '[DocumentClassifier] source-access-mode classify failed:',
        err,
      );
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
      // Only short-circuit the server call when Tesseract found a *device
      // table* — i.e. ≥2 serials. A single 8-char letter+digit token is
      // usually a stray label (a plant name like "AC002599" read off a
      // portal Info page), not a serial. Falling through to the server on
      // those lets it (a) reject the bogus SN and (b) still fish the
      // Info-page fields (capacity / commissioning date / plant type).
      if (ids.length >= 2) {
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
    // Whole-pipeline timeout — pdf.js can hang on certain PDFs (form
    // widgets, malformed embedded fonts). Without this, the upstream
    // HTTP request never fires and the UI sits forever with no
    // visible error. 90s is generous for a normal pipeline (~4s
    // typical Haiku call + a few seconds of rasterisation).
    const PIPELINE_TIMEOUT_MS = 90_000;
    const timer = new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `Extraction pipeline timed out after ${PIPELINE_TIMEOUT_MS / 1000}s (likely pdf.js hung on ${file.name}).`,
            ),
          ),
        PIPELINE_TIMEOUT_MS,
      ),
    );
    return Promise.race([
      this.runDocExtractionFEInner<T>(
        endpointPath,
        file,
        deviceId,
        preferVision,
        extras,
      ),
      timer,
    ]);
  }

  private async runDocExtractionFEInner<T>(
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
        // Per-stage timeout so a hang in extractPdfTextLayer doesn't
        // eat the whole budget — bail out and try vision only.
        try {
          text = await Promise.race<string>([
            this.extractPdfTextLayer(file),
            new Promise<string>((_, reject) =>
              setTimeout(
                () => reject(new Error('extractPdfTextLayer timeout')),
                30_000,
              ),
            ),
          ]);
        } catch (err) {
          console.warn(
            '[DocumentClassifier] text-layer timed out, going vision-only:',
            err,
          );
          text = '';
        }
      }
      const payload: any = { filename: file.name };
      if (deviceId) payload.deviceId = deviceId;
      if (extras) Object.assign(payload, extras);
      const contentHash = await this.sha256OfFile(file);
      if (contentHash) payload.contentHash = contentHash;
      // Send BOTH text and images when both are available — Haiku
      // reconciles them. Older code did either/or, but the SF-02 from
      // Stride (AC002641) has its values rendered as images even
      // though headers come through as text — text-only made Haiku
      // report "no filled-in data fields". Including the page raster
      // lets Haiku see the actual data even on image-heavy or
      // non-standard-font PDFs.
      if (text && text.trim().length >= 40) {
        payload.text = text;
      }
      const isPdf =
        file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (isPdf) {
        const canvases = await this.renderFirstNPages(file, 5);
        payload.images = canvases.map((c) => {
          const ds = this.downsampleToLongEdge(c, 1024);
          return {
            base64: ds
              .toDataURL('image/png')
              .replace(/^data:image\/png;base64,/, ''),
            mimeType: 'image/png' as const,
          };
        });
      } else if (!payload.text) {
        // Non-PDF without text → vision fallback for image uploads.
        const canvases = await this.renderFirstNPages(file, 5);
        payload.images = canvases.map((c) => {
          const ds = this.downsampleToLongEdge(c, 1024);
          return {
            base64: ds
              .toDataURL('image/png')
              .replace(/^data:image\/png;base64,/, ''),
            mimeType: 'image/png' as const,
          };
        });
      }
      const payloadSizeKB = Math.round(JSON.stringify(payload).length / 1024);
      console.log(
        `[DocumentClassifier] POST ${endpointPath} — payloadSize=${payloadSizeKB}KB, hasText=${!!payload.text}, hasImages=${!!payload.images}, imgCount=${payload.images?.length ?? 0}`,
      );
      const startedAt = Date.now();
      const res = await firstValueFrom(
        this.http.post<T>(`${environment.API_URL}${endpointPath}`, payload),
      );
      console.log(
        `[DocumentClassifier] POST ${endpointPath} — done in ${Date.now() - startedAt}ms, res=`,
        res,
      );
      if (!res) return null;
      // Phase 2: Tesseract bbox pass for verify-source. Skip for the
      // meter-ids endpoint — its result shape is a string[] list, not
      // individual ExtractedFields that benefit from per-field bboxes
      // (the per-id docs are already tracked separately in the UI).
      if (!endpointPath.includes('meter-ids')) {
        try {
          const canvases = await this.renderFirstNPages(file, 5);
          const tokenMap = await this.buildTesseractTokenMap(canvases);
          this.patchRegionsFromTesseract(res as any, tokenMap);
        } catch (err) {
          console.warn(
            `[DocumentClassifier] ${endpointPath} Tesseract pass failed:`,
            err,
          );
        }
      }
      return res;
    } catch (err) {
      // Re-throw so the per-extractor catch in add-devices.component.ts
      // surfaces the message in the Reading-documents dialog instead
      // of returning null silently. Without this the dialog said
      // "AI extracted from …" with no rows and no clue why.
      console.warn(`[DocumentClassifier] ${endpointPath} failed:`, err);
      throw err;
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
        const canvases = await this.renderFirstNPages(file, 5);
        payload.images = canvases.map((c) => {
          const ds = this.downsampleToLongEdge(c, 1024);
          return {
            base64: ds
              .toDataURL('image/png')
              .replace(/^data:image\/png;base64,/, ''),
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
        const canvases = await this.renderFirstNPages(file, 5);
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
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(buf) })
        .promise;
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
      console.warn(
        '[DocumentClassifier] multi-page render failed, falling back to page 1:',
        err,
      );
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
    images?: Array<{
      base64: string;
      mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
    }>,
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
          ...(images && images.length ? { images } : {}),
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

  /** Render the file's first page to a JPEG base64 string suitable for
   *  the Anthropic vision API. Reuses the canvas pipeline used for OCR
   *  so the bytes Claude sees match what Tesseract saw. */
  private async fileToVisionImage(file: File): Promise<{
    base64: string;
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  } | null> {
    try {
      const canvas = await this.renderFirstPage(file);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const base64 = dataUrl.split(',')[1];
      if (!base64) return null;
      return { base64, mimeType: 'image/jpeg' };
    } catch (err) {
      console.warn('[DocumentClassifier] fileToVisionImage failed:', err);
      return null;
    }
  }
}
