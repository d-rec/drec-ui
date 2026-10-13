import { Injectable } from '@angular/core';

export type ReadSource = 'barcode' | 'ocr';

export interface SerialRead {
  text: string;
  source: ReadSource;
  /** 1 for a barcode decode; burst agreement for OCR. */
  confidence: number;
  elapsedMs: number;
}

/** Characters a serial can plausibly contain, for the OCR charset allowlist. */
const SERIAL_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-';

/**
 * Reads a serial off a cropped nameplate image.
 *
 * Barcode first, OCR second. Measured on 640x160 crops (2026-10-13,
 * tesseract.js 5.1.1): ~20 ms per OCR pass on a desktop, so roughly
 * 80-160 ms on a mid-range phone — fast enough to run continuously while the
 * operator frames the shot. A barcode decode is both faster and exact, so it
 * always gets first refusal.
 *
 * Both engines are loaded lazily and kept for the lifetime of the screen:
 * re-creating the tesseract worker per frame will OOM an older iPhone.
 */
@Injectable()
export class SerialReaderService {
  private ocrWorker: any | null = null;
  private ocrInit: Promise<any> | null = null;
  private barcodeReader: {
    readBarcodesFromImageData: (
      data: ImageData,
      options?: any,
    ) => Promise<Array<{ text: string; isValid: boolean }>>;
  } | null = null;
  private barcodeInit: Promise<any> | null = null;
  private barcodeUnavailable = false;

  /**
   * Warm both engines. Worth calling as soon as the camera starts: the OCR
   * worker takes ~300 ms to spin up and load its model, and doing that on the
   * first frame would show up as a stutter exactly when the operator is
   * aiming.
   */
  public async warmUp(): Promise<void> {
    await Promise.all([
      this.ensureOcr().catch(() => null),
      this.ensureBarcode().catch(() => null),
    ]);
  }

  /**
   * Barcode only, no OCR fallback.
   *
   * Used where the image is the whole nameplate rather than the guide box: a
   * barcode is rarely where the operator is aiming, so it has to be looked for
   * across the full frame, while OCR still wants the tight crop.
   */
  public async readBarcodeOnly(image: ImageData): Promise<SerialRead | null> {
    const started = performance.now();
    const text = await this.readBarcode(image);
    return text
      ? {
          text,
          source: 'barcode',
          confidence: 1,
          elapsedMs: performance.now() - started,
        }
      : null;
  }

  /** One pass: barcode, then OCR if nothing decoded. */
  public async read(image: ImageData): Promise<SerialRead | null> {
    const started = performance.now();

    const barcode = await this.readBarcode(image);
    if (barcode) {
      return {
        text: barcode,
        source: 'barcode',
        confidence: 1,
        elapsedMs: performance.now() - started,
      };
    }

    const text = await this.readOcrOnce(image);
    if (!text) return null;

    return {
      text,
      source: 'ocr',
      // A single pass carries no agreement information; `readBurst` is what
      // produces a real confidence number.
      confidence: 0,
      elapsedMs: performance.now() - started,
    };
  }

  /**
   * Run OCR several times and take the majority answer. Tesseract is not
   * deterministic across slightly different frames, so agreement across a
   * burst is the cheapest available confidence signal — and disagreement is
   * itself informative: it means the operator should move or re-light.
   */
  public async readBurst(frames: ImageData[]): Promise<SerialRead | null> {
    const started = performance.now();

    // A barcode anywhere in the burst beats any amount of OCR agreement.
    for (const frame of frames) {
      const barcode = await this.readBarcode(frame);
      if (barcode) {
        return {
          text: barcode,
          source: 'barcode',
          confidence: 1,
          elapsedMs: performance.now() - started,
        };
      }
    }

    const reads: string[] = [];
    for (const frame of frames) {
      const text = await this.readOcrOnce(frame);
      if (text) reads.push(text);
    }
    if (!reads.length) return null;

    const counts = new Map<string, number>();
    for (const read of reads) {
      counts.set(read, (counts.get(read) ?? 0) + 1);
    }
    const [best, hits] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      text: best,
      source: 'ocr',
      // Over the number of frames attempted, not the number that produced
      // text: three blank reads out of five is low confidence, not perfect.
      confidence: hits / frames.length,
      elapsedMs: performance.now() - started,
    };
  }

  public async destroy(): Promise<void> {
    const worker = this.ocrWorker;
    this.ocrWorker = null;
    this.ocrInit = null;
    try {
      await worker?.terminate();
    } catch {
      /* nothing useful to do if teardown fails */
    }
  }

  private async readBarcode(image: ImageData): Promise<string | null> {
    if (this.barcodeUnavailable) return null;
    try {
      const reader = await this.ensureBarcode();
      const results = await reader.readBarcodesFromImageData(image, {
        tryHarder: true,
        // Nameplates use linear codes almost exclusively; QR is included
        // because some inverters carry a config QR that holds the serial.
        formats: ['Code128', 'Code39', 'DataMatrix', 'QRCode', 'ITF'],
      });
      const hit = results.find((r) => r.isValid && r.text?.trim());
      return hit ? hit.text.trim() : null;
    } catch {
      // A missing or unservable wasm binary should degrade to OCR, not break
      // the screen. Latch it so we stop retrying every frame.
      this.barcodeUnavailable = true;
      return null;
    }
  }

  private async readOcrOnce(image: ImageData): Promise<string | null> {
    try {
      const worker = await this.ensureOcr();
      const { data } = await worker.recognize(this.toCanvas(image));
      const text = (data?.text ?? '').trim().replace(/\s+/g, '');
      return text.length >= 4 ? text : null;
    } catch {
      return null;
    }
  }

  private async ensureOcr(): Promise<any> {
    if (this.ocrWorker) return this.ocrWorker;
    if (!this.ocrInit) {
      this.ocrInit = (async () => {
        const Tesseract: any = await import('tesseract.js');
        const createWorker =
          Tesseract.createWorker ?? Tesseract.default?.createWorker;
        const worker = await createWorker('eng', 1);
        await worker.setParameters({
          tessedit_char_whitelist: SERIAL_CHARSET,
          // PSM 7: treat the crop as a single line of text. The guide box
          // exists precisely so this assumption holds.
          tessedit_pageseg_mode: '7',
        });
        this.ocrWorker = worker;
        return worker;
      })();
    }
    return this.ocrInit;
  }

  private async ensureBarcode(): Promise<
    NonNullable<typeof this.barcodeReader>
  > {
    if (this.barcodeReader) return this.barcodeReader;
    if (!this.barcodeInit) {
      this.barcodeInit = (async () => {
        const zxing: any = await import('zxing-wasm/reader');
        // Serve the wasm from our own origin. The default is a CDN fetch,
        // which is exactly wrong for a screen that has to work on a rural
        // site with no connectivity.
        zxing.prepareZXingModule({
          overrides: {
            locateFile: (file: string) =>
              file.endsWith('.wasm') ? '/assets/zxing/zxing_reader.wasm' : file,
          },
        });
        this.barcodeReader = zxing;
        return zxing;
      })();
    }
    return this.barcodeInit;
  }

  /** tesseract.js takes a canvas; ImageData is what the crop produces. */
  private toCanvas(image: ImageData): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    canvas.getContext('2d')!.putImageData(image, 0, 0);
    return canvas;
  }
}
