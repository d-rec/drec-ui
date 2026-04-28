import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';
import { retry, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrgApiLicensesService } from '../../auth/services/org-api-licenses.service';
import { ImageZoomPanDirective } from '../directives/image-zoom-pan.directive';

@Component({
  standalone: true,
  selector: 'app-pdf-preview',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ImageZoomPanDirective,
  ],
  templateUrl: './pdf-preview.component.html',
  styleUrls: ['./pdf-preview.component.scss'],
})
export class PdfPreviewComponent implements OnChanges {
  /** Sanitized URL for the iframe/img src. */
  @Input() previewUrl: SafeResourceUrl | null = null;
  /** Whether the preview is a PDF, an image, or an Excel spreadsheet. */
  @Input() previewType: 'pdf' | 'image' | 'excel' = 'pdf';
  /** Either a File (add/edit-device) or a raw URL string (device-reviews). Triggers OCR (or Excel parsing) automatically. */
  @Input() ocrSource: File | string | null = null;
  /** When set, shows SLD capacity compare panel for this device. */
  @Input() sldDeviceId: number | null = null;

  // Excel preview state (client-side SheetJS render)
  excelSheets: { name: string; html: string }[] = [];
  excelActiveIdx = 0;
  excelLoading = false;
  excelError = '';

  // SLD compare state
  sldResult: {
    registeredCapacityKw: number | null;
    sldCapacityKw: number | null;
    hasSld: boolean;
    differencePercent: number | null;
    tolerancePercent: number;
    match: boolean | null;
  } | null = null;
  sldInputKw: number | null = null;
  sldLoading = false;
  sldSaved = false;

  // Panel detection state
  @ViewChild('detectImg') detectImg!: ElementRef<HTMLImageElement>;
  @ViewChild('detectCanvas') detectCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild(ImageZoomPanDirective) zoomPan?: ImageZoomPanDirective;
  detecting = false;
  showDetectOverlay = false;
  panelCount = 0;
  detectError = '';
  predictions: any[] = [];
  selectedRegion: number = -1;
  private detScaleX = 1;
  private detScaleY = 1;

  ocrText = '';
  ocrLoading = false;
  ocrProgress = 0;
  ocrPageInfo = '';
  ocrSearch = '';
  ocrPaneHeight = 200;
  translatedText = '';
  translating = false;
  detectedLang = '';
  translationSearch = '';
  leftWidthPct = this.loadLeftWidthPct();
  private dragStartY = 0;
  private dragStartHeight = 0;

  private static readonly LEFT_WIDTH_STORAGE_KEY = 'pdf-preview:leftWidthPct';

  constructor(
    private http: HttpClient,
    private licensesService: OrgApiLicensesService,
    private cdr: ChangeDetectorRef,
    private host: ElementRef<HTMLElement>,
  ) {}

  private loadLeftWidthPct(): number {
    try {
      const raw = localStorage.getItem(
        PdfPreviewComponent.LEFT_WIDTH_STORAGE_KEY,
      );
      const n = raw ? parseFloat(raw) : NaN;
      if (!isNaN(n) && n >= 20 && n <= 90) return n;
    } catch {
      /* noop */
    }
    return 80;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ocrSource']) {
      this.resetState();
    }
    if (changes['sldDeviceId'] && this.sldDeviceId) {
      this.fetchSldCompare();
    }
    if (
      (changes['ocrSource'] || changes['previewType']) &&
      this.previewType === 'excel'
    ) {
      this.loadExcel();
    }
  }

  setExcelSheet(idx: number): void {
    this.excelActiveIdx = idx;
    this.cdr.markForCheck?.();
    this.cdr.detectChanges();
  }

  private async loadExcel(): Promise<void> {
    if (!this.ocrSource) return;
    this.excelSheets = [];
    this.excelActiveIdx = 0;
    this.excelError = '';
    this.excelLoading = true;
    this.cdr.detectChanges();

    try {
      let arrayBuffer: ArrayBuffer;
      if (this.ocrSource instanceof File) {
        arrayBuffer = await this.ocrSource.arrayBuffer();
      } else {
        const resp = await fetch(this.ocrSource as string);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        arrayBuffer = await resp.arrayBuffer();
      }

      const XLSX: any = await import('xlsx' as any);
      const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
      this.excelSheets = wb.SheetNames.map((name: string) => {
        const sheet = wb.Sheets[name];
        const html: string = XLSX.utils.sheet_to_html(sheet, {
          editable: false,
        });
        return { name, html };
      });
      if (this.excelSheets.length === 0) {
        this.excelError = 'No sheets found in this workbook.';
      }
    } catch (err: any) {
      console.error('Excel preview failed:', err);
      this.excelError =
        'Could not render this spreadsheet — try downloading it instead.';
    }

    this.excelLoading = false;
    this.cdr.detectChanges();
  }

  fetchSldCompare(): void {
    if (!this.sldDeviceId) return;
    this.sldLoading = true;
    this.sldSaved = false;
    this.http
      .get<any>(
        `${environment.API_URL}device-reviews/${this.sldDeviceId}/sld-compare`,
      )
      .subscribe({
        next: (res) => {
          this.sldResult = res;
          this.sldInputKw = res.sldCapacityKw;
          this.sldLoading = false;
        },
        error: () => {
          this.sldResult = null;
          this.sldLoading = false;
        },
      });
  }

  saveSldCapacity(): void {
    if (!this.sldDeviceId || this.sldInputKw == null) return;
    this.sldSaved = false;
    this.http
      .patch<any>(
        `${environment.API_URL}device-reviews/${this.sldDeviceId}/sld-capacity`,
        {
          sldCapacityKw: this.sldInputKw,
        },
      )
      .subscribe({
        next: () => {
          this.sldSaved = true;
          this.fetchSldCompare();
        },
        error: (err) => console.error('Failed to save SLD capacity:', err),
      });
  }

  startOcr(): void {
    if (this.ocrSource && !this.ocrLoading) {
      this.runOcr(this.ocrSource);
    }
  }

  private resetState(): void {
    this.ocrText = '';
    this.ocrLoading = false;
    this.ocrProgress = 0;
    this.ocrPageInfo = '';
    this.ocrSearch = '';
    this.translatedText = '';
    this.translating = false;
    this.detectedLang = '';
    this.translationSearch = '';
    this.clearDetectOverlay();
  }

  onDragStart(event: MouseEvent): void {
    event.preventDefault();
    this.dragStartY = event.clientY;
    this.dragStartHeight = this.ocrPaneHeight;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientY - this.dragStartY;
      this.ocrPaneHeight = Math.max(60, this.dragStartHeight + delta);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  onVerticalDragStart(event: MouseEvent): void {
    event.preventDefault();
    const container = this.host.nativeElement.querySelector(
      '.pdf-preview',
    ) as HTMLElement | null;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      this.leftWidthPct = Math.min(90, Math.max(20, pct));
    };
    const cleanup = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', cleanup, true);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(
          PdfPreviewComponent.LEFT_WIDTH_STORAGE_KEY,
          String(this.leftWidthPct),
        );
      } catch {
        /* noop */
      }
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', cleanup, true);
  }

  private async runOcr(source: File | string): Promise<void> {
    this.ocrLoading = true;
    this.ocrProgress = 0;
    this.ocrPageInfo = '';
    this.ocrText = '';
    this.leftWidthPct = 50;
    try {
      const Tesseract = await import('tesseract.js' as any);
      const createWorker =
        Tesseract.createWorker || Tesseract.default?.createWorker;
      const worker = await createWorker('eng+fra', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            this.ocrProgress = Math.round(m.progress * 100);
          }
        },
      });

      const isPdf =
        source instanceof File
          ? source.type === 'application/pdf'
          : /\.pdf/i.test((source as string).split('?')[0]);

      if (isPdf) {
        await this.ocrPdf(worker, source);
      } else {
        const {
          data: { text },
        } = await worker.recognize(source);
        this.ocrText = text;
      }

      await worker.terminate();
    } catch (err) {
      console.error('OCR failed:', err);
      this.ocrText = 'OCR failed — could not extract text from this document.';
    }
    this.ocrLoading = false;
    this.ocrPageInfo = '';
  }

  private async ocrPdf(worker: any, source: File | string): Promise<void> {
    let pdfjs = (window as any).pdfjsLib;
    if (!pdfjs) {
      try {
        pdfjs = await import('pdfjs-dist' as any);
      } catch {
        this.ocrText = 'PDF.js not loaded — cannot OCR PDF files.';
        this.ocrLoading = false;
        await worker.terminate();
        return;
      }
    }
    pdfjs.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

    let arrayBuffer: ArrayBuffer;
    if (source instanceof File) {
      arrayBuffer = await source.arrayBuffer();
    } else {
      const response = await fetch(source as string);
      arrayBuffer = await response.arrayBuffer();
    }

    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
    }).promise;
    const totalPages = pdf.numPages;

    for (let p = 1; p <= totalPages; p++) {
      this.ocrPageInfo = `Page ${p} of ${totalPages}`;
      this.ocrProgress = 0;
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const {
        data: { text },
      } = await worker.recognize(canvas);
      const separator = `── Page ${p} ${'─'.repeat(40)}`;
      this.ocrText +=
        (this.ocrText ? '\n\n' : '') + separator + '\n\n' + text.trim();
    }
  }

  async translateToEnglish(): Promise<void> {
    if (!this.ocrText || this.translating) return;

    // Check credits before proceeding
    try {
      const credits = await this.licensesService.getCredits().toPromise();
      if (credits && !credits.deepl.hasOwnKey) {
        const remaining = credits.deepl.credits;
        if (remaining <= 0) {
          alert(
            'DeepL credits exhausted.\n\n' +
              'Please add your own DeepL API key in Organization > Licenses.',
          );
          return;
        }
        const ok = confirm(
          `You have ${remaining} free DeepL credit(s) remaining \u2014 proceed?\n\n` +
            `This will use 1 credit. Once exhausted, you\u2019ll need to add ` +
            `your own API key in Organization > Licenses.`,
        );
        if (!ok) return;
      }
    } catch {
      // Credits endpoint unavailable (dev mode) — show free tier warning
      const ok = confirm(
        'Translation uses the DeepL API free tier (500,000 characters/month). ' +
          'Large documents consume quota quickly.\n\nProceed anyway?',
      );
      if (!ok) return;
    }
    this.translating = true;
    this.translatedText = '';
    this.detectedLang = '';
    try {
      const chunks = this.splitTextIntoChunks(this.ocrText, 4000);
      for (const chunk of chunks) {
        const res = await fetch(`${environment.API_URL}translate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('access-token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: [chunk], target_lang: 'EN' }),
        });
        if (res.status === 403) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message || 'Credits exhausted');
        }
        if (!res.ok) throw new Error(`Translation error: ${res.status}`);
        const data = await res.json();
        const t = data.translations?.[0];
        if (t) {
          if (!this.detectedLang)
            this.detectedLang = t.detected_source_language?.toLowerCase() || '';
          this.translatedText += t.text;
        }
      }
    } catch (err) {
      console.error('Translation failed:', err);
      this.translatedText += this.translatedText
        ? '\n\n⚠ Translation interrupted.'
        : 'Translation failed — check console for details.';
    }
    this.translating = false;
  }

  private splitTextIntoChunks(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      let splitAt = remaining.lastIndexOf('\n', maxLen);
      if (splitAt < maxLen / 2) splitAt = maxLen;
      chunks.push(remaining.substring(0, splitAt));
      remaining = remaining.substring(splitAt);
    }
    return chunks;
  }

  copyOcrText(): void {
    if (this.ocrText) {
      navigator.clipboard.writeText(this.ocrText);
    }
  }

  hasMatch(text: string, term: string): boolean {
    if (!term) return true;
    return text.toLowerCase().includes(term.toLowerCase());
  }

  highlightText(text: string, term: string): string {
    if (!term) return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const termEscaped = term
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;');
    return escaped.replace(
      new RegExp(termEscaped, 'gi'),
      (m) => `<mark>${m}</mark>`,
    );
  }

  // ── Panel Detection ──────────────────────────────────────────────

  detectPanels(): void {
    if (this.detecting) return;
    this.licensesService.getCredits().subscribe({
      next: (credits) => {
        if (credits.roboflow.hasOwnKey) {
          this.runDetection();
          return;
        }
        if (credits.roboflow.credits <= 0) {
          this.detectError =
            'Roboflow credits exhausted. Add your own API key in Organization > Licenses.';
          this.cdr.detectChanges();
          return;
        }
        if (
          confirm(
            `You have ${credits.roboflow.credits} free Roboflow credit(s) remaining — proceed?\n\n` +
              `This will use 1 credit.`,
          )
        ) {
          this.runDetection();
        }
      },
      error: () => {
        if (
          confirm(
            'Panel detection uses a limited number of free scans. Proceed anyway?',
          )
        ) {
          this.runDetection();
        }
      },
    });
  }

  clearDetectOverlay(): void {
    this.showDetectOverlay = false;
    this.panelCount = 0;
    this.detectError = '';
    this.predictions = [];
    this.selectedRegion = -1;
    this.detecting = false;
    if (this.detectCanvas?.nativeElement) {
      const ctx = this.detectCanvas.nativeElement.getContext('2d');
      ctx?.clearRect(
        0,
        0,
        this.detectCanvas.nativeElement.width,
        this.detectCanvas.nativeElement.height,
      );
    }
  }

  onDetectCanvasClick(event: MouseEvent): void {
    if (!this.predictions.length) return;
    const canvas = this.detectCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * cssToCanvasX;
    const y = (event.clientY - rect.top) * cssToCanvasY;

    for (let i = this.predictions.length - 1; i >= 0; i--) {
      if (this.detectHitTest(this.predictions[i], x, y)) {
        this.selectedRegion = this.selectedRegion === i ? -1 : i;
        this.detectRedraw();
        this.cdr.detectChanges();
        return;
      }
    }
    this.selectedRegion = -1;
    this.detectRedraw();
    this.cdr.detectChanges();
  }

  deleteSelectedRegion(): void {
    if (
      this.selectedRegion < 0 ||
      this.selectedRegion >= this.predictions.length
    )
      return;
    this.predictions.splice(this.selectedRegion, 1);
    this.selectedRegion = -1;
    this.panelCount = this.predictions.length;
    this.detectRedraw();
    this.cdr.detectChanges();
  }

  private runDetection(): void {
    const img = this.detectImg?.nativeElement;
    if (!img || !img.complete) {
      this.detectError = 'Image not loaded';
      this.cdr.detectChanges();
      return;
    }
    this.detecting = true;
    this.detectError = '';
    this.cdr.detectChanges();

    const canvas = document.createElement('canvas');
    const maxDim = 640;
    const scale = Math.min(
      1,
      maxDim / Math.max(img.naturalWidth, img.naturalHeight),
    );
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d')!;

    try {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toDataURL(); // taint check
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      this.sendDetection(base64);
    } catch {
      this.fetchAndDetect(img.src);
    }
  }

  private async fetchAndDetect(src: string): Promise<void> {
    try {
      const resp = await fetch(src);
      const blob = await resp.blob();
      const bmp = await createImageBitmap(blob);
      const canvas = document.createElement('canvas');
      const maxDim = 640;
      const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas
        .getContext('2d')!
        .drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
      const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
      this.sendDetection(base64);
    } catch {
      this.detecting = false;
      this.detectError = 'Could not load image for detection';
      this.cdr.detectChanges();
    }
  }

  private sendDetection(base64: string): void {
    this.http
      .post<any>(`${environment.API_URL}device-reviews/detect-panels`, {
        image: base64,
      })
      .pipe(
        retry({
          count: 2,
          delay: (_err: any, attempt: number) => timer(attempt * 3000),
        }),
      )
      .subscribe({
        next: (data) => this.handleDetections(data),
        error: (err) => {
          this.detectError =
            'Detection failed: ' + (err?.error?.message || err?.message || err);
          this.detecting = false;
          this.cdr.detectChanges();
        },
      });
  }

  private handleDetections(data: any): void {
    const img = this.detectImg.nativeElement;
    const w = img.clientWidth;
    const h = img.clientHeight;

    const canvas = this.detectCanvas.nativeElement;
    canvas.width = w;
    canvas.height = h;

    const outputs = data?.outputs?.[0];
    const preds = outputs?.predictions?.predictions ?? [];
    const imgW = outputs?.predictions?.image?.width ?? img.naturalWidth;
    const imgH = outputs?.predictions?.image?.height ?? img.naturalHeight;
    this.detScaleX = w / imgW;
    this.detScaleY = h / imgH;

    this.predictions = preds;
    this.selectedRegion = -1;
    this.panelCount = preds.length;

    if (this.panelCount === 0) {
      this.detectError = 'No solar panels detected in this image';
      this.detecting = false;
      this.cdr.detectChanges();
      return;
    }

    this.detectRedraw();
    this.showDetectOverlay = true;
    this.detecting = false;
    this.cdr.detectChanges();
  }

  private detectHitTest(pred: any, mx: number, my: number): boolean {
    const points: { x: number; y: number }[] = pred.points ?? [];
    if (points.length > 2) {
      const scaled = points.map((p: any) => ({
        x: p.x * this.detScaleX,
        y: p.y * this.detScaleY,
      }));
      let inside = false;
      for (let i = 0, j = scaled.length - 1; i < scaled.length; j = i++) {
        const xi = scaled[i].x,
          yi = scaled[i].y;
        const xj = scaled[j].x,
          yj = scaled[j].y;
        if (
          yi > my !== yj > my &&
          mx < ((xj - xi) * (my - yi)) / (yj - yi) + xi
        ) {
          inside = !inside;
        }
      }
      return inside;
    }
    const bx = (pred.x - pred.width / 2) * this.detScaleX;
    const by = (pred.y - pred.height / 2) * this.detScaleY;
    const bw = pred.width * this.detScaleX;
    const bh = pred.height * this.detScaleY;
    return mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;
  }

  private detectRedraw(): void {
    const canvas = this.detectCanvas.nativeElement;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < this.predictions.length; i++) {
      const pred = this.predictions[i];
      const selected = i === this.selectedRegion;
      const fill = selected
        ? 'rgba(239, 68, 68, 0.4)'
        : 'rgba(0, 255, 180, 0.3)';
      const stroke = selected ? '#ef4444' : '#00ffb4';
      const points: { x: number; y: number }[] = pred.points ?? [];

      if (points.length > 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x * this.detScaleX, points[0].y * this.detScaleY);
        for (let j = 1; j < points.length; j++) {
          ctx.lineTo(
            points[j].x * this.detScaleX,
            points[j].y * this.detScaleY,
          );
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.stroke();
      } else {
        const bx = (pred.x - pred.width / 2) * this.detScaleX;
        const by = (pred.y - pred.height / 2) * this.detScaleY;
        const bw = pred.width * this.detScaleX;
        const bh = pred.height * this.detScaleY;
        ctx.fillStyle = fill;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.strokeRect(bx, by, bw, bh);
      }

      if (selected) {
        let dotX: number, dotY: number;
        if (points.length > 2) {
          const xs = points.map((p: any) => p.x * this.detScaleX);
          const ys = points.map((p: any) => p.y * this.detScaleY);
          dotX = Math.max(...xs);
          dotY = Math.min(...ys);
        } else {
          dotX = (pred.x + pred.width / 2) * this.detScaleX;
          dotY = (pred.y - pred.height / 2) * this.detScaleY;
        }
        ctx.beginPath();
        ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('\u00d7', dotX, dotY + 0.5);
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
      }
    }
  }
}
