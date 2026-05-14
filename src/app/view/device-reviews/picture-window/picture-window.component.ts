import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ViewChild,
  ElementRef,
  ChangeDetectorRef,
} from '@angular/core';
import { AssetService, OpenPicture } from '../asset.service';
import { OrgApiLicensesService } from '../../../auth/services/org-api-licenses.service';
import Tesseract from 'tesseract.js';
import { ImageZoomPanDirective } from '../../../shared/directives/image-zoom-pan.directive';
import { safeErrorMessage } from '../../../utils/safe-error-message';
import { currentUserIsInternalReviewer } from '../../../utils/role-helper';

@Component({
  standalone: false,
  selector: 'app-ds-picture-window',
  templateUrl: './picture-window.component.html',
  styleUrls: ['./picture-window.component.scss'],
})
export class PictureWindowComponent implements OnInit {
  @Input() pic!: OpenPicture;
  @Input() zIndex = 400;
  @Input() initX = 200;
  @Input() initY = 100;
  @Output() bringToFront = new EventEmitter<void>();

  @ViewChild('imgEl') imgEl!: ElementRef<HTMLImageElement>;
  @ViewChild('overlayCanvas') overlayCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild(ImageZoomPanDirective) zoomPan?: ImageZoomPanDirective;

  get url(): string {
    return this.pic.url;
  }
  get enableOcr(): boolean {
    return this.pic.enableOcr;
  }
  private get currentUrl(): string {
    return this.pic.url;
  }

  // OCR state
  ocrText: string | null = null;
  ocrRunning = false;
  ocrProgress = 0;
  ocrSearch = '';

  // Detect panels state
  detecting = false;
  showOverlay = false;
  panelCount = 0;
  detectDone = false;
  detectError = '';
  showDetectConfirm = false;
  detectConfirmMsg = '';

  // Region selection state
  predictions: any[] = [];
  selectedRegion: number = -1;
  private scaleX = 1;
  private scaleY = 1;

  constructor(
    readonly svc: AssetService,
    private licensesService: OrgApiLicensesService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.bringToFront.emit();
  }

  close(): void {
    this.svc.closePicture(this.pic.id);
  }

  // ── OCR ──────────────────────────────────────────────────────────────

  async runOcr(): Promise<void> {
    if (!this.currentUrl || this.ocrRunning) return;
    this.ocrRunning = true;
    this.ocrText = null;
    this.ocrProgress = 0;

    try {
      const result = await Tesseract.recognize(this.currentUrl, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            this.ocrProgress = Math.round(m.progress * 100);
          }
        },
      });
      this.ocrText = result.data.text;
    } catch (err: any) {
      this.ocrText = `OCR failed: ${err.message || err}`;
    } finally {
      this.ocrRunning = false;
    }
  }

  copyOcrText(): void {
    if (this.ocrText) {
      navigator.clipboard.writeText(this.ocrText);
    }
  }

  highlightOcr(text: string, term: string): string {
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

  // ── Detect Panels ────────────────────────────────────────────────────

  detectPanels(): void {
    if (this.detecting) return;

    if (currentUserIsInternalReviewer()) {
      this.detecting = true;
      this.detectError = '';
      this.runDetection();
      return;
    }

    this.licensesService.getCredits().subscribe({
      next: (credits) => {
        if (credits.roboflow.hasOwnKey) {
          this.detecting = true;
          this.detectError = '';
          this.runDetection();
          return;
        }
        if (!credits.roboflow.platformKeyConfigured) {
          this.detectError =
            'Solar panel detection is not configured on this environment. An admin must add a Roboflow API key in Organization > Licenses (or your org can supply its own).';
          return;
        }
        if (credits.roboflow.credits <= 0) {
          this.detectError =
            'Your free Roboflow credits are used up. Add your own API key in Organization > Licenses to keep scanning.';
          return;
        }
        this.detectConfirmMsg =
          `You have ${credits.roboflow.credits} free Roboflow credit(s) remaining \u2014 proceed?\n\n` +
          `This will use 1 credit. Once exhausted, you\u2019ll need to add your own API key in Organization > Licenses.`;
        this.showDetectConfirm = true;
      },
      error: () => {
        this.detectConfirmMsg =
          'Panel detection uses a limited number of free scans. Proceed anyway?';
        this.showDetectConfirm = true;
      },
    });
  }

  cancelDetect(): void {
    this.showDetectConfirm = false;
  }

  confirmDetect(): void {
    this.showDetectConfirm = false;
    this.detecting = true;
    this.detectError = '';
    this.runDetection();
  }

  clearOverlay(): void {
    this.showOverlay = false;
    this.panelCount = 0;
    this.detectDone = false;
    this.detectError = '';
    this.predictions = [];
    this.selectedRegion = -1;
    if (this.overlayCanvas?.nativeElement) {
      const canvas = this.overlayCanvas.nativeElement;
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.predictions.length) return;
    const canvas = this.overlayCanvas.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const cssToCanvasX = canvas.width / rect.width;
    const cssToCanvasY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * cssToCanvasX;
    const y = (event.clientY - rect.top) * cssToCanvasY;

    for (let i = this.predictions.length - 1; i >= 0; i--) {
      if (this.hitTest(this.predictions[i], x, y)) {
        if (this.selectedRegion === i) {
          this.predictions = this.predictions.filter(
            (_: any, j: number) => j !== i,
          );
          this.selectedRegion = -1;
          this.panelCount = this.predictions.length;
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (this.panelCount === 0) {
            this.showOverlay = false;
          } else {
            this.redraw();
          }
        } else {
          this.selectedRegion = i;
          this.redraw();
        }
        this.cdr.detectChanges();
        return;
      }
    }
    if (this.selectedRegion >= 0) {
      this.selectedRegion = -1;
      this.redraw();
      this.cdr.detectChanges();
    }
  }

  deleteSelected(): void {
    if (
      this.selectedRegion < 0 ||
      this.selectedRegion >= this.predictions.length
    )
      return;
    this.predictions.splice(this.selectedRegion, 1);
    this.selectedRegion = -1;
    this.panelCount = this.predictions.length;
    this.redraw();
  }

  private hitTest(pred: any, mx: number, my: number): boolean {
    const points: { x: number; y: number }[] = pred.points ?? [];
    if (points.length > 2) {
      // Point-in-polygon (ray-casting)
      const scaled = points.map((p) => ({
        x: p.x * this.scaleX,
        y: p.y * this.scaleY,
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
    // Bounding box fallback
    const bx = (pred.x - pred.width / 2) * this.scaleX;
    const by = (pred.y - pred.height / 2) * this.scaleY;
    const bw = pred.width * this.scaleX;
    const bh = pred.height * this.scaleY;
    return mx >= bx && mx <= bx + bw && my >= by && my <= by + bh;
  }

  private redraw(): void {
    const canvas = this.overlayCanvas.nativeElement;
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
        ctx.moveTo(points[0].x * this.scaleX, points[0].y * this.scaleY);
        for (let j = 1; j < points.length; j++) {
          ctx.lineTo(points[j].x * this.scaleX, points[j].y * this.scaleY);
        }
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.stroke();
      } else {
        const bx = (pred.x - pred.width / 2) * this.scaleX;
        const by = (pred.y - pred.height / 2) * this.scaleY;
        const bw = pred.width * this.scaleX;
        const bh = pred.height * this.scaleY;
        ctx.fillStyle = fill;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selected ? 3 : 2;
        ctx.strokeRect(bx, by, bw, bh);
      }

      // Red delete-hint dot at top-right corner of selected region
      if (selected) {
        let dotX: number, dotY: number;
        if (points.length > 2) {
          // Find top-right of bounding box
          const xs = points.map((p) => p.x * this.scaleX);
          const ys = points.map((p) => p.y * this.scaleY);
          dotX = Math.max(...xs);
          dotY = Math.min(...ys);
        } else {
          dotX = (pred.x + pred.width / 2) * this.scaleX;
          dotY = (pred.y - pred.height / 2) * this.scaleY;
        }
        ctx.beginPath();
        ctx.arc(dotX, dotY, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // "x" inside the dot
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

  private runDetection(): void {
    const img = this.imgEl?.nativeElement;
    if (!img || !img.complete) {
      this.detecting = false;
      this.detectError = 'Image not loaded';
      return;
    }

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
    } catch {
      // CORS — re-fetch as blob
      this.fetchAndDetect(img.src);
      return;
    }

    // Check canvas isn't tainted
    try {
      canvas.toDataURL();
    } catch {
      this.fetchAndDetect(img.src);
      return;
    }

    const base64 = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    this.sendDetection(base64);
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
    } catch (err: any) {
      this.detecting = false;
      this.detectError = 'Could not load image for detection';
    }
  }

  private sendDetection(base64: string): void {
    this.svc.detectPanels(base64).subscribe({
      next: (data) => this.drawDetections(data),
      error: (err) => {
        this.detectError = 'Detection failed: ' + safeErrorMessage(err);
        this.detecting = false;
      },
    });
  }

  private drawDetections(data: any): void {
    const img = this.imgEl.nativeElement;
    const w = img.clientWidth;
    const h = img.clientHeight;

    const canvas = this.overlayCanvas.nativeElement;
    canvas.width = w;
    canvas.height = h;

    const outputs = data?.outputs?.[0];
    const preds = outputs?.predictions?.predictions ?? [];

    const imgW = outputs?.predictions?.image?.width ?? img.naturalWidth;
    const imgH = outputs?.predictions?.image?.height ?? img.naturalHeight;
    this.scaleX = w / imgW;
    this.scaleY = h / imgH;

    this.predictions = preds;
    this.selectedRegion = -1;
    this.panelCount = preds.length;

    if (this.panelCount === 0) {
      this.detectError = 'No solar panels detected in this image';
      this.detecting = false;
      return;
    }

    this.redraw();
    this.showOverlay = true;
    this.detectDone = true;
    this.detecting = false;
  }
}
